# 🎵 BeatGen — MIDI Fixes: Planung

_Stand: 2026-08-08 18:45 CEST
Betrifft: Phase 1 (WebMIDI Permission) + Phase 3 (MIDI-Output) + Neues Feature (External Clock Sync)_

---

## 🔴 Problem 1: Web MIDI fragt nicht nach Permission

### Root Cause
`MidiEngine.init()` wird **NUR** in `SettingsPanel.jsx` aufgerufen — und das auch nur wenn `showSettings === true` (also wenn der User das Settings-Panel öffnet). Das passiert in `App.jsx` **nie** on mount.

```javascript
// SettingsPanel.jsx Zeile ~73
useEffect(() => {
  if (showSettings) {  // ← NUR wenn Panel offen!
    initMidi()
  }
}, [showSettings, initMidi])
```

`App.jsx` hat keinen `useEffect` der `midiEngine.init()` beim App-Start aufruft. Das `Header.jsx` zeigt zwar "No Device" an und `webMidiSupported` prüft `!!navigator.requestMIDIAccess` — aber die Permission wird nie angefragt.

Resultat: User öffnet die Seite → "No Device" Badge → keine Browser-Permission-Prompt. Erst wenn er manuell Settings öffnet, geht der Prompt auf.

### Fix: MIDI-Init in App.jsx beim Mount

**Änderung in `App.jsx`:**

1. `useEffect` hinzufügen der `midiEngine.init()` sofort nach Mount aufruft
2. Optional: Soft-Init (versuchen, silent failen), dann "Connect MIDI" Button anbieten falls Browser User-Gesture braucht
3. Store aktualisieren nach erfolgreicher Init (devices, connected status)

```javascript
// In App.jsx, neuer useEffect:
useEffect(() => {
  const initMidi = async () => {
    const result = await midiEngine.init()
    if (result.success) {
      useStore.getState().setMidiAccess(midiEngine.access)
      useStore.getState().setMidiDevices(result.devices)
    }
  }
  initMidi()
}, [])
```

**Fallback für Browser die User-Gesture brauchen:**
- Wenn `init()` fehlschlägt → Status im Store merken
- `Header.jsx` zeigt dann "Connect MIDI" Button statt "No Device"
- Button-Klick re-triggert `midiEngine.init()` (ist dann eine User-Gesture)

**Dateien die geändert werden müssen:**
| Datei | Änderung |
|-------|----------|
| `src/App.jsx` | useEffect für MIDI-Init on mount, onDevicesChange Callback, Store-Sync |
| `src/components/Header.jsx` | "Connect MIDI" Button wenn init fehlgeschlagen (statt nur "No Device") |
| `src/components/SettingsPanel.jsx` | Redundante init-Logik entfernen (wird jetzt von App.jsx gemacht), nur noch State anzeigen |

**Test nach Fix:**
1. `agent-browser open https://beatgen.steppa.online`
2. Erwartet: Browser zeigt Permission-Dialog "beatgen.steppa.online wants to use MIDI devices"
3. Nach Erlauben: Grüner MIDI-Status in Header, Devices in Settings sichtbar

---

## 🔴 Problem 2: BPM External Clock Sync via Web MIDI

### Root Cause
Der `MidiScheduler` arbeitet aktuell **ausschließlich** mit einem internen Timer (`performance.now()` + `_calcStepDuration(bpm)`). Es gibt keinerlei Code der MIDI **Input** Messages verarbeitet — weder `MidiEngine.js` noch `MidiScheduler.js` hören auf MIDI-Clock-Signale.

`MidiEngine.js` hat nur Output-Logik (`noteOn`, `noteOff`, `sendCC`). Kein `requestMIDIAccess` mit Input-Ports, kein MIDI-Message-Listener.

### Was muss gebaut werden

#### 2.1 MIDI Clock Protocol Basics

MIDI Clock wird über System-Realtime-Messages übertragen:
- **0xF8** — Timing Clock (24 pulses per quarter note / PPQN)
- **0xFA** — Start
- **0xFB** — Continue
- **0xFC** — Stop
- **0xF2** — Song Position Pointer (14-bit, in "MIDI beats" = 16th notes)

