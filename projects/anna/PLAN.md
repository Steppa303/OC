# 📚 Anna's Archive → Reader App Integration

**Projekt:** `projects/anna/`
**Stand:** 19.06.2026
**Ziel:** Anna's Archive Suche & Download direkt in die Reader App integrieren. Geladene Bücher landen automatisch in der Reader-Library.

---

## 🧠 Vision

Der Nutzer soll innerhalb der Reader App (reader.steppa.online) nach deutschen Büchern suchen, das gewünschte auswählen, und per Klick direkt downloaden können — ohne jemals die App verlassen zu müssen. Der Download wird ggf. im Hintergrund (Queue) abgearbeitet, und das fertige EPUB landet automatisch in der Bibliothek.

```
Reader App (Browser)
│
├── Bookshelf (aktuell)
│   └── Upload via Drag & Drop
│
├── 🔜 Anna-Suche (NEU)
│   ├── Suchfeld + Filter (Sprache, Format)
│   ├── Suchergebnisse visuell (Cover, Titel, Autor)
│   └── "Download in Bibliothek" Button
│
├── 🔜 Download-Queue (NEU)
│   ├── Status: Warte auf Download / Lade / Fertig
│   └── Fortschrittsanzeige
│
└── Reader (aktuell)
    └── EPUB lesen + TTS
```

---

## 🔧 Architektur

```
Browser ──HTTPS──> Caddy (443)
                       │
                    reverse_proxy
                       │
                    Express (3003)
                   ╱       │       ╲
              public/   REST API    Static Files
              (HTML,    │
              CSS, JS)  ├─ /api/upload              ← EPUB hochladen (alt)
                        ├─ /api/books               ← Bücherliste (alt)
                        ├─ /api/books/:id            ← Buch-Details (alt)
                        │
                        ├─  🔜 /api/anna/search      ← Anna's Archive Suche
                        ├─  🔜 /api/anna/download    ← Download starten
                        ├─  🔜 /api/anna/status      ← Download-Status
                        ├─  🔜 /api/anna/queue       ← Queue-Liste
                        │
                        └─ /api/bookmarks/:id        ← Lesezeichen (alt)
                              │
                    ┌─────────┴──────────┐
                    │                    │
              epub-parser.js       db.js (SQLite) ← 🔜 Neue Tabellen
              (AdmZip + JSDOM)         │
                    │                  ├─ books (alt)
                    │                  ├─ bookmarks (alt)
                    │                  ├─ tts_history (alt)
                    │                  └─ 🔜 anna_queue
                    │                  └─ 🔜 anna_results (Cache)
                    │
                    ▼
              tts-service.js
              (ElevenLabs API)

         ┌─────────────────────────────┐
         │   🔜 Python Sidecar         │
         │   (projects/anna/scraper/)  │
         │                             │
         │  • search.py                │
         │    → scraped annas-archive  │
         │    → parses HTML results    │
         │                             │
         │  • download.py              │
         │    → lädt EPUB von LibGen   │
         │    → speichert in /srv/     │
         │    → benachrichtigt Server  │
         └─────────────────────────────┘
```

---

## 📦 Phase 1 — Backend: Anna's Archive API Routes

### Neue API-Endpunkte in `server.js`

#### `GET /api/anna/search?q=<query>&lang=de&ext=epub&page=1`

Ruft den Python Scraper auf (via `child_process.exec` oder HTTP-Aufruf an Sidecar-Server) und returned die Ergebnisse.

