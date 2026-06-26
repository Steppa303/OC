// Node 22 has global fetch built-in
const { Readable } = require('stream');

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech/';
let elevenLabsKey = process.env.ELEVENLABS_API_KEY || 'NOT_FOUND'; // Read from env or fallback

// Function to set the API key if available
function setApiKey(key) {
  if (key && key !== 'NOT_FOUND') {
    elevenLabsKey = key;
    console.log('ElevenLabs API key set.');
  } else {
    console.warn('ElevenLabs API key is missing or invalid. TTS will not work.');
  }
}

async function streamTextToSpeech(text, voiceId = 'EXAVITQu4vr4xnSDxMaL', voiceSettings = { stability: 0.3, similarity_boost: 0.7 }) {
  if (elevenLabsKey === 'NOT_FOUND') {
    throw new Error('ElevenLabs API key not configured. Cannot stream TTS.');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenLabsKey
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_turbo_v2_5', // Use a performant model
      voice_settings: voiceSettings
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`ElevenLabs TTS Error: ${response.status} - ${errorBody}`);
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${response.statusText}`);
  }

  // Convert Web ReadableStream to Node.js Readable for .pipe() support
  return Readable.fromWeb(response.body);
}

module.exports = {
  setApiKey,
  streamTextToSpeech
};