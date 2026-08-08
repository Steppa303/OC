#!/bin/bash

# MIDI Scraper Monitoring Script with Telegram alerts
# Checks progress every 10 minutes, sends Telegram updates if >0% new progress and scraper running

# Paths
STATUS_FILE="/tmp/midi-scraper-status.txt"
HEARTBEAT_STATE="/root/.local/.openclaw/workspace/memory/heartbeat-state.json"
OPENCLAW_CONFIG="/root/.openclaw/openclaw.json"
LOG_FILE="/tmp/midi-scraper-check.log"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Get bot token from OpenClaw config
if [ -f "$OPENCLAW_CONFIG" ]; then
    BOT_TOKEN=$(jq -r '.channels.telegram.botToken' "$OPENCLAW_CONFIG" 2>/dev/null)
else
    BOT_TOKEN=""
fi

# Chat ID from MEMORY.md (Bastian's direct chat)
CHAT_ID="1400987471"

# Check if scraper is running (look for midi process)
SCRAPER_PID=$(pgrep -f "midi" | head -1)
if [ -z "$SCRAPER_PID" ]; then
    SCRAPER_RUNNING=false
else
    SCRAPER_RUNNING=true
fi

# Read current status from status file
if [ -f "$STATUS_FILE" ]; then
    # Extract the done count from a line like: "- ✅ **Done:** 20,046 (95.8%)"
    CURRENT_DONE=$(grep -i "^\s*- ✅ \*\*Done:" "$STATUS_FILE" | sed -E 's/.*\*\*Done:\*\*[^0-9]*([0-9,]+).*/\1/' | tr -d ',')
    # Also get total if needed for percentage
    TOTAL=$(grep -i "^\s*- \*\*Total:" "$STATUS_FILE" | sed -E 's/.*\*\*Total:\*\*[^0-9]*([0-9,]+).*/\1/' | tr -d ',')
else
    CURRENT_DONE=0
    TOTAL=0
fi

# Initialize heartbeat state if not exists
if [ ! -f "$HEARTBEAT_STATE" ]; then
    echo '{"lastMidiUpdate": 0, "lastDoneCount": 0}' > "$HEARTBEAT_STATE"
fi

# Read last state
LAST_UPDATE=$(jq -r '.lastMidiUpdate // 0' "$HEARTBEAT_STATE")
LAST_DONE=$(jq -r '.lastDoneCount // 0' "$HEARTBEAT_STATE")
CURRENT_TIME=$(date +%s)

# Time since last update in seconds
TIME_DIFF=$((CURRENT_TIME - LAST_UPDATE))

# Calculate increment
INCREMENT=$((CURRENT_DONE - LAST_DONE))
# Ensure non-negative (in case of reset)
if [ $INCREMENT -lt 0 ]; then
    INCREMENT=0
fi

# Determine if we should send a Telegram update
SEND_UPDATE=false
if [ "$SCRAPER_RUNNING" = true ] && [ $TIME_DIFF -gt 600 ]; then
    # More than 10 minutes since last update
    if [ $INCREMENT -gt 0 ]; then
        # There has been progress
        SEND_UPDATE=true
    fi
fi

# Send Telegram update if needed
if [ "$SEND_UPDATE" = true ] && [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
    # Calculate percentage if we have total
    if [ "$TOTAL" -gt 0 ]; then
        PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($CURRENT_DONE * 100) / $TOTAL}")
        PERCENTAGE_STR=" ($PERCENTAGE%)"
    else
        PERCENTAGE_STR=""
    fi
    
    MESSAGE="🎹 *MIDI Scraper Update* 
Scraper PID: $SCRAPER_PID
Progress: $CURRENT_DONE$PERCENTAGE_STR
New since last update: +$INCREMENT files
Time since last check: $(($TIME_DIFF / 60)) minutes
Status: $(tail -1 "$STATUS_FILE")"
    
    # Send via Telegram Bot API
    curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
        -d chat_id="$CHAT_ID" \
        -d text="$MESSAGE" \
        -d parse_mode="Markdown" >/dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        log "Sent Telegram update: +$INCREMENT files"
    else
        log "Failed to send Telegram update"
    fi
fi

# Update heartbeat state with current done count and timestamp
jq --argjson current_time "$CURRENT_TIME" --argjson current_done "$CURRENT_DONE" \
   '.lastMidiUpdate = $current_time | .lastDoneCount = $current_done' \
   "$HEARTBEAT_STATE" > "/tmp/heartbeat-state.tmp" && mv "/tmp/heartbeat-state.tmp" "$HEARTBEAT_STATE"

log "Check complete. Scraper running: $SCRAPER_RUNNING, Done: $CURRENT_DONE, Last done: $LAST_DONE, Increment: $INCREMENT, Time diff: $TIME_DIFF sec"

# Keep log file from growing too large
if [ $(wc -l < "$LOG_FILE") -gt 100 ]; then
    tail -50 "$LOG_FILE" > "/tmp/midi-scraper-check.log.tmp" && mv "/tmp/midi-scraper-check.log.tmp" "$LOG_FILE"
fi