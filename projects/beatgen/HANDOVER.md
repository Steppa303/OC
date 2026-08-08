# BeatGen — Handover & Deployment

_Stand: 2026-08-08 22:20 CEST — Pattern Audit Fix (5 Engine-Fixes + Integration)_

---

## 🚀 Deployment

| Key | Value |
|-----|-------|
| **URL** | `https://beatgen.steppa.online` |
| **Server** | Caddy (Port 80, Cloudflare HTTPS) |
| **Pfad** | `/var/www/apps/beatgen/` |
| **Source** | `projects/beatgen/` |
| **Build** | `npm run build` → `dist/` → nach `/var/www/apps/beatgen/` kopieren |

### Deploy-Befehl
```bash
cd /root/.local/.openclaw/workspace/projects/beatgen
npm run build
rm -rf /var/www/apps/beatgen/assets /var/www/apps/beatgen/index.html /var/www/apps/beatgen/favicon.svg
cp -r dist/* /var/www/apps/beatgen/
```

### Caddy Snippet
```caddy
beatgen.steppa.online:80 {
	encode gzip
	root * /var/www/apps/beatgen
	try_files {path} /index.html
	file_server

	@assets {
		path /assets/*
	}
	header @assets Cache-Control "public, max-age=31536000, immutable"

	@html {
		path /index.html
	}
	header @html Cache-Control "public, max-age=3600, must-revalidate"
}
```

### Cloudflare DNS
- **Typ:** A Record, Proxied ✅
- **Name:** `beatgen.steppa.online`
- **Content:** `185.217.126.72`
- **SSL:** Cloudflare macht Full/Strict TLS — Caddy nur HTTP

---

## 🐛 Bug: Weiße Seite nach Deploy (2026-08-08)

### Symptom
- `https://beatgen.steppa.online` zeigt leere weiße Seite
- JS und CSS laden mit 200 OK, aber React-App rendert nicht
- `#root` DIV bleibt leer

### Ursache
`MidiScheduler.js` Constructor rief `this._tick.bind(this)` auf — aber `_tick` existierte nicht.
→ `undefined.bind()` = `TypeError: Cannot read properties of undefined (reading 'bind')`
→ React crasht komplett → weißer Bildschirm

### Fix
Zeile 65 in `src/midi/MidiScheduler.js` entfernt:
```diff
-    this._tick = this._tick.bind(this);
```

`_updateUI` binding war auch überflüssig (wird nie ungebunden aufgerufen), wurde ebenfalls entfernt.

### Debugging-Methode
1. `agent-browser open https://beatgen.steppa.online` → "no interactive elements" = App nicht gerendert
2. Chrome DevTools Protocol via WebSocket auf Browser-Page verbunden
3. `Runtime.enable` → Exception abgefangen
4. Stack Trace zeigte Zeile 56/57 im minified Bundle → `new w5(...)` mit TypeError

---

## 🔍 Testing

### Browser-Test
```bash
agent-browser open https://beatgen.steppa.online
agent-browser wait --load networkidle
agent-browser snapshot -i --json  # Sollte 90+ refs zeigen
agent-browser screenshot page.png  # Visueller Check
```

### CDP Debug
```bash
# Browser page-URL holen
curl -s http://127.0.0.1:$(agent-browser get cdp-url --json | jq -r '.data.cdpUrl' | grep -oP '\d+')/json \
  | jq '.[] | select(.url | contains("beatgen")) | .webSocketDebuggerUrl'

# Per Python websockets verbinden und Runtime.enable + auf exceptionThrown lauschen
```

### curl-Test
```bash
curl -sI https://beatgen.steppa.online
# → 200 OK, content-type: text/html
curl -sI https://beatgen.steppa.online/assets/index-*.js
# → 200 OK, content-type: text/javascript
```

---

## 📦 Build-Info

