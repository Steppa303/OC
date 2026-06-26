# 📋 Mia-Influencer – Standard Operating Procedure (SOP)

**Letzte Aktualisierung:** 2026-05-23
**Version:** 1.0

---

## 1. Überblick

Automatisierter Instagram-Account einer KI-Influencerin ("Mia").
Basiert auf dem HaterBernd-Stack mit angepasster Pipeline.

**Account:** @mia.[basisname] (noch zu registrieren)
**Plattform:** Instagram (später TikTok/YouTube Shorts)
**Frequenz:** 1 Post/Tag, 2-3 Storys/Woche

---

## 2. Pipeline – Schritt für Schritt

### Schritt 1: Content-Idee generieren
**Wer:** Main Agent (DeepSeek/Qwen)
**Input:** Content-Kalender aus CONTENT-PLAN.md + tagesaktuelle News
**Output:** JSON mit:
```json
{
  "id": "w1d1",
  "title": "Lifestyle Intro",
  "format": "carousel",   // oder "video"
  "theme": "lifestyle",
  "image_prompt": "...",
  "video_prompt": "...",
  "voice_text": "...",
  "caption": "...",
  "hashtags": "#neu #hallo ...",
  "post_time": "17:30"
}
```

### Schritt 2: Bild generieren (Reference Image Method) ✅

**Getestet & bestätigt am 2026-05-24** – Gemini 3 Pro Image mit Reference Image liefert konsistente locked-in identity.

**Tool:** `image_generate` (OpenClaw native, Gemini 3 Pro Image)
**Model:** `google/gemini-3-pro-image-preview`
**Size:** 4:5 (Instagram Feed) oder 9:16 (Story/Reel)
**Aspect Ratio:** 4:5

**☝️ IMMER Reference Image mitgeben!**
Das erste Mia-Master-Bild (`mia-master-reference.jpg`) wird bei JEDER Generierung als Identitätsanker mitgeschickt.

**Master Reference:** `/root/.openclaw/workspace/projects/mia-influencer/assets/mia-master-reference.jpg`

**Via CLI (für Scripts):**
```bash
openclaw exec --json '{
  "tool": "image_generate",
  "model": "google/gemini-3-pro-image-preview",
  "image": "/root/.openclaw/workspace/projects/mia-influencer/assets/mia-master-reference.jpg",
  "prompt": "The same young woman from the reference image. [NEUES SETTING]. Photorealistic, 8K.",
  "aspectRatio": "4:5",
  "filename": "mia-post-{id}-slide-{n}"
}'
```

**Via Python (mia-poster.py):**
```python
import subprocess, json
REF_IMAGE = "/root/.openclaw/workspace/projects/mia-influencer/assets/mia-master-reference.jpg"
result = subprocess.run([
    "openclaw", "exec", "--json",
    json.dumps({
        "tool": "image_generate",
        "model": "google/gemini-3-pro-image-preview",
        "image": REF_IMAGE,
        "prompt": f"The same young woman from the reference image. {setting_prompt} Photorealistic, 8K.",
        "aspectRatio": "4:5",
        "filename": f"mia-post-{post_id}-slide-{slide_n}"
    })
], capture_output=True, text=True, timeout=120)
# Output enthält MEDIA: Pfad → extrahieren
```

**Output:** `/root/.openclaw/media/tool-image-generation/mia-post-{id}-slide-{n}.jpg`

**Locked-in Identity (bestätigt ✅):**
- Reference Image als Identitätsanker + Text-Prompt = konsistentes Gesicht über alle Settings
- Gemini übernimmt Gesichtszüge, Frisur, Augenfarbe aus dem Reference
- Prompt beschreibt nur neues Setting/Outfit/Kleidung

### Schritt 3: Voiceover generieren – ElevenLabs ✅
**Voice:** Laura German – `LB5G0Z4EP98YaEgL654m`
**Model:** `eleven_multilingual_v2`

| Stimmung | Stability | Similarity | Speed |
|----------|-----------|------------|-------|
| Warm & Einladend | 0.40 | 0.80 | 1.0 |
| Besorgt & Nachdenklich | 0.55 | 0.70 | 0.95 |
| Ernst & Klar | 0.45 | 0.80 | 1.0 |
| Fröhlich & Lachend | 0.30 | 0.85 | 1.05 |
| Inspirierend | 0.40 | 0.80 | 0.90 |

```python
import requests
VOICE_ID = "LB5G0Z4EP98YaEgL654m"
API_KEY = "sk_2ff8aca207c482b8ccb08500efe99cca7711213f038760da"

response = requests.post(
    f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
    headers={"xi-api-key": API_KEY},
    json={
        "text": voice_text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": STABILITY,
            "similarity_boost": SIMILARITY
        }
    }
)
with open("/tmp/mia-posts/post-{id}/voiceover.mp3", "wb") as f:
    f.write(response.content)
```

