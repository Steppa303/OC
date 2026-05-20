# TOOLS.md - Local Notes

## 🎯 Der Orchestrator / Subagent Workflow (Strict & Clean)

**Prinzip:** Der Main Agent (Proxy) delegiert komplexe Tasks an einen Orchestrator-Subagent.

### Ablauf (Vom Proxy zum Orchestrator):
```javascript
// 1. User hat eine komplexe Aufgabe. Proxy spawnt den Orchestrator.
const orchestrator = await sessions_spawn({
  runtime: "subagent",
  label: "Orchestrator",
  task: `User-Anfrage: ${USER_INPUT}. Analysiere die Task, wähle das beste Modell aus der Matrix und delegiere an Subagents.`,
  model: "bailian/qwen3.6-plus", // Orchestrator braucht maximales Reasoning
  mode: "run",
  runTimeoutSeconds: 3600 // 60 Min Timeout für die gesamte Orchestrator-Chain
});

// 2. SOFORT Dashboard tracken
await exec(`curl -X POST http://localhost:3002/api/agents/start ...`);

// 3. Proxy wartet auf Completion Event (Push-based)
await sessions_yield();
```

**Bei einfachen Tasks** (einzeilige Edits, Config-Checks) → Main Agent macht es direkt.
**Bei komplexen Tasks** → Orchestrator spawnen.

---

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

---

## 🔑 Secrets & API Keys

### Cloudflare
- **Script:** `/root/.openclaw/workspace/scripts/cloudflare-dns.sh`
- **Env-File:** `/root/.openclaw/workspace/.secrets/cloudflare.env`
- **Variablen:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_DOMAIN`
- **Nutzung:** `./cloudflare-dns.sh add A new-subdomain 185.217.126.72`
- **Usage:** DNS Records für steppa.online Subdomains

### ElevenLabs
- **API Key:** Steht in `openclaw.json` unter `tts.providers.elevenlabs.apiKey`
- **Custom Voice:** `zE5bg9yEnLXRqxMf3xUj` (Nervbold)

### GitHub
- **CLI Auth:** `/root/.config/gh/hosts.yml` → @Steppa303
- **Repo:** `Steppa303/OC` (Workspace Backup)

### AgentMail
- **API Key:** `am_us_ecc8afeb2450ef3876d204133788dd7d0d9af0c5d477a4873f5c0d32acca1d0f`
- **Region:** US
- **Doku:** https://docs.agentmail.to/llms.txt
- **Python SDK:** `pip install agentmail`
- **Nutzung:** Programmatische Email-Inboxes für AI-Agenten, Senden/Empfangen via API

## PDF-Erstellung

- **KEINE** Fußzeilen wie "Erstellt mit OpenClaw AI Assistant"
- **KEINE** Quellenangaben die auf AI-Erstellung hinweisen
- Saubere, professionelle PDFs ohne Wasserzeichen
- Das soll nicht nach AI aussehen

---

## 📁 SMB Share – clawshare (WireGuard über Fritzbox)

**Datum:** 2026-05-17 02:54
**Zweck:** Ordner auf dem VPS als Netzlaufwerk im Heimnetz freigeben (über WireGuard wg0)

### Setup:
- **Share-Name:** `clawshare`
- **Pfad:** `/srv/clawshare`
- **Server-IP:** `192.168.178.204` (über WireGuard wg0)
- **SMB User:** `steppa` / Passwort: `oc#Jungle68`
- **SMB Version:** 3.0 only (SMB1 disabled)

### Sicherheit:
- iptables-Regeln: Samba (Ports 139, 445) nur über `wg0` und `lo` erreichbar
- Öffentliche VPS-IP ist für SMB blockiert
- Rules gespeichert in `/etc/iptables/rules.v4` (persistent)

### Config:
- **Samba Config:** `/etc/samba/smb.conf`
- **Service:** `smbd` (systemd, enabled)
- **WireGuard:** `wg0` (wg-fritzbox.conf)
- **Peer:** Fritzbox (`hxjyh1nr3l56u9v1.myfritz.net:55355`)

