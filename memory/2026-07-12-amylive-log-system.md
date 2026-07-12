## 🎹 amylive Event Log System (12.07.2026)

**Status:** ✅ Deployed auf amylive.steppa.online

### Frontend (was ich gemacht hab):
- **`log-store.ts`** — Zustand Store mit Ringbuffer (500 in Mem, 200 in localStorage), periodischer Flush ans Backend (alle 10s)
- **`LogPanel.tsx`** — Echtzeit-Log-Komponente mit:
  - Kind-Badges (CONN, ERR, WIRE, MIDI, SYSX, PING, DUMP, DBG, USER)
  - Filter-Buttons (ALL + pro Kind)
  - Suchfeld mit Clear
  - Pause/Resume Auto-Scroll
  - Clear Log
  - Expandierbare Details (auf Klick)
  - Copy-to-Clipboard pro Eintrag
- **connection-store.ts** — Loggt jede connect/disconnect/ping/error Aktion
- **Dashboard.tsx** — Loggt jede param change, wire send, module add/clear

### Backend:
- **`/srv/amylive-log-server/server.js`** — Express-ähnlich mit raw http
  - `POST /api/amy/log` — Batch-Ingestion (JSONL, tägliche Files unter `/srv/amylive-logs/`)
  - `GET /api/amy/log` — Query mit Filter (kind, since, until, limit, offset)
  - `GET /api/amy/log/stats` — Kinds-Verteilung + Entry-Count
- **systemd Service:** `amylive-log.service` (enabled, restart=always)
- **Caddy:** `/api/amy/*` → localhost:3011

### Analyse nachträglich:
- Logs landen als `amylive-YYYY-MM-DD.jsonl` → kann ich mit `curl https://amylive.steppa.online/api/amy/log?kind=error` abfragen
- Oder per Script: `fetch('https://amylive.steppa.online/api/amy/log', ...)`