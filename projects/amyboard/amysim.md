# amysim – Web-App für AMYboard Patch-Simulation

> Feature- & Umsetzungsplan
> Stand: 2026-07-10 | Mobile-First optimiert

---

## 1. Vision

Eine standalone Web-App, die **AMY via WASM im Browser** laufen lässt und eine visuelle Patch-Entwicklungsumgebung bietet – quasi das AMYboard Online Editor-Pendant, aber als eigenes, erweiterbares Projekt im Rahmen unseres Modular-Setups.

**Warum nicht einfach den offiziellen Editor nehmen?**  
Weil der auf die Hardware + AMYboard World ausgerichtet ist und wir spezifische Features brauchen:
- Integration mit unseren eigenen Patches/Sketches
- CV-Simulation (virtuelle CV-Eingänge für ext0/ext1)
- Modular-Kontext (Eurorack-orientierte UI)
- Skalierbare Architektur für spätere Features (Multi-Synth-Layouts, automatisierte Patches)

---

## 2. Technische Basis

### AMY im Browser

AMY wird als **WASM + JS Bundle** geladen. Die offizielle Library stellt bereit:

- `docs/amy.js` – JS API (`amy_send()`, `AMY.*` Konstanten)
- `docs/amy.wasm` – kompilierter Synthesizer
- `docs/enable-threads.js` – Threading-Support für AudioWorklet

**Minimales HTML-Beispiel** (aus shorepine/amy/docs/minimal.html):

```html
<script src="enable-threads.js"></script>
<script src="amy.js"></script>
<script>
// AMY muss per User-Gesture gestartet werden (AudioContext)
document.body.addEventListener('click', amy_js_start, { once: true });
// Danach:
amy_send({osc: 0, wave: AMY.SINE, freq: 440, vel: 1});
</script>
```

**Alternative:** CDN-Einbindung von `https://shorepine.github.io/amy/amy.js` (Live-Version vom Repo).

### Stack-Vorschlag

| Layer | Technologie | Begründung |
|-------|-------------|-----------|
| Framework | **React + Vite** | Bewährt, schnell, einfaches Deployment via Caddy |
| AMY-Integration | **amy.js** (nativ) | AMY läuft im AudioWorklet, direkte `amy_send()`-Calls |
| Zustand | **Zustand** (oder React Context) | Patch-Status, UI-State, Preset-Management |
| UI-Komponenten | **TailwindCSS** | Wie immer bei uns – konsistent zu anderen Projekten |
| Mobile Gestures | **React Three / Hammer.js** (optional) | Für Swipe-Bedienung falls nötig |
| Touch-Slider | **radix-ui Slider** | Nativ Touch-friendly, accessible |
| MIDI | **WebMIDI API** | MIDI-Controller direkt an AMY routen |
| Audio-Visualisierung | **Canvas API** | Echtzeit-Wellenform + Spektrum |
| Routing (optional) | **React Router** | Falls mehrere Seiten (Editor, Preset-Browser, About) |

---

## 3. Feature-Übersicht

### Phase 1 — Core (MVP) — Mobile-First

- [ ] **AMY WASM-Initialisierung** – Laden von `amy.js` + `amy.wasm`, AudioWorklet-Start per User-Gesture
- [ ] **Synth-Parameter Editor (Mobile-first)** – Visuelle Steuerung aller AMY-Parameter:
  - Bottom-Sheet Navigation (Parameter-Kategorien als Swipe-tabs)
  - **Full-Width Slider** – Touch-optimiert (min 44px Höhe), Slider füllen komplette Breite
  - Oszillator (Waveform-Select als Button-Row, Freq/Amp/Duty als Range-Slider)
  - Filter (Typ-Select, Cutoff/Resonance-Slider)
  - Hüllkurven (EG0/EG1 als ADSR – 4 Slider übereinander)
  - Effekte (Reverb, Chorus, Echo, EQ – als kompakte Shortcuts)
  - LFO (Waveform, Frequenz, Routing)
  - Pan, Portamento, Volume