| Letzter Build | Hash | Größe (gzip) |
|---|---|---|
| 2026-08-08 21:43 | `index-CCQRDlZb.js` | 126.79 KB |
| 2026-08-08 20:52 | `index-BbJsskEG.js` | 126.57 KB |
| 2026-08-08 20:28 | `index-Df_rOwN4.js` | 126.47 KB |
| 2026-08-08 19:44 | `index-Ce6s1V5h.js` | 123.93 KB |
| 2026-08-08 19:23 | `index-dQyMzEEL.js` | 123.94 KB |
| 2026-08-08 18:58 | `index-CLkH1mnk.js` | 388 KB |
| 2026-08-08 18:20 | `index-BgmdDuJ4.js` | 121.66 KB |
| 2026-08-06 15:09 | `index-Cx8a4WeZ.js` | 121.68 KB |

JS-Bundle enthält React 19 + Framer Motion + Zustand + Pattern Engine + MIDI Engine + Clock Parser (~415 KB unkomprimiert, +25 KB durch Feature Expansion).

---

## 📁 Relevante Dateien

| Datei | Zweck |
|-------|-------|
| `PLAN.md` | Vollständiger Projektplan (6 Phasen, Architektur, Design) |
| `PLAN_FEATURE_EXPANSION.md` | Feature-Expansion Plan (✅ alle 5 Phasen umgesetzt) |
| `PLAN_MIDI_FIXES.md` | Planung: WebMIDI-Permission + External-Clock-Sync |
| `PLAN_REALTIME_FIXES.md` | Planung + Status: Echtzeit-Fixes + MIDI I/O Linking (✅ umgesetzt) |
| `README.md` | Nutzer-Doku (Features, Setup, MIDI-Guide) |
| `src/midi/MidiScheduler.js` | Dual-Mode Scheduler: internal/external clock, `loadPatternLive()`, Bar-End-Regeneration |
| `src/midi/MidiEngine.js` | MIDI I/O: Output + Input Ports, `matchInputForOutput()`, Clock-Message-Routing |
| `src/midi/MidiClockParser.js` | MIDI System-Realtime-Parser (0xF8/FA/FB/FC) + BPM-Ermittlung |
| `src/midi/MidiMapper.js` | Pattern → MIDI-Events Konvertierung |
| `src/store/useStore.js` | Zustand Store (Transport, Genres, Mood, Swing, MIDI, Clock, Track-Params, Mutations, Nonce) |
| `src/engine/PatternEngine.js` | Core-Pipeline: Per-Track Generation, trackParams Override, chordMode, octave/range, drumWeights, nonce/mutation Seeds |
| `src/engine/GenreMixer.js` | Weighted Random Mixing, `mixTrack()` pro Spur, `mixAll()` Convenience |
| `src/App.jsx` | MIDI-Init, Clock-Parser, Scheduler-Bridge, Live-Update (50ms Debounce), handleMutateTrack/handleNextPattern |
| `src/components/GenreWeights.jsx` | Scope-Selector (🌍🥁🎸🎹), unabhängige 0–100% Slider, "relative mix" |
| `src/components/MoodKnobs.jsx` | "Global Mood (Master)" — 6 Knobs (Darkness, Energy, Complexity, Density, Groove, Weirdness) |
| `src/components/TrackPanel.jsx` | Track-Header (Mute/Solo/🎲Mutate/🔄Next/Channel/Collapse) + Per-Track Parameter Panels |
| `src/components/TrackParamKnobs.jsx` | 🆕 3-Knob-Row: Density, Complexity, Groove (Auto/Inherit Mode via Knob.jsx) |
| `src/components/TrackParamSliders.jsx` | 🆕 Slider: Darkness, Weirdness, Octave (−2..+2) mit Auto/Inherit Mode |
| `src/components/DrumMixPanel.jsx` | 🆕 Kick/Snare/Hihat/Clap/Perc Weight (0–200%) |
| `src/components/NoteRangePanel.jsx` | 🆕 Range Low/High, Gate Time, Chord Mode (Off/2-Note/3-Note) |
| `src/components/SettingsPanel.jsx` | Device-Select, Clock-Source-Toggle, MIDI I/O Linking Button |
| `src/components/TransportBar.jsx` | Transport-Controls, EXT-Badge, Play-Button disabled bei externem Transport |
| `src/components/Header.jsx` | Header mit MIDI-Status, EXT-Badge, Play-Button |
| `src/components/PresetManager.jsx` | Presets (Save/Load/Delete/Import/Export), inkl. patternNonce + mutationCount |
| `vite.config.js` | Base: `/`, kein Subfolder |
| ~~`src/components/StepSequencer.jsx`~~ | 🗑️ Gelöscht (Phase 1) — durch TransportBar-LEDs + Track-Panels ersetzt |

