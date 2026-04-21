#!/usr/bin/env python3
"""
Telegram Context Updater v3 (AI-Summary Edition)
Extrahiert die letzten Telegram-Nachrichten (User + Assistant) aus den Session-Files,
generiert eine AI-gestützte Zusammenfassung und schreibt sie in die Daily-Memory-Datei.

Damit neue Sessions den aktuellen Telegram-Kontext automatisch geladen bekommen.
Statt roher Nachrichten gibt es jetzt kompakte AI-Summaries mit:
- Probleme, Lösungen, Entscheidungen, Offene Punkte
"""

import re
import json
import os
import glob
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

MEMORY_DIR = "/root/.openclaw/workspace/memory/sessions"
DAILY_DIR = "/root/.openclaw/workspace/memory"
MAX_CONVERSATIONS = 12  # Anzahl der Gesprächspaare (User + Assistant)

# AI Summary Config
API_ENDPOINT = "https://coding-intl.dashscope.aliyuncs.com/v1/chat/completions"
API_KEY = "sk-sp-c47b7fe381c04d6a81206c6e5f3b7882"
MODEL = "qwen3.5-plus"
SUMMARY_TIMEOUT = 30  # Sekunden
SUMMARY_MAX_RETRIES = 1

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

def generate_ai_summary(conversations):
    """Generiert eine AI-Zusammenfassung der Telegram-Gespräche via DashScope API."""
    # Baue den Prompt aus den rohen Gesprächen
    conversation_text = ""
    for convo in conversations:
        ts_match = re.search(r'(\d{2}:\d{2})$', convo['ts'])
        ts_short = ts_match.group(1) if ts_match else convo['ts']
        conversation_text += f"[{ts_short}] {convo['sender']}: {convo['user_text']}\n"
        if convo['assistant_text']:
            conversation_text += f"Assistant: {convo['assistant_text']}\n"
    
    system_prompt = """Du bist ein technischer Assistent. Fasse die folgenden Telegram-Gespräche zusammen.
Formatiere die Zusammenfassung so:

## Probleme
- [Liste der diskutierten Probleme]

## Lösungen
- [Liste der angewendeten Lösungen]

## Entscheidungen
- [Liste der getroffenen Entscheidungen]

## Offene Punkte
- [Liste der noch offenen Aufgaben]

Halte dich kurz und prägnant. Nur das Wesentliche. Maximal 500 Zeichen."""
    
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": conversation_text}
        ],
        "temperature": 0.3,
        "max_tokens": 300
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        API_ENDPOINT,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}'
        },
        method='POST'
    )
    
    retries = SUMMARY_MAX_RETRIES
    while retries >= 0:
        try:
            response = urllib.request.urlopen(req, timeout=SUMMARY_TIMEOUT)
            result = json.loads(response.read().decode('utf-8'))
            
            if 'choices' in result and len(result['choices']) > 0:
                summary = result['choices'][0]['message']['content'].strip()
                print(f"[telegram-context-v3] AI-Summary generiert ({len(summary)} Zeichen)")
                return summary
            else:
                print(f"[telegram-context-v3] Unerwartete API-Antwort: {result}")
                retries -= 1
                continue
                
        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, KeyError, TimeoutError) as e:
            print(f"[telegram-context-v3] API-Fehler (Versuch {SUMMARY_MAX_RETRIES - retries + 1}): {e}")
            retries -= 1
            if retries < 0:
                print("[telegram-context-v3] Alle Retries fehlgeschlagen, verwende Fallback")
                return None
    
    return None


def format_fallback_content(conversations):
    """Fallback: Formatiere rohe Nachrichten wenn AI nicht verfügbar ist."""
    lines = []
    lines.append("## Probleme")
    for convo in conversations:
        lines.append(f"- {convo['user_text'][:200]}")
    lines.append("")
    lines.append("## Lösungen")
    lines.append("- (Keine AI-Summary verfügbar, siehe Rohdaten oben)")
    lines.append("")
    lines.append("## Entscheidungen")
    lines.append("- (N/A)")
    lines.append("")
    lines.append("## Offene Punkte")
    lines.append("- (N/A)")
    return '\n'.join(lines)


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
    
    # Generiere AI-Summary oder Fallback
    ai_summary = generate_ai_summary(all_conversations)
    
    if ai_summary:
        context_content = ai_summary
    else:
        print("[telegram-context-v3] Verwende Fallback (rohe Nachrichten)")
        context_content = format_fallback_content(all_conversations)
    
    # Baue finalen Context-Block
    final_context = f"\n## 📱 Telegram Context ({time_str})\n"
    final_context += context_content + "\n"
    final_context += "---\n\n"
    
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
            f.write(existing + final_context)
    else:
        with open(daily_file, 'w') as f:
            f.write(f"# Daily Memory: {today_str}\n\n")
            f.write(final_context)
    
    print(f"[telegram-context-v3] Updated {daily_file} with {'AI-Summary' if ai_summary else 'Fallback'} ({len(all_conversations)} conversations)")

if __name__ == '__main__':
    main()
