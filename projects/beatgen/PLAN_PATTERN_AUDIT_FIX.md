# BeatGen — Pattern Generation Audit Fix Plan

_Erstellt: 2026-08-08 21:17 CEST — basierend auf vollständigem Engine-Audit_

---

## 📋 Übersicht: 5 Fixes, 1 Refactor

### ✅ Implementierungsstatus (08.08.2026)
- Fix 1: implementiert (null-Defaults, Auto-Knobs/Sliders, Preset-Migration)
- Fix 2: implementiert (Drum-Weights beeinflussen `mixDrumPattern`)
- Fix 3: implementiert (Step-Format `chordNotes`, korrigierte Akkord-Logik, MIDI-Mapping)
- Fix 4: implementiert (per-track Velocity-Curves via `effectiveMoods`)
- Fix 5: implementiert (`gateTime` statt Velocity-Faking, Note-Off über Mapper/Scheduler)
- Fix 6: produktionsbuild deployed auf `beatgen.steppa.online` (kein Build-Error/Warning)

| # | Fix | Prio | Aufwand | Impact |
|---|-----|------|---------|--------|
| 1 | Per-Track "Inherit from Global" (null-Defaults) | 🔴 CRITICAL | 2h | Global Mood funktioniert wieder |
| 2 | Drum Weights implementieren | 🔴 CRITICAL | 1h | Kick/Snare/Hihat/Clap/Perc Slider tun was |
| 3 | Chord Mode fertigstellen | 🔴 CRITICAL | 2.5h | 2-Note/3-Note Akkorde funktionieren |
| 4 | Velocity Curve per-track | 🟡 MAJOR | 1h | Per-Track Darkness/Energy beeinflusst Velocity |
| 5 | Note Length → echte Gate-Time | 🟡 MAJOR | 2.5h | Staccato/Legato statt Velocity-Faking |
| 6 | Integration, Build, Deploy, Test | – | 1h | Regression-Test, visueller Check |
| **Total** | | | **~10h** | |

---

## 📐 Architektur-Änderungen im Überblick

### Datenfluss (IST → SOLL)

```
IST:
  Global Mood → [wird von Per-Track default 50 ÜBERSCHRIEBEN] → Engine
  Drum Weights → [Stub, no-op] → Engine
  Chord Mode → [Berechnet aber verworfen] → Engine
  Note Length → [Velocity-Modifier, kein Gate-Time] → Engine
  Velocity Curve → [Nur global, ignoriert Per-Track-Mood] → Engine

SOLL:
  Global Mood → [Baseline, Per-Track = null → inherit] → Engine
  Drum Weights → [Multiplikator auf mixDrumPattern Wahrscheinlichkeit] → Engine
  Chord Mode → [Zusätzliche Note-On Events pro Step] → MidiMapper
  Note Length → [Gate-Time pro Step in ms] → MidiScheduler (Note-Off nach gateTime)
  Velocity Curve → [Pro Track mit effectiveMood berechnet] → Engine
```

### Neue Step-Datenstruktur

```javascript
// Aktuell:
step = { active, note, velocity, timing }

// Neu (erweitert):
step = { 
  active, note, velocity, timing,
  gateTime: null,      // ms bis Note-Off (null = default = Schritt-Dauer)
  chordNotes: [],      // [{ note, velocity }] für Chord-Mode
}
```

---

## 🔧 Fix 1: Per-Track "Inherit from Global" (2h)

### Problem
Per-Track-Parameter starten bei 50, überschreiben IMMER die Global-Mood-Werte.
→ Global-Mood-Drehregler haben keine Wirkung.

### Lösung
Per-Track-Parameter mit `null` initialisieren. `null` = "inherit from Global".
Erst wenn User den Regler anfasst, wird ein expliziter Wert gesetzt.

### 1.1 Store-Änderungen (`src/store/useStore.js`)

