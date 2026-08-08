# 🎵 BeatGen — Procedural MIDI Beat Generator

_Echtzeit MIDI-Stream-Generator mit prozeduraler Beat-Generierung_

---

## 📋 Vision

Eine stylische, mobile-first Web-App die in Echtzeit prozedural generierte MIDI-Patterns erzeugt und als Live-MIDI-Stream an externe Hardware sendet.
Drei Spuren (Drums, Bass, Synth) mit Reglern zur Beeinflussung in Echtzeit.
Genres werden als Gewichtungen kombiniert — nicht als einzelne Auswahl.

---

## 🏗️ Architektur

### Tech Stack
| Layer | Tech | Begründung |
|-------|------|------------|
| Frontend | React 18 + Vite | Bastians Standard-Stack |
| Styling | TailwindCSS | Mobile-first, schnell |
| MIDI Output | Web MIDI API | Direkter MIDI-Output an Hardware |
| State | Zustand | Lightweight, React-freundlich |
| Animation | Framer Motion | Smooth UI-Transitions |
| Pattern Engine | Custom JS | Maximale Flexibilität |
| Persistence | localStorage | Preset Save/Load |

### MIDI-Output-Konzept
```
Browser (Web MIDI API) → MIDI-Interface → Hardware
  ├─ Channel 10 → TR-8s (Drums)
  ├─ Channel 8  → Bass-Synth
  └─ Channel 3  → Poly-Synth
```
Kanäle sind einstellbar in den Settings.

### Plattform-Support
- ✅ Chrome/Edge (Desktop + Android) — Full Web MIDI
- ✅ Safari (iOS 15+) — Web MIDI supported
- ⚠️ Firefox — Limited, Fallback: MIDI-Download statt Live-Output
- Mobile: Web MIDI funktioniert, aber MIDI-Interface nötig (USB-OTG)

---

## 🎯 Kern-Features

### 1. Generierungs-Engine (Das Herz)

**Genre-Gewichtung (nicht Auswahl!):**
Alle 6 Genres haben einen Gewichtungs-Regler (0-100%).
Die Generierung mischt Templates basierend auf den Gewichtungen.
Gewichtungen werden normalisiert (Summe = 100%).
Echtzeit-Änderung: Pattern wird beim nächsten Takt neu generiert.

**Genre-Definitionen (Templates):**
Jeder Genre hat:
- Drum-Patterns (16-Step Templates für Kick, Snare, HiHat, Clap, Perc)
- Bass-Intervalle & Rhythmik-Templates
- Akkord-Folgen & Arpeggio-Styles
- Typische BPM-Range
- Swing/Groove-Charakteristik
- Velocity-Kurven (pro Genre unterschiedlich!)

**Mood-Parameter beeinflussen:**
- **Darkness** → Minor/Major Skala, Velocity auf Low-End
- **Energy** → BPM-Range, Pattern-Dichte, Velocity-Range
- **Complexity** → Anzahl Noten, Polyrhythmen, Ghost-Notes
- **Density** → Noten pro Takt, Lücken im Pattern
- **Groove** → Swing-Amount, Timing-Offsets (Micro-Timing)
- **Weirdness** → Zufällige Mutationen, ungewöhnliche Intervalle

### 2. Drei MIDI-Spuren

| Spur | Default Channel | MIDI-Events |
|------|----------------|-------------|
| 🥁 Drums | Ch 10 | Note On/Off (GM Drum Map) |
| 🎸 Bass | Ch 8 | Note On/Off + Velocity |
| 🎹 Synth | Ch 3 | Note On/Off + Velocity |

**Pro Spur:**
- Volume (CC 7)
- Mute/Solo
- Channel-Select (1-16)
- Step-Sequencer-Visualisierung (16 Steps)

### 3. Swing-System
- Toggle: Global Swing / Track-swing
- Global: Ein Swing-Regler für alle Spuren
- Track: Pro Spur eigener Swing-Regler
- Swing-Amount: 0-100% (offbeat Noten werden verzögert)

### 4. Velocity-Curves (pro Genre)
Jeder Genre hat typische Velocity-Kurven:
- Techno: Hart, gleichmäßig (hohe Velocity, wenig Variation)
- House: Swingig, offbeat softer
- Acid: Aggressiv, accentuiert
- Trance: Egalisiert, pumpend
- D&B: Breakbeat-artig, stark akzentuiert
- Hip-Hop: Swingig, Snare betont

### 5. Transport & Global
- ▶️ Play / ⏹️ Stop
- BPM-Regler (60-200)
- Takt-Anzeige (aktiver Step)
- Swing-Mode Toggle (Global/Track)
- MIDI-Device-Select

### 6. Preset-System
- Save: Name + alle Parameter (Genres, Mood, Spuren, Swing, Channels)
- Load: Aus Preset-Liste
- Delete
- localStorage-basiert
- Default-Presets: "Techno Heavy", "Chill House", "Acid Madness"

