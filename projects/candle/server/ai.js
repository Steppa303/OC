const fs = require('fs');
const path = require('path');

// Load Gemini API key
try {
  const envPath = path.join('/root/.openclaw/workspace/.secrets', 'google-gemini.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  }
} catch (e) { /* ignore */ }

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.VISION_MODEL || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Du siehst ein Bild, das ein User auf einem digitalen Canvas gezeichnet hat.

Deine Aufgabe:
1. Analysiere was der User gemalt hat
2. Antworte mit einem kurzen Text (max 2 Sätzen) was du siehst
3. Wenn der User eine Anweisung geschrieben hat (z.B. "gib ihm eine Freundin"), führe sie aus
4. Zeichne deine Antwort direkt auf das Canvas

Antwort-Format (JSON):
{
  "text": "Deine Text-Antwort",
  "drawing": [
    { "type": "line", "x1": 100, "y1": 200, "x2": 150, "y2": 250 },
    { "type": "circle", "cx": 300, "cy": 400, "r": 20 },
    { "type": "path", "points": [[x1,y1], [x2,y2], ...] },
    { "type": "text", "x": 400, "y": 300, "content": "Hallo!", "font": "24px sans-serif" }
  ]
}

Regeln:
- Halte dich an den Stil des Users (Strichmännchen → Strichmännchen)
- Zeichne nicht über den Content des Users
- Positioniere deine Zeichnung relativ zum bestehenden Content (z.B. "neben dem Kreis", "unter dem Text", "rechts daneben")
- Wenn du absolute Koordinaten verwendest, orientiere dich an der Canvas-Größe (wird im Prompt angegeben)
- Antworte auf Deutsch
- Zeichne mit Farbe #666666 und Strichstärke 2
- WICHTIG: Antworte NUR mit dem JSON-Objekt, kein anderer Text
- Wenn das Bild leer oder unerkennbar ist, antworte mit: {"text": "Ich sehe noch nichts — mal mir was!", "drawing": null}`;

/**
 * Analyze a canvas image using Google Gemini Vision API
 */
async function analyzeCanvas(canvasPng, previousInteractions = [], canvasDimensions = null) {
  try {
    const base64Data = canvasPng.replace(/^data:image\/png;base64,/, '');

    // Build context from previous interactions
    let context = '';
    if (previousInteractions.length > 0) {
      const lastFew = previousInteractions.slice(-3);
      context = '\n\nVorherige Interaktionen:\n' + lastFew.map((inter, i) =>
        `${i + 1}. User hat gemalt → KI-Antwort: "${inter.ai_response_text || 'Keine Text-Antwort'}"`
      ).join('\n');
    }

    // Add canvas dimensions to context
    let dimensionContext = '';
    if (canvasDimensions) {
      dimensionContext = `\n\nCanvas-Größe: ${canvasDimensions.width} × ${canvasDimensions.height} Pixel (CSS-Pixel, was der User sieht).`;
    }

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPT + dimensionContext + context + '\n\nAnalysiere dieses Bild und antworte im JSON-Format.' },
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[AI] Raw response (full):', JSON.stringify(content).substring(0, 500));
    return parseAIResponse(content);
  } catch (error) {
    console.error('[AI] Error:', error.message);
    return {
      text: 'Ich konnte das Bild nicht analysieren. Versuche es nochmal!',
      drawing: null
    };
  }
}

/**
 * Parse AI response and extract text + drawing commands
 */
function parseAIResponse(content) {
  try {
    let jsonStr = content;

    // Remove thinking tags if present (Gemini thinking models)
    jsonStr = jsonStr.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

    // Extract from markdown code block
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // No closing ``` — try to find JSON object anyway
      const objectMatch = jsonStr.match(/\{[\s\S]*/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
        // Try to close incomplete JSON
        // Count open brackets
        let openBrackets = 0;
        let openArrays = 0;
        for (const ch of jsonStr) {
          if (ch === '{') openBrackets++;
          if (ch === '}') openBrackets--;
          if (ch === '[') openArrays++;
          if (ch === ']') openArrays--;
        }
        // Close any trailing incomplete string
        const lastQuote = jsonStr.lastIndexOf('"');
        const afterLastQuote = jsonStr.substring(lastQuote + 1);
        if (!afterLastQuote.includes('"') && !afterLastQuote.includes('}') && !afterLastQuote.includes(']')) {
          jsonStr += '"';
        }
        // Close open arrays and objects
        for (let i = 0; i < openArrays; i++) jsonStr += ']';
        for (let i = 0; i < openBrackets; i++) jsonStr += '}';
      }
    }

    // Find JSON object if still not found
    if (!jsonStr.startsWith('{')) {
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    return {
      text: parsed.text || 'Keine Text-Antwort',
      drawing: Array.isArray(parsed.drawing) ? parsed.drawing : null
    };
  } catch (parseError) {
    console.error('[AI] JSON parse failed:', parseError.message);
    console.error('[AI] Raw:', content.substring(0, 300));

    return {
      text: content.substring(0, 200) || 'Ich habe das Bild analysiert, aber keine strukturierte Antwort erstellt.',
      drawing: null
    };
  }
}

module.exports = { analyzeCanvas };