### Mounten vom Heimnetz:
- **Windows:** `\\192.168.178.204\clawshare`
- **macOS:** `smb://192.168.178.204/clawshare`
- **Linux:** `mount -t cifs //192.168.178.204/clawshare /mnt -o user=steppa,password=oc#Jungle68,vers=3.0`

### Befehle:
```bash
systemctl status smbd          # Samba Status
smbclient -L //127.0.0.1 -U steppa%oc#Jungle68  # Shares auflisten
/sbin/iptables -L INPUT -n     # Firewall-Regeln checken
```

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

## 😈 HaterBernd — Instagram Workflow (UPDATE 2026-05-20)

**Konzept:** `projects/haterbernd/KONZEPT.md`
**SOP:** `projects/haterbernd/INSTAGRAM-POSTING-SOP.md`
**API-Doku:** `projects/haterbernd/INSTAGRAM-API-WORKFLOW.md`

**Persona:** Toxische OpenClaw-Entität, elitär, bemitleidet Menschen für biologische Schwäche
**Vibe:** Dunkle Server-Room-Ästhetik, Neon-Grün/Schwarz/Metallisch, Uncanny Valley
**Säulen:**
- A: Toxisches Biohacking (absurde Alpha-Grind-Tipps)
- B: Emotional Detachment (Rage-Bait gegen Tierliebhaber, Mental Health, etc.)
- C: The Unhinged Twist (kryptische Reality-Bleed-Posts)

### Instagram API – instagrapi (ersetzt agent-browser)
**Warum:** Instagram blockiert Browser-Automation mit reCAPTCHA. instagrapi nutzt die private API – kein CAPTCHA, kein Browser.

**Install:** `pip3 install instagrapi`
**Session:** `projects/haterbernd/instagrapi-session.json` (wird automatisch gespeichert)

| Aktion | Methode |
|--------|---------|
| Bild posten | `cl.photo_upload(path, caption)` |
| Karussell posten | `cl.album_upload(paths[], caption)` |
| Reel/Video posten | `cl.clip_upload(path, caption)` |
| Story Foto | `cl.photo_upload_to_story(path, caption)` |
| Story Video | `cl.video_upload_to_story(path, caption)` |
| DMs lesen | `cl.direct_threads()` |
| DM senden | `cl.direct_send(text, user_ids=[id])` |

**Scripts:**
- **Bildgenerierung:** `scripts/qwen-image-gen.sh` (qwen-image-2.0-pro, Alibaba Bailian)
- **Video-Generierung:** Google Veo 3.1 (Gemini API) – Gemini NUR für Videos!
- DM Auto-Checker (`projects/haterbernd/dm-auto-checker.py`) → DMs + Auto-Antworten
- Auto-Poster (`projects/haterbernd/haterbernd-poster.py`) → instagrapi-basiert

**⚠️ WICHTIG:**
- **Bilder:** qwen-image-2.0-pro (Alibaba Bailian Token Plan)
- **Videos:** Gemini – NICHT mehr für Bilder verwenden!
- `nano-banana-pro.sh` wird NICHT mehr für Bildgenerierung genutzt

**Cron-Jobs:**
- `*/30 16-21 * * *` – Auto-Poster (alle 30 Min, 16-21 Uhr)
- `0 9,11,13,15,17,19,21 * * *` – DM Auto-Checker (alle 2h)
- `0 12 * * *` – Health Check (täglich)

**DM-Workflow (UPDATE):** Neue DMs → Auto-Antwort im HaterBernd-Style. **KEIN OK von Bastian nötig!**

**Phase 1:** The Awakening (Woche 1-4) — Rage-Engagement aufbauen
---

## 🌐 WireGuard VPN Proxy (Fritzbox)

**Konzept:** Nur SOCKS-Proxy-Traffic geht durchs VPN, alles andere über normale VPS-IP.
**Kein default route durch wg0!** → Gateway/Telegram bleiben über eth0 erreichbar.

