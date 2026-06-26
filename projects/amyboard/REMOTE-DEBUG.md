# AMYboard Remote Debug Setup

> Letztes Update: 2026-05-31 v3
> Verbindung: VPS (Contabo) → WireGuard → FritzBox → Heimnetz → AMYboard

---

## 1. Netzwerk-Architektur

```
VPS (vmd190638, 185.217.126.72)
  └── WireGuard wg-amy (192.168.178.204/24)
        └── FritzBox (192.168.178.1, hxjyh1nr3l56u9v1.myfritz.net:55355)
              └── Heimnetz 192.168.178.0/24
                    ├── 192.168.178.89 ─── AMYboard (ESP32-S3)  ← DHCP FritzBox
                    ├── 192.168.178.76 ─── Bastians MacBook
                    └── 192.168.178.1  ─── FritzBox
```

### WireGuard Konfiguration

- **Interface:** `wg-amy` (sep. Interface, kein default route)
- **Config:** `/etc/wireguard/wg-amy.conf`
- **Key:** `AllowedIPs = 192.168.178.0/24` (NUR Heimnetz)
- **Gateways & Telegram bleiben über eth0!**

```bash
# Verbinden
wg-quick up wg-amy
# Prüfen
wg show
ping 192.168.178.1
```

---

## 2. Boot-Architektur (4-Layer Modell)

```
┌────────────────────────────────────────────────────────────────┐
│  root/sketch.py (BOOTSTRAP) – auto-executed von AMY-Firmware   │
│  - sys.path += 'current'                                       │
│  - from remote import * → WLAN + TCP Server (settimeout 50ms) │
│  - import sketch         → Quantizer Initialisierung           │
│  - while True:                                                 │
│      try:       sketch.loop()    ← Quantizer (quantizer.update)│
│      except:    → Server läuft weiter!                         │
│      finally:   remote_loop()    ← Server Poll                 │
└─────────────────────┬──────────────────────────────────────────┘
                      │
          ┌───────────┴────────────┐
          ▼                        ▼
┌──────────────────────┐  ┌──────────────────────┐
│  current/remote.py   │  │  current/sketch.py   │
│                      │  │                      │
│  WLAN Init           │  │  Imports quantizer   │
│  TCP Server :2323    │  │  Synth Setup         │
│  remote_loop()       │  │  loop():             │
│   → accept 50ms TO   │  │    CV1 in → quantize │
│   → PING/PONG        │  │    → CV1+2 out       │
│   → eval/exec/ERR    │  └─────────┬────────────┘
└──────────────────────┘            │
                                    ▼
                            ┌──────────────────────┐
                            │  current/quantizer.py│
                            │                      │
                            │  Scale Learning       │
                            │  Weighted Random     │
                            │  CV Hysterese        │
                            └──────────────────────┘
```

### Datei-Übersicht

| Datei | Pfad (Board) | Pfad (Lokal) | Zweck | Editierbar? |
|-------|-------------|-------------|-------|-------------|
| `boot.py` | `/boot.py` | — | Firmware-Boot (unverändert lassen) | ❌ Nein |
| `sketch.py` | `/sketch.py` | `projects/amyboard/root_sketch.py` | Bootstrap: importiert remote + sketch, try/except | ✅ Ja |
| `remote.py` | `current/remote.py` | `projects/amyboard/remote.py` | WLAN + TCP Server (settimeout 50ms) | ⚠️ Vorsicht |
| `sketch.py` | `current/sketch.py` | `projects/amyboard/sketch.py` | Quantizer-Loop (CV in → out) | ✅ Ja |
| `quantizer.py` | `current/quantizer.py` | `projects/amyboard/quantizer.py` | Quantizer-Logik | ✅ Ja |

### Boot-Reihenfolge

1. **Firmware bootet** → führt `/boot.py` aus (Firmware-eigen, nix dran ändern)
2. **Firmware führt** `/sketch.py` aus (root)
3. **root/sketch.py**: `sys.path.insert(0, 'current')`
4. **root/sketch.py**: `from remote import *` → WLAN + TCP Server starten
5. **root/sketch.py**: `import sketch` → `current/sketch.py` → Quantizer init
6. **root/sketch.py**: `while True:` → `sketch.loop()` + `remote_loop()`