---

## 🆕 Feature Expansion (2026-08-08, Phasen 1–5)

### Phase 1: StepSequencer entfernt ✅
- `StepSequencer.jsx` gelöscht — 16-Step-LED-Leiste in `TransportBar` bleibt

### Phase 2: Genre Mix Scaling + Scope Selector ✅
- Genre-Slider: **Keine Normalisierung mehr im Store** — jeder Slider unabhängig 0–100%
- Normalisierung passiert nur im `GenreMixer.normalizeWeights()` (Engine-Layer)
- **Scope-Selector** (🌍 Global / 🥁 Drums / 🎸 Bass / 🎹 Synth) — pro Track verschiedene Genre-Mixes
- `mixTrack()` in `GenreMixer.js` extrahiert, `PatternEngine.generate()` ruft pro Track separat auf

### Phase 3: 🎲 Mutate & 🔄 Next Pattern Buttons ✅
- **🎲 Mutate**: Button pro Track — mutiert NUR diese Spur, andere laufen weiter
  - Seed: `baseSeed + (mutationCount × 7919)` pro Track
  - Kein Loop-Reset, läuft live weiter mit `loadPatternLive()`
- **🔄 Next Pattern**: Button pro Track (alle lösen gleiche globale Aktion aus)
  - Seed: `baseSeed + (patternNonce × 104729)` — komplett neues Pattern für alle Spuren
  - Unterschiedliche Primzahlen → Mutation und Next Pattern sind orthogonal
- **Reset-Regeln**: Parameter-Änderung (Genre/Mood/Swing) → mutationCount = 0. BPM/Mute/Solo → unverändert

### Phase 4: Per-Track Parameter Panels ✅
- **TrackParamKnobs** — Density/Complexity/Groove (3 Knobs, wiederverwendet `Knob.jsx`)
- **TrackParamSliders** — Darkness/Weirdness/Octave (Slider, Bass & Synth)
- **DrumMixPanel** — Kick/Snare/Hihat/Clap/Perc Weight (5 Slider, nur Drums)
- **NoteRangePanel** — Range Low/High (MIDI Note-Namen), Note Length (%), Chord Mode (Off/2-Note/3-Note, nur Synth)
- `trackParams` im Store + Engine-Override: Track-Parameter überschreiben globale Mood-Werte pro Spur
- Engine: Octave-Shift, Range-Clamping, Note-Length → Velocity, Chord-Mode → Polyphonie, Drum-Weights → Wahrscheinlichkeits-Multiplikator
- Global Mood umbenannt zu "Global Mood (Master)"

### Phase 5: Integration & Testing ✅
- Build: 0 Errors, `index-Df_rOwN4.js` (126.47 KB gzip)
- CDP-Test: 131+ Refs, vollständiges Rendering
- Deploy nach `/var/www/apps/beatgen/`

### Pattern Audit Fix (2026-08-08 ~21:43, Commit `e9e39e00c`) ✅
**5 Engine-Fixes zur Korrektur der Generierungslogik, 13 Dateien, 0 Build-Errors.**

