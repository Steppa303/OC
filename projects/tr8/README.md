# TR8 — Roland TR-8S Pattern & Kit Generator

**Ziel:** Ein Pattern-Generator für die Roland TR-8S, der eigene Kits und Pattern zusammenstellen kann und im TR-8S-kompatiblen Dateiformat speichert.

**Status:** 🟡 Recherche abgeschlossen, Implementierung steht

---

## Architektur

```
tr8/
├── README.md              # Dieses File
├── docs/
│   ├── RESEARCH.md        # Vollständige Recherche-Ergebnisse
│   ├── FILE_FORMAT.md     # .t8k / .t8p Binary Format Doku
│   └── MIDI_IMPL.md       # MIDI CC/Note Mapping
├── src/
│   ├── core/
│   │   ├── t8k_writer.py  # Kit-Datei Generator (.t8k)
│   │   ├── t8p_writer.py  # Pattern-Datei Generator (.t8p)
│   │   └── models.py      # Datenmodelle (Kit, Pattern, Instrument)
│   ├── ui/
│   │   ├── app.py         # Streamlit Web-UI
│   │   └── components.py  # UI-Komponenten (Step-Editor, Kit-Editor)
│   └── utils/
│       ├── audio.py       # WAV/PCM Konvertierung
│       └── sysex.py       # SysEx Transfer (optional, via USB)
├── tests/
│   └── test_writer.py     # Unit Tests
└── examples/
    └── demo_kit.t8k       # Beispiel-Kit
```

## Tech Stack

- **Python 3.11+** — Core Logic
- **Streamlit** — Web-UI (browserbasiert)
- **struct** — Binary File Writing
- **numpy** — Audio Processing
- **mido** — MIDI/SysEx (optional)

## Quick Start

```bash
cd projects/tr8
pip install -r requirements.txt
streamlit run src/ui/app.py
```

## Status

- [x] Recherche: TR-8S Dateiformat
- [x] Recherche: Binary Structure (.t8k / .t8p)
- [x] Recherche: MIDI Implementation
- [x] Recherche: SysEx Transfer Protocol
- [x] Implementierung: Datenmodelle
- [x] Implementierung: .t8k Writer
- [x] Implementierung: .t8p Writer
- [x] Implementierung: Web-UI (Grundgerüst)
- [ ] Testing mit echter TR-8S (Hardware verfügbar ✅)
