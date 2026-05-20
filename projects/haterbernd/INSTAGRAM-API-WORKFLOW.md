# Instagram API Workflow – instagrapi

**Datum:** 2026-05-20
**Status:** ✅ AKTIV (ersetzt agent-browser + VPN für Instagram-Aktionen)

---

## Warum instagrapi?

**Problem mit agent-browser:**
- Instagram zeigt reCAPTCHA nach zu vielen automatisierten Logins
- CAPTCHA blockiert alle Browser-Automation (agent-browser, Firefox, Chrome)
- VPN-Proxy hilft nicht – Instagram flaggt das Browser-Verhalten, nicht die IP

**Lösung: instagrapi**
- Private Instagram API – kein Browser, kein CAPTCHA
- Session-Caching → nur einmal login, dann Cookies speichern
- Funktioniert ohne VPN-Proxy (aber VPN optional möglich)
- Schneller und zuverlässiger als Browser-Automation

---

## Installation

```bash
pip3 install --break-system-packages instagrapi
```

Session-Datei: `/root/.openclaw/workspace/projects/haterbernd/instagrapi-session.json`

---

## Login

```python
from instagrapi import Client

cl = Client()

# Session laden falls vorhanden
import os
if os.path.exists(SESSION_FILE):
    cl.load_settings(SESSION_FILE)
    cl.login("HaterBernd", "instabernd#Jungle68")
else:
    cl.login("HaterBernd", "instabernd#Jungle68")
    cl.dump_settings(SESSION_FILE)  # Session speichern
```

---

## DMs – Checken & Antworten

```python
# Inbox lesen
inbox = cl.direct_threads()

for thread in inbox:
    if not thread.users or not thread.messages:
        continue
    
    last_user = thread.users[0]
    username = last_user.username
    user_id = str(last_user.pk)
    
    last_msg = thread.messages[0]
    msg_text = getattr(last_msg, 'text', '')
    msg_user_id = str(getattr(last_msg, 'user_id', ''))
    
    # Skip eigene Nachrichten
    if msg_user_id == str(cl.user_id):
        continue
    
    # Antwort senden
    cl.direct_send("Deine Antwort hier", user_ids=[int(user_id)])
```

**Script:** `/root/.openclaw/workspace/projects/haterbernd/dm-auto-checker.py`
**Cron:** `0 9,11,13,15,17,19,21 * * *`

---

## Bilder posten (Single Image)

```python
# Bild posten
cl.photo_upload(
    "/path/to/image.jpg",
    caption="Dein Caption hier #hashtag"
)
```

---

## Karussell posten (Multiple Images)

```python
# Karussell posten (2-10 Bilder)
cl.album_upload(
    paths=["/path/to/image1.jpg", "/path/to/image2.jpg", "/path/to/image3.jpg"],
    caption="Dein Caption hier #hashtag"
)
```

---

## Reel/Video posten

```python
# Reel posten
cl.clip_upload(
    "/path/to/video.mp4",
    caption="Dein Caption hier #hashtag",
    thumbnail="/path/to/thumbnail.jpg"  # Optional
)
```

**Für HaterBernd Videos:**
1. Video mit Google Veo 3.1 generieren → `/tmp/haterbernd-*.mp4`
2. Text-Overlays mit ffmpeg hinzufügen
3. `cl.clip_upload()` zum Posten

---

## Story posten

```python
# Foto-Story
cl.photo_upload_to_story(
    "/path/to/image.jpg",
    caption="Story Text"
)

# Video-Story
cl.video_upload_to_story(
    "/path/to/video.mp4",
    caption="Story Text"
)
```

---

## User-Info & Stats

```python
# Eigene Stats
me = cl.user_info(cl.user_id)
print(me.follower_count, me.following_count, me.media_count)

# Andere User
user = cl.user_info_by_username("some_username")
print(user.pk, user.username, user.full_name)
```

---

## Bilder generieren + posten (Workflow)

**UPDATE 2026-05-20:** Bildgenerierung über **qwen-image-2.0-pro** (Alibaba Bailian), NICHT mehr Gemini!

```python
import subprocess
from instagrapi import Client

# 1. Bild generieren (qwen-image-2.0-pro)
result = subprocess.run([
    "/root/.openclaw/workspace/scripts/qwen-image-gen.sh",
    "Cold, minimalist photography...",
    "--size", "1:1",
    "--model", "qwen-image-2.0-pro"
], capture_output=True, text=True, timeout=180)

# 2. Pfad aus stdout extrahieren
image_path = extract_path_from_output(result.stdout)

# 3. Posten
cl = login()
cl.photo_upload(image_path, caption="Caption #haterbernd")
```

---

## Video generieren + posten (Workflow)

```python
import subprocess
from instagrapi import Client

# 1. Video mit Veo 3.1 generieren (via REST API)
# → /tmp/haterbernd-video.mp4

# 2. Text-Overlays mit ffmpeg
subprocess.run([
    "ffmpeg", "-i", "input.mp4",
    "-vf", "drawtext=...",
    "-c:a", "copy",
    "output.mp4"
])

# 3. Reel posten
cl = login()
cl.clip_upload("output.mp4", caption="Caption #reel")
```

---

## Session Management

**Session-Datei:** `instagrapi-session.json`
- Enthält Cookies und Login-State
- Wird nach erfolgreichem Login gespeichert
- Wird bei nächsten Run geladen → kein erneuter Login nötig

**Bei Session-Expiry:**
- Script fällt automatisch auf Fresh Login zurück
- Wenn Login fehlschlägt → Error loggen, beim nächsten Run retry

---

## VPN-Proxy

**Nicht mehr nötig für DMs!** instagrapi nutzt normale HTTP-Requests.

**Aber weiterhin empfohlen für:**
- Video-Generierung (Google Veo 3.1 via Gemini API)
- Web-Scraping wo residential IP nötig

---

## Files

| Datei | Zweck |
|-------|-------|
| `dm-auto-checker.py` | DM-Checker & Auto-Responder |
| `haterbernd-poster.py` | Auto-Poster (instagrapi-basiert) |
| `instagrapi-session.json` | Gespeicherte Login-Session |
| `schedule.json` | Posting-Schedule |
| `dm-state.json` | DM-Checker State |

---

## Wichtige Lessons Learned

1. **Browser-Automation = CAPTCHA** – Instagram erkennt Bot-Verhalten im Browser
2. **Private API = kein CAPTCHA** – instagrapi umgeht die Browser-Checks
3. **Session-Caching** – Einmal login, dann Cookies speichern
4. **Rate-Limits** – Nicht zu viele Requests in kurzer Zeit (max ~50/h)
5. **Account-Safety** – Instagram kann Accounts für API-Nutzung sperren, aber bisher stabil
