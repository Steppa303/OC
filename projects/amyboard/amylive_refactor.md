# 🎹 amylive Refactor — WYSIWYG Module Workspace

> Stand: 2026-07-12
> Problem: Aktuelle Module sind kleine Grid-Karten ohne visuelle Chain, kein WYSIWYG beim Patch-Laden, zu kleine Controls.

---

## 1. Kern-Probleme (aktuell)

| Problem | Auswirkung |
|---------|-----------|
| Module als **Grid-Karten** (280×200px) | Slider supermini, kaum bedienbar auf Touch |
| **Kein WYSIWYG** beim Patch-Laden | Patch lädt nur Synth-Modul, erzeugt keine Komponenten |
| **Keine visuelle Signal-Chain** | Module existieren isoliert, kein Routing sichtbar |
| **Kein dedizierter Modul-Bereich** | Alles auf einer Dashboard-Seite |
| **Module an OSC/Synth gebunden, aber nicht verknüpft** | targetOsc/targetSynth existiert in Datenstruktur, wird aber nicht visualisiert |

---

## 2. Neues UI-Konzept: Module Stack + Signal Chain

### 2.1 Layout-Architektur

```
┌──────────────────────────────────────────────────────┐
│  [Connection Bar] ● AMYboard connected  |  ⚙️        │  ← Top Bar (kompakt, immer sichtbar)
├────────────────┬─────────────────────────────────────┤
│                │                                     │
│  PATCH VIEW    │     MODULE WORKSPACE               │
│                │                                     │
│  ┌──────────┐  │  ┌─────────────────────────────┐   │
│  │ Current  │  │  │                             │   │
│  │ Synth #1 │  │  │  [OSCILLATOR 0]             │   │
│  │ Patch #03│  │  │  ┌─── Waveform: SINE ────┐ │   │
│  │ "JunoPad"│  │  │  │ Freq ████████─── 440Hz│ │   │
│  │          │  │  │  │ Amp  ██████───── 0.75 │ │   │
│  │ [Browse] │  │  │  │ Pan  ███───────  0.5  │ │   │
│  │          │  │  │  └───────────────────────┘ │   │
│  │  Patch   │  │  │                             │   │
│  │  Chain:  │  │  │  ╲   ┌───[FILTER]────────┐ │   │
│  │          │  │  │    ╲ │ LPF   Cutoff ████ │ │   │
│  │ OSC0 ──→ │  │  │      │ Res   ██─── 2.5  │ │   │
│  │ FILTER   │  │  │      └───────────────────┘ │   │
│  │    ↓     │  │  │                             │   │
│  │ EG0 ───→ │  │  │  ╲   ┌───[ENVELOPE 0]───┐ │   │
│  │ AMP      │  │  │    ╲ │ ADSR ██████████   │ │   │
│  │          │  │  │      │ SVG Curve         │ │   │
│  │ [SAVE]   │  │  │      └───────────────────┘ │   │
│  │ [LOAD]   │  │  │                             │   │
│  │          │  │  │  ╲   ┌───[LFO 1]─────────┐ │   │
│  │          │  │  │    ╲ │ Wave: TRIANGLE     │ │   │
│  │          │  │  │      │ Rate ████── 1.2Hz │ │   │
│  │ [Add     │  │  │      └───────────────────┘ │   │
│  │  Module] │  │  │                             │   │
│  └──────────┘  │  └─────────────────────────────┘   │
│                 │                                     │
│  [Desktop:]     │  Module Workspace nimmt 70% ein    │
│  [Mobile:]      │  Swipeable Card Stack (vollflächig) │
└────────────────┴─────────────────────────────────────┘
```

### 2.2 Zwei Modi: Desktop vs Mobile

#### 🖥️ Desktop (≥ 1024px)
- **Split View:** Linke Sidebar (Patch + Chain) + Rechter Workspace (aktives Modul)
- Chain zeigt visuell, wie Module verbunden sind
- Module nebeneinander oder als Stack

#### 📱 Mobile (< 1024px) — **Primäre Zielplattform!**
- **Fullscreen Card Stack** — ein Modul = eine Card, voller Bildschirm
- Swipe left/right oder Tap Dots zum Navigieren
- Jede Card hat volle Kontrollen — keine mini Slider
- Oben: Patch-Indikator + Chain Mini-Map