- [ ] **Virtuelles Keyboard** – 1 Oktave Swipe-scrollbar, Portrait-kompatibel, große Tasten (>48px), Velocity via Touch-Position
- [ ] **Echtzeit-Audio-Ausgabe** – AMY rendered direkt in den Browser-Audio-Kontext
- [ ] **Patch-Presets (Lokal)** – JSON-Serialisierung, Speichern/Laden via `localStorage`
- [ ] **"Play Note"-Button** – Prominenter FAB (Floating Action Button)

### Phase 2 — Advanced Editor (Mobile-first)

- [ ] **Multi-Oszillator-Routing** – Bis zu 4 Oszillatoren, Swipe zwischen Osc-Tabs, Modulation Matrix als Bottom-Sheet
- [ ] **CtrlCoefs-Editor** – Vereinfachte Touch-UI für CtrlCoefs (Matrix aufklappbar pro Parameter), Slider für const/vel/eg0/eg1/mod
- [ ] **CV-Simulation** – 2 Touch-Slider für ext0/ext1, als eigener Tab mit großen Zahlen-Displays
- [ ] **Patch-Sequenzer** – Horizontales Scroll-Grid (16 Steps), große Touch-Tiles (>48px)
- [ ] **Preset-Bibliothek** – Swipeable Card-Liste, große Cover/Touch-Targets
- [ ] **AMY Wire Message Monitor** – Scrollbarer Log als Bottom-Sheet, kompakt darstellbar

### Phase 3 — Integration & Export (Mobile-first)

- [ ] **Sketch-Code-Export** – Generiert MicroPython-Code, Share-Sheet-fähig (Copy/Share API), Mobile-gerechter Code-View mit Monospace-Overlay
- [ ] **Sketch-Code-Import** – Datei-Picker via `input[type=file]`, Parser für `amy.send()`-Calls → UI-Parameter
- [ ] **Remote-AMYboard Sync** – Patch via WebMIDI/BLE Serial senden (Chrome/Edge Android)
- [ ] **Preset-Sammlung** – Eigene Patches als JSON exportieren, Native Share API
- [ ] **MIDI-Controller-Learn** – MIDI-CC lernen, vereinfachte UI für Mobile (lange drücken → learn)

### Phase 4 — Polish & Advanced

- [ ] **Visualisierungen** – Echtzeit-Wellenform-Oszilloskop + Spektrogramm (Canvas API)
- [ ] **Virtuelle AMYboard-Frontplatte** – Visuelle Darstellung der Hardware (CV Ins/Outs, Encoder, Display) als UI
- [ ] **Multi-Synth-Setups** – Mehrere Synths parallel (Juno + FM + Drums)
- [ ] **MIDI-File-Player** – MIDI-Datei importieren und von AMY abspielen lassen
- [ ] **NodeGraph** – Visuelles Routing (wie VCV Rack light) – Oszillatoren, Filter, LFOs per Drag&Drop verbinden

---

## 4. UI-Komponenten-Architektur (Mobile-First)

Das Layout ist **Mobile-first** aufgebaut:
- **<640px (Phone):** Single-Column, Bottom-Navigation-Tabs, Full-Width Slider, Keyboard = 1 Oktave
- **640-1024px (Tablet):** Split-View (Osc/Filters links, Env/Effects rechts), Keyboard = 2 Oktaven
- **>1024px (Desktop):** Multi-Column, Sidebar, Keyboard = 3+ Oktaven optional

