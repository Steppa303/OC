#!/usr/bin/env bash
# qwen-image-gen.sh — Alibaba Bailian Token Plan Image Generation
# Model: qwen-image-2.0-pro (primary)
# Usage: ./qwen-image-gen.sh "prompt" [--size 1:1] [--model qwen-image-2.0-pro]
#
# Models:
#   qwen-image-2.0-pro    (Primary — beste Qualität, 2048x2048)
#   qwen-image-2.0        (Standard — schneller, gut für Entwürfe)
#   wan2.7-image-pro      (WanX Pro — alternative Qualität)
#   wan2.7-image          (WanX Standard — schnell)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SECRETS_FILE="$SCRIPT_DIR/../.secrets/bailian.env"
if [[ -f "$SECRETS_FILE" ]]; then
  source "$SECRETS_FILE"
fi

if [[ -z "${BAILIAN_API_KEY:-}" ]]; then
  echo "ERROR: BAILIAN_API_KEY not set. Create $SECRETS_FILE" >&2
  exit 1
fi

# Defaults
MODEL="qwen-image-2.0-pro"
ASPECT_RATIO="1:1"
OUTPUT_DIR="/tmp/qwen-images"
PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --size)      ASPECT_RATIO="$2"; shift 2 ;;
    --model)     MODEL="$2"; shift 2 ;;
    --output)    OUTPUT_DIR="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 \"prompt\" [--size 1:1] [--model MODEL] [--output DIR]"
      echo ""
      echo "Models:"
      echo "  qwen-image-2.0-pro    (Primary — beste Qualität)"
      echo "  qwen-image-2.0        (Standard — schneller)"
      echo "  wan2.7-image-pro      (WanX Pro)"
      echo "  wan2.7-image          (WanX Standard)"
      echo ""
      echo "Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3"
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

echo "🎨 Qwen Image Generation — $MODEL"
echo "   Ratio:   $ASPECT_RATIO"
echo "   Prompt:  $PROMPT"

BASE_URL="https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESPONSE_FILE=$(mktemp)

# Multimodal chat API call
HTTP_CODE=$(curl -s -w "%{http_code}" -X POST \
  "${BASE_URL}/chat/completions" \
  -H "Authorization: Bearer ${BAILIAN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg model "$MODEL" \
    --arg prompt "$PROMPT" \
    '{
      model: $model,
      messages: [{
        role: "user",
        content: [{ type: "text", text: $prompt }]
      }],
      stream: false
    }')" \
  -o "$RESPONSE_FILE" 2>/dev/null) || true

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: HTTP $HTTP_CODE" >&2
  cat "$RESPONSE_FILE" >&2
  rm -f "$RESPONSE_FILE"
  exit 1
fi

# Extract image URL and download
python3 - "$RESPONSE_FILE" "$OUTPUT_DIR" "$TIMESTAMP" << 'PYEOF'
import sys, json, requests, os

response_file = sys.argv[1]
output_dir = sys.argv[2]
timestamp = sys.argv[3]

data = json.load(open(response_file))

# Extract image URL from multimodal response
image_url = None
for choice in data.get("output", {}).get("choices", []):
    msg = choice.get("message", {})
    content = msg.get("content", [])
    for part in content:
        if "image" in part:
            image_url = part["image"]
            break
    if image_url:
        break

if not image_url:
    # Fallback: check for image in data field
    for choice in data.get("choices", []):
        msg = choice.get("message", {})
        content = msg.get("content", [])
        for part in content:
            if "image" in part:
                image_url = part["image"]
                break
        if image_url:
            break

if not image_url:
    print("⚠️  No image URL in response")
    print(json.dumps(data, indent=2)[:500])
    sys.exit(1)

# Download image
r = requests.get(image_url, timeout=60)
if r.status_code == 200:
    # Determine extension from content type or default to png
    ct = r.headers.get("content-type", "image/png")
    ext = ct.split("/")[-1].replace("jpeg", "jpg").split("+")[0]
    filename = os.path.join(output_dir, f"qwen_{timestamp}.{ext}")
    with open(filename, "wb") as f:
        f.write(r.content)
    print(f"📸 {filename}")
    
    # Print usage info
    usage = data.get("usage", {})
    if usage:
        w = usage.get("width", "?")
        h = usage.get("height", "?")
        print(f"📐 Resolution: {w}x{h}")
else:
    print(f"ERROR: Failed to download image (HTTP {r.status_code})")
    sys.exit(1)
PYEOF

rm -f "$RESPONSE_FILE"
echo "✅ Done."
