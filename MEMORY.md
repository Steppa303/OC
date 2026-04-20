# MEMORY.md - Meine Langzeit-Erinnerungen

_Letzte Aktualisierung: 2026-04-20 ~16:45_

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
- **Status:** ✅ Stabil seit 2026-04-20 11:00 (Watchdog v8)
- **Watchdog v8:** Alle 5 Min Check (Gateway Health + Telegram API + sendMessage Test)
- **Bekannte Issues:** `sendChatAction failed`, `EFFECT_ID_INVALID` → Gateway restart behebt

### OpenClaw
- **Gateway Port:** 18789 (loopback only)
- **Health Endpoint:** `http://127.0.0.1:18789/health`
- **Logs:** `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- **Config:** `/root/.openclaw/openclaw.json`

---

## 🔧 Wichtige Lessons Learned

### Telegram Polling Conflicts (2026-04-18 bis 2026-04-20)
**Problem:** Bot antwortet nicht, Gateway startet aber normal.
**Ursachen (mehrere):**
1. `409 Conflict` – zwei Instanzen konkurrieren (18.04.)
2. `sendChatAction failed: Network request` (20.04.)
3. `EFFECT_ID_INVALID` – sendMessage fehlerhaft (20.04.)

**Fixes:**
1. `curl "https://api.telegram.org/bot<TOKEN>/close"` → killt ALLE Verbindungen auf Telegram-Seite
2. Gateway restart (`kill -TERM` + systemd auto-restart)
3. Watchdog v8 erkennt Issues automatisch und restarted

**Watchdog v8 Logik:**
- Check 1: Gateway Health (`/health` endpoint)
- Check 2: Telegram API reachable (getMe via IPv4)
- Check 3: Bot responsive (sendMessage Test)
- Bei Fail >2 Min: Gateway restart via `kill -TERM`

**Diagnose:** 
```bash
grep -i "conflict\|getUpdates" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log
```

### Watchdog Pattern
- **Script:** `/root/.openclaw/workspace/scripts/telegram-watchdog.sh` (v8)
- **Cron:** `*/5 * * * *` (alle 5 Minuten)
- **Checks:** 1) Gateway Health, 2) Telegram API reachable, 3) sendMessage Test
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
- `*/5 * * * *` – Telegram Watchdog (v8, alle 5 Min)
- `0 */3 * * *` – ChromaDB Size Monitor
- `0 3 * * 0` – ChromaDB Cleanup (Sonntag)
- `0 2 * * *` – Agent Cleanup
- `30 * * * *` – Chat Session Ingest + Telegram Context Update
- `0 */2 * * *` – Session Summary Generator
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

_Stand: 20.04.2026 ~16:45. Telegram Bot stabil (Watchdog v8), Memory System v2._

---

## 📅 Heute (20.04.2026) - Wichtige Events

### Telegram Bot Issues (Tag 5)
- **10:46:** Gateway restarted nach sendChatAction failed Errors
- **11:00:** Watchdog v8 detected `EFFECT_ID_INVALID` → auto-restart
- **11:15:** Watchdog v8 bestätigt: Bot responsive ✅
- **Status seit 11:15:** Bot stabil online, sendMessage succeeded
- **Watchdog v8:** Checkt alle 5 Min (Gateway Health + API + sendMessage)

### HEARTBEAT.md Updated
- Telegram Bot Monitoring Section added
- Alle Cron-Jobs dokumentiert
- Watchdog v8 Logic beschrieben

### Memory System
- Session Ingest: 15:30 Uhr gelaufen ✅
- 213 Session-Files in memory/sessions/
- Telegram Context Automation aktiv

### User Status
- Bastian ist offline gegangen (~14:45)
- Kommt später wieder