```
┌────────────────────┐
│ ○ ○ ● ○ ○   Synth │  ← Mini Dots (aktuelle Card) + Patch Name
├────────────────────┤
│                    │
│                    │
│   OSCILLATOR 0     │
│                    │
│  ┌──────────────┐  │
│  │ SINE ▼       │  │  ← Großer Waveform-Selector
│  └──────────────┘  │
│                    │
│  Freq ──████───    │  ← Große Touch-Slider
│       440 Hz       │
│                    │
│  Amp  ──████───    │
│       0.75         │
│                    │
│  Bus [0 1 2 3]     │
│                    │
│  [← Prev] [Next →] │  ← Swipe oder Buttons
└────────────────────┘
```

---

## 3. Patch → Module WYSIWYG Instantiation

### 3.1 Wie es aktuell ist

```typescript
// Patch laden → nur Synth-Modul bekommt neue patch-Nummer
// Keine oscillator/filter/envelope Module werden erzeugt
// User sieht: "Patch #42 geladen" aber keine Komponenten zum Editieren
```

### 3.2 Wie es sein soll

```typescript
// Patch laden → Engine parst den Patch-State
//   → Erzeugt Module für jeden aktiven OSC
//   → Erzeugt Filter-Modul wenn filter_type != NONE
//   → Erzeugt Envelope-Module (EG0/EG1)
//   → Erzeugt LFO-Modul wenn mod_source gesetzt
//   → Setzt targetOsc/targetSynth für jedes Modul
//   
// User sieht: "Das ist mein Sound" — alle Komponenten als editierbare Module
// Jedes Modul steuert LIVE den entsprechenden OSC auf dem Board
```

### 3.3 Patch-Parser (State → Modules)

```typescript
interface PatchToModulesResult {
  modules: CanvasModule[]
  chain: SignalChainLink[]
}

interface SignalChainLink {
  from: { moduleId: string; output: string }
  to: { moduleId: string; input: string }
}

// Patch-Dump (zDZ) → CanvasModule[]
function patchToModules(patch: AmyPatch): PatchToModulesResult {
  const modules: CanvasModule[] = []
  const chain: SignalChainLink[] = []
  
  for (const osc of patch.state.oscillators) {
    // OSC Module
    const oscModule = createModule('oscillator', {
      osc: osc.osc,
      wave: osc.wave,
      freq: osc.freq.const ?? 440,
      amp: osc.amp.const ?? 0.8,
      pan: osc.pan.const ?? 0.5,
      bus: osc.bus ?? 0,
      // Auch CtrlCoefs sichtbar machen!
      freqCoefs: osc.freq,    // const, note, vel, eg0, eg1, mod, bend
      ampCoefs: osc.amp,
    })
    modules.push(oscModule)
    
    // Filter Module (wenn aktiv)
    if (osc.filter_type !== 0) {
      const filterModule = createModule('filter', {
        osc: osc.osc,
        filter_type: osc.filter_type,
        cutoff: osc.filter_freq.const ?? 8000,
        resonance: osc.resonance ?? 0.7,
        // Modulation-Routing sichtbar
        modEg1: osc.filter_freq.eg1 ?? 0,
        modLfo: osc.filter_freq.mod ?? 0,
        modKey: osc.filter_freq.note ?? 0,
      })
      modules.push(filterModule)
      chain.push({ from: { moduleId: oscModule.id, output: 'audio' }, to: { moduleId: filterModule.id, input: 'input' } })
    }
    
    // EG0 Module
    if (osc.bp0) {
      const eg0Module = createModule('envelope', {
        egId: 0,
        eg_type: osc.eg0_type ?? 0,
        ...parseBreakpoints(osc.bp0),
      })
      modules.push(eg0Module)
      chain.push({ from: { moduleId: eg0Module.id, output: 'eg0' }, to: { moduleId: oscModule.id, input: 'amp' } })
    }
    
    // EG1 Module
    if (osc.bp1) {
      // ...
    }
    
    // LFO Module
    if (osc.mod_source && osc.mod_source !== osc.osc) {
      const lfoModule = createModule('lfo', {
        lfoId: osc.mod_source,
        // LFO-Parameter aus dem dump parsen...
      })
      modules.push(lfoModule)
      chain.push({ from: { moduleId: lfoModule.id, output: 'mod' }, to: { moduleId: oscModule.id, input: 'mod' } })
    }
  }
  
  return { modules, chain }
}
```

