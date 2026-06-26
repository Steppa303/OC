# Quantizer – Implementierungsplan

> Stand: 2026-05-30
> Basis: ESP32-S3 AMYboard, MicroPython, amyboard Modul
> Ziel: CV-gesteuerter, probabilistischer Quantizer mit Scale-Learning

---

## 1. Architektur

### Dateistruktur

```
/user/current/
├── amyboard.py        # Board-spezifisches Modul (fertig, unverändert)
├── amy.py             # Synth Engine Modul (fertig, unverändert)
├── quantizer.py       # Quantizer-Logik + Hilfsfunktionen
└── sketch.py          # Boot-Skript: import + loop() Einstieg
```

### Auslagerung Server

Für Wartbarkeit und Stabilität wird der **Remote-Server** in `remote.py` ausgelagert – das Teil das NIEMALS angefasst wird. `quantizer.py` und `sketch.py` können dann wild editiert werden ohne den Remote-Zugriff zu killen.

```
remote.py → WLAN + TCP Server auf Port 2323 (unantastbar)
quantizer.py → Quantizer-Logik (edierbar)
sketch.py → Boot + Loop-Einstieg (edierbar)
```

---

## 2. Code-Struktur

### `quantizer.py` – Module

```python
# Konstanten
SEMITONE_PER_VOLT = 12.0        # 1V = 12 semitones
VOLT_PER_SEMITONE = 1/12.0
CV_HYSTERESIS = 0.042           # ~0.5 semitones in Volt
LEARN_HYSTERESIS = 0.025        # ~0.3 semitones in Volt
RESET_TOLERANCE = 0.1           # ±0.1V Toleranz für "CV1 ≈ CV2"
RESET_TIME_MS = 5000            # 5 Sekunden bis Reset

# Zustand
scale = []          # Liste von semitone_classes (0-11), z.B. [0, 2, 4, 5, 7, 9, 11]
weights = {}        # Dict: semitone_class → count, z.B. {0: 5, 4: 2, 7: 8}
last_cv1_raw = 0.0  # Letzter roher CV1 Wert (für Hysterese)
last_cv2_note = -1  # Letzte gelernte Note (für Hysterese)
reset_start = 0     # Millis wann Reset-Bedingung erstmals erfüllt war
is_chromatic = True # Flag: Scale leer = Chromatic
```

#### Funktionen

```python
def semitone_from_volt(v):
    """Volt → roher semitone float (z.B. 2.5V → 30.0)"""
    return v * SEMITONE_PER_VOLT

def volt_from_semitone(s):
    """Semitone → Volt (z.B. 30 → 2.5V)"""
    return s * VOLT_PER_SEMITONE

def learn_note(volts):
    """CV2 Spannung lernen → scale + weights aktualisieren"""
    global scale, weights, is_chromatic, last_cv2_note
    
    semitone_class = int(round(volts * 12)) % 12
    
    # Hysterese: nur bei Änderung
    if abs(semitone_class - last_cv2_note) < 0.3:
        return
    
    scale.append(semitone_class)
    weights[semitone_class] = weights.get(semitone_class, 0) + 1
    is_chromatic = False
    last_cv2_note = semitone_class

def quantize(raw_semitone):
    """Rohen semitone → quantisierten semitone (weighted random)"""
    global is_chromatic
    
    if is_chromatic or not scale:
        return round(raw_semitone)
    
    raw_class = int(round(raw_semitone)) % 12
    
    # Direkter Treffer
    if raw_class in scale:
        # Nächstgelegenen semitone zur rohen Note finden, der in scale ist
        nearest = find_nearest_scale_note(round(raw_semitone), scale)
        return nearest
    
    # Gewichtete Auswahl
    candidates = get_weighted_candidates(raw_semitone, scale, weights)
    chosen = weighted_random_choice(candidates)
    return chosen

def find_nearest_scale_note(raw_semitone, scale):
    """Nächsten semitone finden der in scale ist"""
    # raw_semitone ist absoluter semitone (z.B. 30.0)
    # scale enthält semitone_classes (0-11)
    raw_class = int(round(raw_semitone)) % 12
    octave = int(round(raw_semitone)) // 12
    
    # Nächste Klasse in scale finden (circular)
    nearest = min(scale, key=lambda x: min(abs(x - raw_class), 12 - abs(x - raw_class)))
    
    return octave * 12 + nearest

def get_weighted_candidates(raw_semitone, scale, weights):
    """2-3 Kandidaten um raw_semitone herum finden, mit weights"""
    if not weights:
        return []
    
    total_weight = sum(weights.values())
    if total_weight == 0:
        return []
    
    raw_int = int(round(raw_semitone))
    
    # Kandidaten: ~3 Noten unter und über raw_semitone
    candidates = []
    for offset in range(-2, 3):
        note = raw_int + offset
        note_class = note % 12
        if note_class in scale:
            w = weights.get(note_class, 1)
            candidates.append((note, w))
    
    return candidates

def weighted_random_choice(candidates):
    """Weighted random aus Kandidatenliste"""
    if not candidates:
        return 0
    
    total = sum(w for _, w in candidates)
    if total == 0:
        return candidates[0][0]
    
    r = random.uniform(0, total)  # MicroPython hat random!
    cumulative = 0
    for note, weight in candidates:
        cumulative += weight
        if r <= cumulative:
            return note
    
    return candidates[-1][0]

def check_reset(cv1, cv2, now_ms):
    """Reset-Bedingung prüfen: CV1 ≈ CV2 für 5s"""
    global scale, weights, is_chromatic, reset_start
    
    if abs(cv1 - cv2) <= RESET_TOLERANCE:
        if reset_start == 0:
            reset_start = now_ms
        elif now_ms - reset_start >= RESET_TIME_MS:
            scale = []
            weights = {}
            is_chromatic = True
            reset_start = 0
    else:
        reset_start = 0

def update(cv1_in_volts, cv2_in_volts, now_ms):
    """Haupt-Logik: Ein Update-Call pro loop()-Zyklus"""
    global last_cv1_raw
    
    # 1. Reset check
    check_reset(cv1_in_volts, cv2_in_volts, now_ms)
    
    # 2. Scale learn von CV2
    learn_note(cv2_in_volts)
    
    # 3. Hysterese für CV1
    if abs(cv1_in_volts - last_cv1_raw) < CV_HYSTERESIS:
        cv1 = last_cv1_raw
    else:
        cv1 = cv1_in_volts
        last_cv1_raw = cv1_in_volts
    
    # 4. Quantisieren
    raw_semitone = semitone_from_volt(cv1)
    quantized_semitone = quantize(raw_semitone)
    output_volts = volt_from_semitone(quantized_semitone)
    
    # 5. Ausgabe
    return output_volts
```