### ✅ Auto-Boot funktioniert seit 31.05.2026!

Nach RST startet TCP Server auf Port 2323 automatisch. PONG kommt ohne manuellen REPL-Eingriff.

---

## 3. AMYboard Remote Server (Port 2323)

### Aktuelle Server-Version (remote.py – `settimeout(0.05)`)

```python
import network, socket, time, amyboard
_wlan = network.WLAN(network.STA_IF)
if not _wlan.isconnected():
    _wlan.active(True)
    _wlan.connect('FRITZ!Box 7590 IB', 'K13#wlan2023')
    for _ in range(40):
        if _wlan.isconnected(): break
        time.sleep(0.25)
_server = socket.socket()
_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
_server.bind(('0.0.0.0', 2323))
_server.listen(1)
_server.settimeout(0.05)
def remote_loop():
    global _server
    try:
        conn, addr = _server.accept()
        d = conn.recv(4096).decode().strip()
        if d == 'PING':
            conn.send(b'PONG\n')
        else:
            try:
                r = eval(d)
                conn.send((repr(r)+'\n').encode())
            except:
                try:
                    exec(d)
                    conn.send(b'ok\n')
                except Exception as e:
                    conn.send(('ERR:'+str(e)+'\n').encode())
        conn.close()
    except:
        pass
```

### WICHTIGE ÄNDERUNGEN

| Version | Socket-Modus | Problem |
|---------|------------|---------|
| `while 1:` | blocking `accept()` | Kein Quantizer-Loop parallel möglich |
| `setblocking(False)` | non-blocking | Server startet, aber manchmal keine Verbindung (EINVAL bei settimeout?) |
| **`settimeout(0.05)`** | timeout 50ms | ✅ Läuft. 50ms auf Client warten, dann zurück zum Sketch-Loop |

**Update 31.05.:** `settimeout(0.05)` funktioniert doch auf dem AMYboard! Die alte Annahme dass es `EINVAL` gibt war falsch – das Problem war ein anderer Fehler. Der non-blocking Server per `setblocking(False)` hatte das Problem, dass Verbindungen nicht immer durchkamen.

### Protokoll

| Befehl | Antwort | Beschreibung |
|--------|---------|-------------|
| `PING` | `PONG` | Verbindungstest |
| `1+1` | `2` | Python-Ausdruck evaluieren (`eval`) |
| `amy.send(...)` | `ok` | Python-Anweisung ausführen (`exec`) |
| `asdf` | `ERR:name 'asdf' is not defined` | Fehlerrückgabe (ERR:) |

---

## 4. Quantizer V2 (DEPLOYED am 31.05.2026)

### Funktionsprinzip

```
CV1 in ──→ Hysterese ──→ Quantisierung ──→ CV1 out (quantisiert)
                               ↑                │
CV2 in ──→ Scale Learning ─────┘                ├──→ CV2 out (mirror)
                               + Weighted Random│
                                                ▼
                         Reset Detection: CV1 ≈ CV2 für 5s → Scale leeren
```

### Features

- **Scale-Learning:** Jeder Pitch auf CV2 → semitone_class (0-11) wird zu `scale[]` hinzugefügt
- **Weighted Random:** Häufigkeit einer Note auf CV2 → höhere Wahrscheinlichkeit beim Quantisieren
- **Chromatic:** Wenn Scale leer → alles unverändert durchlassen
- **Reset:** CV1 ≈ CV2 (±0.1V) für 5s → Scale leeren
- **Hysterese:** CV1 ±0.5 semitones, CV2 ±0.3 semitones
- **PRNG-Fallback:** Falls `random` nicht verfügbar → eigener xorshift PRNG

### Konfiguration (in quantizer.py)

