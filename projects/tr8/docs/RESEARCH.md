# TR-8S Recherche-Dokumentation

_Gesammelt am 23.07.2026_

---

## 1. TR-8S Hardware-Specs

- **Patterns:** 128 (16 × 8 Bänke), je 8 Variationen (A–H) + 2 Fill-ins
- **Kits:** 128 User-Kits
- **Instrumente:** 11 pro Kit (BD, SD, LT, MT, HT, RS, HC, CH, OH, CC, RC)
- **Steps:** 16 pro Variation (bis 32 mit Sub-Steps)
- **Samples:** 44100 Hz, 16-bit, Mono PCM (im internen Speicher / SD-Karte)
- **Sample-Slots:** 11 pro Kit (je ein Instrument kann einen User-Sample laden)
- **Import/Export:** Via SD-Karte (.t8k / .t8p Dateien)

---

## 2. SD-Karten-Struktur

```
SD-Karte/
└── ROLAND/
    └── TR-8S/
        ├── SAMPLE/          # User-Samples (WAV, 44.1kHz/16bit/mono)
        │   ├── sample001.wav
        │   └── ...
        ├── EXPORT/
        │   ├── PATTERN/     # Exportierte Pattern (.t8p + .txt)
        │   └── KIT/         # Exportierte Kits (.t8k + .txt)
        └── IMPORT/          # (wird automatisch erstellt)
```

### Import-Workflow (auf der TR-8S):
1. SD-Karte in den Computer → Dateien kopieren
2. SD-Karte in die TR-8S
3. UTILITY → Import → Pattern/Kit → Quelle wählen
4. Fertig

---

## 3. Dateiformate

### 3.1 .t8k (Kit-Datei) — Binary

**Struktur:** Chunk-basiertes Binary Format

Bekannte Chunks (Magic Bytes):
| Chunk  | Offset   | Beschreibung |
|--------|----------|--------------|
| `T8K ` | 0x00     | Datei-Header / Identifikation |
| `NAME` | varies   | Kit-Name (16 Bytes, null-terminiert) |
| `KIT ` | varies   | Kit-Parameter (Tuning, Decay, Level pro Instrument) |
| `TONE` | varies   | Tone-Daten + Wave-Names-Liste |
| `PCMT` | varies   | PCM Table (Sample-Zuordnung) |
| `WAVE` | varies   | Wave-Header / Metadaten |
| `SMPL` | varies   | Rohdaten: PCM Audio (44.1kHz, 16-bit, Mono) |

**SMPL-Chunk Detail:**
```
[4 Bytes] "SMPL" (Magic)
[4 Bytes] Data Length (little-endian)
[4 Bytes] CRC32 der PCM-Daten
[4 Bytes] CRC32 der 12 Header-Bytes
[N Bytes] PCM Rohdaten (signed 16-bit LE)
```

**TONE-Chunk Detail:**
```
[4 Bytes] "TONE" (Magic)
[0x10 Offset] Anzahl Waves (4 Bytes, little-endian)
[0x20 + (j * 0x24)] Wave-Name (16 Bytes, null-terminiert) für j=0..N-1
```

**Audio-Format der SMPL-Daten:**
- Sample Rate: 44100 Hz
- Bit Depth: 16-bit signed
- Channels: 1 (Mono)
- Byte Order: Little-Endian

### 3.2 .t8p (Pattern-Datei) — Binary

**Enthält KEINE Audio-Samples** (nur Pattern-Daten).

Bekannte Chunks:
| Chunk  | Beschreibung |
|--------|--------------|
| `T8P ` | Datei-Header |
| `NAME` | Pattern-Name |
| `PTN ` | Pattern-Daten (Step-Data, Accents, Flams, etc.) |

**Hinweis:** Das .t8p-Format ist weniger erforscht als .t8k. Die Pattern-Daten sind binär kodiert, aber die genaue Struktur ist nicht vollständig dokumentiert.

### 3.3 .txt (Begleit-Datei)

Jeder Export erzeugt eine .txt-Datei mit Zusammenfassung:
```
; Pattern List Version 1.04 (09F3)
[PATTERN]
1 = " HOUSE         " ; AB------ S Kit 1 Tempo 125.0
2 = "TROPIC HOUSE   " ; A------- S Kit 1 Tempo 118.0
...
```

---

## 4. Pattern-Datenstruktur (aus TR-8 Text-Format)

Die TR-8 (und vermutlich TR-8S) kodiert Step-Daten als **Bitmasken**:

### Step-Encoding:
- Jeder Step wird durch ein Bit repräsentiert
- Step N = 2^N (0-basiert)
- 16 Steps = 16-bit Integer (0–65535)

### Beispiel:
```
BD XOXO OOOX OXXX OOOX
= Steps: 1, 3, 8, 10, 11, 12, 16
= 2^0 + 2^2 + 2^7 + 2^9 + 2^10 + 2^11 + 2^15
= 1 + 4 + 128 + 512 + 1024 + 2048 + 32768
= 36485
```

