#!/usr/bin/env python3
"""
Telegram Context Updater v1
Extrahiert die letzten Telegram-Nachrichten aus den Session-Files
und schreibt sie in die Daily-Memory-Datei.

Damit neue Sessions den aktuellen Telegram-Kontext automatisch geladen bekommen.
"""

import re
import json
import os
import glob
from datetime import datetime, timezone, timedelta

MEMORY_DIR = "/root/.openclaw/workspace/memory/sessions"
DAILY_DIR = "/root/.openclaw/workspace/memory"
MAX_MESSAGES = 15

def extract_telegram_messages(session_file, max_msgs=MAX_MESSAGES):
    """Extrahiert Telegram-User-Nachrichten aus einem Session-File."""
    with open(session_file) as f:
        content = f.read()
    
    user_msgs = re.findall(r'## User \(([^)]+)\)\n\n(.+?)(?=\n## |\Z)', content, re.DOTALL)
    
    results = []
    for ts, msg in user_msgs:
        if '"chat_id": "telegram:' not in msg:
            continue
        
        # Extract sender name
        sender_match = re.search(r'"sender"\s*:\s*"([^"]+)"', msg)
        sender = sender_match.group(1) if sender_match else 'User'
        
        # Extract actual text - it's after the last ``` block
        parts = msg.split('```')
        actual_text = ''
        
        if len(parts) > 1:
            actual_text = parts[-1].strip()
        
        if not actual_text:
            if 'User text:' in msg:
                actual_text = msg.split('User text:')[-1].strip()
        
        # Skip heartbeat/system messages
        if actual_text and not actual_text.startswith('Read HEARTBEAT'):
            results.append({
                'ts': ts,
                'sender': sender,
                'text': actual_text[:200]
            })
    
    return results[-max_msgs:]

def main():
    # Get all session files sorted by modification time (newest first)
    session_files = sorted(
        glob.glob(os.path.join(MEMORY_DIR, "*.md")),
        key=os.path.getmtime,
        reverse=True
    )
    
    all_messages = []
    for sf in session_files[:3]:  # Check last 3 modified sessions
        msgs = extract_telegram_messages(sf)
        all_messages.extend(msgs)
    
    if not all_messages:
        print("[telegram-context] No Telegram messages found")
        return
    
    # Sort by timestamp and take last MAX_MESSAGES
    all_messages.sort(key=lambda m: m['ts'])
    all_messages = all_messages[-MAX_MESSAGES:]
    
    # Write to daily file
    now = datetime.now(timezone(timedelta(hours=1)))
    today_str = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%H:%M')
    daily_file = os.path.join(DAILY_DIR, f"{today_str}.md")
    
    # Build context section
    context_lines = []
    context_lines.append(f"\n## 📱 Telegram Context ({time_str})")
    context_lines.append(f"**Letzte {len(all_messages)} Nachrichten von Bastian via Telegram:**")
    context_lines.append("")
    
    for msg in all_messages:
        # Clean timestamp to just HH:MM
        ts_match = re.search(r'(\d{2}:\d{2})$', msg['ts'])
        ts_short = ts_match.group(1) if ts_match else msg['ts']
        context_lines.append(f"- [{ts_short}] {msg['sender']}: {msg['text'][:150]}")
    
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
    
    print(f"[telegram-context] Updated {daily_file} with {len(all_messages)} messages")

if __name__ == '__main__':
    main()
