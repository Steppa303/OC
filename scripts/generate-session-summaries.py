#!/usr/bin/env python3
"""
Session Summary Generator v1
Findet neue/aktualisierte Sessions und generiert Summaries mit Fokus auf:
- Aufgetretene Probleme
- Lösungsversuche
- Signifikante Entscheidungen/Infos

Ergebnis: memory/summaries/YYYY-MM-DD-sessionID.md
"""

import json
import os
import glob
import re
from datetime import datetime, timezone, timedelta

SESSION_DIR = "/root/.openclaw/agents/main/sessions"
SUMMARY_DIR = "/root/.openclaw/workspace/memory/summaries"
STATE_FILE = "/root/.openclaw/workspace/memory/.summary-state"
LOG_FILE = "/tmp/session-summary.log"
MAX_EXCERPT_LEN = 200

os.makedirs(SUMMARY_DIR, exist_ok=True)

def load_summary_state():
    """Load already summarized sessions."""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return set(line.strip() for line in f if line.strip())
    return set()

def save_summary_state(session_ids):
    """Save summarized session IDs."""
    with open(STATE_FILE, 'w') as f:
        for sid in sorted(session_ids):
            f.write(sid + '\n')

def extract_session_content(session_file, max_messages=200):
    """Extract messages from a session file."""
    messages = []
    session_ts = None
    
    with open(session_file) as f:
        for line in f:
            try:
                d = json.loads(line.strip())
            except:
                continue
            
            if d.get('type') == 'session':
                session_ts = d.get('timestamp', '')
                continue
            
            if d.get('type') == 'message' and d.get('message'):
                m = d['message']
                role = m.get('role', 'unknown')
                ts = m.get('timestamp', d.get('timestamp', ''))
                
                # Extract text
                content = m.get('content', '')
                text = ''
                if isinstance(content, str):
                    text = content
                elif isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict):
                            t = item.get('text', '')
                            if t:
                                text += t + '\n'
                
                if text:
                    messages.append({
                        'role': role,
                        'ts': ts,
                        'text': text[:MAX_EXCERPT_LEN]
                    })
    
    # Return last N messages
    return messages[-max_messages:], session_ts

def detect_telegram_messages(messages):
    """Check if session has Telegram messages."""
    for m in messages:
        if m['role'] == 'user' and ('telegram' in m['text'].lower() or 'chat_id' in m['text'].lower()):
            return True
    return False

def clean_user_text(text):
    """Remove metadata blocks from user messages."""
    # Skip startup context injection
    if text.startswith('[Startup context loaded'):
        return ''
    
    # Remove Conversation info / Sender metadata blocks
    lines = text.split('\n')
    cleaned = []
    in_json = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('```json') or stripped == '```':
            in_json = not in_json
            continue
        if in_json:
            continue
        # Skip metadata lines
        if any(stripped.startswith(p) for p in ['Conversation info', 'Sender (', '[Audio', 'User text:', '{', '"chat_id', '"sender', '"message_id', ']', '[Telegram']):
            continue
        if stripped:
            cleaned.append(stripped)
    return ' '.join(cleaned).strip()

def extract_key_info(messages):
    """Extract problems, solutions, and significant info from messages."""
    problems = []
    solutions = []
    decisions = []
    
    for m in messages:
        clean_text = clean_user_text(m['text']).lower()
        if not clean_text:
            continue
        
        # Detect problems
        if any(kw in clean_text for kw in ['problem', 'fehler', 'error', 'crash', 'down', 'nicht', 'failed', 'issue', 'bug']):
            if m['role'] == 'user':
                problems.append(clean_user_text(m['text'])[:150])
        
        # Detect solutions/fixes
        if any(kw in clean_text for kw in ['fix', 'gelöst', 'gelöst', 'funktioniert', 'restart', 'close', 'kill', 'deploy']):
            if m['role'] == 'user':
                solutions.append(clean_user_text(m['text'])[:150])
        
        # Detect decisions
        if any(kw in clean_text for kw in ['entscheidung', 'machen wir', 'vorschlag', 'ok', 'genehmigt', 'wollen wir']):
            if m['role'] == 'user':
                decisions.append(clean_user_text(m['text'])[:150])
    
    return problems, solutions, decisions