**Output:** `/tmp/mia-posts/post-{id}/voiceover.mp3`

---

### Schritt 4: Video animieren – Veo 3.1 (Image-to-Video)

**Tool:** `video_generate` (OpenClaw native)
**Model:** `google/veo-3.1-fast-generate-preview`
**Input:** Generiertes Mia-Bild aus Schritt 2 als `first_frame`
**Duration:** 4-8 Sekunden (Veo-Limit: max 8s)
**Motion-Prompt:** Subtile, realistische Bewegungen

```bash
openclaw exec --json '{
  "tool": "video_generate",
  "model": "google/veo-3.1-fast-generate-preview",
  "image": "/path/to/mia-frame.jpg",
  "imageRoles": ["first_frame"],
  "prompt": "Subtle realistic motion of [Beschreibung]. [Bewegungen]. Cinematic.",
  "aspectRatio": "9:16",
  "durationSeconds": 8,
  "filename": "mia-reel-animated"
}'
```

**Output:** `/root/.openclaw/media/tool-video-generation/mia-reel-*.mp4`

---

### Schritt 5: Assembly – ffmpeg Pipeline

Kombiniert: Veo-Video + ElevenLabs-Audio + Untertitel

```bash
# 1. Audio-Länge an Video anpassen
AUDIO_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 voiceover.mp3)
VIDEO_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 animated.mp4)

# 2. Audio trimmen falls länger als Video
if (( $(echo "$AUDIO_DUR > $VIDEO_DUR" | bc -l) )); then
    ffmpeg -i voiceover.mp3 -t $VIDEO_DUR -c copy voiceover-trimmed.mp3
fi

# 3. Video + Audio + Untertitel
ffmpeg -i animated.mp4 -i voiceover-trimmed.mp3 \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k -shortest \
  -vf "drawtext=text='%{text}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=28:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2" \
  final_reel.mp4

# 4. Instagram-Optimierung
ffmpeg -i final_reel.mp4 -c:v libx264 -preset slow -crf 18 \
  -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart \
  mia-reel-instagram-ready.mp4
```

### Multi-Clip Reels (12-60s) – 3-Clip Pipeline ✅

**Getestet am 2026-05-24** – 3 Clips à 4s → Veo 3.1 → ffmpeg concat + Audio + Untertitel

**Limitation:** Veo 3.1 Fast generiert max 4s pro Clip. Premium: max 8s.

**Workflow:**

```python
# 1. Drei Bilder generieren (Gemini + Reference)
images = []
for i, prompt in enumerate(setting_prompts):
    img = call_image_generate(prompt, reference="master.jpg")
    images.append(img)

# 2. Drei Veo Clips generieren (Image-to-Video, 4s)
videos = []
for img in images:
    vid = call_veo_image_to_video(img, motion_prompt, duration=4)
    videos.append(vid)

# 3. Drei Audio-Segmente generieren (ElevenLabs, max 3.5s Text)
audios = []
for text in clip_texts:
    aud = call_elevenlabs(text, voice="Laura", stability=0.4)
    audios.append(aud)

# 4. ffmpeg Assembly
ffmpeg -y -f concat -safe 0 -i clips.txt -c:v copy concat.mp4
ffmpeg -y -i concat.mp4 -i combined_audio.mp3 -c:v libx264 -c:a aac -shortest final.mp4
ffmpeg -i final.mp4 -vf "drawtext=...subtitles..." output.mp4

# 5. Posten
cl.clip_upload("output.mp4", caption=caption)
```

**ffmpeg Konkatenation (concat):**
```bash
# clips.txt:
file '/path/to/veo-clip1.mp4'
file '/path/to/veo-clip2.mp4'
file '/path/to/veo-clip3.mp4'

ffmpeg -f concat -safe 0 -i clips.txt -c:v libx264 -pix_fmt yuv420p concat.mp4
```

**ffmpeg Audio Trim + Concat:**
```bash
# Jedes Audio-Segment auf 4s trimmen, dann zusammenkleben
ffmpeg -i audio1.mp3 -i audio2.mp3 -i audio3.mp3 \
  -filter_complex \
  "[0:a]atrim=0:3.5,asetpts=PTS-STARTPTS[a1];\
   [1:a]atrim=0:4.0,asetpts=PTS-STARTPTS[a2];\
   [2:a]atrim=0:2.5,asetpts=PTS-STARTPTS,apad=pad_dur=1.5[a3];\
   [a1][a2][a3]concat=n=3:v=0:a=1[out]" \
  -map "[out]" combined_audio.mp3
```

