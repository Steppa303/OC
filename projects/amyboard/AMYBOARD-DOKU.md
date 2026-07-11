# AMYboard – Modulare Synthesizer Integration

> Projekt: AMYboard ins Modular-System einbauen & programmieren
> Letztes Update: 2026-07-11 v3
> **Quantizer/Remote/Deployment:** Siehe `REMOTE-DEBUG.md`
> **Web Frontend (amylive):** Siehe `amylive.md` + `amylive/` Src
> Quellen: shorepine/tulipcc + shorepine/amy @ GitHub

---

## 1. AMYboard Übersicht

**Board:** ESP32-S3 basiert, $29, läuft MicroPython.
**Audio Engine:** AMY (Open-Source Synth, 180 Oszillatoren standardmäßig)

### Frontpanel Connectors (Top → Bottom, 10× 3.5mm)

| Connector | Beschreibung |
|-----------|-------------|
| S/PDIF in | Digitaler Audio-Eingang |
| S/PDIF out | Digitaler Audio-Ausgang |
| Line in | 3.5mm Stereo Analog-In (10Vpp via DIP Switch) |
| Line out | 3.5mm Stereo Analog-Out (10Vpp via DIP Switch) |
| MIDI in | 3.5mm TRS MIDI Type-A oder B |
| MIDI out | 3.5mm TRS MIDI Type-A/B (per Software umschaltbar) |
| CV1 in | Analog-Eingang, -10V bis +10V (ADS1115 ADC, 16-Bit) |
| CV1 out | Analog-Ausgang, -10V bis +10V (GP8413 DAC, 12-Bit) |
| CV2 in | Analog-Eingang, -10V bis +10V (ADS1115 ADC, 16-Bit) |
| CV2 out | Analog-Ausgang, -10V bis +10V (GP8413 DAC, 12-Bit) |

### Weitere Anschlüsse

| Connector | Position | Beschreibung |
|-----------|----------|-------------|
| USB-C | Seite | Power, Serial REPL, USB MIDI (Gadget Mode, NICHT Host), Firmware-Updates |
| I2C Front | Front | Grove Port für Accessoires (Encoder, Displays) |
| I2C Host | Rückseite | Für Tulip Creative Computer Verbindung (3.3V) |
| MicroSD | Seite | Speicher für Samples & Patches |
| Modular Power | Rückseite | 10-Pin Eurorack Stromversorgung |
| Debug Header | Rückseite | Für Firmware-Entwicklung |

### Stromversorgung (3 Wege)
1. **USB-C** – 5V Standard
2. **Modular 10-Pin** – +12V über Eurorack-Busboard
3. **I2C Host** – 3.3V über Grove Connector (z.B. Tulip CC)

→ Nutzt automatisch die höchste verfügbare Spannung.

### DIP Switches (Rückseite, 4 Stück)

| Setting | Audio In/Out Pegel |
|---------|-------------------|
| **ALL ON** (→ Richtung Optoisolator) | Line Level (1Vpp, Kopfhörer/Mixer/Audio-Interface) |
| **ALL OFF** (→ Richtung 10-Pin Power) | **Eurorack 10Vpp** (Modular-Synth-Pegel) |

- Switch 1 & 2 (Input): Dämpfen Line-In auf Eurorack-Pegel
- Switch 3 & 4 (Output): Erhöhen Line-Out Gain auf Eurorack-Pegel

---

## 2. AMY Synth Engine – Architektur

### Hierarchie

```
AMY (Engine)
├── Oszillatoren (180 Stk, konfigurierbar via amy_config.max_oscs)
│   ├── Waveform, Frequenz, Amplitude, Phase, Duty
│   ├── Filter (LPF/BPF/HPF/LPF24), Resonance
│   ├── CtrlCoefs (Frequenz, Amp, Filter, Duty, Pan)
│   ├── 2× Envelope Generators (breakpoint-basiert)
│   └── Mod Source (LFO/modulierender Oszillator)
├── Voices (Gruppe von Oszillatoren = eine Stimme)
│   └── z.B. Juno-6: 5 Oszillatoren pro Voice
└── Synths (Managed Voice Allocation)
    ├── Patch Nummer zuweisen
    ├── Voice-Stealing bei Überlast
    └── MIDI-Channel-Mapping
```

### Built-In Patches

| Bereich | Typ |
|---------|-----|
| 0–127 | Juno-6 (analog emuliert) |
| 128–255 | DX7 (FM) |
| 256 | Piano |
| 257+ | PCM Drum Kits |
| 1024–1055 | User Patches (RAM, runtime erstellbar) |

### Patch/Synth Grundlagen

```python
import amy

# Synth mit Patch initialisieren
amy.send(synth=1, num_voices=4, patch=0)   # 4-voice Juno patch #0
amy.send(synth=2, num_voices=4, patch=129)  # 4-voice DX7 patch #1

# Noten spielen
amy.send(synth=1, note=60, vel=1)   # C4 an
amy.send(synth=1, note=64, vel=1)   # E4 an
amy.send(synth=1, note=60, vel=0)   # C4 aus
amy.send(synth=1, vel=0)            # Alle Noten aus (note-off ohne Note)

# Voice-Stealing: Wenn alle Voices belegt sind, wird die älteste gestohlen
amy.send(synth=0, num_voices=3, patch=1)
amy.send(synth=0, note=60, vel=1)   # Voice 0
amy.send(synth=0, note=64, vel=1)   # Voice 1
amy.send(synth=0, note=67, vel=1)   # Voice 2
amy.send(synth=0, note=70, vel=1)   # → steal Voice 0 (note 60)

# Patch wechseln (Synth bleibt multi-voice)
amy.send(synth=1, patch=13)  # Juno patch #13 auf Synth 1

# Synth freigeben
amy.send(synth=1, num_voices=0)

# Drum Synth (MIDI GM)
amy.send(synth=10, num_voices=3, patch_string='w7f0Z', synth_flags=3)
amy.send(synth=10, note=40, vel=1)  # Electric Snare
```

### User Patches (Runtime)

