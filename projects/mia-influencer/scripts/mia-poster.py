#!/usr/bin/env python3
"""
Mia Influencer – Auto-Poster (instagrapi)
Basiert auf HaterBernd-Poster, adaptiert für Mia-Workflow.

Cron: */30 16-21 * * *
Phase 1: Nur qwen-Bilder + ElevnLabs Voiceover (Carousel)
Phase 2-3: + Veo Animation + Reels

Pipeline:
  1. Content-Idee aus schedule.json lesen
  2. Bild generieren (qwen-image-2.0-pro)
  3. Voiceover generieren (ElevenLabs API)
  4. Video animieren (Veo 3.1 via Gemini) – optional bei Carousel
  5. ffmpeg Assembly (Audio + Video + Untertitel)
  6. Post via instagrapi
  7. Status updaten + Telegram Notification
"""

import json
import os
import sys
import subprocess
import logging
import time
import requests
from datetime import datetime
from instagrapi import Client

# ==== CONFIG ====
BASE_DIR = "/root/.openclaw/workspace/projects/mia-influencer"
SCHEDULE_FILE = os.path.join(BASE_DIR, "schedule.json")
STATE_FILE = os.path.join(BASE_DIR, "post-state.json")
SESSION_FILE = os.path.join(BASE_DIR, "instagrapi-session.json")
IMAGE_GEN_SCRIPT = "/root/.openclaw/workspace/scripts/qwen-image-gen.sh"
IMG_DIR = "/tmp/mia-posts"
LOG_FILE = "/tmp/mia-poster.log"

# ElevenLabs Config (Laura German - Upbeat & Energetic)
ELEVENLABS_API_KEY = "sk_2ff8aca207c482b8ccb08500efe99cca7711213f038760da"
ELEVENLABS_VOICE_ID = "LB5G0Z4EP98YaEgL654m"  # Laura: Upbeat & Energetic (German)
ELEVENLABS_VOICE_FALLBACK = "cgSgspJ2msm6clMCkdW9"  # Jessica: Playful, Bright, Warm

# Instagram Credentials
USERNAME = "mia_influencer_de"  # TODO: Registrieren auf https://instagram.com
PASSWORD = "[tbd]"       # TODO: Setzen nach Account-Erstellung

# Telegram
TELEGRAM_CHAT_ID = "1400987471"

os.makedirs(IMG_DIR, exist_ok=True)


def get_telegram_token():
    try:
        with open("/root/.openclaw/openclaw.json") as f:
            cfg = json.load(f)
        for ch in cfg.get("channels", {}).get("telegram", {}).get("instances", []):
            if "botToken" in ch:
                return ch["botToken"]
    except:
        pass
    return ""


TELEGRAM_BOT_TOKEN = get_telegram_token()


def load_elevenlabs_config():
    """Lese ElevenLabs API Key und Voice ID aus Config."""
    global ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
    try:
        with open("/root/.openclaw/openclaw.json") as f:
            cfg = json.load(f)
        tts = cfg.get("tts", {}).get("providers", {}).get("elevenlabs", {})
        ELEVENLABS_API_KEY = tts.get("apiKey", "")
        # Default Voice (noch nicht custom)
        ELEVENLABS_VOICE_ID = tts.get("defaultVoice", "21m00Tcm4TlvDq8ikWAM")
    except:
        pass


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] 📍 {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def notify_telegram(message, screenshot=None):
    if not TELEGRAM_BOT_TOKEN:
        return
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        requests.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML"
        })
        if screenshot and os.path.exists(screenshot):
            photo_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
            with open(screenshot, "rb") as f:
                requests.post(photo_url, data={"chat_id": TELEGRAM_CHAT_ID}, files={"photo": f})
    except Exception as e:
        log(f"⚠️  Telegram notification failed: {e}")


def login():
    cl = Client()
    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            cl.login(USERNAME, PASSWORD)
            log("✅ Login mit gespeicherter Session")
            return cl
        except Exception as e:
            log(f"⚠️  Gespeicherte Session ungültig: {e}")

    cl.login(USERNAME, PASSWORD)
    cl.dump_settings(SESSION_FILE)
    log("✅ Fresh login erfolgreich")
    return cl


def find_next_post():
    with open(SCHEDULE_FILE) as f:
        schedule = json.load(f)

    state = {"posted_ids": [], "failed_ids": [], "retry_counts": {}}
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            state = json.load(f)

    posted = set(state.get("posted_ids", []))
    failed = set(state.get("failed_ids", []))
    retry_counts = state.get("retry_counts", {})

    now = datetime.now()

    for post in schedule["posts"]:
        pid = post["id"]
        if pid in posted:
            continue

        retries = retry_counts.get(str(pid), 0)
        if pid in failed and retries >= 3:
            continue

        post_dt = datetime.strptime(f"{post['date']} {post['time']}", "%Y-%m-%d %H:%M")
        if now >= post_dt:
            return post

    return None


