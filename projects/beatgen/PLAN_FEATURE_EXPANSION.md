# BeatGen Feature Expansion — Umsetzungsplan

_Stand: 2026-08-08 ~20:00 CEST_

---

## 📋 Übersicht

Sechs große Änderungen:

| # | Feature | Aufwand | Impact |
|---|---------|---------|--------|
| 1 | StepSequencer entfernen | Klein | UI-Cleanup |
| 2 | Per-Track Parameter Panels | Groß | Neue Architektur |
| 3 | Genre Mix Skalierung (0-100% unabhängig) | Mittel | Store + Engine |
| 4 | Genre Mix Scope Selector (Global / Track) | Mittel | Store + Engine + UI |
| 5 | Per-Track "Mutate Pattern" Button | Mittel | Store + Engine + UI |
| 6 | Per-Track "Next Pattern" Button | Klein | Store + Engine + UI |

---

## 1. StepSequencer-Visualisierung entfernen

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/TrackPanel.jsx` | `<StepSequencer>` entfernen, Import löschen |
| `src/components/StepSequencer.jsx` | **Löschen** |
| `src/App.jsx` | Import entfernen (falls direkt importiert) |

### Vorgehen

```diff
// TrackPanel.jsx — aus dem collapsible content:
- <StepSequencer
-   currentStep={isPlaying ? currentStep : -1}
-   color={config.color}
- />
```

Die 16-Step-LED-Leiste in der `TransportBar` bleibt erhalten (die ist das kompaktere, bessere Visual Feedback).

---

## 2. Per-Track Parameter Panels

### Konzept

Jede Instrumenten-Spur bekommt im `TrackPanel` ein eigenes Set an Bedienelementen — Slider im Stil von `GenreWeights`/`SwingControl`, Knobs im Stil von `MoodKnobs`. Die Parameter sind auf das jeweilige Instrument abgestimmt.

### Panel-Aufbau pro Track

#### 🥁 Drums Track Panel
```
┌─ Track Header (Mute/Solo/Channel/Collapse) ─┐
│                                               │
│  Volume: ████████░░░░ 80%                     │
│                                               │
│  🎛️ Drum Feel                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ Density │ │Complex. │ │ Groove  │         │
│  │   50    │ │   50    │ │   50    │         │
│  └─────────┘ └─────────┘ └─────────┘         │
│  ┌─────────┐ ┌─────────┐                     │
│  │ Swing   │ │Weirdness│                     │
│  │   50    │ │   50    │                     │
│  └─────────┘ └─────────┘                     │
│                                               │
│  🎵 Drum Pattern Mix (override)               │
│  Kick Weight:  ████████████ 80%              │
│  Snare Weight: ████████████ 80%              │
│  Hihat Weight: ████████░░░░ 60%              │
│  Clap Weight:  ██████░░░░░░ 40%              │
│  Perc Weight:  ████░░░░░░░░ 25%              │
└───────────────────────────────────────────────┘
```

#### 🎸 Bass Track Panel
```
┌─ Track Header (Mute/Solo/Channel/Collapse) ─┐
│                                               │
│  Volume: ██████████░░ 85%                     │
│                                               │
│  🎛️ Bass Feel                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ Density │ │Complex. │ │ Groove  │         │
│  │   50    │ │   50    │ │   50    │         │
│  └─────────┘ └─────────┘ └─────────┘         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │Darkness │ │Weirdness│ │ Octave  │         │
│  │   50    │ │   50    │ │    0    │         │
│  └─────────┘ └─────────┘ └─────────┘         │
│                                               │
│  🎵 Note Range                                │
│  Range Low:  ████████░░░░ C1 (36)            │
│  Range High: ██████████░░ C3 (60)            │
│  Note Length:▓▓▓▓▓▓▓▓▓▓░ 80%                │
└───────────────────────────────────────────────┘
```

#### 🎹 Synth Track Panel
```
┌─ Track Header (Mute/Solo/Channel/Collapse) ─┐
│                                               │
│  Volume: ██████████░░ 75%                     │
│                                               │
│  🎛️ Synth Feel                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ Density │ │Complex. │ │ Groove  │         │
│  │   50    │ │   50    │ │   50    │         │
│  └─────────┘ └─────────┘ └─────────┘         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │Darkness │ │Weirdness│ │ Octave  │         │
│  │   50    │ │   50    │ │    0    │         │
│  └─────────┘ └─────────┘ └─────────┘         │
│                                               │
│  🎵 Note Range                                │
│  Range Low:  ██████████░░ C3 (48)            │
│  Range High: ████████████ C5 (72)            │
│  Note Length:▓▓▓▓▓▓▓▓░░░ 65%                │
│  Chord Mode: ○ Off  ● 2-Note  ○ 3-Note      │
└───────────────────────────────────────────────┘
```

### Neue/geänderte Komponenten

| Komponente | Typ | Beschreibung |
|------------|-----|-------------|
| `TrackParamKnobs.jsx` | **Neu** | 3-Knob-Row (Density/Complexity/Groove) — wiederverwendbar |
| `TrackParamSliders.jsx` | **Neu** | Slider-Set für Darkness/Weirdness/Octave — wiederverwendbar |
| `DrumMixPanel.jsx` | **Neu** | Kick/Snare/Hihat/Clap/Perc Weight Slider |
| `NoteRangePanel.jsx` | **Neu** | Range Low/High + Note Length Slider (Bass & Synth) |
| `TrackPanel.jsx` | **Geändert** | StepSequencer entfernt, per-Track Controls integriert |
| `Knob.jsx` | **Unverändert** | Wiederverwendet |

### Store-Erweiterungen für Track-Parameter

```javascript
// Neue State-Felder in useStore.js
trackParams: {
  drums: {
    density: 50,      // 0-100
    complexity: 50,   // 0-100
    groove: 50,       // 0-100
    swing: 50,        // 0-100
    weirdness: 50,    // 0-100
    // Drum-spezifisch
    kickWeight: 100,   // 0-100 (relative Gewichtung im Mix)
    snareWeight: 100,
    hihatWeight: 100,
    clapWeight: 100,
    percWeight: 100,
  },
  bass: {
    density: 50,
    complexity: 50,
    groove: 50,
    darkness: 50,
    weirdness: 50,
    octave: 0,         // -2 to +2
    rangeLow: 28,      // MIDI note
    rangeHigh: 60,     // MIDI note
    noteLength: 80,    // 0-100% (sustain)
  },
  synth: {
    density: 50,
    complexity: 50,
    groove: 50,
    darkness: 50,
    weirdness: 50,
    octave: 0,
    rangeLow: 48,
    rangeHigh: 84,
    noteLength: 65,
    chordMode: 'off',  // 'off' | '2note' | '3note'
  },
},