#### Fix 1: Per-Track "Inherit from Global" (null-Defaults)
- `useStore.js`: `density`, `complexity`, `groove`, `darkness`, `weirdness` → `null` initialisiert
- `resetTrackParam()` Action — setzt Parameter auf `null` zurück
- `PatternEngine.generate()`: `!= null` Checks (statt `!== undefined`) → null = Global-Wert übernehmen
- `loadPreset()`: Legacy-Migration — alte 50er-Werte → `null` für Mood-Parameter
- UI: `Knob.jsx` Auto-Modus (`inherited`, `inheritedValue`, `onReset` Props)
  - Auto-Knobs: dimmed (opacity-40), zeigen Global-Wert, Label "auto"
  - Doppelklick → Reset auf null/Auto
  - Erstes Drag → Knob "erwacht", vollfarbig, zeigt Zahlenwert
- `TrackParamKnobs.jsx` + `TrackParamSliders.jsx`: globalMood-Prop durchgereicht

#### Fix 2: Drum Weights implementieren
- `GenreMixer.js`: `mixDrumPattern(nw, instrument, seed, drumWeights)` — Weight als Wahrscheinlichkeits-Multiplikator
  - Weight < 1.0 → zufällig Hits entfernen
  - Weight > 1.0 → Ghost-Hits hinzufügen (30% Chance pro Prozentpunkt über 100)
- `mixTrack()`: `drumWeights` Parameter durchgereicht
- `PatternEngine.generate()`: drumWeights aus `trackParams` extrahiert
- `_applyDrumWeights()` Stub entfernt
- `DrumMixPanel.jsx`: Range auf 0–200% erweitert

#### Fix 3: Chord Mode fertiggestellt
- Step-Format: `chordNotes` Array `[{ note, velocity }]` pro Step
- `buildMelodicSteps()`: `chordNotes: []` initialisiert
- `_applyMelodicParams()`: Chord-Logik korrigiert — chordNotes als Array an Step, nicht als separate Steps
  - 2-Note: perfect 5th (+7 Halbtöne)
  - 3-Note: major 3rd + perfect 5th (+4, +7)
  - Velocity der Chord-Notes: 70% der Root-Velocity
- `MidiMapper.mapPattern()`: Chord-Notes als zusätzliche NoteOn/NoteOff Events pro Step

#### Fix 4: Velocity Curve per-track
- `VelocityCurves.js`: `applyVelocityCurveToTrack(trackPattern, velocityCurve)` — Curve auf Einzelspur
- `PatternEngine.generate()`: `effectiveMoods` Cache in Schritt 2, per-track Velocity-Curve in Schritt 4
- Jede Spur kriegt eigene Velocity-Curve mit `applyMoodToVelocityCurve()` + eigenem Seed-Offset

#### Fix 5: Note Length → echte Gate-Time
- Step-Format: `gateTime` Feld (ms, `null` = stepDuration)
- `buildDrumSteps()`: kein gateTime (Drums sind One-Shot, `null` = Mapper nutzt stepDuration)
- `buildMelodicSteps()`: `gateTime: null` initialisiert
- `_applyMelodicParams()`: noteLength → gateTime umgerechnet (0% = staccato 10%, 100% = legato 100% der Step-Dauer)
  - BPM als Parameter durchgereicht für korrekte ms-Berechnung
- `MidiMapper.mapPattern()`: Note-Off nach `gateTime` statt festem `sustainSteps`
  - `noteOff.timing = gateTime ?? stepDuration`
- `NoteRangePanel.jsx`: Label "Note Length" → "Gate Time"

#### Preset-Kompatibilität
- Alte Presets (50er-Werte für Mood-Params) → Migration im `loadPreset()`
- `MIGRATE_MOOD_PARAMS`: `density`, `complexity`, `groove`, `darkness`, `weirdness`
- Nur exakte 50 → `null` (andere Werte = User hat explizit gesetzt)

