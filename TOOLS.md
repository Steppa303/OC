# TOOLS.md - Local Notes

## 🦞 Lesestoff — Anti-Halluzination Plan (24.06.2026)

**Entscheidung:** XTTSv2 bleiben, kein GPT-SoVITS-Wechsel.
**Strategie:** 3-Stufen-Plan gegen XTTS-Halluzinationen.
**Doku:** `projects/lesestoff/HANDOVER.md` → Section 13

### Stufe 1: Seed fixieren (sofort)
- `render.py`: `torch.manual_seed(42)`, `np.random.seed(42)`, `random.seed(42)`
- Vor TTS-Initialisierung setzen
- Killt zufällige Prosodie-Halluzinationen

### Stufe 2: RNNoise Post-Processing (failed with arnndn, using noisereduce)
- `noisereduce` Python-Bibliothek installiert (`pip install noisereduce`)
- `render.py`: Post-Processing mit `reduce_noise()` nach XTTS-Render
- Filtert Vocoder-Noise-Floor + leises Babbling

### Stufe 3: Whisper-Timestamped Hallucination Trimmer
- `whisper-timestamped` → Wort-Timestamps → Input-Text-Match → cutten
- Nuklearoption für hartnäckige Fälle

### Referenz-Stimme
- **Aktuelle Default-Referenz:** `referenz_hoffmann.wav`
- **Pfad in Queue-Service:** `/srv/lesestoff/tts_audio/xtts_reference.wav`
- **Hoffmann-Stimme** ersetzt die alte Thorsten-Referenz (24.06.2026)

**Prinzip:** Ich delegiere, bleibe aber ansprechbar.

**Quick-Fix:** Ich mach's selbst.
**Complex Task:** `sessions_spawn()` → Subagent arbeitet im Hintergrund → ich bin frei.
**Riesen-Projekt:** Orchestrator-Subagent managed mehrere Worker.

Details in `AGENTS.md` → ⛓️ Chain of Command.

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

## 😈 HaterBernd — ARCHIVIERT (04.07.2026)

**Status:** 🗄️ Projekt archiviert und deaktiviert.
**Archiv:** `archived/haterbernd-20260704.tar.gz`

Instagram-Automation (toxische Biohacking/Alpha-Grind-Persona) via instagrapi.
Wurde am 04.07.2026 sauber archiviert. Alle Cron-Jobs entfernt.
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

## 🎯 Subagent Workflow

**Prinzip:** Ich bleibe ansprechbar. Subagents arbeiten im Hintergrund.

Siehe `AGENTS.md` → ⛓️ Chain of Command für:
- Task-Typen (Quick-Fix / Worker / Projekt)
- Model-Auswahl
- Timeout-Regeln
- Ablauf

**Kurzform:**
```javascript
// Komplexen Task an Subagent delegieren
await sessions_spawn({
  runtime: "subagent",
  label: "Worker",
  task: `...`,
  model: "openrouter/auto",  // oder explizit
  mode: "run"
});

// Ich bin frei für den nächsten Task
// Subagent meldet sich wenn fertig
```

---

Add whatever helps you do your job. This is your cheat sheet.