```python
# Patch im RAM erstellen (IDs 1024–1055)
amy.send(patch=1024, reset=amy.RESET_PATCH)
amy.send(patch=1024, osc=1, wave=amy.SINE, freq=0.25, phase=0.5, amp=0.5)
amy.send(patch=1024, osc=0, wave=amy.SINE, freq='440,1,0,0,0,1', 
         bp0='0,1,500,0,0,0', mod_source=1)

# Synth damit initialisieren
amy.send(synth=0, num_voices=1, patch=1024)
amy.send(synth=0, vel=2, note=50)
```

Alternative: Direkt via Synth (ohne Patch):

```python
amy.send(synth=0, num_voices=1, oscs_per_voice=2)
amy.send(synth=0, osc=1, wave=amy.SINE, freq=0.25, phase=0.5, amp=0.5)
amy.send(synth=0, osc=0, wave=amy.SINE, freq='440,1,0,0,0,1', 
         bp0='0,1,500,0,0,0', mod_source=1)
amy.send(synth=0, vel=2, note=50)
```

---

## 3. Control Coefficients (CtrlCoefs) – Das Herz der Modulation

CtrlCoefs sind AMY's Art, Parameter durch verschiedene Signalquellen zu steuern – analog zu den Slidern auf einem SH-101.

### Parameter die CtrlCoefs akzeptieren
`amp`, `freq`, `filter_freq`, `duty`, `pan`

### Signalquellen (Position im Array)

| Index | Name | Beschreibung |
|-------|------|-------------|
| 0 | `const` | Konstanter Wert (1×) |
| 1 | `note` | MIDI-Note (Freq in Unit-per-Octave relativ zu Middle C) |
| 2 | `vel` | Velocity vom Note-On |
| 3 | `eg0` | Envelope Generator 0 Output |
| 4 | `eg1` | Envelope Generator 1 Output |
| 5 | `mod` | Modulierender Oszillator (mod_source) Output |
| 6 | `bend` | Pitch Bend Wert |
| 7 | `ext0` | Externer Parameter (CV Input 1 oder Code) |
| 8 | `ext1` | Externer Parameter (CV Input 2 oder Code) |

### Syntax

```python
# Komma-separierter String (Positionen überspringen mit leerem Wert)
amy.send(osc=0, filter_freq='50,,,,1')  # const=50, eg1=1

# Python Dict (empfohlen, lesbarer)
amy.send(osc=0, filter_freq={'const': 50, 'eg1': 1})

# Frequenz-Tracking: freq='440,1' = Middle A, trackt MIDI-Note
# Standard freq = '440,1,0,0,0,0,1' (Note + Pitch Bend)

# Standard amp = '0,0,1,1,0,0,0' (Velocity × EG0)
# Achtung: amp multipliziert die Komponenten (statt Addition)!

# amp Sonderfall: Offset 1.0 wird zu mod/bend addiert vor Multiplikation
# → ermöglich Tremolo ohne DC-Offset
```

### LFO / Modulation Beispiel

```python
amy.reset()
# LFO Oszillator (kein vel → hörbar, aber als Mod Source verwendet)
amy.send(osc=1, wave=amy.SINE, freq=0.5, amp=1)
# Modulierter Oszillator
amy.send(osc=0, wave=amy.PULSE, 
         duty={'const': 0.5, 'mod': 0.4},  # PWM depth
         mod_source=1)
amy.send(osc=0, note=60, vel=0.5)

# Multi-Modulation (Freq + Duty gleichzeitig)
amy.send(osc=1, wave=amy.TRIANGLE, freq=5, amp=1)
amy.send(osc=0, wave=amy.PULSE,
         duty={'const': 0.5, 'mod': 0.25},
         freq={'mod': 0.5},
         mod_source=1)
```

---

## 4. Envelope Generators (EG0 & EG1)

2 Envelopes pro Oszillator. Breakpoint-basiert (ähnlich ADSR aber flexibler).

```python
# bp0 = EG0: Zeit(ms),Wert-Paare
# Letztes Paar = Release (startet bei Note-Off)

# ADSR: Attack 50ms → 1.0, Decay 100ms → 0.5 (Sustain), Release 250ms → 0
amy.send(osc=0, bp0='50,1,100,0.5,250,0')

# Nur Release definieren (Attack/Decay lassen)
amy.send(osc=0, bp0='0,1,300,0')  # sofort 1, dann 300ms Release

# EG Typen
# 0 = Normal (RC-like)
# 1 = Linear
# 2 = DX7-style
# 3 = True Exponential
amy.send(osc=0, eg0_type=0, eg1_type=2)

# EG an CtrlCoef-Parameter anbinden
amy.send(osc=0, amp={'const': 0, 'vel': 0, 'eg0': 1},  # Amp nur von EG0
         bp0='0,1,200,0.5,500,0')  # ADSR
```

---

## 5. Sequencer & Timing

### Zeitbasierte Events

```python
start = amy.millis()
amy.send(osc=0, note=50, vel=1, time=start)
amy.send(osc=0, note=52, vel=1, time=start + 1000)  # exakt 1s später
```

### Tick-basierter Sequencer

- Tempo: 108 BPM default, änderbar via `amy.send(tempo=120)`
- 48 PPQ (Pulses Per Quarter Note)
- Ticks: `48 * BPM / 60` pro Sekunde

```python
# Einmaliges Event zu Tick 100
amy.send(synth=1, note=60, vel=1, sequence='100,0,1')

# Wiederholendes Event (jede Viertelnote)
# period=48 = 1 Quarter Note bei 48 PPQ
amy.send(synth=1, note=36, vel=1, sequence='0,48,2')  # Kick jede Viertel

# 16-Step Drum Machine (Achtelnoten)
# period = 16 Steps × 24 Ticks = 384
for step in range(16):
    tick_offset = step * 24
    # Kick on 1, 5, 9, 13
    if step % 4 == 0:
        amy.send(synth=10, note=36, vel=1, sequence=f'{tick_offset},384,{step+100}')
    # Snare on 5, 13
    if step in [4, 12]:
        amy.send(synth=10, note=38, vel=1, sequence=f'{tick_offset},384,{step+200}')
    # Hihat every 8th
    amy.send(synth=10, note=42, vel=1, sequence=f'{tick_offset},384,{step+300}')
```

**tag** muss eindeutig sein (z.B. inkrementierende ID) → erlaubt späteres Ersetzen/Löschen.

---

## 6. Waveforms & Oszillatoren