| Konstante | Wert | Beschreibung |
|-----------|------|-------------|
| `SEMITONE_PER_VOLT` | 12.0 | 1V = 1 Oktave |
| `CV_HYSTERESIS_V` | 0.042 | ~0.5 semitones |
| `LEARN_HYSTERESIS_ST` | 0.3 | ~0.3 semitones |
| `RESET_TOLERANCE_V` | 0.1 | ±0.1V für Reset |
| `RESET_TIME_MS` | 5000 | 5 Sekunden |
| `CANDIDATE_RANGE` | 3 | ±3 semitones |

### Test-Ergebnisse

- Desktop-Python: **51/51 Tests bestanden ✅**
- Live auf Board: noch nicht getestet (Auto-Boot Problem behoben, nächster Schritt)

---

## 5. File-Transfer aufs Board

### Methode 1 (EMPFEHLUNG – Paste-Mode): Ctrl+E / Ctrl+D

Am zuverlässigsten für `f.write()` mit Escape-Strings:

```
screen /dev/cu.usbmodem* 115200
```

Dann:
1. **Ctrl+E** → `=== Paste Mode ===`
2. Kompletten Code-Block **auf einmal** reinpasten (CMD+V)
3. **Ctrl+D** → Code wird ausgeführt

### Methode 2: `f.write()` Zeile für Zeile

Funktioniert auch, aber aufpassen mit `\\n` Escaping:

```python
f=open('current/datei.py','w')
f.write("zeile1\n")
f.write("zeile2\n")
f.close()
```

**Achtung:** `\n` in Byte-Strings (`b'PONG\n'`) muss als `\\n` escaped werden, sonst SyntaxError!

### Methode 3 (Netz): Per TCP-Server von VPS (nur bei laufendem Server)

**ACHTUNG:** Nur verwenden SOLANGE der Server läuft! Wenn Server down → nur Paste-Mode.

```bash
echo 'exec("import ubinascii; f=open(\"test.py\",\"wb\"); f.write(ubinascii.a2b_base64(\"...\")); f.close()")' | nc -w 3 192.168.178.89 2323
```

---

## 6. Fehlerdiagnose

### Symptome & Lösungen

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| Kein PONG nach RST | root/sketch.py hat Fehler | REPL, Ctrl+D, manuell testen |
| Connection refused | Server läuft nicht | Loop prüfen, Port frei? |
| EADDRINUSE | Alter Socket hängt | Ctrl+D (Softboot) |
| WLAN disconnected nach RST | Verbindungs-Timeout | `network.WLAN().isconnected()` checken |
| SyntaxError bei f.write() | Escaping der \n | Paste-Mode (Ctrl+E) verwenden |

### Diagnose-Kommandos (REPL)

```python
# WLAN check
import network
w = network.WLAN(network.STA_IF)
print(w.isconnected(), w.ifconfig())

# Dateien checken
import os
print(os.listdir())
print(os.listdir('current'))

# Dateiinhalt checken
f=open('sketch.py'); print(f.read()); f.close()

# Server manuell starten
import sys; sys.path.insert(0,'current')
from remote import *
```

### Verbinden vom VPS

```bash
# WireGuard starten
wg-quick up wg-amy

# PING Test
echo 'PING' | nc -q 2 192.168.178.89 2323          # → PONG

# eval test
echo '1+1' | nc -q 2 192.168.178.89 2323           # → 2

# exec test
echo 'amy.millis()' | nc -q 2 192.168.178.89 2323  # → 12345
```

**Wichtig:** `bash /dev/tcp` NIE verwenden! `nc -q 2` ist der einzige Weg.
macOS nutzt `nc -w 3` statt `nc -q 2`.

**Python-Socket (zuverlässiger als nc):**
```bash
python3 -c "import socket; s=socket.socket(); s.settimeout(3); s.connect(('192.168.178.89',2323)); s.send(b'PING\n'); print(s.recv(1024)); s.close()"
```

---

## 7. Lessons Learned (wichtig!)

### MicroPython Besonderheiten

