#!/usr/bin/env python3
"""
Telegram Context Updater v2
Extrahiert die letzten Telegram-Nachrichten (User + Assistant) aus den Session-Files
und schreibt sie in die Daily-Memory-Datei.

Damit neue Sessions den aktuellen Telegram-Kontext automatisch geladen bekommen.
Inkludiert sowohl Probleme (User) als auch Lösungen (Assistant).
"""

import re
import json
import os
import glob
from datetime import datetime, timezone, timedelta

MEMORY_DIR = "/root/.openclaw/workspace/memory/sessions"
DAILY_DIR = "/root/.openclaw/workspace/memory"
MAX_CONVERSATIONS = 12  # Anzahl der Gesprächspaare (User + Assistant)

def clean_user_text(text):
    """Remove metadata blocks from user messages."""
    if text.startswith('[Startup context'):
        return ''
    
    # Remove JSON metadata blocks
    parts = text.split('```')
    if len(parts) > 1:
        actual_text = parts[-1].strip()
        if actual_text and len(actual_text) > 10:
            return actual_text
    
    # Fallback: get text after "User text:" if present
    if 'User text:' in text:
        return text.split('User text:')[-1].strip()
    
    return ''

def extract_telegram_conversations(session_file, max_msgs=MAX_CONVERSATIONS):
    """Extrahiert Telegram-Conversations (User + Assistant Paare) aus einem Session-File."""
    with open(session_file) as f:
        content = f.read()
    
    # Extract all messages in order
    user_msgs = re.findall(r'## User \(([^)]+)\)\n\n(.+?)(?=\n## |\Z)', content, re.DOTALL)
    assistant_msgs = re.findall(r'## Assistant \(([^)]+)\)\n\n(.+?)(?=\n## |\Z)', content, re.DOTALL)
    
    conversations = []
    
    for ts, msg in user_msgs:
        # Check if this is a Telegram message
        if '"chat_id": "telegram:' not in msg:
            continue
        
        # Extract sender name
        sender_match = re.search(r'"sender"\s*:\s*"([^"]+)"', msg)
        sender = sender_match.group(1) if sender_match else 'Bastian'
        
        # Extract actual user text
        user_text = clean_user_text(msg)
        if not user_text or user_text.startswith('Read HEARTBEAT'):
            continue
        
        # Find the corresponding Assistant response
        # The assistant message comes right after the user message
        assistant_text = ''
        for ats, amsg in assistant_msgs:
            # Find the first assistant message after this user message
            if ats > ts or ats == ts:
                # Extract assistant text
                if amsg:
                    # Skip thinking blocks
                    thinking_match = re.search(r'<thinking>(.+?)</thinking>', amsg, re.DOTALL)
                    if thinking_match:
                        amsg_clean = amsg.replace(thinking_match.group(0), '').strip()
                    else:
                        amsg_clean = amsg
                    
                    # Get first meaningful text
                    parts = amsg_clean.split('```')
                    if len(parts) > 1:
                        actual = parts[-1].strip()
                    else:
                        actual = amsg_clean.strip()
                    
                    assistant_text = actual[:300]
                    break
        
        conversations.append({
            'ts': ts,
            'sender': sender,
            'user_text': user_text[:250],
            'assistant_text': assistant_text[:300]
        })
    
    return conversations[-max_msgs:]

def main():
    # Get all session files sorted by modification time (newest first)
    session_files = sorted(
        glob.glob(os.path.join(MEMORY_DIR, "*.md")),
        key=os.path.getmtime,
        reverse=True
    )
    
    all_conversations = []
    for sf in session_files[:3]:  # Check last 3 modified sessions
        convos = extract_telegram_conversations(sf)
        all_conversations.extend(convos)
    
    if not all_conversations:
        print("[telegram-context] No Telegram conversations found")
        return
    
    # Sort by timestamp and take last MAX_CONVERSATIONS
    all_conversations.sort(key=lambda c: c['ts'])
    all_conversations = all_conversations[-MAX_CONVERSATIONS:]
    
    # Write to daily file
    now = datetime.now(timezone(timedelta(hours=1)))
    today_str = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%H:%M')
    daily_file = os.path.join(DAILY_DIR, f"{today_str}.md")
    
    # Build context section
    context_lines = []
    context_lines.append(f"\n## 📱 Telegram Context ({time_str})")
    context_lines.append(f"**Letzte {len(all_conversations)} Gespräche mit Bastian via Telegram:**")
    context_lines.append("")
    
    for convo in all_conversations:
        # Clean timestamp to just HH:MM
        ts_match = re.search(r'(\d{2}:\d{2})$', convo['ts'])
        ts_short = ts_match.group(1) if ts_match else convo['ts']
        
        context_lines.append(f"### [{ts_short}] {convo['sender']}")
        context_lines.append(f"**Frage:** {convo['user_text']}")
        if convo['assistant_text']:
            context_lines.append(f"**Antwort:** {convo['assistant_text']}")
        context_lines.append("")
    
    context_lines.append("---")
    context_lines.append("")
    
    context_content = '\n'.join(context_lines)
    
    # Update or create daily file
    if os.path.exists(daily_file):
        with open(daily_file, 'r') as f:
            existing = f.read()
        
        # Remove old Telegram context section if exists
        lines = existing.split('\n')
        new_lines = []
        in_section = False
        for line in lines:
            if line.startswith("## 📱 Telegram Context"):
                in_section = True
                continue
            if in_section and line.startswith("## "):
                in_section = False
            if not in_section:
                new_lines.append(line)
        
        existing = '\n'.join(new_lines)
        
        with open(daily_file, 'w') as f:
            f.write(existing + context_content)
    else:
        with open(daily_file, 'w') as f:
            f.write(f"# Daily Memory: {today_str}\n\n")
            f.write(context_content)
    
    print(f"[telegram-context-v2] Updated {daily_file} with {len(all_conversations)} conversations")

if __name__ == '__main__':
    main()