```
amysim/
├── index.html
├── src/
│   ├── main.tsx                    # App Entry, AMY initialisieren
│   ├── App.tsx                     # Root-Komponente
│   │
│   ├── amy/                        # AMY-Integration
│   │   ├── AMYProvider.tsx          # Context + AudioWorklet-Management
│   │   ├── useAMY.ts               # Hook: amy_send() wrapper
│   │   ├── amyConstants.ts          # TypeScript-Constants aus AMY
│   │   ├── wireMessage.ts          # Wire Message Builder/Decoder
│   │   └── presets/                # Preset-Manager
│   │       ├── presetStore.ts       # Zustand-Store
│   │       ├── defaultPatches.ts    # Standard-Patches
│   │       └── exportSketch.ts      # Generiert MicroPython Code
│   │
├── components/                 # UI-Komponenten
│   ├── layout/                 # Layout-Komponenten (Mobile-first)
│   │   ├── BottomNav.tsx        # Mobile Bottom-Tab-Navigation
│   │   ├── Drawer.tsx           # Bottom-Sheet / Drawer für Parameter-Edit
│   │   ├── Toolbar.tsx          # Top-Toolbar (Preset, Share, Settings)
│   │   ├── StatusBar.tsx        # Verbindungsstatus, CPU-Last
│   │   └── AppShell.tsx         # Responsive Shell (Mobile→Desktop Switch)
│   │
│   ├── synth/                  # Synth-Editor (mobile-optimiert)
│   │   ├── SynthPanel.tsx       # Hauptpanel – Bottom-Sheet mit Tabs
│   │   ├── OscillatorSection.tsx # Wellenform, Freq, Amp, Duty – Full-Width Slider
│   │   ├── FilterSection.tsx    # Filter-Typ, Cutoff, Resonance
│   │   ├── EnvelopeSection.tsx  # EG0/EG1 – 4 vertikale ADSR-Slider
│   │   ├── LFOSection.tsx       # LFO – kompakt, Drawer für Details
│   │   ├── EffectsSection.tsx   # Reverb/Chorus/Echo/EQ – als Shortcut-Chips
│   │   ├── CtrlCoefEditor.tsx   # CtrlCoefs – Matrix als Bottom-Sheet
│   │   ├── ModulationMatrix.tsx # Drag-Connections (Touch-optimiert)
│   │   └── PatchSelector.tsx    # Horizontal-Swipe Card-Liste
│   │
│   ├── keyboard/               # MIDI-Keyboard (mobile-optimiert)
│   │   ├── MiniKeyboard.tsx     # 1 Oktave, Swipe-scrollbar, >48px Tasten
│   │   └── MidiDeviceSelect.tsx # WebMIDI Device-Picker
│   │
│   ├── sequencer/              # Step-Sequencer
│   │   └── StepSequencer.tsx    # Horizontal-Scroll Grid, große Touch-Tiles
│   │
│   ├── cv/                     # CV-Simulation
│   │   └── CVPanel.tsx          # 2 große Touch-Slider mit Live-Werten
│   │
│   ├── visualizer/             # Audio-Visualisierung
│   │   ├── WaveformDisplay.tsx  # Canvas – auf Mobile kleiner, optional Maximize
│   │   └── SpectrumDisplay.tsx  # FFT – als Bottom-Sheet
│   │
│   └── monitor/                # Debugging
│       ├── WireMessageLog.tsx   # Kompakter Log, Bottom-Sheet
│       └── AMYStateDisplay.tsx  # Mini-State-View
│   │
│   ├── hooks/                      # Custom Hooks
│   │   ├── useWebMIDI.ts           # WebMIDI-Connection
│   │   └── useAudioVisualizer.ts   # AnalyserNode → Canvas
│   │
│   └── lib/                        # Hilfsfunktionen
│       ├── serializePatch.ts        # Patch → JSON
│       ├── deserializePatch.ts      # JSON → Patch
│       └── types.ts                 # TypeScript-Typen
│
├── public/                         # Statische Assets
│   └── amy/                        # AMY WASM Files
│       ├── amy.js
│       ├── amy.wasm
│       └── enable-threads.js
│
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 5. Datenmodell (TypeScript)

```typescript
// === Core Patch State ===

interface OscillatorState {
  wave: number;           // AMY.SINE | PULSE | SAW_DOWN | etc.
  freq: CtrlCoefs;        // CtrlCoefs für frequency
  amp: CtrlCoefs;         // CtrlCoefs für amplitude
  duty: CtrlCoefs;        // CtrlCoefs für duty cycle (nur PULSE)
  pan: CtrlCoefs;         // CtrlCoefs für pan
  phase: number;          // 0-1
  filterType: number;     // AMY.FILTER_NONE | LPF | BPF | HPF | LPF24
  filterFreq: CtrlCoefs;  // CtrlCoefs für filter cutoff
  resonance: number;      // 0.5-16.0
  modSource: number | null; // Oscillator als LFO-Quelle
  eg0: EnvelopeState;
  eg1: EnvelopeState;
}

