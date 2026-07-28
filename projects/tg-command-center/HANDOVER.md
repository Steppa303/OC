# 🎨 Infinite Canvas — HANDOVER

**Projekt:** tg-command-center (Infinite Canvas)
**URL:** `canvas.steppa.online`
**Status:** ✅ Live (seit 27.07.2026)
**Letztes Update:** 28.07.2026 ~10:50 — Bug Fixes: Drag-Threshold, EditModal Restyle, Image Upload Debug

---

## 1. Übersicht

Infinite Canvas als Web-App — ein unendlich scrollbares Canvas auf dem man Text-Cards, Bilder und Notizen frei positionieren kann. Gedacht als visuelles Command-Center / Moodboard / Braindump.

**Fähigkeiten:**
- Unendliches Pan & Zoom (Mausrad, Pinch-to-Zoom auf Touch)
- Text-Cards mit Titel, Content, Farben
- Bild-Upload (Drag & Drop oder Toolbar)
- Cards: Drag, Resize, Pin, Duplicate, Color-Change
- Multi-Select (Shift+Click oder Rubberband)
- Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
- Snap-to-Grid (optional)
- Context Menu (Rechtsklick)
- Export als JSON
- Telegram WebApp Integration (Haptic Feedback, Theme)

---

## 2. Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Frontend | React | 18.3 |
| State | Zustand | 4.5 |
| Animation | Framer Motion | 12.42 |
| Styling | TailwindCSS | 3.4 |
| Build | Vite | 5.4 |
| Backend | Express | (ESM) |
| DB | better-sqlite3 | (WAL mode) |
| Upload | Multer | (10MB limit) |
| Reverse Proxy | Caddy | (canvas.steppa.online) |
| Process Manager | PM2 | (`tg-command-center`) |

---

## 3. Architektur

```
┌─────────────────────────────────────────────────┐
│  Browser (canvas.steppa.online)                  │
│  ┌──────────────────────────────────────────┐   │
│  │  React App (Vite build → dist/)          │   │
│  │  ├── App.jsx (Root, init, routing)       │   │
│  │  ├── store.js (Zustand — ALL state)      │   │
│  │  ├── api.js (fetch wrapper)              │   │
│  │  └── components/                         │   │
│  │      ├── InfiniteCanvas.jsx (Pan/Zoom/Drag)│ │
│  │      ├── Card.jsx (Single card render)   │   │
│  │      ├── Toolbar.jsx (Top bar)           │   │
│  │      ├── ContextMenu.jsx (Right-click)   │   │
│  │      └── EditModal.jsx (Card editor)     │   │
│  └──────────────────────────────────────────┘   │
│                      ↕ HTTP (fetch)              │
│  ┌──────────────────────────────────────────┐   │
│  │  Express Server (Port 3721)              │   │
│  │  ├── GET/POST/PUT/DELETE /api/items      │   │
│  │  ├── POST /api/upload (Multer)           │   │
│  │  ├── Static: client/dist/                │   │
│  │  └── Static: uploads/                    │   │
│  └──────────────────────────────────────────┘   │
│                      ↕                           │
│  ┌──────────────────────────────────────────┐   │
│  │  SQLite (data/canvas.db, WAL mode)       │   │
│  │  └── Table: items (id, type, x, y, w, h, │   │
│  │      title, content, color, image_url,   │   │
│  │      caption, pinned, sort_order)        │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 4. Dateistruktur

```
projects/tg-command-center/
├── package.json              # Root scripts (build, start, dev)
├── HANDOVER.md               # ← Diese Datei
├── data/
│   └── canvas.db             # SQLite DB (WAL mode)
├── uploads/                  # Hochgeladene Bilder (UUID filenames)
├── server/
│   ├── index.js              # Express Server (146 Zeilen)
│   ├── package.json          # Server deps (express, better-sqlite3, multer, cors, uuid)
│   └── node_modules/
└── client/
    ├── package.json          # Client deps (react, zustand, framer-motion, tailwindcss, vite)
    ├── vite.config.js        # Vite config (proxy → localhost:3721)
    ├── index.html
    ├── dist/                 # Build-Output (von Caddy served)
    ├── node_modules/
    └── src/
        ├── main.jsx          # Entry point
        ├── App.jsx           # Root component (44 Zilen)
        ├── api.js            # Fetch-Wrapper (23 Zeilen)
        ├── store.js          # Zustand Store (314 Zeilen) — HIER LIEGT DIE LOGIK
        ├── index.css         # Tailwind directives + Custom CSS
        └── components/
            ├── InfiniteCanvas.jsx  # Pan/Zoom/Drag/Select (478 Zeilen) — KERNKOMPONENTE
            ├── Card.jsx            # Single card render (227 Zeilen)
            ├── Toolbar.jsx         # Top toolbar (266 Zeilen)
            ├── ContextMenu.jsx     # Right-click menu (139 Zeilen)
            └── EditModal.jsx       # Card edit dialog (122 Zeilen)
