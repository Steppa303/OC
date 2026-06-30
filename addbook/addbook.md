# 📚 AddBook — Kindle Scribe → Buchsuche + Rezeptsuche → Kindle

**Zweck:** Bücher per Kindle Scribe Notiz suchen (Telegram-Link) ODER Rezepte suchen, filtern und direkt auf den Kindle senden.
**URL:** `addbook.steppa.online`
**Stand:** 30.06.2026 (Recipe Pipeline hinzugefügt)

---

## Trigger-System

Die Sync-Datei `addbook_sync.py` erkennt **zwei unabhängige Trigger** im Datei-Content.
Beide können in derselben Datei vorkommen:

| Trigger | Format | Aktion |
|---------|--------|--------|
| `Buch:` | `Buch: Titel` | Anna's Archive Suche → Telegram-Link → User klickt |
| `Rezept:` | `Rezept: Query 2x` | DuckDuckGo → Rating-Filter → PDF → Kindle direkt |

**Multiplier:** `Rezept: Nudeln 3x` → 3 Rezepte in 1 PDF

---

## Architektur

```
┌──────────────────┐     ┌──────────────────┐     ┌────────────────────────────┐
│  Kindle Scribe   │────▶│  Google Drive     │────▶│  addbook_sync.py (Cron)   │
│  Notiz: "p-gen"  │     │  "Kindle Scribe"  │     │                            │
│                  │     │  p-gen*.txt       │     │  Content parsen auf Trigger│
│  "Buch: Dune"   │     │                   │     │                            │
│  "Rezept: Pasta"│     │                   │     │  ┌──────┐    ┌────────┐   │
└──────────────────┘     └──────────────────┘     │  │Buch: │    │Rezept: │   │
                                                   │  └──┬───┘    └───┬────┘   │
                                                   └─────┼────────────┼────────┘
                                                         │            │
                                                         ▼            ▼
                                              ┌────────────────┐  ┌─────────────────────┐
                                              │ search.py      │  │ recipe_search.py    │
                                              │ (Anna's Archiv)│  │ (DDGS + JSON-LD)   │
                                              └───────┬────────┘  │ Filter ≥ 4.2⭐     │
                                                      │           └─────────┬───────────┘
                                                      ▼                     ▼
                                              ┌────────────────┐  ┌─────────────────────┐
                                              │ latest.json    │  │ recipe_pdf.py       │
                                              │ + Telegram-Lnk │  │ (WeasyPrint A5 PDF) │
                                              └───────┬────────┘  └─────────┬───────────┘
                                                      │                     │
                                                      ▼                     ▼
                                              ┌────────────────┐  ┌─────────────────────┐
                                              │ User klickt    │  │ send-to-kindle.py   │
                                              │ → Download     │  │ (PDF → Kindle)     │
                                              │ → Kindle Send  │  └─────────────────────┘
                                              └────────────────┘
```

---

## Komponenten

### 1. Google Drive Monitor (`addbook_sync.py`)
- **Herkunft:** Scribe-Projekt, erweitert um Rezept-Trigger
- **Aufgabe:** Alle 5-10 Min Google Drive "Kindle Scribe" Ordner nach `p-gen*` Dateien scannen
- **Content-Erkennung:**
  - `Buch: TITEL` → Buchsuche-Flow (Telegram-Link)
  - `Rezept: QUERY Nx` → Rezept-Flow (PDF → Kindle direkt)
  - Beide gleichzeitig möglich
- **State:** `.addbook_state.json` (Idempotenz)
- **Recipe Dedup:** `recipes/.recipe_state.json` → nie 2x gleiches Rezept

### 2. Recipe Pipeline (`recipes/`)
- **`recipe_search.py`:** DuckDuckGo Suche → Schema.org JSON-LD Extraktion → Rating-Filter ≥ 4.2/5
- **`recipe_pdf.py`:** WeasyPrint PDF (A5, Coverpage, Zutatenbox, Step-by-Step, Bild)
- Kein Telegram-Klick nötig — direkt an Kindle gesendet

### 3. Buch-Pipeline
- **`scraper/search.py`:** Anna's Archive Suche (4 Mirrors, Fallback-Chain)
- **`scripts/anna-browser-download.sh`:** EPUB via Libgen-CDN
- **`scripts/send-to-kindle.py`:** EPUB oder PDF per AgentMail an Kindle

### 4. Express Server (Port 3006)
- `GET /r` — Ergebnisseite
- `POST /api/download` — EPUB + Kindle Send
- `POST /api/sync` — Sync triggern

---

## Dateistruktur

```
addbook/
├── README.md                       ← Diese Datei
├── addbook.md                      ← Dieser Plan
├── package.json
├── server.js                       ← Express Server
├── addbook_sync.py                 ← Main Sync (beide Trigger)
├── .addbook_state.json             ← Verarbeitete Dateien
├── scraper/
│   └── search.py                   ← Anna's Archive Suche
├── recipes/
│   ├── recipe_search.py            ← Rezeptsuche (ddgs + JSON-LD)
│   ├── recipe_pdf.py               ← PDF-Generator (WeasyPrint)
│   └── .recipe_state.json          ← Dedup-State
├── scripts/
│   ├── anna-browser-download.sh    ← EPUB Download
│   └── send-to-kindle.py           ← Kindle Versand (EPUB+PDF)
├── templates/
│   └── results.html               ← E-Ink Frontend
└── logs/

/srv/addbook/
├── results/latest.json
├── epubs/
└── recipe_pdfs/                    ← Rezept-PDFs
```

---

## Wichtige Entscheidungen (30.06.2026)

1. **Zwei unabhängige Trigger** in einer Datei — `Buch:` und `Rezept:` laufen sequentiell
2. **Rezepte → immer direkt an Kindle** (kein Telegram-Klick) — weil PDF ready-to-read
3. **Rating-Filter ≥ 4.2⭐** — harte Grenze, durch JSON-LD `aggregateRating` aus Schema.org
4. **Internationale Quellen** — DuckDuckGo, keine regionale Einschränkung
5. **Dedup per URL** — `recipe_state.json` speichert alle gesendeten URLs pro Query

## Bekannte Probleme

1. **Rezepte ohne JSON-LD** werden nicht erkannt (weniger strukturierte Seiten)
2. **PDF statt .txt** vom Scribe wird übersprungen
3. **Amazon Kindle unterstützt kein direktes PDF-senden per "convert"** — PDF kommt als PDF an, nicht als reflowable