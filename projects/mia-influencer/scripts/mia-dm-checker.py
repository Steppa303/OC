#!/usr/bin/env python3
"""
Mia Influencer – DM Auto-Checker
Basiert auf HaterBernd dm-auto-checker.py

Checkt neue DMs und antwortet im Mia-Stil.

Cron: 0 9,11,13,15,17,19,21 * * *
"""

import json
import os
import sys
import logging
from datetime import datetime
from instagrapi import Client

BASE_DIR = "/root/.openclaw/workspace/projects/mia-influencer"
SESSION_FILE = os.path.join(BASE_DIR, "instagrapi-session.json")
STATE_FILE = os.path.join(BASE_DIR, "dm-state.json")
LOG_FILE = "/tmp/mia-dm-checker.log"

USERNAME = "mia.[tbd]"  # TODO
PASSWORD = "[tbd]"       # TODO

GENERIC_REPLIES = [
    "Hey! Danke für deine Nachricht 🥰 Freut mich voll, dass du mein Profil gefunden hast! Was magst du an meinem Content am liebsten?",
    "Hallöchen! 🤍 Danke fürs Schreiben – das bedeutet mir total viel! Hast du eine Frage oder willst du einfach nur hallo sagen?",
    "Hey du! 😊 Wow, so viele liebe Nachrichten heute! Freut mich riesig. Erzähl mal, was beschäftigt dich gerade?",
    "Hii! ☺️ Danke für deine DM! Ohne euch wäre das alles hier nichts. Wie läuft dein Tag so?",
]

import random


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] 💬 {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"processed_threads": [], "last_check": None}


def save_state(state):
    state["last_check"] = datetime.now().isoformat()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def login():
    cl = Client()
    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            cl.login(USERNAME, PASSWORD)
            log("✅ Login mit Session")
            return cl
        except Exception as e:
            log(f"⚠️ Session ungültig: {e}")
    cl.login(USERNAME, PASSWORD)
    cl.dump_settings(SESSION_FILE)
    log("✅ Fresh Login")
    return cl


def main():
    log("=" * 40)
    log("Mia DM Checker gestartet")
    state = load_state()
    processed = set(state.get("processed_threads", []))

    cl = login()
    threads = cl.direct_threads()

    for thread in threads:
        thread_id = str(thread.id)
        if thread_id in processed:
            continue

        if not thread.users or not thread.messages:
            processed.add(thread_id)
            continue

        last_user = thread.users[0]
        last_msg = thread.messages[0]
        msg_user_id = str(getattr(last_msg, 'user_id', ''))
        msg_text = getattr(last_msg, 'text', '(media/kein Text)')

        if msg_user_id == str(cl.user_id):
            processed.add(thread_id)
            continue

        username = last_user.username
        log(f"📩 Neue DM von @{username}: '{msg_text[:100]}'")

        reply = random.choice(GENERIC_REPLIES)
        try:
            cl.direct_send(reply, user_ids=[int(last_user.pk)])
            log(f"✅ Antwort gesendet")
        except Exception as e:
            log(f"❌ Antwort fehlgeschlagen: {e}")

        processed.add(thread_id)

    state["processed_threads"] = list(processed)
    save_state(state)
    log(f"✅ Fertig ({len(threads)} Threads geprüft)")


if __name__ == "__main__":
    main()