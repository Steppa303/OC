#!/usr/bin/env python3
"""
main.py – AMYboard Hauptlogik (in current/)
=============================================
Enthaelt Quantizer-Loop + Startup-Setup.
Wird von root sketch.py importiert (Bootstrap).

NICHT in root legen – root sketch.py ist der Boot-Entrypoint.
"""

import quantizer
import amy

# === Synth Setup (Drums fuer Test-Zwecke) ===
amy.send(synth=10, num_voices=1, oscs_per_voice=1, synth_flags=3)

# === Quantizer zuruecksetzen ===
quantizer.reset()

# === Loop ===
def loop():
    """Hauptloop. Wird in while True von sketch.py gerufen."""
    # Remote Server non-blocking poll (NIE WEGLASSEN!)
    remote_loop()
    
    try:
        now = amy.millis()
        cv1 = amyboard.cv_in(channel=0)
        cv2 = amyboard.cv_in(channel=1)
        
        out_v = quantizer.update(cv1, cv2, now)
        
        amyboard.cv_out(out_v, channel=0)
        amyboard.cv_out(out_v, channel=1)
    except Exception as e:
        # Fehler duerfen den Server nicht killen
        pass