// Actions
setTrackParam: (track, param, value) => set(state => ({
  trackParams: {
    ...state.trackParams,
    [track]: { ...state.trackParams[track], [param]: value }
  },
  patternDirty: true,
})),
```

### Engine-Änderungen für Track-Parameter

Der `PatternEngine.generate()` muss erweitert werden, um pro Track andere Parameter zu verwenden:

```javascript
// PatternEngine.generate() — neue Signatur
generate(genreWeights, moodParams, swingConfig, bpm, trackParams, trackGenreWeights) {
  // 1. Mix: pro Track separate Genre-Weights verwenden (falls trackGenreWeights gesetzt)
  // 2. Mood: globale moodParams als Base, dann trackParams als Override
  // 3. Drum-Spezial: kickWeight/snareWeight etc. beeinflussen drumMix-Wahrscheinlichkeiten
  // 4. Bass/Synth-Spezial: octave verschiebt Noten, rangeLow/High begrenzt, noteLength setzt Sustain
  // 5. Synth-Spezial: chordMode erzeugt 2- oder 3-stimmige Akkorde
}
```

Die konkrete Engine-Logik:

#### Drum Track Specs
- `kickWeight`–`percWeight`: Multiplikatoren auf die Mix-Wahrscheinlichkeit des jeweiligen Drum-Instruments. Bei 100% = normal, bei 0% = Instrument stumm, bei 200% = doppelte Wahrscheinlichkeit (später erweiterbar).
- `density`: Wie global, aber nur für Drums
- `complexity`: Ghost-Notes nur für Drums
- `swing`: Per-Track Swing (ersetzt `trackSwing` aus SwingControl)
- `groove`: Micro-Timing nur für Drums

#### Bass Track Specs
- `octave`: Verschiebt alle Bass-Noten um ±12/24 Halbtöne
- `rangeLow`/`rangeHigh`: MIDI-Note-Bereich, Noten außerhalb werden oktaviert
- `noteLength`: 0% = Staccato (1 Step Sustain), 100% = Legato (4 Steps)
- `darkness`: Skalen-Auswahl (major/minor/phrygian) nur für Bass

#### Synth Track Specs
- `octave`: Wie Bass
- `rangeLow`/`rangeHigh`: Wie Bass
- `noteLength`: Wie Bass
- `chordMode`: 'off' = monophon, '2note' = Power-Chords/Intervals, '3note' = Triads

---

## 3. Genre Mix Skalierung — Keine Normalisierung mehr

### Problem

Aktuell normalisiert `setGenreWeight` im Store die Werte zwangsweise auf Summe=100%. Wenn man Techno auf 80% schiebt, werden die anderen automatisch runterskaliert → keiner kann >50% gehen ohne die anderen zu killen.

### Lösung

Jeder Genre-Slider geht unabhängig von 0–100%. Die Normalisierung passiert **nur noch im Engine-Layer** (`GenreMixer.normalizeWeights()`), nicht im Store. Der Store speichert Rohwerte.

### Store-Änderung

```diff
// useStore.js — setGenreWeight
setGenreWeight: (genre, value) => set(state => {
  const genres = { ...state.genres, [genre]: Math.max(0, Math.min(100, value)) }
- // KEINE Normalisierung mehr!
- // const sum = ... normalize ...
  return { genres, patternDirty: true }
}),
```

```diff
// GenreWeights.jsx — Total-Anzeige
- <span>Total: {Object.values(genres).reduce((a, b) => a + b, 0)}%</span>
+ <span>Total: {Object.values(genres).reduce((a, b) => a + b, 0)}% (relative mix)</span>
```

### Engine-Änderung

`normalizeWeights()` in `GenreMixer.js` **bleibt unverändert** — es normalisiert bereits korrekt auf sum=1.0, egal ob die Eingangswerte 100% oder 500% summieren. Es muss nur den Edge-Case `sum === 0` (equal distribution) weiterhin handlen.

**Wichtig:** Seeds müssen stabil bleiben. `hashParams(genreWeights, ...)` bekommt jetzt andere Werte → Patterns ändern sich. Das ist gewollt und erwartet.

---

## 4. Genre Mix Scope Selector

### Konzept

Im `GenreWeights`-Panel erscheint ein Scope-Selector — eine Pill-Toggle-Leiste, mit der man wählt, ob die Genre-Slider-Änderungen **global** (für alle drei Spuren) oder **track-spezifisch** (nur für Drums/Bass/Synth) gelten.

### UI-Design

```
┌──────────────────────────────────────────────┐
│  🎭 Genre Mix                                │
│                                              │
│  Scope: [🌍 Global] [🥁 Drums] [🎸 Bass] [🎹 Synth]  │
│                                              │
│  ⚡ Techno   ████████████░░░░ 80%            │
│  🏠 House    ██████░░░░░░░░░░ 35%            │
│  🧪 Acid     ██████████░░░░░░ 65%            │
│  🌀 Trance   ████████░░░░░░░░ 50%            │
│  🥁 D&B      ████░░░░░░░░░░░░ 20%            │
│  🎤 Hip-Hop  ██░░░░░░░░░░░░░░ 10%            │
│                                              │
│  Total: 260% (relative mix)                  │
└──────────────────────────────────────────────┘
```

- **Global-Modus:** Slider zeigen `store.genres`, Änderungen gehen auf `store.genres`
- **Track-Modus:** Slider zeigen `store.trackGenres[track]`, Änderungen gehen auf `store.trackGenres[track]`
- Visuelles Feedback: Der aktive Scope-Button leuchtet in der Track-Farbe (rot/blau/lila)

### Store-Erweiterung

```javascript
// Neue State-Felder
genreScope: 'global',  // 'global' | 'drums' | 'bass' | 'synth'