24 PPQN = 24 Clock-Pulse pro Viertelnote. Bei 4/4-Takt:
- 1 Beat = 24 Clocks
- 1 Step (16tel) = 6 Clocks
- BPM = 60 / (Durchschnitt-Abstand-zwischen-24-Clock-Pulses in Sekunden)

#### 2.2 Architektur-Änderung

```
┌──────────────────────────────────────────────────┐
│                 MidiEngine.js                      │
│  NEU: MIDI Input Ports, onMIDIMessage Callback    │
│  NEU: System Realtime Message Parser (0xF8-0xFF) │
└──────────────────┬───────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  MidiClockParser    │ ← NEUE Datei
         │  - Erkennt Clock    │
         │  - Berechnet BPM    │
         │  - Start/Stop/Cont. │
         │  - Song Pos Pointer  │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  MidiScheduler.js   │
         │  NEU: clockSource:  │
         │   'internal'|'midi' │
         │  NEU: External Mode  │
         │   → Clock-getrieben  │
         │   statt timer-getr. │
         └──────────────────────┘
```

#### 2.3 Datei-Änderungen im Detail

---

### Datei: `src/midi/MidiClockParser.js` (NEU)

**Zweck:** MIDI System-Realtime-Messages parsen und BPM + Transport-Status extrahieren.

```javascript
class MidiClockParser {
  constructor() {
    this.bpm = 0
    this.isRunning = false
    this.clockCount = 0           // Zählt 0-23 (24 PPQN)
    this.lastClockTime = 0        // performance.now() des letzten Clocks
    this.clockIntervals = []      // Letzte 24 Intervalle für BPM-Berechnung
    this.onClock = null           // (step16th) => void — fired alle 6 clocks
    this.onStart = null
    this.onStop = null
    this.onContinue = null
    this.onBpmChange = null       // (newBpm) => void
  }

  /**
   * Verarbeitet eine MIDI-Message (1 Byte system realtime)
   * Wird von MidiEngine.onMIDIMessage aufgerufen
   */
  handleMessage(statusByte) {
    switch (statusByte) {
      case 0xF8: // Timing Clock
        this._handleClock()
        break
      case 0xFA: // Start
        this.isRunning = true
        this.clockCount = 0
        this.onStart?.()
        break
      case 0xFB: // Continue
        this.isRunning = true
        this.onContinue?.()
        break
      case 0xFC: // Stop
        this.isRunning = false
        this.clockCount = 0
        this.onStop?.()
        break
    }
  }

  _handleClock() {
    const now = performance.now()
    this.clockCount++

    // BPM aus Clock-Intervallen berechnen
    if (this.lastClockTime > 0) {
      const interval = now - this.lastClockTime
      this.clockIntervals.push(interval)
      if (this.clockIntervals.length > 24) {
        this.clockIntervals.shift()
      }
      // Durchschnitt der letzten 24 Intervalle = 1 Beat
      if (this.clockIntervals.length >= 6) {
        const avgInterval = this.clockIntervals.reduce((a, b) => a + b, 0) / this.clockIntervals.length
        const newBpm = Math.round(60000 / (avgInterval * 24))
        if (Math.abs(newBpm - this.bpm) > 1) { // Hysterese
          this.bpm = newBpm
          this.onBpmChange?.(newBpm)
        }
      }
    }
    this.lastClockTime = now

    // Alle 6 Clocks = 1 Sechzehntel-Step
    if (this.clockCount >= 6) {
      this.clockCount = 0
      this.onClock?.()
    }
  }

  reset() {
    this.bpm = 0
    this.isRunning = false
    this.clockCount = 0
    this.clockIntervals = []
    this.lastClockTime = 0
  }

  destroy() {
    this.onClock = null
    this.onStart = null
    this.onStop = null
    this.onContinue = null
    this.onBpmChange = null
  }
}

export default MidiClockParser
```

---

### Datei: `src/midi/MidiEngine.js` (ÄNDERN)

