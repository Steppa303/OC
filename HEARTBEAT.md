# HEARTBEAT.md

# MIDI Scraper Monitoring (alle 10 Min)
- Scraper PID: prüfen mit `ps aux | grep midi`
- Status: `tail -3 /tmp/midi-scraper-current.log`
- DB Stats: pending/done/failed counts
- User update senden wenn Fortschritt > 5% seit letztem Check

### Vorgehen:
1. `/tmp/midi-scraper-status.txt` lesen (wird alle 10 Min via Cron aktualisiert)
2. `memory/heartbeat-state.json` → `lastMidiUpdate` Timestamp checken
3. Wenn > 10 Min seit letztem Update → Status an Bastian senden (Telegram)
4. `lastMidiUpdate` auf aktuelle Zeit setzen
5. **NUR** wenn Scraper läuft und Fortschritt > 0% seit letztem Check

# Add tasks below when you want the agent to check something periodically.

---

## 🧠 Session Startup

**Beim Session-Start:**
1. `memorySearch` mit Query "letzte Session Zusammenfassung" → findet `memory/summaries/*.md`
2. Letztes Summary lesen → Kontext über Probleme, Lösungen, Entscheidungen
3. Daily-Datei lesen (`memory/YYYY-MM-DD.md`) → Telegram Context

---

## 📊 Agent Status Reports

**Intervall:** Alle 5 Minuten wenn Agents laufen

### Zu checken:
- [ ] `subagents action=list` — Welche Agents laufen gerade?
- [ ] Status aller aktiven Tasks (pending, running, done, failed)
- [ ] Laufzeit der Agents
- [ ] Gibt es Blocker/Errors?
- [ ] User über Fortschritt informieren

### Vorgehen:
1. Subagent-Status abrufen
2. Kurzen Status-Report an User senden (auch wenn "noch läuft")
3. Bei Fehlern: Sofort melden, nicht warten!

---

## 📡 Telegram Bot Monitoring

**Status:** ✅ ONLINE (seit 2026-04-20 ~11:15, Watchdog v8)
**Bot:** @ogLobster_bot (Bernd)
**Watchdog:** `*/5 * * * *` (alle 5 Min)
**Script:** `/root/.openclaw/workspace/scripts/telegram-watchdog.sh` (v8)
**Log:** `/tmp/telegram-watchdog.log`

### Checks (v8):
1. Gateway Health (`/health` endpoint)
2. Telegram API reachable (getMe via IPv4)
3. Bot responsive (sendMessage test)

### Auto-Restart:
- Bei Gateway-Fail: `kill -TERM` + systemd auto-restart
- Bei Telegram-Fail: Gateway restart nach 2 Min Persistenz

### Cron-Jobs:
- `*/5 * * * *` – Telegram Watchdog (alle 5 Min)
- `0 5 * * *` – Daily Gateway Restart (früh 5 Uhr, via SIGTERM)

---

## 🎨 Bildgenerierung – qwen-image-2.0-pro (20.05.2026)
**Script:** `/root/.openclaw/workspace/scripts/qwen-image-gen.sh`
**API:** Alibaba Bailian Token Plan (Multimodal Chat API)
**API Key:** `/root/.openclaw/workspace/.secrets/bailian.env`

### Rollen-Verteilung:
- **Bilder:** qwen-image-2.0-pro (Alibaba)
- **Videos:** Gemini (Google) – NUR Videos!
- Gemini NICHT mehr für Bilder verwenden!

### NANO_SCRIPT nicht mehr verwenden!
Das alte nano-banana-pro.sh (Gemini für Bilder) wird nicht mehr genutzt.

---

## 📦 Archivierte Projekte
- **HaterBernd** — 2026-07-04 archiviert nach `archived/haterbernd-20260704.tar.gz`

---

# Email Check entfernt (AgentMail nicht konfiguriert)
# Bei Bedarf: AGENTMAIL_API_KEY setzen und Aufgabe wieder aktivieren
