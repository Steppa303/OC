# AMYboard Projekt – Session Handover v3

> Erstellt: 01.06.2026 15:38  
> Letzte Session: 01.06.2026, 15:04–15:38  
> Nächster Schritt: boot.py überschreiben → RST → PONG testen

---

## 1. Aktueller Status (01.06.2026)

### ✅ Läuft
- **WLAN:** Board verbindet sich zuverlässig zur FritzBox (IP: 192.168.178.89)
- **Manueller Serverstart:** `from remote import *` + `import sketch` → **PONG vom Mac ✅**
- **Quantizer-Loop:** Läuft im manuellen `while True:` + PONG funktioniert parallel
- **Dateien alle deployt:** `boot.py`, `sketch.py` (root), `current/remote.py`, `current/sketch.py`, `current/quantizer.py`
- **WireGuard wg-amy:** VPS → FritzBox → Board (noch nicht getestet)

### ❌ Bricht sich (Auto-Boot nach RST)
- **Nach RST kommt Server NICHT von alleine hoch** → bestätigt am 01.06. (PING-Timeout)
- **Ursache JETZT BEKANNT:** Siehe Abschnitt 2.

---

## 2. 🧠 ROOT CAUSE GEFUNDEN (01.06.2026)

### Die Diagnose

| Check | Ergebnis |
|-------|----------|
| `os.listdir()` | `['boot.py', 'current', 'lib', 'server_test.py', 'sketch.py']` ✅ Dateien da |
| `root/sketch.py` Inhalt | Richtiger Bootstrap-Code (import sys, from remote *, import sketch, while True) ✅ |
| `boot.py` Inhalt | `# boot.py` — **NUR EIN KOMMENTAR!** ❌ |
| `sys.version` | `3.4.0; MicroPython v1.24.0-preview.409.g82e69df33.dirty` |
| `sys.implementation` | `_machine='AMYboard with ESP32S3'` |
| `machine.reset_cause()` | `1` = POWER_ON_RESET |

### Die Ursache

**AMYboard läuft mit Tulip CC MicroPython Custom Firmware.**  
Tulip führt nach `boot.py` **KEIN** `sketch.py` oder `main.py` automatisch aus.  
→ Nur `boot.py` wird beim Start ausgeführt.  
→ Unsere `boot.py` war ein leerer Kommentar.  
→ Unser Bootstrap in `root/sketch.py` wurde **nie von der Firmware aufgerufen**.

**Der Code ist korrekt — nur die Boot-Kette war falsch.**

---

## 3. 🔧 Fix: boot.py muss Bootstrap übernehmen

**Statt** dass `root/sketch.py` den Start macht (wird nie executed), **muss `boot.py`** den kompletten Bootstrap enthalten.

### Neuer Inhalt für `/boot.py`:

```python
import sys
sys.path.insert(0,'current')
from remote import *
import sketch
while True:
 try:
  sketch.loop()
 except:
  pass
 remote_loop()
```

→ Exakt der gleiche Code aus `root/sketch.py` — nur in `boot.py`.

### Was mit root/sketch.py passiert

Kann als Fallback liegenbleiben, wird aber von der Firmware nicht ausgeführt. Löschen oder ignorieren.

---

## 4. Firmware-Besonderheiten (Tulip CC)

- AMYboard läuft mit **Tulip Creative Computer MicroPython** v1.24.0-preview
- `boot.py` ist der **einzige** Einstiegspunkt beim Boot
- Tulip erwartet dass `boot.py` entweder ins Tulip Environment startet (GUI) oder eigenständigen Code ausführt
- Headless-Betrieb (unser `while True`) blockiert Tulip GUI — ist gewollt für Eurorack-Betrieb
- Kein automatisches `main.py` / `sketch.py` wie bei Standard MicroPython
- `machine.reset_cause() = 1` → POWER_ON_RESET (normales Einschalten/RST)

---

## 5. Boot-Architektur (AKTUALISIERT)

### Wie es JETZT laufen wird:

```
Firmware boot (Tulip CC)
  └── /boot.py (UNSER BOOTSTRAP) ← hier muss der Code rein!
       ├── sys.path.insert(0, 'current')
       ├── from remote import *   → WLAN + TCP Server (settimeout/setblocking)
       ├── import sketch          → Quantizer init
       └── while True:
            ├── try: sketch.loop()       ← Quantizer
            ├── except: pass
            └── remote_loop()            ← Server Poll
```

