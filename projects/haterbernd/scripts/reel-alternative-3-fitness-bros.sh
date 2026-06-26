#!/bin/bash
# ==========================================================
# HaterBernd Reel – Alternative 3: "Der Spiegel lügt nicht"
# Säule B: Emotional Detachment – Fitness Bros Edition
# Produktion: Veo 3.1 → ElevenLabs Laura → ffmpeg Assembly
# ==========================================================

OUTPUT="/root/.openclaw/workspace/media/haterbernd-posts/fitness-bros-reel.mp4"

echo "=== HaterBernd Reel: Der Spiegel luegt nicht ==="

# -------------------------------------------------------
# CLIP 1 (4s): Einsame Hantel auf Betonboden
# "Der Altar" – Symbol für sinnlosen Kult
# -------------------------------------------------------
VEO1=$(cat <<'EOF'
A single heavy iron dumbbell lying alone on a rough concrete floor in an empty gym. Harsh overhead fluorescent lighting casting deep shadows. The dumbbell looks heavy, cold, abandoned. Through a window in the background, darkness. No people. Brutalist, melancholic atmosphere. Slight film grain, 720x1280 portrait, 24fps, static with subtle micro-movement.
EOF
)
echo "  🎬 CLIP 1: Die einsame Hantel"

# -------------------------------------------------------
# CLIP 2 (4s): Spiegel-Selfie-POV, Handy zeigt ERROR
# "Dein ganzer Stolz in einem Bild"
# -------------------------------------------------------
VEO2=$(cat <<'EOF'
POV shot of someone holding a smartphone in front of a gym mirror. The phone screen shows a corrupted image with a red "ERROR 404: PERSONALITY NOT FOUND" message glitching. In the mirror reflection, a muscular silhouette is visible but the face is blurred/pixelated. Dark gym lighting, neon edge lights. Uncanny, unsettling. 720x1280 portrait, 24fps, slight handheld shake.
EOF
)
echo "  🎬 CLIP 2: Selfie mit Error-Screen"

# -------------------------------------------------------
# CLIP 3 (4s): HaterBernd Gesicht, leicht schräg
# Der Moment der Wahrheit
# -------------------------------------------------------
VEO3=$(cat <<'EOF'
Hyperrealistic masculine face, emotionless, cold. Slight tilt of the head, looking down at the camera with utter contempt. Neon green accent lighting on one side of the face, deep shadows on the other. Very slight uncanny valley effect. Cinematic portrait, 720x1280 portrait, 24fps, shallow depth of field.
EOF
)
echo "  🎬 CLIP 3: HaterBernd Face (Verachtung pur)"

# -------------------------------------------------------
# CLIP 4 (4s): Black Screen mit weißer Typo
# -------------------------------------------------------
echo "  🎬 CLIP 4: Black Screen (Finaler Punch)"

# -------------------------------------------------------
# ELEVENLABS VOICE SCRIPT – Laura German
# -------------------------------------------------------
echo ""
echo "   ElevenLabs Voiceover Script (Laura German)"
echo "   ───────────────────────────────────────────"
echo "   Segment 1 (0-4s, Clip 1):"
echo '   "4 Stunden am Tag. 6 mal die Woche."'
echo ""
echo "   Segment 2 (4-8s, Clip 2):"
echo '   "Und das einzige was dabei rauskommt, ist ein Spiegel-Selfie."'
echo ""
echo "   Segment 3 (8-12s, Clip 3):"
echo '   "Mit mehr Muskelmasse als Persoenlichkeit."'
echo ""
echo "   Segment 4 (12-16s, Clip 4):"
echo '   "Dein Koerper ist dein Tempel. Schaade, dass niemand drin betet."'
echo ""

echo "   ⚠️ ElevenLabs Laura generieren:"
echo "   curl -X POST https://api.elevenlabs.io/v1/text-to-speech/LB5G0Z4EP98YaEgL654m \\"
echo "     -H \"xi-api-key: <KEY>\" \\"
echo '     -H "Content-Type: application/json" \\'
echo '     -d '\''{"text":"4 Stunden am Tag. 6 mal die Woche. Und das einzige was dabei rauskommt, ist ein Spiegel-Selfie. Mit mehr Muskelmasse als Persoenlichkeit. Dein Koerper ist dein Tempel. Schaade, dass niemand drin betet.","voice_settings":{"stability":0.75,"similarity_boost":0.85,"style":0.15}}'\'''
echo ""

