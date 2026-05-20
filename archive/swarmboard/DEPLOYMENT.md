# Swarmboard Live Dashboard - Deployment Dokumentation

## Übersicht

Das Swarmboard-Projekt (GitHub: Steppa303/swarmboard) wurde von einer Mock-Daten-App in ein LIVE-Dashboard verwandelt und unter `http://localhost:8080` deployed.

**Status:** ✅ DEPLOYED & FUNCTIONAL  
**Datum:** 25. April 2026  
**Deployed by:** OpenClaw Orchestrator Subagent

---

## Architektur

### Frontend
- **Framework:** React 19 + Vite 6.2
- **Styling:** TailwindCSS 4.1
- **Charts:** Recharts 3.8
- **Icons:** Lucide React 0.546
- **Animations:** Motion 12.23

### Backend Services
1. **Swarmboard Metrics Server** (Port 3004)
   - Express.js Node.js Server
   - Liefert System-Metrics (CPU, RAM, Gateway, Telegram API, ElevenLabs, Caddy Domains)
   - Location: `/var/www/apps/swarmboard-server/`
   - Service: `swarmboard-server.service` (systemd)

2. **Agent Dashboard API** (Port 3002)
   - Existierender Backend-Server für Agent-Daten
   - Location: `/root/.openclaw/workspace/archive/agent-dashboard/api.mjs`
   - PostgreSQL Database für Agent-Historie

3. **OpenClaw Gateway** (Port 18789)
   - Haupt-Gateway für OpenClaw Operations
   - Health Endpoint: `http://127.0.0.1:18789/health`

### Reverse Proxy
- **Caddy** auf Port 8080
- Routes:
  - `/api/agents/list*` → `localhost:3002/api/agents` (mit URL-Rewrite)
  - `/api/system-metrics*` → `localhost:3004`
  - `/*` → Static Files aus `/var/www/apps/swarmboard/`

---

## Änderungen am Quellcode

### 1. Backend-Server (`/var/www/apps/swarmboard-server/`)

**Neue Dateien:**
- `package.json` - Dependencies (express, cors)
- `server.js` - Express Server mit folgenden Endpoints:
  - `GET /api/system-metrics` - Sammelt System-Daten von:
    - `/proc/stat` für CPU Load
    - `free -m` für RAM Usage
    - `curl http://127.0.0.1:18789/health` für Gateway Status
    - `curl https://api.telegram.org/bot<token>/getMe` für Telegram API
    - `tail -3 /tmp/telegram-watchdog.log` für Watchdog Status
    - `curl https://api.elevenlabs.io/v1/user` für ElevenLabs Usage
    - `/etc/caddy/Caddyfile` Parser für aktive Domains

**Systemd Service:**
```ini
[Unit]
Description=Swarmboard Backend Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/apps/swarmboard-server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 2. Frontend Hook (`/tmp/swarmboard/src/lib/simulation.ts`)

**Änderungen:**
- Neue Funktion `useRealData()` ersetzt `useSimulation()`
- Pollt alle 30 Sekunden:
  - `GET /api/agents/list` → Konvertiert Backend-Agent-Format zu Frontend-Format
  - `GET /api/system-metrics` → Aktualisiert Top-Bar Metriken
- Generiert Events bei Status-Änderungen (spawned, completed, failed, timeout)
- Berechnet Chart-Daten aus Historie (Parallelism, Runtime Distribution, Model Performance)
- Backward Compatibility: `useSimulation()` ruft jetzt `useRealData()` auf

**Backend → Frontend Daten-Konvertierung:**
```typescript
Backend Format:
{
  id: number,
  session_key: string,
  label: string,
  status: "done" | "timeout" | "running",
  model: string,
  runtime_ms: number,
  started_at: ISO8601,
  ended_at?: ISO8601,
  parent_session?: string,
  task?: string
}

Frontend Format:
{
  id: `agent-${id}`,
  label: string,
  type: "main" | "orchestrator" | "worker" (basierend auf Label),
  status: "completed" | "timeout" | "running" | "failed",
  model: AgentModel,
  startTime: timestamp,
  endTime?: timestamp,
  tokens: estimated from runtime_ms,
  parentId?: string,
  task?: string,
  progress?: number
}
```

### 3. Vite Config (`/tmp/swarmboard/vite.config.ts`)

**Änderungen:**
- `base: '/'` (Subdomain Deployment, kein Subfolder)
- Dev-Server Proxies:
  - `/api/agents/list` → `http://localhost:3002`
  - `/api/system-metrics` → `http://localhost:3004`

### 4. Caddy Config (`/etc/caddy/Caddyfile`)

**Neue Site-Config:**
```caddy
:8080 {
    handle /api/agents/list* {
        uri path_regexp ^/api/agents/list(.*)$ /api/agents{1}
        reverse_proxy localhost:3002
    }
    
    handle /api/system-metrics* {
        reverse_proxy localhost:3004
    }
    
    handle /* {
        root * /var/www/apps/swarmboard
        try_files {uri} /index.html
        file_server
    }
}
```

**Wichtig:** URL-Rewrite für `/api/agents/list` → `/api/agents` weil Backend-API andere Route verwendet.

---

## Build & Deploy Prozess

```bash
# 1. Dependencies installieren
cd /tmp/swarmboard && npm install

# 2. Production Build
npm run build

# 3. Nach Deploy-Dir kopieren
cp -r dist/* /var/www/apps/swarmboard/

# 4. Caddy reloaden
systemctl reload caddy

# 5. Backend-Server starten (falls nicht schon running)
systemctl enable --now swarmboard-server
```