def update_state(post_id, status, note=""):
    state = {"posted_ids": [], "failed_ids": [], "retry_counts": {}, "history": []}
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            state = json.load(f)

    if status == "success":
        if post_id not in state["posted_ids"]:
            state["posted_ids"].append(post_id)
        if post_id in state.get("failed_ids", []):
            state["failed_ids"].remove(post_id)
        state["history"].append({
            "post_id": post_id,
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "note": note
        })
    elif status == "failed":
        if post_id not in state.get("failed_ids", []):
            state["failed_ids"].append(post_id)
        state["retry_counts"][str(post_id)] = state["retry_counts"].get(str(post_id), 0) + 1
        state["history"].append({
            "post_id": post_id,
            "status": "failed",
            "timestamp": datetime.now().isoformat(),
            "note": note
        })

    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def generate_image(post):
    """Generiere Bild mit qwen-image-2.0-pro."""
    post_id = post["id"]
    post_dir = os.path.join(IMG_DIR, f"post-{post_id}")
    os.makedirs(post_dir, exist_ok=True)

    prompt = post.get("character_prompt", "")
    if not prompt:
        log("  ❌ Kein character_prompt im Post")
        return None

    # Character Descriptor + Setting
    full_prompt = prompt.replace("[SPECIFIC_SETTING]", post.get("setting", ""))

    log(f"  🎨 Generiere Bild...")
    try:
        result = subprocess.run([
            IMAGE_GEN_SCRIPT, full_prompt,
            "--size", post.get("size", "9:16"),
            "--output", post_dir
        ], capture_output=True, text=True, timeout=180)

        if result.returncode != 0:
            log(f"  ❌ Bildgenerierung fehlgeschlagen: {result.stderr[:200]}")
            return None

        # Find generated image
        for line in result.stdout.strip().split("\n"):
            if "📸" in line:
                src = line.replace("📸", "").strip()
                outfile = os.path.join(post_dir, "slide-1.jpg")
                if os.path.exists(src):
                    os.rename(src, outfile)
                    log(f"  ✅ Bild → {outfile}")
                    return post_dir
    except subprocess.TimeoutExpired:
        log(f"  ❌ Bildgenerierung timeout")
        return None

    return None


def generate_voiceover(post):
    """Generiere Voiceover mit ElevenLabs."""
    # TODO: Implementieren sobald Custom Voice erstellt ist
    # Voice ID + Text aus post["voice_text"]
    log("  🔊 Voiceover-Generierung (noch zu implementieren)")
    return None


def generate_reel(post, image_dir):
    """Generiere Video mit Veo 3.1."""
    # TODO: Implementieren (Veo API Call)
    log("  🎬 Reel-Generierung (noch zu implementieren)")
    return None


def post_carousel(cl, post_dir, post):
    """Post als Instagram Carousel."""
    image_path = os.path.join(post_dir, "slide-1.jpg")
    if not os.path.exists(image_path):
        log(f"  ❌ Bild nicht gefunden: {image_path}")
        return False

    caption = post.get("caption", "")
    hashtags = post.get("hashtags", "")
    full_caption = caption + "\n\n" + hashtags

    log(f"  📤 Poste Carousel...")
    try:
        cl.photo_upload(image_path, caption=full_caption)
        log(f"  ✅ Gepostet!")
        return True
    except Exception as e:
        log(f"  ❌ Posting fehlgeschlagen: {e}")
        return False


def post_reel(cl, post, video_path):
    """Post als Instagram Reel."""
    caption = post.get("caption", "") + "\n\n" + post.get("hashtags", "")
    if not video_path or not os.path.exists(video_path):
        log(f"  ❌ Video nicht gefunden: {video_path}")
        return False
    try:
        cl.clip_upload(video_path, caption=caption)
        return True
    except Exception as e:
        log(f"  ❌ Reel fehlgeschlagen: {e}")
        return False


def run_post(post):
    post_id = post["id"]
    post_title = post.get("title", post_id)
    post_format = post.get("format", "carousel")

    log("=" * 50)
    log(f"📋 Post #{post_id}: '{post_title}'")
    log(f"   📝 Format: {post_format}")
    log(f"   🎯 Phase: {post.get('phase', 1)} | Rage-Level: {post.get('rage_level', 0)}")
    log("=" * 50)

    try:
        cl = login()
    except Exception as e:
        log(f"❌ Login fehlgeschlagen: {e}")
        update_state(post_id, "failed", f"Login failed: {e}")
        notify_telegram(f"🚨 <b>Mia ERROR</b>\n\nPost #{post_id}: {post_title}\n\n❌ Login fehlgeschlagen.")
        return False

    try:
        if post_format == "reel":
            # Reel: Bild → Voiceover → Veo → Assembly → Post
            img_dir = generate_image(post)
            if not img_dir:
                raise Exception("Bildgenerierung fehlgeschlagen")

            # TODO: Voiceover + Veo + Assembly implementieren
            # video_path = assembly_pipeline(img_dir, post)
            # post_reel(cl, post, video_path)

            # Fallback: Carousel statt Reel
            log("⚠️  Reel-Pipeline noch nicht fertig, poste als Carousel")
            if post_carousel(cl, img_dir, post):
                update_state(post_id, "success", "Carousel (Reel-Fallback)")
                notify_telegram(f"✅ <b>Mia Post veröffentlicht!</b>\n\nPost #{post_id}: {post_title}\n⚠️ Als Carousel (Reel-Pipeline pending)")
                return True
        else:
            # Carousel/Single: Nur Bild + Caption
            img_dir = generate_image(post)
            if not img_dir:
                raise Exception("Bildgenerierung fehlgeschlagen")

            if post_carousel(cl, img_dir, post):
                update_state(post_id, "success", f"Carousel gepostet")
                log("✅ Carousel erfolgreich!")
                notify_telegram(f"✅ <b>Mia Post veröffentlicht!</b>\n\nPost #{post_id}: {post_title}")
                return True

        update_state(post_id, "failed", "Posting fehlgeschlagen")
        return False

    except Exception as e:
        log(f"❌ Posting fehlgeschlagen: {e}")
        import traceback
        log(traceback.format_exc())
        update_state(post_id, "failed", str(e))
        notify_telegram(f"🚨 <b>Mia ERROR</b>\n\nPost #{post_id}: {post_title}\n\n❌ {e}")
        return False


def main():
    log("🚀 Mia Auto-Poster gestartet")
    load_elevenlabs_config()

    post = find_next_post()
    if not post:
        log("✅ Keine Posts fällig.")
        return

    run_post(post)


if __name__ == "__main__":
    main()