| Wave | Wert | Beschreibung |
|------|------|-------------|
| `amy.SINE` | 0 | Sinus |
| `amy.PULSE` | 1 | Puls/Rechteck (duty cycle steuerbar) |
| `amy.SAW_DOWN` | 2 | Sägezahn abwärts |
| `amy.SAW_UP` | 3 | Sägezahn aufwärts |
| `amy.TRIANGLE` | 4 | Dreieck |
| `amy.NOISE` | 5 | Rauschen |
| `amy.KS` | 6 | Karplus-Strong |
| `amy.PCM` | 7 | Sample-Wiedergabe |
| `amy.ALGO` | 8 | DX7 FM Algorithmus |
| `amy.PARTIAL` | 9 | Partial/Obertöne |
| `amy.BYO_PARTIALS` | 10 | Eigene Partials |
| `amy.INTERP_PARTIALS` | 11 | Interpolierte Partials |
| `amy.AUDIO_IN0` | 12 | Audio Input L |
| `amy.AUDIO_IN1` | 13 | Audio Input R |
| `amy.AUDIO_EXT0` | 14 | External Audio 0 |
| `amy.AUDIO_EXT1` | 15 | External Audio 1 |
| `amy.AMY_MIDI` | 16 | MIDI-gesourct |
| `amy.PCM_LEFT` | 17 | PCM Left Channel |
| `amy.PCM_RIGHT` | 18 | PCM Right Channel |
| `amy.WAVETABLE` | 19 | Wavetable (16K Samples) |
| `amy.CUSTOM` | 20 | Custom C-Oszillator |
| `amy.OFF` | 21 | Aus |

### Filter

```python
amy.send(osc=0, filter_type=amy.FILTER_LPF,   # 1 = Lowpass
         filter_freq=5000, resonance=0.7)
# filter_type: 0=None, 1=LPF, 2=BPF, 3=HPF, 4=LPF24 (doppelter Lowpass)

# Mit CtrlCoefs
amy.send(osc=0, filter_freq={'const': 5000, 'eg1': 0.5, 'mod': 0.3},
         mod_source=1)
```

### Effekte (Global)

```python
# Reverb
amy.send(reverb='0.3,0.85,0.5,3000')  # level, liveness, damping, xover_hz

# Chorus
amy.send(chorus='0.2,320,0.5,0.5')  # level, delay, lfo_freq, depth

# Echo/Delay
amy.send(echo='0.3,200,1000,0.5,0')  # level, delay_ms, max_delay_ms, feedback, filter

# EQ (dB)
amy.send(eq='-3,0,2')  # low(~800Hz), mid(~2500Hz), high(~7500Hz), -15 bis +15

# Master Volume
amy.send(volume=0.8)  # 0–10
```

---

## 7. MIDI Integration

### Channel Setup

```python
# Synth 1 = MIDI Channel 1 (automatisch)
amy.send(synth=1, patch=0, num_voices=6)  # 6-voice Juno auf CH1

# Synth 2 = MIDI Channel 2
amy.send(synth=2, patch=129, num_voices=4)  # 4-voice DX7 auf CH2

# Grab MIDI Notes verhindern (wenn man MIDI selbst verarbeiten will)
amy.send(synth=1, grab_midi_notes=0)
```

### Supported MIDI Messages
- **Note On/Off** – Standard
- **Pitch Bend** – Global für ganze AMY-Instanz
- **Sustain Pedal** – CC 64 (per synth)
- **All Notes Off** – CC 123
- **Program Change** – Bank-abhängig (Juno: 0-127, DX7: 128-255)
- **MIDI CC** – Default: nur CC 70=filter_freq, 71=resonance (Juno Handler)

### Custom MIDI CC Mapping (via midi_cc)

```python
# Format: C=<cc_num>,L=<log>,N=<min>,X=<max>,O=<offset>,CMD=<wire_cmd>
# %i = channel, %v = value
amy.send(synth=1, midi_cc=[74, 0, 0, 127, 0, 'F%i,v0,%v0Z'])  # CC74 → filter_freq

# CC löschen
amy.send(synth=1, midi_cc=[74])  # Nur C mit keiner weiteren Args

# Alle CCs löschen
amy.send(synth=1, midi_cc=[255])
```

### MIDI Over SYSEX

AMY Wire Messages können als MIDI SYSEX gesendet werden:
- Manufacturer ID: `0x00 0x03 0x45`
- Wire Message in ASCII dazwischen
- Beispiel: `F0 00 03 45 v 0 f 4 4 0 l 1 F7` = `v0f440l1`

### MIDI Real-Time Clock

- `0xF8` (Timing Clock): 24 PPQ → AMY skaliert auf 48 PPQ (2 Ticks/Puls)
- `0xFA` (Start): Startet Sequencer bei Tick 0
- `0xFC` (Stop): Stoppt Sequencer (nur MIDI Start funktioniert dann wieder)

---

## 8. Modulare Integration (CV I/O)

### CV Output

```python
import amyboard

# Direkter Spannungsausgang
amyboard.cv_out(3.3, channel=0)   # CV Out 1 = 3.3V
amyboard.cv_out(-5.0, channel=1)  # CV Out 2 = -5V

# AMY Synth als CV Quelle routen (Audio wird stummgeschaltet!)
amy.send(synth=5, wave=amy.SAW_DOWN, vel=1, freq=0.5)
amyboard.set_cv_out(channel=0, synth=5)  # 0.5Hz Saw auf CV1

# CV Mapping löschen
amyboard.set_cv_out(channel=0, synth=0)

# Anwendungen:
# - 1V/Oct Pitch CV für externen Oszillator
# - LFOs als CV-Quelle
# - Envelopes als CV-Quelle
# - Sample & Hold in Python
```

### CV Input

```python
import amyboard

# Spannung lesen
volts = amyboard.cv_in(channel=0)         # CV In 1
print(f"CV: {volts:.2f}V")

# Raw ADC Wert
raw = amyboard.adc1115_raw(channel=0)

# Anwendungen:
# - Gate Detection → Note Trigger
# - CV → AMY Parameter Mapping
# - Sensor Input
```

### CV → AMY Parameter (CtrlCoefs mit ext0/ext1)

Der geilste Part: **CV direkt auf Synth-Parameter ohne Python-Loop**, über CtrlCoefs!

