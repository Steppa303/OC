#!/usr/bin/env bash
# haterbernd-dm-checker.sh — Instagram DM Checker für HaterBernd
# Version: 1.0
#
# Prüft Instagram DMs auf neue Nachrichten und meldet sie an Telegram.
#
# Verwendung: ./haterbernd-dm-checker.sh [--check] [--respond ID "antwort"]
#
# Log: /tmp/haterbernd-dm-checker.log
# State: projects/haterbernd/dm-state.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/tmp/haterbernd-dm-checker.log"
STATE_FILE="$SCRIPT_DIR/dm-state.json"
AUTH_FILE="$SCRIPT_DIR/instagram-auth.json"

mkdir -p "$(dirname "$LOG_FILE")"

# ==================== TELEGRAM ====================

TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID="1400987471"

if [ -f "/root/.openclaw/openclaw.json" ]; then
  TELEGRAM_BOT_TOKEN=$(python3 -c "
import json
with open('/root/.openclaw/openclaw.json') as f:
    cfg = json.load(f)
for ch in cfg.get('channels',{}).get('telegram',{}).get('instances',[]):
    if 'botToken' in ch:
        print(ch['botToken'])
        break
" 2>/dev/null || true)
fi

notify_telegram() {
  local message="$1"
  if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "⚠️  Telegram Bot-Token nicht gefunden" | tee -a "$LOG_FILE"
    return
  fi
  
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{
      \"chat_id\": \"$TELEGRAM_CHAT_ID\",
      \"text\": \"$message\",
      \"parse_mode\": \"HTML\"
    }" > /dev/null 2>&1
}

# ==================== LOGGING ====================

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ==================== DM CHECK ====================

check_dms() {
  log "📬 Instagram DM-Check gestartet..."
  
  # State laden
  local state='{"checked_threads":{},"last_check":null}'
  if [ -f "$STATE_FILE" ]; then
    state=$(cat "$STATE_FILE")
  fi
  
  # VPN-Proxy prüfen
  if ! systemctl is-active --quiet vpn-proxy.service; then
    log "⚠️  VPN-Proxy nicht aktiv, starte..."
    systemctl start vpn-proxy.service
    sleep 3
  fi
  
  # Browser starten
  log "  🌐 Browser starten..."
  ALL_PROXY=socks5://127.0.0.1:1080 agent-browser --session haterbernd-dm open "https://www.instagram.com/direct/inbox/" 2>&1 | tee -a "$LOG_FILE"
  sleep 4
  
  # Prüfen ob eingeloggt
  local snap
  snap=$(agent-browser --session haterbernd-dm snapshot -i --json 2>&1)
  
  # Login-Check
  local is_logged
  is_logged=$(echo "$snap" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    refs = d.get('data',{}).get('refs',{})
    for v in refs.values():
        name = v.get('name','').lower()
        if 'haterbernd' in name or 'new post' in name or 'messages' in name:
            print('yes'); break
    else:
        print('no')
except: print('no')
" 2>/dev/null)
  
  if [ "$is_logged" = "no" ]; then
    log "  🔐 Nicht eingeloggt, versuche Login..."
    
    # Cookie consent
    local cookie_ref
    cookie_ref=$(echo "$snap" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    refs = d.get('data',{}).get('refs',{})
    for r, v in refs.items():
        if 'allow all' in v.get('name','').lower() and v.get('role')=='button':
            print(r); break
except: pass
" 2>/dev/null)
    
    if [ -n "$cookie_ref" ]; then
      agent-browser --session haterbernd-dm click "@$cookie_ref" 2>&1 | tee -a "$LOG_FILE"
      sleep 2
      snap=$(agent-browser --session haterbernd-dm snapshot -i --json 2>&1)
    fi
    
    # Login button
    local login_ref
    login_ref=$(echo "$snap" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    refs = d.get('data',{}).get('refs',{})
    for r, v in refs.items():
        if v.get('role')=='button' and 'log in' in v.get('name','').lower():
            print(r); break
except: pass
" 2>/dev/null)
    
    if [ -n "$login_ref" ]; then
      agent-browser --session haterbernd-dm click "@$login_ref" 2>&1 | tee -a "$LOG_FILE"
      sleep 2
      snap=$(agent-browser --session haterbernd-dm snapshot -i --json 2>&1)
      
      # Credentials finden und ausfüllen
      local user_ref pass_ref login_btn_ref
      eval "$(echo "$snap" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    refs = d.get('data',{}).get('refs',{})
    for r, v in refs.items():
        name = v.get('name','').lower()
        if v.get('role')=='textbox' and any(k in name for k in ['mobile','username','email','phone']):
            print(f'USER_REF=@{r}')
        elif v.get('role')=='textbox' and 'password' in name:
            print(f'PASS_REF=@{r}')
        elif v.get('role')=='button' and 'log in' in name:
            print(f'LOGIN_BTN=@{r}')
except: pass
" 2>/dev/null)"
      
      if [ -n "${USER_REF:-}" ] && [ -n "${PASS_REF:-}" ]; then
        agent-browser --session haterbernd-dm fill "$USER_REF" "HaterBernd" 2>&1 | tee -a "$LOG_FILE"
        sleep 1
        agent-browser --session haterbernd-dm fill "$PASS_REF" "instabernd#Jungle68" 2>&1 | tee -a "$LOG_FILE"
        sleep 1
        agent-browser --session haterbernd-dm click "${LOGIN_BTN:-}" 2>&1 | tee -a "$LOG_FILE"
        sleep 5
        
        # "Save login info?" -> Not now
        snap=$(agent-browser --session haterbernd-dm snapshot -i --json 2>&1)
        local not_now_ref
        not_now_ref=$(echo "$snap" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    refs = d.get('data',{}).get('refs',{})
    for r, v in refs.items():
        if 'not now' in v.get('name','').lower() and v.get('role')=='button':
            print(r); break
except: pass
" 2>/dev/null)
        [ -n "$not_now_ref" ] && agent-browser --session haterbernd-dm click "@$not_now_ref" 2>&1 | tee -a "$LOG_FILE"
        sleep 2
      fi
    fi
  fi
  
  # Notifications prompt wegdrücken
  snap=$(agent-browser --session haterbernd-dm snapshot -i --json 2>&1)
  local notif_ref
  notif_ref=$(echo "$snap" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    refs = d.get('data',{}).get('refs',{})
    for r, v in refs.items():
        if 'not now' in v.get('name','').lower() or 'turn off' in v.get('name','').lower():
            if v.get('role')=='button':
                print(r); break
except: pass
" 2>/dev/null)
  [ -n "$notif_ref" ] && agent-browser --session haterbernd-dm click "@$notif_ref" 2>&1 | tee -a "$LOG_FILE"
  sleep 2
  
  # Threads auslesen
  log "  📋 Threads auslesen..."
  
  local new_dms
  new_dms=$(agent-browser --session haterbernd-dm snapshot -i --json 2>&1 | python3 -c "
import sys, json, os
from datetime import datetime

try:
    d = json.load(sys.stdin)
    refs = d.get('data',{}).get('refs',{})
except:
    print('ERROR')
    sys.exit(0)

# State laden
state_file = '$STATE_FILE'
state = {'checked_threads': {}, 'last_check': None}
if os.path.exists(state_file):
    with open(state_file) as f:
        state = json.load(f)

checked = state.get('checked_threads', {})
new_messages = []

for r, v in refs.items():
    name = v.get('name', '')
    role = v.get('role', '')
    
    # Thread-Buttons erkennen (enthalten username + nachricht + zeitangabe)
    if role == 'button' and any(kw in name.lower() for kw in ['user-profile-picture', 'you\\'re now friends']):
        # Parse: 'user-profile-picture USERNAME MESSAGE TIME'
        parts = name.split('user-profile-picture')
        if len(parts) >= 2:
            content = parts[1].strip()
            
            # Extrahiere Username (alles bis zur ersten Nachricht)
            # Pattern: USERNAME MESSAGE TIME
            # Wir splitten grob: erster Teil = username, rest = message + time
            
            # Finde Zeitangabe am Ende (X hours ago, X minutes ago, etc.)
            time_kw = [' ago', ' minutes ago', ' hours ago', ' days ago', ' weeks ago']
            time_str = ''
            msg_end = len(content)
            for kw in time_kw:
                idx = content.rfind(kw)
                if idx > 0:
                    # Gehe zurück zum Anfang der Zeitangabe
                    start = idx
                    while start > 0 and content[start-1] not in [' ', '\n']:
                        start -= 1
                    time_str = content[start:].strip()
                    msg_end = start
                    break
            
            message_and_name = content[:msg_end].strip()
            
            # Username ist typischerweise der erste Teil vor der Nachricht
            # Da wir keinen klaren Trenner haben, nehmen wir die ersten 1-2 Wörter
            tokens = message_and_name.split()
            if len(tokens) >= 2:
                username = tokens[0]
                message = ' '.join(tokens[1:])
            else:
                username = message_and_name
                message = ''
            
            thread_id = username
            
            # Prüfen ob neue Nachricht (nicht im State oder Message anders)
            last_msg = checked.get(thread_id, {}).get('last_message', '')
            if message and message != last_msg:
                new_messages.append({
                    'username': username,
                    'message': message,
                    'time': time_str,
                    'thread_id': thread_id
                })
                checked[thread_id] = {
                    'last_message': message,
                    'last_check': datetime.now().isoformat()
                }

if new_messages:
    for m in new_messages:
        print(f'NEW_DM|{m[\"username\"]}|{m[\"message\"]}|{m[\"time\"]}|{m[\"thread_id\"]}')
else:
    print('NO_NEW_DMS')

# State speichern
state['checked_threads'] = checked
state['last_check'] = datetime.now().isoformat()
with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)
" 2>/dev/null)
  
  # Browser schließen
  agent-browser --session haterbernd-dm close 2>&1 | tee -a "$LOG_FILE"
  
  # Results verarbeiten
  if [ "$new_dms" = "ERROR" ] || [ -z "$new_dms" ]; then
    log "⚠️  DM-Read fehlgeschlagen"
    return 1
  fi
  
  if [ "$new_dms" = "NO_NEW_DMS" ]; then
    log "✅ Keine neuen DMs"
    return 0
  fi
  
  # Neue DMs an Telegram melden
  local alert="📬 <b>HaterBernd - Neue DMs!</b>\n\n"
  
  while IFS='|' read -r type username message time thread_id; do
    if [ "$type" = "NEW_DM" ]; then
      alert+="👤 <b>$username</b>\n"
      alert+="💬 $message\n"
      alert+="🕐 $time\n\n"
    fi
  done <<< "$new_dms"
  
  alert+="Antwort-Vorschläge warten auf dein OK, Boss. 🦞"
  
  notify_telegram "$alert"
  log "✅ DM-Alert an Telegram gesendet"
  
  # Neue DMs auch als JSON für den Bot speichern
  echo "$new_dms" | while IFS='|' read -r type username message time thread_id; do
    if [ "$type" = "NEW_DM" ]; then
      log "  Neue DM von @$username: $message ($time)"
    fi
  done
  
  return 0
}

# ==================== MAIN ====================

case "${1:---check}" in
  --check)
    check_dms
    ;;
  --status)
    if [ -f "$STATE_FILE" ]; then
      python3 - "$STATE_FILE" << 'PYEOF'
import sys, json
with open(sys.argv[1]) as f:
    state = json.load(f)
checked = state.get('checked_threads', {})
print(f"📊 DM Checker Status")
print(f"{'='*40}")
print(f"Letzter Check: {state.get('last_check', 'nie')}")
print(f"Bekannte Threads: {len(checked)}")
for tid, data in checked.items():
    print(f"  @{tid}: {data.get('last_message', '')[:50]}")
PYEOF
    else
      echo "Noch keine DMs geprüft."
    fi
    ;;
  *)
    echo "HaterBernd DM Checker v1.0"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Optionen:"
    echo "  --check    DMs prüfen und neue melden"
    echo "  --status   Status anzeigen"
    echo "  --help     Diese Hilfe"
    ;;
esac
