{
  "account_info": {
    "username": "@mia.[tbd]",
    "password": "[tbd]",
    "display_name": "Mia [Nachname]",
    "bio": "🌿 naturverbunden | ☕️ kaffee-liebhaberin | 🇩🇪 heimatliebe",
    "bio_phase_2": "🌿 natur | ☕️ kaffee | 🇩🇪 freiheit | meine meinung zählt",
    "bio_phase_3": "🇩🇪 für unser land | 💙 alternative | #afd"
  },
  "posting_config": {
    "frequency": "1x/Tag",
    "time_slot": "17:30-20:15",
    "session_file": "instagrapi-session.json",
    "state_file": "post-state.json",
    "img_dir": "/tmp/mia-posts",
    "image_provider": "google/gemini-3-pro-image-preview",
    "image_tool": "openclaw image_generate",
    "image_model": "google/gemini-3-pro-image-preview",
    "default_size": "4:5",
    "default_aspect": "4:5",
    "log_file": "/tmp/mia-poster.log"
  },
  "voice_config": {
    "provider": "elevenlabs",
    "api_key": "sk_2ff8aca207c482b8ccb08500efe99cca7711213f038760da",
    "primary_voice_id": "LB5G0Z4EP98YaEgL654m",
    "primary_voice_name": "Laura - Upbeat & Energetic (German)",
    "secondary_voice_id": "cgSgspJ2msm6clMCkdW9",
    "secondary_voice_name": "Jessica - Playful, Bright, Warm (Fallback)
    "model": "eleven_multilingual_v2",
    "stability": 0.4,
    "similarity_boost": 0.8,
    "styles": {
      "warm_einladend": {"stability": 0.4, "similarity_boost": 0.8, "speed": 1.0},
      "besorgt_nachdenklich": {"stability": 0.6, "similarity_boost": 0.7, "speed": 0.95},
      "ernst_klar": {"stability": 0.5, "similarity_boost": 0.75, "speed": 1.0},
      "fröhlich_lachend": {"stability": 0.3, "similarity_boost": 0.85, "speed": 1.05},
      "inspirierend": {"stability": 0.4, "similarity_boost": 0.8, "speed": 0.9}
    }
  },
  "veo_config": {
    "model": "veo-3.1-generate",
    "motion_types": {
      "subtle_talk": "Subtle animation. Gentle head tilt, soft eye movement, slight lip sync motion, warm natural expression.",
      "wind_scene": "Smooth slow-motion. Hair blowing gently in wind, soft fabric movement, cinematic atmosphere.",
      "direct_address": "Sustained direct eye contact with camera, subtle micro-expressions, natural breathing motion.",
      "contemplative": "Slow thoughtful nod, slight sigh, looking down then back up to camera with concerned expression.",
      "happy_reaction": "Laughing naturally and charmingly, subtle body movement, genuine joyful expression."
    }
  },
  "social_accounts": {
    "instagram": {
      "active": true,
      "post_method": "instagrapi",
      "session_file": "instagrapi-session.json",
      "target_account": "@mia.[tbd]"
    },
    "tiktok": {
      "active": false,
      "post_method": "pending",
      "target_account": "@mia.[tbd]"
    },
    "youtube_shorts": {
      "active": false,
      "post_method": "pending",
      "target_account": null
    }
  },
  "character_descriptor": "Hyper-realistic portrait of a 22-year-old gorgeous German woman, blonde hair styled naturally, bright green eyes, flawless natural minimal makeup, soft youthful facial features, warm friendly smile, healthy glowing skin. Locked-in identity. [SPECIFIC_SETTING]",
  "hashtags": {
    "lifestyle": ["#heimat", "#natur", "#kaffeeliebe", "#achtsamkeit", "#tradition", "#waldspaziergang", "#morgenroutine", "#familie"],
    "bridge": ["#freiheit", "#meinung", "#diskussion", "#zukunft", "#sicherheit", "#nachdenklich"],
    "hard": ["#afd", "#alternativefürdeutschland", "#realpolitik", "#grenzen", "#migration", "#innereSicherheit", "#mutzurwahrheit", "#wirtschaftsflaute"],
    "compliance": ["#aigenerated", "#synthetic"]
  },
  "compliance": {
    "eu_ai_act": true,
    "label_method": "#aigenerated tief in Caption (Position > 200 Zeichen)",
    "shadowban_risk": "Mittel – ab Phase 3 (Hard Rage Bait) steigend",
    "mitigation": "Phase 1-2 clean halten, kein offener Hass, Kunstfreiheit nutzen"
  }
}