"""
sketch.py – AMYboard Quantizer + CV Loop
=========================================
Wird von root/sketch.py importiert (beim Boot).
NUR Quantizer-Logik hier – kein remote import (macht root/sketch.py).
"""

import quantizer
import amy
import amyboard

# === Synth Setup (Drums fuer Test-Zwecke) ===
amy.send(synth=10, num_voices=1, oscs_per_voice=1, synth_flags=3)

# === Quantizer zuruecksetzen ===
quantizer.reset()

# === Loop ===
def loop():
    try:
        now = amy.millis()
        cv1 = amyboard.cv_in(channel=0)
        cv2 = amyboard.cv_in(channel=1)
        
        out_v = quantizer.update(cv1, cv2, now)
        
        amyboard.cv_out(out_v, channel=0)
        amyboard.cv_out(out_v, channel=1)
    except Exception as e:
        # Fehler im Quantizer duerfen den Server nicht killen
        pass