#!/bin/bash
cd /root/.openclaw/workspace/projects/midi-scraper

# Check if scraper is running
PID=$(pgrep -f "python3 main.py scrape" 2>/dev/null)
if [ -z "$PID" ]; then
    STATUS="❌ NICHT LÄUFT"
else
    STATUS="✅ LÄUFT (PID: $PID)"
fi

# Get DB stats
DB_STATS=$(python3 -c "
import sqlite3
conn = sqlite3.connect('midi_scraper.db')
cur = conn.cursor()
cur.execute('SELECT status, COUNT(*) FROM downloads GROUP BY status')
rows = cur.fetchall()
for row in rows:
    print(f'{row[0]}: {row[1]}')
cur.execute('SELECT COUNT(*) FROM downloads')
print(f'Total: {cur.fetchone()[0]}')
conn.close()
" 2>/dev/null)

# Get total file size
TOTAL_SIZE=$(du -sh /root/.openclaw/workspace/projects/midi-scraper/midi-collection/ 2>/dev/null | awk '{print $1}')

# Log timestamp
echo "$(date '+%Y-%m-%d %H:%M:%S') | $STATUS | Size: $TOTAL_SIZE" > /tmp/midi-scraper-status.txt
echo "$DB_STATS" >> /tmp/midi-scraper-status.txt
echo "---" >> /tmp/midi-scraper-status.txt

# Get last log lines
tail -3 /tmp/midi-scraper-current.log 2>/dev/null >> /tmp/midi-scraper-status.txt
