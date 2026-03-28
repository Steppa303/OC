# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

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

## 📈 ChromaDB Monitoring

**Intervall:** Alle 3 Stunden (via Cron-Job)

### Automatischer Check:
- ✅ Script: `/root/.openclaw/workspace/scripts/monitor-chromadb-size.sh`
- ✅ Cron: `0 */3 * * *` (alle 3 Stunden)
- ✅ Alert wenn >100GB: `/tmp/chromadb-alert.txt`
- ✅ Logfile: `/tmp/chromadb-monitor.log`

### Bei Alert (>100GB):
1. User informieren (Alert-Datei wird bei Session-Start gelesen)
2. Cleanup empfehlen: `rm -rf /root/.openclaw/chroma_db/*/link_lists.bin`
3. Automatischen Cleanup prüfen (jeden Sonntag 3:00)

---

# Email Check entfernt (AgentMail nicht konfiguriert)
# Bei Bedarf: AGENTMAIL_API_KEY setzen und Aufgabe wieder aktivieren
