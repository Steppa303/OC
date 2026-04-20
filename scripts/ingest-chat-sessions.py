#!/usr/bin/env python3
"""
Chat Session Ingest v2
Extrahiert OpenClaw Sessions und schreibt sie als durchsuchbare Markdown-Files
nach memory/sessions/ – damit memorySearch sie automatisch findet.

NEU v2: Extrahiert auch die letzten Telegram-Nachrichten aus der aktiven
Main-Session und schreibt ein Summary in die Daily-Datei, damit neue
Sessions den aktuellen Telegram-Kontext automatisch geladen bekommen.
"""

import json
import os
import sys
import glob
from datetime import datetime, timezone, timedelta

SESSION_DIR = "/root/.openclaw/agents/main/sessions"
OUTPUT_DIR = "/root/.openclaw/workspace/memory/sessions"
MEMORY_DIR = "/root/.openclaw/workspace/memory"
STATE_FILE = "/root/.openclaw/workspace/memory/.ingest-state"
LOG_FILE = "/tmp/chat-ingest.log"
MAX_TOOL_RESULTS = 50
MAX_MSG_LEN = 500
MAX_ASSISTANT_LEN = 300
MAX_TELEGRAM_MESSAGES = 30
MEMORY_DIR_OUTPUT = "/root/.openclaw/workspace/memory"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(MEMORY_DIR_OUTPUT, exist_ok=True)

def format_timestamp(ts):
    if not ts:
        return '?'
    try:
        ts_val = int(ts) if isinstance(ts, (int, float)) else int(str(ts))
        if ts_val > 1e12:
            ts_val = ts_val / 1000
        dt = datetime.fromtimestamp(ts_val)
        return dt.strftime('%Y-%m-%d %H:%M')
    except (ValueError, TypeError, OSError):
        return str(ts)[:16] if str(ts) else '?'

def format_timestamp_short(ts):
    if not ts:
        return '?'
    try:
        ts_val = int(ts) if isinstance(ts, (int, float)) else int(str(ts))
        if ts_val > 1e12:
            ts_val = ts_val / 1000
        dt = datetime.fromtimestamp(ts_val)
        return dt.strftime('%H:%M')
    except (ValueError, TypeError, OSError):
        return '?'

def truncate(text, maxlen):
    if len(text) <= maxlen:
        return text
    return text[:maxlen] + "..."

def extract_text(message):
    content = message.get('content', '')
    text = ''
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        for item in content:
            if isinstance(item, dict):
                t = item.get('text', '')
                if t:
                    text += t + '\n'
                elif item.get('type') == 'tool_use':
                    tool_name = item.get('name', '?')
                    inp = item.get('input', {})
                    if isinstance(inp, dict):
                        text += f'[Tool: {tool_name}] {json.dumps(inp, ensure_ascii=False)[:200]}\n'
                    else:
                        text += f'[Tool: {tool_name}]\n'
                elif item.get('type') == 'tool_result':
                    tool_result_content = item.get('content', '')
                    if isinstance(tool_result_content, list):
                        for ti in tool_result_content:
                            if isinstance(ti, dict) and ti.get('text'):
                                text += truncate(ti['text'], MAX_MSG_LEN) + '\n'
                    elif isinstance(tool_result_content, str):
                        text += truncate(tool_result_content, MAX_MSG_LEN) + '\n'
    return text.strip()

def process_session(session_file):
    fname = os.path.basename(session_file)
    session_id = fname.replace('.jsonl', '')
    messages = []
    tool_count = 0
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
                text = extract_text(m)
                if text:
                    messages.append((role, ts, text))

    if not messages:
        return None, 0

    # Build markdown
    lines = []
    if session_ts:
        try:
            dt = datetime.fromisoformat(session_ts.replace('Z', '+00:00'))
            date_str = dt.strftime('%Y-%m-%d %H:%M')
        except:
            date_str = session_ts[:16]
    else:
        date_str = 'unknown'

    lines.append(f"# Chat Session {session_id[:8]}...")
    lines.append("")
    lines.append(f"**Erstellt:** {date_str}")
    lines.append(f"**Messages:** {len(messages)}")
    lines.append(f"**Quelle:** {session_id}")
    lines.append("")
    lines.append("---")
    lines.append("")

    for role, ts, text in messages:
        ts_short = format_timestamp(ts)
        if role == 'user':
            lines.append(f"## User ({ts_short})")
            lines.append("")
            lines.append(truncate(text, MAX_MSG_LEN))
            lines.append("")
        elif role == 'assistant':
            lines.append(f"## Assistant ({ts_short})")
            lines.append("")
            lines.append(truncate(text, MAX_ASSISTANT_LEN))
            lines.append("")

    md_content = '\n'.join(lines)
    output_file = os.path.join(OUTPUT_DIR, f"{session_id}.md")

    with open(output_file, 'w') as f:
        f.write(md_content)

    return output_file, os.path.getsize(output_file) if os.path.exists(output_file) else 0

