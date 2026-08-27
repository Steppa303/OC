# 🕯️ Candle — AI Canvas für Kindle Scribe

**URL:** `candle.steppa.online`
**Status:** 📝 Planung
**Erstellt:** 2026-08-27

---

## Konzept

Eine für den Kindle Scribe optimierte Web-App mit einem Full-Screen Zeichen-Canvas. Der User malt mit dem Kindle-Stift auf den Canvas. Nach jedem Stift-Aufhebung (Pen-Up Event) wird automatisch ein Screenshot des Canvas an eine Vision-KI geschickt, die das Gezeichnete analysiert und mit Text + eigenen Zeichnungen auf dem Canvas antwortet.

**Use Case Beispiel:** User malt ein Strichmännchen und schreibt daneben "gib ihm eine Freundin" → KI analysiert das Bild, erkennt das Strichmännchen + Text, und malt ein weibliches Strichmännchen direkt auf den Canvas.

---

## Stack

| Komponente | Technologie | Begründung |
|------------|-------------|------------|
| Frontend | React 18 + Vite + TailwindCSS | Bewährter Stack, schneller Dev-Server |
| Canvas | HTML5 Canvas 2D API | Native Browser-API, beste Performance auf E-ink |
| Echtzeit-Kommunikation | Socket.io (WebSocket) | Bidirektionale Echtzeit-Übertragung, Auto-Reconnect |
| Backend | Express (Node.js) | Lightweight, schnell, gut für API-Proxy |
| Datenbank | better-sqlite3 (WAL) | Einfach, zuverlässig, kein externer DB-Server |
| KI | OpenClaw Vision API | Canvas-Screenshot → Analyse → Text + Drawing-Antwort |
| Deploy | PM2 + Caddy | Bewährter Deploy-Stack (wie andere Projekte) |

---

## Architektur

