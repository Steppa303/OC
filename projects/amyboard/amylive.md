# 🎹 amylive.steppa.online — Umsetzungskonzept

> AMYboard Live Control Webapp – Steuerung und Programmierung des AMY Synthesizers über MIDI SysEx

---

## 1. Überblick

**Amylive** ist eine Progressive Web App (PWA) zur Live-Steuerung und Programmierung des [AMYboard](https://github.com/shorepine/tulipcc/blob/main/docs/amyboard/README.md) – einem $29 ESP32-S3 Synthesizer mit 128 Juno-6 + 128 DX7 Patches, FM, PCM-Sampler und modularem CV-I/O.

Die Kommunikation läuft ausschließlich über **WebMIDI** (USB MIDI SysEx), d.h. der Browser verbindet sich direkt mit dem AMYboard – kein Backend nötig für die Synthesizer-Steuerung. Die Webapp ist deployt auf dem VPS unter `amylive.steppa.online`, läuft aber zu 100% clientseitig im Browser.

### Architektur-Prinzip

```
[BROWSER] ←── WebMIDI SysEx ──→ [AMYboard (ESP32-S3)]
    │                                    │
    ├─ Patch Editor                 AMY Synth Engine
    ├─ Modulation Matrix             ├─ 180 Oszillatoren
    ├─ Envelope Designer             ├─ 4 Buses mit FX
    ├─ FX Rack                       ├─ Sequenzer
    ├─ Modul-Bibliothek              ├─ PCM Sampler
    └─ Patch Library (Lokal)         └─ User Patches (1024-1055)
```

✅ **Kein eigener Server** für die MIDI-Kommunikation  
✅ **Nur WebMIDI** – der Browser redet direkt übers Board  
✅ **Static-Site-Deployment** auf dem VPS (Caddy)

---

## 2. Technologien

| Bereich | Technologie | Begründung |
|---------|-----------|-----------|
| **Framework** | React 18+ (Vite) | Komponentenbasiert, riesiges Ökosystem |
| **Sprache** | TypeScript | Typ-Sicherheit für komplexe AMY-Parameter |
| **Styling** | TailwindCSS v4 | Mobile First, Utility-First, kein CSS-Bloat |
| **MIDI** | Web MIDI API (`navigator.requestMIDIAccess()`) | Native Browser API – kein Polyfill nötig |
| **State** | Zustand (oder Jotai) | Leichtgewichtig, perfekt für modularen State |
| **Icons** | Lucide React | Durchgehend konsistente Icons |
| **Animations** | Framer Motion | Smooth Transitions bei Modul-Drag&Drop |
| **Build** | Vite + TypeScript | Schnelle Dev-Erfahrung, kleine Bundles |
| **Deployment** | Caddy (Static) | Einfach, HTTPS, Subfolder falls nötig |
| **Testing** | Vitest + Testing Library | Unit-Tests für AMY-Message-Generierung |

---

## 3. Kommunikation: WebMIDI ↔ AMYboard

### 3.1 Verbindungsmanagement

```typescript
interface AMYConnection {
  // WebMIDI Ports
  input: MIDIInput | null
  output: MIDIOutput | null
  // State
  connected: boolean
  deviceName: string
  firmwareVersion: string | null
  
  // Methoden
  connect(): Promise<void>
  disconnect(): void
  send(payload: Uint8Array): void
  ping(): Promise<boolean>
}
```

### 3.2 SysEx Protocol Adapter

Die **Control API** (doku: [control_api.md](https://github.com/shorepine/tulipcc/blob/main/docs/amyboard/control_api.md)) definiert folgende Kommandos:

| Befehl | Funktion | Status |
|--------|----------|--------|
| `zT<path>,<size>Z` | File Upload Start | ✅ Phase 1 |
| `base64-Chunks` | File Data Chunks | ✅ Phase 1 |
| `zDZ` | State Dump (alle Parameter) | ✅ Phase 1 |
| `zD<path>Z` | File Download | ⏳ Phase 2 |
| `zAZ` | State → Sketch speichern | ⏳ Phase 2 |
| `zP<python>Z` | Python oneliner ausführen | ✅ Phase 1 |
| `zIZ` | Ping | ✅ Phase 1 |
| `zBZ / zB1Z / zB2Z` | Reboot (Bootloader/Normal/Flash) | ✅ Phase 1 |
| `zY1Z / zY0Z` | Sequencer Start/Stop | ✅ Phase 1 |
| `zF<preset>,<path>,<note>Z` | PCM Sample von Disk laden | ⏳ Phase 2 |
| `zS/zO` | Sampling Start/Stop | ⏳ Phase 3 |

### 3.3 AMY Wire Protocol (Control Coefficients)

Die eigentliche Synthesizer-Steuerung läuft über **AMY Wire Messages** – entweder direkt via `zP amy.send(...)` oder durch Senden von AMY-Nachrichten über MIDI.

Core-Parameter die wir steuern:

```
amy.send({
  osc: 0,           // Oszillator-Nummer (0-179)
  wave: 0,          // Wellenform: SINE(0), PULSE(1), SAW_DOWN(2), etc.
  freq: 440,        // Frequenz oder CtrlCoefs
  amp: 1,           // Amplitude oder CtrlCoefs
  filter_freq: 8000,// Filter-Frequenz oder CtrlCoefs
  resonance: 0.7,   // Filter-Resonanz (Q)
  filter_type: 1,   // 0=None, 1=LPF, 2=BPF, 3=HPF, 4=2-Order-LPF
  bp0: '0,1,200,0.5,500,0', // EG0 Breakpoints
  bp1: '0,0,100,1,500,0.8', // EG1 Breakpoints
  mod_source: 1,    // LFO-Modulationsquelle
  duty: 0.5,        // Duty Cycle (Pulsweite)
  pan: 0.5,         // Panning
  bus: 0,           // Bus (0-3, für FX Routing)
  portamento: 100,  // Portamento in ms
  feedback: 0.3     // Feedback (FM/KS/PCM-Loop)
})
```

Für **CtrlCoefs** (mehrere Steuerquellen pro Parameter):

```typescript
// Beispiel: Filter-Frequenz moduliert von EG1 + Keyboard-Follow
amy.send({
  filter_freq: {
    const: 50,    // Basis 50 Hz
    note: 0.5,    // Keyboard-Follow halb
    eg1: 1,       // EG1 zu 100%
  }
})
// Äquivalent (Wire-Syntax):
// filter_freq='50,0.5,,,1'
```

## 4. UI-Architektur: Modulares Dashboard

Das Kernkonzept: **Module als Kacheln**, die man auf einem Canvas anordnet. Jedes Modul steuert genau einen Aspekt des AMY Synths.

### 4.1 Haupt-Layout

```
┌──────────────┬──────────────────────────────────────┐
│  CONNECTION   │                                      │
│  ┌─────────┐ │           MODUL CANVAS                │
│  │● CONNECT │ │                                      │
│  │AMYboard  │ │  ┌─────────┐ ┌──────────┐            │
│  └─────────┘ │  │OSC 0    │ │FILTER    │            │
│              │  │ ┌─────┐ │ │[LPF]─────│            │
│  MIDI: ● OK  │  │ │SINE │ │ │Freq: ███ │            │
│  CH: 1       │  │ └─────┘ │ │Res:  ██  │            │
│  FW: v2026.. │  │ Freq ██ │ └──────────┘            │
│              │  │ Amp  ██ │ ┌──────────┐            │
│  [Presets]   │  └─────────┘ │EG0      │            │
│  [Library]   │              │ ┌──╱───╲┐ │            │
│              │              │ │╱       ╲│            │
│              │              │ └────────┘ │            │
└──────────────┴──────────────┴──────────┘            │
┌──────────────────────────────────────────────────────┐
│ [+] Modul hinzufügen  │  [SNAPSHOT]  SAVE LOAD      │
└──────────────────────────────────────────────────────┘
```

### 4.2 Module (Komponenten-Katalog)

Jedes Modul ist eine eigenständige React-Komponente mit:
- **Eigenem State** (welcher OSC/Synth/Bus)
- **Controls** (Sliders, Knobs, Dropdowns, Number Inputs)
- **MIDI-Output** (erzeugt AMY Wire Messages)
- **Drag & Drop** auf dem Canvas
- **Resizable** (manche Module brauchen mehr Platz)

#### Waveform Oszillator
```tsx
<OscillatorModule id={0}>
  ┌─────────────────────┐
  │ OSC 0 ● SINE        │
  │ Frequency ──███───  │  440 Hz
  │ Amplitude ──██────  │  0.75
  │ Pan       ──█─────  │  Center
  │ Detune   ──█─────  │  +0 ct
  │ Portamento ─█─────  │  50 ms
  │ Bus      [0 ▼]     │
  │                    │
  │ Coefs:             │
  │  Freq: ████████    │  const + note + pitch_bend
  │  Amp:  ████████    │  const + vel + eg0
  └─────────────────────┘
</OscillatorModule>
```

**Wellenformen:** SINE, PULSE, SAW_DOWN, SAW_UP, TRIANGLE, NOISE, KS (Karplus-Strong), PCM, ALGO (FM), PARTIAL, WAVETABLE, CUSTOM, OFF

#### Filter Modul
```tsx
<FilterModule osc={0}>
  ┌─────────────────────┐
  │ FILTER              │
  │ [LPF] [BPF] [HPF]   │
  │                     │
  │ Cutoff  ───███───   │  2.5 kHz
  │ Reson.  ──██─────   │  3.5
  │                     │
  │ Modulation:         │
  │  EG1 → Freq ████   │  80%
  │  LFO  → Freq ██    │  30%
  │  Key  → Freq ███   │  50%
  └─────────────────────┘
</FilterModule>
```

#### Hüllkurven (EG0 / EG1)
```tsx
<EnvelopeModule id={0}>
  ┌─────────────────────────┐
  │ ENVELOPE 0              │
  │ Type: [DX7 ▼]           │
  │                         │
  │  1.0 ┤╱───╲             │
  │       │     ╲───╱───╲  │  Sustain
  │  0.0 ┤╱────────────╲── │
  │      Atk Dcy   Sus Rel │
  │ A: ████ 200ms          │
  │ D: ██   150ms → 0.65   │
  │ S:         0.50        │
  │ R: ████     500ms       │
  └─────────────────────────┘
</EnvelopeModule>
```

**EG Typen:** Normal (RC), Linear, DX7-Style, True Exponential

#### LFO / Modulation
```tsx
<LFOModule id={1}>
  ┌─────────────────────┐
  │ LFO 1               │
  │ Wave: [TRIANGLE ▼]  │
  │ Freq: ──███────  3.2│  Hz
  │ Amp:  ──████───  0.8│
  │                     │
  │ Targets:            │
  │ ☑ Osc 0 → Pitch   25%│
  │ ☐ Osc 0 → Filter  40%│
  │ ☑ Osc 0 → Amp    15%│
  │ ☐ Osc 0 → PWM    50%│
  └─────────────────────┘
</LFOModule>
```

#### FX Rack (Bus-basiert)
```tsx
<FxRackModule bus={0}>
  ┌──────────────────────────┐
  │ BUS 0 EFFECTS            │
  │                          │
  │ REVERB [ON]              │
  │ Mix: ──██─────   35%     │
  │ Decay: ─███──── 0.6      │
  │                          │
  │ CHORUS [ON]              │
  │ Mix: ──█──────  15%      │
  │ Rate: ─██─────  1.2Hz    │
  │ Depth: ─██────  0.4      │
  │                          │
  │ ECHO/DELAY [OFF]         │
  │ Mix: ──█──────  20%      │
  │ Time: ─██─────  350ms    │
  │ Feedback: ██───  0.3     │
  │                          │
  │ EQ [ON]                  │
  │ Low:  ████████   +2dB    │
  │ Mid:  ██████     -1dB    │
  │ High: ████████   +3dB    │
  └──────────────────────────┘
</FxRackModule>
```

#### Synth Manager (Voice/Polyphony)
```tsx
<SynthModule id={0}>
  ┌─────────────────────────┐
  │ SYNTH 0                 │
  │ Voices: [6 ▼]    used: 3│
  │ Patch: [Juno-6 #1 ▼]   │
  │                        │
  │ OSC per Voice: 5       │
  │ MIDI CH: 1             │
  │                        │
  │ Play Note: [C3] [D3]   │
  │ [E3] [F3] [G3] (Pads) │
  │                        │
  │ Portamento: ──██──── 100│ms
  │ Synth Delay: ─█─────  20│ms
  └─────────────────────────┘
</SynthModule>
```

#### FM Algorithm Editor (DX7-Style)
```tsx
<FmModule algo={5}>
  ┌─────────────────────────┐
  │ FM ALGORITHM 5          │
  │                         │
  │     OP6 ──→ OP3 ──→    │
  │              ↓         │
  │     OP5 ──→ OP2 ──→    │
  │              ↓         │
  │     OP4 ──→ OP1 ──→    │  Out
  │                         │
  │ OP1 Ratio: 1.00         │
  │ OP1 Level: ──███────  0.7│
  │ OP2 Ratio: 3.00         │
  │ OP2 Level: ──██─────  0.5│
  │ ...                      │
  │ Feedback: ──██────  0.3  │
  └─────────────────────────┘
</FmModule>
```

---

## 5. Patch Library & State Management

### 5.1 Lokale Patch Library (LocalStorage + IndexedDB)

Patches werden im Browser gecached und können:
- **Vom Board geladen** (zDZ dump)
- **Im Browser gespeichert** (Name, Tags, Category)
- **Wieder aufs Board gespielt** (amy.send(...) replay)
- **Exportiert/Importiert** (JSON, SYX)

```typescript
interface AmyPatch {
  id: string           // uuid
  name: string
  author: string
  category: 'juno' | 'dx7' | 'fm' | 'pcm' | 'user'
  tags: string[]
  
  // Full synth state
  state: {
    oscillators: AmyOscState[]   // Alle Oszillator-Parameter
    synths: AmySynthState[]      // Synth-Konfiguration
    effects: AmyFxState[]        // FX pro Bus
    envelopes: AmyEgState[]      // EG0/EG1 per osc
    modulation: AmyModState[]    // Verbindungen
  }
  
  // Raw AMY wire commands (für Replay)
  wireCommands: string[]
  
  created: number     // timestamp
  modified: number
  boardSlot?: number  // 1024-1055 (User Patch auf Board)
}
```

### 5.2 State Snapshotting

```typescript
// Live State vom Board holen
const state = await amy.dumpState()  // → zDZ → parse frames
// Im Browser speichern
patchLibrary.save('Mein Bass', state)
// Wiederherstellen
amy.sendState(patch.state)  // → amy.send({...}) für jeden OSC
```

### 5.3 Board → Browser → Board Workflow

```
1. "Load from Board" → zDZ → Base64 dekodieren → Patch-Objekt
2. Patch im Editor bearbeiten → lokale Änderungen
3. "Save to Board" → Patch als Sketch schreiben:
   - zP import amy; amy.reset()  (clean slate)
   - zT/user/current/sketch.py,N → File Transfer starten
   - Base64-Chunks senden (≤188 bytes/chunk, je mit ACK warten)
   - zP amyboard.restart_sketch() → Neustart
4. Alternativ: "Write as User Patch 1024":
   - zP über amy.send(patch=1024, ...) für jeden Parameter
```

### 5.4 Patch Browser & Verwaltung

```tsx
<PatchLibrary>
  ┌──────────────────────────────┐
  │ 🔍 Search...    [ALL ▼]    [+] │
  ├──────────────────────────────┤
  │ 📁 Mein Bass    ★ Juno   ⏳ │
  │   Sub-oscillator stacked     │
  │ 📁 Dream Pad    ★ User   │
  │   Two detuned saws + LFO    │
  │ 📁 808 Kick      ★ PCM   │
  │   TR-808 processed          │
  │ 📁 FM Bell       ★ DX7   │
  │   Algorithm 5               │
  ├──────────────────────────────┤
  │ [LOAD TO BOARD] [EXPORT]  🗑 │
  └──────────────────────────────┘
</PatchLibrary>
```

---

## 6. Routing & Pages

Da PWA mit Mobile-First:

| Route | Page | Beschreibung |
|-------|------|-------------|
| `/` | **Dashboard** | Modul-Canvas, Verbindungsstatus, Quick Controls |
| `/patches` | **Patch Library** | Browser + Verwalten aller Patches |
| `/patch/:id` | **Patch Editor** | Detail-Editor für einen Patch |
| `/modules` | **Modul-Bibliothek** | Verfügbare Module verwalten/hinzuladen |
| `/midi` | **MIDI Config** | Connection Manager, SysEx Debug Console |
| `/settings` | **Settings** | Theme (Dark/Light), Default-Werte |

---

## 7. Modul-Bibliothek (Modular System)

### 7.1 Architektur

Module werden als **Plugins** registriert:

```typescript
interface AmyModule {
  id: string                    // z.B. 'oscillator'
  name: string                  // 'Oszillator'
  icon: string                  // Lucide Icon-Name
  category: 'source' | 'filter' | 'envelope' | 'modulation' | 'fx' | 'mixer' | 'sequencer'
  
  // Komponente
  component: React.ComponentType<ModuleProps>
  
  // Minimale Canvas-Größe
  minWidth: number              // Grid units
  minHeight: number
  
  // Standard-Parameter (beim Erstellen)
  defaults: Record<string, any>
  
  // AMY Message Factory
  toWire(params: Record<string, any>): string
  
  // State-Dump Parser (von zDZ)
  fromWire(wireLine: string): Record<string, any> | null
}
```

### 7.2 Starter-Module (Bibliothek Phase 1)

| Modul | Kategorie | Beschreibung |
|-------|-----------|-------------|
| **Oszillator** | Source | Wellenform, Frequenz, Amplitude, Pan, Detune |
| **Filter** | Filter | LPF/BPF/HPF, Cutoff, Resonance, Modulation |
| **Envelope 0/1** | Envelope | ADSR mit Breakpoints, Typ-Wahl |
| **LFO** | Modulation | Sinus/Dreieck/Säge/Puls, Rate, Depth, Targets |
| **Mod Matrix** | Modulation | Quellen → Ziele (Drag&Connect) |
| **Synth** | Mixer | Voices, Patch-Auswahl, Polyphony, MIDI CH |
| **FX Rack** | FX | Reverb/Chorus/Echo/EQ pro Bus |
| **Mixer** | Mixer | Bus-Level, Master Volume, Mute/Solo |
| **MIDI Pads** | Input | Keyboard-Pads zum Spielen |
| **Sequencer** | Sequencer | Step-Sequencer, Tempo, Pattern |

### 7.3 Modul-Bibliothek erweitern (Phase 2+)

Neue Module werden einfach in `src/modules/` angelegt und automatisch registriert:

```
src/modules/
├── oscillator.tsx
├── filter.tsx
├── envelope.tsx
├── lfo.tsx
├── mod-matrix.tsx
├── synth.tsx
├── fx-rack.tsx
├── mixer.tsx
├── midi-pads.tsx
├── sequencer.tsx
├── fm-editor.tsx
├── wavetable.tsx
├── sampler.tsx
└── cv-control.tsx
```

Das System scannt `src/modules/index.ts` und baut daraus die Bibliothek – kein zusätzlicher Config-Aufwand.

---

## 8. User Flows

### 8.1 Erstverbindung

1. User öffnet `amylive.steppa.online`
2. App checkt: `navigator.requestMIDIAccess()`
3. **MIDI nicht verfügbar** → Hinweis: "Chrome/Edge mit WebMIDI öffnen"
4. AMYboard per USB-C anschließen
5. App zeigt AMYboard in MIDI Ports an → `[CONNECT]`
6. Ping `zI` → OK → Dashboard aktiv

### 8.2 Synth bauen (von Null)

1. Canvas leer → `[+ Modul hinzufügen]`
2. Dropdown: **Oszillator** wählen
3. Waveform: Sägezahn → Slider verstellen → AMY Message fliegt live zum Board
4. `[+ Modul]` → **Envelope 0** → ADSR einstellen
5. Envelope routet automatisch zu OSC 0 (oder per Drag vom Modulation-Target)
6. `[+ Modul]` → **Filter** → LPF, Cutoff drehen
7. `[Speichern]` → Patch lokal sichern
8. `[Auf Board speichern]` → zA oder zT + zP

### 8.3 Board State laden und bearbeiten

1. `[Load from Board]` → zDZ → Status wird geparst
2. Canvas füllt sich mit den Modulen, die im aktuellen State aktiv sind
3. Slider zeigen Live-Werte
4. Änderungen → sofort auf dem Board hörbar
5. `[Save to Board]` → zA aktualisiert Sketch

### 8.4 Patch verwalten

1. `/patches` → Liste aller gespeicherten Patches
2. Suche, Filter nach Kategorie
3. Klick → Patch laden → Board bekommt alle Parameter
4. Stern → Favorite
5. Export → JSON-Datei download
6. Import → JSON-Datei upload

---

## 9. Deployment

### 9.1 Caddy Config

```caddy
amylive.steppa.online:80 {
	root * /var/www/apps/amylive
	try_files {path} /index.html
	file_server

	header {
		Access-Control-Allow-Origin "*"
	}

	encode gzip

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

⚠️ **Wichtig:** WebMIDI benötigt HTTPS (Secure Context). Ohne Cloudflare Proxy (orange cloud) existiert `navigator.requestMIDIAccess` nicht!

⚠️ **COOP/COEP NICHT für amylive verwenden!** `Cross-Origin-Embedder-Policy: require-corp` killt WebMIDI auf mobilen Chrome-Versionen. Nur für `amysim.steppa.online` (SharedArrayBuffer) setzen.

### 9.2 Build & Deploy

```bash
# Dev
cd projects/amyboard/amylive && npm run dev

# Build
npm run build   # → dist/

# Deploy (auf dem VPS)
cp -r dist/* /var/www/apps/amylive/
```

### 9.3 HTTP → HTTPS über Cloudflare

Der DNS-Eintrag muss **proxied** (orange cloud) sein, sonst läuft die Seite auf HTTP und WebMIDI ist nicht verfügbar!

```bash
# DNS-ID prüfen
source .secrets/cloudflare.env
curl -s "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records?type=A&name=amylive.steppa.online" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | python3 -m json.tool

# Auf proxied setzen
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/<ID>" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"proxied": true}'
```

---

## 10. Phasen-Plan

### 🔴 Phase 1 (MVP) – Core Synthesizer Control
**Ziel:** Alle grundlegenden Synth-Funktionen live steuern

- [x] **WebMIDI Connection Manager** (Verbinden/Trennen/Ping)
- [x] **SysEx Protocol Adapter** (zP, zDZ, zI, zB)
- [x] **Event Log System** (LogPanel + Backend Persistenz via /api/amy/log)
- [x] **Patch Database** (256 Factory Presets + Piano + 7 Drums + 32 User)
- [x] **Synth Manager Module** (Patch-Browser, Synth Config, MIDI Keyboard Pads)
- [x] Live-Parameter-Update (Slider → sofortiger Sound, geloggt)
- [ ] Modul-Canvas (Drag&Drop Grid)
- [ ] **Oszillator-Modul** (alle Wellenformen, Freq, Amp, Pan, Detune)
- [ ] **Filter-Modul** (LPF/BPF/HPF, Cutoff, Resonance, CtrlCoefs)
- [ ] **Envelope 0 + 1** (ADSR mit Breakpoints)
- [ ] **Echter WebMIDI Output** (midiOutput.send statt console.log)
- [ ] **FX Rack** (Reverb, Chorus, Echo)
- [ ] Lokale Patch Library (Speichern/Laden/Löschen)
- [ ] State vom Board laden (zDZ) + auf Board schreiben (zA/zT)

### 🟡 Phase 2 – FX & FM
- [ ] **FX Rack** (Reverb, Chorus, Echo, EQ pro Bus)
- [ ] **Mixer** (Bus-Level, Master, Mute/Solo)
- [ ] **FM Algorithm Editor** (alle 32 DX7 Algos)
- [ ] **LFO-Modul** (mit Mod-Matrix-Targets)
- [ ] **Mod Matrix Visual** (Line-Verbindungen zwischen Modulen)
- [ ] **PCM Sampler Control** (zF, Sample-Upload)
- [ ] **Wavetable Editor** (duty-crossfade)
- [ ] Board → Patch Export (als JSON/SYX)
- [ ] Patch Import (JSON/SYX → Browser + Board)

### 🟢 Phase 3 – Sequencer & Advanced
- [ ] **Step-Sequencer** (16 Steps, Tempo, Gate, Velocity)
- [ ] **Pattern Chain** (Ableton-Style Session View?)
- [ ] **Partials Editor** (BYO_PARTIALS)
- [ ] **Karplus-Strong Modul**
- [ ] **MIDI CC Mapping** (Hardware-Controller → Parameter)
- [ ] **Arpeggiator**
- [ ] **Audio Recording** (Mediastream aus AMYboard?)
- [ ] **User Patch Upload** (Patch 1024-1055 auf Board)

### 🔵 Phase 4 – Polish & Poweruser
- [ ] **Dark/Light Theme**
- [ ] **Undo/Redo** (Parameter-History)
- [ ] **Modul-Presets** (gespeicherte Modul-Konfigurationen)
- [ ] **Canvas-Layout speichern** (Login via localStorage)
- [ ] **Waveform Visualizer** (Canvas/WebAudio)
- [ ] **Spectrum Analyzer**
- [ ] **Key Commands**
- [ ] **PWA Offline Support** (Service Worker)
- [ ] **MIDI Learn** (assign hardware fader → parameter)
- [ ] **Multi-Board Support** (mehrere AMYboards gleichzeitig)

---

## 11. Datenstruktur: AMY Wire Protocol API

Kern-Utility zur Generierung valider AMY Messages:

```typescript
// src/lib/amy-protocol.ts

// Ein AMY Wire-Command als String erzeugen
function amyMessage(params: AmyParams): string

// Direkt via MIDI senden
function amySend(params: AmyParams): void

// CtrlCoefs Builder
function ctrlCoef(values: CtrlCoefValues): string

// AMY-Parameter komplett entlang der API-Reference
interface AmyParams {
  // Oscillator
  osc?: number          // v
  wave?: WaveType       // w (0=SINE, 1=PULSE, 2=SAW_DOWN, ...)
  
  // Frequency & Amplitude (mit CtrlCoefs)
  freq?: number | string | CtrlCoefValues    // f
  amp?: number | string | CtrlCoefValues     // a
  duty?: number | string | CtrlCoefValues    // d
  pan?: number | string | CtrlCoefValues     // Q
  filter_freq?: number | string | CtrlCoefValues  // F
  
  // Filter
  filter_type?: number  // G (0=None, 1=LPF, 2=BPF, 3=HPF, 4=2-LPF)
  resonance?: number    // R
  
  // Envelopes
  bp0?: string          // A (EG0 Breakpoints: '0,1,200,0.5,500,0')
  bp1?: string          // B (EG1 Breakpoints)
  eg0_type?: number     // T (0=Normal, 1=Linear, 2=DX7, 3=Exponential)
  eg1_type?: number     // X
  
  // Modulation
  mod_source?: number   // L (welcher OSC als LFO)
  feedback?: number     // b
  
  // Synth/Patch
  synth?: number        // i
  patch?: number        // K
  patch_string?: string // u
  num_voices?: number   // iv
  oscs_per_voice?: number // in
  voices?: number[]     // r
  
  // Timing
  time?: number         // ms (future scheduling)
  sequence?: string     // 'tick,period,tag'
  
  // Note events
  note?: number         // n
  vel?: number          // l (velocity, triggert Envelope)
  portamento?: number   // m
  
  // Reset
  reset?: number        // S
  
  // Misc
  bus?: number          // y
  chained_osc?: number  // c
  phase?: number        // P
  algo_source?: string  // O
  
  // Effects (global/bus level)
  reverb?: number | string   // h
  chorus?: number | string   // j
  echo?: number | string     // k
  eq?: number | string       // V/volume per bus
  
  // Sample
  load_sample?: number[]     // z
  disk_sample?: [number, string, number]  // zF
}

type WaveType = 
  | 'SINE' | 'PULSE' | 'SAW_DOWN' | 'SAW_UP' | 'TRIANGLE'
  | 'NOISE' | 'KS' | 'PCM' | 'ALGO' | 'PARTIAL'
  | 'BYO_PARTIALS' | 'INTERP_PARTIALS'
  | 'AUDIO_IN0' | 'AUDIO_IN1' | 'AUDIO_EXT0' | 'AUDIO_EXT1'
  | 'AMY_MIDI' | 'PCM_LEFT' | 'PCM_RIGHT' | 'WAVETABLE'
  | 'CUSTOM' | 'OFF'

interface CtrlCoefValues {
  const?: number   // Konstanter Wert
  note?: number    // Note-Tracking
  vel?: number     // Velocity
  eg0?: number     // Envelope Generator 0
  eg1?: number     // Envelope Generator 1
  mod?: number     // Modulation Source (LFO)
  bend?: number    // Pitch Bend
  ext0?: number    // External 0
  ext1?: number    // External 1
}
```

### Wire Format Beispiel

Die `amyMessage()` Funktion wandelt Parameter in das kompakte Wire-Format:

```typescript
amyMessage({ osc: 0, wave: 'SAW_DOWN', freq: { const: 220, note: 1 }, amp: { const:
```typescript
amyMessage({ osc: 0, wave: 'SAW_DOWN', freq: { const: 220, note: 1 }, amp: { const: 1, vel: 1, eg0: 1 } })
// → "v0w2f220,1a1,1,1Z"

// LFO als Modulationsquelle für PWM
amyMessage({ osc: 1, wave: 'SINE', freq: 0.5, amp: 1 })
// → "v1w0f0.5a1Z"

// Pulse-Wave mit PWM durch LFO
amyMessage({ osc: 0, wave: 'PULSE', duty: { const: 0.5, mod: 0.4 }, mod_source: 1 })
// → "v0w1d0.5,,,0.4L1Z"
```

### AMY Message Wire Format (Referenz)

| Wire Code | Bedeutung | Example |
|-----------|-----------|---------|
| `v0` | Oscillator 0 | `v0w0f440Z` |
| `w0-21` | Wellenform | `w0`=SINE, `w1`=PULSE, `w2`=SAW_DOWN |
| `f` | Frequenz (CtrlCoefs) | `f440,1` = 440Hz + note-tracking |
| `a` | Amplitude (CtrlCoefs) | `a1,0,1` = gain, ignored vel, EG0 |
| `A` | EG0 Breakpoints | `A0,1,200,0.5,500,0` |
| `G` | Filter Type | `G1` = LPF |
| `F` | Filter Freq (CtrlCoefs) | `F8000,,,1` |
| `R` | Resonance | `R0.7` |
| `L` | Mod Source | `L1` = Osc 1 |
| `l` | Velocity/Note-On | `l1` = trigger |
| `h` | Reverb (Bus) | `h0.5,0.6,0.4,8000` |
| `j` | Chorus (Bus) | `j0.3,0.5,0.7` |
| `k` | Echo (Bus) | `k0.3,400,0.5` |
| `V` | Volume (Bus) | `V1` = vol 1.0 |
| `T` | EG0 Type | `T2` = DX7-style |
| `X` | EG1 Type | `X1` = Linear |

---

## 13. Testing-Strategie

### 13.1 Test-Stack

| Ebene | Tool | Scope |
|-------|------|-------|
| **Unit** | Vitest | AMY Wire Protocol, SysEx Parser, CtrlCoef Builder |
| **Component** | Testing Library + Vitest | React-Komponenten (Slider, Knob, Module) |
| **Integration** | Testing Library | Modul-Interaktionen, State-Management, MIDI-Mocks |
| **E2E** | Playwright (optional) | Vollständige User-Flows im Browser |
| **Snapshot** | Vitest | Wire-Format Output Regression |

### 13.2 Test-Ordner-Struktur

```
src/
├── lib/
│   ├── __tests__/
│   │   ├── amy-protocol.test.ts    # Wire-Format Unit Tests
│   │   ├── amy-connection.test.ts  # WebMIDI Mock Tests
│   │   ├── ctrl-coef.test.ts       # CtrlCoef Parser/Builder
│   │   └── state-dump.test.ts      # zDZ Parser
│   │
├── modules/
│   ├── __tests__/
│   │   ├── oscillator.test.tsx     # Oscillator Component Tests
│   │   ├── filter.test.tsx         # Filter Component Tests
│   │   ├── envelope.test.tsx       # Envelope Component Tests
│   │   ├── synth.test.tsx          # Synth Module Tests
│   │   └── module-registry.test.ts # Registry + Plugin Loading
│   │
├── components/
│   ├── __tests__/
│   │   ├── Slider.test.tsx
│   │   ├── Knob.test.tsx
│   │   ├── ConnectionPanel.test.tsx
│   │   ├── ModuleCanvas.test.tsx
│   │   └── PatchLibrary.test.tsx
│   │
├── stores/
│   ├── __tests__/
│   │   ├── connection-store.test.ts
│   │   ├── canvas-store.test.ts
│   │   └── patch-store.test.ts
│   │
└── hooks/
    ├── __tests__/
    │   └── useAMY.test.ts
```

### 13.3 AMY Protocol Unit Tests (Kern)

```typescript
// src/lib/__tests__/amy-protocol.test.ts
import { describe, it, expect } from 'vitest'
import { amyMessage, ctrlCoef, parseWireLine } from '../amy-protocol'

describe('amyMessage()', () => {
  it('erzeugt einfaches SINE mit Frequenz', () => {
    expect(amyMessage({ osc: 0, wave: 'SINE', freq: 440 }))
      .toBe('v0w0f440Z')
  })

  it('erzeugt SAW_DOWN mit CtrlCoefs', () => {
    expect(amyMessage({ osc: 1, wave: 'SAW_DOWN', freq: { const: 220, note: 1 } }))
      .toBe('v1w2f220,1Z')
  })

  it('erzeugt PULSE mit PWM LFO', () => {
    expect(amyMessage({
      osc: 0, wave: 'PULSE',
      duty: { const: 0.5, mod: 0.4 },
      mod_source: 1
    })).toBe('v0w1d0.5,,,,,,0.4L1Z')
  })

  it('erzeugt vollständigen ADSR Envelope', () => {
    expect(amyMessage({
      osc: 0, wave: 'SINE',
      bp0: '0,1,200,0.5,500,0',
      amp: { const: 1, vel: 1, eg0: 1 }
    })).toBe('v0w0A0,1,200,0.5,500,0a1,1,1Z')
  })
})

describe('ctrlCoef()', () => {
  it('erzeugt leere Coefs für leeres Objekt', () => {
    expect(ctrlCoef({})).toBe(',,,,,,,')
  })

  it('setzt const + note + eg1', () => {
    expect(ctrlCoef({ const: 50, note: 0.5, eg1: 1 }))
      .toBe('50,0.5,,,1')
  })

  it('lässt Lücken für nicht gesetzte Werte', () => {
    expect(ctrlCoef({ eg1: 0.5 })).toBe(',,,,0.5')
  })

  it('verarbeitet alle 9 Felder', () => {
    expect(ctrlCoef({ const: 1, note: 2, vel: 3, eg0: 4, eg1: 5, mod: 6, bend: 7, ext0: 8, ext1: 9 }))
      .toBe('1,2,3,4,5,6,7,8,9')
  })
})

describe('parseWireLine() (zDZ Parser)', () => {
  it('parst einfachen OSC Befehl', () => {
    const result = parseWireLine('v0w0f440Z')
    expect(result).toEqual({ osc: 0, wave: 'SINE', freq: 440 })
  })

  it('parst Envelope Breakpoints', () => {
    const result = parseWireLine('v0w0A0,1,200,0.5,500,0a1,1,1Z')
    expect(result.osc).toBe(0)
    expect(result.wave).toBe('SINE')
    expect(result.bp0).toBe('0,1,200,0.5,500,0')
    expect(result.amp).toEqual({ const: 1, vel: 1, eg0: 1 })
  })

  it('gibt null für ungültige Messages', () => {
    expect(parseWireLine('')).toBeNull()
    expect(parseWireLine('invalid')).toBeNull()
  })
})
```

### 13.4 SysEx Adapter Tests (mit WebMIDI Mock)

```typescript
// src/lib/__tests__/amy-connection.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AMYConnection } from '../amy-connection'

// WebMIDI Mock
const mockMidiAccess = {
  inputs: new Map([
    ['port1', { name: 'AMYboard', type: 'input', manufacturer: 'Shorepine' }]
  ]),
  outputs: new Map([
    ['port1', { name: 'AMYboard', type: 'output', manufacturer: 'Shorepine', send: vi.fn() }]
  ]),
  onstatechange: null
}

describe('AMYConnection', () => {
  let connection: AMYConnection

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      requestMIDIAccess: vi.fn().mockResolvedValue(mockMidiAccess)
    })
    connection = new AMYConnection()
  })

  it('findet AMYboard bei connect()', async () => {
    await connection.connect()
    expect(connection.connected).toBe(true)
    expect(connection.deviceName).toBe('AMYboard')
  })

  it('sendet korrekte SysEx Payload', () => {
    const sendMock = mockMidiAccess.outputs.get('port1')!.send
    connection.send(new Uint8Array([0xF0, 0x00, 0x03, 0x45, 0x7A, 0x49, 0xF7]))
    expect(sendMock).toHaveBeenCalledWith(
      new Uint8Array([0xF0, 0x00, 0x03, 0x45, 0x7A, 0x49, 0xF7])
    )
  })

  it('erkennt ACK (0x41 0x4B) nach send()', async () => {
    await connection.connect()
    
    // Simuliere eingehendes SysEx AK
    const ackPromise = connection.waitForAck(1000)
    connection.handleIncoming(new Uint8Array([0xF0, 0x00, 0x03, 0x45, 0x41, 0x4B, 0xF7]))
    
    await expect(ackPromise).resolves.toBe(true)
  })

  it('timeout wenn kein ACK kommt', async () => {
    await connection.connect()
    await expect(connection.waitForAck(100)).rejects.toThrow('ACK timeout')
  })

  it('sendet korrektes zI Ping', async () => {
    const sendSpy = vi.spyOn(connection, 'send')
    connection.ping()
    expect(sendSpy).toHaveBeenCalledWith(
      new Uint8Array([0xF0, 0x00, 0x03, 0x45, 0x7A, 0x49, 0xF7])
    )
  })
})
```

### 13.5 Component Tests

```typescript
// src/components/__tests__/Slider.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Slider } from '../Slider'

describe('Slider', () => {
  it('rendert mit Label und Wert', () => {
    render(<Slider label="Frequenz" value={440} min={20} max={8000} onChange={() => {}} />)
    expect(screen.getByText('Frequenz')).toBeDefined()
    expect(screen.getByText('440')).toBeDefined()
  })

  it('ruft onChange mit neuem Wert auf', () => {
    const onChange = vi.fn()
    render(<Slider label="Freq" value={440} min={20} max={8000} onChange={onChange} />)
    
    const input = screen.getByRole('slider')
    fireEvent.change(input, { target: { value: '880' } })
    
    expect(onChange).toHaveBeenCalledWith(880)
  })

  it('zeigt Einheit an wenn gegeben', () => {
    render(<Slider label="Frequenz" value={440} min={20} max={8000} unit="Hz" onChange={() => {}} />)
    expect(screen.getByText('Hz')).toBeDefined()
  })
})
```

```typescript
// src/components/__tests__/ConnectionPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConnectionPanel } from '../ConnectionPanel'

describe('ConnectionPanel', () => {
  it('zeigt Connect-Button wenn getrennt', () => {
    render(<ConnectionPanel connected={false} onConnect={vi.fn()} />)
    expect(screen.getByText(/connect/i)).toBeDefined()
  })

  it('zeigt Device-Name wenn verbunden', () => {
    render(
      <ConnectionPanel
        connected={true}
        deviceName="AMYboard v1"
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    )
    expect(screen.getByText(/AMYboard v1/)).toBeDefined()
  })

  it('ruft onConnect bei Klick', () => {
    const onConnect = vi.fn()
    render(<ConnectionPanel connected={false} onConnect={onConnect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onConnect).toHaveBeenCalledOnce()
  })
})
```

### 13.6 Integration: Modul → Wire → MIDI (End-to-End im Unit-Kontext)

```typescript
// src/modules/__tests__/oscillator.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OscillatorModule } from '../oscillator'

describe('OscillatorModule', () => {
  const defaultProps = {
    id: 0,
    params: { wave: 'SINE', freq: 440, amp: 0.8, pan: 0.5 },
    onParamChange: vi.fn(),
    onSendWire: vi.fn()
  }

  it('rendert mit Default-Parametern', () => {
    render(<OscillatorModule {...defaultProps} />)
    expect(screen.getByText('OSC 0')).toBeDefined()
    expect(screen.getByText('SINE')).toBeDefined()
  })

  it('sendet Wire Message bei Parameter-Änderung', () => {
    const onSendWire = vi.fn()
    render(<OscillatorModule {...defaultProps} onSendWire={onSendWire} />)
    
    // Wellenform ändern
    fireEvent.change(screen.getByLabelText(/waveform/i), { target: { value: 'SAW_DOWN' } })
    
    // onParamChange sollte mit neuen Werten aufgerufen werden
    expect(defaultProps.onParamChange).toHaveBeenCalled()
  })
})
```

### 13.7 State-Management Tests

```typescript
// src/stores/__tests__/patch-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { usePatchStore } from '../patch-store'

describe('patchStore', () => {
  beforeEach(() => {
    usePatchStore.setState({ patches: [], selectedId: null })
  })

  it('speichert neuen Patch', () => {
    usePatchStore.getState().addPatch({
      id: '1',
      name: 'Mein Bass',
      author: 'User',
      category: 'user',
      tags: ['bass', 'analog'],
      state: { oscillators: [], synths: [], effects: [], envelopes: [], modulation: [] },
      wireCommands: ['v0w2f110Z'],
      created: Date.now(),
      modified: Date.now()
    })

    const state = usePatchStore.getState()
    expect(state.patches).toHaveLength(1)
    expect(state.patches[0].name).toBe('Mein Bass')
  })

  it('löscht Patch nach id', () => {
    const store = usePatchStore.getState()
    store.addPatch({
      id: '1',
      name: 'Test',
      author: 'User',
      category: 'user',
      tags: [],
      state: { oscillators: [], synths: [], effects: [], envelopes: [], modulation: [] },
      wireCommands: [],
      created: Date.now(),
      modified: Date.now()
    })
    
    usePatchStore.getState().deletePatch('1')
    expect(usePatchStore.getState().patches).toHaveLength(0)
  })

  it('findet Patches nach Kategorie', () => {
    const store = usePatchStore.getState()
    store.addPatch({ id: '1', name: 'JunoPad', category: 'juno', /* ... */ } as any)
    store.addPatch({ id: '2', name: 'DXBell', category: 'dx7', /* ... */ } as any)
    
    const junoPatches = usePatchStore.getState().getByCategory('juno')
    expect(junoPatches).toHaveLength(1)
    expect(junoPatches[0].name).toBe('JunoPad')
  })
})
```

### 13.8 Modul-Registry Tests

```typescript
// src/modules/__tests__/module-registry.test.ts
import { describe, it, expect } from 'vitest'
import { moduleRegistry } from '../index'

