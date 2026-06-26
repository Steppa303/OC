#!/usr/bin/env python3
"""
Test-Suite für quantizer.py
Simuliert MicroPython + testet alle Edge Cases korrekt.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# quantizer importieren (OHNE die test_ im Namen)
sys.modules.pop('quantizer', None)
import quantizer as q

# Reset-Helfer
def setup():
    q.reset()
    q.last_learned_class = -1
    q.scale = []
    q.weights = {}
    q.is_chromatic = True
    q.reset_active = False
    q.reset_start_ms = 0

passed = 0
failed = 0

def test(name, condition):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name}")

print("=" * 60)
print("QUANTIZER TESTS")
print("=" * 60)

# === 1. Volt ↔ Semitone ===
print("\n--- 1. Volt/Semitone ---")
test("1V = 12 semitones", q.semitone_from_volt(1.0) == 12.0)
test("0V = 0 semitones", q.semitone_from_volt(0.0) == 0.0)
test("2.5V = 30 semitones", abs(q.semitone_from_volt(2.5) - 30.0) < 0.001)
test("12 semitones = 1V", abs(q.volt_from_semitone(12) - 1.0) < 0.001)
test("0 semitones = 0V", q.volt_from_semitone(0) == 0.0)
test("Rundlauf V→ST→V", abs(q.volt_from_semitone(q.semitone_from_volt(3.7)) - 3.7) < 0.001)
test("-5V → -60 semitones", q.semitone_from_volt(-5.0) == -60.0)
test("10V → 120 semitones", q.semitone_from_volt(10.0) == 120.0)

# === 2. Semitone Class ===
print("\n--- 2. Semitone Class ---")
test("C=0, D=2, E=4, F=5, G=7, A=9, H=11, C=0",
     all([q.semitone_class(0)==0, q.semitone_class(2)==2, q.semitone_class(4)==4,
          q.semitone_class(5)==5, q.semitone_class(7)==7, q.semitone_class(9)==9,
          q.semitone_class(11)==11, q.semitone_class(12)==0]))
test("C# = class 1", q.semitone_class(1) == 1)
test("25 = class 1 (2 Oktaven)", q.semitone_class(25) == 1)
test("-1 = class 11", q.semitone_class(-1) == 11)

# === 3. Chromatic ===
print("\n--- 3. Chromatic Mode ---")
setup()
test("0V → 0", q.quantize(0.0) == 0)
test("1V → 12", q.quantize(12.0) == 12)
test("-1V → -12", q.quantize(-12.0) == -12)
test("0.083V → 1 (C#)", q.quantize(1.0) == 1)

# === 4. Scale Learning ===
print("\n--- 4. Scale Learning ---")
setup()
q.learn_note(0.0)     # C
test("Erste Note: scale=[0]", q.scale == [0])
test("weights[C]=1", q.weights.get(0) == 1)
test("chromatic=False", not q.is_chromatic)

q.learn_note(0.083)   # C# (1)
test("Zweite Note: scale=[0,1]", q.scale == [0, 1])
test("weights[C#]=1", q.weights.get(1) == 1)

# C ist andere Klasse (0) als zuletzt (1) → wird gelernt
q.learn_note(0.0)
test("C nach C# gelernt (versch. Klassen)", q.scale == [0, 1, 0])
test("weights[C]=2", q.weights.get(0) == 2)

# === 5. Quantisierung mit C-Dur Scale ===
print("\n--- 5. Quantisierung mit Scale (C-Dur) ---")
setup()
for note, v in [(0, 0.0), (2, 2/12), (4, 4/12), (5, 5/12), (7, 7/12), (9, 9/12), (11, 11/12)]:
    q.last_learned_class = -1
    q.learn_note(v)

cdur = {0, 2, 4, 5, 7, 9, 11}
test("7 Noten gelernt", len(q.scale) == 7)

# Direkte Treffer
test("C(0V)→C", q.quantize(q.semitone_from_volt(0)) % 12 == 0)
test("D(0.167V)→D", q.quantize(q.semitone_from_volt(0.167)) % 12 == 2)
test("E(0.333V)→E", q.quantize(q.semitone_from_volt(0.333)) % 12 == 4)
test("C#(0.083V)→Scale", q.quantize(q.semitone_from_volt(0.083)) % 12 in cdur)
test("Eb(0.25V)→Scale", q.quantize(q.semitone_from_volt(0.25)) % 12 in cdur)
test("F#(0.5V)→Scale", q.quantize(q.semitone_from_volt(0.5)) % 12 in cdur)
test("Bb(0.833V)→Scale", q.quantize(q.semitone_from_volt(0.833)) % 12 in cdur)

# === 6. Weighted Random ===
print("\n--- 6. Weighted Random ---")
setup()
q.is_chromatic = False
q.scale = [0, 7]       # C und G
q.weights = {0: 10, 7: 1}

results = {0: 0, 7: 0}
for _ in range(500):
    r = q.quantize(q.semitone_from_volt(0.25))
    rc = r % 12
    if rc in results:
        results[rc] += 1
test("C(weight=10) häufiger als G(weight=1)", results[0] > results[7])
print(f"  Glaskugel: C={results[0]}, G={results[7]} ({results[0]/(results[0]+results[7])*100:.0f}% C)")

# === 7. Reset ===
print("\n--- 7. Reset (CV1≈CV2 >5s) ---")
setup()
q.scale = [0, 4, 7]
q.is_chromatic = False

q.update(1.0, 1.05, 1000)  # Diff=0.05 < 0.1 → reset startet
test("noch chromatic=False", not q.is_chromatic)

q.update(1.0, 1.05, 7000)  # >5s später
test("Reset nach >5s", q.is_chromatic)
test("scale leer", not q.scale)
test("weights leer", not q.weights)

setup()
q.scale = [0, 4, 7]
q.is_chromatic = False
q.update(1.0, 1.5, 100)
q.update(1.0, 1.5, 7000)
test("Kein Reset bei Diff=0.5V", not q.is_chromatic)

# === 8. Hysterese CV1 ===
print("\n--- 8. CV1 Hysterese ---")
setup()
out1 = q.update(1.0, 0.0, 100)
test("1V→~1V out", abs(out1 - 1.0) < 0.01)

out2 = q.update(1.02, 0.0, 200)
test("1.02V gleicher Output (Hysterese)", abs(out2 - out1) < 0.01)

out3 = q.update(1.1, 0.0, 300)
test("1.1V quantisiert (sollte ~1.083 oder 1.167)", out3 >= 1.0)

# === 9. Oktaven ===
print("\n--- 9. Oktaven ---")
setup()
for c in [0, 5, 9]:
    q.last_learned_class = -1
    q.learn_note(c / 12)
test("F-Dur Scale (C,F,A)", q.scale == [0, 5, 9])

test("12.5V → C,F,A", q.quantize(q.semitone_from_volt(12.5)) % 12 in {0, 5, 9})
test("36.3V → C,F,A", q.quantize(q.semitone_from_volt(36.3)) % 12 in {0, 5, 9})

# === 10. Integration ===
print("\n--- 10. Integration ---")
setup()
out = q.update(0.0, 0.0, 100)
test("0V in=0V out", abs(out) < 0.01)

out = q.update(1.0, 0.0, 200)
test("1V in=1V out (chromatic)", abs(out - 1.0) < 0.01)

q.update(0.5, 0.0, 300)
q.update(0.5, 0.417, 400)  # F
q.update(0.5, 0.583, 500)  # G
test("Scale = [0,5,7] oder mehr", 0 in q.scale and q.is_chromatic == False)

out = q.update(0.25, 0.0, 600)
test("0.25V → Scale-Note", int(round(out*12)) % 12 in {0, 5, 7})
print(f"  0.25V → {out:.3f}V (class {int(round(out*12))%12})")

# === 11. Edge Cases ===
print("\n--- 11. Edge Cases ---")
setup()
test("-5V = -60 chromatic", q.quantize(-60.0) == -60)
test("leere scale → int", type(q.quantize(0.0)) == int)

q.learn_note(0.0)  # C
out = q.update(-2.5, 0.0, 100)
test("-2.5V → 0 class (C)", int(round(out*12)) % 12 == 0)
print(f"  -2.5V → {out:.3f}V (class {int(round(out*12))%12})")

out = q.update(5.0, 0.0, 200)
test("5V → C-class", int(round(out*12)) % 12 == 0)
print(f"  5V → {out:.3f}V (class {int(round(out*12))%12})")

# === Ergebnis ===
print("\n" + "=" * 60)
total = passed + failed
print(f"ERGEBNIS: {passed}/{total} bestanden, {failed} fehlgeschlagen")
if failed == 0:
    print("🎉 ALLE BESTANDEN!")
else:
    print(f"❌ {failed} Fehler!")
print("=" * 60)