| Problem | Lösung |
|---------|--------|
| **Kein `webrepl`-Modul** | Custom Firmware → eigenen TCP-Server bauen |
| **`settimeout()` → angeblich EINVAL** | Funktioniert doch, Problem lag woanders! |
| **`setblocking(False)`** | Funktioniert auch, aber manchmal unzuverlässig |
| **Port `EADDRINUSE` nach Crash** | Ctrl+D (Softboot) oder `s.close()` |
| **`exec()`-Scope** | Funktionen in `exec()` sehen keine lokalen Variablen (getrennte TCP-Calls) |
| **`bash /dev/tcp`** | Blockiert single-threaded Server! → Nur `nc` |
| **macOS `nc`** | `-q` gibt's nicht → `-w 3` stattdessen |

### Warum der Server Probleme machte (31.05.)

1. **Bug in root/sketch.py:** `from main import loop` statt `from sketch import loop` → ImportError beim Boot → Server startet nie
2. **WLAN-Timeout beim Boot:** Server-Socket wird erstellt bevor WLAN bereit → manchmal keine Verbindung
3. **Falsche Annahme zu settimeout:** Es hieß `settimeout()` gäbe EINVAL → in Wahrheit: der Import-Bug war das Problem, nicht der Socket-Mode
4. **`f.write()` SyntaxErrors:** `\n` Escaping in Byte-Strings nicht richtig escaped

---

## 8. Aktueller Status (31.05.2026 - 18:40)

### ✅ Erledigt
- [x] WireGuard wg-amy eingerichtet (kein default route)
- [x] AMYboard WLAN konfiguriert (FRITZ!Box 7590 IB)
- [x] TCP-Server auf Port 2323 mit `settimeout(0.05)` (eval/exec/ERR)
- [x] remote.py, quantizer.py, sketch.py lokal geschrieben
- [x] Quantizer getestet (51/51 Tests bestanden)
- [x] Alle Dateien auf Board deployed (`current/`)
- [x] TCP-Verbindung vom Mac getestet: **PONG ✅** (mit blocking Server)
- [x] root/sketch.py (Bootstrap) deployed – Auto-Boot setup
- [x] try/except-Schutz: sketch.loop() Fehler killen NICHT den Server
- [x] Doku auf v3 aktualisiert

### 🔴 Offen / Nächste Schritte
- [ ] **Auto-Boot testen:** RST drücken → PONG ohne REPL-Eingriff
- [ ] **Quantizer live testen:** CV-Spannungen anlegen, CV-Out messen
- [ ] **VPS-Fernzugriff:** Server vom VPS testen (via WireGuard)
- [ ] **Vollständig remote deployen:** VPS → Board via TCP (aktuell: 1 Befehl pro Verbindung)
- [ ] **Output-Capture** für print() verbessern (aktuell nur eval/exec Response)

### Bekannte Issues

- **Single-threaded:** Bearbeitet nur eine Verbindung pro Loop-Durchlauf
- **Kein `machine.reset()` per TCP:** Server kann sich nicht selbst neustarten
- **WLAN-Timeout:** remote.py gibt WLAN 10s (40×250ms) – falls WLAN nicht ready, läuft Server ohne Netzwerk

---

## 9. Quick Reference (Befehle)

```bash
# === Auf VPS ===
wg-quick up wg-amy                    # WireGuard starten
echo 'PING' | nc -q 2 192.168.178.89 2323  # Test
echo '1+1' | nc -q 2 192.168.178.89 2323   # eval test

# === Python-Socket (zuverlässig) ===
python3 -c "import socket; s=socket.socket(); s.settimeout(3); s.connect(('192.168.178.89',2323)); s.send(b'PING\n'); print(s.recv(1024)); s.close()"

# === Auf Mac (REPL via USB) ===
screen /dev/cu.usbmodem* 115200
# Ctrl+E → Paste-Mode → Ctrl+D (für f.write()-Blöcke)

# === REPL Quick-Checks ===
import network; w=network.WLAN(network.STA_IF); print(w.isconnected(), w.ifconfig())
import os; print(os.listdir()); print(os.listdir('current'))
f=open('sketch.py'); print(f.read()); f.close()
```