interface EnvelopeState {
  breakpoints: [number, number][]; // [time_ms, value] Paare
  type: number;                     // EG_NORMAL | LINEAR | DX7 | EXPONENTIAL
}

interface LFOState {
  wave: number;
  freq: number;           // Hz
  amplitude: number;
  target: 'freq' | 'amp' | 'filter_freq' | 'duty' | 'pan';
  targetOsc: number;      // Welcher Oszillator moduliert wird
}

interface SynthState {
  id: number;             // synth-Nummer
  patchNumber: number;    // 0-127 Juno, 128-255 DX7, 1024+ User
  numVoices: number;
  oscsPerVoice: number;
  oscillators: OscillatorState[];
  lfos: LFOState[];
  portamento: number;
  synthDelay: number;
  synthFlags: number;
  volume: number;
}

// === CtrlCoefs ===

interface CtrlCoefs {
  const?: number;   // Konstanter Offset
  note?: number;    // MIDI-Note Tracking
  vel?: number;     // Velocity
  eg0?: number;     // Envelope Generator 0
  eg1?: number;     // Envelope Generator 1
  mod?: number;     // Modulationsquelle (LFO)
  bend?: number;    // Pitch Bend
  ext0?: number;    // Externer CV 0
  ext1?: number;    // Externer CV 1
}

// === Preset ===

interface Preset {
  id: string;
  name: string;
  description: string;
  category: 'user' | 'juno' | 'dx7' | 'pcm';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  state: SynthState[];
  effects?: {
    reverb?: [number, number, number, number];
    chorus?: [number, number, number, number];
    echo?: [number, number, number, number];
    eq?: [number, number, number];
  };
}
```

---

## 6. AMY-Integration im Detail

### Initialisierung

```typescript
// AMYProvider.tsx
async function initAMY(): Promise<void> {
  // 1. enable-threads.js muss vor amy.js geladen sein
  // 2. per User-Gesture (click) starten
  // 3. amy_js_start() initialisiert AudioWorklet + AMY-WASM
  // 4. Danach: amy_send() ist verfügbar
}
```

### Kommandos senden

```typescript
// useAMY.ts
const send = useCallback((params: AMYParams) => {
  // amy_send() ist global nach Initialisierung
  (window as any).amy_send(params);
}, []);

// Beispiel: Sinus-Ton spielen
send({ osc: 0, wave: 0, freq: 440, vel: 1 });

// Juno-Patch laden
send({ synth: 1, patch: 6, num_voices: 6 });

