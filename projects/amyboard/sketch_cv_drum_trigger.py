# sketch.py - AMYboard CV Drum Trigger (v3)
# ==========================================
# CV1 (Gate HIGH) → Kick Drum (GM Note 36)
# CV2 (Gate HIGH) → Snare Drum (GM Note 38)
#
# KEIN amy.reset() - Factory Samples sind beim Boot bereits geladen!

import amy
import amyboard
import time

# ─── Konfiguration ───────────────────────────────────────────────

KICK_NOTE  = 36   # Bass Drum (GM Standard)
SNARE_NOTE = 38   # Acoustic Snare (GM Standard)

# Gate-Schwellwert in Volt
# Eurorack Gates: typisch 5-10V, ab ~2V als HIGH erkennbar
GATE_THRESHOLD = 1.5

# Polling in ms – 5ms = 200Hz, reicht easy für Drums
POLL_INTERVAL_MS = 5

# ─── Setup ───────────────────────────────────────────────────────

# KEIN amy.reset() – Factory Drum Samples sind beim Boot bereits da!

# Drum Synth auf Synth 10
# WICHTIG: amp muss hoch genug sein (5.0), wave=amy.PCM für Sample-Wiedergabe
# synth_flags=3 = MIDI Drums (Note→Preset Mapping) + kein Note-Off
# num_voices=2 = Kick + Snare gleichzeitig möglich
amy.send(synth=10, num_voices=2, oscs_per_voice=1,
         synth_flags=3, amp=5.0, wave=amy.PCM)

# Master Volume
amy.send(volume=1.0)

# Kleiner Hall fürs Gefühl
amy.send(reverb="0.2,0.3,0.05")

# ─── Gate/Trigger Zustand (Rising Edge Detection) ───────────────

gate1_prev = False  # CV1 (Kick)
gate2_prev = False  # CV2 (Snare)

# ─── Main Loop ───────────────────────────────────────────────────

print("AMYboard Drum Trigger ready.")
print(f"  CV1 → Kick (GM Note {KICK_NOTE})")
print(f"  CV2 → Snare (GM Note {SNARE_NOTE})")

while True:
    # CV-Eingänge lesen (0 = CV1, 1 = CV2)
    cv1 = amyboard.cv_in(channel=0)
    cv2 = amyboard.cv_in(channel=1)

    # Gate auf HIGH?
    gate1 = cv1 > GATE_THRESHOLD
    gate2 = cv2 > GATE_THRESHOLD

    # Rising Edge auf CV1 → Kick triggern
    if gate1 and not gate1_prev:
        amy.send(synth=10, note=KICK_NOTE, vel=1.0)

    # Rising Edge auf CV2 → Snare triggern
    if gate2 and not gate2_prev:
        amy.send(synth=10, note=SNARE_NOTE, vel=1.0)

    # Zustand für nächsten Durchlauf
    gate1_prev = gate1
    gate2_prev = gate2

    time.sleep_ms(POLL_INTERVAL_MS)

# ─── Hinweise ────────────────────────────────────────────────────
#
# DIP Switches (Rückseite):
#   ALLE 4 OFF → Eurorack 10Vpp (Modular-Rack)
#   ALLE 4 ON  → Line Level (Kopfhörer, Mixer) ✅
#
# WICHTIGE Änderungen zu v1/v2:
#   - amp=5.0 am Synth 10 (Channel-Lautstärke, nicht Master)
#   - wave=amy.PCM (Engine muss wissen: Sample, nicht Synthese)