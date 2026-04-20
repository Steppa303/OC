#!/bin/bash
# Update crontab with all jobs including new summary generator

cat << 'CRON' | crontab -
0 2 * * * /root/.openclaw/workspace/scripts/cleanup-agents.sh >> /var/log/agent-cleanup.log 2>&1
0 3 * * 0 bash /root/.openclaw/workspace/scripts/cleanup-chromadb-index.sh >> /tmp/chromadb-cleanup.log 2>&1
0 */3 * * * bash /root/.openclaw/workspace/scripts/monitor-chromadb-size.sh
*/5 * * * * /root/.openclaw/workspace/cron-background-service.sh
0 * * * * /root/.openclaw/workspace/cron-hourly-cleanup.sh
30 * * * * python3 /root/.openclaw/workspace/scripts/ingest-chat-sessions.py >> /tmp/chat-ingest.log 2>&1 && python3 /root/.openclaw/workspace/scripts/update-telegram-context.py >> /tmp/telegram-context.log 2>&1
0 5 * * * kill -TERM $(pgrep -f 'openclaw-gateway' | head -1) 2>/dev/null && logger -t telegram-restart 'Gateway restart triggered via SIGTERM'
*/5 * * * * /root/.openclaw/workspace/scripts/telegram-watchdog.sh >> /tmp/telegram-watchdog-cron.log 2>&1
0 */2 * * * python3 /root/.openclaw/workspace/scripts/generate-session-summaries.py >> /tmp/session-summary.log 2>&1
CRON

crontab -l