### 3.4 Synth Manager bleibt als "Hub"

Der SynthManager wird zum zentralen Hub:
- Patch auswählen → erzeugt/ersetzt alle OSC/FILTER/EG/LFO Module
- Voice-Count, MIDI-CH, Portamento bleiben hier
- Keyboard-Pads bleiben hier
- **ABER**: SynthManager bekommt eine dedizierte Card (kein Side-Stuff mehr)

---

## 4. Module Card Design (Full-Width, Swipeable)

### 4.1 Jedes Modul = eigene Card

Keine Mini-Panels mehr. Jedes Modul bekommt:

```
┌──────────────────────────────────┐
│  ← Previous     ● ● ○ ○     →   │  ← Swipe Navigation
│  OSCILLATOR 0    ••• menu        │  ← Header mit Actions
├──────────────────────────────────┤
│                                  │
│  ┌──────────────────────────┐    │
│  │ SINE │ PULSE │ SAW │ FM │    │  ← Waveform Pills (groß, touchbar)
│  └──────────────────────────┘    │
│                                  │
│  FREQUENCY                       │
│  ┌──────────────────────────────┐│
│  │ ═══●══════════════════ 440Hz ││  ← Slider, full-width
│  └──────────────────────────────┘│
│      20              8000        │  ← Min/Max labels
│                                  │
│  AMPLITUDE                       │
│  ┌──────────────────────────────┐│
│  │ ═══════════●═══════════ 0.75 ││
│  └──────────────────────────────┘│
│                                  │
│  PAN         BUS                 │
│  ┌──────────┐  ┌──────────────┐ │
│  │L ◉═══ R  │  │ 0 ▼          │ │  ← Kompakt, nebeneinander
│  └──────────┘  └──────────────┘ │
│                                  │
│  [Modulation Matrix ▸]          │  ← Expandierbar für CtrlCoefs
│                                  │
│  Chain: OSC0 → FILTER → BUS 0   │  ← Mini Signal Chain Anzeige
└──────────────────────────────────┘
```

### 4.2 Slider Design (Touch-freundlich)

```tsx
// Aktuell: <input type="range"> mit 10px Höhe
// Neu: Custom Slider mit 32-40px Track-Höhe

<TouchSlider
  label="Frequency"
  value={freq}
  min={20}
  max={8000}
  step={1}
  unit="Hz"
  size="lg"               // ← 36px track height
  showMinMax={true}       // ← Min/Max labels
  logScale={true}         // ← Log-Skala für Frequenzen!
  onChange={(v) => ...}
/>
```

### 4.3 Envelope Card (Vollbild-ADSR)

```
┌──────────────────────────────────┐
│  ← Previous     ○ ○ ● ○     →   │
│  ENVELOPE 0                      │
├──────────────────────────────────┤
│                                  │
│     ┌────────────────────┐       │
│  1.0┤╱───╲               │       │
│     │╱    ╲───╱───╲     │       │  ← Large SVG Curve
│  0.0┤╱────────────╲──── │       │     ViewBox ~400×150
│     └────────────────────┘       │     (nicht 220×80!)
│                                  │
│  RC │ LIN │ DX7 │ EXP            │  ← EG Type Pills
│                                  │
│  ATTACK                          │
│  ═══●══════════════════ 200ms   │
│  1               2000            │
│                                  │
│  DECAY                           │
│  ═══════●═══════════════ 150ms  │
│                                  │
│  SUSTAIN                         │
│  ═══════════●═══════════ 0.65   │
│                                  │
│  RELEASE                         │
│  ═════●══════════════════ 500ms │
│                                  │
└──────────────────────────────────┘
```

---

## 5. Signal Chain Visualization

### 5.1 Chain Mini-Map (auf jeder Card)

```
┌──────────────────────────────────┐
│  Signal Chain:                   │
│                                  │
│  OSC0 ─→ FILTER ─→ BUS0          │
│    ↑         ↑                    │
│  EG0       LFO1                  │
│              ↑                   │
│            EG1                   │
└──────────────────────────────────┘
```