describe('moduleRegistry', () => {
  it('registriert alle Phase-1 Module', () => {
    const modules = moduleRegistry.list()
    expect(modules.length).toBeGreaterThanOrEqual(6)
    
    const oscillator = moduleRegistry.get('oscillator')
    expect(oscillator).toBeDefined()
    expect(oscillator?.category).toBe('source')
  })

  it('erzeugt korrekte Default-Parameter', () => {
    const defaults = moduleRegistry.getDefaults('oscillator')
    expect(defaults.wave).toBe('SINE')
    expect(defaults.freq).toBe(440)
  })

  it('erzeugt Wire-Message aus Parametern', () => {
    const wire = moduleRegistry.toWire('oscillator', {
      osc: 0, wave: 'SINE', freq: 440, amp: 1
    })
    expect(wire).toBe('v0w0f440a1Z')
  })
})
```

### 13.9 Test-Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**']
    }
  }
})
```

```typescript
// src/test-setup.ts
import '@testing-library/jest-dom'

// WebMIDI Mock global
class MockMIDIAccess {
  inputs = new Map()
  outputs = new Map()
  onstatechange: ((e: Event) => void) | null = null
}

class MockMIDIOutput {
  send = vi.fn()
  onstatechange: ((e: Event) => void) | null = null
}

// Globalen Mock setzen (nur wenn nicht verfügbar)
if (typeof navigator !== 'undefined' && !navigator.requestMIDIAccess) {
  ;(navigator as any).requestMIDIAccess = vi.fn()
}
```