**FRÜHER (kaputt):**
```
Firmware boot → boot.py (leer) → **nichts passiert** → sketch.py (root) wird nie executed
```

**NEU (wird laufen):**
```
Firmware boot → boot.py (Bootstrap) → Server läuft → PONG
```

---

## 6. Dateien & Pfade (Stand 01.06.)

### Auf Board
| Pfad | Zweck | Stand |
|------|-------|-------|
| `/boot.py` | Unser Bootstrap (MUSS überschrieben werden!) | ⚠️ Noch leerer Kommentar |
| `/sketch.py` | Bootstrap-Kopie (wird nicht executed) | ✅ Kann bleiben |
| `/current/remote.py` | WLAN + TCP Server | ✅ Deployed |
| `/current/sketch.py` | Quantizer Loop | ✅ Deployed |
| `/current/quantizer.py` | Quantizer Logic (V2, Scale Learning) | ✅ Deployed |
| `/server_test.py` | Alter Test-Server (Altlast) | ⚠️ Sollte gelöscht werden |

### Lokal (VPS: `projects/amyboard/`)
| Datei | Status |
|-------|--------|
| `HANDOVER.md` | ✅ v3 (diese Datei) |
| `REMOTE-DEBUG.md` | ⚠️ Braucht Update (Tulip Boot-Logik + boot.py Fix) |
| `AMYBOARD-DOKU.md` | ✅ Unverändert |
| `README.md` | ✅ Unverändert |
| `remote.py` | ⚠️ Hinkt Board? Checken! |
| `sketch.py`, `quantizer.py`, `test_quantizer.py` | ✅ Lokale Kopien |
| `main.py` | ⚠️ Altlast, checken |

---

## 7. Nächste Schritte (Dringend)

### 🔴 Schritt 1: boot.py überschreiben
Per Paste-Mode auf dem Mac:
```
Ctrl+E
import sys
sys.path.insert(0,'current')
from remote import *
import sketch
while True:
 try:
  sketch.loop()
 except:
  pass
 remote_loop()
Ctrl+D
```

### 🔴 Schritt 2: RST + PING testen
Nach RST 10s warten, dann:
```bash
python3 -c "import socket; s=socket.socket(); s.settimeout(5); s.connect(('192.168.178.89',2323)); s.send(b'PING\n'); print(s.recv(1024)); s.close()"
```
→ **PONG = Auto-Boot läuft 🚀**

### 🟡 Schritt 3: Quantizer live testen
CV-Spannungen anlegen → CV-Out messen

### 🟡 Schritt 4: VPS-Fernzugriff testen
```bash
wg-quick up wg-amy
echo 'PING' | nc -q 2 192.168.178.89 2323
```

### 🟢 Schritt 5: Cleanup
- `server_test.py` vom Board löschen
- `main.py` lokal prüfen/entfernen
- `REMOTE-DEBUG.md` mit Tulip-Boot-Logik updaten
- Synchronität zwischen lokalen Dateien und Board prüfen

---

## 8. Hardware/Netzwerk (unverändert)

| Komponente | Details |
|------------|---------|
| **Board** | AMYboard (ESP32-S3, Tulip CC MicroPython v1.24.0-preview) |
| **IP** | 192.168.178.89 (DHCP FritzBox) |
| **WLAN** | SSID: FRITZ!Box 7590 IB |
| **Port** | TCP 2323 |
| **Mac** | 192.168.178.76 (Bastians MacBook) |
| **VPS** | 185.217.126.72 → wg-amy (192.168.178.204) → FritzBox |
| **USB** | Mac: `screen /dev/cu.usbmodem* 115200` |
| **Boot via** | `boot.py` (nicht mehr root/sketch.py!) |

---

## 9. Person

- **Bastian** (@Steppa_tg) – Telegram Direktchat
- **Sprache:** Deutsch, Sarkasmus, Gen-Z Slang
- **Kein Base64!** Paste-Mode ist King
- **Kein SSH auf MacBook** – alles über REPL/Screen

---

_Erstellt von OpenClaw AI Assistant am 01.06.2026. Root Cause gefunden: Tulip CC Firmware executed nur boot.py — nicht sketch.py._