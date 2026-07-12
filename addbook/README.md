# 📚 AddBook

**Kindle Scribe → Buchsuche + Rezeptsuche + Fragen → Kindle**

Schreib `Buch: Titel`, `Rezept: Suchbegriff 2x` oder `Frage: Was ist...` auf deinen Kindle Scribe, und alles passiert automatisch.

**URL:** `addbook.steppa.online`

---

## Architektur

```
Kindle Scribe Notiz ("p-gen")
        │
        ▼
Google Drive ("Kindle Scribe" Ordner)
        │
        ▼
Cron (alle 5 Min) / POST /api/sync
        │
        ▼
addbook_sync.py
  ├─ Composio MCP → Google Drive API
  ├─ Content parsen → Trigger erkennen
  │
  ├─ [Trigger "Buch:"] ─────────────────────────┐
  │  ├─ Anna's Archive Suche (search.py)        │
  │  ├─ Ergebnis-JSON speichern                 │
  │  ├─ Telegram-Link senden                    │
  │  └─ User klickt → Download + Send to Kindle │
  │                                             │
  ├─ [Trigger "Frage:"] ────────────────────────┤
  │  ├─ Free Model Chain (ask_agent.py)         │
  │  ├─ Deep Research Report (1.5k-4k chars)   │
  │  ├─ Quality Check (kein Garbage!)           │
  │  ├─ WeasyPrint PDF                         │
  │  └─ Send to Kindle (direkt, kein Klick)     │
  │                                             │
  ├─ [Trigger "Rezept:"] ───────────────────────┤
  │  ├─ DuckDuckGo Rezeptsuche                  │
  │  ├─ Filter ≥ 4.2⭐ (JSON-LD)               │
  │  ├─ WeasyPrint PDF (A5, Zutaten, Steps)    │
  │  └─ Send to Kindle (direkt, kein Klick)     │
  │                                             │
  └─ Datei → "p-gen-archiv" verschieben         │
                                                ▼
Express Server (Port 3006)
  ├─ GET /          → Landing Page
  ├─ GET /r         → Ergebnisseite (E-Ink optimiert)
  ├─ POST /api/search   → Manuelle Suche
  ├─ POST /api/download → EPUB holen + an Kindle
  ├─ GET /api/status/:id → Download-Status
  └─ POST /api/sync      → Sync manuell triggern
        │
        ▼
Caddy (addbook.steppa.online → localhost:3006)
```

---

## Komponenten

### 1. Express Server (`server.js`)

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/` | GET | Landing Page |
| `/r` | GET | Letzte Suchergebnisse (E-Ink optimiert) |
| `/api/search` | POST | Anna's Archive Suche starten |
| `/api/download` | POST | EPUB + automatisch an Kindle senden |
| `/api/status/:id` | GET | Download-Status (queued → downloading → sending → done) |
| `/api/sync` | POST | Google Drive Sync triggern |
| `/health` | GET | Healthcheck |

**Port:** 3006 · **Service:** `systemctl addbook`

### 2. Google Drive Monitor (`addbook_sync.py`)

Scannt "Kindle Scribe" Ordner auf `p-gen*` Dateien.

**Content-Parsing (Trigger):**
```
1                       ← Seitenzahl (ignoriert)
Buch: Dune              ← Buch-Suche → Telegram-Link
Oder:
Rezept: Nudeln 3x       ← Rezept-Suche → PDF → Kindle direkt
Oder:
Frage: Was ist...       ← Deep Research → PDF → Kindle direkt
Oder alles zusammen.
```

**Flow:**
1. Composio MCP → Google Drive "Kindle Scribe" Ordner scannen
2. `p-gen*` Dateien finden (case-insensitive)
3. Content herunterladen (via S3-URL von Composio)
4. Trigger parsen (`Buch:` / `Frage:` / `Rezept:`)
5. Buch: Anna's Archive → JSON → Telegram-Link
6. Frage: Free Model Chain → Quality Check → PDF → Kindle
7. Rezept: DuckDuckGo → PDF → Kindle direkt
8. Datei in `p-gen-archiv` verschieben

**Cron:** `*/5 * * * * curl -s -X POST http://localhost:3006/api/sync > /dev/null 2>&1`