```diff
// trackParams — null bedeutet "inherit from Global"
trackParams: {
  drums: {
-   density: 50, complexity: 50, groove: 50,
+   density: null, complexity: null, groove: null,
    kickWeight: 100, snareWeight: 100, hihatWeight: 100, clapWeight: 100, percWeight: 100,
  },
  bass: {
-   density: 50, complexity: 50, groove: 50,
-   darkness: 50, weirdness: 50, octave: 0,
+   density: null, complexity: null, groove: null,
+   darkness: null, weirdness: null, octave: 0,
    rangeLow: 28, rangeHigh: 60, noteLength: 80,
  },
  synth: {
-   density: 50, complexity: 50, groove: 50,
-   darkness: 50, weirdness: 50, octave: 0,
+   density: null, complexity: null, groove: null,
+   darkness: null, weirdness: null, octave: 0,
    rangeLow: 48, rangeHigh: 84, noteLength: 65,
    chordMode: 'off',
  },
},

// Neue Action: Per-Track-Parameter auf null resetten
resetTrackParam: (track, param) => set(state => ({
  trackParams: {
    ...state.trackParams,
    [track]: { ...state.trackParams[track], [param]: null },
  },
  patternDirty: true,
})),

// setTrackParam bleibt unverändert — setzt expliziten Wert
```

### 1.2 Engine-Änderungen (`src/engine/PatternEngine.js`)

```diff
// generate() — effectiveMood nur overriden wenn Wert != null
for (const track of ['drums', 'bass', 'synth']) {
  const tp = trackParams?.[track] || {};
  const effectiveMood = { ...moodParams };
- if (tp.density !== undefined) effectiveMood.density = tp.density;
- if (tp.complexity !== undefined) effectiveMood.complexity = tp.complexity;
- if (tp.groove !== undefined) effectiveMood.groove = tp.groove;
- if (tp.darkness !== undefined) effectiveMood.darkness = tp.darkness;
- if (tp.weirdness !== undefined) effectiveMood.weirdness = tp.weirdness;
+ // Nur überschreiben wenn User den Per-Track-Regler explizit gesetzt hat
+ if (tp.density != null) effectiveMood.density = tp.density;
+ if (tp.complexity != null) effectiveMood.complexity = tp.complexity;
+ if (tp.groove != null) effectiveMood.groove = tp.groove;
+ if (tp.darkness != null) effectiveMood.darkness = tp.darkness;
+ if (tp.weirdness != null) effectiveMood.weirdness = tp.weirdness;
  // ...
}
```

### 1.3 UI-Änderungen

#### TrackParamKnobs.jsx — "Auto"-Modus anzeigen

```jsx
// Wenn Wert null ist → Knob zeigt Global-Wert an, aber visuell "dimmed"
// Erstes Drehen setzt expliziten Wert

<TrackParamKnobs
  track={trackKey}
  params={trackParams}
  globalMood={mood}           // ← NEU: für Auto-Anzeige
  onChange={handleParamChange}
  onReset={(param) => setTrackParam(trackKey, param, null)}  // ← NEU: Reset
  color={config.color}
/>
```

**Visuelles Design für "Auto"-Knobs:**
- Knob-Position zeigt den Global-Mood-Wert (nicht 50)
- Knob-Farbe ist etwas transparenter/grauer (Opacity 0.4)
- Label zeigt "Auto" oder "🌍" Icon statt Zahlenwert
- Beim ersten Drag/Click → Knob "erwacht", wird vollfarbig, zeigt Zahlenwert
- Doppelklick auf Knob → Reset auf null/Auto

**TrackParamSliders.jsx — gleiches Prinzip:**
- Slider-Position zeigt Global-Wert wenn `null`
- Slider-Track ist dimmed (Opacity 0.3)
- Value-Display zeigt "auto" statt "%"
- Beim ersten Drag → Slider wird aktiv, zeigt echten Wert

**Implementierungs-Detail für Knob.jsx:**
```jsx
// Knob bekommt neue Props:
// - inherited: bool — ob der Wert von Global kommt
// - inheritedValue: number — der Global-Wert zur Anzeige
// - onReset: () => void — Doppelklick-Handler

const displayValue = inherited ? inheritedValue : value;
const isAuto = inherited;

// Visuell:
// - Knob Track: isAuto ? 'opacity-30' : 'opacity-100'
// - Value Label: isAuto ? 'auto' : `${value}`
// - Doppelklick: if (!isAuto) onReset?.()
```

#### TrackParamSliders.jsx Änderung:

