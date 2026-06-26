#!/bin/bash
cd /root/.openclaw/workspace/projects/video-downloader
node server.js &
SERVER_PID=$!
sleep 2
echo "Server PID: $SERVER_PID"
curl -s -X POST http://localhost:3100/api/info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' | head -c 600
echo ""
kill $SERVER_PID 2>/dev/null