**Race Condition Guard:** File Lock via `fcntl.flock()` — zwei parallele Cron-Instanzen blockieren sich gegenseitig.

### 3. Question Pipeline (`ask/`)

**Trigger:** `Frage: Was ist...` im Datei-Content (parallel zu `Buch:` und `Rezept:`)

**Pipeline:**
1. `parse_content_for_question()` → extrahiert Frage-Text (Multi-Line Support)
2. `ask_agent.py` → OpenClaw-CLI mit Free Model Chain
3. **Free Model Chain (Fallback bei Fehler + Garbage):**
   - `nemotron-3-super-120b-a12b:free` — Primary (bewährt, ~52-106s)
   - `nemotron-3-ultra-550b-a55b:free` — 550B max depth
   - `gemma-4-31b-it:free` — Quality Score 65
   - `gpt-oss-120b:free` — OpenAI open-weight
4. `answer_pdf.py` → WeasyPrint PDF (A5, Coverpage, Frage+Antwort, Quellenverzeichnis)
5. `scripts/send-to-kindle.py` → PDF per AgentMail an Kindle
6. **Quality Check:** `_is_valid_answer()` in ask_agent.py + double layer in addbook_sync.py
7. Telegram: "❓ Frage beantwortet: 'Suchbegriff'" mit Preview

**Timeout:** 300s pro Modell, gesamte Pipeline max ~20 Min

### 3.5. List Pipeline (Google Docs Checklist)

**Trigger:** `Liste: Einkaufen` im Datei-Content

**Format auf dem Scribe:**
```
Liste: Einkaufen
- Milch
Eier
• Brot
Käse
```

**Pipeline:**
1. `parse_content_for_list()` → extrahiert `{title, items}` (erkennt Bulletpoints, einfache Zeilen)
2. `process_list_trigger()` → Markdown mit Checkboxes generieren
3. **`GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN`** → Google Doc mit `- [ ] Item` Checkliste
4. Telegram: "📋 Liste erstellt: 'Einkaufen' — 4 Einträge" mit Link

**Archiv:** Datei wird nach `p-gen-archiv` verschoben.
**Priority:** Liste wird vor anderen Triggern geprüft.

### 4. Recipe Pipeline (`recipes/`)

**Trigger:** `Rezept: Suchbegriff 2x` im Datei-Content

**Pipeline:**
1. `parse_content_for_recipe()` → extrahiert `(query, count)`
2. **`recipes/recipe_search.py`** → DuckDuckGo Suche, Schema.org JSON-LD Parsing
3. **Rating-Filter:** `aggregateRating.ratingValue ≥ 4.2/5`
4. **Dedup:** via `recipes/.recipe_state.json` (nie 2x gleiches Rezept)
5. **`recipes/recipe_pdf.py`** → WeasyPrint PDF (A5, Coverpage, Zutatenbox, Step-by-Step, Bild)
6. **`scripts/send-to-kindle.py`** → PDF per AgentMail an Kindle
7. Telegram: "🍳 3 Rezepte gesendet für 'Chicken Tikka Masala'"

**Multiplier:** `Rezept: Nudeln 3x` → 3 Rezepte in 1 PDF
**Quellen:** International (DuckDuckGo via ddgs), keine Social-Media/Videosites

### 5. Buchsuche (`scraper/search.py`)

Sucht auf Anna's Archive nach Büchern (4 Mirrors, Fallback-Chain).
Gibt JSON: `md5`, `title`, `author`, `format`, `size`, `language`, `year`, `coverUrl`

### 6. EPUB Download (`scripts/anna-browser-download.sh`)

