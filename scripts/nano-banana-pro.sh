#!/usr/bin/env bash
# nano-banana-pro.sh — Google Gemini Image Generation (Nano Banana Pro)
# Usage: ./nano-banana-pro.sh "prompt" [--size 16:9] [--model MODEL]
#
# Models:
#   gemini-3-pro-image-preview     (Nano Banana Pro — highest quality)
#   gemini-2.5-flash-image          (Nano Banana — fast, good for batch)
#   gemini-3.1-flash-image-preview  (Nano Banana 2 — balanced)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SECRETS_FILE="$SCRIPT_DIR/../.secrets/google-gemini.env"
if [[ -f "$SECRETS_FILE" ]]; then
  source "$SECRETS_FILE"
fi

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "ERROR: GEMINI_API_KEY not set. Create $SECRETS_FILE" >&2
  exit 1
fi

# Defaults
MODEL="gemini-3-pro-image-preview"
ASPECT_RATIO="1:1"
IMAGE_SIZE="2K"
OUTPUT_DIR="/tmp/nano-banana"
PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --size)      ASPECT_RATIO="$2"; shift 2 ;;
    --model)     MODEL="$2"; shift 2 ;;
    --imgsize)   IMAGE_SIZE="$2"; shift 2 ;;
    --output)    OUTPUT_DIR="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 \"prompt\" [--size 16:9] [--model MODEL] [--imgsize 2K] [--output DIR]"
      echo ""
      echo "Models:"
      echo "  gemini-3-pro-image-preview     (Nano Banana Pro — highest quality)"
      echo "  gemini-2.5-flash-image          (Nano Banana — fast)"
      echo "  gemini-3.1-flash-image-preview  (Nano Banana 2 — balanced)"
      echo ""
      echo "Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 4:5, 5:4, 4:1, 1:4, 8:1, 1:8"
      echo "Image sizes: 512px, 1K, 2K, 4K"
      exit 0
      ;;
    *)
      if [[ -z "$PROMPT" ]]; then PROMPT="$1"; else
        echo "ERROR: Unexpected argument: $1" >&2; exit 1
      fi
      shift ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "ERROR: Prompt required. Usage: $0 \"your prompt\"" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "🍌 Nano Banana Pro — Generating image..."
echo "   Model:   $MODEL"
echo "   Ratio:   $ASPECT_RATIO ($IMAGE_SIZE)"
echo "   Prompt:  $PROMPT"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESPONSE_FILE=$(mktemp)

HTTP_CODE=$(curl -s -w "%{http_code}" -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg prompt "$PROMPT" \
    --arg ratio "$ASPECT_RATIO" \
    --arg imgsize "$IMAGE_SIZE" \
    '{
      contents: [{ parts: [{ text: $prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: $ratio,
          imageSize: $imgsize
        }
      }
    }')" \
  -o "$RESPONSE_FILE" 2>/dev/null) || true

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: HTTP $HTTP_CODE" >&2
  cat "$RESPONSE_FILE" >&2
  rm -f "$RESPONSE_FILE"
  exit 1
fi

# Extract images
python3 - "$RESPONSE_FILE" "$OUTPUT_DIR" "$TIMESTAMP" << 'PYEOF'
import sys, json, base64, os

response_file = sys.argv[1]
output_dir = sys.argv[2]
timestamp = sys.argv[3]

data = json.load(open(response_file))

image_count = 0
for candidate in data.get('candidates', []):
    for part in candidate.get('content', {}).get('parts', []):
        if part.get('inlineData'):
            img_data = part['inlineData']['data']
            mime = part['inlineData'].get('mimeType', 'image/png')
            ext = mime.split('/')[1].replace('jpeg', 'jpg')
            filename = os.path.join(output_dir, f'nano_banana_{timestamp}_{image_count}.{ext}')
            with open(filename, 'wb') as f:
                f.write(base64.b64decode(img_data))
            print(f'📸 {filename}')
            image_count += 1
        elif part.get('text'):
            print(f'📝 {part["text"]}')

if image_count == 0:
    print('⚠️  No image in response')
PYEOF

rm -f "$RESPONSE_FILE"
echo "✅ Done."