```jsx
const SLIDER_CONFIG = [
  { key: 'darkness',  label: 'Darkness 🌑', ... },
  { key: 'weirdness', label: 'Weirdness 🤪', ... },
  { key: 'octave',    label: 'Octave 🎵', ... },  // Octave hat KEINEN Auto-Mode (default 0 ist sinnvoll)
]

// Für jeden Slider:
const inherited = params[key] == null;  // null-check, nicht undefined!
const displayValue = inherited ? (moodParams?.[key] ?? 50) : params[key];
```

### 1.4 Reset-Regeln aktualisieren

| Aktion | mutationCount | Per-Track-Parameter |
|--------|--------------|---------------------|
| Global Mood ändern | Reset {0,0,0} | Bleiben (Auto folgt neuem Wert) |
| Per-Track-Regler anfassen | unverändert | Wird explizit gesetzt |
| Per-Track-Regler doppelklicken | unverändert | Reset auf null (Auto) |
| 🎲 Mutate Track | track++ | unverändert |
| 🔄 Next Pattern | nonce++ | unverändert |
| Preset laden | Aus Preset | Aus Preset (kann null sein) |

### 1.5 Preset-Kompatibilität

Alte Presets haben `density: 50` etc. statt `null`. Beim Laden:
```javascript
// In loadPreset(): Alte Presets migrieren
if (preset.trackParams) {
  for (const track of ['drums', 'bass', 'synth']) {
    const tp = preset.trackParams[track];
    if (tp) {
      // Wenn alle mood-params auf exakt 50 stehen → war wahrscheinlich nie angefasst → null
      // Sicherer: Preset-Version checken, bei version < 2 → null setzen
    }
  }
}
```

Oder einfacher: Preset-Version einführen. `version: 2` → neue Semantik. `version: 1` oder undefined → alte Werte (50) → zu null migrieren für mood-params.

---

## 🔧 Fix 2: Drum Weights implementieren (1h)

### Problem
`_applyDrumWeights()` ist ein Stub — `return drumPattern`.

### Lösung
Drum-Weights als Wahrscheinlichkeits-Multiplikator in `mixDrumPattern()`.

### 2.1 GenreMixer.js erweitern

```javascript
// mixDrumPattern() — neuer Parameter drumWeights
export function mixDrumPattern(normalizedWeights, instrument, seed, drumWeights = {}) {
  const rng = seededRandom(seed + instrument.length);
  const weight = (drumWeights[instrument] ?? 100) / 100; // 0.0 - 1.0
  const pattern = [];
  
  for (let i = 0; i < 16; i++) {
    const prob = mixDrumStep(i, normalizedWeights, instrument, rng);
    const threshold = 0.45 + rng() * 0.1;
    
    if (prob > threshold) {
      // Weight > 1.0 → höhere Chance dass Hit bleibt
      // Weight < 1.0 → zufällig Hits entfernen
      pattern.push(rng() < weight ? 1 : 0);
    } else {
      // Weight > 1.0 → chance to add ghost hits
      if (weight > 1.0 && rng() < (weight - 1.0) * 0.3) {
        pattern.push(1);
      } else {
        pattern.push(0);
      }
    }
  }
  return pattern;
}

// mixTrack() — drumWeights durchreichen
export function mixTrack(genreWeights, trackType, seed, drumWeights) {
  const nw = normalizeWeights(genreWeights);

  if (trackType === 'drums') {
    return {
      kick:  mixDrumPattern(nw, 'kick', seed, drumWeights),
      snare: mixDrumPattern(nw, 'snare', seed, drumWeights),
      hihat: mixDrumPattern(nw, 'hihat', seed, drumWeights),
      clap:  mixDrumPattern(nw, 'clap', seed, drumWeights),
      perc:  mixDrumPattern(nw, 'perc', seed, drumWeights),
    };
  }

  return mixMelodicPattern(nw, trackType, seed);
}
```

### 2.2 PatternEngine.js anpassen

```diff
// generate() — drumWeights aus trackParams extrahieren
for (const track of ['drums', 'bass', 'synth']) {
  const mc = mutationCount?.[track] || 0;
  const trackSeed = baseSeed + (nonce * 104729) + (mc * 7919);
  
+ // Drum weights für mixTrack
+ const drumWeights = track === 'drums' ? {
+   kick: tp.kickWeight ?? 100,
+   snare: tp.snareWeight ?? 100,
+   hihat: tp.hihatWeight ?? 100,
+   clap: tp.clapWeight ?? 100,
+   perc: tp.percWeight ?? 100,
+ } : undefined;
+ 
- raw[track] = mixTrack(trackGenreWeights?.[track] || genreWeights, track, trackSeed);
+ raw[track] = mixTrack(trackGenreWeights?.[track] || genreWeights, track, trackSeed, drumWeights);
}
```

