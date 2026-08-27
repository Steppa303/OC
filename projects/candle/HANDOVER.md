# 🕯️ Candle — HANDOVER

**URL:** `https://candle.steppa.online`
**Port:** 3011
**PM2:** `candle`
**Status:** ✅ Live & Getestet auf Kindle Scribe

---

## Was ist das?

Eine für den Kindle Scribe optimierte Web-App mit einem Full-Screen Zeichen-Canvas. Der User malt mit dem Kindle-Stift, nach jedem Stift-Aufhebung wird ein Screenshot an eine Vision-KI (Google Gemini) geschickt, die das Gezeichnete analysiert und mit Text + eigenen Zeichnungen auf dem Canvas antwortet.

## Stack

- **Frontend:** React 18 + Vite + TailwindCSS + Canvas 2D API
- **Backend:** Express + Socket.io + better-sqlite3 (WAL)
- **KI:** Google Gemini 2.5 Flash (Vision API)
- **Deploy:** PM2 + Caddy + Cloudflare (proxied=true)

## Architektur

```
Kindle Scribe (Browser)
  → Pen-Up Event → debounce (konfigurierbar)
  → Content-Detection (Bounding Box)
  → Grid-Overlay auf Canvas (temporär)
  → Canvas als PNG + Canvas-Dimensionen + Content-Info
  → WebSocket (Socket.io) → Backend (Port 3011)
  → Gemini Vision API (Canvas-PNG → Analyse, relative Positionierung)
  → Antwort: Text + Drawing-Commands (mit position/anchor)
  → WebSocket zurück → Position-Resolver → Canvas rendert Antwort
```

## Dateien

```
projects/candle/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.tsx         # Haupt-Canvas (Pointer + Touch Events)
│   │   │   ├── TextOverlay.tsx    # KI-Text-Antworten
│   │   │   ├── Toolbar.tsx        # Untere Toolbar: Session, Löschen, Neu, Glatt-Toggle
│   │   │   ├── SessionList.tsx    # Session-Auswahl
│   │   │   ├── DebounceSlider.tsx # Debounce-Konfiguration
│   │   │   ├── ErrorBoundary.tsx  # Fehleranzeige
│   │   │   ├── FloatingToolbox.tsx # Floating Toolbox Orchestrator
│   │   │   ├── FAB.tsx            # Floating Action Button (draggable)
│   │   │   ├── VerticalToolbar.tsx # Vertikale Toolbar (neben FAB)
│   │   │   ├── SubMenu.tsx        # Horizontales Submenu
│   │   │   ├── BrushSizePicker.tsx # Stift-Dicke (5 Wellenlinien)
│   │   │   ├── SmoothingSlider.tsx # Glättung-Slider (0.0-1.0)
│   │   │   └── ColorPicker.tsx    # Farbwähler
│   │   ├── hooks/
│   │   │   ├── useCanvas.ts       # Drawing-Logic, Pen-Events, PNG-Export
│   │   │   ├── useSocket.ts       # WebSocket-Client
│   │   │   ├── useSession.ts      # Session-Management
│   │   │   └── useDrag.ts         # Drag + Tap Detection (FAB)
│   │   ├── utils/
│   │   │   ├── drawingRenderer.ts # KI-Drawing-Commands Renderer (relativ + absolut)
│   │   │   └── contentDetector.ts # Canvas-Content-Detection (Bounding Box)
│   │   ├── App.tsx
│   │   ├── App.css                # E-ink optimiertes CSS
│   │   └── main.tsx               # Entry Point mit Error-Boundary
│   ├── vite.config.ts             # Build-Target: es2015
│   ├── tailwind.config.js
│   └── package.json
├── server/
│   ├── index.js                   # Express + Socket.io (Port 3011)
│   ├── db.js                      # SQLite (better-sqlite3, WAL)
│   ├── ai.js                      # Gemini Vision API Integration
│   ├── socket.js                  # WebSocket Event-Handler
│   └── routes.js                  # REST Endpoints (Sessions CRUD)
├── deploy.sh                      # Build + Deploy Script
├── ecosystem.config.js            # PM2 Config
├── PLAN.md                        # Detaillierter Plan
└── HANDOVER.md                    # Diese Datei
```

## API

### WebSocket Events (Socket.io)

**Client → Server:**
- `stroke:complete` — `{ sessionId, canvasPng, canvasWidth, canvasHeight }` — Pen-Up nach debounce
- `session:new` — `{ name? }` — Neue Session erstellen
- `session:switch` — `{ sessionId }` — Session wechseln
- `session:delete` — `{ sessionId }` — Session löschen

**Server → Client:**
- `ai:thinking` — KI analysiert gerade
- `ai:response` — `{ text, drawing, interactionId }` — KI-Antwort
- `ai:error` — `{ message }` — Fehler
- `session:created` — `{ session }` — Neue Session erstellt
- `session:history` — `{ interactions }` — Session-Verlauf