// ADSR setzen
send({ osc: 0, bp0: '50,1,200,0.5,300,0' });
```

### AudioWorklet-Lifecycle

AMY erzeugt einen `AudioWorkletNode` im Browser-Audio-Kontext. Die Audio-Renderfunktion von AMY (C-Code, kompiliert zu WASM) wird in einem separaten Thread ausgeführt → keine UI-Blockierung.

**Wichtig:**
- `amy_js_start()` muss per User-Gesture aufgerufen werden (AudioContext-Policy)
- AMY kann nur einmal pro Document initialisiert werden
- `amy_reset()` / `amy.stop()` für Cleanup

### AMY-WASM Files beziehen

Die Kompilierung von AMY zu WASM erfolgt via Emscripten im Repo.  
**Option A:** Von GitHub Pages laden (CDN):

```html
<script src="https://shorepine.github.io/amy/enable-threads.js"></script>
<script src="https://shorepine.github.io/amy/amy.js"></script>
```

**Option B:** Selber builden:

```bash
git clone https://github.com/shorepine/amy
cd amy
make docs/amy.js   # Erzeugt docs/amy.js + docs/amy.wasm
```

### iOS/Mobile AudioFallback

**Problem:** Ältere iOS-Versionen (< 16.4) haben Bugs im AudioWorklet – AMY nutzt aber AudioWorklet für Echtzeit-Audio.
**Strategie:**
1. `AudioWorklet` Feature-Detect beim Start
2. Wenn nicht verfügbar → Fallback auf `ScriptProcessorNode` (deprecated, aber funktioniert auf iOS 15+)
3. `AudioContext` wird bei jeder Touch-Interaktion per `context.resume()` reaktiviert (iOS killt Audio nach Stumm/Lockscreen)
4. `onstatechange`-Handler: Bei `suspended` → Button "Tap to Unmute" einblenden

```typescript
// AudioContext Lifecycle (vereinfacht)
function initAudio() {
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  ctx.onstatechange = () => {
    if (ctx.state === 'suspended') {
      // Zeige "Tap to Unmute"-Banner
    }
  };
}
```

---

## 7. Mobile-First Design-Philosophie

**Kein Desktop-Port, den man auf Mobile quetscht – sondern ein Mobile-UI, das auf Tablet/Desktop eskaliert.**

### Core Mobile Principles

1. **Thumb-Zone (Daumen-Zone)** – Primäre Interaktionen (Play, Note, wichtigste Slider) im unteren/mittleren Drittel des Screens, wo der Daumen hinkommt
2. **Touch-Targets ≥ 44px** – Jeder Button, Slider-Griff, Toggle mindestens 44×44px (Apple HIG/Google Material)
3. **Bottom-Navigation** – Kategorien (Synth, Keyboard, Seq, CV) als Bottom-Tabs, immer erreichbar
4. **Bottom-Sheets statt Modals** – Parameter-Details klappen von unten auf, Overlay statt Page-Change
5. **Full-Width Slider** – Range-Inputs nutzen die komplette Display-Breite, kein horizontaler Padding-Verlust
6. **Swipe > Tap > Click** – Horizontale Swipe-Aktionen für Tab-Wechsel, Preset-Browser, Sequencer-Scroll
7. **Keine Hover-Only Interaktionen** – Alles muss per Touch funktionieren. Hover = nice-to-have.

### Look & Feel
- **Dunkles Theme** (Modular-Synth-Vibe) – schwarzer Hintergrund (#0a0a0a), farbige Neon-Akzente
- **Große Slider mit Zahlen-Display** – Slider wie Hardware-Potis, aber mit digitalem Wert direkt drunter
- **Kompakte Sektionen als Cards** – Jeder Parameter-Block als abgerundete Card, Swipe zum Wechseln
- **Farbcodierung** – Osc A=cyan/blue, Osc B=grün, LFO=gelb/amber, CV=orange/red, Env=purple
- **Mobile-first Breakpoints:**
  - `< 640px` — Single Column, Bottom Nav, 1-Oktave Keyboard
  - `640-1024px` — Split View (2 Columns), Bottom Sheet Details, 2-Oktaven Keyboard
  - `> 1024px` — Multi-Column Desktop-Layout, Sidebar, 3+ Oktaven

### Layout (Mobile – `< 640px`)

```
┌──────────────────────────┐
│ ① [🔊 Test Note] [Vol]   │  ← Compact Toolbar
│ ② ┌─ OSCILLATOR ──────┐ │
│    │ Wave: [SINE ▼]    │ │
│    │ Freq ═══════●══░  │ │  ← Full-Width Slider
│    │ Amp  ═══●══════░  │ │
│    │ Duty ═══●══════░  │ │
│    └──────────────────┘ │
│ ③ ┌─ FILTER ──────────┐ │
│    │ LPF ═══●══════░  │ │
│    │ Res  ════●═════░  │ │
│    └──────────────────┘ │
│ ④ ┌─ ENVELOPE ────────┐ │
│    │ A ══●══════░ 50  │ │  ← 4 Slider vertikal
│    │ D ═══●═════░ 200 │ │
│    │ S ══════●═══░ .5 │ │
│    │ R ══●══════░ 300 │ │
│    └──────────────────┘ │
│                         │
│ ⑤ ┌─ KEYBOARD (1 Oct)┐ │
│    │ C D E F G A B C │ │  ← Swipe-scrollbar
│    │ ◄──────────────► │ │
│    └──────────────────┘ │
├──────────────────────────┤
│ [Synth] [Seq] [CV] [Mon]│  ← Bottom Nav
└──────────────────────────┘
```

### Layout (Desktop – `> 1024px`)

```
┌─────────────────────────────────────────────┐
│ Toolbar: [Preset ▼] [🔊] [Volume ████░░]    │
├────────────┬────────────────┬───────────────┤
│ Patch      │ Osc A     Osc B│  Env / Filter │
│ Selector   │ ┌────┐ ┌────┐ │  ┌─────────┐  │
│ ┌──────┐   │ │Sin │ │Saw │ │  │ A ███░  │  │
│ │ Juno │   │ │440 │ │220 │ │  │ D ██░░  │  │
│ │ DX7  │   │ │.8  │ │.5  │ │  │ S █░░░  │  │
│ │ ...  │   │ └────┘ └────┘ │  │ R ████░ │  │
│ └──────┘   ├───────────────┤  └─────────┘  │
│            │ LFO / Mod     │  Effekte       │
│ Quick      │ ┌───────────┐ │  ┌──────────┐ │
│ Save       │ │ Sine 4Hz  │ │  │ Reverb   │ │
│ Export     │ │ → OscA.f  │ │  │ Chorus   │ │
│ Share      │ └───────────┘ │  │ Echo     │ │
│            │               │  └──────────┘ │
├────────────┴───────────────┴───────────────┤
│  ░░░░░░░ Keyboard (3 Oktaven) ░░░░░░░░░░░░│
│  C D E F G A B C D E F G A B C D E F G A B│
└─────────────────────────────────────────────┘
```

---

## 8. Mobile-First-Umsetzung

### Prioritäten für Mobile

| Priorität | Feature | Warum |
|-----------|---------|-------|
| 🔴 P0 | **Touch-Slider funktionieren** | Kern-Interaktion auf Mobile |
| 🔴 P0 | **Bottom-Nav + AppShell** | Navigation ist Grundgerüst |
| 🔴 P0 | **Keyboard mit Touch** | Ohne Keyboard kein Soundtest |
| 🟡 P1 | **Bottom-Sheets für Details** | Tiefe Parameter ohne Page-Change |
| 🟡 P1 | **Swipe-Tabs für Oszillatoren** | Multi-Osc auf kleinem Screen |
| 🟡 P1 | **PWA-Support** | Add-to-Homescreen, Offline-Fallback |
| 🟢 P2 | **Landscape-Optimierung** | Keyboard in Landscape besser nutzbar |
| 🟢 P2 | **Haptic Feedback** | Vibration bei Slider-Change/Tasten-Druck |
| 🔵 P3 | **Desktop Multi-Column** | Erst wenn Mobile solide ist |

### PWA-Strategie

- **Manifest** (`manifest.json`) – App-Name, Icon, Theme-Color, Display: standalone
- **Service Worker** – Cacht AMY-WASM-Files + App-Bundle für Offline-Nutzung
- **Kein Server nötig für Sound** – AMY läuft komplett im WASM/AudioWorklet, kein Backend
- **Share-Target API** – Patch-Files direkt aus anderen Apps öffnen (z.B. aus Telegram)

### Mobile-spezifische Komponenten

| Komponente | Beschreibung |
|------------|-------------|
| `AppShell.tsx` | Responsive Shell: Mobile → BottomNav + SingleColumn, Desktop → Sidebar + MultiColumn |
| `BottomNav.tsx` | 4-5 Tabs (Synth, Keyboard, Sequencer, CV, Monitor), active Tab mit Icon+Label |
| `Drawer.tsx` | Bottom-Sheet mit Drag-Handle, 60%/90% Höhe, Overlay-Blur |
| `MiniKeyboard.tsx` | 1 Oktave (12 Tasten), Touch-Events mit Velocity via Touch-Y, Swipe zum Wechseln |
| `TouchSlider.tsx` | Full-Width Range-Slider, min 44px Griff, Tap-to-Set, Snap-Feel optional |
| `SwipeTabs.tsx` | Horizontale Swipe-Tabs für Osc A↔B, Parameter-Kategorien |

### Touch-Event-Strategie

```typescript
// Touch-Velocity für Keyboard: Y-Position auf der Taste = Velocity
// Je näher am oberen Rand → höhere Velocity
function touchToVelocity(touchY: number, keyTop: number, keyHeight: number): number {
  const relY = (touchY - keyTop) / keyHeight;  // 0 (oben) - 1 (unten)
  return Math.max(0.1, 1 - relY);              // oben=1.0, unten=0.1
}

