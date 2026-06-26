# AMYboard Modular-Synth Integration

## Projektstruktur

| Datei | Beschreibung |
|-------|-------------|
| `AMYBOARD-DOKU.md` | **Komplette Dokumentation** – Board-Specs, AMY Engine, API, MIDI, CV-Integration, MicroPython |
| `REMOTE-DEBUG.md` | **Remote-Debug + Deployment** – Server-Setup, Quantizer V2, File-Transfer |
| `remote.py` | WLAN + TCP Server (non-blocking, Port 2323) |
| `quantizer.py` | CV Quantizer mit Scale-Learning & Weighted Random |
| `sketch.py` | Boot-Script (importiert remote + quantizer) |
| `test_quantizer.py` | Test-Suite (51/51 ✅) |

## Quellen

- https://github.com/shorepine/tulipcc/tree/main/docs/amyboard
- https://github.com/shorepine/amy/blob/main/docs/synth.md
- https://github.com/shorepine/amy/blob/main/docs/api.md
- https://github.com/shorepine/amy/blob/main/docs/midi.md

## Status

🟢 **Deployment-Phase** – Quantizer V2 auf Board deployt, TCP-Server läuft, VPS Remote-Zugriff ✅

### Nächste Schritte
- Auto-Boot (Dateien in root `/`)
- Quantizer testen (CV ein/aus messen)
- Weitere Patches für Modular-Setup

### Lokale Entwicklung
```bash
# Tests ausführen
python3 projects/amyboard/test_quantizer.py

# Board verbinden (USB)
screen /dev/cu.usbmodem* 115200
```