### 2.3 _applyDrumWeights() entfernen

```diff
// PatternEngine.generate() — nach buildDrumSteps():
if (track === 'drums') {
  trackPattern = buildDrumSteps(mooded.drums);
- // Apply drum weights
- trackPattern = this._applyDrumWeights(trackPattern, tp);
}
```

`_applyDrumWeights()` Methode komplett entfernen.

### 2.4 DrumMixPanel — Range 0-200%

Drums profitieren von Boost > 100%:
```diff
// DrumMixPanel.jsx
<input
  type="range"
  min={0}
- max={100}
+ max={200}  // 200% = doppelte Wahrscheinlichkeit
  step={1}
/>
```

---

## 🔧 Fix 3: Chord Mode fertigstellen (2.5h)

### Problem
Chord-Logik wird berechnet aber dann verworfen — `_applyMelodicParams()` returned das Original ohne Chords.

### Lösung
Step-Format erweitern: `chordNotes` Array pro Step. MidiMapper sendet zusätzliche Note-On-Events.

### 3.1 Step-Datenstruktur erweitern

```javascript
// buildMelodicSteps() — chordNotes Feld hinzufügen
function buildMelodicSteps(raw) {
  const steps = [];
  for (let i = 0; i < 16; i++) {
    const active = (raw.gate?.[i] || 0) === 1;
    steps.push({
      active,
      note: active ? (raw.notes?.[i] || 0) : 0,
      velocity: 0,
      timing: 0,
      chordNotes: [],  // ← NEU
    });
  }
  return { steps };
}
```

### 3.2 _applyMelodicParams() — Chord-Logik korrigieren

```javascript
_applyMelodicParams(melodicPattern, tp, track) {
  const octave = tp.octave || 0;
  const rangeLow = tp.rangeLow ?? (track === 'synth' ? 48 : 28);
  const rangeHigh = tp.rangeHigh ?? (track === 'synth' ? 84 : 60);
  const noteLength = tp.noteLength ?? 65;
  const chordMode = track === 'synth' ? (tp.chordMode || 'off') : 'off';

  let steps = melodicPattern.steps.map(step => {
    if (!step.active || step.note === 0) return { ...step, chordNotes: [] };

    let note = step.note + (octave * 12);
    
    // Clamp to range
    while (note < rangeLow && note > 0) note += 12;
    while (note > rangeHigh && note < 128) note -= 12;
    note = Math.max(0, Math.min(127, note));

    // Note length → Velocity (bestehend, wird in Fix 5 durch Gate-Time ersetzt)
    let velocity = step.velocity;
    if (noteLength < 50) {
      velocity = Math.round(velocity * (0.5 + noteLength / 100));
    } else if (noteLength > 50) {
      velocity = Math.min(127, Math.round(velocity * (0.75 + noteLength / 200)));
    }

    // Chord notes
    let chordNotes = [];
    if (chordMode !== 'off') {
      const intervals = chordMode === '2note' 
        ? [7]           // perfect 5th
        : [4, 7];       // major 3rd + perfect 5th
      
      for (const semitones of intervals) {
        let chordNote = note + semitones;
        while (chordNote < rangeLow && chordNote > 0) chordNote += 12;
        while (chordNote > rangeHigh && chordNote < 128) chordNote -= 12;
        chordNote = Math.max(0, Math.min(127, chordNote));
        
        chordNotes.push({
          note: chordNote,
          velocity: Math.round(velocity * 0.7), // 70% der Root-Velocity
        });
      }
    }

    return { ...step, note, velocity, chordNotes };
  });

  return { steps };
}
```

### 3.3 MidiMapper.js — Chord-Notes senden