### REST Endpoints

- `GET /api/sessions` — Alle Sessions
- `GET /api/sessions/:id` — Session + Interactions
- `POST /api/sessions` — Neue Session
- `DELETE /api/sessions/:id` — Session löschen
- `PATCH /api/sessions/:id` — Session umbenennen

## Konfigurierbare Parameter (Client-Seite)

| Parameter | Default | Range | Beschreibung |
|-----------|---------|-------|--------------|
| Debounce | 500ms | 200-3000ms | Verzögerung nach Pen-Up |
| Stift-Farbe | #000000 | Farbwähler | Farbe des User-Stifts |
| Stift-Dicke | 2px | 1-5px | Dicke des User-Stifts |
| Glättung | 0.4 | 0.0-1.0 | Catmull-Rom Tension (0.0 = keine, 1.0 = max) |
| Glättung AN/AUS | AN | Toggle | Smoothing ein/aus |
| Text-Overlay Dauer | 8s | 3-15s | Wie lange KI-Text angezeigt wird |

Alle Werte werden im `localStorage` gespeichert.

## KI-Integration

- **Modell:** Google Gemini 2.5 Flash
- **API Key:** `/root/.openclaw/workspace/.secrets/google-gemini.env`
- **Prompt:** Analysiert Canvas-Bild, antwortet mit JSON (Text + Drawing-Commands)
- **Drawing-Commands:** line, circle, path, text — relativ oder absolut positioniert
- **Relative Positionierung:** `position` (where) + `anchor` (reference point) + relative coords
- **Canvas-Dimensionen:** Werden im Prompt mitgegeben (CSS-Pixel) (relativ oder absolut)

### Relative Positionierung (27.08.2026)

**Branch:** `fix/versatz-koordinaten`
**Status:** ✅ Deployed

**Problem:** Gemini schätzt absolute Koordinaten aus dem PNG → Versatz.

**Lösung:** Gemini gibt relative Positionsbeschreibungen zurück. Client mappt auf echte Koordinaten.

**Neues Response-Format:**
```json
{
  "text": "Ich sehe einen Kopf. Ich zeichne den Körper!",
  "drawing": [
    { "type": "line", "x1": 0, "y1": 0, "x2": 0, "y2": 100, "position": "below", "anchor": "center" }
  ]
}
```

**Position-Werte:** `above`, `below`, `left_of`, `right_of`, `center`, `top_right`, `top_left`, `bottom_right`, `bottom_left`
**Anchor-Werte:** `center` (default), `top`, `bottom`, `left`, `right`
**Koordinaten:** Relativ zum Ankerpunkt (0,0 = Ankerpunkt)

**Content-Detection:**
- `contentDetector.ts` scannt Canvas-Pixel (jeder 4te für Performance)
- Findet Bounding Box des bestehenden Contents
- Gibt `{ x, y, width, height }` zurück
- Leerer Canvas → gesamter Canvas als Bounds

**Position-Resolver:**
- `drawingRenderer.ts` → `resolvePosition()` mappt Position + Anchor auf Offset
- 20px Gap zwischen bestehendem Content und neuer Zeichnung
- Backwards-kompatibel: Commands ohne `position` werden absolut gerendert

**Dateien:**
- `server/ai.js` — Prompt: relative Positionierung + Canvas-Dimensionen
- `client/src/utils/contentDetector.ts` — Content-Bounding-Box Detection
- `client/src/utils/drawingRenderer.ts` — `resolvePosition()`, `applyOffset()`
- `client/src/hooks/useCanvas.ts` — `renderAIDrawing` übergibt `bgCanvas`
- `client/src/hooks/useSocket.ts` — Sendet `canvasWidth`, `canvasHeight`

### Geplant: Grid-Overlay + Scale-Reference + Proportions (position.md)

**Status:** 📝 Plan ausgearbeitet, noch nicht implementiert
**Plan:** `projects/candle/position.md`

Drei Maßnahmen:
1. **Grid-Overlay** — Subtile Referenzpunkte (alle 100px) vor PNG-Export auf Canvas
2. **Scale-Reference** — Content-Größen als Referenz im Prompt
3. **Proportions-Prompt** — Kopf:Körper:Beine = 1:2:2, min 30%/max 200% der Content-Größe

## Deploy

```bash
# Frontend neu bauen & deployen
./deploy.sh

# Server neu starten
pm2 restart candle

# Logs
pm2 logs candle
```

## E-ink Optimierungen

- Keine Animationen/Transitions (CSS `!important`)
- Hoher Kontrast (Schwarz/Weiß/Grau)
- Große Touch-Targets (48px+)
- `touchAction: 'none'` für Pen-Input
- Pointer Events + Touch Events Fallback
- Build-Target: `es2015` (älterer Chromium)
- Loading-Indicator vor React-Init
- Error-Boundary für Fehleranzeige