Formel für Frequenz-Parameter: `freq = const * 2^(ext0 * cv_voltage)`

```python
import amy

# Filter Cutoff durch CV1 gesteuert (1V/Oct Charakteristik)
# const=300 Hz bei 0V, ext0=0.15 → ca. 106–849 Hz bei ±10V
amy.send(synth=1, wave=amy.SAW_DOWN)
amy.send(synth=1, filter_freq={'const': 300, 'ext0': 0.15},
         filter_type=amy.FILTER_LPF24)
amy.send(synth=1, vel=1, note=48)

# Für exakten 100–1000 Hz Sweep (±10V):
# const = sqrt(100 * 1000) ≈ 316
# ext0 = log2(1000/316) / 10 ≈ 0.166
amy.send(synth=1, filter_freq={'const': 316, 'ext0': 0.166},
         filter_type=amy.FILTER_LPF24)

# Weiter Sweep (50–5000 Hz):
amy.send(synth=1, filter_freq={'const': 500, 'ext0': 0.33},
         filter_type=amy.FILTER_LPF24)
```

### Python CV Loop (Polling)

```python
import amy, amyboard, time

amy.reset()
amy.send(osc=0, wave=amy.SINE, vel=1)

for _ in range(100):
    v = amyboard.cv_in(channel=0)
    freq = 100 + ((v + 10) / 20.0) * 900  # -10V..+10V → 100..1000 Hz
    amy.send(osc=0, freq=freq)
    time.sleep(0.05)
```

---

## 9. MicroPython Programmierung

### Verbinden

```bash
pip install mpremote
mpremote resume          # Verbinden via USB Serial
# oder
screen /dev/ttyACM0 115200
```

### REPL Basics

```python
import amy
amy.reset()

# Einfacher Sinus
amy.send(osc=0, wave=amy.SINE, freq=440, vel=1)
amy.send(osc=0, vel=0)

# Juno Patch
amy.send(synth=1, patch=10, num_voices=4)
amy.send(synth=1, note=60, vel=1)

# DX7 Patch
amy.send(synth=1, patch=133)  # 128 + 5
```

### amyboard Module

```python
import amyboard

# CV I/O
amyboard.cv_out(5.0, channel=0)
volts = amyboard.cv_in(channel=0)

# Rotary Encoder (Default: Adafruit #5880)
print(amyboard.read_encoder())
amyboard.init_buttons()
print(amyboard.read_buttons())

# OLED Display
amyboard.init_display()
amyboard.display.fill(0)
amyboard.display_refresh()

# I2C Bus
i2c = amyboard.get_i2c()
devices = i2c.scan()
print(devices)

# SD Card
amyboard.mount_sd()
```

### sketch.py (Boot-Script)

AMYboard führt `sketch.py` aus dem aktuellen Environment-Verzeichnis beim Booten aus.

```python
# /user/current/sketch.py
import amy, amyboard

# Default Setup
amy.send(synth=1, patch=0, num_voices=6)    # MIDI CH1: Juno, 6-voice
amy.send(synth=10, num_voices=1, oscs_per_voice=1, synth_flags=3)  # CH10: Drums

amyboard.cv_out(0.0, channel=0)

def loop():
    # Wird ca. alle 60ms aufgerufen
    pass
```

### Dateimanagement

```python
from upysh import *
ls                              # Files auflisten
cat('sketch.py')                # Datei anzeigen
cd('/user')                     # Verzeichnis wechseln
pwd                             # Aktuelles Verzeichnis

# Editor
edit('current/sketch.py')       # Full-Screen Editor
# macOS: Esc+S=Save, Esc+Q=Quit, Esc+X=Cut, Esc+V=Paste, Esc+Z=Undo
# Linux/Win: Ctrl+S=Save, Ctrl+Q=Quit, etc.

# File Transfer via mpremote
mpremote resume fs cp my_script.py :my_script.py       # PC → Board
mpremote resume fs cp :sketch.py sketch.py              # Board → PC
mpremote resume edit sketch.py                          # Lokaler Editor
```

---

## 10. API Parameter Referenz (Wire Protocol)

### Oszillator-Parameter

| Wire | Python | Range | Beschreibung |
|------|--------|-------|-------------|
| `v` | `osc` | 0–OSCS | Oszillator Nummer |
| `w` | `wave` | 0–21 | Waveform (0=SINE, 1=PULSE, ..., 21=OFF) |
| `S` | `reset` | uint | Oszillator/System reset |
| `n` | `note` | 0–127 | MIDI Note (auch fractional) |
| `l` | `vel` | float | Velocity (Note-On/Off) |
| `f` | `freq` | CtrlCoefs | Frequenz |
| `a` | `amp` | CtrlCoefs | Amplitude |
| `d` | `duty` | CtrlCoefs | Duty Cycle (Pulse) |
| `Q` | `pan` | CtrlCoefs | Pan (0=links, 1=rechts) |
| `F` | `filter_freq` | CtrlCoefs | Filter Cutoff |
| `G` | `filter_type` | 0–4 | Filtertyp |
| `R` | `resonance` | 0.5–16.0 | Filter-Resonanz |
| `p` | `preset` | int | PCM/Wavetable Preset |
| `P` | `phase` | 0–1 | Start-Phase |
| `L` | `mod_source` | 0–OSCS | Modulationsquelle |
| `c` | `chained_osc` | 0–OSCS | Geketteter Oszillator |
| `b` | `feedback` | 0–1 | Feedback (FM/KS/PCM-Loop) |
| `m` | `portamento` | ms | Portamento-Zeit |
| `o` | `algorithm` | 1–32 | DX7 FM Algorithmus |
| `I` | `ratio` | float | FM Ratio |
| `O` | `algo_source` | string | FM Operator-Quellen |
| `K` | `patch` | uint | Patch Nummer |
| `i` | `synth` | 0–31 | Synth Nummer |
| `iv` | `num_voices` | int | Voice-Anzahl |
| `in` | `oscs_per_voice` | int | Oszillatoren pro Voice |
| `if` | `synth_flags` | uint | Synth Flags |
| `id` | `synth_delay` | ms | Note-On Delay |
| `ip` | `pedal` | int | Sustain Pedal |
| `H` | `sequence` | 3×int | Sequencer (tick,period,tag) |
| `t` | `time` | ms | Zeitstempel |
| `j` | `tempo` | BPM | Tempo (default 108) |
| `s` | `pitch_bend` | float | Global Pitch Bend |
| `V` | `volume` | 0–10 | Master Volume |
| `h` | `reverb` | 4×float | Reverb Parameter |
| `k` | `chorus` | 4×float | Chorus Parameter |
| `M` | `echo` | 5×float | Echo/Delay Parameter |
| `x` | `eq` | 3×float | EQ Bänder (dB) |
| `A` | `bp0` | pairs | Envelope Generator 0 |
| `B` | `bp1` | pairs | Envelope Generator 1 |
| `T` | `eg0_type` | 0–3 | EG0 Typ |
| `X` | `eg1_type` | 0–3 | EG1 Typ |
| `ic` | `midi_cc` | C,L,N,X,O,CMD | MIDI CC Mapping |
| `g` | `client` | uint | Alles distributed client |
| `W` | `external_channel` | uint | Externes Routing |