---

## ⚠️ Known Issues

1. **Kein MIDI-Device** → "No Device" Badge erscheint, aber App funktioniert (Pattern wird generiert, nur kein Output)
2. **Mobile:** Web MIDI nur in Chrome/Samsung Internet mit USB-OTG MIDI-Interface
3. **Firefox:** Web MIDI nicht unterstützt → Fallback "No MIDI" Badge
4. **MIDI-Init ohne User-Gesture** — Manche Browser blocken `requestMIDIAccess()` ohne Klick. Dann erscheint "CONNECT MIDI" Button im Header (amber), der mit User-Gesture den Permission-Dialog triggert.
5. **Chord Mode** — Sendet zusätzliche MIDI-Noten auf dem gleichen Channel via `chordNotes` Array pro Step. Velocity wird auf 70% der Root- Note skaliert. Bei monophonen Synths werden die Chord-Notes ignoriert (nur erste Note hörbar).
6. **Drum-Weights > 100%** — ✅ Gefixt (Pattern Audit). Range 0–200%, >100% fügt Ghost-Hits hinzu (30% Chance pro zusätzlichem Prozentpunkt über 100).

---

## 🕐 MIDI Clock Sync (🆕 2026-08-08)

### Clock Source
- **Internal** (default): BPM über internen Timer (`performance.now()` + `setTimeout` Lookahead)
- **MIDI (External):** BPM + Transport vom Master-Gerät via MIDI Clock

### MidiClockParser (`src/midi/MidiClockParser.js`)
- Parst System-Realtime-Messages: 0xF8 (Clock), 0xFA (Start), 0xFB (Continue), 0xFC (Stop)
- BPM-Berechnung: Gleitender Durchschnitt der letzten 24 Clock-Intervalle (24 PPQN)
- Hysterese: 1 BPM (kein Flackern bei minimalen Abweichungen)
- Alle 6 Clock-Pulse → 1 Sechzehntel-Step → `onClock()` Callback

### Dual-Mode im MidiScheduler
- **Internal Mode:** Schduler per setTimeout + Lookahead (100ms), wie vorher
- **External Mode:** `_onExternalStep()` feuert MIDI-Events SOFORT bei Clock-Puls — kein eigener Timer
  - Timing kommt komplett vom Master
  - Transport (Start/Stop) wird vom Master gesteuert
  - Play/Stop-Button im UI ist disabled, zeigt "Waiting for Clock..."
  - BPM-Anzeige ist read-only, zeigt `externalBpm`

### UI
- **Settings → Clock Source Toggle:** Pill-Buttons "Internal" / "MIDI (External)"
- **Settings → MIDI Input Select:** Dropdown immer sichtbar (Clock + Transport, auch bei Internal Mode)
- **Settings → MIDI I/O Link:** "🔗 Use [device] for input" Button matched Output-Device automatisch als Input
- **TransportBar:** "EXT" Badge + read-only BPM bei externem Mode; Play-Button disabled bei externem Transport
- **Header:** "INT" / "EXT" Mini-Badge + MIDI-Status; Play-Button disabled bei externem Transport

### Verwendung
1. Settings öffnen → Clock Source = "MIDI (External)"
2. MIDI Input = Master-Gerät auswählen (z.B. TR-8S)
3. Master-Gerät starten (Play drücken)
4. BeatGen synchronisiert sich, BPM wird vom Master übernommen
5. Master stoppt → BeatGen stoppt mit

### WebMIDI Permission (Fix 2026-08-08)
- `App.jsx` ruft `midiEngine.init()` jetzt beim Seiten-Load auf
- Browser fragt beim ersten Besuch nach MIDI-Zugriff
- Falls blockiert: "CONNECT MIDI" Button im Header (User-Gesture-Retry)

---

## 🩹 Fixes (2026-08-08)