### Drawing-Performance (27.08.2026)

Optimierungen für minimalen Lag auf dem Kindle Scribe:

1. **rAF-Batching** — `pointermove`-Events sammeln Punkte nur in einem Array. `requestAnimationFrame` zeichnet einmal pro Frame alle gesammelten Punkte.
2. **Single-Path-Drawing** — Pro Frame: 1x `beginPath()`, alle `lineTo()` in einer Schleife, 1x `stroke()`.
3. **Fixed lineWidth** — wird nur bei `pointerdown` gesetzt, nicht bei jedem Punkt.
4. **1:1 Pixel-Mapping auf Kindle** — Erkennt Kindle-User-Agent, setzt DPR auf 1.

### Zwei-Canvas-System mit Post-Processing Smoothing (27.08.2026)

**Architektur:**
- **Background-Canvas** — alle abgeschlossenen Striche (geglättet oder raw)
- **Foreground-Canvas** — aktiver Strich (raw, in Echtzeit, kein Smoothing)

**Workflow:**
1. User zeichnet → raw auf Foreground (kein Lag, lineTo, sofort sichtbar)
2. Pen-Up → Catmull-Rom Smoothing über den GESAMTEN Strich → auf Background gerendert
3. Foreground wird geleert (kein Ghosting)
4. Toggle-Button `◉ Glatt` / `○ Raw` in der unteren Toolbar

**Smoothing-Algorithmus:** Catmull-Rom mit Hermite-Basis und Tangent-Clamping
- `TENSION` = dynamisch (0.0–1.0, per Slider in Floating Toolbox)
- Default: `0.4`
- `CLAMP_FACTOR = 4.0` (max Tangent-Länge = 4× Segmentlänge)
- Verhindert Overshoot bei scharfen Ecken (z.B. Diamant-Formen)
- `STEPS = 8` (Zwischenpunkte pro Segment)

**Dateien:**
- `client/src/hooks/useCanvas.ts` — Zwei-Canvas-Logik, Catmull-Rom Smoothing
- `client/src/components/Canvas.tsx` — Rendert zwei übereinanderliegende Canvas-Elemente
- `client/src/components/Toolbar.tsx` — Smoothing Toggle Button (unten)
- `client/src/App.tsx` — `smoothingEnabled` + `smoothingValue` State

### Floating Toolbox (27.08.2026)

**Branch:** `feature/floating-toolbox`
**Commit:** `feat: add floating toolbox with brush size, smoothing slider, color picker`
**Status:** ✅ Deployed

**Konzept:** Frei verschiebarer Floating Action Button (FAB) im reMarkable-Style. Öffnet bei Tap eine vertikale Toolbar mit Werkzeugen und Settings. Bestehende untere Toolbar bleibt unverändert.

**Komponenten:**
- `FAB.tsx` — Schwarzer Kreis 48px, weißes Stift-Icon, draggable (Pointer-Events)
- `VerticalToolbar.tsx` — 56px breit, abgerundete Ecken, Collapse-Button, aktive Items invertiert
- `SubMenu.tsx` — Horizontaler Container, schließt bei Tap außerhalb
- `BrushSizePicker.tsx` — 5 quadratische Buttons mit Wellenlinien (1-5px)
- `SmoothingSlider.tsx` — Horizontaler Slider 0.0-1.0, Step 0.05
- `ColorPicker.tsx` — 3 Farbkreise (#000, #333, #666)
- `FloatingToolbox.tsx` — Orchestrator: isOpen, activeSubmenu, FAB-Position
- `useDrag.ts` — Pointer-Events Drag + Tap Detection (< 5px = Tap)

**Drag vs. Tap:**
- < 5px Bewegung = Tap → Toolbar öffnen/schließen
- ≥ 5px = Drag → Button verschieben
- Position wird in `localStorage` gespeichert

**E-ink Regeln:** Keine Animationen, hoher Kontrast, 48px+ Touch-Targets, `touch-action: none`

**Plan:** `projects/candle/toolbox.md`

## Bekannte Probleme / TODO

- [ ] Undo/Redo
- [ ] Export als PNG/PDF
- [ ] Multi-User Support
- [ ] Canvas-Größe an Scribe-Auflösung anpassen (300 DPI)
- [ ] Smoothing-Parameter feintunen (CLAMP_FACTOR, STEPS)
- [ ] Weitere Floating Toolbox Tools (Radierer? Formen? Lasso?)
- [ ] Grid-Overlay + Scale-Reference + Proportions implementieren (position.md)
- [ ] Branch `feature/floating-toolbox` auf `main` mergen
- [ ] Branch `fix/versatz-koordinaten` mergen

---

_Stand: 2026-08-27 18:30. Relative Positionierung deployed. Grid/Scale/Proportions als Nächstes._
