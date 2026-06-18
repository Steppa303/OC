# 📖 Reader App — reader.steppa.online

EPUB-Reader mit Vorlesefunktion (ElevenLabs TTS), Lesezeichen, Dark Mode und modernem UI.

**Letztes Update:** 2026-06-18

---

## 🚀 Quick Start

**URL:** https://reader.steppa.online
**Port (intern):** 3003
**Reverse Proxy:** Caddy (auto-SSL via Let's Encrypt)
**Process Manager:** PM2 (Name: `reader-app`)

### Status prüfen

```bash
pm2 status                    # App läuft?
pm2 logs reader-app --lines 20  # Letzte Logs
curl https://reader.steppa.online/health  # Healthcheck
```

### Neustart

```bash
pm2 restart reader-app
```

### Logs

```bash
pm2 logs reader-app --lines 50 --nostream
tail -50 /root/.pm2/logs/reader-app-error-*.log
```

---

## 📁 Projektstruktur

```
projects/reader-app/
├── public/               # Frontend (static served by Express)
│   ├── index.html        # HTML-Struktur (Shelf + Reader + TTS Player)
│   ├── app.js            # Komplette Frontend-Logik (Vanilla JS)
│   ├── styles.css        # Modernes Design (Glassmorphism, Dark/Light)
│   ├── lucide.css        # Icon-Font Styles
│   └── lucide.woff2      # Icon-Font Datei
├── server.js             # Express-Backend (API-Routen, Upload, CORS)
├── db.js                 # SQLite-Datenbank (better-sqlite3)
├── epub-parser.js        # EPUB-Parsing (AdmZip + JSDOM)
├── tts-service.js        # ElevenLabs TTS (Streaming API)
├── ecosystem.config.js   # PM2-Konfiguration
├── package.json          # Dependencies
├── tests/
│   ├── reader.spec.js    # Playwright E2E-Tests (16 Tests)
│   └── ...
└── README.md             # Diese Datei
```

### Daten-Pfade

| Was | Pfad |
|-----|------|
| EPUB-Dateien | `/srv/reader/epubs/` |
| SQLite-DB | `/srv/reader/reader.db` |
| Config | `/root/.openclaw/openclaw.json` |
| Caddy-Config | `/etc/caddy/Caddyfile` |

---

## 🧠 Architektur

```
Browser ──HTTPS──> Caddy (443)
                       │
                    reverse_proxy
                       │
                    Express (3003)
                   ╱       │       ╲
              public/   REST API   Static Files
              (HTML,     │
              CSS, JS)   ├─ POST /api/upload       ← EPUB hochladen
                        ├─ GET  /api/books         ← Bücherliste
                        ├─ GET  /api/books/:id     ← Buch-Details
                        ├─ GET  /api/books/:id/content  ← Kapiteltexte
                        ├─ POST /api/books/:id/tts ← TTS starten (Stream)
                        ├─ GET  /api/bookmarks/:id ← Lesezeichen laden
                        ├─ POST /api/bookmarks/:id ← Lesezeichen setzen
                        └─ DELETE /api/books/:id   ← Buch löschen
                              │
                    ┌─────────┴─────────┐
                    │                   │
              epub-parser.js       db.js (SQLite)
              (AdmZip + JSDOM)    (better-sqlite3)
                    │
                    ▼
              tts-service.js
              (ElevenLabs API)
```

---

## 🔌 API-Referenz

### POST `/api/upload`
Upload eines EPUB-Files (multipart/form-data, Feldname: `epub`).

**Response (201):**
```json
{
  "id": "uuid",
  "message": "EPUB uploaded and processed successfully.",
  "book": {
    "id": "uuid",
    "title": "Buchtitel",
    "author": "Autor",
    "coverPath": "data:image/jpeg;base64,...",
    "filePath": "/srv/reader/epubs/uuid-filename.epub",
    "fileSize": 123456,
    "totalChapters": 10
  }
}
```

### GET `/api/books`
Alle Bücher abrufen (sortiert nach Upload-Datum, neueste zuerst).

### GET `/api/books/:id`
Buch-Details inkl. letztem Lesezeichen (`last_chapter`, `last_progress`).

### GET `/api/books/:id/content`
Buchinhalt mit allen Kapiteln:
```json
{
  "id": "uuid",
  "title": "Buchtitel",
  "chapters": [
    { "index": 0, "title": "Kapitel 1", "text": "..." },
    { "index": 1, "title": "Kapitel 2", "text": "..." }
  ]
}
```

### POST `/api/books/:id/tts`
Startet TTS-Streaming für ein Kapitel.

**Body:**
```json
{
  "chapterIndex": 0,
  "voiceId": "EXAVITQu4vr4xnSDxMaL"
}
```
**Response:** Audio/MPEG Stream (chunked).

**Fallback:** Wenn das angeforderte Kapitel keinen Text enthält, wird automatisch das nächste Kapitel mit Text verwendet.

### GET `/api/bookmarks/:id`
Letztes Lesezeichen für ein Buch abrufen.

### POST `/api/bookmarks/:id`
Lesezeichen setzen.

**Body:**
```json
{
  "chapterIndex": 2,
  "progress": 0.5
}
```

### DELETE `/api/books/:id`
Buch + EPUB-Datei löschen.

### GET `/health`
Healthcheck-Endpoint. Gibt `200 OK` zurück.

---

## 🔑 Konfiguration

### ElevenLabs TTS

Der API-Key wird aus `/root/.openclaw/openclaw.json` gelesen:

```json
{
  "messages": {
    "tts": {
      "providers": {
        "elevenlabs": {
          "apiKey": "sk_..."
        }
      }
    }
  }
}
```

**Verfügbare Stimmen (Stand 2026-06-18):**

| ID | Name | Sprache |
|----|------|---------|
| `EXAVITQu4vr4xnSDxMaL` | Sarah (Default) | Englisch |
| `VHYWoxffK1pFlM1dtRb0` | Thomas | Deutsch |
| `CoFoB7a7PXA8RBsMHbua` | Berta Berlin | Deutsch |
| `zE5bg9yEnLXRqxMf3xUj` | Nervbold | Custom |
| `CwhRBWXzGAHq8TQ4Fs17` | Roger | Englisch |
| `IKne3meq5aSn9XLyUdCD` | Charlie | Englisch |

**Model:** `eleven_turbo_v2_5`
**Format:** Streaming MP3 (chunked transfer)

> ⚠️ **Wichtig:** Die alten Stimmen-IDs (`EXAVITQu4vrCxnU2JJ3` Bella, `21m00Tcm4TlvDq2ikWAM` Rachel) existieren nicht mehr bei ElevenLabs. Die oben gelisteten IDs sind aktuell (Stand Juni 2026).

### CORS

Erlaubte Origins:
- `http://localhost:3000`
- `http://localhost:3003`
- `http://reader.steppa.online`
- `https://reader.steppa.online`

### Umgebungsvariablen

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `PORT` | `3003` | Server-Port |
| `ELEVENLABS_API_KEY` | (aus Config) | ElevenLabs API Key |

---

## 🧪 Test-Suite

Playwright E2E-Tests (16 Tests, Stand 2026-06-18):

```bash
cd projects/reader-app
npx playwright test --reporter=list
```

**Getestete Szenarien:**

| # | Test | Typ |
|---|------|-----|
| 1 | Page loads with all UI elements | UI |
| 2 | Theme toggle switches dark/light | UI |
| 3 | Upload EPUB → book card in shelf | UI |
| 4 | Open reader view with chapter content | UI |
| 5 | **Player sticky at bottom — visible without scroll and after scroll** | UI |
| 6 | Player controls exist (play, prev, next, speed, voice) | UI |
| 7 | Chapter navigation (prev/next buttons + keyboard) | UI |
| 8 | TOC panel shows chapters and navigates | UI |
| 9 | Bookmarks save and restore on reopen | UI |
| 10 | Back button returns to shelf | UI |
| 11 | Responsive mobile viewport (375×812) | UI |
| 12 | API: Upload, list and get book content | API |
| 13 | API: TTS returns audio for chapter with text | API |
| 14 | API: TTS returns 404 for nonexistent chapter | API |
| 15 | API: Bookmarks save and retrieve | API |
| 16 | API: Health endpoint | API |

**Playwright Config:** `playwright.config.js`
**Browser:** Chromium (headless)
**Viewport:** 1280×720 (Desktop), 375×812 (Mobile)

---

## 🎨 Frontend-Überblick

### Views

1. **Shelf View** — Bücherregal mit Cover-Grid, Upload-Dropzone
2. **Reader View** — Kapitel-Reader mit TOC, Navigation, Lesezeichen, TTS Player

### Features

| Feature | Details |
|---------|---------|
| **Upload** | Drag & Drop + File-Picker, XHR-Progress-Bar |
| **Bookshelf** | Cover-Grid mit Fortschrittsanzeige (% gelesen) |
| **Reader** | Kapitelansicht, automatische Heading-Detection |
| **TOC** | Side-Panel mit Kapitelliste, aktives Kapitel markiert |
| **Navigation** | Prev/Next Buttons + ArrowLeft/Right Tasten |
| **Bookmarks** | Kapitel + Scroll-Progression, persistiert in SQLite |
| **TTS** | Play/Pause/Stop, Speed 0.5–2×, Voice-Auswahl, Auto-Advance |
| **Theme** | Dark/Light Toggle, persistiert in localStorage |
| **Responsive** | Mobile bis 375px, Player immer sichtbar |
| **Keyboard** | ← → Space Esc |

### CSS-Layout (Wichtig für Bugs)

Das Reader-Layout verwendet Flexbox:

```
#app (min-height: 100vh, flex column)
├── .header (sticky top)
└── #reader-view (.view, flex: 1, overflow: hidden)
    ├── .reader-topbar (sticky top)
    └── .reader-body (flex: 1, overflow: hidden, flex row)
        ├── .toc-panel (optional, 280px)
        └── .reader-main (flex: 1, flex column, overflow: hidden)
            ├── .content-area (flex: 1, overflow-y: auto, min-height: 0)
            └── .player (flex-shrink: 0, IMMER sichtbar)
```

> ⚠️ **Wichtig:** `#reader-view` hat KEIN `height: 100vh` — es nutzt `flex: 1` von `.view`. Ein `height: 100vh` hier würde den Player unter den Viewport schieben (Bug von 2026-06-18, gefixt).

---

## 🐛 Behobene Bugs (2026-06-18)

### 1. Player Bar nicht sichtbar
**Problem:** `#reader-view` hatte `height: 100vh`, startete aber unter dem Header (y≈74px). Player endete 74px unter dem Viewport.
**Fix:** `height: 100vh` entfernt, nutzt `flex: 1` von `.view`. Plus `min-height: 0` auf `.content-area` und `.reader-main`.

### 2. TTS nicht funktioniert
**Problem:** Mehrere Ursachen:
- ElevenLabs-Stimme `EXAVITQu4vrCxnU2JJ3` (Bella) existierte nicht mehr
- Leere Kapitel (z.B. titlepage.xhtml) → 404 ohne Feedback
- Nicht existente Kapitel → HTTP 500 statt 404

**Fixes:**
- Stimmen-IDs aktualisiert (Sarah, Thomas, Berta Berlin, etc.)
- Fallback auf nächstes Kapitel mit Text bei leeren Kapiteln
- Try/catch um `getChapterText` → saubere 404
- Frontend: Besseres Error-Handling, Spinner-Reset bei allen Fehlerpfaden

### 3. Sprach-Mix in Kapitel-Titeln
**Problem:** Fallback-Titel waren englisch ("Chapter 1") obwohl UI deutsch ist.
**Fix:** Noch nicht behoben — steht auf Roadmap (Phase 1).

---

## 🛠 Deployment

### Caddy Config (`/etc/caddy/Caddyfile`)

```
reader.steppa.online {
    reverse_proxy localhost:3003
    encode gzip
}
```

Caddy handled automatisch SSL via Let's Encrypt.

### PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd
```

### Cloudflare DNS

```
A record: reader → 185.217.126.72
```

---

## 📋 Roadmap

Siehe separate Datei: **`ROADMAP.md`**

---

## 📝 Wartung

### Tägliche Checks

```bash
pm2 status reader-app
curl -s https://reader.steppa.online/health
du -sh /srv/reader/epubs/
pm2 logs reader-app --lines 30 --nostream | grep -i "error\|fail\|warn"
```

### DB-Queries

```bash
sqlite3 /srv/reader/reader.db "SELECT id, title, author, total_chapters FROM books;"
sqlite3 /srv/reader/reader.db "SELECT * FROM bookmarks;"
sqlite3 /srv/reader/reader.db "SELECT COUNT(*) FROM tts_history;"
```

### Dependencies

| Package | Zweck |
|---------|-------|
| `express` | HTTP-Server + Routing |
| `better-sqlite3` | SQLite-DB (synchron, performant) |
| `adm-zip` | EPUB (ZIP) entpacken |
| `jsdom` | XML/HTML-Parsing für EPUB |
| `multer` | File-Upload Handling |
| `cors` | CORS-Middleware |
| `morgan` | HTTP-Request-Logging |
| `uuid` | Eindeutige Buch-IDs |
| `dotenv` | .env-Unterstützung |
