#!/bin/bash
# Agent Database Cleanup Script
# Cleans up old agents and fixes stuck agents

DB_HOST="localhost"
DB_USER="webapp"
DB_NAME="webapp_db"
DB_PASS="db#Jungle68"

export PGPASSWORD="$DB_PASS"

echo "🧹 Starting Agent Cleanup..."
echo "=============================="

# Alte Agents löschen (>7 Tage, done/failed)
echo "🗑️ Lösche alte Agents (>7 Tage)..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
DELETE FROM agent_activities 
WHERE started_at < NOW() - INTERVAL '7 days'
AND status IN ('done', 'failed');
"

# Hängende Agents korrigieren (länger als 2h auf "running")
# WICHTIG: Nur WIRKLICH hängende Agents (nicht erfolgreiche die vergessen wurden!)
echo "⚠️ Korrigiere hängende Agents (>2h)..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
UPDATE agent_activities 
SET status = 'timeout', 
    ended_at = started_at + INTERVAL '2 hours',
    error_message = 'Auto-timeout: Agent took too long (2h)'
WHERE status IN ('running', 'pending') 
AND started_at < NOW() - INTERVAL '2 hours'
AND error_message IS NULL;
"

# Stats anzeigen
echo ""
echo "📊 Current Status:"
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT status, COUNT(*) as count 
FROM agent_activities 
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY status 
ORDER BY count DESC;
"

echo ""
echo "✅ Cleanup complete!"