### 13.10 Run-Commands

```bash
# Alle Tests
npm run test          # vitest

# Watch Mode (während Entwicklung)
npm run test:watch    # vitest --watch

# Coverage Report
npm run test:coverage # vitest --coverage

# Ein bestimmtes File testen
npx vitest src/lib/__tests__/amy-protocol.test.ts

# CI-Mode (einmalig, ohne Watch)
npm run test:ci       # vitest run
```

### 13.11 CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run test:ci
      - run: npm run test:coverage
```

---

## 14. Projekt-Stru

```
amylive/
├── public/
│   ├── index.html
│   ├── manifest.json          # PWA Manifest
│   └── sw.js                  # Service Worker
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── lib/
│   │   ├── amy-connection.ts  # WebMIDI + SysEx
│   │   ├── amy-protocol.ts    # Wire-Format Generator
│   │   ├── amy-constants.ts   # AMY Konstanten
│   │   └── state-dump.ts      # zDZ Parser
│   │
│   ├── modules/
│   │   ├── index.ts           # Modul-Registry
│   │   ├── oscillator.tsx
│   │   ├── filter.tsx
│   │   ├── envelope.tsx
│   │   ├── lfo.tsx
│   │   ├── mod-matrix.tsx
│   │   ├── synth.tsx
│   │   ├── fx-rack.tsx
│   │   ├── mixer.tsx
│   │   ├── midi-pads.tsx
│   │   └── sequencer.tsx
│   │
│   ├── components/
│   │   ├── ConnectionPanel.tsx
│   │   ├── ModuleCanvas.tsx     # Drag&Drop Grid
│   │   ├── ModuleWrapper.tsx    # Kachel-Rahmen
│   │   ├── Slider.tsx
│   │   ├── Knob.tsx
│   │   ├── WaveformSelector.tsx
│   │   ├── ModuleLibrary.tsx    # [+] Button + Dropdown
│   │   └── PatchLibrary.tsx
│   │
│   ├── hooks/
│   │   ├── useAMY.ts           # WebMIDI Hook
│   │   └── useModuleCanvas.ts  # Canvas Layout State
│   │
│   ├── stores/
│   │   ├── connection-store.ts # Zustand: MIDI State
│   │   ├── canvas-store.ts     # Zustand: Module auf Canvas
│   │   └── patch-store.ts      # Zustand: Patch Library
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Patches.tsx
│   │   ├── PatchEditor.tsx
│   │   ├── Modules.tsx
│   │   ├── MidiConfig.tsx
│   │   └── Settings.tsx
│   │
│   ├── types/
│   │   ├── amy.ts              # AMY Type-Definitionen
│   │   └── module.ts           # Modul-Interface
│   │
│   └── styles/
│       └── index.css           # Tailwind Imports
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── postcss.config.js
```