```

**Gesamt:** ~1.770 Zeilen Code (Client + Server)

---

## 5. Deployment

### PM2
```bash
pm2 list                    # Status check
pm2 restart tg-command-center  # Restart
pm2 logs tg-command-center     # Logs
```

**PM2 Name:** `tg-command-center`
**Port:** `3721`
**Start:** `cd server && node index.js`

### Caddy
```caddy
canvas.steppa.online:80 {
    encode gzip
    reverse_proxy localhost:3721
}
```

### Build
```bash
cd projects/tg-command-center/client
npm run build               # → dist/
pm2 restart tg-command-center
```

### Dev-Modus
```bash
cd projects/tg-command-center
npm run dev                 # Concurrent: Server (--watch) + Vite Dev Server
```

---

## 6. API Endpoints

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/api/items` | Alle Items (sortiert: pinned → sort_order → updated_at) |
| `POST` | `/api/items` | Neues Item erstellen |
| `PUT` | `/api/items/:id` | Item updaten |
| `DELETE` | `/api/items/:id` | Item löschen |
| `POST` | `/api/upload` | Bild hochladen (multipart, max 10MB) |

### Item Schema
```json
{
  "id": "uuid",
  "type": "text | image",
  "x": 200, "y": 200,
  "width": 280, "height": 180,
  "title": "",
  "content": "",
  "color": "default | blue | green | yellow | red | purple | orange",
  "image_url": null,
  "caption": "",
  "pinned": 0,
  "sort_order": 0,
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

---

## 7. State Management (Zustand)

Alles in `store.js`. Wichtige State-Slices:

**Canvas:**
- `items[]` — Alle Canvas-Items
- `offset: {x, y}` — Pan-Position
- `scale` — Zoom-Level (0.15 – 4.0)
- `selectedIds: Set` — Multi-Select

**UI:**
- `contextMenu` — Position + Item-ID für Rechtsklick-Menü
- `editingId` — Welches Item gerade editiert wird
- `tool` — 'select' | 'text' | 'image'
- `snapToGrid` — Grid-Snap (24px)

**History:**
- `history[]` — JSON-Snapshots (max 50)
- `historyIndex` — Aktuelle Position

**Wichtige Actions:**
- `addItem()`, `updateItem()`, `removeItem()` — CRUD
- `uploadFile()` — Bild-Upload
- `togglePin()`, `changeColor()` — Item-Properties
- `undo()`, `redo()` — History-Navigation
- `fitToContent()` — Auto-Zoom auf alle Items
- `exportJSON()` — Download als JSON
- `haptic()` — Telegram Haptic Feedback

---

## 8. Kern-Features & Technische Details

### Drag & Drop (Flicker-Fix)
Das Drag-Update (27.07.2026) löst das Flicker-Problem:
- **Während Drags:** Kein Store-Update → direkte DOM-Manipulation via `dragCardEl.current.style.transform`
- **Erst bei pointerUp:** Finale Position in Store pushen
- `will-change: transform` auf gedraggten Cards
- `pointer-events: none` während Drag (`.card-dragging` CSS-Klasse)

### Pan & Zoom
- **Pan:** Maus-Drag auf leerer Canvas (oder Space+Drag)
- **Zoom:** Mausrad (0.15x – 4.0x), Pinch-to-Zoom auf Touch
- **Fit-to-Content:** Auto-Zoom auf alle Items

### Multi-Select
- Shift+Click auf Items
- Rubberband-Select (Drag auf leerer Canvas mit Shift)
- Select All (Ctrl+A)
- Delete Selected (Entf)

### Telegram WebApp
- `window.Telegram.WebApp` wird bei Init gesetzt
- Haptic Feedback bei CRUD-Actions
- Header/Background Color auf Dark gesetzt

---

## 9. Bekannte Issues & Tech Debt

- **PM2 CPU:** Zeigt manchmal 100% — kein Performance-Problem, nur Monitoring-Artefakt
- **Kein Auth:** Jeder mit der URL kann alles sehen/ändern
- **Kein WebSocket:** Kein Realtime-Multi-User — alles über HTTP Poll
- **SQLite Single-Writer:** Skaliert nicht für viele gleichzeitige User
- **Uploads nicht persistent:** Bei Server-Neustart bleiben Dateien, aber kein Backup
- **Kein Image-Resize:** Große Bilder werden 1:1 gespeichert (10MB limit)
- **Undo/Redo:** Synced mit Server, aber Race-Conditions bei schnellem Undo+Edit

---

## 10. Nächste Schritte (Potentiell)

- [ ] **Auth** — Login oder Token-basiert
- [ ] **WebSocket** — Realtime-Sync für Multi-User
- [ ] **Text-Formatting** — Rich Text (Markdown oder TipTap)
- [ ] **Connection Lines** — Linien zwischen Cards (wie Miro)
- [ ] **Gruppen/Boards** — Mehrere Canvas-Boards
- [ ] **Suche** — Items durchsuchen
- [ ] **Tags/Labels** — Kategorisierung
- [ ] **Image-Crop** — Bilder zuschneiden
- [ ] **Mobile PWA** — Installierbar als App
- [ ] **Dark/Light Mode Toggle** — Aktuell nur Dark

---

## 11. Quick Reference

```bash
# Project Root
cd /root/.local/.openclaw/workspace/projects/tg-command-center