Lädt EPUB via Libgen-CDN, prüft Magic Bytes (`PK\x03\x04`).

### 7. Send to Kindle (`scripts/send-to-kindle.py`)

Sendet EPUB oder PDF per AgentMail an `bastianlewin_213e22@kindle.com`.
- Von: `bastians_assistent@agentmail.to`
- Automatische File-Type Erkennung (.epub → application/epub+zip, .pdf → application/pdf)

### 8. Frontend (E-Ink optimiert)

**Design-Prinzipien für Kindle Scribe:**
- Weißer Hintergrund, Serif-Font (Georgia), hoher Kontrast
- Kleine Cover (160×220px) für schnelles Rendering
- Große Buttons (14px Padding), Single-Column Layout
- Kein Tailwind CDN, reines CSS

### 9. Quality Check (`ask/ask_agent.py` \_is_valid_answer)

**Warum:** Nemotron Super halluziniert manchmal Token-Suppe statt Inhalt. Der alte `startswith("Fehler:")` Guard hat Garbage-Antworten nicht gefangen.

**Checks (alle hart):**
1. **Minimallänge** ≥ 100 Zeichen
2. **Keine Steuerzeichen** (>2% Control-Chars = Garbage)
3. **Kein System-Prompt-Leakage** ("The user wants...", "As an AI...", "I'll help...")
4. **Deutsch-Ratio** ≥ 15% deutsche Stoppwörter in ersten 500 Zeichen
5. **ASCII-Noise** Keine langen >5er Nicht-Alphabet-Ketten
6. **Alphabetic Ratio** ≥ 50% Buchstaben/Whitespace
7. **Error Prefix** "Fehler:" oder "Error:"

**Double Layer:** `ask_agent.py` (Chain überspringt Garbage → nächstes Model) + `addbook_sync.py` (validiert nochmal vor PDF/Kindle).

---

## Dateistruktur

```
addbook/
├── README.md                       # Diese Datei
├── addbook.md                      # Plan/Architektur
├── package.json                    # Node.js Dependencies
├── server.js                       # Express Server (Port 3006)
├── addbook_sync.py                 # Google Drive Monitor (Cron)
├── .addbook_state.json             # Verarbeitete Dateien
├── ask/
│   ├── ask_agent.py                # Frage-Engine + Free Model Chain + Quality Check
│   └── answer_pdf.py               # PDF für Antworten
├── scraper/
│   └── search.py                   # Anna's Archive Suche
├── recipes/
│   ├── recipe_search.py            # Rezeptsuche (DDGS + JSON-LD)
│   ├── recipe_pdf.py               # PDF-Generator (WeasyPrint)
│   └── .recipe_state.json          # Dedup-State
├── scripts/
│   ├── anna-browser-download.sh    # EPUB Download
│   └── send-to-kindle.py           # Kindle Versand (EPUB + PDF)
├── templates/
│   └── results.html                # E-Ink-optimiertes Frontend
├── public/
├── node_modules/
└── logs/
    └── addbook.log                 # Sync-Log

/srv/addbook/
├── results/
│   └── latest.json                 # Letzte Suchergebnisse
├── epubs/
│   └── *.epub                      # Temporäre Downloads
├── recipe_pdfs/
│   └── rezept-*.pdf                # Generierte Rezept-PDFs
└── answer_pdfs/
    └── antwort-*.pdf               # Generierte Frage-Antwort-PDFs
```

---

## Konfiguration

### Secrets (aus `/root/.openclaw/openclaw.json`)

| Secret | Pfad | Zweck |
|--------|------|-------|
| Telegram Bot Token | `channels.telegram.accounts.default.botToken` | Telegram-Benachrichtigung |
| AgentMail API Key | `skills.entries.agentmail.env.AGENTMAIL_API_KEY` | Kindle-Versand |

### Externe Services

