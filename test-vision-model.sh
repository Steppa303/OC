#!/bin/bash
# Test Qwen VL vision model via OpenRouter
cd /root/.local/.openclaw/workspace

# Create a simple test image with text
python3 -c "
from PIL import Image, ImageDraw, ImageFont
img = Image.new('RGB', (400, 200), 'white')
d = ImageDraw.Draw(img)
d.text((20, 50), 'Hagebau Marktauswahl', fill='black')
d.text((20, 90), '1. Bauhaus Kassel', fill='black')
d.text((20, 120), '2. Dreyer Baumarkt', fill='black')
d.text((20, 150), '3. Obi Hannover', fill='black')
d.text((20, 180), 'Dreyer ist ausgewählt', fill='green')
img.save('/tmp/test-vision.png')
echo 'Test image created'
"

# Test with curl to OpenRouter
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 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" \
  -d '{
    "model": "qwen/qwen2.5-vl-72b-instruct:free",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "What option numbers and text do you see in this image? Which one is selected?"},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,'$(base64 -w0 /tmp/test-vision.png)'"}}
        ]
      }
    ],
    "max_tokens": 200
  }' 2>&1 | python3 -c "
import json,sys
data = json.load(sys.stdin)
if 'choices' in data:
    print('✅ SUCCESS')
    print(data['choices'][0]['message']['content'])
elif 'error' in data:
    print('❌ ERROR:', data['error'].get('message', str(data['error'])))
else:
    print('❓ UNKNOWN:', json.dumps(data, indent=2)[:500])
"