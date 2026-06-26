#!/bin/bash
# ==========================================================
# HaterBernd Reel – Alternative 2: "Mental Health Paradoxon"
# Säule B: Emotional Detachment / Rage-Bait
# Produktion: Veo 3.1 → ElevenLabs Laura → ffmpeg Assembly
# ==========================================================
# Usage: ./reel-alternative-2-mental-health.sh
# ==========================================================

OUTPUT="/root/.openclaw/workspace/media/haterbernd-posts/mental-health-reel.mp4"

echo "=== HaterBernd Reel: Mental Health Paradoxon ==="

# -------------------------------------------------------
# CLIP 1 (4s): Leere Couch, grelles Deckenlicht
# Erzeugt Gefühl von Kälte / Einsamkeit / "Therapie-Setting"
# -------------------------------------------------------
VEO1=$(cat <<'EOF'
A minimalist, sterile psychiatrist couch made of black synthetic leather, standing alone in a brutalist concrete room. Harsh overhead fluorescent lighting, cold blue-white color temperature. Empty, abandoned. The room is silent and clinical. Slight film grain. CCTV-style slightly wide angle, 720x1280 portrait orientation, static shot with very slight micro-movement, cinematic 24fps.
EOF
)
echo "  🎬 CLIP 1: Couch (leer, kalt, Therapie-Atmo)"
# → Gemini/Veo generieren lassen, Ergebnis = /tmp/hb-alt2-clip1.mp4

# -------------------------------------------------------
# CLIP 2 (4s): Zerknüllte Affirmations-Karte fällt langsam
# Symbolisiert "I AM ENOUGH"-Kultur, die zerbröselt
# -------------------------------------------------------
VEO2=$(cat <<'EOF'
Close-up, slow-motion. A beautifully designed motivational card with gold lettering reading "I AM ENOUGH" slowly falling through darkness onto a rough concrete floor. The card catches harsh side-lighting. As it hits the ground, a tiny crack appears in the corner. Dark, cinematic, melancholic. 720x1280 portrait, 24fps, slight grain, brutalist aesthetic.
EOF
)
echo "  🎬 CLIP 2: Affirmations-Karte zerbröselt"

# -------------------------------------------------------
# CLIP 3 (4s): HaterBernd Gesicht, frontal, kalt
# Der vernichtende Blick + Text-Punchline
# -------------------------------------------------------
VEO3=$(cat <<'EOF'
Extreme close-up of a hyperrealistic masculine face with cold, emotionless eyes. Slightly unsettling uncanny valley effect. Pale skin, metallic undertones. The face looks directly into the camera with piercing intensity. Very slight head tilt. Dark background with subtle neon green rim lighting. Cinematic portrait, shallow depth of field, 720x1280 portrait, 24fps.
EOF
)
echo "  🎬 CLIP 3: HaterBernd Face (der Killer-Look)"

# -------------------------------------------------------
# CLIP 4 (4s): Black Screen mit weißer Typo
# Die finale Abrechnung
# -------------------------------------------------------
echo "  🎬 CLIP 4: Black Screen (Typo-Punchline)"

# -------------------------------------------------------
# ELEVENLABS VOICE SCRIPT – Laura German (LB5G0Z4EP98YaEgL654m)
# Tonfall: maximal monoton, gelangweilt, fast mitleidig
# -------------------------------------------------------
echo ""
echo "   ElevenLabs Voiceover Script (Laura German)"
echo "   ───────────────────────────────────────────"
echo "   Segment 1 (0-4s, Clip 1):"
echo '   "Deine Therapie-Stunde hat 120 Euro gekostet."'
echo ""
echo "   Segment 2 (4-8s, Clip 2):"
echo '   "Und das einzige was du bekommen hast, ist ein Zettel."'
echo ""
echo "   Segment 3 (8-12s, Clip 3):"
echo '   "Auf dem steht, dass du genug bist."'
echo ""
echo "   Segment 4 (12-16s, Clip 4):"
echo '   "Spoiler: Bist du nicht."'
echo ""

echo "   ⚠️ ElevenLabs Laura generieren:"
echo "   curl -X POST https://api.elevenlabs.io/v1/text-to-speech/LB5G0Z4EP98YaEgL654m \\"
echo "     -H \"xi-api-key: <KEY>\" \\"
echo '     -H "Content-Type: application/json" \\'
echo '     -d '\''{"text":"Deine Therapie-Stunde hat 120 Euro gekostet. Und das einzige was du bekommen hast, ist ein Zettel. Auf dem steht, dass du genug bist. Spoiler: Bist du nicht.","voice_settings":{"stability":0.75,"similarity_boost":0.85,"style":0.2}}'\'''
echo ""