### 7. Step-Sequencer-Visualisierung
- 16-Step Grid pro Spur
- Aktiver Step leuchtet auf (Playback-Indicator)
- Farbcodiert: Drums=Rot, Bass=Blau, Synth=Lila
- Kompakt, nicht im Weg

---

## 📱 UI-Layout (Mobile-First)

### Oben: Header
```
[BeatGen Logo]  [BPM: 120]  [▶️ Play]  [⚙️ Settings]
```

### Mitte: Hauptbereich (Scrollable)

#### Genre-Gewichtungen
```
┌─────────────────────────────┐
│  🎭 Genre Mix                │
│  Acid     ●━━━━━━━━━ 20%    │
│  House    ●━━━━━━━━━ 15%    │
│  Techno   ●━━━━━━━━━ 40%    │
│  Trance   ●━━━━━━━━━  5%    │
│  D&B      ●━━━━━━━━━ 10%    │
│  Hip-Hop  ●━━━━━━━━━ 10%    │
└─────────────────────────────┘
```

#### Mood-Parameter
```
┌─────────────────────────────┐
│  🎛️ Mood                     │
│  Darkness ●━━━━━━━━━ 69     │
│  Energy   ●━━━━━━━━━ 90     │
│  Complex  ●━━━━━━━━━ 81     │
│  Density  ●━━━━━━━━━ 64     │
│  Groove   ●━━━━━━━━━ 74     │
│  Weird    ●━━━━━━━━━ 76     │
└─────────────────────────────┘
```

#### Swing
```
┌─────────────────────────────┐
│  🔄 Swing [Global ▼]        │
│  Amount ●━━━━━━━━━ 50%      │
└─────────────────────────────┘
```

#### Spuren (je eine Section)
```
┌─────────────────────────────┐
│  🥁 Drums [Ch10] [M] [S] [🔊]│
│  ■□■□■□■□■□■□■□■□  ← 16-Step │
├─────────────────────────────┤
│  🎸 Bass [Ch8] [M] [S] [🔊] │
│  ■□□■□□■□□■□□■□□□           │
├─────────────────────────────┤
│  🎹 Synth [Ch3] [M] [S] [🔊]│
│  ■□□□■□□□■□□□■□□□           │
└─────────────────────────────┘
```

### Unten: Transport-Bar (Fixed)
```
[Swing ●━━] [▶️/⏹️] [BPM ▾] [Preset ▾]
```

### Settings-Panel (Modal/Drawer)
- MIDI-Device-Select
- Channel-Zuordnung (Drums/Bass/Synth)
- Swing-Mode Toggle (Global/Track)
- MIDI-Output-Test-Button

---

## 🔧 Technische Umsetzung

### Pattern-Engine (Core-Algorithmus)

```
Genre-Gewichtungen (6x) → Gewichteter Mix aus Genre-Templates
         ↓
Mood-Parameter (6x) → Modifizieren gemischtes Pattern:
  - Darkness → Minor/Major Skala, Note-Selection
  - Energy → Velocity-Range, BPM
  - Complexity → Ghost-Notes, Polyrhythm
  - Density → Note-Probability pro Step
  - Groove → Swing, Micro-Timing-Offsets
  - Weirdness → Random-Mutations
         ↓
Swing-Parameter → Timing-Offsets auf offbeat Noten
         ↓
Velocity-Curve (genre-spezifisch) → Velocity pro Step
         ↓
Output → 16-Step Pattern pro Spur (MIDI-Events)
         ↓
Web MIDI API → Echtzeit-Output an Hardware
```

### Genre-Mix-Algorithmus
```javascript
function mixPatterns(genreWeights, moodParams) {
  // 1. Normalisiere Gewichtungen (Summe = 1.0)
  // 2. Für jeden Step: gewichteter Zufall aus Genre-Templates
  //    Beispiel Kick-Step 0:
  //    - Techno (40%): Kick=1 (Wkst 0.4)
  //    - House (15%): Kick=1 (Wkst 0.15)
  //    - Acid (20%): Kick=1 (Wkst 0.20)
  //    - → Gesamt-Wkst: 0.75 → Kick=1
  // 3. Mood-Parameter modifizieren das Ergebnis
  // 4. Velocity-Curve aus dominanter Genre anwenden
  // 5. Swing auf offbeat Steps anwenden
}
```

### Web MIDI API Integration
```javascript
// MIDI-Access anfordern
navigator.requestMIDIAccess({ sysex: false })
  .then(access => {
    const outputs = access.outputs;
    const output = outputs.get(selectedDeviceId);
    // Note On: [0x90 + channel, note, velocity]
    // Note Off: [0x80 + channel, note, 0]
    output.send([0x99, 36, 100]); // Ch10, Kick, Vel 100
  });
```

### MidiScheduler (Timing)
```javascript
// Using performance.now() für präzises Timing
// requestAnimationFrame für UI-Updates
// setInterval für MIDI-Clock (alternativ: Web Audio Clock)

class MidiScheduler {
  constructor(bpm, stepsPerBeat = 4) {
    this.stepDuration = 60000 / bpm / stepsPerBeat; // ms pro Step
    this.currentStep = 0;
    this.startTime = null;
  }

  tick() {
    const now = performance.now();
    const elapsed = now - this.startTime;
    const expectedStep = Math.floor(elapsed / this.stepDuration) % 16;

    if (expectedStep !== this.currentStep) {
      this.currentStep = expectedStep;
      this.onStep(this.currentStep);
    }

    requestAnimationFrame(() => this.tick());
  }
}
```

