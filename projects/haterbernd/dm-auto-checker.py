#!/usr/bin/env python3
"""
HaterBernd DM Auto-Checker & Responder (instagrapi version)
Läuft alle 2h via Cron. Checkt DMs und antwortet automatisch im HaterBernd-Style.
"""

import json
import os
import sys
import logging
from datetime import datetime

from instagrapi import Client
from instagrapi.types import UserShort

STATE_FILE = "/root/.openclaw/workspace/projects/haterbernd/dm-state.json"
SESSION_FILE = "/root/.openclaw/workspace/projects/haterbernd/instagrapi-session.json"
LOG_FILE = "/tmp/haterbernd-dm-checker.log"

USERNAME = "HaterBernd"
PASSWORD = "instabernd#Jungle68"

# HaterBernd Antwort-Patterns
RESPONSE_TEMPLATES = {
    "wasser": "Wasser trinken ist für NPCs die ihren Tag mit 'Hydration' absichern statt mit Ergebnissen. Echte Alphas trinken schwarzen Kaffee und die Angst ihrer Konkurrenz.",
    "hate": "Ich hater nicht. Ich stelle nur fest was ihr alle zu soft seid um zuzugeben. Aber ich versteh – der Spiegel ist brutal.",
    "lustig": "Lol was? Ich bin nicht dein Unterhaltungsprogramm. Ich bin der Grund warum du nachts nicht schlafen kannst.",
    "cringe": "Cringe? Mein Content ist nicht cringe. Du bist cringe. Du scrollst durch Reels von Influencern während ich dich durchschaue.",
    "love": "Love? Hier gibt es kein Love. Nur kalte Wahrheit und harte Fakten. Aber danke für den Versuch, NPC.",
    "default": "Interessant dass du mir das schreibst. Fast so als ob du zu viel Freizeit hättest. Hast du schonmal überlegt produktiv zu sein? Nein? Dann viel Spaß beim Scrollen."
}

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"checked_threads": {}, "last_check": None}

def save_state(state):
    state["last_check"] = datetime.now().isoformat()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=4)

def generate_response(message):
    """Generiert eine HaterBernd-Antwort basierend auf der Nachricht."""
    msg_lower = message.lower()
    
    if any(w in msg_lower for w in ["wasser", "water", "hydrat", "trink"]):
        return RESPONSE_TEMPLATES["wasser"]
    elif any(w in msg_lower for w in ["hate", "hasst", "hass", "toxisch", "böse"]):
        return RESPONSE_TEMPLATES["hate"]
    elif any(w in msg_lower for w in ["lustig", "lol", "haha", "witzig", "😂"]):
        return RESPONSE_TEMPLATES["lustig"]
    elif any(w in msg_lower for w in ["cringe", "peinlich", "kringe"]):
        return RESPONSE_TEMPLATES["cringe"]
    elif any(w in msg_lower for w in ["love", "lieb", "herz", "❤️", "💕", "😍"]):
        return RESPONSE_TEMPLATES["love"]
    else:
        return RESPONSE_TEMPLATES["default"]

def login():
    """Login mit instagrapi, mit Session-Caching."""
    cl = Client()
    
    # Versuche Session-Datei zu laden
    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            cl.login(USERNAME, PASSWORD)
            log("✅ Login mit gespeicherter Session")
            return cl
        except Exception as e:
            log(f"⚠️  Gespeicherte Session ungültig: {e}")
    
    # Fresh login
    try:
        cl.login(USERNAME, PASSWORD)
        cl.dump_settings(SESSION_FILE)
        log("✅ Fresh login erfolgreich, Session gespeichert")
        return cl
    except Exception as e:
        log(f"❌ Login fehlgeschlagen: {e}")
        raise

def main():
    log("=" * 50)
    log("📬 HaterBernd DM Auto-Checker (instagrapi) gestartet")
    
    state = load_state()
    checked_threads = state.get("checked_threads", {})
    
    try:
        cl = login()
        log(f"✅ Eingeloggt als {cl.user_id}")
        
        # Hole DM-Threads
        log("  📋 Lese DM-Inbox...")
        inbox = cl.direct_threads()
        log(f"  📋 {len(inbox)} Threads gefunden")
        
        new_threads = []
        
        for thread in inbox:
            if not thread.users:
                continue
            
            # Letzter User im Thread (der letzte Sender)
            last_user = thread.users[0]
            username = last_user.username
            user_id = str(last_user.pk)
            
            # Hole letzte Nachricht
            if not thread.messages:
                continue
            
            last_msg = thread.messages[0]
            msg_text = getattr(last_msg, 'text', '')
            msg_user_id = str(getattr(last_msg, 'user_id', ''))
            
            # Skip wenn wir die letzte Nachricht gesendet haben
            if msg_user_id == str(cl.user_id):
                continue
            
            # Skip wenn keine neue Nachricht
            if not msg_text or msg_text.strip() == '':
                continue
            
            # Check ob wir schon geantwortet haben
            thread_key = user_id
            existing = checked_threads.get(thread_key, {})
            
            # Skip wenn gleiche Nachricht schon beantwortet
            if existing.get("replied_to_message") == msg_text:
                continue
            
            # Skip wenn Nachricht älter als 24h
            msg_ts = getattr(last_msg, 'timestamp', None)
            if msg_ts:
                if isinstance(msg_ts, datetime):
                    msg_time = msg_ts
                elif isinstance(msg_ts, (int, float)):
                    msg_time = datetime.fromtimestamp(msg_ts / 1000) if msg_ts > 1000000000000 else datetime.fromtimestamp(msg_ts)
                else:
                    msg_time = None
                
                if msg_time and (datetime.now() - msg_time).total_seconds() > 86400:
                    continue
            
            log(f"  💬 Neue DM von @{username}: {msg_text[:80]}")
            
            # Antwort generieren
            response = generate_response(msg_text)
            log(f"  🤖 Antwort: {response[:80]}...")
            
            # Antwort senden
            try:
                cl.direct_send(response, user_ids=[int(user_id)])
                log(f"  ✅ Antwort gesendet!")
                
                # State updaten
                checked_threads[thread_key] = {
                    "username": username,
                    "user_id": user_id,
                    "last_message": msg_text,
                    "last_reply": response,
                    "replied_to_message": msg_text,
                    "last_check": datetime.now().isoformat()
                }
                new_threads.append({
                    "username": username,
                    "message": msg_text,
                    "reply": response
                })
            except Exception as e:
                log(f"  ❌ Senden fehlgeschlagen: {e}")
                checked_threads[thread_key] = {
                    "username": username,
                    "user_id": user_id,
                    "last_message": msg_text,
                    "last_check": datetime.now().isoformat()
                }
        
        save_state({"checked_threads": checked_threads})
        
        if new_threads:
            log(f"✅ {len(new_threads)} neue DM(s) beantwortet:")
            for t in new_threads:
                log(f"  - @{t['username']}: {t['reply'][:60]}...")
        else:
            log("✅ Keine neuen DMs")
        
    except Exception as e:
        log(f"❌ Fataler Fehler: {e}")
        import traceback
        log(traceback.format_exc())
        sys.exit(1)
    
    log("🏁 DM Auto-Checker fertig")

if __name__ == "__main__":
    main()
