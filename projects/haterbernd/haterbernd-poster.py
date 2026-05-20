#!/usr/bin/env python3
"""
HaterBernd Auto-Poster (instagrapi version)
Läuft alle 30 Min via Cron. Postet Bilder, Karussels und Reels.

Cron: */30 16-21 * * *
"""

import json
import os
import sys
import logging
import time
from datetime import datetime
from instagrapi import Client

SCHEDULE_FILE = "/root/.openclaw/workspace/projects/haterbernd/schedule.json"
STATE_FILE = "/root/.openclaw/workspace/projects/haterbernd/post-state.json"
SESSION_FILE = "/root/.openclaw/workspace/projects/haterbernd/instagrapi-session.json"
IMAGE_GEN_SCRIPT = "/root/.openclaw/workspace/scripts/qwen-image-gen.sh"
IMG_DIR = "/tmp/haterbernd-posts"
SCREENSHOT_DIR = "/root/.openclaw/workspace/media/haterbernd-posts"
LOG_FILE = "/tmp/haterbernd-poster.log"

USERNAME = "HaterBernd"
PASSWORD = "instabernd#Jungle68"
TELEGRAM_CHAT_ID = "1400987471"

os.makedirs(IMG_DIR, exist_ok=True)
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# ==================== TELEGRAM ====================

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

def notify_telegram(message, screenshot=None):
    if not TELEGRAM_BOT_TOKEN:
        return
    try:
        import requests
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

# ==================== LOGGING ====================

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

# ==================== INSTAGRAM LOGIN ====================

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

# ==================== SCHEDULE LOGIC ====================

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

# ==================== IMAGE GENERATION ====================