### Realtime-Parameter-Flow
```
User dreht Regler → Zustand ändert sich →
  → Pattern wird beim nächsten Takt neu generiert
  → Aktueller Takt wird zu Ende gespielt (kein Hard-Cut)
  → Neuer Takt startet mit aktualisiertem Pattern
```

---

## 📁 Projektstruktur

```
projects/beatgen/
├── PLAN.md                  ← Diese Datei
├── package.json
├── vite.config.js
├── tailwind.config.js
├── index.html
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── store/
│   │   └── useStore.js          ← Zustand State (Parameter, Presets)
│   ├── engine/
│   │   ├── PatternEngine.js     ← Core: Pattern-Generierung
│   │   ├── GenreLibrary.js      ← Genre-Definitionen & Templates
│   │   ├── MoodProcessor.js     ← Mood-Parameter → Pattern-Modifikation
│   │   ├── GenreMixer.js        ← Gewichteter Genre-Mix
│   │   ├── SwingProcessor.js    ← Swing-Berechnung (Global/Track)
│   │   └── VelocityCurves.js    ← Genre-spezifische Velocity-Kurven
│   ├── midi/
│   │   ├── MidiEngine.js        ← Web MIDI API Setup & Management
│   │   ├── MidiScheduler.js     ← Timing & Step-Sequencing
│   │   └── MidiMapper.js        ← Pattern → MIDI-Events
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── TransportBar.jsx
│   │   ├── GenreWeights.jsx     ← 6 Genre-Regler (Gewichtung)
│   │   ├── MoodKnobs.jsx        ← 6 Mood-Regler
│   │   ├── Knob.jsx             ← Wiederverwendbarer Drehregler
│   │   ├── TrackPanel.jsx       ← Spur-Panel (Drums/Bass/Synth)
│   │   ├── StepSequencer.jsx    ← 16-Step Visualisierung
│   │   ├── SwingControl.jsx     ← Swing-Regler + Mode-Toggle
│   │   ├── PresetManager.jsx    ← Save/Load/Delete
│   │   ├── SettingsPanel.jsx    ← MIDI-Device, Channel-Config
│   │   └── VolumeSlider.jsx
│   ├── presets/
│   │   ├── PresetStore.js       ← localStorage CRUD
│   │   └── defaults.js          ← Default-Presets
│   └── utils/
│       ├── scales.js            ← Musikalische Skalen & Akkorde
│       ├── drumMap.js           ← GM Drum Map (Note → Instrument)
│       └── random.js            ← Seeded Random für Reproduzierbarkeit
```

---

## 🚀 Detaillierte Entwicklungs-Phasen

### ═══════════════════════════════════════
### Phase 1: Foundation (~2-3h)
### ═══════════════════════════════════════

**Ziel:** Lauffähiges Projekt mit MIDI-Verbindung und Grund-Layout.

#### 1.1 Projekt-Setup
- `npm create vite@latest beatgen -- --template react`
- Dependencies installieren: `zustand`, `framer-motion`, `tailwindcss`, `@tailwindcss/vite`
- TailwindCSS konfigurieren (Dark Theme als Default)
- Vite-Config: Port 5173, Base-Path `/`
- Ordnerstruktur erstellen

#### 1.2 Zustand Store (`useStore.js`)
State-Shape definieren:
```javascript
{
  // Transport
  isPlaying: false,
  bpm: 120,
  currentStep: 0,

  // Genre Weights (0-100, summiert auf 100)
  genres: {
    acid: 20, house: 15, techno: 40,
    trance: 5, dnb: 10, hiphop: 10
  },

  // Mood (0-100)
  mood: {
    darkness: 50, energy: 50, complexity: 50,
    density: 50, groove: 50, weirdness: 50
  },

  // Swing
  swingMode: 'global', // 'global' | 'track'
  swingAmount: 50,
  trackSwing: { drums: 50, bass: 50, synth: 50 },

  // Tracks
  tracks: {
    drums: { channel: 10, muted: false, solo: false, volume: 100 },
    bass:  { channel: 8,  muted: false, solo: false, volume: 100 },
    synth: { channel: 3,  muted: false, solo: false, volume: 100 }
  },

  // MIDI
  midiAccess: null,
  midiOutput: null,
  midiDevices: [],

  // Presets
  presets: [],
  activePreset: null,

  // Actions
  setGenreWeight: (genre, value) => ...,
  setMood: (param, value) => ...,
  setSwing: (mode, amount) => ...,
  toggleMute: (track) => ...,
  toggleSolo: (track) => ...,
  setChannel: (track, ch) => ...,
  savePreset: (name) => ...,
  loadPreset: (id) => ...,
  deletePreset: (id) => ...,
}
```

