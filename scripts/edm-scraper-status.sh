#!/bin/bash
# EDM Scraper Status Check - alle 10 Minuten

PROJECT="/root/.openclaw/workspace/projects/edm-scraper"
STATUS_FILE="/tmp/edm-scraper-status.txt"

if [ ! -d "$PROJECT" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') | PROJECT NOT FOUND" > "$STATUS_FILE"
    exit 0
fi

# Check if scraper is running
PID=$(pgrep -f "edm-scraper\|edm_scraper\|python.*edm" 2>/dev/null | head -1)
if [ -z "$PID" ]; then
    STATUS="❌ NICHT LÄUFT"
else
    STATUS="✅ LÄUFT (PID: $PID)"
fi

# Get DB stats if exists
if [ -f "$PROJECT/midi_edm_scraper.db" ]; then
    DB_STATS=$(python3 -c "
import sqlite3
try:
    conn = sqlite3.connect('$PROJECT/midi_edm_scraper.db')
    cur = conn.cursor()
    cur.execute('SELECT status, COUNT(*) FROM downloads GROUP BY status')
    rows = cur.fetchall()
    for row in rows:
        print(f'{row[0]}: {row[1]}')
    cur.execute('SELECT COUNT(*) FROM downloads')
    print(f'Total: {cur.fetchone()[0]}')
    conn.close()
except:
    print('DB not ready')
" 2>/dev/null)
else
    DB_STATS="DB noch nicht erstellt"
fi

# Get file count
FILE_COUNT=$(find "$PROJECT" -name "*.mid" -o -name "*.midi" 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$PROJECT" 2>/dev/null | awk '{print $1}')

# Write status
echo "$(date '+%Y-%m-%d %H:%M:%S') | $STATUS | Files: $FILE_COUNT | Size: $TOTAL_SIZE" > "$STATUS_FILE"
echo "$DB_STATS" >> "$STATUS_FILE"
echo "---" >> "$STATUS_FILE"
tail -3 /tmp/midi-edm-scraper-current.log 2>/dev/null >> "$STATUS_FILE"