# Dev starten
npm run dev

# Build
cd client && npm run build && cd .. && pm2 restart tg-command-center

# Logs
pm2 logs tg-command-center --lines 50

# DB direkt anschauen
sqlite3 data/canvas.db "SELECT id, type, title, x, y FROM items;"

# Uploads
ls -la uploads/
```

---

## 12. Commit-History (relevant)

| Datum | Commit | Beschreibung |
|-------|--------|-------------|
| 27.07.2026 | (uncommitted) | Initial Canvas: React + Zustand + Express + SQLite |
| 27.07.2026 | (uncommitted) | Drag-Flicker Fix, Framer Motion, UI/UX Polish |
| 28.07.2026 | (uncommitted) | Bug Fixes: Drag-Threshold, Position-Reset Fix, EditModal Restyle |

---

## 13. Letzte Änderungen (28.07.2026)

### Bug Fix: Position-Reset bei Klick
- **Problem:** Klick auf eine verschobene Card hat Position auf Initialwert zurückgesetzt
- **Ursache:** Kein Drag-Threshold — 1px Mausbewegung während Klick hat Positionsänderung getriggert
- **Fix:** `DRAG_THRESHOLD = 5`px in `InfiniteCanvas.jsx`. Drag startet erst ab 5px Bewegung.
- **Bonus:** DOM-Transform Cleanup via `requestAnimationFrame()` statt sofort — verhindert Flash zwischen alten/neuen Position
- Framer-Motion `y: 0` Animation in `Card.jsx` entfernt (konnte mit Parent-Transform kollidieren)

### Bug Fix: EditModal Restyle
- **Problem:** Modal sah "nach Kot aus" (Bastians Worte)
- **Fix:** Komplett neues Design in `EditModal.jsx`:
  - Glassmorphism-Hintergrund mit Glow-Border (`rgba(42, 171, 238, 0.15)`)
  - Icon-basierter Header mit Status-Anzeige ("Nicht gespeichert" / "Ctrl+Enter")
  - Input-Felder mit Material-Symbols-Icons links + animierte Focus-States (Border-Glow, Ring)
  - "Verwerfen" Button (Reset auf Originalwerte) + "Speichern" mit Gradient
  - Bessere Typografie, Abstände, Markdown-Hint
  - Smooth Spring-Animationen beim Öffnen/Schließen

### Bug: Bilder-Upload (nicht reproduzierbar)
- Server-seitig funktioniert alles: `POST /api/upload` erstellt Item korrekt, Bild wird via `/uploads/` served
- Frontend-Flow (Toolbar → fileInput → uploadFile → api.uploadFile) sieht korrekt aus
- Drag-and-Drop (`handleDrop`) ist implementiert
- **Status:** Server-seitig getestet und OK. Wenn User-Report persistiert → Frontend-Debug (Console-Errors checken)

---

_Aktualisiert: 28.07.2026 ~10:50._