#### 1.3 Web MIDI API Basis (`MidiEngine.js`)
- `navigator.requestMIDIAccess()` aufrufen
- Output-Devices auflisten
- Device-Select (Dropdown)
- Verbindungs-Status anzeigen
- MIDI-Output-Test (Note On/Off senden)
- Error-Handling (kein MIDI, Permission denied)

#### 1.4 Grund-Layout (`App.jsx`)
- Mobile-First Grid Layout
- Dark Theme (bg-gray-950, text-white)
- Sections: Header, Genre, Mood, Swing, Tracks, Transport
- Responsive Breakpoints: sm, md, lg
- TailwindCSS Custom Colors (Drums=Rot, Bass=Blau, Synth=Lila)

#### 1.5 Basis-Components
- `Header.jsx` — Logo, BPM, Play-Button, Settings-Icon
- `TransportBar.jsx` — Fixed unten, Play/Stop, BPM
- `SettingsPanel.jsx` — Modal/Drawer für MIDI-Config

**Abnahmekriterien:**
- [ ] Projekt startet ohne Errors
- [ ] MIDI-Device wird erkannt und ausgewählt
- [ ] Test-Note wird gespielt (Note On/Off)
- [ ] Layout sieht auf Mobile gut aus
- [ ] Store funktioniert (Parameter ändern → State aktualisiert)

---

### ═══════════════════════════════════════
### Phase 2: Pattern-Engine (~3-4h)
### ═══════════════════════════════════════

**Ziel:** Generierungs-Engine die aus Genre-Gewichtungen + Mood-Parametern musikalische 16-Step Patterns erzeugt.

#### 2.1 Genre-Templates (`GenreLibrary.js`)
Pro Genre (6 Stück) definieren:
- Drum-Templates (16-Step für Kick, Snare, HiHat, Clap, Perc)
- Bass-Templates (16-Step Note-Nummern + Gate)
- Synth-Templates (16-Step Akkord-Töne + Gate)
- BPM-Range (min, max, default)
- Swing-Charakteristik (0-100)
- Velocity-Curve (Array von 16 Werten, 0-127)

Beispiel Techno-Drum-Template:
```javascript
techno: {
  drums: {
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
  },
  bass: {
    notes: [36,0,0,0, 36,0,0,0, 36,0,38,0, 36,0,0,0],
    gate:  [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,0,0],
  },
  synth: {
    notes: [60,0,0,0, 0,0,60,0, 64,0,0,0, 0,0,60,0],
    gate:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
  },
  bpm: { min: 125, max: 140, default: 130 },
  swing: 20,
  velocityCurve: [100,0,70,0, 100,0,70,0, 100,0,70,0, 100,0,70,0],
}
```

#### 2.2 Genre-Mixer (`GenreMixer.js`)
- Gewichtungen normalisieren (Summe = 1.0)
- Für jeden Step: gewichteter Zufall aus Genre-Templates
- Funktion: `mixStep(stepIndex, genreWeights, templateType)`
- Gibt für jeden Step Wahrscheinlichkeit zurück (0-1)
- Schwellwert-Logik: > 0.5 → Note an

#### 2.3 Mood-Processor (`MoodProcessor.js`)
Parameter → Pattern-Modifikation:
- `density`: Note-Probability pro Step skalieren
- `complexity`: Ghost-Notes einfügen, Polyrhythmen
- `energy`: Velocity-Range anpassen
- `darkness`: Minor/Major Skala wechseln
- `groove`: Micro-Timing-Offsets berechnen
- `weirdness`: Random-Mutationen (Note ändern, Step umkehren)

#### 2.4 Swing-Processor (`SwingProcessor.js`)
- Berechnet Timing-Offset für offbeat Steps
- Global Mode: Ein Wert für alle Spuren
- Track Mode: Pro Spur eigener Wert
- Formel: `offset = swingAmount * stepDuration * 0.5`

#### 2.5 Velocity-Curves (`VelocityCurves.js`)
- Pro Genre eine Basis-Velocity-Curve (16 Werte)
- Mood-Parameter modifizieren Kurve:
  - Energy → Velocity-Range skalieren
  - Complexity → Variation erhöhen
  - Darkness → Low-End betonen

#### 2.6 Pattern-Engine (`PatternEngine.js`)
Klasse die alles zusammenführt:
```javascript
class PatternEngine {
  generate(genreWeights, moodParams, swingConfig) {
    const mixedDrums = this.genreMixer.mix(genreWeights, 'drums');
    const mixedBass = this.genreMixer.mix(genreWeights, 'bass');
    const mixedSynth = this.genreMixer.mix(genreWeights, 'synth');

    const processed = this.moodProcessor.apply(moodParams, {
      drums: mixedDrums, bass: mixedBass, synth: mixedSynth
    });

    const swung = this.swingProcessor.apply(swingConfig, processed);
    const withVelocity = this.velocityCurves.apply(genreWeights, swung);

    return withVelocity;
  }
}
```