| Service | Zweck | Auth |
|---------|-------|------|
| Composio MCP | Google Drive Zugriff | OAuth (`/root/.openclaw/mcp-oauth/composio-*.json`) |
| DuckDuckGo (ddgs) | Rezeptsuche | Keine |
| Anna's Archive | Büchersuche + Download | Keine (öffentlich) |
| AgentMail | Kindle-Versand | API Key |
| Telegram Bot | Benachrichtigung | Bot Token |

### Caddy
```caddy
addbook.steppa.online {
    reverse_proxy localhost:3006
}
```

### systemd
```ini
# /etc/systemd/system/addbook.service
[Unit]
Description=AddBook Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/.local/.openclaw/workspace/addbook
ExecStart=/usr/bin/node /root/.local/.openclaw/workspace/addbook/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## Nutzung

### Bücher (automatisch via Telegram-Link)
1. Neue Notiz auf Scribe: `Buch: Der Name des Windes`
2. Automatisch syncen → Telegram-Link → Link öffnen
3. "📥 Zu Kindle senden" klicken → EPUB auf dem Kindle

### Rezepte (vollautomatisch)
1. Neue Notiz: `Rezept: Chicken Tikka Masala 2x`
2. Automatisch syncen → PDF wird generiert + direkt an Kindle gesendet
3. Telegram: "🍳 2 Rezepte gesendet für 'Chicken Tikka Masala'"

### Fragen (vollautomatisch, Deep Research)
1. Neue Notiz: `Frage: Was ist der Sinn des Lebens?`
2. Automatisch syncen → Free Model Chain → Deep-Research-Report → PDF an Kindle
3. Telegram: "❓ Frage beantwortet: 'Was ist der Sinn des Lebens?'" mit Preview

### Manuell (via API)
```bash
curl -X POST http://localhost:3006/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Dune", "lang": "de", "ext": "epub"}'

curl -X POST http://localhost:3006/api/sync
```

---

## Betrieb

```bash
# Server
systemctl {start|stop|restart|status} addbook

# Logs
journalctl -u addbook -f                              # Server
tail -f addbook/logs/addbook.log                      # Sync

# Cron prüfen
crontab -l | grep addbook

# Manueller Sync
curl -X POST http://localhost:3006/api/sync
```

### Bekannte Probleme

1. **Error-Guard (07/2026)** — `process_question_trigger()` checkt `answer.startswith("Fehler:")` → verhindert Garbage-PDFs. Der alte Check `len(answer) < 10` war zu schwach.
2. **Quality Check (07/2026)** — `_is_valid_answer()` filtert halluzinierte Token-Suppe (System-Prompt-Leakage, Steuerzeichen, zu wenig Deutsch). Double Layer: Chain skip + addbook_sync guard.
3. **PDF-Dateien statt .txt** — Kindle Scribe kann PDFs erzeugen. Parser überspringt Binär-PDFs.
4. **Free Model Rate Limits** — Gemma 4 31B, GPT-OSS 120B und Nemotron Ultra 550B sind oft ratelimited. Chain fallt auf Nemotron Super zurück.
5. **Rezept-Dedup** — Gleicher Query bekommt immer neue Rezepte (nie wiederholte URLs).
6. **Rezept-PDF: `[Convert]` im Subject** — Amazon konvertiert PDFs nur mit "Convert" im Betreff.
7. **Keine Bilder auf großen Rezeptseiten** — Pillow skaliert auf max 400px Breite.

---

## Technologie-Stack

| Komponente | Tech |
|------------|------|
| Server | Node.js + Express |
| Frontend | Vanilla HTML/CSS/JS |
| Drive Monitor | Python 3 + Composio MCP |
| Frage-Pipeline | Python + OpenClaw CLI + Free Models |
| Buchsuche | Python + BeautifulSoup (Anna's Archive) |
| Rezeptsuche | Python + ddgs + JSON-LD (Schema.org) |
| PDF-Gen | Python + WeasyPrint |
| Kindle Versand | Python + AgentMail SDK |
| Reverse Proxy | Caddy |
| Service | systemd |