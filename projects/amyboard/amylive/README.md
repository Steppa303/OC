# 🎹 amylive — AMYboard Live Control Webapp

**URL:** `https://amylive.steppa.online`  
**Board:** AMYboard (ESP32-S3, Tulip CC, [GitHub](https://github.com/shorepine/tulipcc))  
**Kommunikation:** WebMIDI SysEx ↔ zP Python (amy.send())  
**Status:** Live ✅

---

## Features

- **Patch Browser** — 256+ Factory Patches (Juno-106, DX7, Drums) + User Slots
- **Patch Editor** — Oszillatoren, Filter, Envelopes, LFOs als Module
- **Quick Actions** — Save/Load Patch (lokal), Save to Board (als sketch.py), Load from Board (zDZ Dump)
- **Event Log** — Echtzeit-Logging aller MIDI/Wire/User-Operationen
- **Mobile Touch** — Swipeable Card Stack mit Touch-Slidern, Touch-Pills
- **Signal Chain** — Visuelle Verkettung OSC → Filter → Envelope → LFO
- **MIDI Keyboard** — Eingebaute Pads + Computer-Keyboard Input

## Tech Stack

| Bereich | Technologie |
|---------|-----------|
| Framework | React 18 (Vite + TypeScript) |
| Styling | TailwindCSS v4 |
| Animation | Framer Motion |
| State | Zustand |
| MIDI | Web MIDI API (navigator.requestMIDIAccess) |
| Icons | Lucide React |
| Testing | Vitest |
| Hosting | Caddy (Static, VPS Contabo) |

## Quick Start

```bash
npm install
npm run dev      # → localhost:5173
npm run build    # → dist/
npm test         # 58 Tests (Vitest)
```

## Architektur

```
[BROWSER] ←── WebMIDI SysEx ──→ [AMYboard (ESP32-S3)]
    │                                    │
    ├─ Patch Editor                 AMY Synth Engine
    ├─ Modulation Matrix             ├─ 180 Oszillatoren
    ├─ Envelope Designer             ├─ 4 Buses mit FX
    ├─ Modul-Bibliothek              ├─ Sequenzer
    └─ Patch Library (Lokal)         └─ User Patches (1024-1055)
```

### Wire→Python Bridge

AMY Wire-Format wird generisch in `amy.send()` Python-Code übersetzt:

```
v0w0f440a0.8Z  →  amy.send(osc=0, wave=0, freq=440, amp=0.8)
i0K42Z         →  amy.send(synth=0, patch=42, num_voices=6)
```

## Projektstruktur

```
src/
├── components/
│   ├── touch/         # Touch-optimierte Controls (Slider, Pills, SwipeStack, CardHeader)
│   ├── chain/         # Signal Chain Visualization
│   ├── Sidebar.tsx    # MIDI Connect Panel
│   └── LogPanel.tsx   # Event Log
├── engine/
│   ├── patch-parser.ts       # zDZ State → CanvasModule[]
│   ├── patch-applier.ts      # applyPatchToCanvas()
│   ├── patch-from-board.ts   # loadPatchFromBoard() + Factory Fallback
│   ├── patch-from-canvas.ts  # canvasToPatch()
│   ├── dump-parser.ts        # zDZ Wire-Dump Parser
│   └── wire-bridge.ts        # Wire-Command Generation
├── modules/
│   ├── oscillator-card.tsx   # OSC Full-Card
│   ├── filter-card.tsx       # Filter Full-Card
│   ├── envelope-card.tsx     # Envelope Full-Card
│   ├── synth-card.tsx        # Synth Manager Full-Card
│   ├── chain-view-card.tsx   # Chain View Full-Card
│   └── index.ts             # Module Registry
├── stores/
│   ├── canvas-store.ts       # CanvasModule State
│   ├── patch-store.ts        # AmyPatch Persistence
│   ├── connection-store.ts   # WebMIDI Connection State
│   ├── chain-store.ts        # Signal Chain Links
│   └── log-store.ts          # Event Log State
├── lib/
│   ├── amy-patches.ts       # Patch Database (256 Factory + User Slots)
│   ├── amy-connection.ts    # WebMIDI Connection Manager
│   └── amy-constants.ts     # AMY Wire Codes
├── pages/
│   ├── Dashboard.tsx         # Main Dashboard (Connect + Quick Actions)
│   ├── Patches.tsx           # Patch Library (separate Route)
│   └── LiveBoard.tsx         # (geplant) Live Patch Editor + Keyboard
├── types/
│   └── amy.ts               # Core Types (AmyPatch, CanvasModule, etc.)
└── App.tsx                   # Routing + Bottom Nav
```

## PWA (geplant)

- Service Worker (offline-capable)
- Install-Banner (Add to Home Screen)
- MIDI Permission-Prompt on First Connect

## Deployment

```bash
npm run build
cp -r dist/* /var/www/apps/amylive/
caddy reload --config /etc/caddy/Caddyfile
```

## UI Refactor (amyuipimp.md)

Siehe `amyuipimp.md` für den geplanten UI-Refactor:
- Dashboard wird entschlackt (nur Connect + Start)
- Neuer **Live Board** Screen (Route `/live`) mit Vollbild-Editor + Keyboard Flyout
- Multi-Synth Support
- Bottom Nav: Dashboard → Live Board → Patches → Settings

## Logs

Event Log Server: `GET /api/amy/log` (Caddy → localhost:3011)
Logs werden in `/srv/amylive-logs/` persistiert (tägliche JSONL-Files).