// Slider: Touch-X über gesamte Breite, kein exaktes Positionieren nötig
function touchToSliderValue(touchX: number, sliderLeft: number, sliderWidth: number): number {
  const relX = Math.max(0, Math.min(1, (touchX - sliderLeft) / sliderWidth));
  return relX;
}
```

### Schritt 1: Projekt-Setup + AMY laden
1. `npm create vite@latest amysim -- --template react-ts`
2. TailwindCSS installieren + konfigurieren
3. AMY-WASM-Files ins `public/`-Verzeichnis kopieren
4. `AMYProvider.tsx` schreiben (Initialisierung + Context)
5. Minimalen "Click to Start"-Screen + Sinus-Test

**Dauer:** ~1h  
**Test:** Ein Sinus-Ton hörbar

### Schritt 2: Toolbar + Keyboard
1. Toolbar-Komponente (Volume, Play/Stop)
2. Virtuelles MIDI-Keyboard (2 Oktaven, Maus/Touch)
3. Keyboard triggert `amy_send({note: X, vel: 1})`

**Dauer:** ~2h  
**Test:** Klicken auf Tasten erzeugt Töne

### Schritt 3: Patch-Editor (Oscillator)
1. `OscillatorSection.tsx` – Waveform-Select, Freq-Slider, Amp-Slider
2. Synth-Panel als Wrapper (Patch-Nummer, Voices)
3. State-Management (Zustand Store für SynthState)

**Dauer:** ~3h  
**Test:** Patch-Parameter verändern den Sound live

### Schritt 4: Filter + Envelopes
1. `FilterSection.tsx` – Filter-Typ-Select, Cutoff+Resonance-Slider
2. `EnvelopeSection.tsx` – 4 ADSR-Slider (Attack, Decay, Sustain, Release)
3. `bp0` / `bp1` korrekt in AMY-Wire-Messages übersetzen

**Dauer:** ~3h  
**Test:** ADRS-Änderungen hörbar, Filter schließt/öffnet

### Schritt 5: Preset-Speicher
1. `presetStore.ts` – Speichern/Laden aus `localStorage`
2. `PatchSelector.tsx` – Dropdown mit gespeicherten + Standard-Patches
3. JSON-Serialisierung des kompletten SynthState

**Dauer:** ~2h  
**Test:** Patch speichern, Browser neuladen, Patch laden → Sound identisch

### Schritt 6: LFO + CtrlCoefs
1. `LFOSection.tsx` – LFO-Waveform, Frequenz, Ziel-Parameter
2. `ModulationMatrix.tsx` – Visuelle Zuordnung LFO → Ziel
3. CtrlCoefs korrekt per Dict-Syntax setzen (`{const: 0.5, mod: 0.3}`)

**Dauer:** ~3h  
**Test:** LFO moduliert Frequenz/Filter → hörbares Vibrato/Wobble

### Schritt 7: Effekte
1. `EffectsSection.tsx` – Reverb (level, liveness, damping, crossover)
2. Chorus, Echo, EQ – jeweils Slider für Parameter

**Dauer:** ~1.5h  
**Test:** Reverb hörbar, Echo wiederholbar

### Schritt 8: CV-Simulation
1. `CVPanel.tsx` – Zwei virtuelle CV-Slider (ext0, ext1)
2. Mapping: CV-Slider-Wert → `amy_send({..., ext0: value})`
3. Envelope-Generator als CV-Quelle (Hüllkurve die ext0 triggert)

**Dauer:** ~2h  
**Test:** CV-Slider verändert Filter-Cutoff in Echtzeit

### Schritt 9: Sketch-Code Export
1. `exportSketch.ts` – Generiert lesbaren MicroPython-Code aus Patch-State
2. "Copy to Clipboard"-Button im Toolbar
3. Formatierung: `amy.send(synth=1, patch=6, num_voices=6)\n...`

**Dauer:** ~2h  
**Test:** Exportierter Code auf AMYboard ausführen → gleicher Sound

### Phase 2+ – Nach Bedarf

- **Wire Message Log** – Einfach Log-Array in Zustand, `amy_send()` intercepted
- **Step Sequencer** – Grid-Komponente mit AMY's `sequence`-Parameter
- **WebMIDI** – `navigator.requestMIDIAccess()` → MIDI-Input in AMY routen
- **Visualizer** – `AnalyserNode` + Canvas für Waveform/Spektrum
- **Multi-Oszillator** – SynthState erweitern auf 4+ Oszillatoren
- **Remote AMYboard** – WebMIDI-SysEx oder Serial-API für echten Board-Transfer

---

## 9. Risiken & Hürden

### AMY WASM-Stabilität
- `amy.js` wird aus dem Repo geliefert – Versionierung wichtig
- **Fallback:** CDN-Version nutzen, aber lokale Kopie als Fallback
- **Test:** Monotone Frequenz über 30 Min laufen lassen → kein Crash

### AudioContext-Policy
- Browser blockiert Audio ohne User-Gesture
- **Lösung:** "Click to Start"-Overlay, nach Klick initialisieren

### Web MIDI API Support
- Nur Chrome/Edge (kein Firefox/Safari)
- **Lösung:** MIDI ist optional – virtuelles Keyboard ist immer verfügbar

### AMY-Doku-Lücken
- Einige JavaScript-APIs sind nicht vollständig dokumentiert
- **Lösung:** Python-API als Source-of-Truth, JS-API ist identisch

### Mobile-spezifische Risiken

| Risiko | Lösung |
|--------|--------|
| **AudioContext auf iOS** – Stirbt nach Stumm-Schalten | `audio.resume()` auf jeder Touch-Interaktion + "Tap to Unmute"-Button |
| **WASM-Performance auf Low-End-Phones** – AMY hat 180 Oszillatoren | `max_oscs` reduzieren im Mobile-Modus (auf 32), perf-Monitor einbauen |
| **WebMIDI kein iOS/Safari** | Virtuelles Keyboard ist immer verfügbar, MIDI = optionaler Bonus |
| **Screen-Real-Estate < 6"** – Synth vs Keyboard vs Sequencer | Bottom-Tabs + Bottom-Sheets + Swipe, nie mehr als ein Content-Bereich gleichzeitig |
| **iOS AudioWorklet Bug** – Ältere iOS-Versionen | Fallback: ScriptProcessorNode (deprecated aber funktioniert) |
| **Portrait vs Landscape** – Portrait = wenig Platz für Keyboard | Landscape: Keyboard vergrößert sich, Bottom-Tabs werden zur Sidebar |
| **Offline-Nutzung** – Kein Internet = kein AMY WASM | Service Worker cacht alles beim ersten Laden (PWA) |

---

## 10. Deployment

Standard-Caddy-Setup (wie alle unsere Projekte):

```caddy
handle /amysim/* {
    uri strip_prefix /amysim
    root * /var/www/apps/amysim/dist
    try_files {uri} /index.html
    file_server
}
```

**Domain-Vorschlag:** `amysim.steppa.online` oder `amyboard.steppa.online/patch`

---

## 11. Dateien (im Projekt)

```
projects/amyboard/
├── amysim.md ← dieses Dokument
├── amysim/   ← React/Vite SPA
│   ├── src/
│   ├── public/amy/   ← WASM-Files
│   ├── package.json
│   └── vite.config.ts
│
└── (bestehende Hardware-Files bleiben)
```

---

## 12. Quick-Start (So geht's los)

```bash
cd projects/amyboard
npm create vite@latest amysim -- --template react-ts
cd amysim
npm install
npm install zustand tailwindcss @tailwindcss/vite
# AMY WASM Files kopieren
curl -o public/amy/enable-threads.js https://shorepine.github.io/amy/enable-threads.js
curl -o public/amy/amy.js https://shorepine.github.io/amy/amy.js
# amy.wasm kann groß sein, ggf. selber builden
curl -o public/amy/amy.wasm https://shorepine.github.io/amy/amy.wasm
```

---

*Ende Plan. Ready to build sobald du grünes Licht gibst.*