#### 2.7 Seeded Random (`random.js`)
- Deterministischer Zufall für Reproduzierbarkeit
- Seed basierend auf Parametern (Hash)
- Gleiche Parameter → gleiches Pattern

**Abnahmekriterien:**
- [ ] 6 Genres haben vollständige Templates
- [ ] Genre-Mixer produziert plausible Misch-Patterns
- [ ] Mood-Parameter verändern Patterns hörbar
- [ ] Swing funktioniert (Global + Track)
- [ ] Velocity-Curves sind genre-spezifisch
- [ ] Pattern-Engine gibt valides Pattern-Objekt zurück

---

### ═══════════════════════════════════════
### Phase 3: MIDI-Output (~2-3h)
### ═══════════════════════════════════════

**Ziel:** Patterns werden in Echtzeit als MIDI an Hardware gespielt.

#### 3.1 MidiMapper (`MidiMapper.js`)
- Pattern → MIDI-Events konvertieren
- Note On: `[0x90 + channel, note, velocity]`
- Note Off: `[0x80 + channel, note, 0]`
- Drum-Map: GM Drum Note Numbers (Kick=36, Snare=38, HiHat=42, etc.)
- Bass: MIDI-Note-Nummern aus Pattern
- Synth: MIDI-Note-Nummern aus Pattern

#### 3.2 MidiScheduler (`MidiScheduler.js`)
- Präzises Timing via `performance.now()`
- Step-Duration berechnen: `60000 / bpm / 4` (16tel Noten)
- Swing-Offset auf offbeat Steps anwenden
- `requestAnimationFrame` für UI-Updates
- `setTimeout` für MIDI-Events (mit Lookahead)
- Lookahead: 100ms voraus planen für Timing-Genauigkeit

#### 3.3 MidiEngine Integration
- Play: Scheduler starten, Pattern generieren, Steps abspielen
- Stop: Alle aktiven Noten off senden, Scheduler stoppen
- BPM-Änderung: Step-Duration aktualisieren (smooth, kein Restart)
- Pattern-Wechsel: Am Taktende neuen Pattern laden

#### 3.4 Takt-Logik
- 16 Steps = 1 Takt
- Am Ende jedes Takts: Pattern neu generieren (falls Parameter geändert)
- Seamless-Wechsel: Aktueller Takt wird zu Ende gespielt
- Takt-Zähler: 1.1.1 bis 4.4.4

#### 3.5 Note-Off Management
- Aktive Noten tracken (Map: channel+note → timeout)
- Note Off senden bevor neue Note On (gleiche Note)
- Alle Noten Off bei Stop
- Sustain-Logik: Bass/Synth Noten über Step hinaus halten

**Abnahmekriterien:**
- [ ] MIDI-Output an Hardware testbar (TR-8s empfängt Noten)
- [ ] Timing ist präzise (kein Drift)
- [ ] Swing ist hörbar
- [ ] BPM-Änderung funktioniert ohne Restart
- [ ] Pattern-Wechsel am Taktende ist seamless
- [ ] Note Off wird korrekt gesendet (kein Hanging)

---

### ═══════════════════════════════════════
### Phase 4: UI & Controls (~3-4h)
### ═══════════════════════════════════════

**Ziel:** Vollständige, stylische UI mit allen Controls.

#### 4.1 Knob-Component (`Knob.jsx`)
- SVG-basierter Drehregler
- Touch-optimiert: Drag up/down dreht Knob
- Wert-Anzeige (Zahl)
- Glow-Effekt bei aktiver Drehung
- Min/Max/Step konfigurierbar
- Farblich anpassbar (Accent-Color)

#### 4.2 Genre-Weights (`GenreWeights.jsx`)
- 6 Slider (nicht Knobs!) für Genre-Gewichtungen
- Prozent-Anzeige
- Normalisierung: Summe = 100% (auto-adjust)
- Farblich codiert (jeder Genre eigene Farbe)
- Smooth Animation bei Änderung

#### 4.3 Mood-Knobs (`MoodKnobs.jsx`)
- 6 Knobs in 2x3 Grid
- Parameter-Namen + Wert
- Glow-Effekt
- Framer Motion Enter-Animation

#### 4.4 Swing-Control (`SwingControl.jsx`)
- Toggle Switch: Global / Track
- Global Mode: Ein Swing-Regler
- Track Mode: Drei Swing-Regler (Drums, Bass, Synth)
- Smooth Transition zwischen Modi

#### 4.5 Track-Panels (`TrackPanel.jsx`)
- Spur-Name + Icon
- Channel-Select Dropdown (1-16)
- Mute/Solo Buttons
- Volume Slider
- Step-Sequencer (16 Steps)
- Farbcodierung: Drums=Rot, Bass=Blau, Synth=Lila

#### 4.6 Step-Sequencer (`StepSequencer.jsx`)
- 16 Steps als kleine Quadrate
- Aktiver Step leuchtet auf (Playback-Indicator)
- Pulse-Animation im Takt
- Kompakt (Höhe: ~30px)