**Zweck:** MIDI Input Ports hinzufügen, Clock-Messages erkennen und an den Parser weiterleiten.

**Neue Properties:**
```javascript
this.input = null             // Selected MIDI input
this.inputDevices = []        // Liste verfügbarer Input-Ports
this.onMessage = null         // Callback für alle MIDI Messages
this.onClockMessage = null    // Callback speziell für System Realtime (0xF8-0xFF)
```

**Neue Methoden:**

1. `selectInputDevice(deviceId)` — Input-Port selektieren und MIDI-Message-Listener registrieren
2. `_handleMidiMessage(event)` — MIDI Message Event Handler:
   ```javascript
   _handleMidiMessage(event) {
     const data = event.data
     // System Realtime Messages sind 1 Byte (Status-Only)
     if (data[0] >= 0xF8) {
       this.onClockMessage?.(data[0])
     }
     this.onMessage?.(event)
   }
   ```
3. `_refreshDevices()` erweitern → Inputs ebenfalls auflisten (`this.access.inputs`)
4. `init()` — `requestMIDIAccess` Request: zusätzliche Input-Logik
5. `silenceAllOnInputStart()` — Safety: Input Start triggert Silence

**Geänderte `_refreshDevices()`:**
```javascript
_refreshDevices() {
  if (!this.access) return
  // Outputs (wie vorher)
  this.devices = []
  this.access.outputs.forEach((output, id) => {
    this.devices.push({ id, name: output.name || `MIDI Out ${id}`, ... })
  })
  
  // Inputs (NEU)
  this.inputDevices = []
  this.access.inputs.forEach((input, id) => {
    this.inputDevices.push({ id, name: input.name || `MIDI In ${id}`, ... })
  })
  
  this.onDevicesChange?.(this.devices)
}
```

---

### Datei: `src/store/useStore.js` (ÄNDERN)

**Neue State-Felder:**
```javascript
// MIDI Clock Sync
clockSource: 'internal',      // 'internal' | 'midi'
midiInputDevices: [],         // Verfügbare Input-Ports
midiInput: null,              // Ausgewähltes Input-Device
externalBpm: 0,               // Vom Master ermitteltes BPM (read-only)
isExternalRunning: false,     // Ob der Master-Transport läuft
```

**Neue Actions:**
```javascript
setClockSource: (source) => set({ clockSource: source }),
setMidiInputDevices: (devices) => set({ midiInputDevices: devices }),
setMidiInput: (input) => set({ midiInput: input }),
setExternalBpm: (bpm) => set({ externalBpm: bpm }),
setIsExternalRunning: (running) => set({ isExternalRunning: running }),
```

---

### Datei: `src/midi/MidiScheduler.js` (ÄNDERN)

**Zweck:** Dual-Mode Scheduling: intern (Timer-basiert, wie vorher) und extern (Clock-getrieben).

**Neue Properties:**
```javascript
this.clockSource = 'internal'        // 'internal' | 'midi'
this.clockParser = null              // MidiClockParser Instanz
this._isExternalClockRunning = false // Transport-Status vom Master
```

**Neue Methode `_onExternalStep()`:**
Wenn via MIDI Clock:
- `this.nextStepIndex++`
- `this.currentStep = this.nextStepIndex % 16` (oder `this.nextStepIndex`, wird bei Bar-End ggf. auf 0 zurückgesetzt)
- Pattern-Events für diesen Step sofort feuern (kein setTimeout nötig — der Clock-Puls ist das Timing)
- Bei Step 0: Bar-Logik (Pattern-Regeneration, onBarEnd Callback)

**Geänderte `start()`:**
- `clockSource === 'midi'` → Kein internes Scheduling starten, auf Clock-Events warten
- `_onExternalStep` an `clockParser.onClock` binden
- Scheduler lauscht auf `clockParser.onStart` / `onStop`

**Neue Methode `setClockSource(source)`:**
- Wechselt zwischen internal/midi
- Bei Wechsel: Alten Modus sauber stoppen

**Geänderte `stop()`:**
- Auch externe Clock-Verbindung trennen