def generate_summary(session_id, messages, session_ts, is_telegram):
    """Generate a structured summary from session messages."""
    now = datetime.now(timezone(timedelta(hours=1)))
    date_str = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%H:%M')
    
    # Parse session timestamp
    session_date = 'unknown'
    if session_ts:
        try:
            dt = datetime.fromisoformat(session_ts.replace('Z', '+00:00'))
            session_date = dt.strftime('%Y-%m-%d %H:%M')
        except:
            session_date = session_ts[:16]
    
    # Count messages by role
    user_msgs = sum(1 for m in messages if m['role'] == 'user')
    assistant_msgs = sum(1 for m in messages if m['role'] == 'assistant')
    tool_msgs = sum(1 for m in messages if m['role'] == 'toolResult')
    
    # Extract key info
    problems, solutions, decisions = extract_key_info(messages)
    
    # Get last few actual user messages (non-system)
    actual_user_msgs = []
    for m in reversed(messages):
        if m['role'] == 'user':
            clean = clean_user_text(m['text'])
            if clean and not clean.startswith('Read HEARTBEAT') and len(clean) > 10:
                actual_user_msgs.append(clean[:200])
                if len(actual_user_msgs) >= 5:
                    break
    
    # Build summary
    lines = []
    lines.append(f"# Session Summary: {session_id[:8]}...")
    lines.append("")
    lines.append(f"**Session ID:** {session_id}")
    lines.append(f"**Erstellt:** {session_date}")
    lines.append(f"**Zusammenfassung generiert:** {date_str} {time_str}")
    lines.append(f"**Nachrichten:** {user_msgs} User, {assistant_msgs} Assistant, {tool_msgs} Tools")
    lines.append(f"**Kanal:** {'Telegram' if is_telegram else 'TUI/Web'}")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Probleme
    if problems:
        lines.append("## 🔴 Aufgetretene Probleme")
        lines.append("")
        for p in problems[:5]:
            lines.append(f"- {p}")
        lines.append("")
    
    # Lösungen
    if solutions:
        lines.append("## 🟢 Lösungsversuche")
        lines.append("")
        for s in solutions[:5]:
            lines.append(f"- {s}")
        lines.append("")
    
    # Entscheidungen
    if decisions:
        lines.append("## 📋 Entscheidungen")
        lines.append("")
        for d in decisions[:5]:
            lines.append(f"- {d}")
        lines.append("")
    
    # Letzte User-Nachrichten
    if actual_user_msgs:
        lines.append("## 💬 Letzte Nachrichten von Bastian")
        lines.append("")
        for msg in actual_user_msgs:
            lines.append(f"- {msg}")
        lines.append("")
    
    # Vollständiger Chat-Verlauf (kompakt)
    lines.append("## 📝 Kompakter Chat-Verlauf")
    lines.append("")
    for m in messages[-20:]:  # Last 20 messages
        ts_short = '?'
        try:
            ts_val = int(m['ts']) / 1000
            dt = datetime.fromtimestamp(ts_val)
            ts_short = dt.strftime('%H:%M')
        except:
            pass
        
        role_emoji = {'user': '👤', 'assistant': '🤖', 'toolResult': '🔧'}.get(m['role'], '?')
        # Clean user messages
        if m['role'] == 'user':
            text_preview = clean_user_text(m['text'])[:100].replace('\n', ' ')
        else:
            text_preview = m['text'][:100].replace('\n', ' ')
        lines.append(f"- {ts_short} {role_emoji}: {text_preview}")
    
    lines.append("")
    lines.append("---")
    lines.append(f"_Generiert von Session Summary Generator v1_")
    lines.append("")
    
    return '\n'.join(lines)

def main():
    summarized = load_summary_state()
    
    # Find all session files
    session_files = sorted(glob.glob(os.path.join(SESSION_DIR, "*.jsonl")))
    
    new_summaries = 0
    for session_file in session_files:
        fname = os.path.basename(session_file)
        session_id = fname.replace('.jsonl', '')
        
        # Skip checkpoints and already summarized
        if '.checkpoint.' in fname or '.deleted.' in fname:
            continue
        if session_id in summarized:
            continue
        
        # Process session
        messages, session_ts = extract_session_content(session_file)
        if not messages:
            summarized.add(session_id)
            continue
        
        is_telegram = detect_telegram_messages(messages)
        summary = generate_summary(session_id, messages, session_ts, is_telegram)
        
        # Save summary
        summary_file = os.path.join(SUMMARY_DIR, f"{session_id}.md")
        with open(summary_file, 'w') as f:
            f.write(summary)
        
        summarized.add(session_id)
        new_summaries += 1
        print(f"Summary: {session_id[:8]}... -> {summary_file} (is_telegram={is_telegram})")
    
    # Save state
    save_summary_state(summarized)
    
    total_summaries = len(glob.glob(os.path.join(SUMMARY_DIR, "*.md")))
    print(f"[{datetime.now()}] Summary Generator: {new_summaries} new, {total_summaries} total")
    
    with open(LOG_FILE, 'a') as f:
        f.write(f"[{datetime.now()}] {new_summaries} new, {total_summaries} total summaries\n")

if __name__ == '__main__':
    main()
