#!/bin/bash
# Stündlicher Cleanup-Script für alte Agent-Einträge
# Entfernt Agent-Einträge älter als 7 Tage

cd /root/.openclaw/workspace

# Setze Umgebungsvariablen
export PGPASSWORD='db#Jungle68'

# Lösche Agent-Einträge älter als 7 Tage
psql -h localhost -U webapp -d webapp_db -c "DELETE FROM agent_activities WHERE started_at < NOW() - INTERVAL '7 days';" >> /var/log/agent-cleanup.log 2>&1

echo "$(date): Hourly cleanup completed"