### Fix 1: MIDI I/O Device Linking ✅
- `MidiEngine.js`: `matchInputForOutput(deviceId)` — matched per Name (case-insensitive, exact first, then substring)
- `SettingsPanel.jsx`: Input-Select immer sichtbar. "🔗 Use [device] for input" Button wenn Output ausgewählt + Match existiert

### Fix 2: Echtzeit-Pattern-Updates ✅
- `MidiScheduler.js`: `loadPatternLive(pattern, tracks)` — mapped und setzt `this.pattern` sofort, nur wenn `isPlaying`
- `App.jsx`: `useEffect` auf Genre/Mood/Swing/Tracks mit 50ms Debounce, ruft `loadPatternLive()` in beiden Clock-Modi
- `markDirty`/`onPatternRequest` bleibt als Fallback

### 🐛 Bugfix: patternEngine.generate() Crash nach Phase 4 (20:52) ✅
- **Problem:** Phase 4 Refactor rief `applyMood()` pro Track mit single-track-Objekt auf (`{ drums: {...} }`)
- **Root Cause:** `applyDensity()`/`applyComplexity()`/etc. greifen auf ALLE drei Tracks zu → `undefined.notes.map()` → TypeError
- **Symptom Internal Clock:** try-catch in `generatePattern()` fing Error → Fallback-Pattern (simple Kick). MIDI kam, aber Parameter ignoriert
- **Symptom External Clock:** Kein try-catch in `onStart`/`onContinue` → uncaught Error → `scheduler.start()` nie erreicht → keine Noten
- **Fix 1:** `PatternEngine.generate()` — `applyMood()` bekommt vollständiges 3-Track-Objekt mit leeren Arrays (16×0) für nicht-aktuelle Tracks
- **Fix 2:** `App.jsx` — `onStart`/`onContinue` Handler mit try-catch + Fallback-Pattern abgesichert
- **Build:** `index-BbJsskEG.js` (0 Errors)

### Fix 3: Externer MIDI Transport ✅
- `useStore.js`: `externalTransportActive` State + Action
- `App.jsx`: Alle `clockSource === 'midi'` Guards aus Transport-Callbacks entfernt. Start/Stop/Continue immer verarbeitet
- `TransportBar.jsx` + `Header.jsx`: Play-Button disabled, EXT Badge bei `externalTransportActive`

### 🐛 Bugfix: Externer Clock + Echtzeit-Pattern (19:44) ✅
- **Problem:** Live-Update-Effect hatte `clockSource === 'midi'` Guards → im External-Mode kein Echtzeit-Update
- **Fix:** Beide Guards aus `App.jsx` entfernt. `loadPatternLive()` funktioniert für beide Modi — überschreibt `this.pattern` direkt, `_onExternalStep()` und `_scheduleSteps()` lesen aus demselben Array
- **Build:** `index-Ce6s1V5h.js` (0 Errors)

---

## 🏗️ Architektur-Übersicht (aktuell)

```
User (Browser) → BeatGen UI
                    ├─ GenreWeights (Scope: Global / per-Track, unabhängige 0–100%)
                    ├─ MoodKnobs (Global Master)
                    ├─ SwingControl (Global / per-Track)
                    ├─ TrackPanel (3 Tracks: Drums/Bass/Synth)
                    │   ├─ TrackParamKnobs (Density, Complexity, Groove)
                    │   ├─ TrackParamSliders (Darkness, Weirdness, Octave) — Bass/Synth
                    │   ├─ DrumMixPanel (Kick/Snare/Hihat/Clap/Perc Weight) — Drums only
                    │   ├─ NoteRangePanel (Range Low/High, Note Length, Chord Mode) — Bass/Synth
                    │   └─ 🎲 Mutate / 🔄 Next Buttons
                    ├─ Pattern Engine (Per-Track Mix → Mood Override → Swing → Velocity)
                    │   └─ Seed: baseSeed + (nonce×104729) + (mutation×7919)
                    ├─ MidiScheduler (Dual-Mode: Internal Timer / External Clock)
                    ├─ MidiEngine (Web MIDI API: Output + Input Ports)
                    └─ MidiClockParser (System-Realtime: Clock BPM + Transport)
                          ↓
                    MIDI Hardware (z.B. TR-8S)
```