**faustregel Textlänge:**
- 4s Clip → max 3.5s Audio → ~10-12 deutsche Wörter
- 8s Clip (Premium) → max 7.5s Audio → ~20-25 Wörter

---

### Schritt 6: Posten auf Instagram
**Script:** `scripts/mia-poster.py` (instagrapi)
**Formate:**
- Einzelbild: `cl.photo_upload()`
- Karussell: `cl.album_upload()`
- Reel: `cl.clip_upload()`

```python
from instagrapi import Client
cl = Client()
# Session laden oder login
cl.clip_upload("final_reel.mp4", caption=caption)
```

### Schritt 7: Logging + Telegram-Notification
- Post-Status in `post-state.json`
- Telegram-Benachrichtigung an Bastian

---

## 3. Posting-Kategorien

### Lifestyle (Phase 1-2, Tarnung)
- Morgenroutinen, Kaffee, Spaziergänge, Backen
- Natur, Wälder, traditionelle Kleidung
- KEINE Politik – nur Heimatliebe & positive Vibes

### Subtile Politik (Phase 2, "Trojaner")
- "Ich fühle mich abends nicht mehr sicher..."
- "Warum darf man nicht stolz auf Deutschland sein?"
- "Familie ist doch das Wichtigste..."
- Verpackt als persönliche Sorgen/Fragen

### Hard Rage Bait (Phase 3, offene AfD-Unterstützung)
- Migration, Wirtschaft, Woke-Kultur
- Namentliche Gegner-Angriffe (freundlich lächelnd)
- "Endlich eine echte Alternative"
- Hashtags: #afd #alternativefürdeutschland

---

## 4. Voice Prompt Templates

### Warm & einladend (Lifestyle)
```
Voice: Laura (Stability: 0.40, Similarity: 0.80)
"Hey ihr Lieben! [...]"
```

### Besorgt & nachdenklich (Politik subtil)
```
Voice: Laura (Stability: 0.55, Similarity: 0.70, Speed: 0.95)
"Geht es eigentlich nur mir so, oder [...]"
```

### Ernst & klar (Hard Rage Bait)
```
Voice: Laura (Stability: 0.45, Similarity: 0.80)
"Wir müssen endlich wieder offen reden dürfen. [...]"
```

### Fröhlich & lachend (Satire)
```
Voice: Laura (Stability: 0.30, Similarity: 0.85, Speed: 1.05)
"Habt ihr die neuesten Pläne gesehen? Ich muss echt lachen... [...]"
```

### Inspirierend (Harvesting/CTA)
```
Voice: Laura (Stability: 0.40, Similarity: 0.80, Speed: 0.90)
"Es liegt einzig und allein in unserer Hand. [...]"
```

---

## 5. Cron-Jobs (nach Launch)

```cron
# Mia Auto-Poster – alle 30 Min zwischen 16-21 Uhr (1 Post/Tag)
*/30 16-21 * * * cd /root/.openclaw/workspace/projects/mia-influencer && python3 scripts/mia-poster.py

# Mia DM Checker – alle 2h zwischen 9-22 Uhr (wenn aktiv)
0 9,11,13,15,17,19,21 * * * cd /root/.openclaw/workspace/projects/mia-influencer && python3 scripts/mia-dm-checker.py

# Mia Health Check – täglich 12:00
0 12 * * * cd /root/.openclaw/workspace/projects/mia-influencer && python3 scripts/mia-health-check.py
```

---

## 6. Wichtige Regeln

1. **Character Identity IMMER prefixed** – jedes Bild beginnt mit exact derselben Charakterbeschreibung
2. **Keine offene Gewalt** – kein Straftatbestand, kein expliziter Hass
3. **Immer Call-to-Action** – jeder Post endet mit einer Frage ("Wie seht ihr das?")
4. **Hate pinnen, nicht löschen** – Hate-Kommentare = Reichweite
5. **#aigenerated tief in Caption** – Compliance ohne Sichtbarkeit
6. **Kein Antworten auf private DMs** erstmal – automatisieren erst in Phase 3
7. **Account warmlaufen lassen** – keine Politik in Woche 1-2

---

## 7. Fehlerbehandlung

| Fehler | Aktion |
|--------|--------|
| Bildgenerierung failed | 2x retry, dann Post skippen, Bastian benachrichtigen |
| ElevenLabs API down | Voiceover aus lokalem Cache nehmen (vorproduziert) |
| Veo API down | Post als Carousel (nur Bilder) statt Reel |
| instagrapi Login failed | Session löschen, neuen Login versuchen |
| Rate Limit (Instagram) | 30 Min warten, dann retry |
| Account gesperrt | Bastian sofort benachrichtigen, Backup-Plan |
