"""
root/sketch.py – AMYboard Bootstrap (auto-executed beim Boot)
==============================================================
1. current/ zu sys.path hinzufuegen
2. remote importieren (WLAN + TCP Server Port 2323)
3. current/sketch importieren (Quantizer/CV Loop)
4. while True: sketch.loop() mit try/except schuetzen
   -> Wenn sketch.loop() fliegt, laeuft remote_loop() trotzdem weiter!
"""

import sys
sys.path.insert(0, 'current')

# === Remote Server (WLAN + TCP) ===
from remote import *

# === Sketch (Quantizer/CV) ===
import sketch

# === Main Loop ===
while True:
    try:
        sketch.loop()
    except Exception as e:
        # Fehler im sketch killen NICHT den Server!
        # remote_loop() laeuft auf jeden Fall
        pass
    
    # remote_loop() immer aufrufen – auch wenn sketch.loop() failed
    remote_loop()