**Datenfluss bei Parameter-Änderung (Echtzeit):**
```
Slider/Knob → Zustand Store → useEffect (50ms Debounce)
  → PatternEngine.generate(genres, mood, swing, bpm, trackGenres, mutationCount, patternNonce, trackParams)
  → Scheduler.loadPatternLive()
  → this.pattern überschrieben → nächster Step pickt neues Pattern
```

**Datenfluss bei externem Transport (immer aktiv):**
```
MIDI Start/Stop/Continue → MidiClockParser → App.jsx Callback
  → Scheduler.start()/stop() + Store.play()/stop()
  → UI: Play-Button disabled, EXT Badge aktiv
```

**Seed-Architektur:**
```
genreWeights ──┐
moodParams ────┤
swingConfig ──┼──→ baseSeed = hashParams(...) ──┐
bpm ──────────┘                                  │
                                                  ├──→ trackSeed ──→ Per-Track Generation
patternNonce ──→ × 104729 ───────────────────────┤
mutation[track] → × 7919 ────────────────────────┘
```
- `baseSeed` = `hashParams(weights, mood, swing, bpm)` → deterministisch, reproduzierbar
- `trackSeed` = `baseSeed + (nonce × 104729) + (mutation × 7919)`
- Zwei verschiedene Primzahl-Multiplikatoren → Mutation und Next Pattern sind orthogonal
- `mutationCount === 0 && nonce === 0` → exakt gleiches Pattern wie vorher

### Per-Track Parameter Override-Logik (🆕 Pattern Audit Fix)
```
Global Mood (Master) → Basis für alle Spuren
  ↓ override nur wenn Track-Parameter ≠ null (null = "Auto" = inherit)

Track density/complexity/groove → ersetzt globalen Wert (null = inherit from Global)
Track darkness/weirdness → ersetzt globalen Wert (null = inherit, nur Bass/Synth)
Track octave → verschiebt alle Noten um ±12/24 Halbtöne (default: 0, kein Auto-Mode)
Track rangeLow/rangeHigh → oktaviert Noten außerhalb des Bereichs
Track noteLength → steuert Gate-Time (Staccato 0% ↔ Legato 100%), nicht mehr Velocity
Track chordMode (Synth only) → 'off' | '2note' | '3note', chordNotes Array pro Step
Track drumWeights → Multiplikator auf Mix-Wahrscheinlichkeit (100%=normal, 0-200%)

UI: Auto-Knobs sind dimmed (opacity-40), zeigen Global-Wert, Label "auto"
     Doppelklick auf Knob → Reset auf null/Auto
     Erstes Drag/Click → Knob wird aktiv, zeigt expliziten Wert
```

### Reset-Regeln
| Aktion | mutationCount | patternNonce | Per-Track-Parameter |
|--------|--------------|-------------|---------------------|
| 🎲 Mutate Track | `track++` | unverändert | unverändert |
| 🔄 Next Pattern | unverändert | `++` | unverändert |
| Genre/Mood/Swing ändern | Reset auf `{0,0,0}` | unverändert | unverändert (Auto folgt neuem Global-Wert) |
| BPM ändern | unverändert | unverändert | unverändert |
| Per-Track-Regler anfassen | unverändert | unverändert | Wird explizit gesetzt (nicht mehr null) |
| Per-Track-Regler doppelklicken | unverändert | unverändert | Reset auf null (Auto) |
| Preset laden | Aus Preset übernehmen | Aus Preset übernehmen | Aus Preset (null möglich → Auto) |
| Mute/Solo/Volume ändern | unverändert | unverändert | unverändert |