def generate_images(post):
    post_id = post["id"]
    post_dir = os.path.join(IMG_DIR, f"post-{post_id}")
    os.makedirs(post_dir, exist_ok=True)
    
    slides = post.get("slides", [])
    generated = []
    
    for i, slide in enumerate(slides):
        prompt = slide["prompt"]
        size = slide.get("size", "1:1")
        imgsize = slide.get("imgsize", "2K")
        outfile = os.path.join(post_dir, f"slide-{i+1}.jpg")
        
        log(f"  🎨 Generiere Slide {i+1}/{len(slides)} [{size}, {imgsize}]...")
        
        import subprocess
        try:
            result = subprocess.run([
                IMAGE_GEN_SCRIPT, prompt,
                "--size", size,
                "--output", post_dir
            ], capture_output=True, text=True, timeout=180)
            
            if result.returncode != 0:
                log(f"  ❌ Slide {i+1} fehlgeschlagen: {result.stderr[:200]}")
                return None
            
            # Find generated image in stdout
            for line in result.stdout.strip().split("\n"):
                if "📸" in line:
                    src = line.replace("📸", "").strip()
                    if os.path.exists(src):
                        os.rename(src, outfile)
                        log(f"  ✅ Slide {i+1} → {outfile}")
                        generated.append(outfile)
                        break
        except subprocess.TimeoutExpired:
            log(f"  ❌ Slide {i+1} timeout")
            return None
    
    # Save meta
    meta = {
        "post_id": post_id,
        "title": post["title"],
        "slide_count": len(slides),
        "caption": post["caption"],
        "hashtags": post.get("hashtags", ""),
        "full_caption": post["caption"] + "\n\n" + post.get("hashtags", ""),
        "slide_files": generated,
        "format": post.get("format", "carousel")
    }
    with open(os.path.join(post_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    
    return post_dir

# ==================== POSTING ====================

def post_single(cl, post_dir, meta):
    """Post single image."""
    image_path = meta["slide_files"][0]
    caption = meta["full_caption"]
    log(f"  📤 Poste Einzelbild: {image_path}")
    cl.photo_upload(image_path, caption=caption)
    return True

def post_carousel(cl, post_dir, meta):
    """Post carousel/album."""
    image_paths = meta["slide_files"]
    caption = meta["full_caption"]
    log(f"  📤 Poste Karussell ({len(image_paths)} Bilder)")
    cl.album_upload(image_paths, caption=caption)
    return True

def post_reel(cl, post):
    """Post reel/video."""
    video_path = post.get("video_path", "")
    caption = post["caption"] + "\n\n" + post.get("hashtags", "")
    
    if not video_path or not os.path.exists(video_path):
        log(f"  ❌ Video-Datei nicht gefunden: {video_path}")
        return False
    
    log(f"  🎬 Poste Reel: {video_path}")
    cl.clip_upload(video_path, caption=caption)
    return True

def run_post(post):
    post_id = post["id"]
    post_title = post["title"]
    post_format = post.get("format", "carousel")
    
    log("=" * 50)
    log(f"📋 Post #{post_id}: '{post_title}'")
    log(f"   📝 Format: {post_format}")
    log("=" * 50)
    
    try:
        cl = login()
    except Exception as e:
        log(f"❌ Login fehlgeschlagen: {e}")
        update_state(post_id, "failed", f"Login failed: {e}")
        notify_telegram(f"🚨 <b>HaterBernd ERROR</b>\n\nPost #{post_id}: {post_title}\n\n❌ Login fehlgeschlagen.")
        return False
    
    try:
        if post_format == "reel":
            # Reel posting
            if post_reel(cl, post):
                update_state(post_id, "success", "Reel gepostet via instagrapi")
                log("✅ Reel erfolgreich!")
                notify_telegram(f"✅ <b>HaterBernd Reel veröffentlicht!</b>\n\nPost #{post_id}: {post_title}")
                return True
        else:
            # Image/Carousel posting
            post_dir = generate_images(post)
            if not post_dir:
                log("❌ Bildgenerierung fehlgeschlagen!")
                update_state(post_id, "failed", "Bildgenerierung fehlgeschlagen")
                notify_telegram(f"🚨 <b>HaterBernd ERROR</b>\n\nPost #{post_id}: {post_title}\n\n❌ Bildgenerierung fehlgeschlagen.")
                return False
            
            meta_file = os.path.join(post_dir, "meta.json")
            with open(meta_file) as f:
                meta = json.load(f)
            
            if post_format == "single" or len(meta["slide_files"]) == 1:
                if post_single(cl, post_dir, meta):
                    update_state(post_id, "success", "Einzelbild gepostet via instagrapi")
                    log("✅ Einzelbild erfolgreich!")
                    notify_telegram(f"✅ <b>HaterBernd Post veröffentlicht!</b>\n\nPost #{post_id}: {post_title}")
                    return True
            else:
                if post_carousel(cl, post_dir, meta):
                    update_state(post_id, "success", "Karussell gepostet via instagrapi")
                    log("✅ Karussell erfolgreich!")
                    notify_telegram(f"✅ <b>HaterBernd Karussell veröffentlicht!</b>\n\nPost #{post_id}: {post_title}")
                    return True
        
        update_state(post_id, "failed", "Posting fehlgeschlagen")
        notify_telegram(f"🚨 <b>HaterBernd ERROR</b>\n\nPost #{post_id}: {post_title}\n\n❌ Posting fehlgeschlagen.")
        return False
        
    except Exception as e:
        log(f"❌ Posting fehlgeschlagen: {e}")
        import traceback
        log(traceback.format_exc())
        update_state(post_id, "failed", str(e))
        notify_telegram(f"🚨 <b>HaterBernd ERROR</b>\n\nPost #{post_id}: {post_title}\n\n❌ {e}")
        return False

# ==================== MAIN ====================

def main():
    log("🚀 HaterBernd Auto-Poster (instagrapi) gestartet")
    
    post = find_next_post()
    if not post:
        log("✅ Keine Posts fällig.")
        return
    
    run_post(post)

if __name__ == "__main__":
    main()
