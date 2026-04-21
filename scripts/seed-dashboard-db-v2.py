#!/usr/bin/env python3
"""
Seed Agent Dashboard DB v2
Liest OpenClaw Session-Files und schreibt Agent-Aktivitäten in die Dashboard-DB.
Extrahiert Labels/Tasks aus sessions_spawn arguments und echten User-Nachrichten.
"""

import json
import os
import glob
from datetime import datetime
import psycopg2
import re

SESSION_DIR = "/root/.openclaw/agents/main/sessions"

DB_CONFIG = {
    "user": "webapp",
    "host": "localhost",
    "database": "webapp_db",
    "password": "db#Jungle68",
    "port": 5432,
}

def clean_text(text, max_len=500):
    """Remove metadata blocks and truncate."""
    if not text:
        return ""
    if text.startswith('[Startup context') or text.startswith('Read HEARTBEAT'):
        return ""
    
    # Remove JSON metadata blocks
    lines = text.split('\n')
    cleaned = []
    in_json = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('```json') or stripped.startswith('```'):
            in_json = not in_json
            continue
        if in_json:
            continue
        if any(stripped.startswith(p) for p in ['{', '"', ']', 'Sender (', 'Conversation info', '[Audio', 'User text:']):
            continue
        if stripped:
            cleaned.append(stripped)
    
    return ' '.join(cleaned).strip()[:max_len]

def extract_session_info(session_file):
    """Extract agent info from a session file."""
    fname = os.path.basename(session_file)
    session_id = fname.replace('.jsonl', '')
    
    messages = []
    session_ts = None
    spawn_calls = []
    
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
                            elif item.get('type') == 'tool_use':
                                tool_name = item.get('name', '')
                                if tool_name == 'sessions_spawn':
                                    args = item.get('arguments', {})
                                    if isinstance(args, str):
                                        try:
                                            args = json.loads(args)
                                        except:
                                            args = {}
                                    spawn_calls.append({
                                        'ts': ts,
                                        'label': args.get('label', ''),
                                        'task': args.get('task', ''),
                                        'model': args.get('model', ''),
                                    })
                
                messages.append({
                    'role': role,
                    'ts': ts,
                    'text': text,
                })
    
    return {
        'session_id': session_id,
        'session_ts': session_ts,
        'message_count': len(messages),
        'spawn_calls': spawn_calls,
        'messages': messages,
    }

def get_label_and_task(info):
    """Extract label and task from sessions_spawn calls or user messages."""
    # Check if this session has a sessions_spawn call
    if info['spawn_calls']:
        sc = info['spawn_calls'][0]
        label = sc.get('label', '')
        task = sc.get('task', '')[:200]
        if label and task:
            return label, task, sc.get('model', '')
    
    # Check if this IS a subagent session (spawned by another)
    # Look for the first meaningful user message
    for m in info['messages']:
        if m['role'] == 'user':
            text = clean_text(m['text'], 500)
            if text and len(text) > 20:
                # Check if it's a subagent context message
                if '[Subagent Context]' in m['text'] or '[Subagent Task]' in m['text']:
                    task_match = re.search(r'\[Subagent Task\]:\s*(.+)', m['text'], re.DOTALL)
                    if task_match:
                        task_text = task_match.group(1).strip()
                        # Extract label: take the sentence after role description
                        # Format: "Du bist ein X. Deine Aufgabe: Y." → label = Y
                        aufgabe_match = re.search(r'Deine Aufgabe[:\s]+(.+?)(?=\.|\n)', task_text)
                        if aufgabe_match:
                            label = aufgabe_match.group(1).strip()[:80]
                        else:
                            # Fallback: first sentence that's not a role desc
                            first_sentence = task_text.split('.')[0].strip()
                            if first_sentence.startswith('Du bist'):
                                # Take second sentence
                                parts = task_text.split('.')
                                if len(parts) > 1:
                                    label = parts[1].strip()[:80]
                                else:
                                    label = first_sentence[:80]
                            else:
                                label = first_sentence[:80]
                        
                        if not label:
                            label = f"Subagent {info['session_id'][:8]}"
                        
                        task = task_text[:200]
                        return label, task, "qwen3.6-plus"
                    break
                
                # Regular user message - this is a main session
                # Skip system messages, heartbeats, and short messages
                if text.startswith('System:') or text.startswith('[Startup') or 'Exec ' in text[:20]:
                    continue
                if text.startswith('Read HEARTBEAT'):
                    continue
                
                # Extract meaningful first line as label
                first_lines = text.split('\n')
                label = ''
                for line in first_lines:
                    stripped = line.strip()
                    if stripped and len(stripped) > 10 and not stripped.startswith('[') and not stripped.startswith('```') and not stripped.startswith('{'):
                        label = stripped[:80]
                        break
                if not label:
                    label = f"Main Session {info['session_id'][:8]}"
                task_summary = text[:200]
                return label, task_summary, "qwen3.6-plus"
    
    return f"Session {info['session_id'][:8]}", "OpenClaw Session", "qwen3.6-plus"