### Hooks (C API, für Firmware-Entwicklung)

| Hook | Zweck |
|------|-------|
| `amy_external_render_hook` | Custom Oszillator-Rendering |
| `amy_external_coef_hook` | Externe CtrlCoef Werte (z.B. CV Input) |
| `amy_external_block_done_hook` | Nach jedem Audio-Block |
| `amy_external_midi_input_hook` | MIDI Input Callback |
| `amy_external_sequencer_hook` | Tick-Callback |
| `amy_external_exec_hook` | Code-Execution (zP) |
| `amy_external_reboot_hook` | Reboot Handler |

### System Reset Werte

```python
amy.send(reset=amy.RESET_ALL_OSCS)   # Alle Oszillatoren + Gain + EQ
amy.send(reset=amy.RESET_TIMEBASE)   # Clock zurücksetzen
amy.send(reset=amy.RESET_AMY)        # AMY komplett neustarten
amy.send(reset=amy.RESET_SEQUENCER)  # Sequencer clearen
```

### Sample Management

```python
# Sample laden (Base64 encoded WAVE frames)
amy.send(load_sample=[preset, length_frames, samplerate, channels, midinote, loopstart, loopend])

# Sample entladen
amy.send(load_sample=[preset, 0, 0, 0, 0, 0, 0])

# Von Disk spielen (WAV File)
amy.send(disk_sample=[preset, '/sd/my_sample.wav', 60])

# Sampling von Audio Bus
amy.send(start_sample=[preset, bus, max_frames, midinote, loopstart, loopend])
amy.send(stop_sample=0)

# Wavetable (16,384 Samples, 64 Cycles @ 256 Samples/Cycle)
# Presets: pcm_wavetable_base .. pcm_wavetable_base + pcm_wavetable_samples - 1
# duty crossfaded über die 64 Cycles
```

---

## 11. Konfiguration (amy_config)

Beim Start von AMY in C:

```c
amy_config_t c = amy_default_config();
c.max_oscs = 180;              // Oszillatoren (default 180)
c.max_sequencer_tags = 256;    // Sequencer Tags
c.max_voices = 64;             // Max Voices
c.max_synths = 64;             // Max Synths
c.max_memory_patches = 32;     // RAM Patches
c.features.chorus = 1;         // Chorus an/aus
c.features.reverb = 1;         // Reverb an/aus
c.features.echo = 1;           // Echo an/aus
c.features.default_synths = 1; // Boot mit Juno + Drums
c.features.startup_bleep = 0;  // Startup Sound
c.midi = AMY_MIDI_IS_UART;     // MIDI Interface
c.audio = AMY_AUDIO_IS_I2S;    // Audio Interface
c.i2s_lrc = -1;                // I2S Pins
c.midi_out = -1;               // MIDI UART Pins
```

---

## 12. Nützliche Links & Ressourcen