- Visuelle Nodes mit Arrow-Connections
- Klick auf Node → zu dem Modul swipen
- Angezeigt in der Patch-Sidebar (Desktop) oder als Overlay (Mobile)

### 5.2 Add Module → Auto-Chain

Wenn der User ein neues Modul hinzufügt:

| Neues Modul | Auto-Routing |
|-------------|-------------|
| **Filter** | Kettet sich an letzten OSC in Chain (oder fragt: "An welchen OSC?") |
| **Envelope** | Routet zu EG0 des aktuell ausgewählten OSC |
| **LFO** | Setzt `mod_source` auf den aktuellen OSC, routet zu `mod` Input |
| **Oszillator** | Neuer OSC, standalone (muss manuell in Chain eingebunden werden) |
| **FX Rack** | Hängt an den ausgewählten Bus |

**UX:** Ein Dialog "Neues Modul → Routing" oder smarte Defaults (Filter = an letzten aktiven OSC).

---

## 6. Datenmodell-Erweiterungen

### 6.1 CanvasModule bekommt Chain-Info

```typescript
export interface CanvasModule {
  id: string
  moduleType: string
  
  // Visuelle Parameter (weg von grid x/y)
  cardIndex: number          // Position im Swipe-Stack
  
  // Routing
  targetOsc?: number
  targetSynth?: number
  targetBus?: number
  targetEg?: 'eg0' | 'eg1'   // Welchen EG routet das?
  
  // Chain
  chainInputs: string[]       // Module-IDs die in dieses Modul routen
  chainOutputs: string[]      // Module-IDs die von diesem Modul ausgehen
  
  // Parameter
  params: Record<string, any>
  
  // Meta
  derivedFromPatch?: boolean  // Wurde dieses Modul aus einem Patch generiert?
  locked?: boolean            // Verhindert versehentliches Löschen
}
```

### 6.2 Signal Chain Store

```typescript
interface SignalChainStore {
  links: SignalChainLink[]
  
  addLink: (from: string, fromOutput: string, to: string, toInput: string) => void
  removeLink: (id: string) => void
  getChainForModule: (moduleId: string) => { inputs: SignalChainLink[], outputs: SignalChainLink[] }
  getFullChain: () => ChainVisualization
  
  autoRoute: (moduleType: string, targetId?: string) => SignalChainLink[]
}
```

---

## 7. Modul-Typen & ihre Card-Designs

### 7.1 Oszillator Card
- **Header:** OSC-Nummer, Waveform-Selector als große Pills
- **Section 1:** Frequency (log-Slider, groß)
- **Section 2:** Amplitude + Pan (nebeneinander)
- **Section 3:** Detune + Portamento + Bus
- **Section 4:** Modulation Matrix (expandierbar)
  - Note Tracking, Velocity, EG0, EG1, LFO Amounts
  - Visuelle Balken pro Mod-Quelle

### 7.2 Filter Card
- **Header:** Filter-Type Pills (LPF/BPF/HPF/2-POLE)
- **Section 1:** Cutoff (log-Slider, extra groß — das wichtigste Filter-Control!)
- **Section 2:** Resonance
- **Section 3:** Modulation Amounts
  - EG1 → Freq ████ 80%
  - LFO → Freq ██ 30%
  - Key → Freq ███ 50%
  - CV → Freq ██ 20%

### 7.3 Envelope Card
- **Header:** EG 0/1 Select + Type Pills
- **Section 1:** Große SVG-Kurve (400×150px)
- **Section 2:** ADSR Slider (vertikal gestapelt, je 36px)
- **Section 3:** "Routing" — zeigt an, wo dieser EG angebunden ist

### 7.4 LFO Card
- **Header:** LFO-Nummer + Waveform Pills
- **Section 1:** Rate (Hz, große Anzeige)
- **Section 2:** Amplitude
- **Section 3:** Target-Matrix (Checkbox-Grid)
  - ☑ Pitch | ☑ Filter | ☐ Amp | ☐ PWM | ☐ Pan
  - Pro Target: Amount Slider