```javascript
// MidiMapper — generateEvents() oder äquivalent:

function trackToMidiEvents(trackPattern, channel, stepDuration) {
  const events = [];
  
  for (let i = 0; i < 16; i++) {
    const step = trackPattern.steps[i];
    if (!step.active) continue;
    
    const startTime = i * stepDuration + (step.timing || 0);
    
    // Root note
    events.push({
      type: 'noteOn',
      note: step.note,
      velocity: step.velocity,
      channel,
      time: startTime,
    });
    events.push({
      type: 'noteOff',
      note: step.note,
      channel,
      time: startTime + stepDuration, // oder gateTime (Fix 5)
    });
    
    // Chord notes
    for (const chord of (step.chordNotes || [])) {
      events.push({
        type: 'noteOn',
        note: chord.note,
        velocity: chord.velocity,
        channel,
        time: startTime,
      });
      events.push({
        type: 'noteOff',
        note: chord.note,
        channel,
        time: startTime + stepDuration,
      });
    }
  }
  
  return events.sort((a, b) => a.time - b.time);
}
```

### 3.4 NoteRangePanel — Chord Mode nur für Synth (unverändert)

Bleibt wie es ist. `chordMode` erscheint nur wenn `track === 'synth'`.

---

## 🔧 Fix 4: Velocity Curve per-track (1h)

### Problem
`applyMoodToVelocityCurve()` wird einmal global aufgerufen, ignoriert Per-Track effectiveMood.

### Lösung
Velocity Curve pro Track mit dem jeweiligen `effectiveMood` berechnen.

### 4.1 PatternEngine.generate() umbauen

```diff
// Schritt 3 (Swing) bleibt global/per-track wie bisher

- // 4. Build and apply velocity curve
- const normalizedWeights = normalizeWeights(genreWeights);
- const baseCurve = blendVelocityCurves(normalizedWeights);
- const velocityCurve = applyMoodToVelocityCurve(baseCurve, moodParams, seed);
- pattern = applyVelocityCurve(pattern, velocityCurve);
+ // 4. Apply per-track velocity curves
+ const normalizedWeights = normalizeWeights(genreWeights);
+ const baseCurve = blendVelocityCurves(normalizedWeights);
+ 
+ // Pro Track eigene Velocity Curve mit effectiveMood
+ const velocityPattern = {};
+ for (const track of ['drums', 'bass', 'synth']) {
+   // effectiveMood wurde bereits in Schritt 2 berechnet
+   // Wir müssen es hier nochmal haben — also in Schritt 2 cachen
+   const trackVelocityCurve = applyMoodToVelocityCurve(
+     baseCurve, 
+     effectiveMoodPerTrack[track],  // ← muss in Schritt 2 gespeichert werden
+     seed + track.length * 100
+   );
+   velocityPattern[track] = applyVelocityCurveToTrack(
+     pattern[track], 
+     trackVelocityCurve
+   );
+ }
+ pattern = velocityPattern;
```

### 4.2 VelocityCurves.js erweitern

```javascript
// Neue Funktion: Velocity Curve auf einzelne Spur anwenden
export function applyVelocityCurveToTrack(trackPattern, velocityCurve) {
  if (!trackPattern?.steps) return trackPattern;
  
  return {
    ...trackPattern,
    steps: trackPattern.steps.map((step, i) => ({
      ...step,
      velocity: step.active ? (velocityCurve[i] || 80) : 0,
      // Auch Chord-Notes bekommen Velocity
      chordNotes: (step.chordNotes || []).map(cn => ({
        ...cn,
        velocity: step.active ? Math.round((velocityCurve[i] || 80) * 0.7) : 0,
      })),
    })),
  };
}
```

### 4.3 effectiveMood in Schritt 2 cachen

```diff
// PatternEngine.generate() — Schritt 2:
+ const effectiveMoods = {};  // Cache für Schritt 4

for (const track of ['drums', 'bass', 'synth']) {
  const tp = trackParams?.[track] || {};
  const effectiveMood = { ...moodParams };
  if (tp.density != null) effectiveMood.density = tp.density;
  if (tp.complexity != null) effectiveMood.complexity = tp.complexity;
  if (tp.groove != null) effectiveMood.groove = tp.groove;
  if (tp.darkness != null) effectiveMood.darkness = tp.darkness;
  if (tp.weirdness != null) effectiveMood.weirdness = tp.weirdness;
+ effectiveMoods[track] = { ...effectiveMood };
  
  // ... restliche Pipeline
}
```

---

## 🔧 Fix 5: Note Length → echte Gate-Time (2.5h)