def get_session_status(info):
    """Determine if session is running or completed."""
    messages = info['messages']
    if not messages:
        return 'running'
    
    last_roles = [m['role'] for m in messages[-5:]]
    if last_roles[-1] == 'assistant':
        return 'done'
    elif last_roles[-1] == 'toolResult':
        return 'running'
    else:
        return 'done'

def compute_runtime(info):
    """Compute session runtime in ms."""
    messages = info['messages']
    if len(messages) < 2:
        return 0
    
    try:
        first_ts = int(messages[0]['ts'])
        last_ts = int(messages[-1]['ts'])
        if first_ts > 1e12:
            first_ts = first_ts / 1000
            last_ts = last_ts / 1000
        return int((last_ts - first_ts) * 1000)
    except:
        return 0

def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    session_files = sorted(
        glob.glob(os.path.join(SESSION_DIR, "*.jsonl")),
        key=os.path.getmtime
    )
    
    session_files = [f for f in session_files if '.checkpoint.' not in f and '.deleted.' not in f]
    
    inserted = 0
    skipped = 0
    
    for sf in session_files:
        info = extract_session_info(sf)
        session_id = info['session_id']
        
        if info['message_count'] < 3:
            skipped += 1
            continue
        
        label, task, model = get_label_and_task(info)
        status = get_session_status(info)
        runtime_ms = compute_runtime(info)
        
        # Get first/last timestamps
        first_ts = None
        last_ts = None
        if info['messages']:
            first_ts = info['messages'][0]['ts']
            last_ts = info['messages'][-1]['ts']
        
        # Get full prompt from first real user message
        prompt = ""
        for m in info['messages']:
            if m['role'] == 'user':
                raw = m['text']
                if raw and not raw.startswith('[Startup context') and not raw.startswith('Read HEARTBEAT'):
                    prompt = raw[:2000]
                    break
        
        started_at = None
        ended_at = None
        try:
            if first_ts:
                ts_val = int(first_ts)
                if ts_val > 1e12:
                    ts_val = ts_val / 1000
                started_at = datetime.fromtimestamp(ts_val)
            
            if last_ts and status == 'done':
                ts_val = int(last_ts)
                if ts_val > 1e12:
                    ts_val = ts_val / 1000
                ended_at = datetime.fromtimestamp(ts_val)
        except:
            pass
        
        if not started_at:
            started_at = datetime.now()
        
        try:
            cur.execute("""
                INSERT INTO agent_activities 
                (session_key, label, task, prompt, status, model, started_at, ended_at, runtime_ms)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (session_key) DO UPDATE SET
                    label = EXCLUDED.label,
                    task = EXCLUDED.task,
                    prompt = EXCLUDED.prompt,
                    status = EXCLUDED.status,
                    model = EXCLUDED.model,
                    started_at = EXCLUDED.started_at,
                    ended_at = EXCLUDED.ended_at,
                    runtime_ms = EXCLUDED.runtime_ms
            """, (
                session_id,
                label,
                task,
                prompt,
                status,
                model,
                started_at,
                ended_at,
                runtime_ms,
            ))
            inserted += 1
        except Exception as e:
            print(f"Error {session_id}: {e}")
            skipped += 1
    
    conn.commit()
    print(f"Inserted/Updated: {inserted}, Skipped: {skipped}")
    
    cur.execute("SELECT COUNT(*) FROM agent_activities")
    count = cur.fetchone()[0]
    print(f"Total agents in DB: {count}")
    
    cur.execute("""
        SELECT label, status, model, started_at, runtime_ms 
        FROM agent_activities 
        ORDER BY started_at DESC 
        LIMIT 8
    """)
    for row in cur.fetchall():
        runtime_min = row[4] / 60000 if row[4] else 0
        print(f"  {row[0]:40s} | {row[1]:8s} | {row[2]:15s} | {row[3]} | {runtime_min:.0f}min")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