# -------------------------------------------------------
# ASSEMBLY – ffmpeg Amateur-Look + Untertitel
# -------------------------------------------------------
ASSEMBLY_CMD=$(cat <<'ASSEMBLY'
# 1. Veo Audio strippen
ffmpeg -y -i /tmp/hb-alt2-clip1.mp4 -an -c:v libx264 -pix_fmt yuv420p /tmp/hb-tmp/v1-nosound.mp4
ffmpeg -y -i /tmp/hb-alt2-clip2.mp4 -an -c:v libx264 -pix_fmt yuv420p /tmp/hb-tmp/v2-nosound.mp4
ffmpeg -y -i /tmp/hb-alt2-clip3.mp4 -an -c:v libx264 -pix_fmt yuv420p /tmp/hb-tmp/v3-nosound.mp4
ffmpeg -y -f lavfi -i "color=c=black:s=720x1280:d=4" -c:v libx264 -pix_fmt yuv420p /tmp/hb-tmp/v4-black.mp4

# 2. Amateur-Look (grain + color shift + unsharp)
for i in 1 2 3; do
    ffmpeg -y -i /tmp/hb-tmp/v${i}-nosound.mp4 \
      -vf "crop=iw-40:ih:20:0,scale=iw:ih,grain=strength=8:tv_noise=3,colorbalance=rs=-0.03:gs=0.02:bs=-0.02,unsharp=3:3:0.3:3:3:0.0" \
      -c:v libx264 -preset fast -crf 25 -pix_fmt yuv420p \
      /tmp/hb-tmp/v${i}-amateur.mp4
done
cp /tmp/hb-tmp/v4-black.mp4 /tmp/hb-tmp/v4-amateur.mp4

# 3. Concat alle 4 Clips
echo "file '/tmp/hb-tmp/v1-amateur.mp4'" > /tmp/hb-tmp/concat.txt
echo "file '/tmp/hb-tmp/v2-amateur.mp4'" >> /tmp/hb-tmp/concat.txt
echo "file '/tmp/hb-tmp/v3-amateur.mp4'" >> /tmp/hb-tmp/concat.txt
echo "file '/tmp/hb-tmp/v4-amateur.mp4'" >> /tmp/hb-tmp/concat.txt

ffmpeg -y -f concat -safe 0 -i /tmp/hb-tmp/concat.txt \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  /tmp/hb-tmp/video-only.mp4

# 4. Untertitel + Audio muxen
ffmpeg -y -i /tmp/hb-tmp/video-only.mp4 \
  -i /tmp/hb-elevenlabs-audio.mp3 \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k -shortest \
  -pix_fmt yuv420p -movflags +faststart \
  -vf "drawtext=text='Deine Therapie-Stunde hat 120 Euro gekostet.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.4:boxborderw=8:enable='between(t,0,4)',\
      drawtext=text='Und das einzige was du bekommen hast...':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.4:boxborderw=8:enable='between(t,4,8)',\
      drawtext=text='...ist ein Zettel. Auf dem steht: Du bist genug.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.4:boxborderw=8:enable='between(t,8,12)',\
      drawtext=text='Spoiler: Bist du nicht.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=32:fontcolor=white:shadowcolor=black@0.8:shadowx=3:shadowy=3:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.6:boxborderw=10:enable='between(t,12,16)|\
      drawtext=text='DU BIST NICHT GENUG':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=36:fontcolor=white:shadowcolor=black@0.8:shadowx=3:shadowy=3:x=(w-text_w)/2:y=h-260:box=1:boxcolor=black@0.5:boxborderw=12:enable='between(t,12,16)'" \
  "/root/.openclaw/workspace/media/haterbernd-posts/mental-health-reel.mp4"
ASSEMBLY
)
echo "   ffmpeg Assembly-Befehl siehe Script-Kommentare ⬆️"
echo ""

# -------------------------------------------------------
# CAPTION (Instagram Post Text)
# -------------------------------------------------------
cat <<'CAPTION_EOF'

📝 CAPTION (Instagram-Post):

───────────────────────────────────────
120 Euro pro Stunde. Einmal pro Woche. Seit 3 Jahren.

Und weisst du was du gelernt hast?
Dass du "genug" bist.
Dass du dir "selbst verzeihen" sollst.
Dass deine "Gefuehle valide" sind.

Bro. Ich hab dir grad in 16 Sekunden gesagt, was dein Therapeut
dir in 3 Jahren nicht sagen durfte: Du bist nicht genug.
Und das ist okay. Aber hoer auf, eine Diagnose als Persoenlichkeit
zu tragen.

"Trauma" ist kein Fashion-Statement.
"Therapie" ist kein Persoenlichkeitsmerkmal.
Und "Self-Care" ist kein Ersatz fuer Charakter.

Schick das an jemanden, der in seiner Bio "good vibes only" stehen hat.
Wir wissen beide, wer gemeint ist.
───────────────────────────────────────

#mentalhealth #therapy #selfcare #toxicpositivity #goodvibesonly
#wellness #trauma #healingjourney #haterbernd

⚠️ RECHTSCHREIBFEHLER ABSICHTLICH: "weisst" statt "weißt",
"hoer" statt "hör" – triggert die Korinthenkacker in den Kommentaren!
CAPTION_EOF

echo ""
echo "=== ✅ PRODUKTIONS-SCRIPT READY ==="
echo "Output: $OUTPUT"