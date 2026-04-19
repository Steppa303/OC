#!/bin/bash
# Telegram Watchdog v7 - Dual-layer check
#
# Layer 1: Gateway health endpoint (/health)
# Layer 2: Telegram API reachability (getMe via IPv4)
# Layer 3: Check last received update from Telegram API
#
# If gateway is healthy BUT Telegram API is unreachable → Network issue
# If gateway is healthy AND Telegram reachable BUT no recent updates → Polling dead → restart
#
# Cron: */5 * * * *

BOT_TOKEN="8163320904:AAGn7O2IZu944JvUSHmIoUWqEfHMZN3nCQ4"
CHAT_ID="1400987471"
WATCHDOG_LOG="/tmp/telegram-watchdog.log"
ALERT_STATE="/tmp/.telegram-watchdog-state"

echo "[$(date)] Check..." >> "$WATCHDOG_LOG"

# --- Layer 1: Gateway Health ---
GW_PID=$(pgrep -f "openclaw-gateway" | head -1)
if [ -z "$GW_PID" ]; then
  echo "[$(date)] ALERT: Gateway NOT running! Restarting..." >> "$WATCHDOG_LOG"
  systemctl --user restart openclaw-gateway 2>/dev/null
  rm -f "$ALERT_STATE"
  exit 0
fi

HEALTH=$(curl -s --connect-timeout 5 --max-time 10 "http://127.0.0.1:18789/health" 2>/dev/null)
if ! echo "$HEALTH" | grep -q '"ok":true'; then
  echo "[$(date)] ALERT: Gateway health FAILED! Restarting..." >> "$WATCHDOG_LOG"
  kill -TERM "$GW_PID" 2>/dev/null
  sleep 3
  systemctl --user start openclaw-gateway 2>/dev/null
  rm -f "$ALERT_STATE"
  exit 0
fi

echo "[$(date)] OK: Gateway healthy (PID $GW_PID)" >> "$WATCHDOG_LOG"

# --- Layer 2: Telegram API Reachability ---
TG_RESPONSE=$(curl -4 -s --connect-timeout 10 --max-time 15 \
  "https://api.telegram.org/bot${BOT_TOKEN}/getMe" 2>/dev/null)
if ! echo "$TG_RESPONSE" | grep -q '"ok":true'; then
  echo "[$(date)] ALERT: Telegram API unreachable via IPv4! Gateway healthy but can't reach Telegram." >> "$WATCHDOG_LOG"
  echo "[$(date)] Response: $TG_RESPONSE" >> "$WATCHDOG_LOG"
  # Don't restart yet - might be transient. Only restart if persistent.
  LAST_ALERT=$(cat "$ALERT_STATE" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  DIFF=$((NOW - LAST_ALERT))
  if [ "$DIFF" -gt 600 ]; then
    echo "[$(date)] ALERT persisted >10min, restarting gateway..." >> "$WATCHDOG_LOG"
    kill -TERM "$GW_PID" 2>/dev/null
    sleep 3
    systemctl --user start openclaw-gateway 2>/dev/null
  fi
  echo "$NOW" > "$ALERT_STATE"
  exit 0
fi

echo "[$(date)] OK: Telegram API reachable" >> "$WATCHDOG_LOG"

# --- Layer 3: Check last update age ---
# Use getUpdates with offset=-1 to get the most recent update
UPDATES=$(curl -4 -s --connect-timeout 10 --max-time 15 \
  "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1&limit=1" 2>/dev/null)

if echo "$UPDATES" | grep -q '"ok":true'; then
  # Extract update_id and date from the last update
  LAST_UPDATE=$(echo "$UPDATES" | python3 -c "
import json, sys
data = json.load(sys.stdin)
results = data.get('result', [])
if results:
    u = results[-1]
    msg = u.get('message', u.get('edited_message', {}))
    date = msg.get('date', 0)
    chat = msg.get('chat', {}).get('id', 'unknown')
    print(f'{date}|{chat}')
else:
    print('no_updates|0')
" 2>/dev/null)

  if [ -n "$LAST_UPDATE" ] && [ "$LAST_UPDATE" != "no_updates|0" ]; then
    LAST_DATE=$(echo "$LAST_UPDATE" | cut -d'|' -f1)
    LAST_CHAT=$(echo "$LAST_UPDATE" | cut -d'|' -f2)
    NOW=$(date +%s)
    AGE=$((NOW - LAST_DATE))
    AGE_MIN=$((AGE / 60))

    echo "[$(date)] Last update: $AGE_MIN min ago (chat=$LAST_CHAT)" >> "$WATCHDOG_LOG"

    if [ "$AGE" -gt 900 ]; then
      echo "[$(date)] ALERT: No Telegram updates for >15 min! Polling may be dead. Restarting..." >> "$WATCHDOG_LOG"
      kill -TERM "$GW_PID" 2>/dev/null
      sleep 3
      systemctl --user start openclaw-gateway 2>/dev/null
      rm -f "$ALERT_STATE"
    fi
  else
    echo "[$(date)] No updates received yet (bot might be fresh)" >> "$WATCHDOG_LOG"
  fi
else
  echo "[$(date)] WARN: Could not check updates (possible conflict with active polling)" >> "$WATCHDOG_LOG"
fi

# Clear alert state on successful check
rm -f "$ALERT_STATE"
