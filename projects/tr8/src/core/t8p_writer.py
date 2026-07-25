"""
TR8 — Pattern-Datei Writer (.t8p)

Schreibt TR-8S-kompatible .t8p Dateien.
ACHTUNG: Das .t8p Format ist weniger erforscht als .t8k.
Dieser Writer ist EXPERIMENTELL und braucht Validierung mit echter Hardware.
"""

import struct
from pathlib import Path
from typing import Optional

from .models import (
    Pattern, Variation, StepPattern, InstrumentType,
    INSTRUMENT_ORDER, encode_name, steps_to_bitmask,
)


class T8PWriter:
    """
    Schreibt .t8p Pattern-Dateien für die Roland TR-8S.

    Basierend auf:
    - TR-8 Text-Format (Step-Bitmasks sind bestätigt)
    - .t8p Binary Format (Header-Struktur ist vermutet)

    Usage:
        pattern = Pattern(name="My Beat", tempo=125.0)
        pattern.variations[0].set_step(InstrumentType.BD, 0)
        pattern.variations[0].set_step(InstrumentType.CH, 0)
        writer = T8PWriter(pattern)
        writer.write("output/MyBeat.t8p")
    """

    def __init__(self, pattern: Pattern):
        self.pattern = pattern

    def _build_chunk(self, magic: bytes, data: bytes) -> bytes:
        """Baue einen Chunk: Magic + Size + Data."""
        return magic + struct.pack("<I", len(data)) + data

    def _build_header(self) -> bytes:
        """Baue den T8P File Header."""
        # Header-Struktur ist vermutet
        # Wir verwenden einen einfachen Header
        header = bytearray()
        header.extend(b'T8P ')
        # Version / Flags (vermutet)
        header.extend(struct.pack("<I", 0x01000000))  # Version 1.0?
        header.extend(b'\x00' * 8)  # Reserved
        return bytes(header)

    def _build_name_chunk(self) -> bytes:
        """Baue den NAME Chunk."""
        name_bytes = encode_name(self.pattern.name, 16)
        return self._build_chunk(b'NAME', name_bytes)

    def _encode_variation(self, variation: Variation) -> bytes:
        """
        Kodiere eine Variation als Binary Data.

        Struktur (basierend auf TR-8 Text-Format):
        - 2 Bytes: last_step (uint16 LE)
        - 2 Bytes pro Instrument: Step-Bitmask (uint16 LE)
        - 2 Bytes pro Instrument: Accent-Bitmask (uint16 LE)
        - 2 Bytes pro Instrument: Flam-Bitmask (uint16 LE)
        - 2 Bytes: Global Accent Steps
        - 2 Bytes: Reverb Steps
        - 2 Bytes: Delay Steps
        - 2 Bytes: Sidechain Steps
        """
        data = bytearray()

        # Last Step
        data.extend(struct.pack("<H", variation.last_step))

        # Step-Bitmasks (11 Instrumente × 2 Bytes)
        for inst in INSTRUMENT_ORDER:
            pattern = variation.instruments[inst]
            data.extend(struct.pack("<H", pattern.to_bitmask()))

        # Accent-Bitmasks
        for inst in INSTRUMENT_ORDER:
            pattern = variation.instruments[inst]
            data.extend(struct.pack("<H", pattern.accent_bitmask()))

        # Flam-Bitmasks
        for inst in INSTRUMENT_ORDER:
            pattern = variation.instruments[inst]
            data.extend(struct.pack("<H", pattern.flam_bitmask()))

        # Global Steps
        data.extend(struct.pack("<H", steps_to_bitmask(variation.accent_steps)))
        data.extend(struct.pack("<H", steps_to_bitmask(variation.reverb_steps)))
        data.extend(struct.pack("<H", steps_to_bitmask(variation.delay_steps)))
        data.extend(struct.pack("<H", steps_to_bitmask(variation.sidechain_steps)))

        return bytes(data)

    def _build_pattern_chunk(self) -> bytes:
        """
        Baue den PTN Chunk mit allen Variationen.

        Struktur:
        - 1 Byte: active_variations
        - 1 Byte: scale
        - 2 Bytes: swing
        - 4 Bytes: tempo (float32 LE)
        - 1 Byte: kit_slot
        - N Bytes: Variation Data (× 8)
        - N Bytes: Fill-In Data (× 2)
        """
        data = bytearray()

        # Pattern-Parameter
        data.append(self.pattern.active_variations & 0xFF)
        data.append(self.pattern.scale & 0xFF)
        data.extend(struct.pack("<H", self.pattern.swing & 0xFFFF))
        data.extend(struct.pack("<f", self.pattern.tempo))
        data.append(self.pattern.kit_slot & 0xFF)

        # Variationen A-H
        for variation in self.pattern.variations:
            data.extend(self._encode_variation(variation))

        # Fill-Ins
        for fill in self.pattern.fill_ins:
            data.extend(self._encode_variation(fill))

        return self._build_chunk(b'PTN ', bytes(data))

    def build(self) -> bytes:
        """Baue die komplette .t8p Datei."""
        chunks = bytearray()

        # Header
        chunks.extend(self._build_header())

        # Name
        chunks.extend(self._build_name_chunk())

        # Pattern Data
        chunks.extend(self._build_pattern_chunk())

        return bytes(chunks)

    def write(self, path: str):
        """Schreibe die .t8p Datei."""
        data = self.build()
        output = Path(path)
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "wb") as f:
            f.write(data)

        # Companion .txt Datei
        txt_path = output.with_suffix(".txt")
        with open(txt_path, "w") as f:
            f.write(self._build_txt())

    def _build_txt(self) -> str:
        """Baue die Begleit-.txt Datei (TR-8 Text-Format kompatibel)."""
        p = self.pattern
        lines = [
            f"; Pattern: {p.name}",
            f"; Tempo: {p.tempo}",
            f"; Kit: {p.kit_slot}",
            "",
            "[PATTERN]",
            f'NAME = "{p.name}"',
            f"TEMPO = {p.tempo:.1f}",
            f"KIT = {p.kit_slot}",
            f"SWING = {p.swing}",
            f"SCALE = {p.scale}",
            f"VARIATIONS = {p.active_variations}",
            "",
        ]

        # Variationen
        for vi, var in enumerate(p.variations[:p.active_variations]):
            var_letter = chr(65 + vi)  # A, B, C...
            lines.append(f"[VARIATION {var_letter}]")
            lines.append(f"LAST_STEP = {var.last_step}")

            for inst in INSTRUMENT_ORDER:
                pattern = var.instruments[inst]
                step_str = "".join("X" if s else "O" for s in pattern.steps)
                # Format: BD XOXO OOOX OXXX OOOX
                formatted = " ".join(
                    step_str[i:i + 4] for i in range(0, 16, 4)
                )
                lines.append(f"{inst.value} {formatted}")
            lines.append("")

        return "\n".join(lines) + "\n"