### Pattern-Variablen (TR-8 Text-Format):
```
VARI(n)           — Anzahl Variationen
SCALE(n)          — Skala/Timebase
LAST_A(15)        — Letzter Step Variation A (0-15 = 1-16 Steps)
LAST_B(15)        — Letzter Step Variation B

STEP_XX1(value)   — Steps für Instrument XX, Variation 1 (Bitmaske)
STEP_XX2(value)   — Steps für Instrument XX, Variation 2

ACC_XX1(value)    — Accents für Instrument XX, Variation 1
ACC_XX2(value)    — Accents für Instrument XX, Variation 2

WEAK_ACC1(value)  — Weak Accents Variation 1
WEAK_ACC2(value)  — Weak Accents Variation 2

FLAM_XX1(value)   — Flams für Instrument XX, Variation 1
FLAM_XX2(value)   — Flams für Instrument XX, Variation 2

STEP_ACC1/2       — Global Accent Steps
STEP_REV1/2       — Reverb Send Steps
STEP_ECHO1/2      — Echo/Delay Send Steps
STEP_SC1/2        — Sidechain Steps
```

### Instrument-Kürzel:
| Kürzel | Instrument | Default Note | ALT Note |
|--------|-----------|-------------|----------|
| BD     | Bass Drum | 36 (C2)     | 35 (B1)   |
| SD     | Snare Drum| 38 (D2)     | 40 (E2)   |
| LT     | Low Tom   | 43 (G2)     | 41 (F2)   |
| MT     | Mid Tom   | 47 (B2)     | 45 (A2)   |
| HT     | Hi Tom    | 50 (D3)     | 48 (C3)   |
| RS     | Rimshot   | 37 (C#2)    | 56 (G#3)  |
| HC     | Handclap  | 39 (D#2)    | 54 (F#3)  |
| CH     | Closed HH | 42 (F#2)    | 44 (G#2)  |
| OH     | Open HH   | 46 (A2)     | 58 (A#3)  |
| CC     | Crash     | 49 (C3)     | 61 (C#4)  |
| RC     | Ride      | 51 (D3)     | 63 (D#4)  |

---

## 5. MIDI Implementation

### 5.1 CC-Nummern (Instrument-Parameter)

| CC | Parameter | Beschreibung |
|----|-----------|-------------|
| 20 | BD TUNE   | Bass Drum Tuning |
| 23 | BD DECAY  | Bass Drum Decay |
| 24 | BD LEVEL  | Bass Drum Lautstärke |
| 25 | SD TUNE   | Snare Tuning |
| 28 | SD DECAY  | Snare Decay |
| 29 | SD LEVEL  | Snare Level |
| 46 | LT TUNE   | Low Tom Tuning |
| 47 | LT DECAY  | Low Tom Decay |
| 48 | LT LEVEL  | Low Tom Level |
| 49 | MT TUNE   | Mid Tom Tuning |
| 50 | MT DECAY  | Mid Tom Decay |
| 51 | MT LEVEL  | Mid Tom Level |
| 52 | HT TUNE   | Hi Tom Tuning |
| 53 | HT DECAY  | Hi Tom Decay |
| 54 | HT LEVEL  | Hi Tom Level |
| 55 | RS TUNE   | Rimshot Tuning |
| 56 | RS DECAY  | Rimshot Decay |
| 57 | RS LEVEL  | Rimshot Level |
| 58 | HC TUNE   | Handclap Tuning |
| 59 | HC DECAY  | Handclap Decay |
| 60 | HC LEVEL  | Handclap Level |
| 61 | CH TUNE   | Closed HH Tuning |
| 62 | CH DECAY  | Closed HH Decay |
| 63 | CH LEVEL  | Closed HH Level |
| 70 | AFILLTG   | Auto Fill-in Timing |
| 71 | ACCENT    | Global Accent Level |
| 80 | OH TUNE   | Open HH Tuning |
| 81 | OH DECAY  | Open HH Decay |
| 82 | OH LEVEL  | Open HH Level |
| 83 | CC TUNE   | Crash Tuning |
| 84 | CC DECAY  | Crash Decay |
| 85 | CC LEVEL  | Crash Level |
| 86 | RC TUNE   | Ride Tuning |
| 87 | RC DECAY  | Ride Decay |
| 88 | RC LEVEL  | Ride Level |
| 96 | BD CTRL   | BD Control (Model-spezifisch) |
| 97 | SD CTRL   | SD Control |
| 102| LT CTRL   | LT Control |
| 103| MT CTRL   | MT Control |
| 104| HT CTRL   | HT Control |
| 105| RS CTRL   | RS Control |
| 106| HC CTRL   | HC Control |
| 107| CH CTRL   | CH Control |
| 108| OH CTRL   | OH Control |
| 109| CC CTRL   | CC Control |
| 110| RC CTRL   | RC Control |

### 5.2 Shuffle
- CC 9: Shuffle Amount

### 5.3 External Input
- CC 12: EXT IN Level

---

## 6. SysEx Transfer Protocol

### 6.1 Quellen
- **compuphonic/TR-8S-SysEx** (GitHub) — SysEx Dumps von der ARIA Website
- **Roland ARIA Website** (https://aira.roland.com/soundlibrary-cat/tr-8s/) — Transferiert Kits/Pattern via SysEx

### 6.2 SysEx ID
- In den TR-8S UTILITY Settings konfigurierbar
- Standard: vermutlich 0x00 oder Geräte-spezifisch

### 6.3 SysEx-Funktionen (via ARIA Website entdeckt):
1. Verbindung herstellen
2. Freien Sample-Speicher abfragen
3. Speicherfragmentierung melden
4. Sample-Speicher optimieren
5. Kit in bestimmten Slot transferieren
6. Pattern in bestimmten Slot transferieren
7. User-Sample löschen
8. Firmware-Version prüfen
9. Full Backup (56.9 MB)

### 6.4 SysEx Message Format (Roland Standard)
```
F0              — SysEx Start
41              — Roland Manufacturer ID
xx              — Device ID (SysEx ID aus Settings)
00 00 6B        — Model ID (TR-8S: noch nicht bestätigt)
cc              — Command (12=Data Request, 42=Data Set)
aa aa aa aa     — Address (4 Bytes)
dd dd ...       — Data
pp              — Checksum
F7              — SysEx End
```

### 6.5 Referenzen
- http://www.chromakinetics.com/handsonic/rolSysEx.htm — Roland SysEx Dokumentation
- http://www.sysexdb.com/list.aspx — SysEx Datenbank
- https://github.com/compuphonic/TR-8S-SysEx — SysEx Dumps

---

## 7. Bestehende Tools & Editoren

### 7.1 Offiziell
- **TR-EDITOR** (Roland Cloud, kostenlos) — Desktop-App für TR-8S/TR-6S
  - macOS + Windows
  - Graphischer Editor + Librarian
  - Motion-Editing, Undo/Redo
  - **Nur mit verbundener Hardware** (USB-MIDI)

### 7.2 Community
- **T8K_Roland_samples_to_wavs** (GitHub) — Python-Skript zum Extrahieren von Samples aus .t8k
  - https://github.com/TheWorldAccordingToRaymond/T8K_Roland_samples_to_wavs
  - Findet SMPL-Chunks, fügt WAV-Header hinzu
  
- **Online Kit Editor** (Gearspace Forum, 2019) — Browser-basiert
  - Reverse-engineered .t8k Format
  - Drag & Drop Samples
  - Nicht mehr auffindbar/verfügbar?

- **compuphonic/TR-8S-SysEx** (GitHub) — SysEx Investigation
  - https://github.com/compuphonic/TR-8S-SysEx
  - MIDI Dumps von ARIA Website Transfers

### 7.3 Lücken
- **Kein Pattern-Generator** der standalone .t8p Dateien erzeugen kann
- **Kein Open-Source Kit-Editor** der das .t8k Format vollständig beherrscht
- **Kein offline Tool** das Pattern + Kit zusammen exportiert

---

## 8. Technische Herausforderungen

### 8.1 .t8k Reverse Engineering
- Das Format ist proprietär und nicht offiziell dokumentiert
- SMPL-Chunk ist verstanden (PCM-Daten mit Längen-Header)
- KIT/TONE/PCMT Chunks sind teilweise verstanden
- CRC32-Validierung muss korrekt implementiert werden

### 8.2 .t8p Reverse Engineering
- **Weniger erforscht als .t8k**
- Pattern-Daten sind binär kodiert
- Step-Bitmasks sind aus dem TR-8 Text-Format bekannt
- Accents, Flams, Sub-Steps: Struktur unbekannt
- Variationen A–H: Encoding unbekannt

### 8.3 Empfohlener Ansatz
1. **Phase 1:** .t8k Writer (Kit-Editor) — besser erforscht
2. **Phase 2:** .t8p Writer (Pattern-Generator) — braucht mehr RE
3. **Phase 3:** SysEx Live-Transfer — nice-to-have

### 8.4 Validierung
- Generierte Dateien auf SD-Karte kopieren
- Auf echter TR-8S importieren
- Schrittweise testen (erst Kit, dann Pattern)

---

## 9. Quellen

1. Roland TR-8S Reference Manual (PDF) — static.roland.com
2. Roland TR-8S MIDI Implementation Chart — static.roland.com
3. Reverse Engineering Stack Exchange — .t8k Format
4. Roland Clan Forums — Pattern Text Format
5. compuphonic/TR-8S-SysEx — GitHub
6. TheWorldAccordingToRaymond/T8K_Roland_samples_to_wavs — GitHub
7. Gearspace Forum — TR8S Kit Creator Thread
8. Squarp Forum — TR-8S Instrument Definitions
9. airainfo.org — TR-8S Cheatsheet
