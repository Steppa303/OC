#!/usr/bin/env bash
# haterbernd-comment-checker.sh — Instagram Comment Checker
# Version: 3.0 (JavaScript-basiert, robust)
#
# Strategie:
# 1. Profil-Seite → Post-Codes per JavaScript extrahieren
# 2. Jeden Post oeffnen → Comments per JavaScript auslesen
# 3. Neue Comments an Bastian via Telegram
#
# Log: /tmp/haterbernd-comment-checker.log
# State: projects/haterbernd/comment-state.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/tmp/haterbernd-comment-checker.log"
STATE_FILE="$SCRIPT_DIR/comment-state.json"

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
  [ -z "$TELEGRAM_BOT_TOKEN" ] && return
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\":\"$TELEGRAM_CHAT_ID\",\"text\":\"$message\",\"parse_mode\":\"HTML\"}" > /dev/null 2>&1
}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ==================== LOGIN ====================

ensure_logged_in() {
  local snap
  snap=$(agent-browser --session hb-comments snapshot -i --json 2>&1)
  
  local is_logged
  is_logged=$(echo "$snap" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for v in d.get('data',{}).get('refs',{}).values():
        n = v.get('name','').lower()
        if any(k in n for k in ['haterbernd','new post','messages']):
            print('yes'); break
    else: print('no')
except: print('no')
" 2>/dev/null)
  
  if [ "$is_logged" = "no" ]; then
    log "  🔐 Login..."
    local cookie_ref login_ref
    cookie_ref=$(echo "$snap" | python3 -c "
import sys, json
try:
    d=json.load(sys.stdin)
    for r,v in d.get('data',{}).get('refs',{}).items():
        if 'allow all' in v.get('name','').lower() and v.get('role')=='button': print(r); break
except: pass
" 2>/dev/null)
    [ -n "$cookie_ref" ] && agent-browser --session hb-comments click "@$cookie_ref" 2>&1 > /dev/null && sleep 2
    snap=$(agent-browser --session hb-comments snapshot -i --json 2>&1)
    
    login_ref=$(echo "$snap" | python3 -c "
import sys, json
try:
    d=json.load(sys.stdin)
    for r,v in d.get('data',{}).get('refs',{}).items():
        if v.get('role')=='button' and 'log in' in v.get('name','').lower(): print(r); break
except: pass
" 2>/dev/null)
    
    if [ -n "$login_ref" ]; then
      agent-browser --session hb-comments click "@$login_ref" 2>&1 > /dev/null && sleep 2
      snap=$(agent-browser --session hb-comments snapshot -i --json 2>&1)
      
      local user_ref pass_ref login_btn
      eval "$(echo "$snap" | python3 -c "
import sys, json
try:
    d=json.load(sys.stdin)
    for r,v in d.get('data',{}).get('refs',{}).items():
        n=v.get('name','').lower()
        if v.get('role')=='textbox' and any(k in n for k in ['mobile','username','email']): print(f'USER_REF=@{r}')
        elif v.get('role')=='textbox' and 'password' in n: print(f'PASS_REF=@{r}')
        elif v.get('role')=='button' and 'log in' in n: print(f'LOGIN_BTN=@{r}')
except: pass
" 2>/dev/null)"
      
      [ -n "${USER_REF:-}" ] && [ -n "${PASS_REF:-}" ] && {
        agent-browser --session hb-comments fill "$USER_REF" "HaterBernd" 2>&1 > /dev/null
        sleep 1
        agent-browser --session hb-comments fill "$PASS_REF" "instabernd#Jungle68" 2>&1 > /dev/null
        sleep 1
        agent-browser --session hb-comments click "${LOGIN_BTN:-}" 2>&1 > /dev/null
        sleep 5
        snap=$(agent-browser --session hb-comments snapshot -i --json 2>&1)
        local nn
        nn=$(echo "$snap" | python3 -c "
import sys, json
try:
    d=json.load(sys.stdin)
    for r,v in d.get('data',{}).get('refs',{}).items():
        if 'not now' in v.get('name','').lower() and v.get('role')=='button': print(r); break
except: pass
" 2>/dev/null)
        [ -n "$nn" ] && agent-browser --session hb-comments click "@$nn" 2>&1 > /dev/null && sleep 2
      }
    fi
    
    snap=$(agent-browser --session hb-comments snapshot -i --json 2>&1)
    local notif
    notif=$(echo "$snap" | python3 -c "
import sys, json
try:
    d=json.load(sys.stdin)
    for r,v in d.get('data',{}).get('refs',{}).items():
        if 'not now' in v.get('name','').lower() and v.get('role')=='button': print(r); break
except: pass
" 2>/dev/null)
    [ -n "$notif" ] && agent-browser --session hb-comments click "@$notif" 2>&1 > /dev/null && sleep 2
  fi
}

# ==================== MAIN ====================

check_comments() {
  log "📋 Instagram Comment-Check gestartet..."
  
  # VPN
  if ! systemctl is-active --quiet vpn-proxy.service; then
    systemctl start vpn-proxy.service && sleep 3
  fi
  
  # Profil oeffnen
  log "   Profil oeffnen..."
  ALL_PROXY=socks5://127.0.0.1:1080 agent-browser --session hb-comments open "https://www.instagram.com/haterbernd/" 2>&1 > /dev/null
  sleep 5
  ensure_logged_in
  
  # Post-Codes per JavaScript extrahieren
  log "   Post-Codes extrahieren..."
  local codes_result
  codes_result=$(agent-browser --session hb-comments eval "
const links = [...document.querySelectorAll('a[href*=\"/p/\"]')];
const seen = new Set();
const codes = [];
for (const a of links) {
    const href = a.getAttribute('href');
    if (href) {
        const m = href.match(/\\/p\\/([^\\/\\?]+)/);
        if (m && !seen.has(m[1])) {
            seen.add(m[1]);
            codes.push(m[1]);
        }
    }
}
console.log('CODES|' + JSON.stringify(codes.slice(0, 10)));
" 2>&1)
  
  local codes_json
  codes_json=$(echo "$codes_result" | grep "^CODES|" | sed 's/^CODES|//')
  
  if [ -z "$codes_json" ] || [ "$codes_json" = "[]" ]; then
    log "  ⚠️  Keine Posts gefunden"
    agent-browser --session hb-comments close 2>&1 > /dev/null
    return 0
  fi
  
  local code_count
  code_count=$(echo "$codes_json" | python3 -c "import sys,json; print(len(json.loads(sys.stdin.read())))")
  log "   $code_count Posts gefunden"
  
  # State laden
  local state='{"checked_comments":[],"last_check":null}'
  [ -f "$STATE_FILE" ] && state=$(cat "$STATE_FILE")
  
  # Jeden Post checken
  local total_new=0
  local alert_parts=""
  
  for code in $(echo "$codes_json" | python3 -c "import sys,json; [print(c) for c in json.loads(sys.stdin.read())]"); do
    log "  🔍 /p/$code/..."
    
    ALL_PROXY=socks5://127.0.0.1:1080 agent-browser --session hb-comments open "https://www.instagram.com/p/$code/" 2>&1 > /dev/null
    sleep 4
    
    # Comments per JavaScript extrahieren
    local comments_result
    comments_result=$(agent-browser --session hb-comments eval "
// Comments extrahieren
const comments = [];

// Methode 1: li Tags in der Comment-Liste
const commentItems = document.querySelectorAll('li[role=\"presentation\"], div[role=\"article\"], li.x9f619');
for (const item of commentItems) {
    const text = item.textContent.trim();
    if (text && text.length > 15 && text.length < 500) {
        // Filtere UI-Texte aus
        const skip = ['More replies','View replies','like','Share','Following','Follow','Load more','Report'];
        if (!skip.some(s => text.toLowerCase().includes(s.toLowerCase()))) {
            comments.push(text.substring(0, 200));
        }
    }
}

// Methode 2: h3 + span Pattern (neue IG Struktur)
const allTexts = document.querySelectorAll('span.x1lliihq');
for (const span of allTexts) {
    const text = span.textContent.trim();
    if (text && text.length > 15 && text.length < 500) {
        const skip = ['More replies','View replies','like','Share','Following','Follow'];
        if (!skip.some(s => text.toLowerCase().includes(s.toLowerCase()))) {
            if (!comments.includes(text.substring(0, 200))) {
                comments.push(text.substring(0, 200));
            }
        }
    }
}

// Deduplizieren und max 20
const unique = [...new Set(comments)].slice(0, 20);
console.log('COMMENTS|' + JSON.stringify(unique));
" 2>&1)
    
    local comments_json
    comments_json=$(echo "$comments_result" | grep "^COMMENTS|" | sed 's/^COMMENTS|//')
    
    if [ -n "$comments_json" ] && [ "$comments_json" != "[]" ]; then
      # Mit State vergleichen
      local new_comments
      new_comments=$(python3 -c "
import sys, json, os, hashlib

state_file = '$STATE_FILE'
state = {'checked_comments': [], 'last_check': None}
if os.path.exists(state_file):
    with open(state_file) as f:
        state = json.load(f)

checked = set(state.get('checked_comments', []))
post_code = '$code'
comments = json.loads(sys.stdin.read())
new = []

for text in comments:
    h = hashlib.md5(text.encode()).hexdigest()[:12]
    cid = f'{post_code}_{h}'
    if cid not in checked:
        new.append({'id': cid, 'text': text, 'post': post_code})
        checked.add(cid)

if new:
    for c in new:
        print(f'{c[\"id\"]}|{c[\"post\"]}|{c[\"text\"].replace(\"|\", \"_\").replace(chr(10), \" \")}')

state['checked_comments'] = list(checked)
import datetime
state['last_check'] = datetime.datetime.now().isoformat()
with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)
" <<< "$comments_json" 2>/dev/null)
      
      if [ -n "$new_comments" ]; then
        while IFS='|' read -r cid cpost ctext; do
          total_new=$((total_new + 1))
          alert_parts+="📌 /p/$cpost/\n💬 $ctext\n\n"
        done <<< "$new_comments"
      fi
    fi
  done
  
  # Browser zu
  agent-browser --session hb-comments close 2>&1 > /dev/null
  
  if [ "$total_new" -eq 0 ]; then
    log "✅ Keine neuen Kommentare"
    return 0
  fi
  
  local alert="💬 <b>HaterBernd - $total_new neue Kommentare!</b>\n\n${alert_parts}Antwort-Vorschlaege warten auf dein OK. "
  
  notify_telegram "$alert"
  log "✅ $total_new neue Kommentare gemeldet"
}

# ==================== MAIN ====================

case "${1:---check}" in
  --check) check_comments ;;
  --status)
    if [ -f "$STATE_FILE" ]; then
      python3 - "$STATE_FILE" << 'PYEOF'
import sys, json
with open(sys.argv[1]) as f:
    state = json.load(f)
print(f"📊 Comment Checker Status")
print(f"Letzter Check: {state.get('last_check', 'nie')}")
print(f"Gecheckte Kommentare: {len(state.get('checked_comments', []))}")
PYEOF
    else
      echo "Noch keine Kommentare geprueft."
    fi
    ;;
  *) echo "Usage: $0 [--check|--status]" ;;
esac