#### 4.7 Transport-Bar (`TransportBar.jsx`)
- Fixed unten
- Play/Stop Button (groß, zentriert)
- BPM-Regler (Dropdown oder Inline-Edit)
- Preset-Button (öffnet Preset-Manager)
- Swing-Indicator

#### 4.8 Preset-Manager (`PresetManager.jsx`)
- Slide-Over Panel
- Preset-Liste (Name, aktive Markierung)
- Save-Button (öffnet Name-Input)
- Load/Delete Buttons
- Default-Presets vorinstalliert

#### 4.9 Settings-Panel (`SettingsPanel.jsx`)
- MIDI-Device-Select (Dropdown)
- Channel-Zuordnung (3 Dropdowns)
- Swing-Mode Toggle
- MIDI-Test-Button
- Web MIDI Support Check

#### 4.10 Framer Motion Animationen
- Page-Load: Staggered Fade-In
- Parameter-Änderung: Smooth Value-Transition
- Step-Playback: Pulse/Glow
- Panel-Open/Over: Slide-In
- Preset-Load: Brief Highlight

**Abnahmekriterien:**
- [ ] Alle Controls funktionieren (Touch + Mouse)
- [ ] Genre-Slider normalisieren korrekt
- [ ] Mood-Knobs ändern Parameter
- [ ] Swing-Toggle wechselt Modi
- [ ] Track-Panels zeigen Step-Sequencer
- [ ] Transport funktioniert
- [ ] Presets laden/spechen
- [ ] Settings-Panel zeigt MIDI-Devices
- [ ] Animationen sind smooth

---

### ═══════════════════════════════════════
### Phase 5: Presets & Polish (~2-3h)
### ═══════════════════════════════════════

**Ziel:** Produktionsreife Qualität, Presets, Mobile-Optimierung.

#### 5.1 Default-Presets (`defaults.js`)
Mindestens 3 Default-Presets:
- "Techno Heavy": Techno 70%, Minimal 20%, Acid 10%, BPM 130
- "Chill House": House 60%, Hip-Hop 30%, Trance 10%, BPM 118
- "Acid Madness": Acid 50%, Techno 30%, D&B 20%, BPM 135

#### 5.2 Preset-Export/Import
- Export: JSON-Download
- Import: JSON-Upload
- Share-Link (optional, URL-Parameter)

#### 5.3 Touch-Optimierung
- Alle Controls: min 44px Touch-Target
- Swipe: Keine Konflikte mit Scroll
- Haptic Feedback (navigator.vibrate) bei Knob-Interaktion
- Long-Press: Wert auf Default zurücksetzen

#### 5.4 Responsive Breakpoints
- Mobile (< 640px): Single Column, alles scrollable
- Tablet (640-1024px): 2 Columns für Genre+Mood
- Desktop (> 1024px): 3 Columns, erweiterte Controls

#### 5.5 Performance-Optimierung
- Pattern-Engine: Web Worker (optional, wenn zu langsam)
- MIDI-Scheduler: requestAnimationFrame Throttling
- Re-Render: React.memo auf statische Components
- Zustand: Selective Subscriptions

#### 5.6 Error-Handling
- MIDI nicht verfügbar: Fallback-Message + Download-Option
- MIDI-Device disconnected: Auto-Reconnect
- Pattern-Engine Error: Fallback zu einfachem Pattern

#### 5.7 Visual Polish
- Neon-Glow Effekte auf aktiven Elementen
- Gradient-Hintergründe
- Schatten auf Panels
- Icon-Set (Lucide oder Heroicons)
- Font: Inter oder System-UI

**Abnahmekriterien:**
- [ ] Default-Presets sind vorinstalliert
- [ ] Presets laden/spechen zuverlässig
- [ ] Touch funktioniert auf Mobile
- [ ] Layout ist responsive
- [ ] Performance ist akzeptabel (kein Lag)
- [ ] Error-Handling funktioniert
- [ ] UI sieht stylisch aus

---

### ═══════════════════════════════════════
### Phase 6: Advanced (Optional, ~2-3h)
### ═══════════════════════════════════════

**Ziel:** Bonus-Features für erweiterte Nutzung.

#### 6.1 Pattern Evolution
- Pattern verändert sich langsam über Zeit
- Evolution-Speed Regler
- Mutationen: 1-2 Steps pro Takt ändern
- Kein Hard-Cut, smooth Ubergang

#### 6.2 Fill-Button
- Einmal-Button: Generiert kurzzeitig Variation
- Fill-Dauer: 1-2 Takte
- Danach: Zurück zum normalen Pattern
- Verschiedene Fill-Typen (Build-Up, Break, Roll)

#### 6.3 MIDI-CC-Output
- Zusätzlich zu Note On/Off: CC-Events
- Filter-Cutoff, Resonance, etc.
- Pro Spur konfigurierbar

#### 6.4 Keyboard-Shortcuts (Desktop)
- Space: Play/Stop
- 1-6: Genre-Gewichtung Toggle
- Arrow Keys: BPM +/- 5

#### 6.5 MIDI-File Export
- Aktuelles Pattern als MIDI-File downloaden
- 1 Takt oder mehrere Takte