### `sketch.py` – Boot + Loop

```python
from remote import *   # WLAN + TCP Server (NICHT editieren, unantastbar!)
import quantizer

# Setup einmalig
quantizer.reset()

def loop():
    remote_loop()
    
    now = amy.millis()
    cv1 = amyboard.cv_in(channel=0)
    cv2 = amyboard.cv_in(channel=1)
    
    out_v = quantizer.update(cv1, cv2, now)
    
    amyboard.cv_out(out_v, channel=0)  # CV1 out
    amyboard.cv_out(out_v, channel=1)  # CV2 out (mirror)
```

---

## 3. Teststrategie

### Ohne Hardware (simuliert)
Solange der Server nicht läuft (aktuelles Problem), kann ich trotzdem den Code validieren:

1. **Logic-Check:** `quantizer.py` auf korrekte Semiton-Volt-Umrechnung prüfen
2. **Edge Cases:** Scale leer, Scale eine Note, alle 12 Noten, Reset

### Mit Hardware (wenn Server läuft)
Sobald Verbindung steht:

1. **Basis-Test:** `amyboard.cv_in(0)` lesen, `amyboard.cv_out(2.5, 0)` schreiben → Multimeter
2. **Chromatic test:** ohne Scale → CV1 out = CV1 in (gequantized auf Semitone)
3. **Scale learn:** CV2 mit Pitch belegen → scale wächst
4. **Wahrscheinlichkeit:** Gleiche Note oft auf CV2 → erhöht Zieh-Wahrscheinlichkeit
5. **Reset:** CV1 ≈ CV2 für 5s → Scale geleert

---

## 4. Deploy-Strategie (damit wir NIE wieder den Server verlieren)

### Phase 1: Verbindung wiederherstellen
- [ ] Alten funktionierenden Server via REPL pushen (User per USB)
- [ ] Verbindung via PING bestätigen

### Phase 2: Struktur aufsetzen
- [ ] `remote.py` schreiben (WLAN + TCP Server, loop()-basiert) – NIE MEHR ÄNDERN
- [ ] `daemon.py` schreiben (autorestart für loop, falls quantizer.py crasht)

### Phase 3: Quantizer deployen
- [ ] `quantizer.py` via Base64 pushen
- [ ] `sketch.py` aktualisieren auf `from remote import *; from quantizer import *`
- [ ] RST

**NEU: Autorestart-Mechanismus für Server**
Damit der Server nie wieder stirbt wenn sketch.py crasht:

```python
# In daemon.py oder inline in remote.py
import sys

def safe_loop():
    try:
        loop()  # User-defined loop
    except Exception as e:
        # Server läuft trotzdem weiter, nur loop() ist down
        remote_loop()  # remote muss separat bleiben
```

---

## 5. Offene Fragen & Risiken

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| `random` Modul fehlt in MicroPython | Weighted Random fällt aus | Eigenen PRNG bauen (xorshift) oder System Random via `os.urandom` |
| `amy.millis()` blockt oder gibt falsche Werte | Timing für Reset kaputt | Alternativ `time.ticks_ms()` |
| `from remote import *` crasht bei Syntaxfehler in remote.py | Board tot + Server tot | `remote.py` NIE editieren! |
| DAC 12-Bit Auflösung (~5mV) | Semitone-Auflösung aber ~0.06 semitones = OK | Kein Problem |
| ADC Rauschen auf CV2 löscht Scale | Scale crasht | Hysterese + Debounce |
