"""
TR8 Unit Tests — Basis-Tests für Datenmodelle und Writer.
"""

import sys
import struct
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.models import (
    Kit, Pattern, Variation, StepPattern, InstrumentType,
    INSTRUMENT_ORDER, steps_to_bitmask, bitmask_to_steps,
    encode_name, decode_name,
)
from core.t8k_writer import T8KWriter
from core.t8p_writer import T8PWriter


def test_step_bitmask():
    """Test: Step-Bitmask Encoding/Decoding (wie im TR-8 Text-Format)."""
    # BD XOXO OOOX OXXX OOOX = Steps 1,3,8,10,11,12,16
    steps = [True, False, True, False, False, False, False, True,
             False, True, True, True, False, False, False, True]
    mask = steps_to_bitmask(steps)
    assert mask == 36485, f"Expected 36485, got {mask}"

    # Decode
    decoded = bitmask_to_steps(mask)
    assert decoded == steps

    print("✅ Step Bitmask: OK")


def test_step_pattern():
    """Test: StepPattern Klasse."""
    p = StepPattern()
    assert len(p.steps) == 16
    assert all(not s for s in p.steps)

    p.set_step(0)
    p.set_step(4)
    p.toggle_step(4)  # Off
    p.toggle_step(8)  # On

    assert p.steps[0] == True
    assert p.steps[4] == False
    assert p.steps[8] == True

    mask = p.to_bitmask()
    assert mask == (1 << 0) | (1 << 8)  # 1 + 256 = 257

    print("✅ StepPattern: OK")


def test_kit():
    """Test: Kit Datenmodell."""
    kit = Kit(name="Test Kit", slot=5)
    assert kit.name == "Test Kit"
    assert kit.slot == 5
    assert len(kit.instruments) == 11

    kit.set_instrument(InstrumentType.BD, tune=80, decay=50, level=100)
    assert kit.instruments[InstrumentType.BD].tune == 80
    assert kit.instruments[InstrumentType.BD].decay == 50

    print("✅ Kit: OK")


def test_pattern():
    """Test: Pattern Datenmodell."""
    pattern = Pattern(name="Test Pattern", tempo=125.0)
    assert pattern.name == "Test Pattern"
    assert pattern.tempo == 125.0

    var = pattern.get_variation(0)
    var.set_step(InstrumentType.BD, 0)
    var.set_step(InstrumentType.CH, 0)
    var.set_step(InstrumentType.CH, 4)

    assert var.get_pattern(InstrumentType.BD).steps[0] == True
    assert var.get_pattern(InstrumentType.CH).steps[0] == True
    assert var.get_pattern(InstrumentType.CH).steps[4] == True
    assert var.get_pattern(InstrumentType.SD).steps[0] == False

    print("✅ Pattern: OK")


def test_name_encoding():
    """Test: Name Encoding/Decoding."""
    name = "My Kit"
    encoded = encode_name(name, 16)
    assert len(encoded) == 16
    assert decode_name(encoded) == "My Kit"

    # Null-Terminierung
    assert encoded[6] == 0

    print("✅ Name Encoding: OK")


def test_t8p_writer():
    """Test: T8P Writer erzeugt gültige Datei."""
    pattern = Pattern(name="Test", tempo=120.0, swing=0, scale=2)

    # BD auf Steps 1, 5, 9, 13 (Four-on-the-floor)
    for i in range(0, 16, 4):
        pattern.variations[0].set_step(InstrumentType.BD, i)

    # CH auf allen Steps
    for i in range(16):
        pattern.variations[0].set_step(InstrumentType.CH, i)

    writer = T8PWriter(pattern)
    data = writer.build()

    # Header prüfen
    assert data[:4] == b'T8P ', f"Expected T8P header, got {data[:4]}"
    assert len(data) > 20, "File too small"

    # NAME Chunk finden
    name_pos = data.find(b'NAME')
    assert name_pos > 0, "NAME chunk not found"

    print("✅ T8P Writer: OK")


def test_t8k_writer():
    """Test: T8K Writer erzeugt gültige Datei (ohne Samples)."""
    kit = Kit(name="Test Kit", slot=0)
    writer = T8KWriter(kit)
    data = writer.build()

    # Header prüfen
    assert data[:4] == b'T8K ', f"Expected T8K header, got {data[:4]}"
    assert len(data) > 20, "File too small"

    # NAME Chunk finden
    name_pos = data.find(b'NAME')
    assert name_pos > 0, "NAME chunk not found"

    # KIT Chunk finden
    kit_pos = data.find(b'KIT ')
    assert kit_pos > 0, "KIT chunk not found"

    # TONE Chunk finden
    tone_pos = data.find(b'TONE')
    assert tone_pos > 0, "TONE chunk not found"

    print("✅ T8K Writer: OK")


def test_txt_output():
    """Test: TXT Begleitdatei wird erzeugt."""
    pattern = Pattern(name="Demo", tempo=125.0)
    pattern.variations[0].set_step(InstrumentType.BD, 0)
    pattern.variations[0].set_step(InstrumentType.CH, 0)

    writer = T8PWriter(pattern)
    txt = writer._build_txt()

    assert "Demo" in txt
    assert "125.0" in txt
    assert "BD" in txt
    assert "X" in txt

    print("✅ TXT Output: OK")


if __name__ == "__main__":
    test_step_bitmask()
    test_step_pattern()
    test_kit()
    test_pattern()
    test_name_encoding()
    test_t8p_writer()
    test_t8k_writer()
    test_txt_output()
    print("\n🎉 Alle Tests bestanden!")