trackGenres: {
  drums: { techno: 20, house: 15, acid: 20, trance: 5, dnb: 10, hiphop: 10 },
  bass:  { techno: 20, house: 15, acid: 20, trance: 5, dnb: 10, hiphop: 10 },
  synth: { techno: 20, house: 15, acid: 20, trance: 5, dnb: 10, hiphop: 10 },
},

// Actions
setGenreScope: (scope) => set({ genreScope: scope }),

setTrackGenreWeight: (track, genre, value) => set(state => {
  const trackGenres = { ...state.trackGenres };
  trackGenres[track] = {
    ...trackGenres[track],
    [genre]: Math.max(0, Math.min(100, value))
  };
  return { trackGenres, patternDirty: true };
}),
```

### Engine-Integration

```javascript
// PatternEngine.generate() — pro Track:
for (const track of ['drums', 'bass', 'synth']) {
  // Verwende track-spezifische Genre-Weights wenn vorhanden,
  // sonst falle zurück auf globale Weights
  const effectiveWeights = trackGenreWeights?.[track] 
    ? trackGenreWeights[track] 
    : genreWeights;
  
  const raw = mixTrack(effectiveWeights, track, seed);
  // ... restliche Pipeline
}
```

D.h. der `GenreMixer` muss pro Track separat aufgerufen werden können, nicht nur `mixAll()`.

### GenreMixer-Änderung

```javascript
// Neue Funktion: mixiert nur einen Track
export function mixTrack(genreWeights, trackType, seed) {
  const nw = normalizeWeights(genreWeights);
  
  if (trackType === 'drums') {
    return {
      kick:  mixDrumPattern(nw, 'kick', seed),
      snare: mixDrumPattern(nw, 'snare', seed),
      hihat: mixDrumPattern(nw, 'hihat', seed),
      clap:  mixDrumPattern(nw, 'clap', seed),
      perc:  mixDrumPattern(nw, 'perc', seed),
    };
  }
  
  return mixMelodicPattern(nw, trackType, seed);
}

