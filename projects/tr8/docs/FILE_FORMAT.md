# TR-8S Dateiformat-Spezifikation

_Basierend auf Reverse Engineering und Community-Forschung_

---

## .t8k (Kit-Datei)

### Übersicht
Ein .t8k File ist ein binäres Chunk-basiertes Format. Es enthält:
- Kit-Parameter (Instrument-Tuning, Decay, Level)
- Wave-Name-Liste (welche Samples zugewiesen sind)
- PCM-Audio-Daten (die actual Samples)

### Chunks

Jeder Chunk hat das Format:
```
[4 Bytes] Magic (ASCII, z.B. "SMPL")
[4 Bytes] Payload Size (little-endian uint32)
[N Bytes] Payload Data
```

### Bekannte Chunks (in Reihenfolge):

#### 1. `T8K ` — File Header
```
Offset 0x00
[4 Bytes] "T8K "
[4 Bytes] Header Size
[...]     Header-Daten (Versionsinfo?)
```

#### 2. `NAME` — Kit Name
```
[4 Bytes] "NAME"
[4 Bytes] Name Length
[16 Bytes] Kit Name (null-terminiert, ASCII)
```

#### 3. `KIT ` — Kit Parameters
```
[4 Bytes] "KIT "
[4 Bytes] Data Length
[...]     Parameter-Daten (Tuning, Decay, Level pro Instrument)
```

#### 4. `TONE` — Tone/Wave Names
```
[4 Bytes] "TONE"
[4 Bytes] Data Length
[0x10 Offset from TONE start]
  [4 Bytes] Anzahl Waves (uint32 LE)
[0x20 Offset from TONE start]
  Für jede Wave j (0..N-1):
    [0x24 Bytes pro Eintrag]
      [16 Bytes] Wave-Name (null-terminiert, ASCII)
      [20 Bytes] Metadaten?
```

#### 5. `PCMT` — PCM Table
```
[4 Bytes] "PCMT"
[4 Bytes] Data Length
[...]     Sample-Zuordnungstabelle
```

#### 6. `WAVE` — Wave Header
```
[4 Bytes] "WAVE"
[4 Bytes] Data Length
[...]     Wave-Metadaten (Format, Sample-Rate, etc.)
```

#### 7. `SMPL` — Sample Data
```
[4 Bytes] "SMPL"
[4 Bytes] PCM Data Length (N, little-endian uint32)
[4 Bytes] CRC32 der PCM-Daten
[4 Bytes] CRC32 der 12 oberen Bytes
[N Bytes] PCM Rohdaten
```

**PCM-Format:**
- Encoding: Signed 16-bit Integer
- Byte Order: Little-Endian
- Sample Rate: 44100 Hz
- Channels: 1 (Mono)

### WAV-Header für SMPL-Daten:
```python
RIFF_HEADER = b'\x52\x49\x46\x46'  # "RIFF"
WAVE_HEADER = (
    b'\x57\x41\x56\x45'  # "WAVE"
    b'\x66\x6D\x74\x20'  # "fmt "
    b'\x10\x00\x00\x00'  # 16 (PCM format chunk size)
    b'\x01\x00'          # 1 (PCM format)
    b'\x01\x00'          # 1 channel (mono)
    b'\x44\xAC\x00\x00'  # 44100 sample rate
    b'\x88\x58\x01\x00'  # 88200 byte rate (44100 * 2)
    b'\x02\x00'          # 2 block align
    b'\x10\x00'          # 16 bits per sample
    b'\x64\x61\x74\x61'  # "data"
)
# Dann: [4 Bytes] Data Length + PCM Daten
```

---

## .t8p (Pattern-Datei)

### Übersicht
Enthält Pattern-Daten OHNE Audio-Samples. Binary-Format, weniger erforscht als .t8k.

### Vermutete Chunks:
```
[4 Bytes] "T8P " — File Header
[4 Bytes] "NAME" — Pattern Name
[4 Bytes] "PTN " — Pattern Data
```

### Pattern-Daten (aus TR-8 Text-Format extrapoliert):

#### Step-Bitmasks
Jedes Instrument hat pro Variation eine 16-Bit-Bitmaske:
```
Step N aktiviert = Bit N gesetzt (0-basiert)
16 Steps = uint16 (0x0000 - 0xFFFF)

Beispiel: BD auf Steps 1,3,8,10,11,12,16
= 2^0 + 2^2 + 2^7 + 2^9 + 2^10 + 2^11 + 2^15
= 0x8E85 = 36485
```

#### Pro Variation (A-H):
```
STEP_BD   — 16-Bit Bitmaske (Bass Drum Hits)
STEP_SD   — 16-Bit Bitmaske (Snare Hits)
STEP_LT   — 16-Bit Bitmaske (Low Tom Hits)
STEP_MT   — 16-Bit Bitmaske (Mid Tom Hits)
STEP_HT   — 16-Bit Bitmaske (Hi Tom Hits)
STEP_RS   — 16-Bit Bitmaske (Rimshot Hits)
STEP_HC   — 16-Bit Bitmaske (Handclap Hits)
STEP_CH   — 16-Bit Bitmaske (Closed HH Hits)
STEP_OH   — 16-Bit Bitmaske (Open HH Hits)
STEP_CC   — 16-Bit Bitmaske (Crash Hits)
STEP_RC   — 16-Bit Bitmaske (Ride Hits)
```

#### Pro Variation Accents:
```
ACC_BD    — 16-Bit Bitmaske (BD Accents)
ACC_SD    — 16-Bit Bitmaske (SD Accents)
... (für alle 11 Instrumente)
```

#### Pro Variation Flams:
```
FLAM_BD   — 16-Bit Bitmaske (BD Flams)
FLAM_SD   — 16-Bit Bitmaske (SD Flams)
... (für alle 11 Instrumente)
```

#### Global:
```
VARI(n)        — Anzahl aktiver Variationen
SCALE(n)       — Timebase/Scale
LAST_A(15)     — Letzter Step Var A (0-15)
LAST_B(15)     — Letzter Step Var B (0-15)
STEP_ACC       — Global Accent Steps
STEP_REV       — Reverb Send Steps
STEP_ECHO      — Echo/Delay Steps
STEP_SC        — Sidechain Steps
WEAK_ACC       — Weak Accent Steps
```

### TR-8S-spezifische Ergänzungen (nicht im TR-8):
- Sub-Steps (pro Instrument, pro Step)
- Motion Sequencing (Parameter-Automation)
- Kit-Zuweisung pro Pattern
- Tempo pro Pattern
- Shuffle-Wert pro Pattern

---

## CRC32 Berechnung

Für .t8k SMPL-Chunks wird CRC32 verwendet:
```python
import binascii
crc = binascii.crc32(pcm_data) & 0xFFFFFFFF
```

---

## Quellen
1. TheWorldAccordingToRaymond/T8K_Rolan_samples_to_wavs (GitHub)
2. Roland Clan Forums — Pattern Text Format Thread
3. Reverse Engineering Stack Exchange — .t8k Format