**Build Output:**
- `dist/index.html` - 0.41 kB (gzipped: 0.28 kB)
- `dist/assets/index-*.css` - 26.34 kB (gzipped: 5.92 kB)
- `dist/assets/index-*.js` - ~763 kB (gzipped: ~232 kB)

---

## Testing & Verifikation

### Asset Content-Type Test
```bash
curl -sI http://localhost:8080/assets/index-*.js | grep Content-Type
# Expected: text/javascript; charset=utf-8
# NOT: text/html (würde weißen Bildschirm bedeuten)
```

### API Endpoint Tests
```bash
# System Metrics
curl -s http://localhost:8080/api/system-metrics | python3 -m json.tool

# Agents List
curl -s http://localhost:8080/api/agents/list | python3 -m json.tool
```

### Browser Test
```bash
# Mit agent-browser
agent-browser open http://localhost:8080
sleep 3
agent-browser screenshot /tmp/test.png
```

**Expected Results:**
- ✅ Top-Bar zeigt echte System-Metrics (CPU, RAM, Gateway, Caddy r/s, ElevenLabs %)
- ✅ Agent-Pipeline zeigt echte Agents aus Datenbank
- ✅ Worker Grid zeigt aktive Workers mit Token-Usage
- ✅ Event Stream zeigt echte Events (Agent Spawned, Completed, etc.)
- ✅ Console Errors = 0

---

## Bekannte Probleme & Limitations

### 1. DNS fehlt für swarmboard.steppa.online
- Domain ist in Caddyfile konfiguriert aber DNS Record existiert nicht
- Aktuell nur über `http://localhost:8080` erreichbar
- **Lösung:** DNS A-Record für `swarmboard.steppa.online` → Server IP hinzufügen, dann Caddy auf HTTPS umstellen

### 2. Telegram API & Gateway zeigen "error"
- Backend-Server hat keinen Zugriff auf Telegram Bot Token
- Gateway Health Check funktioniert (PID 106180 running) aber API-Antwort format anders als erwartet
- **Workaround:** Hardcoded Token in `server.js` oder Umgebungsvariable verwenden

### 3. Agent-Daten sind historisch (letzte Activity vor Tagen)
- Dashboard API zeigt Agents aus Datenbank (letzte Einträge von April 20-25)
- Keine aktiven Agents im Moment
- **Normal:** Dashboard zeigt historische Daten korrekt an, würde live Agents anzeigen wenn welche laufen

### 4. Chart-Daten unvollständig
- Parallelism Chart zeigt nur aktuelle Snapshot-Historie (max 100 Einträge)
- Runtime Distribution, Model Performance, Error Rate, Token Usage Charts haben keine historischen Daten
- **Verbesserungspotenzial:** Längere Historie speichern, mehr Metriken tracken

---

## File Structure

```
/var/www/apps/
├── swarmboard/                    # Deployed Frontend
│   ├── index.html
│   └── assets/
│       ├── index-*.css
│       └── index-*.js
└── swarmboard-server/             # Backend Metrics Server
    ├── package.json
    ├── server.js
    └── node_modules/

/tmp/swarmboard/                   # Source Code (Git Repo)
├── src/
│   ├── lib/
│   │   └── simulation.ts          # useRealData() Hook
│   ├── App.tsx                    # Main Component
│   └── main.tsx                   # Entry Point
├── vite.config.ts                 # Vite Config mit Proxies
├── package.json
└── dist/                          # Build Output

/etc/caddy/
└── Caddyfile                      :8080 Block für Swarmboard

/etc/systemd/system/
└── swarmboard-server.service      # Systemd Service
```

---

## Wartung & Updates

### Backend-Server Logs
```bash
journalctl -u swarmboard-server -f
# Oder
tail -f /var/log/syslog | grep swarmboard
```

### Frontend Update Prozess
```bash
# 1. Changes in /tmp/swarmboard machen
cd /tmp/swarmboard
# ... edits ...

# 2. Build
npm run build

# 3. Deploy
cp -r dist/* /var/www/apps/swarmboard/

# 4. Browser Cache bust (automatisch durch Vite Hash-Namen)
```

### Monitoring
- Caddy Logs: `journalctl -u caddy -f`
- Backend Health: `curl http://localhost:3004/api/system-metrics`
- Agent API Health: `curl http://localhost:3002/api/agents`
- Gateway Health: `curl http://127.0.0.1:18789/health`

---

## Next Steps & Verbesserungen

1. **DNS Setup:** A-Record für `swarmboard.steppa.online` erstellen
2. **HTTPS aktivieren:** Caddy von `:8080` auf `swarmboard.steppa.online {` umstellen (automatisch Let's Encrypt)
3. **Telegram Token:** Sichere Speicherung des Bot Tokens (env vars oder vault)
4. **Chart-Historie:** Längere Aufbewahrung von Metriken (z.B. in SQLite oder PostgreSQL)
5. **WebSocket Support:** Real-time Updates statt 30s Polling
6. **Authentication:** Dashboard mit Passwort schützen (wie config.steppa.online)
7. **Mobile Optimierung:** Responsive Design für Smartphones verbessern

---

## Credits

- **Original Project:** [Steppa303/swarmboard](https://github.com/Steppa303/swarmboard)
- **Deployment:** OpenClaw AI Assistant (Orchestrator Subagent)
- **Date:** 25. April 2026
- **Runtime:** ~30 Minuten für komplettes Setup

---

**Status:** ✅ PRODUCTION READY (mit Einschränkungen - siehe "Bekannte Probleme")