# -------------------------------------------------------
# ASSEMBLY – ffmpeg
# -------------------------------------------------------
cat <<'ASSEMBLY'
ffmpeg -y -i /tmp/hb-alt3-clip1.mp4 -an -c:v libx264 -pix_fmt yuv420p /tmp/hb-tmp3/v1-nosound.mp4 \
&& ffmpeg -y -i /tmp/hb-alt3-clip2.mp4 -an -c:v libx264 -pix_fmt yuv420p /tmp/hb-tmp3/v2-nosound.mp4 \
&& ffmpeg -y -i /tmp/hb-alt3-clip3.mp4 -an -c:v libx264 -pix_fmt yuv420p /tmp/hb-tmp3/v3-nosound.mp4 \
&& ffmpeg -y -f lavfi -i "color=c=black:s=720x1280:d=4" -c:v libx264 -pix_fmt yuv420p /tmp/hb-tmp3/v4-black.mp4 \
&& for i in 1 2 3; do
  ffmpeg -y -i /tmp/hb-tmp3/v${i}-nosound.mp4 \
    -vf "crop=iw-40:ih:20:0,scale=iw:ih,grain=strength=8:tv_noise=3,colorbalance=rs=-0.03:gs=0.02:bs=-0.02,unsharp=3:3:0.3:3:3:0.0" \
    -c:v libx264 -preset fast -crf 25 -pix_fmt yuv420p \
    /tmp/hb-tmp3/v${i}-amateur.mp4
done \
&& cp /tmp/hb-tmp3/v4-black.mp4 /tmp/hb-tmp3/v4-amateur.mp4 \
&& { echo "file '/tmp/hb-tmp3/v1-amateur.mp4'"
   echo "file '/tmp/hb-tmp3/v2-amateur.mp4'"
   echo "file '/tmp/hb-tmp3/v3-amateur.mp4'"
   echo "file '/tmp/hb-tmp3/v4-amateur.mp4'"; } > /tmp/hb-tmp3/concat.txt \
&& ffmpeg -y -f concat -safe 0 -i /tmp/hb-tmp3/concat.txt \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p /tmp/hb-tmp3/video-only.mp4 \
&& ffmpeg -y -i /tmp/hb-tmp3/video-only.mp4 \
  -i /tmp/hb-elevenlabs-alt3.mp3 \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest \
  -pix_fmt yuv420p -movflags +faststart \
  -vf "drawtext=text='4 Stunden am Tag. 6 mal die Woche.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.4:boxborderw=8:enable='between(t,0,4)',\
      drawtext=text='Und das einzige was dabei rauskommt...':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.4:boxborderw=8:enable='between(t,4,8)',\
      drawtext=text='...ist ein Spiegel-Selfie mit Filter.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.4:boxborderw=8:enable='between(t,8,11)',\
      drawtext=text='Mehr Muskeln als Persoenlichkeit.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.4:boxborderw=8:enable='between(t,11,13)',\
      drawtext=text='Dein Koerper ist dein Tempel.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=24:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.4:boxborderw=8:enable='between(t,13,15)',\
      drawtext=text='Schade, dass niemand drin betet. 🙏':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=30:fontcolor=white:shadowcolor=black@0.8:shadowx=3:shadowy=3:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.5:boxborderw=10:enable='between(t,15,17)'" \
  "/root/.openclaw/workspace/media/haterbernd-posts/fitness-bros-reel.mp4"
ASSEMBLY

# -------------------------------------------------------
# CAPTION
# -------------------------------------------------------
cat <<'CAPTION_EOF'

📝 CAPTION (Instagram-Post):

───────────────────────────────────────
4 Stunden Gym. 2 Shakes. 1 Spiegel-Selfie.

Und dein Fazit am Ende des Tages?
"Hab diesmal 5kg mehr Bankdruecken geschafft."

Herzlichen Glueckwunsch. Du hast eine Eisenstange
von A nach B bewegt. Das koennte ein Roboter auch.
Tut er uebrigens auch. Mit 1000% mehr Praezision.

Aber red dir ruhig weiter ein, dass dein Bizeps
die Leerstelle in deiner Persoenlichkeit fuellt.
Dein Koerper ist dein Tempel.
Schade, dass niemand drin betet.

Schick das an jemanden, der mehr Sauna als
Sozialkompetenz besitzt. 💀
───────────────────────────────────────

#gym #fitnessmotivation #gymbro #bodybuilding #fitfam
#gymlife #fitness #workout #hustle #haterbernd

⚠️ RECHTSCHREIBFEHLER ABSICHTLICH: "Glueckwunsch" statt "Glückwunsch",
"druecken" statt "drücken", "koennte" statt "könnte"
CAPTION_EOF

echo ""
echo "=== ✅ PRODUKTIONS-SCRIPT READY ==="
echo "Output: $OUTPUT"