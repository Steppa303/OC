# 📚 Anna's Archive — Handover-Dokument

**Projekt:** Anna's Archive → Reader App Integration
**Stand:** 19.06.2026
**Autor:** Bernd (AI-Agent)

---

## 1. Was ist das?

Eine Integration von Anna's Archive in die bestehende Reader App (`reader.steppa.online`). Nutzer können direkt aus der Bibliotheksansicht nach deutschen Büchern suchen, sie downloaden — und die EPUBs landen automatisch in der Reader-Bibliothek, ohne manuelles Hochladen.

---

## 2. Wo liegt alles?

| Komponente | Pfad / URL |
|-----------|------------|
| **Projekt-Root** | `/root/.local/.openclaw/workspace/projects/anna/` |
| **Plan** | `projects/anna/PLAN.md` |
| **Python Scraper** | `projects/anna/scraper/search.py` |
| **Python Downloader** | `projects/anna/scraper/download.py` |
| **Reader App Backend** | `projects/reader-app/server.js` |
| **Reader App Frontend** | `projects/reader-app/public/` |
| **Reader App DB-Modul** | `projects/reader-app/db.js` |
| **EPUB-Parser** | `projects/reader-app/epub-parser.js` |
| **EPUB-Storage** | `/srv/reader/epubs/` |
| **SQLite-DB** | `/srv/reader/reader.db` |
| **PM2 Config** | `projects/reader-app/ecosystem.config.js` |
| **Caddy Config** | `/etc/caddy/Caddyfile` |

---

## 3. Architektur (für einen schnellen Überblick)

```
Browser ──HTTPS──> Caddy (443) ──> Express (3003)
                                        │
                          ┌─────────────┴─────────────┐
                          │          API-Routen        │
                          │  /api/books        (alt)   │
                          │  /api/bookmarks    (alt)   │
                          │  /api/anna/search  (neu)   │
                          │  /api/anna/download (neu)  │
                          │  /api/anna/status   (neu)  │
                          │  /api/anna/queue    (neu)  │
                          └─────────────┬─────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
              db.js (SQLite)                         Python Scraper
              ├── books (alt)                       (child_process)
              ├── bookmarks (alt)                   ├── search.py
              ├── tts_history (alt)                 └── download.py
              ├── anna_queue (neu)                        │
              └── anna_search_cache (neu)                 ▼
                                                    /srv/reader/epubs/
                                                        │
                                                        ▼
                                              epub-parser.js → db.insertBook()
```

### Wichtiger Flow: Download → Bibliothek

```
1. POST /api/anna/download  { md5, title, author }
   → db.addAnnaQueue({ status: 'queued' })
   → spawn('python3', ['download.py', '--md5', ..., '--output', ...])
   → Response { queueId, status: 'queued' }

2. Python download.py läuft
   → scraped /md5/<hash> → findet Download-Links
   → lädt EPUB von LibGen (priorität 1) oder IPFS/Mirror (fallback)
   → schreibt nach /srv/reader/epubs/<uuid>-<title>.epub
   → exit code 0 bei Erfolg

3. Node.js onExit-Callback
   → status: 'processing'
   → epubParser.saveEpub() parst EPUB
   → db.insertBook() → Buch in Bibliothek
   → status: 'done', book_id setzen
```

---

## 4. Python Scraper

### `projects/anna/scraper/search.py`

**Aufruf:**
```bash
python3 search.py --query "Künstliche Intelligenz" --lang de --ext epub --page 1
```

**Output:** JSON (stdout)
```json
{
  "results": [
    {
      "md5": "d1bafc9edc19b4190c125480fec1cfe0",
      "title": "Python für Kids",
      "author": "Gregor Lingl",
      "year": 2010,
      "format": "PDF",
      "size": "21.4MB",
      "language": "de",
      "source": "libgen",
      "coverUrl": "https://covers...",
      "description": "..."
    }
  ],
  "page": 1,
  "total": 42
}
```

**XPath-Logik (von SearXNG abgeleitet):**
- Ergebnisse: `//main//div[contains(@class, 'js-aarecord-list-outer')]/div[contains(@class, 'flex')]`
- Titel: `.//a[contains(@class, 'js-vim-focus')]`
- MD5: `./a/@href` → split bei `/md5/`
- Metadaten: `.//div[contains(@class, 'font-semibold')]` → splitten bei `·`
- Autor: `.//a[.//span[contains(@class, 'icon-[mdi--user-edit]')]]`
- Cover: `.//img/@src`
- Beschreibung: `.//div[@class='relative']/div[contains(@class, 'line-clamp')]`

### `projects/anna/scraper/download.py`

**Aufruf:**
```bash
python3 download.py --md5 d1bafc9edc19b4190c125480fec1cfe0 --output /srv/reader/epubs/uuid-buch.epub
```