---

## ⚠️ Risiken & Mitigation

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Web MIDI nicht verfügbar | High | Fallback: MIDI-Download, Support-Check |
| Mobile MIDI eingeschränkt | Medium | USB-OTG Support, Desktop-first |
| Timing-Ungenauigkeit | Medium | Lookahead + performance.now() |
| Pattern-Qualität | High | Templates von echten Beats ableiten |
| Browser-Kompatibilität | Low | Feature-Detection, Polyfills |

---

## 📐 Design-System

### Farben
- Background: `#0a0a0f` (Deep Black)
- Surface: `#141420` (Dark Purple-Gray)
- Drums Accent: `#ef4444` (Red)
- Bass Accent: `#3b82f6` (Blue)
- Synth Accent: `#a855f7` (Purple)
- Active: `#22c55e` (Green)
- Text: `#f8fafc` (White)
- Muted: `#64748b` (Gray)

### Typography
- Font: Inter, System-UI
- Headings: Bold, 18-24px
- Body: Regular, 14px
- Labels: Medium, 12px

### Effects
- Glow: `box-shadow: 0 0 20px rgba(color, 0.5)`
- Glass: `backdrop-filter: blur(10px); background: rgba(255,255,255,0.05)`
- Gradient: Subtle gradients on panels

---

_Erstellt: 2026-08-06 | Status: PLANUNG (v3 - Final)_

---

## 📊 Umsetzungs-Status

### Phase 1: Foundation
**Status:** ✅ Abgeschlossen (2026-08-06 ~13:45, ~4 Min)
**Build:** ✅ `npm run build` — 3.26s, 0 Errors, 0 Warnings

- [x] 1.1 Projekt-Setup (Vite + React 19 + TailwindCSS v4)
- [x] 1.2 Zustand Store (useStore.js — Transport, Genres, Mood, Swing, Tracks, MIDI, Presets)
- [x] 1.3 Web MIDI API Basis (MidiEngine.js — Device-Enum, Note On/Off, CC, Test)
- [x] 1.4 Grund-Layout (App.jsx — Mobile-First, Dark Theme, Responsive)
- [x] 1.5 Basis-Components (11 Stück: Header, TransportBar, GenreWeights, MoodKnobs, SwingControl, TrackPanel, StepSequencer, Knob, VolumeSlider, SettingsPanel, PresetManager)

### Phase 2: Pattern-Engine
**Status:** ✅ Abgeschlossen (2026-08-06 ~13:55, ~4 Min)
**Build:** ✅ `npm run build` — 4.22s, 0 Errors, 0 Warnings
**Dateien:** 9 Dateien, ~1288 LOC (6 Engine + 3 Utils)

- [x] 2.1 Genre-Templates (6 Genres: Techno, House, Acid, Trance, DnB, Hip-Hop)
- [x] 2.2 Genre-Mixer (Gewichteter Mix, Seeded Random)
- [x] 2.3 Mood-Processor (Density, Complexity, Energy, Darkness, Groove, Weirdness)
- [x] 2.4 Swing-Processor (Global + Track Mode)
- [x] 2.5 Velocity-Curves (Genre-blended, Mood-modifiziert)
- [x] 2.6 Pattern-Engine (Orchestrator: Mix → Mood → Swing → Velocity)
- [x] 2.7 Seeded Random (Mulberry32 PRNG)
- [x] 2.8 Scales Utils (13 Skalen, Akkord-Folgen)
- [x] 2.9 Drum Map (Full GM Drum Map)

### Phase 3: MIDI-Output
**Status:** ✅ Abgeschlossen (2026-08-06 ~14:00 / 2026-08-08 ~18:58)
**Build:** ✅ `npm run build` — 3.71s, 0 Errors, 0 Warnings
**Dateien:** 4 Dateien (MidiMapper.js, MidiScheduler.js, MidiClockParser.js, App.jsx Wiring)

- [x] 3.1 MidiMapper (Pattern → MIDI-Events Konvertierung, Track-Channel-Mapping, Sustain-Logik)
- [x] 3.2 MidiScheduler (performance.now() + setTimeout Lookahead, 100ms voraus, Note-Off Management, BPM-Live-Update)
- [x] 3.3 Wiring in App.jsx (Play/Stop → Scheduler, BPM-Update, Parameter-Dirty-Flag)
- [x] 3.4 Takt-Logik (16 Steps = 1 Bar, Pattern-Regeneration am Taktende bei Dirty-Flag)
- [x] 3.5 Note-Off Management (Active Notes Map, Silence-All bei Stop, Sustain Bass/Synth 2 Steps)
- [x] 3.6 🆕 WebMIDI Permission Fix — midiEngine.init() beim App-Mount, "CONNECT MIDI" Fallback-Button (08.08.2026)
- [x] 3.7 🆕 MIDI-Input Support — MidiEngine.js erweitert um Input-Ports, onmidimessage Handler (08.08.2026)
- [x] 3.8 🆕 MidiClockParser — MIDI System-Realtime-Parser (0xF8/FA/FB/FC), BPM-Ermittlung via 24-PPQN (08.08.2026)
- [x] 3.9 🆕 Dual-Mode Scheduler — internal (Timer) + external (Clock-getrieben), Clock-Source-Toggle (08.08.2026)