### 7.5 Synth Manager Card
- **Header:** "Synth #0" + Patch-Name
- **Section 1:** Patch Browser (Full-Screen wenn geöffnet)
- **Section 2:** Config Grid (Voices, MIDI CH, Synth#)
- **Section 3:** Keyboard (2 Oktaven, swipebar)
- **Section 4:** Quick Controls (Portamento, Synth Delay)

### 7.6 FX Rack Card
- **Header:** "FX Bus 0"
- **Section 1:** Reverb (On/Off + Mix, Decay)
- **Section 2:** Chorus (On/Off + Mix, Rate, Depth)
- **Section 3:** Echo/Delay (On/Off + Mix, Time, Feedback)
- **Section 4:** EQ (Low/Mid/High Shelves)

### 7.7 Chain View Card
- **Header:** "Signal Chain"
- **Full-screen Map** aller Module + Verbindungen
- Klick auf Modul → navigiert dorthin
- Drag von Output → Input → neue Verbindung
- **Achtung:** Das ist kein Mini-Overlay, sondern eine eigene Card!

---

## 8. User Flows (Refactored)

### 8.1 Flow: Patch laden → WYSIWYG

```
1. User klickt Patch-Browser in Synth Card
2. Wählt "Juno Pad #3"
3. Was passiert:
   a) Synth Manager lädt Patch (amy.send patch=2)
   b) Patch-Engine parst: "Dieser Patch nutzt OSC 0+1, Filter, EG0"
   c) Canvas wird geleert → neue Module erzeugt:
      - OSC 0 Card (Saw Wave, Freq 220)
      - OSC 1 Card (Saw Wave, Freq 220, Detune +2)
      - Filter Card (LPF, Cutoff 5000, Res 0.7)
      - Envelope Card (EG0, ADSR 50/100/0.5/300)
      - Synth Card (Patch #3, 6 Voices)
   d) Chain wird aufgebaut:
      OSC0 ─→ FILTER ─→ BUS0
      OSC1 ──┘
      EG0 ──→ OSC0/1 Amp
   e) Cards werden im Stack angeordnet
4. User swipe durch die Cards und tweakt live
```

### 8.2 Flow: Neues Filter hinzufügen

```
1. User klickt "+ Modul" im Bottom-Bar
2. Wählt "Filter" aus dem Modul-Picker
3. Prompt: "Filter an welchen OSC?" (oder smart: letzter aktiver OSC)
4. Filter-Card erscheint im Stack:
   - Automatisch in Chain eingebunden: OSC0 ─→ FILTER
   - Filter hat default Einstellungen (LPF, 8kHz, Res 0.7)
   - Filter wird sofort via AMY auf OSC0 gesetzt
5. User kann Cutoff/Res/Tweak sofort machen
6. Filter-Modulation (EG1, LFO, Key) initial = 0, aber sichtbar
```

### 8.3 Flow: Mobile → Desktop Switch

- Gleicher Code, unterschiedliches Layout
- Mobile: Fullscreen Card Stack + Bottom Nav
- Desktop: Split View (Sidebar + Card) oder Multi-Card Grid
- Breakpoint: 1024px
- Zustand bleibt identisch (responsive store)

---

## 9. Touch-spezifische UX

### 9.1 Slider-Design (Touch)

```
Nicht:
[══●══════════════]  ← 10px track, schwer zu fassen

Sondern:
┌──────────────────┐
│ ●────────────── │  ← 36px track, Finger-groß
│ 440 Hz           │
│ 20       8000    │
└──────────────────┘
```

- **Track Height:** 32-40px
- **Thumb:** Immer sichtbar, minimal 24×24px Touch-Target
- **Value Display:** Direkt am Thumb oder darunter
- **Fine Control:** Wenn man den Thumb antippt → Zoom-Mode (Slider wird feiner)
- **Ticks:** Optional bei quantisierten Werten (z.B. Waveform)

### 9.2 Swipe Navigation

```typescript
// Ersetzt das Grid-Layout auf Mobile
// Verwendet Framer Motion für smooth transitions

<AnimatePresence mode="wait">
  <motion.div
    key={currentCard.id}
    initial={{ x: 300, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: -300, opacity: 0 }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    drag="x"
    dragConstraints={{ left: 0, right: 0 }}
    onDragEnd={(_, info) => {
      if (info.offset.x > 100) navigateTo('prev')
      else if (info.offset.x < -100) navigateTo('next')
    }}
  >
    {renderCard(currentCard)}
  </motion.div>
</AnimatePresence>
```

### 9.3 Bottom Action Bar (Mobile)

```
┌──────────────────────┐
│ [← Prev]  [● ● ○ ○] [Next →] │  ← Swipe Indicator
│                        │
│     [+ Add Modul]     │  ← Zentrierter FAB
│                        │
│ [🔄 Save] [📂 Patch] [🔊] │  ← Actions
└──────────────────────┘
```

---

## 10. Code-Umstrukturierung

### 10.1 Neue Datei-Struktur

```
src/
├── modules/                    # bleibt, aber Cards werden größer
│   ├── oscillator-card.tsx     # OSC als Full-Card (war: ModuleWrapper + ModuleContent)
│   ├── filter-card.tsx         # Filter als Full-Card
│   ├── envelope-card.tsx       # Envelope als Full-Card
│   ├── lfo-card.tsx            # LFO als Full-Card
│   ├── synth-card.tsx          # Synth Manager als Full-Card
│   ├── fx-rack-card.tsx        # FX Rack als Full-Card
│   └── index.ts               # Registry
│
├── components/
│   ├── touch/                  # Neue Touch-optimierte Controls
│   │   ├── TouchSlider.tsx     # 36px Touch-Slider
│   │   ├── Pills.tsx           # Große Touch-Pills
│   │   ├── SwipeStack.tsx      # Swipeable Card Container
│   │   ├── KnobDisplay.tsx     # Optional: Circular Knob
│   │   └── CardHeader.tsx      # Einheitlicher Card-Header
│   │
│   ├── chain/                  # Signal Chain Visualisierung
│   │   ├── ChainMap.tsx        # Vollständige Chain-Übersicht
│   │   ├── ChainMiniMap.tsx    # Mini-Chain auf jeder Card
│   │   └── ChainNode.tsx       # Ein Node in der Chain
│   │
│   ├── ConnectionPanel.tsx     # bleibt, aber kompakter
│   ├── PatchBrowser.tsx        # Extrahiert aus SynthModule
│   ├── LogPanel.tsx            # Debug, einklappbar
│   └── FAB.tsx                 # Floating Action Button (+)
│
├── engine/                     # Neue: Patch → Module Logik
│   ├── patch-parser.ts         # zDZ State → CanvasModule[]
│   ├── wire-bridge.ts          # Änderungen → AMY Wire Commands
│   ├── chain-builder.ts        # Auto-Routing Logik
│   └── snapshot.ts             # CanvasModule[] → Patch Save
│
├── stores/
│   ├── canvas-store.ts         # bleibt, erweitert um Chain
│   ├── chain-store.ts          # NEU: Signal Chain State
│   ├── connection-store.ts     # bleibt
│   └── patch-store.ts          # bleibt
│
├── pages/
│   ├── Dashboard.tsx           # Modularbeit (Primary Page)
│   ├── Patches.tsx             # Patch Library (separat)
│   └── Settings.tsx            # bleibt
│
└── App.tsx                     # Routing + Layout
```

### 10.2 Neue Module werden als eigene Cards registriert

```typescript
// modules/index.ts
const moduleCards: CardModule[] = [
  {
    id: 'oscillator',
    name: 'Oszillator',
    icon: 'AudioWaveform',
    component: OscillatorCard,        // ← Full-width Card Component
    category: 'source',
    defaults: { ... },
    // Card-spezifisch:
    hasModMatrix: true,                // Zeigt Modulation Section
    chainRole: 'source',               // OSC ist eine Audio-Quelle
    autoRouteTarget: 'filter',         // Default: routed zu Filter
  },
  // ...
]
```

### 10.3 Card-Interface

```typescript
interface CardModule extends AmyModule {
  component: ComponentType<CardProps>
  hasModMatrix?: boolean
  chainRole: 'source' | 'processor' | 'modulator' | 'output' | 'controller'
  autoRouteTarget?: string
}

interface CardProps {
  id: string
  params: Record<string, any>
  onParamChange: (key: string, value: any) => void
  onSendWire: (wire: string) => void
  
  // Card-spezifisch
  cardIndex: number           // Position im Stack
  totalCards: number          // Gesamtanzahl
  chainInfo?: {
    inputs: string[]
    outputs: string[]
    onNavigateToChain?: () => void
    onNavigateToModule?: (id: string) => void
  }
}
```

---

## 11. Mobile-first Implementierung

### 11.1 Viewport-Strategie

```css
/* Keine Mini-Darstellung auf 320px iPhone SE! */
/* Card nimmt immer full-width, Höhe = viewport - header - nav */

.card-stack {
  height: calc(100dvh - 56px - 56px);  /* Fullscreen - TopBar - BottomNav */
  overflow: hidden;
  position: relative;
}

.card-content {
  overflow-y: auto;           /* Innerhalb der Card scrollen */
  -webkit-overflow-scrolling: touch;
  padding: 16px;
  height: 100%;
}
```

### 11.2 TouchSlider Implementation

```tsx
// Prinzip:
// - Großer Track (36px), immer center
// - Thumb als großer Bullet (24px)
// - Value Tooltip über dem Thumb
// - Optional: Fine-Tune Mode nach Tap

export function TouchSlider({ 
  label, value, min, max, step, unit, 
  logScale, size = 'lg',
  onChange 
}: TouchSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [fineMode, setFineMode] = useState(false)
  
  const pct = logScale 
    ? (Math.log2(value / min) / Math.log2(max / min)) * 100
    : ((value - min) / (max - min)) * 100
  
  return (
    <div className="touch-slider">
      <label className="text-xs font-medium mb-1">{label}</label>
      <div className="relative h-[36px] bg-surface rounded-lg touch-none"
           ref={trackRef}
           onPointerDown={handleDragStart}>
        {/* Track */}
        <div className="absolute inset-y-0 left-0 bg-primary rounded-lg"
             style={{ width: `${pct}%` }} />
        {/* Thumb */}
        <div className="absolute w-[24px] h-[24px] bg-white rounded-full shadow-lg
                      -translate-x-1/2 top-1/2 -translate-y-1/2"
             style={{ left: `${pct}%` }} />
        {/* Value */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono">
          {value}{unit}
        </div>
      </div>
      {showMinMax && (
        <div className="flex justify-between text-[10px] text-muted mt-0.5">
          <span>{logScale ? min : min}</span>
          <span>{logScale ? max : max}</span>
        </div>
      )}
    </div>
  )
}
```

---

## 12. Performance-Überlegungen

### 12.1 Module Virtualisierung bei Desktop Grid

Auf Desktop (wo man mehrere Cards sehen will): Virtualisierung nur sichtbare Cards rendern.

### 12.2 Swipe Stack = Immer nur 1 Card

- Rendert nur die aktive Card + je 1 Nachbar (pre-load)
- Kein React-Re-Render aller Module
- Framer Motion `layoutAnimation` für smooth Übergänge

### 12.3 MIDI Traffic Batching

```typescript
// Slider-Änderungen → requestAnimationFrame batch
// Sendet nicht bei jedem Slider-Event, sondern sammelt + flushed

const batchQueue = useRef<Map<string, AmyParams>>(new Map())

const batchedSend = useCallback((wire: string) => {
  batchQueue.current.set(wire, true)
  requestAnimationFrame(() => {
    if (batchQueue.current.size > 0) {
      for (const w of batchQueue.current.keys()) {
        sendWireMessage(w)
      }
      batchQueue.current.clear()
    }
  })
}, [])
```

---

## 13. Migrationsplan (Phasen)

### 🔴 Phase 1: Card-Layout + TouchSlider
- [ ] TouchSlider Komponente (36px, log-scale, fine-tune)
- [ ] SwipeStack Container
- [ ] OscillatorCard (Full-Screen)
- [ ] FilterCard (Full-Screen)
- [ ] EnvelopeCard (Full-Screen)
- [ ] Grid → SwipeStack im Dashboard
- [ ] Mobile Nav Bottom Bar

### 🟡 Phase 2: Patch → Module Instantiation
- [ ] Patch-Parser Engine (zDZ → CanvasModule[])
- [ ] Auto-Create Modules beim Patch-Laden
- [ ] SynthManager → PatchBrowser extrahiert
-