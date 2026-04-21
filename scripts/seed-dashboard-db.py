#!/usr/bin/env python3
"""
Seed Agent Dashboard DB
Liest OpenClaw Session-Files und schreibt Agent-Aktivitäten in die Dashboard-DB.
"""

import json
import os
import glob
from datetime import datetime
import psycopg2

SESSION_DIR = "/root/.openclaw/agents/main/sessions"

DB_CONFIG = {
    "user": "webapp",
    "host": "localhost",
    "database": "webapp_db",
    "password": "db#Jungle68",
    "port": 5432,
}

def extract_session_info(session_file):
    """Extract agent info from a session file."""
    fname = os.path.basename(session_file)
    session_id = fname.replace('.jsonl', '')
    
    messages = []
    session_ts = None
    tool_calls = []
    
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
                                if tool_name in ('sessions_spawn', 'exec', 'write', 'edit'):
                                    tool_calls.append({
                                        'tool': tool_name,
                                        'ts': ts,
                                        'args': item.get('arguments', {})
                                    })
                
                messages.append({
                    'role': role,
                    'ts': ts,
                    'text': text[:500] if text else ''
                })
    
    return {
        'session_id': session_id,
        'session_ts': session_ts,
        'message_count': len(messages),
        'tool_calls': tool_calls,
        'messages': messages,
    }

def infer_agent_label(session_info):
    """Infer agent label from session content."""
    session_id = session_info['session_id']
    tool_calls = session_info['tool_calls']
    
    # Check for sessions_spawn calls
    for tc in tool_calls:
        if tc['tool'] == 'sessions_spawn':
            args = tc['args']
            label = args.get('label', '')
            if label:
                return label
    
    # Check for session name patterns
    if 'subagent' in session_id:
        return f"Subagent {session_id[:8]}"
    
    return f"Session {session_id[:8]}"

def infer_model(session_info):
    """Infer model from session."""
    # Default to the main model
    return "qwen3.6-plus"

def get_session_status(session_info):
    """Determine if session is running or completed."""
    messages = session_info['messages']
    if not messages:
        return 'running'
    
    # Check last messages
    last_roles = [m['role'] for m in messages[-5:]]
    
    # If last message is assistant, likely completed
    if last_roles[-1] == 'assistant':
        return 'done'
    elif last_roles[-1] == 'toolResult':
        return 'running'
    else:
        return 'done'

def compute_runtime(session_info):
    """Compute session runtime in ms."""
    messages = session_info['messages']
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
    
    # Skip checkpoint and deleted files
    session_files = [f for f in session_files if '.checkpoint.' not in f and '.deleted.' not in f]
    
    inserted = 0
    skipped = 0
    
    for sf in session_files:
        info = extract_session_info(sf)
        session_id = info['session_id']
        
        # Skip very short sessions (likely just heartbeat)
        if info['message_count'] < 3:
            skipped += 1
            continue
        
        label = infer_agent_label(info)
        model = infer_model(info)
        status = get_session_status(info)
        runtime_ms = compute_runtime(info)
        
        # Get first and last timestamps
        first_ts = None
        last_ts = None
        if info['messages']:
            first_ts = info['messages'][0]['ts']
            last_ts = info['messages'][-1]['ts']
        
        # Get task description from first user message
        task = "OpenClaw Session"
        prompt = ""
        for m in info['messages']:
            if m['role'] == 'user' and m['text'] and not m['text'].startswith('Read HEARTBEAT'):
                task = m['text'][:100]
                prompt = m['text'][:500]
                break
        
        # Convert timestamps
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
        
        # Insert into DB
        try:
            cur.execute("""
                INSERT INTO agent_activities 
                (session_key, label, task, prompt, status, model, started_at, ended_at, runtime_ms)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (session_key) DO NOTHING
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
            print(f"Error inserting {session_id}: {e}")
            skipped += 1
    
    conn.commit()
    print(f"Inserted: {inserted}, Skipped: {skipped}")
    
    # Verify
    cur.execute("SELECT COUNT(*) FROM agent_activities")
    count = cur.fetchone()[0]
    print(f"Total agents in DB: {count}")
    
    # Show last 5
    cur.execute("""
        SELECT session_key, label, status, model, started_at, runtime_ms 
        FROM agent_activities 
        ORDER BY started_at DESC 
        LIMIT 5
    """)
    for row in cur.fetchall():
        print(f"  {row[1]} | {row[2]} | {row[3]} | {row[4]} | {row[5]}ms")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
