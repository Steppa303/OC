#!/bin/bash
# Telegram Watchdog v8 - Direct Bot Response Test
#
# Layer 1: Gateway health endpoint
# Layer 2: Telegram API reachable
# Layer 3: DIRECT TEST - sendMessage to owner chat. If fails → Bot dead → restart
#
# Cron: */5 * * * *

BOT_TOKEN="8163320904:AAGn7O2IZu944JvUSHmIoUWqEfHMZN3nCQ4"
CHAT_ID="1400987471"
WATCHDOG_LOG="/tmp/telegram-watchdog.log"
ALERT_STATE="/tmp/.telegram-watchdog-state"

log() {
  echo "[$(date)] $1" >> "$WATCHDOG_LOG"
}

log "Check v8..."

# --- Layer 1: Gateway Health ---
GW_PID=$(pgrep -f "openclaw-gateway" | head -1)
if [ -z "$GW_PID" ]; then
  log "ALERT: Gateway NOT running! Restarting..."
  systemctl --user restart openclaw-gateway 2>/dev/null
  rm -f "$ALERT_STATE"
  exit 0
fi

HEALTH=$(curl -s --connect-timeout 5 --max-time 10 "http://127.0.0.1:18789/health" 2>/dev/null)
if ! echo "$HEALTH" | grep -q '"ok":true'; then
  log "ALERT: Gateway health FAILED! Restarting..."
  kill -TERM "$GW_PID" 2>/dev/null
  sleep 3
  systemctl --user start openclaw-gateway 2>/dev/null
  rm -f "$ALERT_STATE"
  exit 0
fi

log "OK: Gateway healthy (PID $GW_PID)"

# --- Layer 2: Telegram API Reachability ---
TG_ME=$(curl -4 -s --connect-timeout 10 --max-time 15 \
  "https://api.telegram.org/bot${BOT_TOKEN}/getMe" 2>/dev/null)
if ! echo "$TG_ME" | grep -q '"ok":true'; then
  log "ALERT: Telegram API unreachable via IPv4!"
  LAST_ALERT=$(cat "$ALERT_STATE" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  DIFF=$((NOW - LAST_ALERT))
  if [ "$DIFF" -gt 300 ]; then
    log "ALERT persisted >5min, restarting gateway..."
    kill -TERM "$GW_PID" 2>/dev/null
    sleep 3
    systemctl --user start openclaw-gateway 2>/dev/null
  fi
  echo "$NOW" > "$ALERT_STATE"
  exit 0
fi

log "OK: Telegram API reachable"

# --- Layer 3: DIRECT BOT TEST - sendChatAction ---
# Tests if bot can communicate with Telegram without sending a visible message
TG_SEND=$(curl -4 -s --connect-timeout 10 --max-time 15 \
  -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": \"$CHAT_ID\", \"action\": \"typing\"}" 2>/dev/null)

if echo "$TG_SEND" | grep -q '"ok":true'; then
  log "OK: Bot responsive (sendMessage succeeded)"
  rm -f "$ALERT_STATE"
  exit 0
fi

# sendMessage failed! Bot polling is likely dead.
ERROR=$(echo "$TG_SEND" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('description','unknown'))" 2>/dev/null || echo "$TG_SEND")
log "ALERT: sendMessage FAILED! Bot polling likely dead. Error: $ERROR"

# Don't restart immediately - check if it's a transient error
LAST_ALERT=$(cat "$ALERT_STATE" 2>/dev/null || echo "0")
NOW=$(date +%s)
DIFF=$((NOW - LAST_ALERT))

if [ "$DIFF" -gt 120 ]; then
  log "Alert persisted >2min, restarting gateway..."
  kill -TERM "$GW_PID" 2>/dev/null
  sleep 3
  systemctl --user start openclaw-gateway 2>/dev/null
  log "ACTION: Gateway restart triggered"
  rm -f "$ALERT_STATE"
else
  log "Waiting 2min before restart (alert at $LAST_ALERT, now $NOW, diff=${DIFF}s)"
fi

echo "$NOW" > "$ALERT_STATE"
