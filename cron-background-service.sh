#!/bin/bash
# Background Service für Auto Agent Logging
# Wird alle 5 Minuten ausgeführt

cd /root/.openclaw/workspace

# Setze Umgebungsvariablen
export NODE_ENV=production

# Führe den Auto-Agent-Logging-Service aus
node lib/auto-agent-logging.mjs >> /var/log/auto-agent-logging.log 2>&1

echo "$(date): Background service check completed"