### Problem
Note Length ändert Velocity statt Tondauer. "Note Length 20%" sollte Staccato sein, nicht leiser.

### Lösung
Step bekommt `gateTime`-Feld (ms). MidiScheduler sendet Note-Off nach `gateTime` statt am Step-Ende.

### 5.1 Step-Format final

```javascript
step = {
  active: true,
  note: 60,
  velocity: 100,
  timing: 5.2,        // ms offset (Swing/Groove)
  gateTime: null,     // ms bis Note-Off (null = stepDuration)
  chordNotes: [],     // [{ note, velocity }]
}
```

### 5.2 _applyMelodicParams() — gateTime statt velocity

```diff
_applyMelodicParams(melodicPattern, tp, track) {
  // ...
  let steps = melodicPattern.steps.map(step => {
    if (!step.active || step.note === 0) return { ...step, chordNotes: [], gateTime: null };

    // Octave + Range (unverändert)
    // ...

-   // Note length → Velocity (ALT)
-   let velocity = step.velocity;
-   if (noteLength < 50) {
-     velocity = Math.round(velocity * (0.5 + noteLength / 100));
-   } else if (noteLength > 50) {
-     velocity = Math.min(127, Math.round(velocity * (0.75 + noteLength / 200)));
-   }
+   // Note length → Gate-Time (NEU)
+   // noteLength 0% = staccato (10% step duration)
+   // noteLength 100% = legato (100% step duration)
+   // noteLength 50% = normal (50% step duration)
+   const stepDurationMs = 60000 / bpm / 4; // brauchen wir bpm hier
+   const gateFraction = 0.1 + (noteLength / 100) * 0.9; // 10% - 100%
+   const gateTime = Math.round(stepDurationMs * gateFraction);
+   
+   // Velocity bleibt wie von VelocityCurves gesetzt
+   let velocity = step.velocity;

    // Chord notes (unverändert aus Fix 3)
    // ...

-   return { ...step, note, velocity };
+   return { ...step, note, velocity, gateTime, chordNotes };
  });

  return { steps };
}
```

**Problem:** `bpm` ist in `_applyMelodicParams()` nicht verfügbar. Lösung: BPM als Parameter durchreichen.

### 5.3 PatternEngine — BPM an _applyMelodicParams durchreichen

```diff
// generate():
- trackPattern = this._applyMelodicParams(trackPattern, tp, track);
+ trackPattern = this._applyMelodicParams(trackPattern, tp, track, bpm);
```

### 5.4 MidiMapper.js — gateTime nutzen

```javascript
function trackToMidiEvents(trackPattern, channel, stepDuration) {
  const events = [];
  
  for (let i = 0; i < 16; i++) {
    const step = trackPattern.steps[i];
    if (!step.active) continue;
    
    const startTime = i * stepDuration + (step.timing || 0);
    const noteOffTime = startTime + (step.gateTime ?? stepDuration);
    
    // Root note
    events.push({
      type: 'noteOn',
      note: step.note,
      velocity: step.velocity,
      channel,
      time: startTime,
    });
    events.push({
      type: 'noteOff',
      note: step.note,
      channel,
      time: noteOffTime,  // ← gateTime!
    });
    
    // Chord notes (gleiche gateTime wie Root)
    for (const chord of (step.chordNotes || [])) {
      events.push({
        type: 'noteOn',
        note: chord.note,
        velocity: chord.velocity,
        channel,
        time: startTime,
      });
      events.push({
        type: 'noteOff',
        note: chord.note,
        channel,
        time: noteOffTime,
      });
    }
  }
  
  return events.sort((a, b) => a.time - b.time);
}
```

### 5.5 buildDrumSteps() — Drums haben kein gateTime

Drums sind One-Shot-Samples, brauchen keine variable Note-Length.
```javascript
// buildDrumSteps() — kein gateTime Feld
step = { active, note, velocity, timing, chordNotes: [] }
// gateTime ist implizit undefined → MidiMapper nutzt stepDuration als default
```

### 5.6 NoteRangePanel — Label anpassen

```diff
// NoteRangePanel.jsx
- <span className="text-xs font-medium w-20 text-gray-300">Note Length</span>
+ <span className="text-xs font-medium w-20 text-gray-300">Gate Time</span>
```

---

## 🔧 Fix 6: Integration, Build, Deploy, Test (1h)

