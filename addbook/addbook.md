# 📚 AddBook — Kindle Scribe → Buchsuche → Send to Kindle

**Zweck:** Bücher per Kindle Scribe Notiz suchen, Ergebnisse als Webseite anzeigen, per Klick auf den Kindle senden.
**URL:** `addbook.steppa.online`
**Stand:** 28.06.2026

---

## Architektur

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Kindle Scribe   │────▶│  Google Drive     │────▶│  Cron (10 min)   │
│  Notiz: "p-gen"  │     │  "Kindle Scribe"  │     │  addbook_sync.py │
│  "Buch: Dune"    │     │  p-gen*.txt       │     │                  │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                           │
                           ┌───────────────────────────────┘
                           ▼
                  ┌──────────────────┐
                  │  1. Parse Content │
                  │  "Buch: ..."     │──▶ Buchtitel extrahieren
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  2. Anna Search   │  (search.py aus Lesestoff)
                  │  → 100 Treffer   │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  3. HTML erzeugen │  → /srv/addbook/results/<id>.html
                  │  + Telegram Msg   │  → Link an Bastian
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  4. User öffnet   │  → addbook.steppa.online/r/<id>
                  │     Link          │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  5. Klick Download│  → POST /api/download
                  │     → EPUB holen  │  → anna-browser-download.sh
                  │     → Send Kindle │  → send-to-kindle.py
                  └──────────────────┘
```

---

## Komponenten

### 1. Google Drive Monitor (`addbook_sync.py`)
- **Herkunft:** Scribe-Projekt (`scribe_sync.py`)
- **Aufgabe:** Alle 10 Min Google Drive "Kindle Scribe" Ordner nach `p-gen*` Dateien scannen
- **Content-Erkennung:**
  - Zeile beginnt mit `Buch:` → Buchsuche-Flow
  - (später erweiterbar: `Film:`, `Podcast:`, etc.)
- **Nach Verarbeitung:** Datei aus Drive löschen (wie bei Scribe)
- **State:** `.addbook_state.json` (Idempotenz)

### 2. Such-Backend (Express Server, Port 3006)
- **Tech:** Node.js + Express (wie Lesestoff-Server)
- **Endpoints:**
  - `GET /r/:id` — Ergebnisseite ausliefern (server-seitig gerendertes HTML)
  - `POST /api/download` — EPUB herunterladen + an Kindle senden
  - `GET /api/status/:id` — Download/Send-Status abfragen (Polling)
- **Python-Subprozesse:**
  - `scraper/search.py` (aus Lesestoff) — Anna's Archive Suche
  - `scripts/anna-browser-download.sh` (aus Lesestoff) — EPUB Download
  - `scripts/send-to-kindle.py` (aus Lesestoff) — Kindle Versand

### 3. Frontend (addbook.steppa.online)
- **Tech:** Server-seitig gerendertes HTML + TailwindCSS + Vanilla JS
- **Caddy:** Reverse Proxy auf Port 3006
- **Features:**
  - Schlanke, gefällige Ergebnisliste (Cover, Titel, Autor, Format, Größe)
  - Download-Button pro Ergebnis
  - Live-Statusanzeige beim Download (Loading Spinner → Erfolg/Fehler)
  - Mobile-friendly

### 4. Telegram-Benachrichtigung
- **Trigger:** Nachdem Suche abgeschlossen
- **Inhalt:** "📚 X Bücher gefunden für 'Dune'. [Ergebnisse ansehen](addbook.steppa.online/r/<id>)"
- **Methode:** OpenClaw `sessions_send` oder Telegram Bot API direkt

---

## Dateistruktur

```
addbook/
├── addbook.md                    ← dieser Plan
├── package.json                  ← Node.js Dependencies
├── server.js                     ← Express Server
├── addbook_sync.py               ← Google Drive Monitor (Cron)
├── .addbook_state.json           ← Verarbeitete Dateien
├── scraper/
│   ├── search.py                 ← Kopie/symlink aus Lesestoff
│   └── download.py               ← Kopie/symlink aus Lesestoff
├── scripts/
│   ├── anna-browser-download.sh  ← Kopie/symlink aus Lesestoff
│   └── send-to-kindle.py         ← Kopie/symlink aus Lesestoff
├── templates/
│   └── results.html              ← HTML-Template für Ergebnisseite
├── public/
│   └── style.css                 ← Custom CSS (oder Tailwind CDN)
└── logs/
    └── addbook.log
```

---

## Implementierungs-Plan

### Phase 1: Server + Frontend (Express + HTML)
1. Express Server auf Port 3006 erstellen
2. `GET /r/:id` — Ergebnisseite ausliefern
3. HTML-Template mit Tailwind: Cover-Grid, Download-Buttons
4. Caddy-Config für `addbook.steppa.online`

### Phase 2: Such-Integration
1. `search.py` aus Lesestoff übernehmen (symlink oder kopieren)
2. `POST /api/search` — Trigger Anna Suche, speichere Ergebnisse in SQLite/JSON
3. Ergebnis-ID generieren, HTML-Datei rendern

### Phase 3: Download + Send to Kindle
1. `anna-browser-download.sh` + `send-to-kindle.py` übernehmen
2. `POST /api/download` — Startet Download im Hintergrund
3. `GET /api/status/:id` — Status-Polling (queued → downloading → sending → done/failed)
4. Fortschrittsanzeige im Frontend (JS-Polling)

### Phase 4: Google Drive Monitor (Cron)
1. `addbook_sync.py` — Composio MCP wie bei Scribe
2. `p-gen*` Dateien erkennen, Content parsen
3. Bei `Buch:` → Suche triggern, HTML generieren, Telegram-Link senden
4. Cron-Job: alle 10 Min

### Phase 5: Polish
1. Error Handling (kein Ergebnis, Download fehlgeschlagen, etc.)
2. Caching (gleiche Suche nicht doppelt ausführen)
3. Auto-Cleanup (alte Ergebnisse nach 7 Tagen löschen)
4. Logging

---

## Technische Entscheidungen

| Entscheidung | Wahl | Begründung |
|---|---|---|
| Frontend | Server-seitig gerendertes HTML | Einfach, kein Build-Prozess, schnell |
| Styling | TailwindCSS via CDN | Kein npm-Build nötig, konsistent mit anderen Projekten |
| Port | 3006 | Frei, neben Lesestoff (3004) und Dashboard (3002) |
| Ergebnis-Speicherung | JSON-Dateien (einfach) oder SQLite | SQLite wenn wir Caching brauchen |
| Download-Trigger | Klick auf Webseite | Direkt, kein weiterer Cron nötig |
| Benachrichtigung | Telegram mit Link | User sieht sofort, dass Ergebnisse da sind |
| Python-Scripts | Symlinks aus Lesestoff | DRY, Änderungen gelten für beide Projekte |

---

## offene Fragen
1. **Sollen die alten `p-gen` Dateien nach der Verarbeitung gelöscht werden?** (Ja, wie bei Scribe)
2. **Max. Ergebnisse pro Suche?** (100 wie gewünscht, paginiert darstellen?)
3. **Soll die Suche auch ohne Scribe-Trigger manuell via Webseite möglich sein?** (Nice-to-have)
4. **Download-Quelle:** Anna's Archive über Libgen (wie Lesestoff) — VPN-Proxy nötig?

---

## Abhängigkeiten
- Node.js (Express, better-sqlite3 oder raw JSON)
- Python 3 (search.py, BeautifulSoup, requests)
- Composio MCP (Google Drive Zugriff)
- AgentMail SDK (Kindle Versand)
- Caddy (Reverse Proxy)
- TailwindCSS CDN
