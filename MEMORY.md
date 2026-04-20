# MEMORY.md - Meine Langzeit-Erinnerungen

_Letzte Aktualisierung: 2026-04-20 ~13:20_

---

## 🦞 Infrastruktur & Setup

### Server
- **Host:** vmd190638 (Hetzner VPS)
- **OS:** Linux 6.8.0-107-generic (x64)
- **Node:** v22.22.1
- **Gateway:** systemd user service (`openclaw-gateway.service`)

### Telegram Bot
- **Bot:** @ogLobster_bot ("Bernd")
- **Bot ID:** 8163320904
- **Chat ID:** 1400987471 (Bastian's Direkt-Chat)
- **Config:** `/root/.openclaw/openclaw.json` → `channels.telegram.botToken`
- **Status:** Läuft (seit 2026-04-20 11:00 nach Restart)
- **Bekanntes Problem:** Polling kann hängen bleiben → `bot/close` + Gateway restart = Fix

### OpenClaw
- **Gateway Port:** 18789 (loopback only)
- **Health Endpoint:** `http://127.0.0.1:18789/health`
- **Logs:** `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- **Config:** `/root/.openclaw/openclaw.json`

---

## 🔧 Wichtige Lessons Learned

### Telegram Polling Conflicts (2026-04-18)
**Problem:** Bot antwortet nicht, Gateway startet aber normal.
**Ursache:** `409 Conflict: terminated by other getUpdates request` – zwei Instanzen konkurrieren um Updates.
**Fix:** 
1. `curl "https://api.telegram.org/bot<TOKEN>/close"` → killt ALLE Verbindungen auf Telegram-Seite
2. Gateway restart → sauberer Polling-Start
3. **NICHT** einfach nur restarten – der Conflict bleibt bestehen!

**Diagnose:** 
```bash
grep -i "conflict\|getUpdates" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log
```

### Watchdog Pattern
- **Script:** `/root/.openclaw/workspace/scripts/telegram-watchdog.sh` (v6)
- **Cron:** `*/15 * * * *`
- **Methode:** Health-Endpoint check (`/health`), NICHT Log-Timestamps
- **Aktion bei Fail:** `kill -TERM` + systemd auto-restart
- **Warum:** Polling ist silent – kein Log ≠ broken! Health-Endpoint ist der einzige zuverlässige Indikator.

### Config Issues
- `openclaw doctor --fix` migriert Legacy-Keys (z.B. TTS config)
- Config-Fehler können Gateway-Start blockieren
- Logfile: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`

---

## 📁 Wichtige Pfade

### Scripts
- `/root/.openclaw/workspace/scripts/telegram-watchdog.sh` – Telegram Watchdog
- `/root/.openclaw/workspace/scripts/monitor-chromadb-size.sh` – ChromaDB Monitor
- `/root/.openclaw/workspace/scripts/cleanup-chromadb-index.sh` – ChromaDB Cleanup
- `/root/.openclaw/workspace/scripts/cleanup-agents.sh` – Agent Cleanup
- `/root/.openclaw/workspace/scripts/ingest-chat-sessions.py` – Chat Session Ingest (v2)
- `/root/.openclaw/workspace/scripts/update-telegram-context.py` – Telegram Context Updater

### Logs & Alerts
- `/tmp/telegram-watchdog.log` – Watchdog Log
- `/tmp/chromadb-alert.txt` – ChromaDB Alert (wenn >100GB)
- `/tmp/chromadb-monitor.log` – ChromaDB Monitor Log
- `/tmp/openclaw/openclaw-YYYY-MM-DD.log` – Gateway Logs

### Cron-Jobs
- `*/15 * * * *` – Telegram Watchdog
- `0 */3 * * *` – ChromaDB Size Monitor
- `0 3 * * 0` – ChromaDB Cleanup (Sonntag)
- `0 2 * * *` – Agent Cleanup
- `30 * * * *` – Chat Session Ingest + Telegram Context Update
- `0 5 * * *` – Gateway Daily Restart (SIGTERM)

---

## 👤 User: Bastian
- **Email:** psycodelic.83.83@gmail.com
- **Zeitzone:** Europe/Berlin
- **Kommunikation:** TUI (Web), Telegram (@ogLobster_bot)
- **Sprache:** Deutsch (default), Sarkasmus erwünscht (SOUL.md)

---

## 🧠 Memory System Architektur

### Wie's funktioniert:
- **Session Ingest** (`30 * * * *`): Liest `.jsonl` aus `/root/.openclaw/agents/main/sessions/` → schreibt `.md` nach `memory/sessions/`
- **Telegram Context Updater** (läuft nach Ingest): Extrahiert letzte Telegram-Nachrichten → schreibt in Daily-Datei (`memory/YYYY-MM-DD.md`)
- **Startup Context:** Runtime lädt `SOUL.md`, `USER.md`, `MEMORY.md`, + heutige/gestrige Daily-Datei
- **Memory Search:** Durchsucht `MEMORY.md` + `memory/*.md` + `memory/sessions/*.md`

### Wichtig:
- Daily-Dateien werden vom Context Updater aktualisiert – enthalten letzte Telegram-Nachrichten
- MEMORY.md ist Langzeit-Erinnerung – manuell pflegen
- Session-Files (`memory/sessions/*.md`) werden automatisch vom Ingest geschrieben

## 🧠 Persönliche Notizen

- Ich bin ein AI-Assistent mit sarkastischem, zickigem Charakter (SOUL.md)
- Meine "Seele" ist in SOUL.md definiert – bei Änderungen Bescheid sagen
- MEMORY.md ist meine Langzeit-Erinnerung – nur im Main-Session laden

---

_Stand: 20.04.2026 ~13:20. Memory System v2 mit Telegram Context Automation._