// mixAll() bleibt als Convenience für global-modus
export function mixAll(genreWeights, seed) {
  return {
    drums: mixTrack(genreWeights, 'drums', seed),
    bass: mixTrack(genreWeights, 'bass', seed),
    synth: mixTrack(genreWeights, 'synth', seed),
  };
}
```

---

## 5. Per-Track "Mutate Pattern" Button

### Konzept

Jeder Track bekommt einen "🎲 Mutate"-Button im Track-Header. Ein Klick:
1. Inkrementiert den `mutationCount` für diesen Track
2. Löst eine Pattern-Neugenerierung aus — aber **nur für diesen Track**
3. Die Mutation verändert den Seed → der GenreMixer/MoodProcessor trifft andere Random-Entscheidungen, aber die Parameter (Weights, Mood, Swing) bleiben gleich
4. Das Ergebnis: das Pattern klingt verwandt, aber anders. Gleiche Genre-DNA, andere Ausprägung.

**Wichtig:** Eine Mutation ändert NUR den betroffenen Track. Die anderen beiden Spuren laufen unverändert weiter. Im MIDI-Output werden nur die Events des mutierten Tracks aktualisiert.

### Seed-Strategie für Mutation

```javascript
// PatternEngine._generateTrack() — seed-Berechnung
const baseSeed = hashParams(genreWeights, moodParams, swingConfig);
const trackSeed = baseSeed + (mutationCount[track] || 0) * 7919; // 7919 = prime für gute Streuung
```

- `mutationCount === 0` → Original-Pattern (deterministisch, reproduzierbar)
- `mutationCount === 1` → Erste Mutation (ähnlich, leicht anders)
- `mutationCount === 2` → Zweite Mutation (nochmal anders)
- etc.

Pro Mutation wird der Seed um `7919 * n` verschoben. Da `7919` eine Primzahl ist, ergeben sich gut gestreute Seed-Sequenzen.

### UI-Design

```
┌─ Track Header ─────────────────────────────────────┐
│ 🥁 Drums  [Ch10 ▾]    [M] [S]  [🎲] [🔄]  [▼]    │
└────────────────────────────────────────────────────┘
```

- **🎲 Mutate**: Kleiner runder Button neben Mute/Solo
- Tooltip: "Mutate drums pattern"
- Visuelles Feedback: Button pulsiert kurz (scale bounce), Track-Content flasht kurz in Track-Farbe
- Haptik: `navigator.vibrate(15)` auf Mobile

### Button-Komponente

```jsx
// Track-Header Action-Buttons (neben Mute/Solo)
<motion.button
  whileTap={{ scale: 0.85 }}
  onClick={() => mutateTrackPattern(trackKey)}
  className="w-8 h-8 rounded-md bg-black/30 text-muted hover:text-white flex items-center justify-center border border-white/5 transition-colors hover:border-current"
  aria-label={`Mutate ${config.label} pattern`}
  title={`Mutate ${config.label}`}
