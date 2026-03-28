# Troubleshooting Guide - Agent Monitoring System

## Häufige Probleme & Lösungen

### 1. Agent wird nicht als "done" geloggt

**Problem:** Agent beendet sich normal, aber Status bleibt "running"

**Lösungen:**
- Stellen Sie sicher, dass `completeAgent('done')` am Ende des Agent-Codes aufgerufen wird
- Überprüfen Sie die API-Verbindung: `curl -I http://localhost:3002/health`
- Prüfen Sie die Logs: `tail -f /var/log/auto-agent-logging.log`
- Manuelle Status-Änderung über API: `curl -X POST http://localhost:3002/api/agents/end -H "Content-Type: application/json" -d '{"sessionKey":"<session-key>","status":"done","runtimeMs":0}'`

### 2. Agent wird fälschlicherweise als "timeout" markiert

**Problem:** Agent ist fertig, aber Status wurde auf "timeout" gesetzt

**Lösungen:**
- Prüfen Sie, ob `completeAgent()` tatsächlich aufgerufen wurde
- Überprüfen Sie die Laufzeit des Agents - wenn >60min (Standard), wird er als timeout markiert
- Passen Sie den `timeoutThreshold` Parameter an: `/api/agents?timeoutThreshold=120`
- Prüfen Sie, ob der Agent nach Abschluss noch lange läuft (Cleanup-Code)

### 3. API antwortet nicht oder gibt Fehler zurück

**Problem:** `/api/agents` Endpoint funktioniert nicht

**Lösungen:**
- Prüfen Sie den API-Server-Status: `ps aux | grep node` (nach dem Server-Prozess suchen)
- Prüfen Sie die Datenbankverbindung: `psql -h localhost -U webapp -d webapp_db -c "SELECT COUNT(*) FROM agent_activities;"`
- Prüfen Sie die API-Logs auf Fehler
- Stellen Sie sicher, dass die Umgebungsvariablen korrekt gesetzt sind

### 4. Background Service läuft nicht ordnungsgemäß

**Problem:** Cron-Job läuft, aber keine Agent-Überwachung erfolgt

**Lösungen:**
- Prüfen Sie den Cron-Log: `grep -i "cron-background-service" /var/log/syslog`
- Überprüfen Sie die Service-Log-Datei: `tail -f /var/log/auto-agent-logging.log`
- Stellen Sie sicher, dass das Skript ausführbar ist: `ls -la /root/.openclaw/workspace/cron-background-service.sh`
- Testen Sie den Service manuell: `node lib/auto-agent-logging.mjs`

### 5. Datenbankverbindungsprobleme

**Problem:** Queries schlagen fehl oder Antworten sind langsam

**Lösungen:**
- Prüfen Sie die Datenbankverbindung: `psql -h localhost -U webapp -d webapp_db -c "SELECT 1;"`
- Prüfen Sie die PostgreSQL-Logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`
- Stellen Sie sicher, dass die Credentials stimmen: `/root/.openclaw/workspace/lib/auto-agent-logging.mjs`
- Prüfen Sie den Speicherplatz: `df -h` (PostgreSQL braucht freien Speicherplatz)

### 6. Cron-Jobs werden nicht ausgeführt

**Problem:** Cron-Jobs erscheinen in der Liste, aber werden nicht ausgeführt

**Lösungen:**
- Prüfen Sie den Cron-Daemon: `sudo systemctl status cron`
- Überprüfen Sie die Cron-Logs: `grep CRON /var/log/syslog | tail -20`
- Stellen Sie sicher, dass das Skript vollständig pfadqualifiziert ist
- Prüfen Sie die Berechtigungen: `crontab -l` (zeigt aktuelle Jobs)
- Testen Sie das Skript manuell: `/root/.openclaw/workspace/cron-background-service.sh`

## Diagnose-Befehle

### Allgemeiner Status
```bash
# API Health Check
curl http://localhost:3002/health

# Datenbankverbindung testen
psql -h localhost -U webapp -d webapp_db -c "SELECT COUNT(*) FROM agent_activities WHERE started_at > NOW() - INTERVAL '1 hour';"

# Aktuelle laufende Agents
psql -h localhost -U webapp -d webapp_db -c "SELECT session_key, label, started_at FROM agent_activities WHERE status = 'running' ORDER BY started_at DESC;"
```

### Log-Dateien überwachen
```bash
# Live-Überwachung aller relevanten Logs
tail -f /var/log/auto-agent-logging.log /var/log/agent-cleanup.log

# Letzte 20 Einträge in allen Logs
tail -20 /var/log/auto-agent-logging.log /var/log/agent-cleanup.log
```

### Cron-Job-Status
```bash
# Alle aktuellen Cron-Jobs anzeigen
crontab -l

# Cron-Dienst Status
sudo systemctl status cron

# Cron-Logs überprüfen
grep "CRON.*cron-background-service\|CRON.*cron-hourly-cleanup" /var/log/syslog
```

## Notfallmaßnahmen

### Sofortige Agent-Status-Korrektur
Wenn ein Agent falsch als "running" oder "timeout" markiert ist:

```bash
# Manuell auf "done" setzen
curl -X POST http://localhost:3002/api/agents/end \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"<session-key>","status":"done","runtimeMs":0,"errorMessage":null}'

# Manuell auf "failed" setzen
curl -X POST http://localhost:3002/api/agents/end \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"<session-key>","status":"failed","runtimeMs":0,"errorMessage":"Manuelle Korrektur"}'
```

### Notfall-Stop für hängende Agents
Wenn viele Agents hängen und manuell korrigiert werden müssen:

```bash
# Alle Agents, die länger als 2 Stunden laufen, als timeout markieren
psql -h localhost -U webapp -d webapp_db -c "
UPDATE agent_activities 
SET status = 'timeout', 
    ended_at = started_at + INTERVAL '2 hours',
    error_message = 'Emergency timeout: Force marked due to hanging agents'
WHERE status = 'running' 
AND started_at < NOW() - INTERVAL '2 hours';
"
```

### API-Neustart
Wenn die API nicht mehr reagiert:

```bash
# Finden Sie den API-Prozess
ps aux | grep "node.*api.mjs"

# Beenden Sie den Prozess (ersetzen Sie PID durch tatsächliche Prozess-ID)
kill -9 <PID>

# Starten Sie den API-Server neu
cd /root/.openclaw/workspace && node agent-dashboard/api.mjs &
```