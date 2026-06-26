#!/usr/bin/env python3
"""
quantizer.py – CV Quantizer mit Scale Learning & Weighted Random
================================================================

Hardware:
  CV1 in  = zu quantisierendes Signal
  CV2 in  = Scale-Learning (Pitch CV)
  CV1 out = quantisiertes Signal
  CV2 out = Mirror von CV1 out

Konzept:
  - CV2 Pitch → semitone_class (0-11) → scale[] & weights[note_class]++
  - CV1 Pitch → quantisieren auf nächstgelegene Scale-Note (weighted random)
  - Reset: CV1 ≈ CV2 (±0.1V) fuer >5s → Scale leeren

Autor: OpenClaw AI Assistant für Bastian
Datum: 2026-05-30
"""

# Versuche random zu importieren, Fallback auf eigenen PRNG
try:
    import random
except ImportError:
    random = None

class _PRNG:
    """Einfacher xorshift PRNG als Fallback."""
    def __init__(self, seed=42):
        self.state = seed
    def _next(self):
        self.state ^= self.state << 13
        self.state ^= self.state >> 7
        self.state ^= self.state << 17
        return self.state & 0x7fffffff
    def uniform(self, a, b):
        r = self._next() / 2147483647.0
        return a + (b - a) * r

if random is None:
    random = _PRNG()
    _HAS_RANDOM = False
else:
    _HAS_RANDOM = True

_just_reset = [False]  # Flag fuer "gerade resetet"

# === Konstanten ===
SEMITONE_PER_VOLT = 12.0
VOLT_PER_SEMITONE = 1.0 / 12.0
CV_HYSTERESIS_V = 0.042            # ~0.5 semitones in Volt
LEARN_HYSTERESIS_ST = 0.3          # ~0.3 semitones Aenderung zum Lernen
RESET_TOLERANCE_V = 0.1            # ±0.1V fuer "CV1 ≈ CV2"
RESET_TIME_MS = 5000               # 5 Sekunden bis Reset
CANDIDATE_RANGE = 3                 # ±3 semitones um Input herum fuer Kandidaten

# === Zustand ===
scale = []                   # Liste von semitone_classes (0-11), z.B. [0, 2, 4, 5, 7, 9, 11]
weights = {}                 # dict: semitone_class → int, z.B. {0: 5, 4: 2, 7: 8}
is_chromatic = True          # wenn True: alle 12 semitones verfuegbar
last_cv1_v = None            # Letzter CV1 Volt-Wert (Hysterese)
last_learned_class = -1      # Letzte gelernte semitone_class (Hysterese CV2)
reset_start_ms = 0           # Millis wann Reset-Bedingung erstmals erfuellt war
reset_active = False         # Flag ob wir in der Reset-Phase sind


# === Hilfsfunktionen ===

def semitone_from_volt(volts):
    """Volt → roher semitone float (1V/Oktave).
    Beispiel: 2.5V → 30.0 (C2 + 6 semitones)
    """
    return volts * SEMITONE_PER_VOLT


def volt_from_semitone(semitone):
    """Semitone (int oder float) → Volt.
    Beispiel: 30 → 2.5V
    """
    return semitone * VOLT_PER_SEMITONE


def semitone_class(semitone):
    """Semitone → Klasse (0-11, unabhaengig von Oktave).
    Beispiel: 30 → 6, 42 → 6
    """
    return int(round(semitone)) % 12


def midi_note_from_semitone(semitone):
    """Absoluten semitone in MIDI-Note umrechnen (C0=0 = semitone 0).
    Beispiel: 60 → 60 (Middle C)
    """
    return int(round(semitone))


# === Reset ===

def check_reset(cv1_v, cv2_v, now_ms):
    """Reset-Bedingung: CV1 ≈ CV2 (±0.1V) fuer >5s.
    Wenn erfuellt → scale und weights leeren, is_chromatic = True.
    """
    global scale, weights, is_chromatic, reset_start_ms, reset_active
    
    diff = abs(cv1_v - cv2_v)
    
    if diff <= RESET_TOLERANCE_V:
        if not reset_active:
            reset_start_ms = now_ms
            reset_active = True
        
        elapsed = now_ms - reset_start_ms
        if elapsed >= RESET_TIME_MS:
            scale = []
            weights = {}
            is_chromatic = True
            reset_start_ms = 0
            reset_active = False
            _just_reset[0] = True
    else:
        reset_active = False
        reset_start_ms = 0


# === Scale Learning ===

