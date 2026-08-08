# 🎵 BeatGen — Procedural MIDI Beat Generator

A real-time procedural beat generator that creates MIDI patterns on the fly and streams them to external hardware. Three tracks (Drums, Bass, Synth) with knobs and sliders to shape the groove in real time. Genres are combined as weighted influences — not as single selections.

<!-- screenshot-placeholder -->

---

## ✨ Features

- **Procedural Pattern Engine** — 6 genre templates mixed by weight, modified by 6 mood parameters
- **Real-time MIDI Output** — Web MIDI API sends Note On/Off to external hardware
- **3 Tracks** — Drums (Ch 10), Bass (Ch 8), Synth (Ch 3), each with Mute/Solo/Volume/Channel
- **16-Step Sequencer Visualization** — LED-strip playback indicator per track
- **Swing System** — Global or per-track swing with smooth animation
- **Preset System** — Save/Load/Delete presets, Export/Import as JSON
- **3 Default Presets** — Techno Heavy, Chill House, Acid Madness
- **Touch-Optimized** — 44px minimum touch targets, haptic feedback on knobs
- **Responsive Layout** — Mobile-first, 2-column tablet, 3-column desktop
- **Dark Theme** — Glass morphism, neon glow effects, smooth Framer Motion animations

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Styling | TailwindCSS v4 |
| State | Zustand |
| Animation | Framer Motion |
| MIDI | Web MIDI API |
| Persistence | localStorage |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

The app runs at `http://localhost:5173` by default.

---

## 🎛️ How It Works

1. **Set genre weights** — Slide the 6 genre sliders to mix influences (auto-normalized to 100%)
2. **Shape the mood** — Turn the 6 mood knobs (Darkness, Energy, Complexity, Density, Groove, Weirdness)
3. **Connect MIDI** — Open Settings → select your MIDI output device
4. **Hit Play** — Patterns are generated in real time and sent as MIDI to your hardware

### Genre Weights

Each genre (Techno, House, Acid, Trance, D&B, Hip-Hop) contributes templates that are mixed by weight. A 70% Techno / 20% Acid mix produces patterns that lean heavily on techno rhythms with acid flavor.

### Mood Parameters

| Parameter | Effect |
|-----------|--------|
| Darkness | Minor/Major scale, low-end velocity |
| Energy | BPM range, pattern density, velocity range |
| Complexity | Ghost notes, polyrhythms, note count |
| Density | Notes per bar, probability per step |
| Groove | Swing amount, micro-timing offsets |
| Weirdness | Random mutations, unusual intervals |

---

## 🎹 MIDI Setup

### Requirements

- **Chrome or Edge** (Web MIDI API required)
- A MIDI interface connected via USB, or a virtual MIDI port

### Steps

1. Connect your MIDI interface / hardware
2. Click the ⚙️ Settings icon in the header
3. Select your output device from the dropdown
4. Click "Test MIDI Note" to verify the connection
5. Adjust channel mapping if needed (default: Drums=Ch10, Bass=Ch8, Synth=Ch3)

### Supported Devices

- **Hardware synths & drum machines** — via USB MIDI interface
- **DAW virtual ports** — IAC Driver (macOS), loopMIDI (Windows)
- **iOS devices** — via USB MIDI in Safari 15+

### Troubleshooting

- **"Web MIDI Not Supported"** — Use Chrome or Edge. Firefox has limited support.
- **No devices listed** — Check USB connection, try re-plugging the interface
- **Device disconnected** — The app attempts auto-reconnect. Re-select the device if needed.
- **No sound** — Verify the MIDI channel matches your hardware's receive channel

---

## 📁 Project Structure

```
src/
├── App.jsx                 # Main layout & MIDI wiring
├── index.css               # Global styles, glass effects, responsive
├── main.jsx                # Entry point
├── store/useStore.js       # Zustand state management
├── engine/                 # Pattern generation
│   ├── PatternEngine.js    # Core orchestrator
│   ├── GenreLibrary.js     # Genre templates
│   ├── GenreMixer.js       # Weighted genre mixing
│   ├── MoodProcessor.js    # Mood parameter effects
│   ├── SwingProcessor.js   # Swing calculation
│   └── VelocityCurves.js   # Genre-specific velocity
├── midi/                   # MIDI output
│   ├── MidiEngine.js       # Web MIDI API wrapper
│   ├── MidiMapper.js       # Pattern → MIDI events
│   └── MidiScheduler.js    # Precise timing engine
├── components/             # UI components
│   ├── Header.jsx
│   ├── TransportBar.jsx
│   ├── GenreWeights.jsx
│   ├── MoodKnobs.jsx
│   ├── Knob.jsx
│   ├── TrackPanel.jsx
│   ├── StepSequencer.jsx
│   ├── SwingControl.jsx
│   ├── PresetManager.jsx
│   ├── SettingsPanel.jsx
│   └── VolumeSlider.jsx
├── presets/                # Preset management
│   ├── defaults.js         # Default presets
│   └── PresetStore.js      # localStorage CRUD + export/import
└── utils/                  # Music theory helpers
    ├── scales.js
    ├── drumMap.js
    └── random.js
```

---

## 📸 Screenshots

<!-- screenshot-placeholder-mobile -->
<!-- screenshot-placeholder-desktop -->

---

## 📄 License

MIT