- [AMY Interactive Tutorial](https://shorepine.github.io/amy/tutorial.html)
- [AMY JavaScript REPL](https://shorepine.github.io/amy/repl.html)
- [AMYboard Online Editor](https://amyboard.com/editor)
- [AMYboard Kaufen](https://amyboard.com/#get) (Makerfabs)
- [Discord Community](https://discord.gg/TzBFkUb8pG)
- [Frontpanel DXF (3D-Druck)](https://raw.githubusercontent.com/shorepine/tulipcc/main/docs/pcbs/amyboard/amyboard_front_panel.dxf)
- [Frontpanel 3MF (BambuLab)](https://raw.githubusercontent.com/shorepine/tulipcc/main/docs/pcbs/amyboard/amyboard_front_panel.3mf)
- [MicroPython Docs](https://docs.micropython.org/en/latest/)
- [WaveEditOnline (Wavetables)](http://waveeditonline.com)

---

## 13. TODO / Nächste Schritte

- [ ] Amyboard bestellen / ist schon da?
- [ ] DIP Switches auf OFF setzen für Eurorack-Pegel
- [ ] Firmware updaten (via Browser: amyboard.com)
- [ ] Verbindung testen (USB-C → mpremote/screen)
- [ ] CV/Gate Verbindung zum Modular-Rack planen
- [ ] Erste sketch.py schreiben (CV → MIDI → AMY Mapping)
- [ ] I2C Accessoires evaluieren (Encoder, Display)

---

## 14. I2C Accessoires & Erweiterungen

AMYboard hat einen frontseitigen I2C Grove-Port (SCL=18, SDA=17, 400kHz) für Zubehör. **Nicht den rückseitigen I2C Host-Port verwenden** – der ist für Tulip CC reserviert.

```python
import amyboard
i2c = amyboard.get_i2c()
print(i2c.scan())  # Alle I2C-Geräte scannen

# Register direkt lesen/schreiben
val = amyboard.read_register(addr, reg)
amyboard.write_register(addr, reg, val)
```

### Grove ↔ Stemma QT Adapter
Für Adafruit-Komponenten wird ein [Grove to Stemma QT Kabel](https://www.adafruit.com/product/4528) benötigt.

| Signal | Stemma QT | Grove (Seeed) |
|--------|-----------|---------------|
| GND | Black | Black |
| Vcc | Red | Red |
| SDA | Blue | White |
| SCL | Yellow | Yellow |

### OLED Display

**Empfohlen:** [Adafruit Grayscale 1.5" 128x128 OLED (SSD1327)](https://www.adafruit.com/product/4741) – 16 Graustufen, passt in Frontpanel-Aussparung.
**Alternative:** Generic SH1107 128x128 OLEDs.

```python
import amyboard

amyboard.init_display()  # Auto-detektiert SSD1327 oder SH1107

# Text zeichnen (x, y, farbe 0-255)
amyboard.display.text("Hello!", 0, 0, 255)
amyboard.display_refresh()

# Formen
amyboard.display.fill_rect(10, 40, 50, 20, 200)
amyboard.display_refresh()

# Live Waveform anzeigen
amyboard.draw_waveform()
```

### Rotary Encoder

#### Einzeln: [Adafruit I2C STEMMA QT Rotary Encoder (5880)](https://www.adafruit.com/product/5880)
Bis zu 8 Stück über Adress-Jumper.

```python
import amyboard

pos = amyboard.read_encoder(encoder=0)   # Position 0-3
amyboard.init_buttons()
buttons = amyboard.read_buttons()         # Tuple (bool, bool, bool, bool)

# NeoPixel (für 5880: num=1, pin=6, seesaw_dev=0x36)
amyboard.init_neopixels(num=1, pin=6, seesaw_dev=0x36)
amyboard.set_neopixel(0, 0, 64, 0, seesaw_dev=0x36)  # Grün
amyboard.show_neopixels(seesaw_dev=0x36)
```

#### Quad: [Adafruit I2C QT Quad Rotary Encoder (5752)](https://www.adafruit.com/product/5752)
4 Encoder + 4 NeoPixels auf einem Breakout.

```python
import amyboard

pos = amyboard.read_encoder(encoder=0)  # 0-3
amyboard.init_buttons()
buttons = amyboard.read_buttons()  # [bool, bool, bool, bool]

# NeoPixel (defaults: num=4, pin=18, seesaw_dev=0x49)
amyboard.init_neopixels()
amyboard.set_neopixel(0, 64, 0, 0)  # Encoder 0 → Rot
amyboard.show_neopixels()

# Patch Selector (mit Display!)
amyboard.init_display()
amyboard.patch_selector()  # Scrollt durch .patch files, lädt per Klick
```

#### 8-Encoder: [M5Stack 8-Encoder Unit (STM32F030)](https://shop.m5stack.com/products/8-encoder-unit-stm32f030)
8 Encoder + RGB LEDs + Toggle Switch.

```python
import m5_8encoder

positions = m5_8encoder.read_all_counters()  # [-2^31..2^31]
buttons = m5_8encoder.read_all_buttons()     # 0/1 pro Encoder
switch = m5_8encoder.read_switch()           # Toggle
m5_8encoder.set_led(0, bytes([255, 0, 0]))  # LED rot
```

### Potentiometer

#### [M5Stack 8-Angle Unit](https://shop.m5stack.com/products/8-angle-unit-with-potentiometer)
8 Potis auf einem I2C-Bus.

```python
import m58angle

val = m58angle.get(0)  # 0.0 - 1.0

# Alle 8 auf AMY-Parameter mappen
for ch in range(8):
    amy.send(osc=ch, amp=m58angle.get(ch))
```

### Joystick

#### [M5Stack I2C Joystick](https://shop.m5stack.com/products/i2c-joystick-unit-v1-1-mega8a)
2-Achsen + Pushbutton.

```python
import m5joy
x, y, btn = m5joy.get()  # x/y 0.0-1.0, btn 0/1
```

### DACs & ADCs

| Modul | Chip | Kanäle | Range |
|-------|------|--------|-------|
| [Mabee DAC](https://www.makerfabs.com/mabee-dac-gp8413.html) | GP8413 | 2 | bis 10V, bis 4 Units (8ch) |
| [M5Stack DAC2](https://shop.m5stack.com/products/dac-2-i2c-unit-gp8413) | GP8413 | 2 | bis 10V |
| [M5Stack DAC](https://shop.m5stack.com/products/dac-unit) | 12-bit | 1 | 0-3.3V |
| [M5Stack ADC](https://shop.m5stack.com/products/adc-i2c-unit-v1-1-ads1100) | ADS1100 | 1 | bis 12V |

```python
import mabeedac
mabeedac.set(5.0, channel=0)  # Mabee DAC CH0 = 5V
mabeedac.set(2.5, channel=1)  # Mabee DAC CH1 = 2.5V

import m5dac2
m5dac2.set(7.5, channel=0)    # DAC2 CH0 = 7.5V

import m5dac
m5dac.set(1.65)               # Single DAC = 1.65V

import m5adc
volts = m5adc.get()           # Externe Spannung lesen
```

### Weitere

| Modul | Funktion |
|-------|----------|
| [M5Stack Extend I/O (PCA9554PW)](https://shop.m5stack.com/products/official-extend-serial-i-o-unit) | 8 GPIO über I2C |
| [M5Stack 7-Segment Digi-Clock](https://shop.m5stack.com/products/red-7-segment-digit-clock-unit) | 4× 7-Segment Display |

```python
import m5extend
m5extend.set_pin_mode(0, False)  # Output
m5extend.write_pin(0, True)      # High

import m5digiclock
m5digiclock.set("AMY ")          # 4 chars
```

### I2C Bus Addresses (Onboard)

| Addr | Device |
|------|--------|
| 0x40 | PCM9211 (Audio Interface) |
| 0x48 | ADS1115 (ADC, CV Input) |
| 0x58 | GP8413 (DAC, CV Output) |
| 0x49 | Seesaw (Encoder, falls angeschlossen) |

---

## 15. Firmware Update

3 Methoden:

### A) Web-Updater (empfohlen)
- [AMYboard Online Editor](https://amyboard.com/editor) → Upgrade Firmware Tab
- Board in Bootloader: **BOOT + RST gedrückt halten, RST loslassen, dann BOOT**
- Chrome/Edge mit WebSerial verwenden
- Option: Nur Firmware upgraden (Files bleiben) oder Komplett löschen + neu flashen
- Nach Flash: BOOT → RST zum Neustart

### B) Wi-Fi Upgrade (via REPL)
```python
import amyboard
amyboard.wifi('SSID', 'password')
amyboard.upgrade()  # Lädt neueste Firmware + System Files per WLAN
```

### C) esptool (Direktflash)
```bash
pip install esptool
# Board in Bootloader-Modus
# Neuestes Release: https://github.com/shorepine/tulipcc/releases
esptool.py write_flash 0x0 amyboard-full-AMYBOARD.bin
```
→ Löscht ALLES (Factory Reset)

---

## 16. AMYboard Online (Web Editor)

[amyboard.com/editor](https://amyboard.com/editor) – Zwei Modi:

### Simulate Mode
- AMYboard im Browser simulieren (Sound + Sketches)
- Ideal zum Entwickeln ohne Hardware
- Inkl. simulierter Accessoires (OLED, Encoder, CV Knobs)
- In-Browser Python REPL verfügbar

### Control Mode
- Steuert echten AMYboard über MIDI (USB oder TRS)
- Sync-Fenster zieht aktuelle Sketch + Knobs vom Board
- MIDI Input Pass-Thru: Zweiten Controller durchschleifen

### Patch Editor
- Channel Strip: 16 MIDI Channels, Load Preset, Clear, Level
- OSC A: freq, wave, duty, level
- OSC B: freq, wave, duty, level (zweite Oszillatorebene)
- LFO: freq, wave, osc, pwm, filt
- VCF: freq, resonance, kbd, env
- Filter ENV: attack, decay, sustain, release
- Amp ENV: attack, decay, sustain, release
- Effects: EQ, Chorus, Reverb, Echo

Jeder Knopf hat ein Popup mit:
- min/max Range
- log-Skalierung (für Frequenzen)
- MIDI CC Assignment + Learn Button

### Code Tab
- Editor für sketch.py
- Write Sketch & Knobs to AMYboard
- Start/Stop/Restart + Tempo für loop()-Callback

### AMYboard World
- File-Sharing Netzwerk für Sketches
- Browse, Download, Upload
- Enthält Patches + Code

---

## 17. Arduino Setup

AMYboard kann auch ohne MicroPython betrieben werden – direkt als Arduino-kompatibles Board.

### Installation
1. ESP32 Board Support (v3.3.8+) installieren: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. Board: Tools → Board → ESP32 Arduino → **AMYboard** (ganz unten)
3. AMY Library: Sketch → Include Library → Manage Libraries → "AMY"
4. File → Examples → AMY → AMY_MIDI_Synth

### Minimal Sketch

```cpp
#include <AMY-Arduino.h>

void setup() {
  amy_config_t config = amy_default_config();
  config.features.default_synths = 1;
  amy_start(config);
}

void loop() {
  amy_update();
}
```

### DFU Mode (bei Upload-Fehlern)
- BOOT + RST halten, RST loslassen, dann BOOT loslassen
- Dann erneut uploaden

### C API Beispiele

```cpp
// Juno Patch laden
amy_event e = amy_default_event();
e.synth = 1;
e.patch_number = 6;     // Juno A17 Choir
e.num_voices = 4;
amy_add_event(&e);

// Note spielen
e = amy_default_event();
e.synth = 1;
e.midi_note = 60;       // Middle C
e.velocity = 1;
amy_add_event(&e);
```

→ Rückkehr zu MicroPython jederzeit möglich (Firmware flashen)

---

## 18. Troubleshooting

### Board reagiert nicht?
- Strom? USB-C / Modular Power / I2C Host?
- Audio Out (nicht In) benutzt?
- Reset über AMYboard Online (Reset Tab)

### Kein Sound?
```python
import amy
amy.send(osc=110, wave=amy.SINE, freq=440, vel=1)  # 440Hz Test
```
→ Wenn hörbar: Audio-Hardware OK

### MIDI-Probleme
- AMYboard bootet mit Juno-6 Patch #0 auf MIDI CH1 – Controller prüfen
- MIDI Kabel tauschen
- USB MIDI vs TRS MIDI – richtigen Anschluss?
- USB-C Kabel: manche sind charge-only → Datenträger-fähiges verwenden

### Serial / USB Verbindung
- CH340K Treiber nötig? [Download](https://www.wch-ic.com/downloads/CH341SER_ZIP.html)
- `ls /dev/ttyACM*` oder `ls /dev/ttyUSB*` (Linux)
- macOS: System Information → USB prüfen
- Windows: Geräte-Manager → COM-Ports
- Kein anderes Programm (serieller Monitor, DAW) darf den Port blockieren
- AMYboard USB MIDI: VID 0xCAF0, PID 0x4009

### Web MIDI
- Nur Chrome/Edge (Firefox/Safari: nein)
- MIDI Device vor dem Öffnen von amyboard.com verbinden
- MIDI Device Selector benutzen
- Nicht gleichzeitig per Serial verbunden sein
- JS Console für Diagnose-Messages checken

### Safe Mode (sketch.py überspringen)
- **BOOT-Button gedrückt halten** beim Power-On
- Führt Hardware Self-Test durch (Audio In, CV In/Out)
- Akustisches Signal bei Erfolg
- Danach normales REPL → sketch.py löschen/fixen:
```bash
mpremote resume fs rm :user/current/sketch.py
```

### MIDI Type A vs B
AMYboard default: **Type A**. Für Type B:
```python
import amyboard
amyboard.init_midi(type='B')
```
→ In sketch.py schreiben für Permanent

### SD Card Probleme
- FAT32 formatieren
- Andere Karte probieren
- Manuell mounten:
```python
import amyboard
amyboard.mount_sd()
```

### I2C Bus Scan (Fehlersuche)
```python
import amyboard
i2c = amyboard.get_i2c()
print(i2c.scan())
```
Erwartete Adressen: 0x40 (PCM9211), 0x48 (ADS1115), 0x58 (GP8413), 0x49 (Seesaw)

---

## 19. AMY Constants Referenz (ergänzend)

Aus `amy/constants.py` – alle Wellenformen, Filter, Reset-Typen und mehr als Python Konstante verfügbar.

```python
# === Wellenformen ===
amy.SINE           = 0
amy.PULSE          = 1
amy.SAW_DOWN       = 2
amy.SAW_UP         = 3
amy.TRIANGLE       = 4
amy.NOISE          = 5
amy.KS             = 6    # Karplus-Strong
amy.PCM            = 7    # Sample Wiedergabe
amy.ALGO           = 8    # DX7 FM Algorithmus
amy.PARTIAL        = 9    # Partials/Obertöne
amy.BYO_PARTIALS   = 10   # Custom Partials
amy.INTERP_PARTIALS = 11  # Interpolierte Partials
amy.AUDIO_IN0      = 12   # Audio Input L
amy.AUDIO_IN1      = 13   # Audio Input R
amy.AUDIO_EXT0     = 14   # External Audio 0
amy.AUDIO_EXT1     = 15   # External Audio 1
amy.AMY_MIDI       = 16   # MIDI-gesourct
amy.PCM_LEFT       = 17   # PCM Left
amy.PCM_RIGHT      = 18   # PCM Right
amy.WAVETABLE      = 19   # Wavetable
amy.CUSTOM         = 20   # Custom C-Osc
amy.OFF            = 21

# === Filtertypen ===
amy.FILTER_NONE    = 0
amy.FILTER_LPF     = 1    # Lowpass
amy.FILTER_BPF     = 2    # Bandpass
amy.FILTER_HPF     = 3    # Highpass
amy.FILTER_LPF24   = 4    # 24dB Lowpass

# === EG Type ===
amy.EG_NORMAL      = 0    # RC-like
amy.EG_LINEAR      = 1
amy.EG_DX7         = 2
amy.EG_EXPONENTIAL = 3

# === Reset Werte ===
amy.RESET_ALL_OSCS  = 0  # Alle Oszis + Gain + EQ resetten
amy.RESET_TIMEBASE  = 1  # Clock zurücksetzen
amy.RESET_AMY       = 2  # AMY komplett neustarten
amy.RESET_SEQUENCER = 3  # Sequencer clearen
amy.RESET_PATCH     = 4  # User Patch resetten

# === Synth Flags ===
# synth_flags=1: MIDI Drums (Note→Preset)
# synth_flags=2: Note-Off Events ignorieren
# synth_flags=3: Beides (MIDI Drums + kein Note-Off)

# === CtrlCoef Dict Keys ===
# Kanonische Reihenfolge:
# const, note, vel, eg0, eg1, mod, bend, ext0, ext1
```

---

## 20. AMY Examples (Built-In Patches)

AMY liefert helper patches die man als Python-Funktionen nutzen kann:

```python
import amy

# Filter Bass Patch
amy.send(synth=0, num_voices=4, patch=amy.examples.filter_bass())
amy.send(synth=0, vel=1, note=50)
```

Weitere Examples via `amy.examples.*()` (Quelle: `amy/__init__.py`):
- `filter_bass()` – Acid-artiger Filter-Bass
- `pwm_lead()` – PWM-Lead
- `pad()` – Flächenhafter Pad

---

## 21. Wichtige API Details & Edge Cases

### Listen-Parameter & Teilsetzung
Bei Listenparametern kann jeder Teilwert einzeln übersprungen werden:
```python
# Initial: bp0='0,1,200,0.5,300,0' (ADSR)
# Nur Sustain-Level ändern:
amy.send(osc=0, bp0=',,,0.2')
```
⚠️ Listen können nicht verkürzt werden – nur durch Reset des gesamten Oszillators.

### Fractional Notes
```python
amy.send(synth=1, note=60.5, vel=1)  # 50 Cent über C4
```
Voice-Management rundet auf Integer für Note-On/Off Matching.

### Synth Delay
```python
amy.send(synth=1, synth_delay=50)  # 50ms Delay für Note-Ons
```
Gibt gestohlenen Voices Zeit auszuklingen.

### Portamento
```python
amy.send(osc=0, portamento=100)  # 100ms Gleitzeit
```

### Chained Oscillators
```python
amy.send(osc=0, chained_osc=1)  # Note/Velocity Events propagieren zu Osc 1
# VCF läuft nur auf erstem Osc, aber gilt für alle in der Chain
```

### Audio Input Processing
```python
# AMY's Audio Input als Effekt-Return nutzen
amy.send(osc=0, wave=amy.AUDIO_IN0, vel=1)  # Line-In durch AMY routen
```

### FM Synthesis (ALGO Type)
```python
amy.send(osc=0, wave=amy.ALGO, algorithm=1, ratio=2.0,
         algo_source='0,1,,,,',  # Op6=Osc0, Op5=Osc1
         feedback=0.5)
```
- algorithm: 1-32 (DX7 Algorithmen)
- ratio: Modulator-Frequenz / Note-Frequenz
- algo_source: 6 Operatoren (startend mit Op6), leere Positionswerte für ungenutzt
- feedback: 0-1

### BYO_PARTIALS (Additive Synthesis)
```python
# Osc mit Custom-Obertönen
amy.send(osc=0, wave=amy.BYO_PARTIALS, num_partials=3, preset=-3)
# Dann einzelne Partials konfigurieren...
```

### Von Disk Spielen (WAV/FLAC)
```python
# WAV von SD-Karte als Preset laden
amy.send(disk_sample=[260, '/sd/bassdrum.wav', 36])  # Preset 260, Note 36
amy.send(synth=10, note=36, vel=1)
```
⚠️ Nur ein Sample pro Preset-Nummer gleichzeitig. Mehrere Presets für Polyphonie.

### Sample Loaden (Base64)
```python
# Sample in RAM laden
amy.send(load_sample=[preset, length_frames, samplerate, channels, midinote, loopstart, loopend])
# Danach Base64-encoded WAVE Frames senden...

# Aus RAM entfernen
amy.send(load_sample=[preset, 0, 0, 0, 0, 0, 0])
```

### Sampling (Audio In → PCM Preset)
```python
# Von Bus 1 (AMY Mixed Output) in Preset 300 aufnehmen
amy.send(start_sample=[300, 1, max_frames, 60, 0, 0])
# Stoppen
amy.send(stop_sample=0)
```

---

## 22. Tulip Creative Computer Integration

AMYboard kann direkt an einen Tulip CC via I2C angeschlossen werden:

```python
from machine import I2C
i2c = I2C(0, freq=400000)
amy.override_send = lambda x: i2c.writeto(0x3f, x)
```

→ Der gesamte Sound läuft dann über den AMYboard.

---

*Ende der Projektdokumentation. Stand: 2026-05-23. Nächste Schritte und Code folgen in separaten Dateien.*