### 6.1 Alle Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `src/store/useStore.js` | null-Defaults, `resetTrackParam`, Drum-Weights-Support |
| `src/engine/PatternEngine.js` | null-Checks, Drum-Weights raus, Chord-Logik fix, Per-Track Velocity, Gate-Time |
| `src/engine/GenreMixer.js` | `mixDrumPattern()` + `mixTrack()` mit `drumWeights` |
| `src/engine/VelocityCurves.js` | `applyVelocityCurveToTrack()` |
| `src/engine/MoodProcessor.js` | Unverändert (funktioniert) |
| `src/midi/MidiMapper.js` | Chord-Notes + Gate-Time Support |
| `src/components/Knob.jsx` | "Auto"-Modus (inherited, inheritedValue, onReset) |
| `src/components/TrackParamKnobs.jsx` | globalMood-Prop, Auto-Visual |
| `src/components/TrackParamSliders.jsx` | globalMood-Prop, Auto-Visual, Drum-Weight max 200 |
| `src/components/DrumMixPanel.jsx` | Range 0-200% |
| `src/components/NoteRangePanel.jsx` | Label "Gate Time" |
| `src/components/MoodKnobs.jsx` | Unverändert |
| `src/App.jsx` | Unverändert (Engine-Signatur bleibt gleich) |

### 6.2 Build & Deploy

```bash
cd /root/.local/.openclaw/workspace/projects/beatgen
npm run build
# Sicherstellen: 0 Errors, 0 Warnings

rm -rf /var/www/apps/beatgen/assets /var/www/apps/beatgen/index.html /var/www/apps/beatgen/favicon.svg
cp -r dist/* /var/www/apps/beatgen/
```

### 6.3 Test-Checkliste

#### Smoke Tests
- [ ] `beatgen.steppa.online` lädt ohne JS-Errors
- [ ] Global Mood Knobs funktionieren (ändern hörbar das Pattern)
- [ ] Per-Track Knobs zeigen "auto" im Initialzustand
- [ ] Per-Track Knob drehen → wird aktiv, zeigt Wert
- [ ] Per-Track Knob doppelklicken → reset auf "auto"
- [ ] Global Density 80 + Alle Tracks auf Auto → alle Spuren dichter

#### Functional Tests
- [ ] Drum Kick Weight 0% → keine Kicks
- [ ] Drum Kick Weight 200% → mehr Kicks
- [ ] Drum Snare/Hihat/Clap/Perc Weight unabhängig
- [ ] Synth Chord Mode "2-Note" → Power Chords hörbar
- [ ] Synth Chord Mode "3-Note" → Triads hörbar
- [ ] Synth Chord Mode "Off" → monophon
- [ ] Bass Note Length 10% (Gate Time) → Staccato
- [ ] Synth Note Length 90% → Legato (überlappende Noten)
- [ ] Octave +1 → eine Oktave höher
- [ ] Range Low/High clamping funktioniert

#### Regression Tests
- [ ] 🎲 Mutate Track funktioniert
- [ ] 🔄 Next Pattern funktioniert
- [ ] MIDI Clock Sync (Internal) funktioniert
- [ ] MIDI Clock Sync (External) funktioniert
- [ ] Presets speichern & laden (mit neuen null-Werten)
- [ ] Alte Presets laden (Migration auf null)
- [ ] Genre Mix Global + Per-Track Scope funktioniert
- [ ] Swing Global + Per-Track funktioniert
- [ ] Mute/Solo/Volume funktioniert
- [ ] TransportBar LED-Steps laufen
- [ ] Keine Console-Errors

### 6.4 Preset-Migration

```javascript
// PresetStore.js oder useStore.js loadPreset():
const MIGRATE_MOOD_PARAMS = ['density', 'complexity', 'groove', 'darkness', 'weirdness'];

function migrateTrackParams(trackParams) {
  if (!trackParams) return undefined;
  const migrated = {};
  for (const track of ['drums', 'bass', 'synth']) {
    const tp = trackParams[track];
    if (!tp) continue;
    migrated[track] = { ...tp };
    // Alte 50er-Werte → null (nie explizit gesetzt)
    for (const param of MIGRATE_MOOD_PARAMS) {
      if (tp[param] === 50) {
        migrated[track][param] = null;
      }
    }
  }
  return migrated;
}
```

---

