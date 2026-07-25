# TR-8S MIDI Implementation

---

## Note Numbers (Trigger)

| Instrument | Note (Default) | Note # | Note (ALT) | Note # |
|-----------|----------------|--------|------------|--------|
| BD        | C2             | 36     | B1         | 35     |
| SD        | D2             | 38     | E2         | 40     |
| LT        | G2             | 43     | F2         | 41     |
| MT        | B2             | 47     | A2         | 45     |
| HT        | D3             | 50     | C3         | 48     |
| RS        | C#2            | 37     | G#3        | 56     |
| HC        | D#2            | 39     | F#3        | 54     |
| CH        | F#2            | 42     | G#2        | 44     |
| OH        | A2             | 46     | A#3        | 58     |
| CC        | C3             | 49     | C#4        | 61     |
| RC        | D3             | 51     | D#4        | 63     |

Konfigurierbar via: UTILITY → MIDI → Inst Note

---

## Control Change (CC) Messages

### Instrument-Parameter (je 3 CCs pro Instrument)

| CC | Parameter | Range | Beschreibung |
|----|-----------|-------|-------------|
| 20 | BD TUNE   | 0-127 | Bass Drum Tuning |
| 23 | BD DECAY  | 0-127 | Bass Drum Decay Time |
| 24 | BD LEVEL  | 0-127 | Bass Drum Volume |
| 25 | SD TUNE   | 0-127 | Snare Tuning |
| 28 | SD DECAY  | 0-127 | Snare Decay |
| 29 | SD LEVEL  | 0-127 | Snare Volume |
| 46 | LT TUNE   | 0-127 | Low Tom Tuning |
| 47 | LT DECAY  | 0-127 | Low Tom Decay |
| 48 | LT LEVEL  | 0-127 | Low Tom Volume |
| 49 | MT TUNE   | 0-127 | Mid Tom Tuning |
| 50 | MT DECAY  | 0-127 | Mid Tom Decay |
| 51 | MT LEVEL  | 0-127 | Mid Tom Volume |
| 52 | HT TUNE   | 0-127 | Hi Tom Tuning |
| 53 | HT DECAY  | 0-127 | Hi Tom Decay |
| 54 | HT LEVEL  | 0-127 | Hi Tom Volume |
| 55 | RS TUNE   | 0-127 | Rimshot Tuning |
| 56 | RS DECAY  | 0-127 | Rimshot Decay |
| 57 | RS LEVEL  | 0-127 | Rimshot Volume |
| 58 | HC TUNE   | 0-127 | Handclap Tuning |
| 59 | HC DECAY  | 0-127 | Handclap Decay |
| 60 | HC LEVEL  | 0-127 | Handclap Volume |
| 61 | CH TUNE   | 0-127 | Closed HH Tuning |
| 62 | CH DECAY  | 0-127 | Closed HH Decay |
| 63 | CH LEVEL  | 0-127 | Closed HH Volume |
| 80 | OH TUNE   | 0-127 | Open HH Tuning |
| 81 | OH DECAY  | 0-127 | Open HH Decay |
| 82 | OH LEVEL  | 0-127 | Open HH Volume |
| 83 | CC TUNE   | 0-127 | Crash Cymbal Tuning |
| 84 | CC DECAY  | 0-127 | Crash Cymbal Decay |
| 85 | CC LEVEL  | 0-127 | Crash Cymbal Volume |
| 86 | RC TUNE   | 0-127 | Ride Cymbal Tuning |
| 87 | RC DECAY  | 0-127 | Ride Cymbal Decay |
| 88 | RC LEVEL  | 0-127 | Ride Cymbal Volume |

### Instrument Control (Modell-spezifisch)

| CC | Parameter | Beschreibung |
|----|-----------|-------------|
| 96 | BD CTRL   | BD Model-spezifisch |
| 97 | SD CTRL   | SD Model-spezifisch |
| 102| LT CTRL   | LT Model-spezifisch |
| 103| MT CTRL   | MT Model-spezifisch |
| 104| HT CTRL   | HT Model-spezifisch |
| 105| RS CTRL   | RS Model-spezifisch |
| 106| HC CTRL   | HC Model-spezifisch |
| 107| CH CTRL   | CH Model-spezifisch |
| 108| OH CTRL   | OH Model-spezifisch |
| 109| CC CTRL   | CC Model-spezifisch |
| 110| RC CTRL   | RC Model-spezifisch |

### Global Parameter

| CC | Parameter | Range | Beschreibung |
|----|-----------|-------|-------------|
| 9  | SHUFFLE   | 0-127 | Shuffle Amount |
| 12 | EXT IN    | 0-127 | External Input Level |
| 70 | AFILLTG   | 0-127 | Auto Fill-in Timing |
| 71 | ACCENT    | 0-127 | Global Accent Level |

---

## Program Change

- Wird erkannt für Pattern-Wechsel
- PC 0-127 → Pattern 1-128

---

## SysEx (System Exclusive)

### Nachrichten-Struktur (Roland Standard)
```
F0              SysEx Start
41              Roland Manufacturer ID
xx              Device ID (konfigurierbar)
00 00 6B        Model ID (TR-8S, noch nicht 100% bestätigt)
cc              Command Type
aa aa aa aa     Address (4 Bytes)
dd dd ...       Data
pp              Checksum
F7              SysEx End
```

### Command Types
| Command | Hex | Beschreibung |
|---------|-----|-------------|
| Data Request | 12 | Daten vom Gerät anfordern |
| Data Set | 42 | Daten an Gerät senden |
| Data Set 1 | 72 | Parameter-Änderung senden |

### Checksum-Berechnung
```python
def roland_checksum(data):
    """Roland Standard Checksum (complement of sum mod 128)"""
    return (128 - sum(data) % 128) % 128
```

### Bekannte Funktionalitäten (via ARIA Website)
1. Verbindung herstellen
2. Freien Sample-Speicher abfragen
3. Speicherfragmentierung melden
4. Sample-Speicher optimieren
5. Kit in Slot transferieren
6. Pattern in Slot transferieren
7. User-Sample löschen
8. Firmware-Version prüfen
9. Full Backup (56.9 MB)

---

## Referenzen
- Roland TR-8S MIDI Implementation Chart (PDF)
- compuphonic/TR-8S-SysEx (GitHub)
- chromakinetics.com — Roland SysEx Dokumentation
- Squarp Forum — TR-8S CC/Note Definitions