**Quellen-Priorität:**
1. LibGen (direct, kein CAPTCHA) 🥇
2. IPFS-Gateway 🌐
3. Mirror-Fallback (via FlareSolverr) 🔄

**Dependencies (`requirements.txt`):**
```
requests>=2.31.0
beautifulsoup4>=4.12.0
lxml>=5.0.0
```

---

## 5. Neue API-Routen (in `server.js`)

### `GET /api/anna/search`
Ruft `search.py` via `child_process.exec()` auf.
- Query-Parameter: `q`, `lang` (default `de`), `ext` (default `epub`), `page`
- Response: JSON mit `results[]` + Pagination
- Optionaler Cache in `anna_search_cache` (TTL 1h)

### `POST /api/anna/download`
Startet Download-Prozess.
- Body: `{ md5, title, author }`
- Legt Queue-Eintrag an, spawnt `download.py`, returned `queueId`
- Bei Fertig: EPUB parsen + `db.insertBook()` → Buch sichtbar

### `GET /api/anna/status/:queueId`
Status eines Downloads.

### `GET /api/anna/queue`
Alle Queue-Einträge (aktiv + historisch).

---

## 6. Datenbank (SQLite, `/srv/reader/reader.db`)

### Bestehende Tabellen (unverändert)
- `books` — Bücher in der Bibliothek
- `bookmarks` — Lesezeichen
- `tts_history` — TTS-Play-History

### Neue Tabellen (in `db.js`)

```sql
CREATE TABLE IF NOT EXISTS anna_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  md5 TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  format TEXT DEFAULT 'epub',
  size_bytes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued',  -- queued | downloading | processing | done | failed
  error_message TEXT,
  book_id TEXT,                   -- FK zu books.id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS anna_search_cache (
  query_hash TEXT PRIMARY KEY,
  results TEXT NOT NULL,  -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Reader App — Bestehende Struktur (nicht ändern ohne Absprache)

| Datei | Zweck | 🔜 Änderungen |
|-------|-------|--------------|
| `server.js` | Express-Backend | + Anna API-Routen |
| `db.js` | SQLite-Modul | + Neue Tabellen + CRUD |
| `epub-parser.js` | EPUB-Parsing | Wiederverwendet (keine Änderung) |
| `public/index.html` | HTML-Struktur | + Such-Overlay + Queue-Panel |
| `public/app.js` | Frontend-Logik | + Such-/Download-Funktionen |
| `public/styles.css` | Styles | + Anna-spezifische Styles |
| `tts-service.js` | ElevenLabs TTS | Keine Änderung |

**Reader App Dependencies (package.json):**
- `express` — HTTP-Server
- `better-sqlite3` — SQLite
- `adm-zip` — EPUB (ZIP) entpacken
- `jsdom` — XML/HTML-Parsing
- `multer` — File-Upload
- `uuid` — IDs

---

## 8. Wichtige Entscheidungen & Begründungen

### Warum Python-Sidecar statt Node.js-Scraper?
- Anna's Archive erfordert HTML-Scraping mit lxml/BeautifulSoup
- Python hat bessere HTTP-Handling-Bibliotheken (requests)
- Python kann leichter um FlareSolverr-Proxy erweitert werden
- Node.js `child_process.spawn()` ist einfach und zuverlässig

### Warum kein stacks Docker?
- Stacks ist groß, braucht FlareSolverr + Docker
- Für die ersten ~100 Bücher reicht der Python-Downloader
- Stacks kann später als optionales Upgrade kommen (Phase 6 im Plan)
- Reader App bleibt Single Source of Truth — kein externer Service nötig

### Warum Queue in SQLite statt in Memory?
- Bei Server-Crash gehen queued Downloads nicht verloren
- Frontend kann Status auch nach Page-Refresh abrufen
- Einfache Persistenz ohne zusätzliche Services (Redis etc.)

### Warum LibGen priorisieren?
- LibGen-Downloads brauchen kein CAPTCHA
- Meist schnellere Geschwindigkeit als IPFS
- Höchste Erfolgsrate bei Anna's Archive

---

## 9. Bekannte Risiken

### Anna's Archive blockt Scraper
- Lösung: User-Agent rotieren, random Delays (1-3s)
- Lösung: Mirror-Fallback (`.gl` → `.li` → `.pm`)
- Lösung: WireGuard SOCKS Proxy als Exit (residential IP)

### Cloudflare/DDoS-Guard 403
- Lösung: FlareSolverr-Container
- Lösung: SOCKS5-Proxy via WireGuard (wg0, Fritzbox-Heimnetz)

### LibGen Down
- Lösung: IPFS + Mirror-Fallback in `download.py`
- Lösung: Queue-Eintrag bleibt `failed` → manueller Retry

### EPUB-Parsing schlägt fehl
- Lösung: `try/catch` im onExit-Callback
- Lösung: Queue-Status auf `failed` + error_message
- Lösung: EPUB-Datei bleibt in `/srv/reader/epubs/` für manuelle Reparatur

### Rate-Limiting
- Lösung: Delays zwischen Requests (configurable in search.py)
- Lösung: Maximale 1 Download gleichzeitig
- Lösung: Cache für Suchergebnisse (1h TTL)

---

## 10. Deployment & Betrieb

### Reader App neustarten (nach Code-Änderungen)
```bash
pm2 restart reader-app
```

### Logs
```bash
# Reader App Logs
pm2 logs reader-app --lines 50 --nostream

