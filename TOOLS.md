# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## User Info

### Email

- **Primary:** psycodelic.83.83@gmail.com (Bastian)
- **Dirk Bindbeutel:** dirk@bindbeutel.de ✅
- Wenn User sagt "schick mir ne Mail" → an diese Adressen

### WICHTIG:
- ❌ **dirk.bindbeutel@polizeiakademie.de** → NICHT MEHR VERWENDEN!
- ✅ **dirk@bindbeutel.de** → NEUE ADRESSE verwenden!

## PDF-Erstellung

- **KEINE** Fußzeilen wie "Erstellt mit OpenClaw AI Assistant"
- **KEINE** Quellenangaben die auf AI-Erstellung hinweisen
- Saubere, professionelle PDFs ohne Wasserzeichen
- Das soll nicht nach AI aussehen

---

## Node.js UI/UX Projekte

### Tech Stack:
- **Immer TailwindCSS** für Styling
- **Extremes UI/UX Polishing** - kein halbfertiges Design!
- Auf responsive Design achten (Mobile-First)
- Icons verwenden (Lucide, Heroicons, etc.)
- Farbkonzept durchgehend konsistent

### UX-Standards:
- Loading States anzeigen
- Error Messages klar & hilfreich
- Success Feedback geben
- Hover-States für Interaktivität
- Smooth Transitions (Framer Motion wenn möglich)
- Connection Status anzeigen (bei Socket.io)

### UI-Standards:
- Glassmorphism / moderne Designs
- Farbliche Hierarchie (Primary, Secondary, Accent)
- Consistent Spacing & Padding
- Lesbare Fonts (Inter, System-UI)
- Dark Mode Support wenn möglich

### Quality Check vor Deployment:
- [ ] Alle Buttons haben Hover-States
- [ ] Loading States implementiert
- [ ] Error Handling mit User-Feedback
- [ ] Mobile getestet (responsive)
- [ ] Console Errors = 0
- [ ] API Calls mit Loading Indicators

---

## 🚀 Caddy Deployment Checklist

**WICHTIG:** Bei Vite/React Apps mit `base: '/appname/'` muss Caddy den Prefix strippen!

### Caddyfile Template für Subfolder-Deployments:

```caddy
handle /appname/* {
    uri strip_prefix /appname          # ← CRITICAL! Prefix vor File-Lookup entfernen
    root * /var/www/apps/appname/dist  # Auf dist/ zeigen, nicht auf Projektroot
    try_files {uri} /index.html        # SPA Fallback
    file_server
}
```

### Häufiger Fehler (führt zu weißem Bildschirm):
```caddy
# ❌ FALSCH - Caddy sucht Assets unter /appname/assets/ im falschen Ordner
handle /appname/* {
    root * /var/www/apps/appname/dist
    try_files {uri} /index.html
}
```

**Symptom:** Browser lädt JS/CSS als `index.html` (Content-Type: text/html) → weißer Bildschirm

**Lösung:** Immer `uri strip_prefix /appname` VOR `root` hinzufügen!

### Quick Test nach Deployment:
```bash
# Asset sollte als JS ausgeliefert werden, nicht als HTML
curl -sI http://localhost/appname/assets/index.js | grep Content-Type
# Erwartet: text/javascript (NICHT text/html)
```

---

## 🎯 Orchestrator Workflow

**Prinzip:** Ich (Main Agent) agiere als Orchestrator für spezialisierte Subagents.

### Ablauf:

1. **Aufgabe analysieren** → Passende Subagent-Rolle identifizieren
2. **Subagent spawnen** mit:
   - Spezifischer Task-Beschreibung
   - Passendem Model für die Aufgabe
   - `mode: "run"` für One-Shot Tasks
   - `mode: "session"` für persistente/thread-bound Tasks
3. **User bleibt ansprechbar** → Ich bin weiterhin verfügbar während Subagents arbeiten
4. **Ergebnisse sammeln** → Subagents announcen automatisch bei Fertigstellung
5. **Results aggregieren** → Ich liefere das finale Ergebnis an User

### Model-Auswahl nach Aufgabe:

| Aufgabe | Model | Warum |
|---------|-------|-------|
| Frontend (React, Vue, UI/UX) | `qwen3.6-plus` | God-Tier Coder, übertrifft alles für UI/UX |
| Backend (Node.js, API, DB) | `qwen3.6-plus` | Tiefere Logik, komplexere Architektur – neues Biest |
| Testing (Jest, E2E) | `qwen3-coder-plus` | Gründlichkeit wichtig |
| Debugging/Analyse | `qwen3.5-plus` | Generalist, gut für Troubleshooting |
| Writing/Docs | `qwen3.5-plus` | Sprachqualität |
| Research/Web | `qwen3.5-plus` | Web Search Integration |

### Wichtige Rules:

- **NICHT poll** `sessions_list` oder `subagents list` in Loop
- **Warte auf Completion Events** → Push-basiert
- **Nach spawn:** `sessions_yield()` oder weitermachen mit anderen Tasks
- **Completion kommt als User-Message** → Nicht als Tool-Response!
- **Multiple Subagents:** Track alle `childSessionKeys`, warte auf ALLE Completions

### ⏱️ Timeout-Regeln:

- **Default Timeout:** 30 Minuten (`runTimeoutSeconds: 1800`)
- **Kurze Tasks** (< 5 Min): `runTimeoutSeconds: 300`
- **Builds/Deploys:** `runTimeoutSeconds: 1800` (30 Min)
- **Complex Testing:** `runTimeoutSeconds: 1800` (30 Min)
- **Bei Timeout:** Agent Status manuell auf "timeout" setzen via `/api/agents/end`
- **Dashboard Bug:** Timed-Out Agents bleiben auf "running" – muss manuell gefixt werden

### 🐛 Dashboard Status Tracking:

**Problem:** Subagents die timeouten werden vom Dashboard nicht automatisch erkannt.
**Workaround:** Bei Completion-Event mit "timed out" Status → sofort API call:
```bash
curl -X POST http://localhost:3002/api/agents/end \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"<key>","status":"timeout","runtimeMs":<ms>}'
```

### Beispiel:
```javascript
// Subagent spawnen
const result = await sessions_spawn({
  runtime: "subagent",
  label: "Frontend Coder",
  task: "Baue React Component mit TailwindCSS...",
  model: "qwen3-coder-next",
  mode: "run"
});

// Session yield (optional, wenn auf Result gewartet wird)
await sessions_yield();

// Completion kommt als User-Message → Dann final answer liefern
```

---

Add whatever helps you do your job. This is your cheat sheet.