**Response:**
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
  "total": 42,
  "page": 1
}
```

#### `POST /api/anna/download`

Startet einen Download in die Reader-Bibliothek.

**Request:**
```json
{
  "md5": "d1bafc9edc19b4190c125480fec1cfe0",
  "title": "Python für Kids",
  "author": "Gregor Lingl"
}
```

**Response:**
```json
{
  "queueId": 1,
  "status": "queued",
  "message": "Download gestartet"
}
```

**Workflow:**
1. Queue-Eintrag in SQLite (`anna_queue`)
2. Python Downloader via child_process gestartet
3. Downloader lädt EPUB von LibGen/IPFS
4. Bei Fertigstellung: `epub-parser.js` parst die Datei
5. Automatisch `db.insertBook()` → Buch ist in der Bibliothek
6. Queue-Status auf `done`

#### `GET /api/anna/status/:queueId`

Status eines aktiven Downloads abfragen.

#### `GET /api/anna/queue`

Alle Queue-Einträge (aktiv + abgeschlossen).

---

## 🗄️ Phase 2 — Datenbank-Erweiterung

### Neue Tabellen in `db.js`

```sql
-- Download-Queue
CREATE TABLE IF NOT EXISTS anna_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  md5 TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  format TEXT DEFAULT 'epub',
  size_bytes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued',  -- queued | downloading | processing | done | failed
  error_message TEXT,
  book_id TEXT,                   -- Verweis auf books.id wenn fertig
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Suchergebnis-Cache (optional, TTL 1h)
CREATE TABLE IF NOT EXISTS anna_search_cache (
  query_hash TEXT PRIMARY KEY,
  results TEXT NOT NULL,  -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🐍 Phase 3 — Python Scraper Sidecar

`projects/anna/scraper/`

### `search.py` — Suche auf Anna's Archive

```bash
python3 search.py --query "Python für Kids" --lang de --ext epub --page 1
```

**Technik:**
- `requests` + `beautifulsoup4` / `lxml`
- Scraped `https://annas-archive.gl/search?q=<query>&lang=de&ext=epub`
- Extrahiert: Titel, Autor, MD5-Hash, Format, Größe, Cover-URL, Beschreibung
- Optional: FlareSolverr-Proxy für Cloudflare-Bypass
- Output: JSON (stdout)

**HTML-Parsing (XPath aus SearXNG-Engine):**
```python
# Jedes Ergebnis ist ein <div class="flex"> in "js-aarecord-list-outer"
ergebnisse = dom.xpath("//main//div[contains(@class, 'js-aarecord-list-outer')]/div[contains(@class, 'flex')]")

# Titel: <a class="js-vim-focus">
# Link: ./a/@href → /md5/<hash>
# Beschreibung: .//div[@class='relative']/div[contains(@class, 'line-clamp')]
# Tags: .//div[contains(@class, 'font-semibold')] → splitten bei "·"
# Autor: .//a[.//span[contains(@class, 'icon-[mdi--user-edit]')]]
# Cover: .//img/@src
```

### `download.py` — EPUB herunterladen

```bash
python3 download.py --md5 d1bafc9edc19b4190c125480fec1cfe0 --output /srv/reader/epubs/
```

**Workflow:**
1. Scrapt die `/md5/<hash>`-Seite für Download-Links
2. Versucht Quellen in dieser Reihenfolge:
   - LibGen (direct, kein CAPTCHA) 🥇
   - IPFS-Gateway 🌐
   - Mirror-Fallback (via FlareSolverr) 🔄
3. Lädt EPUB in `/srv/reader/epubs/<uuid>-<title>.epub`
4. Gibt Pfad + Metadaten als JSON aus

### `FlareSolverr` Integration

Für Cloudflare/DDoS-Guard-geschützte Seiten (v.a. Mirror-Downloads):
```python
proxies = {
    'http': 'socks5://127.0.0.1:1080',   # WireGuard VPN
    'https': 'socks5://127.0.0.1:1080',
}
# Oder: FlareSolverr HTTP API
```

---

## 🎨 Phase 4 — Frontend: Such-UI in der Reader App

### Neue UI-Elemente in `public/index.html`

#### Such-Button + Panel im Bookshelf

```
┌──────────────────────────────────────────────────────┐
│  🔍 Bücher durchsuchen  [📚 Anna's Archive ▾]       │  ← Suchleiste
├──────────────────────────────────────────────────────┤
│  [Buch-Cover] [Buch-Cover] [Buch-Cover] [Buch-Cover] │  ← Bookshelf
│  ...                                                  │
├──────────────────────────────────────────────────────┤
│  ⏬ Downloads (2)                                     │  ← Queue-Button
└──────────────────────────────────────────────────────┘
```

#### Suchergebnisse (Dropdown / Full-Screen Overlay)

```
┌────────────────────────────────────────────────────────┐
│  ← Zurück                      "Python" gefunden (12)  │
├────────────────────────────────────────────────────────┤
│  ┌──────┐  Python für Kids                  📄 PDF │
│  │ Cover │  Gregor Lingl · 2010 · 21 MB     21MB  │
│  │       │  Kinderleichter Einstieg...              │
│  └──────┘                            [📥 Download]  │
│                                                      │
│  ┌──────┐  Python ohne Vorkenntnisse    📄 EPUB │
│  │ Cover │  Benjamin Spahic · 2020 · 3.3MB   3.3MB │
│  │       │  Lerne Python in 7 Tagen...             │
│  └──────┘                            [📥 Download]  │
│                                                      │
│  ┌──────┐  Effektiv Python programmieren  📄 EPUB │
│  │ Cover │  Brett Slatkin · 2020 · 3.3MB   3.3MB  │
│  │       │  Best Practices und Tipps...            │
│  └──────┘                            [📥 Download]  │
│                                                      │
│  ◀ 1 2 3 4 ▶                                         │
└────────────────────────────────────────────────────────┘
```

#### Download-Queue Panel

```
┌───────────────────────────┐
│ ⏬ Downloads               │
├───────────────────────────┤
│ 📥 Python für Kids       │
│ ████████░░░░ 75%         │
│ Lade von LibGen...        │
├───────────────────────────┤
│ ✅ Clean Code             │
│ 🔄 Wird verarbeitet...   │
├───────────────────────────┤
│ ✅ Design Patterns        │
│ 📖 In Bibliothek          │
└───────────────────────────┘
```

### Neue Funktionen in `public/app.js`

| Funktion | Beschreibung |
|----------|-------------|
| `openAnnaSearch()` | Such-Overlay öffnen |
| `searchAnna(query, filters)` | API-Call zu `/api/anna/search` |
| `renderAnnaResults(results)` | Ergebnisse als Card-Liste rendern |
| `startDownload(md5, title, author)` | Download via `/api/anna/download` starten |
| `loadQueue()` | Queue-Status von `/api/anna/queue` laden |
| `renderQueue(queue)` | Queue-Liste mit Fortschritt rendern |
| `pollQueueStatus(queueId)` | Polling für aktive Downloads |

### Neue Styles in `public/styles.css`

- `.anna-search-panel` — Such-Overlay
- `.anna-result-card` — Ergebnis-Karte
- `.anna-download-btn` — Download-Button mit States
- `.anna-queue-panel` — Queue-Seitenpanel
- `.anna-queue-item` — Queue-Eintrag mit Progress-Bar

---

## ⚙️ Phase 5 — Integration: Download → Bibliothek

Der kritische Pfad: Sobald ein Download fertig ist, muss das EPUB automatisch in die Reader-Bibliothek integriert werden.

### Ablauf

```
1. POST /api/anna/download
   ├── Queue-Eintrag in SQLite (status: queued)
   ├── Python-Prozess starten (child_process.fork/spawn)
   └── Response: { queueId: 1, status: "queued" }

2. Python download.py (asynchron)
   ├── Status → "downloading"
   ├── Lädt EPUB von LibGen/IPFS
   │   └── /srv/reader/epubs/<uuid>-<title>.epub
   ├── Status → "downloaded"
   └── Exit-Code 0

3. Node.js onExit Callback
   ├── Prüft: Datei existiert? Größe > 0?
   ├── EPUB parsen via epubParser.saveEpub()
   ├── db.insertBook() → Buch in Bibliothek
   ├── Queue-Status → "done"
   ├── book_id setzen (Verweis auf books.id)
   └── Optional: WebSocket/SSE-Benachrichtigung an Frontend

4. Frontend Polling
   ├── Alle 2s: GET /api/anna/queue
   ├── Wenn status = done → loadBookshelf() refreshen
   ├── Toast-Nachricht: "📖 Python für Kids wurde hinzugefügt"
   └── Queue-Eintrag zeigt ✅ In Bibliothek
```

### Backend-Implementierung (Node.js)

```javascript
// In server.js
const { spawn } = require('child_process');
const path = require('path');
const SCRAPER_DIR = path.join(__dirname, '../anna/scraper');

// POST /api/anna/download
app.post('/api/anna/download', async (req, res) => {
  const { md5, title, author } = req.body;
  const queueId = db.addAnnaQueue({ md5, title, author });
  
  const fileName = `${uuidv4()}-${sanitize(title)}.epub`;
  const outputPath = path.join(EPUB_STORAGE_DIR, fileName);
  
  const proc = spawn('python3', [
    path.join(SCRAPER_DIR, 'download.py'),
    '--md5', md5,
    '--output', outputPath
  ]);
  
  db.updateAnnaQueue(queueId, { status: 'downloading' });
  
  proc.on('close', async (code) => {
    if (code !== 0) {
      db.updateAnnaQueue(queueId, { status: 'failed', error: 'Download fehlgeschlagen' });
      return;
    }
    
    db.updateAnnaQueue(queueId, { status: 'processing' });
    
    try {
      const epubData = fs.readFileSync(outputPath);
      const parsed = await epubParser.saveEpub(epubData, `${title}.epub`);
      db.insertBook(parsed.id, {
        title: parsed.title,
        author: parsed.author,
        coverPath: parsed.coverDataUrl,
        filePath: parsed.filePath,
        fileSize: parsed.fileSize,
        totalChapters: parsed.totalChapters,
      });
      db.updateAnnaQueue(queueId, { status: 'done', book_id: parsed.id });
    } catch (err) {
      db.updateAnnaQueue(queueId, { status: 'failed', error: err.message });
    }
  });
  
  res.json({ queueId, status: 'queued' });
});
```

---

## 🐳 Phase 6 — Optional: Stacks Docker (Download Manager)

Falls der Python-Downloader zu langsam oder fehleranfällig ist, kann **stacks** als Docker-Container die Downloads managen:

```yaml
services:
  stacks:
    image: zelest/stacks:latest
    container_name: stacks-anna
    ports:
      - "7788:7788"
    volumes:
      - /srv/reader/epubs:/opt/stacks/download  # Direkt in Reader-Storage!
      - /srv/clawshare/books/config:/opt/stacks/config
      - /srv/clawshare/books/logs:/opt/stacks/logs
    environment:
      - TZ=Europe/Berlin
    restart: unless-stopped

  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    environment:
      - LOG_LEVEL=info
    restart: unless-stopped
```

**Integration:** Node.js ruft stacks API auf:
```javascript
// Buch in stacks Queue einreihen
await fetch('http://localhost:7788/api/queue', {
  method: 'POST',
  body: JSON.stringify({ url: downloadUrl, filename: 'buch.epub' })
});
```

**Vorteil:** Retry, Resume, Web UI für manuelle Downloads
**Nachteil:** Zusätzlicher Docker-Container + Komplexität

---

## 📋 Backlog (Task-Liste)

### Phase 1 — Backend API
- [ ] `server.js`: `/api/anna/search` Route (ruft Python-Scraper auf)
- [ ] `server.js`: `/api/anna/download` Route (startet Download-Prozess)
- [ ] `server.js`: `/api/anna/status/:id` Route
- [ ] `server.js`: `/api/anna/queue` Route
- [ ] Timeout-Handling für Python-Prozesse
- [ ] Error-Handling + Logging

### Phase 2 — Datenbank
- [ ] `db.js`: `anna_queue` Tabelle + CRUD-Funktionen
- [ ] `db.js`: `anna_search_cache` Tabelle (optional)
- [ ] Migration: Bestehende DB nicht zerstören

### Phase 3 — Python Scraper
- [ ] `scraper/search.py`: HTML-Scraping der Anna's Archive Suche
  - [ ] XPath-basiert (wie SearXNG)
  - [ ] Extraktion: Titel, Autor, MD5, Format, Größe, Cover
  - [ ] Paginierung (page-Parameter)
  - [ ] Sprachfilter (lang=de)
  - [ ] FlareSolverr-Proxy optional
  - [ ] Random User-Agent + Delays (Rate-Limiting vermeiden)
- [ ] `scraper/download.py`: Download von der MD5-Seite
  - [ ] LibGen-Download (priorität)
  - [ ] IPFS-Fallback
  - [ ] Mirror-Fallback via FlareSolverr
  - [ ] Resume-Support (Range-Requests)
  - [ ] Fortschritt an stdout (für Node.js)
- [ ] `scraper/requirements.txt`: requests, beautifulsoup4, lxml

### Phase 4 — Frontend UI
- [ ] `public/index.html`: Such-Overlay-Panel
- [ ] `public/index.html`: Queue-Status-Panel
- [ ] `public/index.html`: Download-Button in Suchergebnissen
- [ ] `public/styles.css`: Anna-Styles (Glassmorphism, passend zum Reader-Design)
- [ ] `public/app.js`: Suchfunktion
  - [ ] `openAnnaSearch()` / `closeAnnaSearch()`
  - [ ] `searchAnna(query)` mit Debounce
  - [ ] `renderAnnaResults(results)` mit Cover + Download-Button
- [ ] `public/app.js`: Download-Funktion
  - [ ] `startDownload(md5, title, author)`
  - [ ] `loadQueue()` / `renderQueue()`
  - [ ] `pollQueueStatus()` (alle 2s bei aktiven Downloads)
  - [ ] Toast-Benachrichtigung bei Fertigstellung
- [ ] Keyboard-Navigation in Suchergebnissen (Pfeiltasten)
- [ ] Loading States + Error States

### Phase 5 — Integrationstests
- [ ] Python Scraper: 3 Suchanfragen testen (Deutsch, verschiedene Queries)
- [ ] Python Scraper: 2 Downloads testen (LibGen + Fallback)
- [ ] API: `/api/anna/search` → korrekte Response
- [ ] API: `/api/anna/download` → Buch in DB und /srv/reader/epubs/
- [ ] Frontend: Suche + Download + Buch erscheint in Bibliothek
- [ ] Edge Cases: Keine Ergebnisse, Download fehlgeschlagen, Format nicht EPUB
- [ ] Playwright E2E-Tests für neue UI-Komponenten

### Phase 6 — Queue + Cron (optional)
- [ ] Cron-Job: Tägliche Suche nach neuen deutschen Büchern
- [ ] Batch-Download: Multiple Bücher auf einmal in Queue
- [ ] Auto-Download: Bestimmte Autoren/Themen automatisch laden
- [ ] Stacks Docker-Integration (falls nötig)

---

## 🛠️ Technische Details

### Python-Scraper `search.py` (Minimal-Skizze)

```python
#!/usr/bin/env python3
"""Search Anna's Archive and return results as JSON."""
import argparse, json, sys, time, random
import requests
from lxml import html

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
]
BASE_URLS = [
    'https://annas-archive.gl',
    'https://annas-archive.li',
    'https://annas-archive.pm',
]

def search(query, lang='de', ext='', page=1):
    url = f"{BASE_URLS[0]}/search"
    params = {'q': query, 'lang': lang, 'page': page}
    if ext: params['ext'] = ext
    
    headers = {'User-Agent': random.choice(USER_AGENTS)}
    
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        # Fallback auf andere Mirror
        ...
    
    dom = html.fromstring(resp.text)
    results = []
    
    for item in dom.xpath("//main//div[contains(@class, 'js-aarecord-list-outer')]/div[contains(@class, 'flex')]"):
        href = item.xpath("./a/@href")
        title_el = item.xpath(".//a[contains(@class, 'js-vim-focus')]")
        ...
        results.append({
            'md5': href[0].split('/')[-1] if href else '',
            'title': title_el[0].text_content().strip() if title_el else '',
            ...
        })
    
    return results

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--query', required=True)
    parser.add_argument('--lang', default='de')
    parser.add_argument('--ext', default='')
    parser.add_argument('--page', type=int, default=1)
    args = parser.parse_args()
    
    results = search(args.query, args.lang, args.ext, args.page)
    print(json.dumps({'results': results, 'page': args.page}))
```

### Python-Downloader `download.py` (Minimal-Skizze)

```python
#!/usr/bin/env python3
"""Download a book from Anna's Archive by MD5 hash."""
import argparse, json, sys, os, re
import requests
from lxml import html

def get_download_links(md5):
    """Scrape the /md5/<hash> page for download links."""
    url = f"https://annas-archive.gl/md5/{md5}"
    resp = requests.get(url, headers={'User-Agent': '...'}, timeout=30)
    dom = html.fromstring(resp.text)
    
    links = []
    # Suche nach Download-URLs (verschiedene Quellen)
    for a in dom.xpath("//a[contains(@href, 'libgen')]"):
        links.append({'source': 'libgen', 'url': a.get('href')})
    for a in dom.xpath("//a[contains(@href, 'ipfs')]"):
        links.append({'source': 'ipfs', 'url': a.get('href')})
    ...
    return links

def download(url, output_path):
    """Download file from URL to output_path."""
    resp = requests.get(url, stream=True, timeout=300)
    total = int(resp.headers.get('content-length', 0))
    downloaded = 0
    
    with open(output_path, 'wb') as f:
        for chunk in resp.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                # Progress an stdout (wird von Node.js gelesen)
                print(json.dumps({'type': 'progress', 'downloaded': downloaded, 'total': total}))
                sys.stdout.flush()
    
    return output_path

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--md5', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    
    links = get_download_links(args.md5)
    # Versuche LibGen zuerst
    download(links[0]['url'], args.output)
    print(json.dumps({'type': 'done', 'path': args.output}))
```

---

## 📂 Projektstruktur (final)

```
projects/
├── reader-app/                     ← BESTEHEND
│   ├── server.js                   ← 🔜 Neue API-Routen
│   ├── db.js                       ← 🔜 Neue Tabellen
│   ├── epub-parser.js              ← 🔜 Bereits genutzt
│   ├── public/
│   │   ├── index.html              ← 🔜 Such-UI
│   │   ├── app.js                  ← 🔜 Such- + Download-Logik
│   │   └── styles.css              ← 🔜 Anna-Styles
│   └── ...
│
└── anna/                           ← NEU
    ├── PLAN.md                     ← Diese Datei
    ├── scraper/
    │   ├── search.py               ← Anna's Archive Suche
    │   ├── download.py             ← EPUB Download
    │   └── requirements.txt        ← Python-Dependencies
    └── README.md                   ← Quickstart
```

---

## ⚠️ Risiken & Mitigation

| Risiko | Mitigation |
|--------|------------|
| **Anna's Archive blockt Scraper** | User-Agent rotieren, delays, Mirror-Fallback |
| **Cloudflare/DDoS-Guard 403** | FlareSolverr oder WireGuard SOCKS Proxy |
| **LibGen Down** | Fallback auf IPFS/Mirror-Quellen |
| **Kein EPUB verfügbar (nur PDF)** | PDF akzeptieren oder Fehler melden |
| **Download bricht ab** | Resume-Support in download.py |
| **Reader App stürzt ab** | Queue in SQLite persistiert, Wiederaufnahme |
| **Duplicate Downloads** | MD5-Check vor Download |
| **Festplatte voll** | Monitoring + Queue pausieren |

---

## 📊 Priorisierung

| Phase | Aufwand | Impact | Prio |
|-------|---------|--------|------|
| Phase 1 — Backend API | ~2h | 🔴 Grundlage für alles | 1 |
| Phase 2 — Datenbank | ~1h | 🔴 Grundlage | 2 |
| Phase 3 — Python Scraper | ~4h | 🔴 Kernfunktion | 3 |
| Phase 4 — Frontend UI | ~4h | 🟡 Sichtbarkeit | 4 |
| Phase 5 — Integration | ~2h | 🟡 Qualität | 5 |
| Phase 6 — Queue/Cron | ~3h | 🟢 Nice-to-have | 6 |

**Geschätzte Gesamtzeit:** ~16h

---

## 🎯 Erster Schritt (nächste Session)

1. **`search.py`** schreiben — Basis-Scraper für Anna's Archive
2. **Testen**: `python3 search.py --query "Python" --lang de` → funktionierende JSON-Ergebnisse
3. **`/api/anna/search`** Route in server.js
4. **Frontend**: Minimales Such-UI im Bookshelf

Soll ich mit dem Python-Scraper anfangen?