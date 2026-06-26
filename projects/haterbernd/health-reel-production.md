# HaterBernd Reel – "Health & Fitness Fanatiker"
**Produktions-Ready | Stand: 25.05.2026 | V2.0**

---

## Zielgruppe
Ernährungs-Sekten aller Art: Veganer, Keto-Jünger, Carnivore-Brüder, Biohacker, Supplement-Junkies. Leute deren ganze Persönlichkeit aus Diät und Training besteht.

---

## Szenen & Timing (16s, 4 Clips à 4s)

### Szene 1 (0-4s)
**Bild:** Makellos aufgeräumter Kühlschrank. Alles in exakt gleichen Behältern sortiert. Grünkohl, Möhren, Brokkoli. Sieht aus wie ein Labor, nicht wie Essen. Kaltes Neonlicht, brutalistische Ästhetik.

**Untertitel (via drawtext):**
"Du isst seit 3 Jahren nur noch Grünkohl..."

### Szene 2 (4-8s)
**Bild:** Nahaufnahme – Hand legt ein Salatblatt auf eine digitale Küchenwaage. Anzeige: exakt 7g. Saubere Typografie auf der Waage.

**Untertitel:**
"...und denkst, du hättest dich weiterentwickelt."

### Szene 3 (8-12s)
**Bild:** Nur Beine einer Person auf einem Laufband. Grauer, industrieller Hintergrund. Bewegung mechanisch, kein Genuss. Leere im Blick.

**Untertitel:**
"Aber wenn ich mit dir reden will – worüber reden wir dann?"

### Szene 4 (12-16s)
**Bild:** Black Screen. Weiße Typo zentriert:
**"ÜBER DEINE VERDAUUNG?"**
(2s Pause, dann zweite Zeile)
**"NEIN."**

**Untertitel:**
"Über deine Verdauung? Nein."

---

## Voiceover
**ElevenLabs Voice ID:** `zE5bg9yEnLXRqxMf3xUj` (Custom Voice, wie bisher)

**Text (komplett):**
> Du isst seit 3 Jahren nur noch Grünkohl und denkst, du hättest dich weiterentwickelt. Du trackst jeden Bissen. Du nimmst 27 Supplemente am Tag. Aber mal ganz ehrlich – wenn ich mit dir reden will... worüber reden wir dann? Über deine Verdauung? Nein.

**ElevenLabs API Call:**
```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/zE5bg9yEnLXRqxMf3xUj" \
  -H "xi-api-key: DEIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Du isst seit 3 Jahren nur noch Grünkohl und denkst, du hättest dich weiterentwickelt. Du trackst jeden Bissen. Du nimmst 27 Supplemente am Tag. Aber mal ganz ehrlich – wenn ich mit dir reden will... worüber reden wir dann? Über deine Verdauung? Nein.",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
      "stability": 0.7,
      "similarity_boost": 0.8,
      "style": 0.15
    }
  }' \
  --output /tmp/hb-health-reel-audio.mp3
```

---

## Caption (Instagram-Post)

Es gibt Leute, die haben Hobbys. Du hast eine Diät.

Es gibt Leute, die reden ueber Bücher oder Musik oder irgendwas. Du redest ueber deine Verdauung und wie teuer dein Creatin war.

Du bist kein Gesundheitsfanatiker. Du bist eine Essstoerung mit Instagram-Plattform.

Und nein, niemand fragt nach deinen Makros. Nie. 🥦

#fitness #ernaehrung #biohacking #vegan #fitnessmotivation #health #workout #haterbernd

---

## ffmpeg Assembly (ohne Amateur-Look, clean)

```bash
# Vorbereitung
mkdir -p /tmp/hb-health-tmp

# 1. Audio strippen von Veo-Clips
ffmpeg -y -i /tmp/hb-health-clip1.mp4 -an -c:v libx264 -pix_fmt yuv420p /tmp/hb-health-tmp/v1.mp4
ffmpeg -y -i /tmp/hb-health-clip2.mp4 -an -c:v libx264 -pix_fmt yuv420p /tmp/hb-health-tmp/v2.mp4
ffmpeg -y -i /tmp/hb-health-clip3.mp4 -an -c:v libx264 -pix_fmt yuv420p /tmp/hb-health-tmp/v3.mp4
ffmpeg -y -f lavfi -i "color=c=black:s=720x1280:d=4" -c:v libx264 -pix_fmt yuv420p /tmp/hb-health-tmp/v4.mp4

# 2. Concat alle 4 Clips
echo "file '/tmp/hb-health-tmp/v1.mp4'" > /tmp/hb-health-tmp/concat.txt
echo "file '/tmp/hb-health-tmp/v2.mp4'" >> /tmp/hb-health-tmp/concat.txt
echo "file '/tmp/hb-health-tmp/v3.mp4'" >> /tmp/hb-health-tmp/concat.txt
echo "file '/tmp/hb-health-tmp/v4.mp4'" >> /tmp/hb-health-tmp/concat.txt

ffmpeg -y -f concat -safe 0 -i /tmp/hb-health-tmp/concat.txt \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  /tmp/hb-health-tmp/video-only.mp4

# 3. Audio + Untertitel muxen (clean, kein Amateur-Look)
ffmpeg -y -i /tmp/hb-health-tmp/video-only.mp4 \
  -i /tmp/hb-health-reel-audio.mp3 \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k -shortest \
  -pix_fmt yuv420p -movflags +faststart \
  -vf "drawtext=text='Du isst seit 3 Jahren nur noch Gruenkohl...':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.35:boxborderw=8:enable='between(t,0,4)',\
      drawtext=text='...und denkst, du haettest dich weiterentwickelt.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.35:boxborderw=8:enable='between(t,4,8)',\
      drawtext=text='Aber wenn ich mit dir reden will...':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.35:boxborderw=8:enable='between(t,8,12)',\
      drawtext=text='Ueber deine Verdauung?':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=32:fontcolor=white:shadowcolor=black@0.8:shadowx=3:shadowy=3:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.5:boxborderw=10:enable='between(t,12,14)',\
      drawtext=text='Nein.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=42:fontcolor=white:shadowcolor=black@0.8:shadowx=3:shadowy=3:x=(w-text_w)/2:y=h-100:box=1:boxcolor=black@0.6:boxborderw=12:enable='between(t,14,16)'" \
  "/root/.openclaw/workspace/media/haterbernd-posts/health-reel-final.mp4"
```

---

## Output
`/root/.openclaw/workspace/media/haterbernd-posts/health-reel-final.mp4`
 
Format: 720×1280, ~16s, H.264, AAC Audio, keine Amateur-Filter