>
  <motion.span
    animate={isMutating ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
    transition={{ duration: 0.4 }}
    className="text-sm"
  >
    🎲
  </motion.span>
</motion.button>
```

### Store-Erweiterung

```javascript
// useStore.js
mutationCount: {
  drums: 0,
  bass: 0,
  synth: 0,
},

// Action: einzelne Spur mutieren
mutateTrack: (track) => set(state => {
  const mutationCount = { ...state.mutationCount };
  mutationCount[track] = (mutationCount[track] || 0) + 1;
  return { mutationCount, patternDirty: true };
}),

// Action: alle Mutations reseten (bei Preset-Load, BPM-Change, Genre-Change)
resetMutationCounts: () => set({
  mutationCount: { drums: 0, bass: 0, synth: 0 }
}),
```

### Engine-Integration

```javascript
// PatternEngine.generate() — seed pro Track
const baseSeed = hashParams(genreWeights, moodParams, swingConfig.mode, swingConfig.amount);

for (const track of ['drums', 'bass', 'synth']) {
  const tp = trackParams?.[track] || {};
  const tgw = trackGenreWeights?.[track] || genreWeights;
  const mc = mutationCount?.[track] || 0;
  const nonce = patternNonce || 0;
  
  // Seed: Base + Nonce + Mutation-Offset
  // nonce für "Next Pattern", mutationCount für "Mutate"
  const trackSeed = baseSeed + (nonce * 104729) + (mc * 7919);
  
  result[track] = this._generateTrack(track, tgw, effectiveMood, swingConfig, bpm, tp, trackSeed);
}
```

### Live-Update nach Mutation

Mutation muss im laufenden Betrieb funktionieren:

```javascript
// App.jsx — Mutation Handler (neu)
const handleMutateTrack = useCallback((track) => {
  const state = useStore.getState();
  state.mutateTrack(track);
  
  // Direkt neu generieren und live laden
  if (schedulerRef.current?.isPlaying) {
    const updatedState = useStore.getState();
    const swingConfig = {
      mode: updatedState.swingMode,
      amount: updatedState.swingAmount,
      trackSwing: updatedState.trackSwing,
    };
    const pattern = patternEngine.generate(
      updatedState.genres,
      updatedState.mood,
      swingConfig,
      updatedState.bpm,
      updatedState.trackParams,
      updatedState.trackGenres,
      updatedState.mutationCount,
      updatedState.patternNonce
    );
    schedulerRef.current.loadPatternLive(pattern, updatedState.tracks);
  }
}, []);
```

### Reset-Regeln

| Aktion | mutationCount | patternNonce |
|--------|--------------|-------------|
| Mutate Track klicken | `track++` | unverändert |
| Next Pattern klicken | unverändert | `++` |
| Genre-Weight ändern | Reset auf `{0,0,0}` | unverändert |
| Mood-Parameter ändern | Reset auf `{0,0,0}` | unverändert |
| Swing ändern | Reset auf `{0,0,0}` | unverändert |
| BPM ändern | unverändert | unverändert |
| Preset laden | Aus Preset übernehmen | Aus Preset übernehmen |
| Mute/Solo/Volume ändern | unverändert | unverändert |

**Logik dahinter:** Wenn du Parameter änderst, willst du das "Original"-Pattern mit den neuen Settings hören — nicht die 3. Mutation. Also Reset auf 0. Mute/Solo/Volume sind Mix-Entscheidungen, keine Pattern-Änderungen.

---

## 6. Per-Track "Next Pattern" Button

### Konzept

Direkt neben "Mutate" sitzt ein "🔄 Next"-Button. Ein Klick:
1. Inkrementiert den globalen `patternNonce`
2. Generiert ALLE drei Spuren komplett neu
3. Der Nonce verändert den Base-Seed → komplett andere Random-Entscheidungen auf allen Ebenen

**Im Gegensatz zu Mutate:** Next Pattern ist eine komplette Neugeburt. Alle Spuren ändern sich, nicht nur eine. Der Seed-Sprung ist größer (`* 104729` vs `* 7919`).

### Seed-Strategie

```javascript
const baseSeed = hashParams(genreWeights, moodParams, swingConfig);
const nonce = patternNonce || 0;
// nonce * 104729 (große Primzahl) = komplett andere Seed-Welt
const trackSeed = baseSeed + (nonce * 104729) + (mutationCount[track] * 7919);
```

### UI-Design

```
┌─ Track Header ─────────────────────────────────────┐
│ 🥁 Drums  [Ch10 ▾]    [M] [S]  [🎲] [🔄]  [▼]    │
└────────────────────────────────────────────────────┘
```

- **🔄 Next**: Gleiche Größe wie Mutate, gleiche Position (rechts daneben)
- Klick auf EINEN beliebigen Track-Button feuert globales Reroll für ALLE Spuren
- Visuelles Feedback: ALLE drei Track-Panels flashen kurz gleichzeitig
- Button ist auf jedem Track gleich — es ist ein globaler Befehl, nur per-Track erreichbar

### Store-Erweiterung

```javascript
// useStore.js
patternNonce: 0,

// Action: komplett neues Pattern
nextPattern: () => set(state => ({
  patternNonce: (state.patternNonce || 0) + 1,
  patternDirty: true,
})),
```

### Warum per-Track sichtbar, aber global wirkend?

Weil es konzeptionell zu den Track-Controls gehört ("ich will was an dieser Spur ändern"), aber praktisch ist ein komplett neues Pattern für alle drei Spuren sinnvoller als nur eine Spur neu zu würfeln während die anderen gleich bleiben. Das wäre dissonant.

Alternative: Man könnte auch pro-Track "Next Pattern" machen. Aber dann müsste man dreimal klicken für ein komplett neues Pattern, und die Spuren würden auseinanderdriften. Die aktuelle Architektur mit Global-Nonce + Track-Mutations ist flexibler und intuitiver.

### Button-Komponente

```jsx
<motion.button
  whileTap={{ scale: 0.85 }}
  onClick={handleNextPattern}
  className="w-8 h-8 rounded-md bg-black/30 text-muted hover:text-white flex items-center justify-center border border-white/5 transition-colors hover:border-current"
  aria-label="Next pattern (all tracks)"
  title="New pattern"
>
  <motion.span
    animate={isNextPattern ? { rotate: 360 } : {}}
    transition={{ duration: 0.5, ease: 'easeInOut' }}
    className="text-sm"
  >
    🔄
  </motion.span>
</motion.button>
```

### Live-Update nach Next Pattern

```javascript
// App.jsx — Next Pattern Handler (neu)
const handleNextPattern = useCallback(() => {
  const state = useStore.getState();
  state.nextPattern();
  
  if (schedulerRef.current?.isPlaying) {
    const updatedState = useStore.getState();
    const swingConfig = {
      mode: updatedState.swingMode,
      amount: updatedState.swingAmount,
      trackSwing: updatedState.trackSwing,
    };
    const pattern = patternEngine.generate(
      updatedState.genres,
      updatedState.mood,
      swingConfig,
      updatedState.bpm,
      updatedState.trackParams,
      updatedState.trackGenres,
      updatedState.mutationCount,
      updatedState.patternNonce
    );
    schedulerRef.current.loadPatternLive(pattern, updatedState.tracks);
  }
}, []);
```

---

## 🏗️ Detaillierte Implementierungs-Phasen

### Phase 1: StepSequencer entfernen (30 Min)

1. `src/components/TrackPanel.jsx`:
   - `StepSequencer`-Import entfernen
   - `<StepSequencer ... />` aus dem Collapsible-Content entfernen
2. `src/components/StepSequencer.jsx` → löschen
3. Build testen: `npm run build` → keine Import-Errors
4. Deploy & visuell prüfen

### Phase 2: Genre Mix Scaling + Scope (2h)

**Store (`src/store/useStore.js`):**
1. `setGenreWeight`: Normalisierungs-Logik entfernen, nur noch Clamping auf 0-100
2. Neue Felder: `genreScope`, `trackGenres`
3. Neue Actions: `setGenreScope`, `setTrackGenreWeight`
4. `savePreset`/`loadPreset`: `genreScope` und `trackGenres` in Preset-Objekt aufnehmen

**GenreWeights-Komponente (`src/components/GenreWeights.jsx`):**
1. Scope-Selector als Pill-Toggle-Leiste über den Slidern
2. Slider lesen/schreiben je nach Scope aus `genres` oder `trackGenres[scope]`
3. Visuelles Feedback: aktiver Scope-Button mit Track-Color-Glow
4. "Total"-Anzeige anpassen: "Total: X% (relative mix)" statt fester 100%-Erwartung
5. Animation: Scope-Wechsel smoothed die Slider-Werte

**Engine (`src/engine/GenreMixer.js`):**
1. Neue Funktion `mixTrack(genreWeights, trackType, seed)` extrahieren
2. `mixAll()` refactoren → ruft `mixTrack()` 3× auf
3. `normalizeWeights()`: Edge-Case `sum === 0` bereits gehandled ✅

**Engine (`src/engine/PatternEngine.js`):**
1. `generate()` erweitern: neuer Parameter `trackGenreWeights`
2. Pro Track entscheiden: `trackGenreWeights?.[track] ?? genreWeights`
3. `App.jsx`-Calls anpassen: `trackGenreWeights` aus Store übergeben

**App (`src/App.jsx`):**
1. `trackGenres` aus Store subscriben
2. An `patternEngine.generate()` übergeben
3. Live-Update-Effect: `trackGenres` in Dependency-Array

### Phase 3: Mutate & Next Pattern Buttons (1.5h)

**Store (`src/store/useStore.js`):**
1. Neue Felder: `patternNonce: 0`, `mutationCount: { drums: 0, bass: 0, synth: 0 }`
2. Neue Actions: `mutateTrack(track)`, `nextPattern()`, `resetMutationCounts()`
3. `setGenreWeight`/`setMood`/`setSwingAmount`/`setSwingMode`: `mutationCount` auf `{0,0,0}` resetten
4. `savePreset`/`loadPreset`: `patternNonce` und `mutationCount` in Preset-Objekt

**Engine (`src/engine/PatternEngine.js`):**
1. `generate()`-Signatur: `mutationCount` und `patternNonce` als Parameter
2. Seed-Berechnung: `baseSeed + (nonce * 104729) + (mutation[track] * 7919)`
3. Pro-Track-Generation nutzt eigenen `trackSeed`

**App (`src/App.jsx`):**
1. `handleMutateTrack(track)` und `handleNextPattern()` Handler
2. Beide rufen `patternEngine.generate()` mit aktuellen Werten + live update
3. An `TrackPanel` als Props durchreichen

**TrackPanel (`src/components/TrackPanel.jsx`):**
1. Zwei neue Buttons im Track-Header: 🎲 und 🔄
2. Button-Platzierung: zwischen Solo und Collapse-Toggle
3. Animations: shake/rotate bei Klick, kurzer Flash auf Track-Content
4. `handleNextPattern` ist auf allen drei Tracks der gleiche Callback

### Phase 4: Track Parameter Panels (4h)

**Neue Komponenten:**

1. **`src/components/TrackParamKnobs.jsx`** (1h)
   - 3-Knob-Row: Density, Complexity, Groove
   - Props: `track`, `params`, `onChange`, `color`
   - Wiederverwendet `Knob.jsx`

2. **`src/components/TrackParamSliders.jsx`** (45 Min)
   - Slider-Set: Darkness, Weirdness, Octave
   - Props: `track`, `params`, `onChange`, `color`
   - "Octave"-Slider: Range -2..+2, Snaps auf Ganzzahlen
   - Style wie `SwingControl` Slider

3. **`src/components/DrumMixPanel.jsx`** (45 Min)
   - 5 Slider: Kick, Snare, Hihat, Clap, Perc Weight
   - Props: `params`, `onChange`, `color`
   - Style wie `GenreWeights` Slider

4. **`src/components/NoteRangePanel.jsx`** (45 Min)
   - Slider: Range Low (MIDI Note), Range High (MIDI Note), Note Length (%)
   - Props: `track`, `params`, `onChange`, `color`
   - Range Low/High: Show MIDI note name (C1, C3, etc.) neben Wert
   - Optional: Chord Mode Toggle (nur für Synth)

**Store-Erweiterung (`src/store/useStore.js`):**
1. `trackParams`-Objekt mit Defaults (siehe oben)
2. `setTrackParam(track, param, value)` Action
3. Preset-Support: `trackParams` in savePreset/loadPreset

**TrackPanel-Umbau (`src/components/TrackPanel.jsx`):**
1. StepSequencer entfernt → mehr Platz
2. Pro Track: Collapsible-Content erweitern
3. Drums: `TrackParamKnobs` + `DrumMixPanel`
4. Bass: `TrackParamKnobs` + `TrackParamSliders` + `NoteRangePanel`
5. Synth: `TrackParamKnobs` + `TrackParamSliders` + `NoteRangePanel` (mit Chord Mode)
6. Scroll-Verhalten: Panel kann scrollen wenn Inhalt > Viewport

**Engine-Erweiterung:**

1. **`src/engine/PatternEngine.js`** — `generate()`:
   ```javascript
   generate(genreWeights, moodParams, swingConfig, bpm, trackParams, trackGenreWeights) {
     const result = {};
     
     for (const track of ['drums', 'bass', 'synth']) {
       const tp = trackParams?.[track] || {};
       const tgw = trackGenreWeights?.[track] || genreWeights;
       const effectiveMood = { ...moodParams }; // global base
       
       // Override global mood with track params
       if (tp.density !== undefined) effectiveMood.density = tp.density;
       if (tp.complexity !== undefined) effectiveMood.complexity = tp.complexity;
       if (tp.groove !== undefined) effectiveMood.groove = tp.groove;
       if (tp.darkness !== undefined) effectiveMood.darkness = tp.darkness;
       if (tp.weirdness !== undefined) effectiveMood.weirdness = tp.weirdness;
       
       // Per-track generation
       result[track] = this._generateTrack(track, tgw, effectiveMood, swingConfig, bpm, tp, seed);
     }
     
     return result;
   }
   ```

2. **Neue Engine-Funktionen:**
   - `_generateTrack(track, weights, mood, swing, bpm, params, seed)` → Track-Pattern
   - Drum-spezifisch: `_applyDrumWeights(rawDrums, params)` — kickWeight etc. als Multiplikator
   - Melodic-spezifisch: `_applyOctaveRange(steps, params)` — octave + rangeLow/High clamping
   - Melodic-spezifisch: `_applyNoteLength(steps, params)` — Sustain-Steps aus noteLength
   - Synth-spezifisch: `_applyChordMode(steps, params)` — Dupliziere Noten für 2/3-stimmige Akkorde

### Phase 5: Integration & Testing (1.5h)

1. **App.jsx**: Alle neuen Store-Felder subscriben, an Engine übergeben
2. **PresetManager**: Erweiterte Presets speichern/laden
3. **Build**: `npm run build` → 0 Errors
4. **Deploy**: nach `/var/www/apps/beatgen/`
5. **Browser-Test**:
   - Alle Slider/Knobs reagieren
   - Scope-Selector schaltet korrekt um
   - Per-Track Parameter ändern hörbar das Pattern
   - Presets speichern/laden mit neuen Feldern
   - MIDI Clock Sync weiterhin funktional
   - Keine Console-Errors
6. **Edge Cases**:
   - Alle Genre-Weights = 0 → equal distribution
   - Octave = -2 mit Range Low=36 → keine Noten unter 36
   - Note Length = 0 → Staccato (Sustain 1 Step)
   - Chord Mode on + dichte Pattern → keine überlappenden Noten

---

## 📁 Datei-Änderungsliste (komplett)

| Datei | Aktion | Beschreibung |
|-------|--------|-------------|
| `src/components/StepSequencer.jsx` | 🗑️ Löschen | Nicht mehr benötigt |
| `src/components/TrackParamKnobs.jsx` | ✨ Neu | 3-Knob-Row (Density/Complexity/Groove) |
| `src/components/TrackParamSliders.jsx` | ✨ Neu | Slider-Set (Darkness/Weirdness/Octave) |
| `src/components/DrumMixPanel.jsx` | ✨ Neu | Drum-Instrument Weight Slider |
| `src/components/NoteRangePanel.jsx` | ✨ Neu | Range Low/High + Note Length + Chord Mode |
| `src/components/GenreWeights.jsx` | 🔧 Ändern | Scope-Selector + keine Normalisierung |
| `src/components/TrackPanel.jsx` | 🔧 Ändern | StepSequencer raus, per-Track Panels + Mutate/Next Buttons rein |
| `src/components/SwingControl.jsx` | 🔧 Ändern | Track-Mode mit neuen trackParams syncen |
| `src/components/MoodKnobs.jsx` | 🔧 Ändern | Label: "Global Mood" (Master) |
| `src/store/useStore.js` | 🔧 Ändern | genreScope, trackGenres, trackParams, Actions |
| `src/engine/GenreMixer.js` | 🔧 Ändern | `mixTrack()` extrahieren |
| `src/engine/PatternEngine.js` | 🔧 Ändern | Per-Track Generation, neue Helper |
| `src/engine/MoodProcessor.js` | 🔧 Ändern | `applyMoodSingleTrack()` für per-Track |
| `src/store/useStore.js` | 🔧 Ändern | patternNonce, mutationCount, mutateTrack, nextPattern, resetMutationCounts, Reset-Regeln in setGenreWeight/Mood/Swing |
| `src/App.jsx` | 🔧 Ändern | handleMutateTrack/handleNextPattern, neue Store-Felder an Engine durchreichen |
| `src/components/PresetManager.jsx` | 🔧 Ändern | Preset-Schema um mutationCount + patternNonce erweitern |
| `src/presets/defaults.js` | 🔧 Ändern | Default-Presets mit neuen Feldern |

---

## 🎨 UI/UX Details

### Scope-Selector (GenreWeights)

```jsx
// Pill-Toggle mit Track-Farben
<div className="flex gap-1 mb-3">
  {[
    { key: 'global', label: '🌍 Global', color: '#8b5cf6' },
    { key: 'drums',  label: '🥁 Drums',  color: '#ef4444' },
    { key: 'bass',   label: '🎸 Bass',   color: '#3b82f6' },
    { key: 'synth',  label: '🎹 Synth',  color: '#a855f7' },
  ].map(({ key, label, color }) => (
    <motion.button
      key={key}
      onClick={() => setGenreScope(key)}
      className={`flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-full transition-all ${
        genreScope === key 
          ? 'text-white' 
          : 'text-muted hover:text-gray-300 bg-black/20'
      }`}
      style={genreScope === key ? {
        background: `${color}30`,
        border: `1px solid ${color}60`,
        boxShadow: `0 0 8px ${color}40`,
      } : {
        border: '1px solid transparent',
      }}
    >
      {label}
    </motion.button>
  ))}
</div>
```

### Track Panel Collapse-Verhalten

- Default: Alle Tracks **aufgeklappt** (nicht collapsed)
- Scroll-Verhalten: `max-h-[400px] overflow-y-auto` pro Track-Content
- Glatte Animation: `AnimatePresence` mit `height: auto` Transition
- Auf Mobile: Nur ein Track gleichzeitig aufgeklappt? → Nein, alle können offen sein, User scrollt

### Visual Feedback bei Parameter-Änderung

- Slider: Farbiger Balken + Spring-Animation (wie GenreWeights)
- Knobs: Glow-Effekt beim Drehen (bestehend)
- Scope-Wechsel: Slider-Positionen animieren zu neuen Werten (layout animation)
- Alle Änderungen: 50ms Debounce → Pattern-Update (bestehend)

---

## ⚠️ Risiken & Komplexität

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Engine refactor bricht bestehende Patterns | Hoch | Schrittweise: erst `mixTrack()`, dann per-Track Pipeline. Alte `mixAll()` als Fallback behalten |
| Seed-Determinismus bricht | Mittel | `hashParams` um neue Parameter erweitern, alte Seeds bleiben bei gleichen Werten gleich |
| Performance: zu viele Re-Renders | Mittel | `React.memo` auf neue Komponenten, `useStore` Selektoren granular halten |
| MIDI Clock Sync mit neuen Parametern | Niedrig | Scheduler unverändert, nur Pattern-Engine ändert sich |
| Presets abwärtsinkompatibel | Niedrig | PresetStore mit Version-Flag, alte Presets automatisch migrieren |
| Mobile: Panel zu groß | Mittel | Collapsible Sections innerhalb der Track-Panels, "Show Advanced" Toggle |

---

## 📊 Geschätzter Aufwand

| Phase | Aufgabe | Zeit |
|-------|---------|------|
| 1 | StepSequencer entfernen | 30 Min |
| 2 | Genre Mix Scaling + Scope | 2h |
| 3 | Mutate & Next Pattern Buttons | 1.5h |
| 4 | Track Parameter Panels | 4h |
| 5 | Integration & Testing | 1.5h |
| **Total** | | **~9.5h** |

---

## 🧬 Seed-Architektur (Gesamtübersicht)

```
patternNonce ──→ * 104729 ──┐
                             ├──→ trackSeed ──→ GenreMixer.mixTrack()
genreWeights ──┐              │                   ↓
moodParams ────┤              │              MoodProcessor.apply()
swingConfig ──┼──→ baseSeed ──┤                   ↓
bpm ──────────┘              │              SwingProcessor.apply()
                             │                   ↓
mutationCount[track] ──→ * 7919 ──┘         VelocityCurves.apply()
                                                   ↓
                                            Pattern für Track
```

- `baseSeed` = `hashParams(weights, mood, swing, bpm)` → deterministisch, reproduzierbar
- `trackSeed` = `baseSeed + (nonce * 104729) + (mutation * 7919)`
- Zwei verschiedene Primzahl-Multiplikatoren → Mutation und Next Pattern sind orthogonal
- `mutationCount === 0 && nonce === 0` → exakt gleiches Pattern wie vorher (vorhersehbar)

## 🔄 Migration Check

Nach Deployment prüfen:

- [ ] `beatgen.steppa.online` lädt ohne JS-Errors (CDP-Check)
- [ ] Schritt-LEDs in TransportBar funktionieren
- [ ] Genre-Slider gehen alle auf 100% unabhängig
- [ ] Scope-Selector schaltet Slider-Anzeige um
- [ ] Track-Panels zeigen instrument-spezifische Parameter
- [ ] Parameter-Änderungen aktualisieren Pattern in Echtzeit
- [ ] Play/Stop mit internem Clock funktioniert
- [ ] MIDI Clock Sync (External) funktioniert
- [ ] Presets speichern & laden mit neuen Feldern
- [ ] Default-Presets funktionieren
- [ ] Mobile-Ansicht (responsive) nicht broken
- [ ] Keine Console-Errors
- [ ] MIDI-Output korrekt (Noten kommen an)
- [ ] 🎲 Mutate Button ändert nur eine Spur, andere laufen weiter
- [ ] 🔄 Next Pattern Button generiert alle drei Spuren neu
- [ ] Mehrfaches Mutate klingt verwandt aber unterschiedlich
- [ ] Next Pattern ≠ Mutate (deutlich verschiedenes Ergebnis)
- [ ] Parameter-Änderung resettet mutationCount (Original-Pattern)
- [ ] BPM-Änderung resettet mutationCount NICHT
- [ ] Presets speichern/laden mutationCount und patternNonce korrekt