**External Sync Verhalten:**
- BPM-Display: zeigt `externalBpm` (aus Clock berechnet), nicht editierbar
- Transport: Play/Stop Button ist deaktiviert oder zeigt "Waiting for MIDI Clock..."
- Wenn Master Start sendet (0xFA) → Scheduler beginnt Steps zu spielen
- Wenn Master Stop sendet (0xFC) → Scheduler stoppt, Noten off
- Clock-Source bleibt synchron: Jeder 6. Clock-Puls = nächster Step

---

### Datei: `src/App.jsx` (ÄNDERN)

**Neue Wiring für Clock Sync:**

```javascript
useEffect(() => {
  // MIDI init (siehe Problem 1)
  initMidi()

  // Clock Parser Setup
  const clockParser = new MidiClockParser()

  // Clock Messages von MidiEngine an Parser routen
  midiEngine.onClockMessage = (statusByte) => {
    clockParser.handleMessage(statusByte)
  }

  // BPM vom Master → Store
  clockParser.onBpmChange = (newBpm) => {
    useStore.getState().setExternalBpm(newBpm)
  }

  // Transport vom Master → Scheduler
  clockParser.onStart = () => {
    useStore.getState().setIsExternalRunning(true)
    if (schedulerRef.current?.clockSource === 'midi') {
      const pattern = generatePattern()
      schedulerRef.current.startExternal(pattern, bpm, tracks)
    }
  }

  clockParser.onStop = () => {
    useStore.getState().setIsExternalRunning(false)
    schedulerRef.current?.stop()
  }

  // Clock → Step
  clockParser.onClock = () => {
    if (schedulerRef.current?.clockSource === 'midi') {
      schedulerRef.current._onExternalStep()
    }
  }

  // Cleanup
  return () => {
    midiEngine.onClockMessage = null
    clockParser.destroy()
  }
}, [])
```

---

### Datei: `src/components/SettingsPanel.jsx` (ÄNDERN)

**Neue UI für Clock Sync:**

1. **Clock Source Toggle** (oberhalb von Channel Mapping):
   ```
   ┌──────────────────────────────────┐
   │  🕐 Clock Source                  │
   │  [ Internal ] [ MIDI (External) ] ← Pill-Toggle
   └──────────────────────────────────┘
   ```

2. **MIDI Input Select** (nur sichtbar wenn Clock Source = MIDI):
   ```
   ┌──────────────────────────────────┐
   │  MIDI Input                      │
   │  [ TR-8S (Dropdown)         ▾ ]  │
   │  Status: Waiting for clock...     │
   │  External BPM: --                 │
   └──────────────────────────────────┘
   ```

3. **MIDI Output bleibt bestehend** (für Note-Events, wie vorher)

---

### Datei: `src/components/TransportBar.jsx` (ÄNDERN)

**Neue UI-Elemente:**

1. **Clock Source Indicator** (neben BPM):
   - Internal: BPM editierbar, normaler Play/Stop
   - External: BPM zeigt `externalBpm` vom Store, "EXT" Badge, Play/Stop disabled oder umlabelt zu "Waiting..."

2. **MIDI Transport Status:**
   ```
   [EXT ▸ 128 BPM] [⏸ Waiting] [Preset ▾]
   ```

---

## 📋 Änderungs-Übersicht

| Datei | Aktion | Änderungen |
|-------|--------|------------|
| `src/midi/MidiClockParser.js` | **NEU** | MIDI Clock Protocol Parser (0xF8/FA/FB/FC/F2) |
| `src/midi/MidiEngine.js` | ÄNDERN | Input Ports, `onClockMessage` Callback, `selectInputDevice()` |
| `src/store/useStore.js` | ÄNDERN | `clockSource`, `midiInputDevices`, `midiInput`, `externalBpm`, `isExternalRunning` + Actions |
| `src/midi/MidiScheduler.js` | ÄNDERN | Dual-Mode (internal/external), `_onExternalStep()`, `setClockSource()` |
| `src/App.jsx` | ÄNDERN | MIDI-Init on mount, MidiClockParser Wiring, Clock→Scheduler Bridge |
| `src/components/Header.jsx` | ÄNDERN | "Connect MIDI" Button-Fallback, Clock-Source Badge |
| `src/components/SettingsPanel.jsx` | ÄNDERN | Clock Source Toggle, MIDI Input Select, Redundante Init-Logik entfernen |
| `src/components/TransportBar.jsx` | ÄNDERN | External BPM Display (read-only), EXT Badge, Transport-Status |

