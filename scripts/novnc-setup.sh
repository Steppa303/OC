#!/bin/bash
# novnc-setup.sh - Sets up noVNC for remote Instagram CAPTCHA solving

# Kill existing
pkill -f "Xvfb :99" 2>/dev/null
pkill -f "x11vnc" 2>/dev/null
pkill -f "websockify" 2>/dev/null
pkill firefox 2>/dev/null
sleep 2

# 1. Xvfb
Xvfb :99 -screen 0 1280x720x24 >/dev/null 2>&1 &
echo "Xvfb PID: $!"
sleep 2

# 2. Firefox
DISPLAY=:99 firefox --no-remote >/dev/null 2>&1 &
echo "Firefox PID: $!"
sleep 5

# 3. x11vnc
x11vnc -display :99 -nopw -rfbport 5900 -bg >/dev/null 2>&1
sleep 1
echo "x11vnc started"

# 4. noVNC
websockify --web /usr/share/novnc 6080 localhost:5900 >/dev/null 2>&1 &
echo "websockify PID: $!"
sleep 2

echo ""
echo "✅ noVNC ready!"
echo "🌐 Connect to: http://185.217.126.72:6080/vnc.html"
echo "🔒 No password required"
