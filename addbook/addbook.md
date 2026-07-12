# 📚 AddBook — Kindle Scribe → Buchsuche + Rezeptsuche + Fragen → Kindle

**Zweck:** Bücher per Kindle Scribe Notiz suchen (Telegram-Link), Rezepte suchen/filtern/direkt senden, ODER Fragen beantworten und als Deep-Research-PDF auf den Kindle liefern.
**URL:** `addbook.steppa.online`
**Stand:** 01.07.2026 (Frage-Trigger + Free Model Chain + Quality Check)

---

## Trigger-System

Die Sync-Datei `addbook_sync.py` erkennt **drei unabhängige Trigger** im Datei-Content.
Alle können in derselben Datei vorkommen, werden sequentiell verarbeitet.

| Trigger | Format | Aktion |
|---------|--------|--------|
| `Buch:` | `Buch: Titel` | Anna's Archive Suche → Telegram-Link → User klickt |
| `Rezept:` | `Rezept: Query 2x` | DuckDuckGo → Rating-Filter → PDF → Kindle direkt |
| `Frage:` | `Frage: Was ist...` | Free Model Chain → Deep Research Report → PDF → Kindle direkt |

**Multiplier:** `Rezept: Nudeln 3x` → 3 Rezepte in 1 PDF

---

## Architektur

```
┌──────────────────┐     ┌──────────────────┐     ┌───────────────────────────────────────────┐
│  Kindle Scribe   │────▶│  Google Drive     │────▶│  addbook_sync.py (Cron)                   │
│  Notiz: "p-gen"  │     │  "Kindle Scribe"  │     │                                           │
│                  │     │  p-gen*.txt       │     │  Content parsen auf 3 Trigger             │
│  "Buch: Dune"   │     │                   │     │                                           │
│  "Rezept: Pasta"│     │                   │     │  ┌──────┐  ┌────────┐  ┌───────┐         │
│  "Frage: Was..."│     │                   │     │  │Buch: │  │Rezept: │  │Frage: │         │
└──────────────────┘     └──────────────────┘     │  └──┬───┘  └───┬────┘  └───┬───┘         │
                                                   └─────┼──────────┼───────────┼─────────────┘
                                                         │          │           │
              ┌──────────────────────────────────────────┘          │           │
              ▼                                                      ▼           ▼
   ┌─────────────────────┐                               ┌─────────────────┐  ┌──────────────────┐
   │ search.py           │                               │ recipe_search   │  │ ask_agent.py     │
   │ (Anna's Archive)    │                               │ (DDGS + JSONLD) │  │ (Free Model Cha │
   │ → Telegram-Link     │                               │ → Filter ≥4.2⭐ │  │ → Deep Research │
   │ → User klickt       │                               │ → PDF → Kindle  │  │ → PDF → Kindle   │
   └─────────────────────┘                               └─────────────────┘  └──────────────────┘
```

---

## Komponenten

### 1. Google Drive Monitor (`addbook_sync.py`)
- Scannt alle 5-10 Min Google Drive "Kindle Scribe" Ordner nach `p-gen*` Dateien
- Content-Erkennung: `Buch:`, `Rezept:`, `Frage:` — alle unabhängig parbar
- State: `.addbook_state.json` (Idempotenz) + `.sync.lock` (Race Condition Guard)
- Geparste Dateien → `p-gen-archiv` verschieben

### 2. Question Pipeline (`ask/`)
- **`ask_agent.py`:** Sendet Frage an OpenClaw-CLI, iteriert durch Free Model Chain
  bis eins antwortet. Returnt Deep-Research-Report (Markdown, 1500-4000 Wörter).
- **Free Model Chain (priorisiert nach Zuverlässigkeit):**
  1. `nemotron-3-super-120b-a12b:free` — **Primary**, bewährt (52-106s, 3k-4k chars)
  2. `nemotron-3-ultra-550b-a55b:free` — 550B für maximale Tiefe, manchmal ratelimited
  3. `gemma-4-31b-it:free` — Höchster Quality Score (65), oft ratelimited
  4. `gpt-oss-120b:free` — OpenAI open-weight, oft ratelimited
- **`answer_pdf.py`:** WeasyPrint A5 PDF aus Frage + Antwort
- **Guard:** `answer.startswith("Fehler:")` → bricht ab, kein Kindle-Versand (07/2026 fix)
- **Telegram:** "❓ Frage beantwortet: '...' + Antwort-Preview + 📬 An Kindle gesendet"

### 3. Recipe Pipeline (`recipes/`)
- **`recipe_search.py`:** DuckDuckGo Suche → Schema.org JSON-LD Extraktion → Rating-Filter ≥ 4.2/5
- **`recipe_pdf.py`:** WeasyPrint PDF (A5, Coverpage, Zutatenbox, Step-by-Step, Bild)
- **Dedup:** `recipes/.recipe_state.json` — nie 2x gleiches Rezept

### 4. Buch-Pipeline
- **`scraper/search.py`:** Anna's Archive Suche (4 Mirrors, Fallback-Chain)
- **`scripts/anna-browser-download.sh`:** EPUB via Libgen-CDN
- **`scripts/send-to-kindle.py`:** EPUB oder PDF per AgentMail an Kindle

### 5. Express Server (Port 3006)
- `GET /` → Landing Page
- `GET /r` → Ergebnisseite (E-Ink optimiert)
- `POST /api/search` → Manuelle Suche
- `POST /api/download` → EPUB holen + an Kindle senden
- `POST /api/sync` → Sync manuell triggern
- `GET /health` → Healthcheck

---

## Dateistruktur

```
addbook/
├── README.md                       ← Hauptdokumentation
├── addbook.md                      ← Plan/Architektur (diese Datei)
├── package.json
├── server.js                       ← Express Server
├── addbook_sync.py                 ← Main Sync (alle 3 Trigger)
├── .addbook_state.json             ← Verarbeitete Dateien
├── ask/
│   ├── ask_agent.py                ← Frage-Engine + Free Model Chain
│   └── answer_pdf.py               ← WeasyPrint PDF für Antworten
├── recipes/
│   ├── recipe_search.py            ← Rezeptsuche (ddgs + JSON-LD)
│   ├── recipe_pdf.py               ← PDF-Generator (WeasyPrint)
│   └── .recipe_state.json          ← Dedup-State
├── scripts/
│   ├── anna-browser-download.sh    ← EPUB Download
│   └── send-to-kindle.py           ← Kindle Versand (EPUB+PDF)
├── scraper/
│   └── search.py                   ← Anna's Archive Suche
├── templates/
│   └── results.html                ← E-Ink Frontend
└── logs/
    └── addbook.log                 ← Sync-Log

/srv/addbook/
├── results/latest.json
├── epubs/
├── recipe_pdfs/                     ← Rezept-PDFs
└── answer_pdfs/                     ← Frage-Antwort-PDFs
```

---

## Bekannte Probleme (Stand 01.07.2026)

1. **PDF statt .txt** vom Scribe wird übersprungen (Parser erwartet Text)
2. **Rezepte ohne JSON-LD** werden nicht erkannt
3. **Free Model Rate Limits** — Gemma/GPT-OSS/Nemotron Ultra sind oft ratelimited
4. **Error-Guard:** Seit 07/2026 checked `process_question_trigger()` auf `answer.startswith("Fehler:")`
   → verhindert Garbage-PDFs auf dem Kindle