**Keine Änderungen an:** Pattern-Engine, Genre-Library, Mood-Processor, Velocity-Curves, alle Utils. Die MIDI-Fixes sind isoliert zum Engine-Core.

---

## 🧪 Test-Szenarien

### Test 1: WebMIDI Permission
1. Seite neu laden → Browser fragt nach MIDI-Berechtigung
2. "Erlauben" → Grüner MIDI-Status im Header
3. "Blockieren" → "No MIDI" Badge, App funktioniert trotzdem (Pattern sichtbar)

### Test 2: Internal Clock (unverändert)
1. Clock Source = Internal, BPM = 120, Play drücken
2. Step-Sequencer läuft, MIDI-Noten werden gesendet
3. BPM live ändern → Timing passt sich an

### Test 3: External Clock — Verbindung
1. Settings → Clock Source = "MIDI (External)"
2. MIDI Input Dropdown zeigt verfügbare Input-Ports
3. TR-8S (oder anderes Master-Device) auswählen
4. Transport zeigt "Waiting for MIDI Clock..."

### Test 4: External Clock — Playback
1. Master-Device startet (z.B. TR-8S Play drücken)
2. BeatGen beginnt synchron zum Master zu spielen
3. Step-Sequencer läuft im Takt des Masters
4. BPM-Anzeige zeigt das vom Master ermittelte BPM

### Test 5: External Clock — Stop/Continue
1. Master stoppt → BeatGen stoppt, alle Noten off
2. Master startet neu → BeatGen synchronisiert sich, spielt weiter

### Test 6: Clock Source Wechsel während Playback
1. Internal Mode, läuft → Wechsel zu External → stoppt, wartet auf Clock
2. External Mode, läuft → Wechsel zu Internal → stoppt (Safety, kein Auto-Play)

---

## ⏱️ Geschätzter Aufwand

| Task | Dauer | Prio |
|------|-------|------|
| WebMIDI Permission Fix | ~30 Min | 🔴 HIGH |
| MidiClockParser (neue Datei) | ~45 Min | 🔴 HIGH |
| MidiEngine Input-Erweiterung | ~30 Min | 🔴 HIGH |
| MidiScheduler Dual-Mode | ~1h | 🔴 HIGH |
| Store-Erweiterungen | ~15 Min | 🔴 HIGH |
| App.jsx Wiring | ~30 Min | 🔴 HIGH |
| UI: Settings Panel Clock-Sync | ~30 Min | 🟡 MED |
| UI: Transport Bar External Mode | ~30 Min | 🟡 MED |
| UI: Header Connect-Button | ~15 Min | 🟡 MED |
| Testing & Debugging | ~1h | 🔴 HIGH |
| Build & Deploy | ~15 Min | 🔴 HIGH |
| **Gesamt** | **~5-6h** | |

---

## ⚠️ Risiken

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| `requestMIDIAccess` braucht User-Gesture | Medium | Fallback: Button anzeigen der init() mit User-Gesture triggert |
| MIDI Clock Jitter (>2ms) | Medium | Clock-Parser averaged über 24 Intervalle, Hysterese 1 BPM |
| Clock-Drift bei langen Sessions | Low | Clock-Parser läuft passiv, kein eigener Timer der driften kann |
| Input-Port hat kein Clock-Signal | High | Timeout-Logik: nach 2s ohne Clock "No Clock Signal" anzeigen |
| Master sendet kein Start/Stop | Medium | Safety: auch ohne Start bei Clock-Erkennung starten (Auto-Start Mode configurable) |

---

_Erstellt: 2026-08-08 18:45 CEST | Status: PLANUNG_