# Python Scraper Logs (wenn umgeleitet)
tail -f /var/log/anna-scraper.log
```

### DB-Checks
```bash
# Queue-Status
sqlite3 /srv/reader/reader.db "SELECT id, title, status FROM anna_queue ORDER BY created_at DESC;"

# Bücher in Bibliothek
sqlite3 /srv/reader/reader.db "SELECT id, title, author FROM books ORDER BY created_at DESC LIMIT 10;"

# EPUBs auf Platte
ls -lh /srv/reader/epubs/ | head -20
```

### Python-Dependencies installieren
```bash
cd /root/.local/.openclaw/workspace/projects/anna/scraper
pip3 install -r requirements.txt
```

### Scraper manuell testen
```bash
cd /root/.local/.openclaw/workspace/projects/anna/scraper
python3 search.py --query "Python" --lang de | python3 -m json.tool
python3 download.py --md5 d1bafc9edc19b4190c125480fec1cfe0 --output /tmp/test.epub
```

---

## 11. Projekt-Struktur (final)

```
projects/
├── reader-app/                        ← BESTEHEND
│   ├── server.js                      ← + Anna API-Routen
│   ├── db.js                          ← + Neue Tabellen
│   ├── epub-parser.js                 ← Unverändert
│   ├── tts-service.js                 ← Unverändert
│   ├── public/
│   │   ├── index.html                 ← + Such- + Queue-UI
│   │   ├── app.js                     ← + Such-/Download-Logik
│   │   └── styles.css                 ← + Anna-Styles
│   ├── tests/
│   │   └── reader.spec.js             ← + Anna-Tests (irgendwann)
│   ├── ecosystem.config.js
│   ├── package.json
│   └── README.md
│
└── anna/                              ← NEU (dieses Projekt)
    ├── PLAN.md                        ← Kompletter Umsetzungsplan
    ├── HANDOVER.md                    ← Diese Datei
    ├── scraper/
    │   ├── search.py                  ← Anna's Archive Suche
    │   ├── download.py                ← EPUB Download
    │   └── requirements.txt           ← Python-Dependencies
    └── README.md                      ← Quickstart
```

---

## 12. REST-API Übersicht (Reader App inkl. Anna)

| Methode | Route | Zweck |
|---------|-------|-------|
| `GET` | `/health` | Healthcheck |
| `POST` | `/api/upload` | EPUB hochladen (Datei) |
| `GET` | `/api/books` | Bücherliste |
| `GET` | `/api/books/:id` | Buch-Details |
| `GET` | `/api/books/:id/content` | Kapitel-Inhalte |
| `POST` | `/api/books/:id/tts` | TTS starten |
| `POST` | `/api/bookmarks/:id` | Lesezeichen setzen |
| `GET` | `/api/bookmarks/:id` | Lesezeichen abrufen |
| `DELETE` | `/api/books/:id` | Buch löschen |
| `GET` | `/api/anna/search` | Anna's Archive Suche 🔜 |
| `POST` | `/api/anna/download` | Download starten 🔜 |
| `GET` | `/api/anna/status/:id` | Download-Status 🔜 |
| `GET` | `/api/anna/queue` | Queue-Liste 🔜 |

---

## 13. Ausstehende Tasks (Stand 19.06.2026)

Siehe `PLAN.md` für detaillierte Task-Liste. Kurzfassung:

- [ ] **Phase 1:** Backend API-Routen (`server.js`)
- [ ] **Phase 2:** DB-Tabellen + CRUD (`db.js`)
- [ ] **Phase 3:** Python Scraper (`search.py`, `download.py`)
- [ ] **Phase 4:** Frontend UI (`index.html`, `app.js`, `styles.css`)
- [ ] **Phase 5:** Integrationstests
- [ ] **Phase 6:** Queue + Cron (optional)

---

## 14. Kontakte & Links

- **Reader App:** https://reader.steppa.online
- **Anna's Archive:** https://annas-archive.gl
- **Anna's Archive Alternativen:** https://annas-archive.li | https://annas-archive.pm
- **FlareSolverr:** https://github.com/FlareSolverr/FlareSolverr
- **LibGen:** https://libgen.is
- **Projektverzeichnis:** `/root/.local/.openclaw/workspace/projects/anna/`

---

_Handover erstellt: 2026-06-19_