def learn_note(volts):
    """Neuen Pitch von CV2 lernen.
    
    Extrahiert semitone_class (0-11) aus der Spannung.
    Fuegt sie zu scale[] hinzu und erhoeht weights[class].
    Hysterese: nur bei Aenderung > LEARN_HYSTERESIS_ST.
    """
    global scale, weights, is_chromatic, last_learned_class
    
    sem = semitone_from_volt(volts)
    cls = semitone_class(sem)
    
    # Hysterese
    if last_learned_class >= 0:
        diff = abs(cls - last_learned_class)
        circ_diff = min(diff, 12 - diff)
        if circ_diff < LEARN_HYSTERESIS_ST:
            return
    
    scale.append(cls)
    weights[cls] = weights.get(cls, 0) + 1
    is_chromatic = False
    last_learned_class = cls


# === Weighted Random Kandidaten ===

def _get_candidates(raw_semitone):
    """Kandidaten um raw_semitone herum finden.
    
    Falls Scale leer → alle 12 Klassen gleichverteilt.
    Sonst: ±CANDIDATE_RANGE semitones um Input, die in scale sind.
    """
    raw_int = int(round(raw_semitone))
    
    if is_chromatic or not scale:
        # Alle 12 Klassen, gleiche weight
        octave = raw_int // 12
        return [(octave * 12 + c, 1) for c in range(12)]
    
    candidates = []
    for offset in range(-CANDIDATE_RANGE, CANDIDATE_RANGE + 1):
        note = raw_int + offset
        note_class = note % 12
        if note_class in scale:
            w = weights.get(note_class, 1)
            candidates.append((note, w))
    
    # Fallback: naechste Scale-Note falls nichts im Range
    if not candidates:
        octave = raw_int // 12
        raw_class = raw_int % 12
        nearest = min(scale, key=lambda x: min(abs(x - raw_class), 12 - abs(x - raw_class)))
        candidates = [(octave * 12 + nearest, 1)]
    
    return candidates


def _weighted_choice(candidates):
    """Weighted Random Choice.
    
    Jeder Kandidat = (semitone, weight).
    Gibt semitone zurueck.
    """
    total = sum(w for _, w in candidates)
    if total <= 0:
        return candidates[0][0]
    
    r = random.uniform(0, total)
    cumulative = 0
    for note, w in candidates:
        cumulative += w
        if r <= cumulative:
            return note
    
    return candidates[-1][0]


# === Quantisierung ===

def quantize(raw_semitone):
    """Rohen semitone → quantisierten semitone (weighted random).
    
    Fall 1: Scale leer (is_chromatic) → round(raw_semitone)
    Fall 2: Rohwert ist bereits in Scale → naechste Scale-Note
    Fall 3: Sonst → Kandidaten finden + weighted random
    """
    if is_chromatic or not scale:
        return int(round(raw_semitone))
    
    nearest = int(round(raw_semitone))
    
    # Pruefen ob die naechste ganze Zahl in scale ist
    if nearest % 12 in scale:
        return nearest
    
    # Weighted Random aus Kandidaten
    candidates = _get_candidates(raw_semitone)
    return _weighted_choice(candidates)


# === Main Update ===

def reset():
    """Komplett-Reset des Quantizer-Zustands."""
    global scale, weights, is_chromatic, last_cv1_v, last_learned_class
    global reset_start_ms, reset_active
    
    scale = []
    weights = {}
    is_chromatic = True
    last_cv1_v = None
    last_learned_class = -1
    reset_start_ms = 0
    reset_active = False


def update(cv1_v, cv2_v, now_ms):
    """Ein Update-Call pro loop()-Zyklus.
    
    Args:
        cv1_v: Spannung CV1 in (float, -10..+10V)
        cv2_v: Spannung CV2 in (float, -10..+10V)
        now_ms: Aktuelle Zeit in Millisekunden
    
    Returns:
        float: Quantisierte Spannung fuer CV out (beide Kanaele)
    """
    global last_cv1_v
    
    # 1. Reset check
    check_reset(cv1_v, cv2_v, now_ms)
    
    # 2. Scale Learning von CV2 (ausser gerade resetet)
    if not _just_reset[0]:
        learn_note(cv2_v)
    else:
        _just_reset[0] = False
    
    # 3. Hysterese fuer CV1
    if last_cv1_v is not None:
        if abs(cv1_v - last_cv1_v) < CV_HYSTERESIS_V:
            cv1_v = last_cv1_v
    last_cv1_v = cv1_v
    
    # 4. Quantisieren
    raw_st = semitone_from_volt(cv1_v)
    quant_st = quantize(raw_st)
    out_v = volt_from_semitone(quant_st)
    
    return out_v