```
┌─────────────────────────────────────────────┐
│  Kindle Scribe (Browser)                    │
│  ┌─────────────────────────────────────┐    │
│  │  HTML5 Canvas (Full-Screen)         │    │
│  │  - Pen/Touch Events                 │    │
│  │  - Stroke-Sammlung                  │    │
│  │  - Text-Overlay für KI-Antworten    │    │
│  └──────────────┬──────────────────────┘    │
│                 │ Pen-Up Event              │
│                 │ (nach debounce)            │
│                 ▼                            │
│  ┌─────────────────────────────────────┐    │
│  │  Socket.io Client                   │    │
│  │  - Sendet Canvas-PNG               │    │
│  │  - Empfängt KI-Antwort             │    │
│  └──────────────┬──────────────────────┘    │
└─────────────────┼───────────────────────────┘
                  │ WebSocket
                  ▼
┌─────────────────────────────────────────────┐
│  VPS (Node.js Backend)                      │
│  ┌─────────────────────────────────────┐    │
│  │  Express + Socket.io Server         │    │
│  │  - Empfängt Canvas-PNG             │    │
│  │  - Speichert in SQLite             │    │
│  │  - Sendet an Vision API            │    │
│  └──────────────┬──────────────────────┘    │
│                 │                            │
│                 ▼                            │
│  ┌─────────────────────────────────────┐    │
│  │  OpenClaw Vision API                │    │
│  │  - Analysiert Canvas-Bild          │    │
│  │  - Generiert Text-Antwort          │    │
│  │  - Generiert Drawing-Commands      │    │
│  └──────────────┬──────────────────────┘    │
│                 │                            │
│                 ▼                            │
│  ┌─────────────────────────────────────┐    │
│  │  SQLite (better-sqlite3, WAL)       │    │
│  │  - Sessions                         │    │
│  │  - Interactions (Canvas + Antwort)  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

---

## User Flow

1. **User öffnet** `candle.steppa.online` im Kindle Scribe Browser
2. **Session startet** (automatisch neue Session oder letzte wiederherstellen)
3. **User malt** mit dem Stift auf den Canvas
4. **Pen-Up Event** → debounce (konfigurierbar, Default 500ms) → Canvas wird als PNG gespeichert
5. **PNG wird via WebSocket** ans Backend geschickt
6. **Backend sendet** das Bild + Session-Kontext an die Vision API
7. **KI analysiert** das Bild und generiert:
   - Text-Antwort (z.B. "Ich sehe ein Strichmännchen! Ich geb ihm eine Freundin.")
   - Drawing-Commands (z.B. ein weibliches Strichmännchen)
8. **Antwort wird via WebSocket** zurück an den Client gesendet
9. **Client rendert:**
   - Text als Overlay auf dem Canvas (lesbar, nicht gezeichnet)
   - Drawing direkt auf den Canvas (als neue Ebene)
10. **Canvas zeigt** das Ergebnis, User kann weitermalen

---

## Features

### 1. Canvas (Full-Screen)
- Vollbild-Canvas, optimiert für Kindle Scribe Auflösung (300 DPI, 1860×2480)
- Pen-Events: `pointerdown`, `pointermove`, `pointerup` mit Pressure-Sensitivity
- Touch-Events als Fallback (falls Pen nicht erkannt wird)
- Stift-Farbe: Schwarz (Default), optional weitere Farben
- Stift-Dicke: Konfigurierbar (Default: 2px)
- Clear-Button: Ganzen Canvas löschen

### 2. Pen-Up Trigger mit konfigurierbarem Debounce
- **Pen-Up Event** = Stift wird vom Display gehoben
- **Debounce:** Verzögerung nach dem letzten Pen-Event bevor Screenshot gesendet wird
- **Default:** 500ms
- **Konfigurierbar:** Slider/Number-Input direkt auf der Seite (z.B. 200ms - 3000ms)
- **Zweck:** Verhindert zu häufige API-Calls bei schnellen aufeinanderfolgenden Strichen
- **Anzeige:** Aktueller Debounce-Wert wird in der Toolbar angezeigt

### 3. Text-Antworten (Overlay)
- KI-Text-Antworten erscheinen als semi-transparentes Overlay auf dem Canvas
- Position: Unten links oder dort wo Platz ist (nicht über dem letzten Strich)
- Auto-Dismiss nach 8 Sekunden oder durch Tippen zum Schließen
- Font: Hoher Kontrast, große Schrift (E-ink optimiert)

### 4. Drawing-Antworten
- KI generiert SVG-ähnliche Drawing-Commands (Linien, Kreise, Pfade)
- Commands werden auf den Canvas gerendert (als neue Ebene über dem User-Content)
- Stil: Passend zum User-Stil (wenn User Strichmännchen malt → KI malt auch Strichmännchen)
- Farbe: Grau oder dunkelgrau (unterscheidbar vom User-Content)

### 5. Session-System
- **Session = UUID** + Name + Timestamps
- **Interactions:** Jede KI-Reaktion wird als Interaction gespeichert:
  - Canvas-Snapshot (PNG, Base64)
  - KI-Text-Antwort
  - KI-Drawing-Commands
  - Timestamp
- **Session-Liste:** Sidebar/Dialog mit allen Sessions
- **Neue Session:** Button in der Toolbar → fresh Canvas
- **Session wiederherstellen:** Letzte Session wird beim Öffnen automatisch geladen
- **Session löschen:** Option in der Session-Liste

### 6. Toolbar (unten, für Scribe-optimiert)
- **Links:** Session-Name (klickbar für Session-Liste)
- **Mitte:** Farbwahl (2-3 Farben), Stift-Dicke, Clear-Canvas
- **Rechts:** Debounce-Slider, Neue Session, Einstellungen

---

## Datenbank-Schema (SQLite)

```sql
-- Sessions
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,           -- UUID
    name TEXT DEFAULT 'Untitled',  -- User-definierter Name
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Interactions (jede KI-Reaktion)
CREATE TABLE interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    canvas_snapshot TEXT NOT NULL,      -- Base64 PNG des Canvas VOR der KI-Antwort
    ai_response_text TEXT,              -- KI-Text-Antwort
    ai_response_drawing TEXT,           -- JSON: Drawing-Commands
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Index für schnelle Session-Abfragen
CREATE INDEX idx_interactions_session ON interactions(session_id);
```

---

## API Design

### WebSocket Events (Socket.io)

**Client → Server:**
| Event | Daten | Beschreibung |
|-------|-------|--------------|
| `stroke:complete` | `{ sessionId, canvasPng (Base64) }` | Pen-Up nach debounce → Canvas-PNG senden |
| `session:new` | `{ name? }` | Neue Session erstellen |
| `session:switch` | `{ sessionId }` | Zu bestehender Session wechseln |
| `session:delete` | `{ sessionId }` | Session löschen |

**Server → Client:**
| Event | Daten | Beschreibung |
|-------|-------|--------------|
| `ai:thinking` | `{ }` | KI analysiert gerade (Loading-State) |
| `ai:response` | `{ text, drawing, interactionId }` | KI-Antwort (Text + Drawing-Commands) |
| `ai:error` | `{ message }` | Fehler bei der KI-Analyse |
| `session:created` | `{ session }` | Neue Session erstellt |
| `session:history` | `{ interactions } }` | Verlauf einer Session |

### REST Endpoints

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `GET` | `/api/sessions` | Alle Sessions auflisten |
| `GET` | `/api/sessions/:id` | Session-Details + Interactions |
| `POST` | `/api/sessions` | Neue Session erstellen |
| `DELETE` | `/api/sessions/:id` | Session löschen |
| `PATCH` | `/api/sessions/:id` | Session umbenennen |

---

## KI-Integration (Detail)

### Prompt-Struktur

```
Du siehst ein Bild, das ein User auf einem digitalen Canvas gezeichnet hat.

