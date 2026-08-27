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
  → Pen-Up Event → debounce (konfigurierbar) → Canvas als PNG
  → WebSocket (Socket.io) → Backend (Port 3011)
  → Gemini Vision API (Canvas-PNG → Analyse)
  → Antwort: Text + Drawing-Commands
  → WebSocket zurück → Canvas rendert Antwort
```

## Dateien

```
projects/candle/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.tsx         # Haupt-Canvas (Pointer + Touch Events)
│   │   │   ├── TextOverlay.tsx    # KI-Text-Antworten
│   │   │   ├── Toolbar.tsx        # Session-Controls, Farben, Debounce
│   │   │   ├── SessionList.tsx    # Session-Auswahl
│   │   │   ├── DebounceSlider.tsx # Debounce-Konfiguration
│   │   │   └── ErrorBoundary.tsx  # Fehleranzeige
│   │   ├── hooks/
│   │   │   ├── useCanvas.ts       # Drawing-Logic, Pen-Events, PNG-Export
│   │   │   ├── useSocket.ts       # WebSocket-Client
│   │   │   └── useSession.ts      # Session-Management
│   │   ├── utils/
│   │   │   └── drawingRenderer.ts # KI-Drawing-Commands Renderer
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
- `stroke:complete` — `{ sessionId, canvasPng }` — Pen-Up nach debounce
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
| Stift-Dicke | 2px | 1-10px | Dicke des User-Stifts |
| Text-Overlay Dauer | 8s | 3-15s | Wie lange KI-Text angezeigt wird |

Alle Werte werden im `localStorage` gespeichert.

## KI-Integration

- **Modell:** Google Gemini 2.5 Flash
- **API Key:** `/root/.openclaw/workspace/.secrets/google-gemini.env`
- **Prompt:** Analysiert Canvas-Bild, antwortet mit JSON (Text + Drawing-Commands)
- **Drawing-Commands:** line, circle, path, text — gerendert auf Canvas

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
4. Toggle-Button `◉ Glatt` / `○ Raw` in der Toolbar

**Smoothing-Algorithmus:** Catmull-Rom mit Hermite-Basis und Tangent-Clamping
- `TENSION = 0.4` (niedriger = weniger Overshoot)
- `CLAMP_FACTOR = 4.0` (max Tangent-Länge = 4× Segmentlänge)
- Verhindert Overshoot bei scharfen Ecken (z.B. Diamant-Formen)
- `STEPS = 8` (Zwischenpunkte pro Segment)

**Dateien:**
- `client/src/hooks/useCanvas.ts` — Zwei-Canvas-Logik, Catmull-Rom Smoothing
- `client/src/components/Canvas.tsx` — Rendert zwei übereinanderliegende Canvas-Elemente
- `client/src/components/Toolbar.tsx` — Smoothing Toggle Button
- `client/src/App.tsx` — `smoothingEnabled` State, Props an Canvas/Toolbar

## Bekannte Probleme / TODO

- [ ] Undo/Redo
- [ ] Export als PNG/PDF
- [ ] Multi-User Support
- [ ] Canvas-Größe an Scribe-Auflösung anpassen (300 DPI)
- [ ] Smoothing-Parameter feintunen (TENSION, CLAMP_FACTOR, STEPS)
- [ ] Versatz-Problem bei KI-Zeichnungen (Koordinaten-Mismatch)

---

_Stand: 2026-08-27 17:14. Getestet auf Kindle Scribe._