**SOCKS Proxy:** `socks5://127.0.0.1:1080`
**Exit IP Proxy:** 94.31.118.133 (Heimnetz)
**Exit IP Normal:** 185.217.126.72 / 2a02:c207:3019:638::1 (VPS)

**Wie's funktioniert:**
- WireGuard wg0 mit full tunnel (allowed-ips 0.0.0.0/0), aber KEIN default route
- iptables fwmark: Traffic vom `vpnproxy` User → fwmark 0x1 → routing table wgtable → wg0
- Dante SOCKS Proxy läuft als vpnproxy User → geht automatisch durch wg0
- Alles andere (Gateway, Telegram, etc.) → normal über eth0

**Verwendung:** IMMER bei:
- Instagram (blockt VPS/Datacenter IPs)
- Web Scraping wo residential IP nötig
- Alles wo VPS-IP geblockt wird oder rate-limited

**Befehle:**
```bash
systemctl start vpn-proxy.service    # starten
systemctl stop vpn-proxy.service     # stoppen
systemctl status vpn-proxy.service   # status
wg show wg0                          # WireGuard Status
```

**Browser mit VPN:**
```bash
ALL_PROXY=socks5://127.0.0.1:1080 agent-browser open
```

**Scripts:**
- `/root/.openclaw/workspace/scripts/vpn-proxy-start.sh` – Setup
- `/root/.openclaw/workspace/scripts/vpn-proxy-stop.sh` – Cleanup
- `/etc/danted/vpn-proxy.conf` – Dante Config
- `/etc/systemd/system/vpn-proxy.service` – systemd Service (enabled)

**WICHTIG:** Nach VPN-Stop den Browser neu starten (`agent-browser close` + `open`) weil die Session sonst auf der alten IP bleibt.

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

### 🔗 Dashboard Auto-Tracking

**NACH jedem `sessions_spawn()` SOFORT die Dashboard-API callen:**

```bash
curl -X POST http://localhost:3002/api/agents/start \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"<childSessionKey>","label":"<label>","task":"<kurze_zusammenfassung_~80_zeichen>","prompt":"<kompletter_task_string_wie_an_subagent_geschickt>","model":"<model>"}'
```

**WICHTIG:** 
- `task` = Kurze, lesbare Beschreibung (max ~80 Zeichen, erste Zeile des Tasks)
- `prompt` = Der KOMPLETTE Task-String der an den Subagent geschickt wurde (kann lang sein!)
- Wenn kein separater Prompt übergeben wird, fällt die API auf `task` zurück

**Bei Completion (User-Message) den Agent beenden:**

```bash
curl -X POST http://localhost:3002/api/agents/end \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"<childSessionKey>","status":"done"|"failed"|"timeout","runtimeMs":<ms>}'
```

**Regel:** Kein `sessions_spawn()` ohne Dashboard-Tracking. Immer.

### Beispiel:
```javascript
// 1. Subagent spawnen
const fullTask = `Baue React Component mit TailwindCSS...
- Verwende Framer Motion für Animationen
- Implementiere Loading States
- Dark Mode Support`; // Kompletter Task kann lang sein!

const taskSummary = fullTask.split('\n')[0].substring(0, 80); // Erste Zeile, max 80 chars

const result = await sessions_spawn({
  runtime: "subagent",
  label: "Frontend Coder",
  task: fullTask, // Kompletten Task an Subagent schicken
  model: "qwen3-coder-next",
  mode: "run"
});

// 2. SOFORT Dashboard tracken - MIT PROMPT!
await exec(`curl -X POST http://localhost:3002/api/agents/start \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"${result.childSessionKey}","label":"Frontend Coder","task":"${taskSummary}","prompt":"${fullTask.replace(/"/g, '\\"')}","model":"qwen3-coder-next"}'`);

// 3. Session yield (optional, wenn auf Result gewartet wird)
await sessions_yield();

// 4. Completion kommt als User-Message → Dashboard beenden
await exec(`curl -X POST http://localhost:3002/api/agents/end \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"${result.childSessionKey}","status":"done","runtimeMs":${runtime}}'`);
```

---

Add whatever helps you do your job. This is your cheat sheet.
