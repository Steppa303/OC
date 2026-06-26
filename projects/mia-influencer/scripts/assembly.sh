#!/bin/bash
# Mia Reel Assembly – 3-Clip, Single Reference, Amateur Look
# Usage: ./assembly.sh [veo_clip1] [veo_clip2] [veo_clip3] [audio1] [audio2] [audio3] [output]

VEO1="$1"
VEO2="$2"
VEO3="$3"
AUDIO1="$4"
AUDIO2="$5"
AUDIO3="$6"
OUTPUT="${7:-/tmp/mia-reel-fix-final.mp4}"

echo "=== Mia Reel Assembly ==="
echo "Clips: $VEO1, $VEO2, $VEO3"
echo "Audio: $AUDIO1, $AUDIO2, $AUDIO3"
echo "Output: $OUTPUT"

mkdir -p /tmp/mia-fix-tmp

# Step 1: Strip existing audio from Veo clips (kill random Veo sounds)
echo "🔇 Stripping Veo audio..."
ffmpeg -y -i "$VEO1" -an -c:v libx264 -pix_fmt yuv420p /tmp/mia-fix-tmp/v1-nosound.mp4 2>/dev/null
ffmpeg -y -i "$VEO2" -an -c:v libx264 -pix_fmt yuv420p /tmp/mia-fix-tmp/v2-nosound.mp4 2>/dev/null
ffmpeg -y -i "$VEO3" -an -c:v libx264 -pix_fmt yuv420p /tmp/mia-fix-tmp/v3-nosound.mp4 2>/dev/null

# Step 2: Apply amateur filter to each clip (slight shake, film grain, slight desaturation)
echo "🎬 Applying amateur look..."
for i in 1 2 3; do
    ffmpeg -y -i /tmp/mia-fix-tmp/v${i}-nosound.mp4 \
      -vf "crop=iw-40:ih:20:0,scale=iw:ih,grain=strength=8:tv_noise=3,colorbalance=rs=-0.03:gs=0.02:bs=-0.02,unsharp=3:3:0.3:3:3:0.0" \
      -c:v libx264 -preset fast -crf 25 -pix_fmt yuv420p \
      /tmp/mia-fix-tmp/v${i}-amateur.mp4 2>/dev/null
    echo "  ✅ Clip ${i} amateur look applied"
done

# Step 3: Concat all 3 clips
echo "🔗 Concatenating clips..."
echo "file '/tmp/mia-fix-tmp/v1-amateur.mp4'" > /tmp/mia-fix-concat.txt
echo "file '/tmp/mia-fix-tmp/v2-amateur.mp4'" >> /tmp/mia-fix-concat.txt
echo "file '/tmp/mia-fix-tmp/v3-amateur.mp4'" >> /tmp/mia-fix-concat.txt

ffmpeg -y -f concat -safe 0 -i /tmp/mia-fix-concat.txt \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  /tmp/mia-fix-tmp/video-only.mp4 2>/dev/null

# Step 4: Create combined audio with proper timing
# Audio 1: 0-3.1s (trim to 3.1), Audio 2: 3.1-7.5s (trim to 4.4), Audio 3: 7.5-12s (trim to 4.5)
ffmpeg -y -i "$AUDIO1" -i "$AUDIO2" -i "$AUDIO3" \
  -filter_complex \
  "[0:a]atrim=0:3.1,asetpts=PTS-STARTPTS[a1];\
   [1:a]atrim=0:4.4,asetpts=PTS-STARTPTS[a2];\
   [2:a]atrim=0:4.5,asetpts=PTS-STARTPTS[a3];\
   [a1][a2][a3]concat=n=3:v=0:a=1[out]" \
  -map "[out]" /tmp/mia-fix-tmp/audio-combined.mp3 2>/dev/null
echo "✅ Audio combined: $(ffprobe -v quiet -show_entries format=duration -of csv=p=0 /tmp/mia-fix-tmp/audio-combined.mp3)s"

# Step 5: Merge video + audio + amateur subtitles
ffmpeg -y -i /tmp/mia-fix-tmp/video-only.mp4 \
  -i /tmp/mia-fix-tmp/audio-combined.mp3 \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k -shortest \
  -pix_fmt yuv420p -movflags +faststart \
  -vf "drawtext=text='Wisst ihr, was ich in letzter Zeit nicht mehr verstehe?':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=26:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.35:boxborderw=8:enable='between(t,0,3.1)',\
      drawtext=text='Gendern, Sprachverbote, Cancel Culture...':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=26:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.35:boxborderw=8:enable='between(t,3.1,7.5)',\
      drawtext=text='Ich mach da einfach nicht mehr mit.':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=26:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.35:boxborderw=8:enable='between(t,7.5,9)',\
      drawtext=text='Bin ich die Einzige, die das nervt? 👇':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=28:fontcolor=white:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.35:boxborderw=8:enable='between(t,9,12)'" \
  "$OUTPUT" 2>/dev/null

echo ""
echo "=== ✅ Final Output ==="
ls -lh "$OUTPUT"
ffprobe -v quiet -print_format json -show_streams "$OUTPUT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for s in d['streams']:
    if s['codec_type']=='video':
        print(f'Video: {s.get(\"width\",\"?\")}x{s.get(\"height\",\"?\")}, {s.get(\"duration\",\"?\")}s')
    if s['codec_type']=='audio':
        print(f'Audio: {s.get(\"duration\",\"?\")}s')
"

# Cleanup
rm -rf /tmp/mia-fix-tmp /tmp/mia-fix-concat.txt