Deine Aufgabe:
1. Analysiere was der User gemalt hat
2. Antworte mit einem kurzen Text (max 2 Sätzen) was du siehst
3. Wenn der User eine Anweisung geschrieben hat (z.B. "gib ihm eine Freundin"), führe sie aus
4. Zeichne deine Antwort direkt auf das Canvas

Antwort-Format (JSON):
{
  "text": "Deine Text-Antwort",
  "drawing": [
    { "type": "line", "x1": 100, "y1": 200, "x2": 150, "y2": 250 },
    { "type": "circle", "cx": 300, "cy": 400, "r": 20 },
    { "type": "path", "points": [[x1,y1], [x2,y2], ...] }
  ]
}

Regeln:
- Halte dich an den Stil des Users (Strichmännchen → Strichmännchen)
- Zeichne nicht über den Content des Users
- Positioniere deine Zeichnung neben/benach dem bestehenden Content
- Antworte auf Deutsch
```

### Canvas → Bild Konvertierung

```javascript
// Client-seitig
const canvasPng = canvas.toDataURL('image/png');  // Base64
// Größe: ~100-500KB abhängig vom Canvas-Inhalt
// Auflösung: Canvas-Größe (1860×2480 oder angepasst)
```

### Drawing-Commands Format

```json
{
  "drawing": [
    {
      "type": "line",
      "x1": 100, "y1": 200,
      "x2": 150, "y2": 250,
      "color": "#666666",
      "width": 2
    },
    {
      "type": "circle",
      "cx": 300, "cy": 400,
      "r": 20,
      "fill": false,
      "color": "#666666",
      "width": 2
    },
    {
      "type": "path",
      "points": [[100,200], [105,210], [110,215]],
      "color": "#666666",
      "width": 2
    },
    {
      "type": "text",
      "x": 400, "y": 300,
      "content": "Hallo!",
      "font": "24px sans-serif",
      "color": "#333333"
    }
  ]
}
```

---

## E-ink Optimierungen

Der Kindle Scribe hat ein E-ink Display mit spezifischen Einschränkungen:

1. **Keine fließenden Animationen** — E-ink hat Ghosting (Nachbilder). Alle CSS-Transitions deaktivieren.
2. **Hoher Kontrast** — Nur Schwarz/Weiß + max 2-3 Graustufen. Keine Farben.
3. **Minimaler Redraw** — Nur die Bereiche neu zeichnen die sich ändern (nicht ganzen Canvas).
4. **Full-Refresh nach KI-Antwort** — `requestAnimationFrame` + Canvas-Neuaufbau für saubere Darstellung.
5. **Debounce bei Pen-Events** — Nicht zu häufig triggern (E-ink Refresh ist langsam).
6. **Große Touch-Targets** — Toolbar-Buttons mind. 48×48px (Stift-Finger ist ungenau).
7. **Keine Scrollbars** — Alles auf einer Seite, Full-Screen.
8. **Font-Größe** — Mind. 16px für lesbarkeit auf E-ink.

### Drawing-Performance-Optimierungen (27.08.2026)

Um den Lag beim Zeichnen mit dem Kindle-Stift zu minimieren:

1. **rAF-Batching** — Punkte sammeln, in einem Frame zeichnen
2. **Single-Path-Drawing** — 1x beginPath, alle lineTo, 1x stroke pro Frame
3. **Frame-übergreifende Pfad-Kontinuität** — lastDrawnPointRef für Lücken-Vermeidung
4. **Fixed lineWidth** — nur bei pointerdown setzen
5. **1:1 Pixel-Mapping** — DPR-Scaling auf Kindle entfernt
6. **willReadFrequently: false** — Canvas-Context-Hint

---

## Dateistruktur

```
projects/candle/
├── client/                      # React Frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.tsx           # Haupt-Canvas mit Pen-Events
│   │   │   ├── TextOverlay.tsx      # KI-Text-Antworten als Overlay
│   │   │   ├── Toolbar.tsx          # Session-Controls, Farben, Clear, Debounce
│   │   │   ├── SessionList.tsx      # Session-Auswahl (Sidebar/Dialog)
│   │   │   └── DebounceSlider.tsx   # Debounce-Konfiguration
│   │   ├── hooks/
│   │   │   ├── useCanvas.ts         # Drawing-Logic, Pen-Events, PNG-Export
│   │   │   ├── useSocket.ts         # WebSocket-Client, Event-Handling
│   │   │   └── useSession.ts        # Session-Management (CRUD)
│   │   ├── utils/
│   │   │   ├── drawingRenderer.ts   # Rendert KI-Drawing-Commands auf Canvas
│   │   │   └── canvasExport.ts      # Canvas → PNG/Base64 Konvertierung
│   │   ├── App.tsx
│   │   ├── App.css                  # E-ink optimiertes CSS
│   │   └── main.tsx
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
├── server/
│   ├── index.js                   # Express + Socket.io Server (Port 3011)
│   ├── db.js                      # SQLite Setup + Schema
│   ├── ai.js                      # Vision API Integration + Prompt
│   ├── socket.js                  # WebSocket Event-Handler
│   └── routes.js                  # REST Endpoints (Sessions CRUD)
├── package.json                   # Root package.json (Scripts)
├── ecosystem.config.js            # PM2 Config
├── HANDOVER.md                    # Detailliertes Handover-Dokument
└── PLAN.md                        # Diese Datei
```

---

## Deployment

### Caddy Config

```caddy
candle.steppa.online {
    # Frontend (Vite Dev → später Production Build)
    handle /assets/* {
        root * /root/.local/.openclaw/workspace/projects/candle/client/dist
        file_server
    }

    # API + WebSocket
    handle /api/* {
        reverse_proxy localhost:3011
    }

    handle /socket.io/* {
        reverse_proxy localhost:3011
    }

    # SPA Fallback
    handle {
        root * /root/.local/.openclaw/workspace/projects/candle/client/dist
        try_files {uri} /index.html
        file_server
    }
}
```

### PM2 Config

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'candle',
    script: 'server/index.js',
    cwd: '/root/.local/.openclaw/workspace/projects/candle',
    env: {
      NODE_ENV: 'production',
      PORT: 3011
    }
  }]
};
```

### DNS

```
candle.steppa.online → A Record → 185.217.126.72 (proxied=true, orange cloud)
```

### Cloudflare SSL

- **SSL Mode:** Full (Strict) — Cloudflare → Origin über HTTPS mit Zertifikatsprüfung
- **Proxied:** true (orange cloud) — Traffic geht über Cloudflare, nicht direkt
- Caddy stellt Let's Encrypt Zertifikat aus → Cloudflare vertraut dem LE-Zertifikat
- DNS Record wird mit `proxied:true` erstellt (Script geupdated)

---

## Konfigurierbare Parameter (Client-Seite)

| Parameter | Default | Range | Beschreibung |
|-----------|---------|-------|--------------|
| **Debounce** | 500ms | 200-3000ms | Verzögerung nach Pen-Up bevor Screenshot gesendet wird |
| **Stift-Farbe** | #000000 | Farbwähler | Farbe des User-Stifts |
| **Stift-Dicke** | 2px | 1-10px | Dicke des User-Stifts |
| **KI-Farbe** | #666666 | Fix | Farbe der KI-Zeichnung (unterscheidbar) |
| **Text-Overlay Dauer** | 8s | 3-15s | Wie lange KI-Text angezeigt wird |

Alle Werte werden im `localStorage` gespeichert und bleiben über Sessions erhalten.

---

## Offene Fragen / TODOs

- [x] Welche Vision API genau nutzen? → Google Gemini 2.5 Flash
- [ ] Soll der Canvas die volle Scribe-Auflösung nutzen oder skaliert?
- [ ] Drawing-Commands: Einfache Geometrie oder komplexere SVG-Pfade?
- [ ] Multi-User Support? (aktuell Single-User)
- [ ] Export-Funktion? (Canvas als PNG/PDF speichern)
- [ ] Undo/Redo?
- [ ] Weitere Lag-Optimierungen (OffscreenCanvas, WebWorker?)

---

## Nächste Schritte

1. **Projekt scaffolden** — React + Express + Socket.io + SQLite
2. **Backend** — Express Server, WebSocket, DB Schema, REST API
3. **Frontend** — Canvas mit Pen-Events, Toolbar, Session-Liste
4. **KI-Integration** — Vision API, Prompt-Engineering, Drawing-Parser
5. **Deploy** — Caddy + PM2 + DNS
6. **Testen** — Auf echtem Kindle Scribe testen

---

_Plan erstellt: 2026-08-27 13:27_