## 📊 Geschätzter Aufwand pro Phase

| Phase | Aufgabe | Zeit |
|-------|---------|------|
| 1a | Store-Änderungen (null-Defaults, resetTrackParam) | 30 Min |
| 1b | Engine-Änderungen (null-Checks) | 15 Min |
| 1c | Knob.jsx "Auto"-Modus | 30 Min |
| 1d | TrackParamKnobs + TrackParamSliders Auto-UI | 30 Min |
| 1e | Preset-Migration | 15 Min |
| 2a | GenreMixer drumWeights | 30 Min |
| 2b | PatternEngine drumWeights Integration | 15 Min |
| 2c | DrumMixPanel Range 0-200 | 15 Min |
| 3a | Step-Format chordNotes | 15 Min |
| 3b | _applyMelodicParams Chord-Logik fix | 30 Min |
| 3c | MidiMapper Chord-Notes | 45 Min |
| 3d | buildMelodicSteps chordNotes-Feld | 15 Min |
| 4a | VelocityCurves.applyVelocityCurveToTrack | 15 Min |
| 4b | PatternEngine Per-Track Velocity | 30 Min |
| 4c | effectiveMoods Cache | 15 Min |
| 5a | Step-Format gateTime | 15 Min |
| 5b | _applyMelodicParams Gate-Time | 30 Min |
| 5c | MidiMapper Gate-Time | 30 Min |
| 5d | buildMelodicSteps gateTime-Feld | 10 Min |
| 5e | NoteRangePanel Label | 5 Min |
| 6a | Build | 5 Min |
| 6b | Deploy | 5 Min |
| 6c | Test (Smoke + Functional + Regression) | 45 Min |
| 6d | Bugfixes aus Testing | Puffer |
| **Total** | | **~10h** |

---

## 🎯 Abhängigkeiten

```
Fix 1 (null-Defaults) ───── unabhängig ─────► kann zuerst
Fix 2 (Drum Weights) ────── unabhängig ─────► parallel zu Fix 1
Fix 3 (Chord Mode) ──────── braucht chordNotes im Step ─► nach Fix 1
Fix 4 (Velocity per-track) ─ braucht effectiveMoods-Cache ─► nach Fix 1
Fix 5 (Gate Time) ───────── braucht gateTime im Step ─► nach Fix 1, parallel zu 3+4
Fix 6 (Integration) ──────── braucht alle ─────────────► zum Schluss
```

**Empfohlene Reihenfolge:**
1. Fix 1 + Fix 2 parallel (3h)
2. Fix 3 + Fix 4 + Fix 5 parallel (6h) — kann ein Subagent übernehmen
3. Fix 6 Integration & Test (1h)

---

## 🧬 Finale Seed-Architektur (unverändert)

Die Seed-Architektur bleibt stabil. Alle Fixes sind deterministisch — gleiche Parameter = gleiches Pattern.

```
genreWeights ──┐
moodParams ────┤
swingConfig ──┼──→ baseSeed = hashParams(...) ──┐
bpm ──────────┘                                  │
                                                  ├──→ trackSeed ──→ Per-Track Gen
patternNonce ──→ × 104729 ───────────────────────┤
mutation[track] → × 7919 ────────────────────────┘
```

Neu: `drumWeights` beeinflussen `mixDrumPattern()` → Ergebnis deterministisch via `trackSeed`.
Neu: `gateTime` berechnet aus `noteLength × bpm` → deterministisch.
Neu: `chordNotes` aus `chordMode + note` → deterministisch via `trackSeed`.

---

## ⚠️ Risiken

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Preset-Migration bricht alte Presets | Mittel | Version-Flag, Fallback auf Defaults |
| Chord-Mode + polyphone Synths = CPU-Last | Niedrig | Max 4 Noten pro Step (Root + 3 Chord) |
| Gate-Time sehr kurz (< 5ms) = Click | Niedrig | Minimum gateTime = 10ms |
| Drum Weights 200% = zu viele Hits | Niedrig | Cap auf 200%, rng-Dämpfung |
| MIDI Clock Sync mit Gate-Times | Niedrig | Gate-Times werden relativ zur Step-Duration berechnet, BPM-Änderungen passen sich an |
| Alte Presets mit `density: 50` | Mittel | Migration: 50 → null für Mood-Params |