def extract_telegram_context(session_file, max_messages=MAX_TELEGRAM_MESSAGES):
    """
    Extrahiert die letzten Telegram-Nachrichten aus einer Session.
    Returnt eine Liste von (timestamp, sender, text) Tupeln.
    """
    telegram_messages = []
    
    with open(session_file) as f:
        for line in f:
            try:
                d = json.loads(line.strip())
            except:
                continue

            if d.get('type') != 'message' or not d.get('message'):
                continue

            m = d['message']
            role = m.get('role', 'unknown')
            ts = m.get('timestamp', d.get('timestamp', ''))
            
            # Check if this is a Telegram message (metadata channel info)
            is_telegram = False
            if role == 'user':
                # Check metadata for Telegram
                metadata = d.get('metadata', {})
                if metadata.get('channel') == 'telegram' or metadata.get('provider') == 'telegram':
                    is_telegram = True
                # Also check content for Telegram indicators
                text = extract_text(m)
                if text and '[Telegram' in text:
                    is_telegram = True
            
            if is_telegram:
                text = extract_text(m)
                if text:
                    sender = "User" if role == 'user' else "Assistant"
                    telegram_messages.append((ts, sender, text))

    # Return last N messages
    return telegram_messages[-max_messages:]

def write_telegram_context_summary(telegram_messages, daily_file):
    """
    Schreibt ein Telegram-Kontext-Summary in die Daily-Datei.
    Appendt einen neuen Abschnitt oder aktualisiert einen bestehenden.
    """
    if not telegram_messages:
        return
    
    now = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=1)))
    date_str = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%H:%M')
    
    # Build summary section
    summary_lines = []
    summary_lines.append(f"\n## 📱 Letzte Telegram-Nachrichten ({time_str})")
    summary_lines.append("")
    summary_lines.append(f"**Aktualisiert:** {date_str} {time_str}")
    summary_lines.append(f"**Anzahl Nachrichten:** {len(telegram_messages)}")
    summary_lines.append("")
    
    for ts, sender, text in telegram_messages:
        ts_short = format_timestamp_short(ts)
        preview = truncate(text, 200)
        summary_lines.append(f"- **{ts_short}** [{sender}]: {preview}")
    
    summary_lines.append("")
    summary_lines.append("---")
    summary_lines.append("")
    
    summary_content = '\n'.join(summary_lines)
    
    # Check if file exists
    if os.path.exists(daily_file):
        with open(daily_file, 'r') as f:
            existing = f.read()
        
        # Check if there's already a Telegram context section
        if "## 📱 Letzte Telegram-Nachrichten" in existing:
            # Replace existing section
            lines = existing.split('\n')
            new_lines = []
            in_section = False
            for line in lines:
                if line.startswith("## 📱 Letzte Telegram-Nachrichten"):
                    in_section = True
                    continue
                if in_section and line.startswith("## "):
                    in_section = False
                if not in_section:
                    new_lines.append(line)
            
            existing = '\n'.join(new_lines)
        
        # Append new section
        with open(daily_file, 'w') as f:
            f.write(existing + summary_content)
    else:
        # Create new file
        with open(daily_file, 'w') as f:
            f.write(f"# Daily Memory: {date_str}\n\n")
            f.write(summary_content)

def main():
    # Load state
    ingested = {}
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            for line in f:
                parts = line.strip().split('|')
                if len(parts) == 2:
                    ingested[parts[0]] = parts[1]

    # Process sessions
    new_state = {}
    count = 0
    updated = 0
    latest_session_file = None
    latest_session_mtime = 0

    session_files = sorted(glob.glob(os.path.join(SESSION_DIR, "*.jsonl")))

    for session_file in session_files:
        fname = os.path.basename(session_file)

        # Skip checkpoint and deleted files
        if '.checkpoint.' in fname or '.deleted.' in fname:
            continue

        current_mtime = os.path.getmtime(session_file)

        # Track latest session
        if current_mtime > latest_session_mtime:
            latest_session_mtime = current_mtime
            latest_session_file = session_file

        # Skip if already ingested and not modified
        if ingested.get(fname) == str(current_mtime):
            new_state[fname] = str(current_mtime)
            continue

        count += 1
        output_file, size = process_session(session_file)

        if output_file:
            updated += 1
            print(f"Ingested: {fname} -> {os.path.basename(output_file)} ({size} bytes)")

        new_state[fname] = str(current_mtime)

    # Save state
    with open(STATE_FILE, 'w') as f:
        for fname, mtime in new_state.items():
            f.write(f"{fname}|{mtime}\n")

    total_files = len(glob.glob(os.path.join(OUTPUT_DIR, "*.md")))
    
    # v2: Extract Telegram context from latest session and write to daily file
    telegram_context_updated = False
    if latest_session_file:
        telegram_msgs = extract_telegram_context(latest_session_file)
        if telegram_msgs:
            today = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=1)))
            daily_file = os.path.join(MEMORY_DIR_OUTPUT, f"telegram-context-{today.strftime('%Y-%m-%d')}.md")
            write_telegram_context_summary(telegram_msgs, daily_file)
            telegram_context_updated = True
            print(f"Telegram context: {len(telegram_msgs)} messages -> {daily_file}")

    if count > 0 or telegram_context_updated:
        log_msg = f"[{datetime.now()}] Chat Ingest v2: {count} sessions checked, {updated} new/updated, {total_files} total files, telegram_context={'updated' if telegram_context_updated else 'no_messages'}"
        print(log_msg)
        with open(LOG_FILE, 'a') as f:
            f.write(log_msg + "\n")

if __name__ == '__main__':
    main()
