#!/bin/bash
# Continuous Agent Cleanup Service
# Runs cleanup every 5 minutes to prevent stuck agents

while true; do
    echo "$(date): Running agent cleanup..."
    /root/.openclaw/workspace/scripts/cleanup-agents.sh
    echo "$(date): Cleanup completed, sleeping for 5 minutes..."
    sleep 300
done