### Phase 4: UI & Controls
**Status:** ✅ Abgeschlossen (2026-08-06 ~14:48, ~5 Min)
**Build:** ✅ `npm run build` — 3.21s, 0 Errors, 0 Warnings

- [x] 4.1 Knob.jsx — SVG Rotary Knob (Drag up/down, Glow, Long-Press Reset)
- [x] 4.2 GenreWeights.jsx — Farbcodierte Slider mit Normalisierung + Spring-Animation
- [x] 4.3 MoodKnobs.jsx — 6 SVG Knobs in 2×3 Grid mit Staggered-Entry
- [x] 4.4 SwingControl.jsx — Pill-Toggle + AnimatePresence Mode-Wechsel
- [x] 4.5 TrackPanel.jsx — Styled Channel-Select, Mute/Solo mit Glow, Collapse/Expand
- [x] 4.6 StepSequencer.jsx — 16 Steps mit Glow, Beat-Marker, Pulse-Animation
- [x] 4.7 TransportBar.jsx — Glass-Effect, Step-LED-Strip, BPM Inline-Edit, Safe-Area
- [x] 4.8 Header.jsx — Gradient Logo, MIDI Status LED
- [x] 4.9 SettingsPanel.jsx — Bottom-Sheet Modal, Device-Select, MIDI-Test
- [x] 4.10 PresetManager.jsx — Bottom-Sheet, 3 Default-Presets, Staggered List
- [x] 4.11 Framer Motion — Global Animationen (Page-Load, Spring, Pulse, Slide-Up)
- [x] 4.12 Design-System — Glass, Glow, Neon, Custom Range-Slider, Step-Pulse

### Phase 5: Presets & Polish
**Status:** ✅ Abgeschlossen (2026-08-06 ~15:06, ~8 Min)
**Build:** ✅ `npm run build` — 4.48s, 0 Errors, 0 Warnings

- [x] 5.1 Default-Presets (`src/presets/defaults.js` — Techno Heavy, Chill House, Acid Madness)
- [x] 5.2 PresetStore (`src/presets/PresetStore.js` — localStorage CRUD, export/import, dedup, max 20)
- [x] 5.3 Preset-Export/Import (JSON download/upload with validation in PresetManager)
- [x] 5.4 Touch-Optimierung (44px min targets, haptic feedback on Knob, long-press reset, touch-action: pan-y)
- [x] 5.5 Responsive Breakpoints (Mobile single-col, Tablet 2-col, Desktop 3-col, max-w-2xl)
- [x] 5.6 Performance (React.memo on Header/GenreWeights/StepSequencer, selective Zustand, useCallback)
- [x] 5.7 Error-Handling (MIDI fallback badge, auto-reconnect, pattern fallback 4-on-the-floor, localStorage try-catch)
- [x] 5.8 Visual Polish (glass on all panels, neon glow, 4px grid, focus-visible states, smooth transitions)
- [x] 5.9 README.md (project description, tech stack, features, MIDI setup guide)

### Phase 6: Advanced
**Status:** ⏳ Ausstehend

---

## 🐛 Bugfix History

### 2026-08-08 — WebMIDI Permission Fix + External Clock Sync

**Problem 1:** `MidiEngine.init()` wurde nur in SettingsPanel.jsx beim Öffnen des Panels aufgerufen — nie beim App-Mount.
  → Browser-Permission-Dialog kam nie, User musste manuell Settings öffnen.
**Problem 2:** Keine MIDI-Input-Logik vorhanden. Kein Clock-Sync möglich.

**Fix 1:**
- `App.jsx`: `useEffect` ruft `midiEngine.init()` beim Mount auf
- `Header.jsx`: "CONNECT MIDI" Button wenn Init ohne User-Gesture fehlschlägt
- `SettingsPanel.jsx`: Redundante Init-Logik entfernt

**Fix 2 — Neue Dateien:**
- `src/midi/MidiClockParser.js`: System-Realtime-Parser (0xF8 Clock, 0xFA Start, 0xFB Continue, 0xFC Stop), BPM via 24 PPQN
- `MidiEngine.js`: Input-Ports, selectInputDevice(), onClockMessage Callback
- `MidiScheduler.js`: Dual-Mode (internal/external), _onExternalStep()
- `useStore.js`: clockSource, midiInputDevices, externalBpm, isExternalRunning + Actions

**Fix 2 — UI:**
- `SettingsPanel.jsx`: Clock-Source-Toggle (Internal/MIDI External), MIDI Input Select
- `TransportBar.jsx`: "EXT" Badge, read-only BPM, Play/Stop disabled im External-Mode
- `Header.jsx`: "INT"/"EXT" Mini-Badge

**Build nach Fix:** `index-CLkH1mnk.js` (08.08.2026 18:58)
