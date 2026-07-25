"""
TR8 — Roland TR-8S Pattern & Kit Generator
Datenmodelle für Kits, Patterns und Instrumente.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class InstrumentType(Enum):
    """Die 11 Instrumente der TR-8S."""
    BD = "BD"   # Bass Drum
    SD = "SD"   # Snare Drum
    LT = "LT"   # Low Tom
    MT = "MT"   # Mid Tom
    HT = "HT"   # Hi Tom
    RS = "RS"   # Rimshot
    HC = "HC"   # Handclap
    CH = "CH"   # Closed Hi-Hat
    OH = "OH"   # Open Hi-Hat
    CC = "CC"   # Crash Cymbal
    RC = "RC"   # Ride Cymbal


# Default MIDI Note Numbers
DEFAULT_NOTES = {
    InstrumentType.BD: 36,
    InstrumentType.SD: 38,
    InstrumentType.LT: 43,
    InstrumentType.MT: 47,
    InstrumentType.HT: 50,
    InstrumentType.RS: 37,
    InstrumentType.HC: 39,
    InstrumentType.CH: 42,
    InstrumentType.OH: 46,
    InstrumentType.CC: 49,
    InstrumentType.RC: 51,
}

ALT_NOTES = {
    InstrumentType.BD: 35,
    InstrumentType.SD: 40,
    InstrumentType.LT: 41,
    InstrumentType.MT: 45,
    InstrumentType.HT: 48,
    InstrumentType.RS: 56,
    InstrumentType.HC: 54,
    InstrumentType.CH: 44,
    InstrumentType.OH: 58,
    InstrumentType.CC: 61,
    InstrumentType.RC: 63,
}

# CC Numbers für Parameter
CC_NUMBERS = {
    "BD_TUNE": 20, "BD_DECAY": 23, "BD_LEVEL": 24, "BD_CTRL": 96,
    "SD_TUNE": 25, "SD_DECAY": 28, "SD_LEVEL": 29, "SD_CTRL": 97,
    "LT_TUNE": 46, "LT_DECAY": 47, "LT_LEVEL": 48, "LT_CTRL": 102,
    "MT_TUNE": 49, "MT_DECAY": 50, "MT_LEVEL": 51, "MT_CTRL": 103,
    "HT_TUNE": 52, "HT_DECAY": 53, "HT_LEVEL": 54, "HT_CTRL": 104,
    "RS_TUNE": 55, "RS_DECAY": 56, "RS_LEVEL": 57, "RS_CTRL": 105,
    "HC_TUNE": 58, "HC_DECAY": 59, "HC_LEVEL": 60, "HC_CTRL": 106,
    "CH_TUNE": 61, "CH_DECAY": 62, "CH_LEVEL": 63, "CH_CTRL": 107,
    "OH_TUNE": 80, "OH_DECAY": 81, "OH_LEVEL": 82, "OH_CTRL": 108,
    "CC_TUNE": 83, "CC_DECAY": 84, "CC_LEVEL": 85, "CC_CTRL": 109,
    "RC_TUNE": 86, "RC_DECAY": 87, "RC_LEVEL": 88, "RC_CTRL": 110,
    "SHUFFLE": 9, "EXT_IN": 12, "AFILLTG": 70, "ACCENT": 71,
}

INSTRUMENT_ORDER = [
    InstrumentType.BD, InstrumentType.SD,
    InstrumentType.LT, InstrumentType.MT, InstrumentType.HT,
    InstrumentType.RS, InstrumentType.HC,
    InstrumentType.CH, InstrumentType.OH,
    InstrumentType.CC, InstrumentType.RC,
]


@dataclass
class InstrumentParams:
    """Parameter für ein einzelnes Instrument im Kit."""
    tune: int = 64       # 0-127, Mitte = 64
    decay: int = 64      # 0-127
    level: int = 100     # 0-127
    ctrl: int = 64       # Model-spezifisch
    use_alt: bool = False  # Alternativen Sound verwenden


@dataclass
class Kit:
    """Ein TR-8S Kit (128 Slots verfügbar)."""
    name: str = "INIT KIT"
    slot: int = 0  # 0-127
    instruments: dict[InstrumentType, InstrumentParams] = field(
        default_factory=lambda: {inst: InstrumentParams() for inst in InstrumentType}
    )
    # Reverb & Delay pro Instrument (0-127)
    reverb_send: dict[InstrumentType, int] = field(
        default_factory=lambda: {inst: 0 for inst in InstrumentType}
    )
    delay_send: dict[InstrumentType, int] = field(
        default_factory=lambda: {inst: 0 for inst in InstrumentType}
    )
    # Master FX
    reverb_type: int = 0
    reverb_time: int = 64
    reverb_level: int = 64
    delay_type: int = 0
    delay_time: int = 64
    delay_level: int = 64

    def set_instrument(self, inst: InstrumentType, **kwargs):
        """Setze Parameter für ein Instrument."""
        params = self.instruments[inst]
        for key, value in kwargs.items():
            if hasattr(params, key):
                setattr(params, key, value)


@dataclass
class StepPattern:
    """Step-Pattern für ein Instrument (16 Steps)."""
    steps: list[bool] = field(default_factory=lambda: [False] * 16)
    accents: list[bool] = field(default_factory=lambda: [False] * 16)
    flams: list[bool] = field(default_factory=lambda: [False] * 16)
    # Sub-Steps (0, 2, 3, 4 pro Step — 0 = kein Sub-Step)
    sub_steps: list[int] = field(default_factory=lambda: [0] * 16)

    def set_step(self, step: int, active: bool = True):
        """Setze Step 0-15."""
        self.steps[step] = active

    def toggle_step(self, step: int):
        """Toggle Step 0-15."""
        self.steps[step] = not self.steps[step]

    def to_bitmask(self) -> int:
        """Konvertiere Steps zu 16-Bit-Bitmaske."""
        mask = 0
        for i, active in enumerate(self.steps):
            if active:
                mask |= (1 << i)
        return mask

    @classmethod
    def from_bitmask(cls, mask: int) -> "StepPattern":
        """Erstelle StepPattern aus 16-Bit-Bitmaske."""
        steps = [bool(mask & (1 << i)) for i in range(16)]
        return cls(steps=steps)

    def accent_bitmask(self) -> int:
        mask = 0
        for i, active in enumerate(self.accents):
            if active:
                mask |= (1 << i)
        return mask

    def flam_bitmask(self) -> int:
        mask = 0
        for i, active in enumerate(self.flams):
            if active:
                mask |= (1 << i)
        return mask


@dataclass
class Variation:
    """Eine Pattern-Variation (A-H) mit 11 Instrument-Tracks."""
    instruments: dict[InstrumentType, StepPattern] = field(
        default_factory=lambda: {inst: StepPattern() for inst in InstrumentType}
    )
    last_step: int = 15  # 0-15 (1-16 Steps)
    # Global Accent/Effect Steps
    accent_steps: list[bool] = field(default_factory=lambda: [False] * 16)
    reverb_steps: list[bool] = field(default_factory=lambda: [False] * 16)
    delay_steps: list[bool] = field(default_factory=lambda: [False] * 16)
    sidechain_steps: list[bool] = field(default_factory=lambda: [False] * 16)

    def get_pattern(self, inst: InstrumentType) -> StepPattern:
        return self.instruments[inst]

    def set_step(self, inst: InstrumentType, step: int, active: bool = True):
        self.instruments[inst].set_step(step, active)

    def toggle_step(self, inst: InstrumentType, step: int):
        self.instruments[inst].toggle_step(step)


@dataclass
class Pattern:
    """Ein TR-8S Pattern (128 Slots, 8 Variationen + 2 Fills)."""
    name: str = "INIT PATTERN"
    slot: int = 0  # 0-127
    tempo: float = 120.0  # BPM
    swing: int = 0  # 0-127 (Shuffle)
    kit_slot: int = 0  # Verknüpftes Kit (0-127)
    scale: int = 2  # 1=1/8, 2=1/16
    variations: list[Variation] = field(
        default_factory=lambda: [Variation() for _ in range(8)]
    )
    fill_ins: list[Variation] = field(
        default_factory=lambda: [Variation() for _ in range(2)]
    )
    active_variations: int = 1  # Wie viele Variationen aktiv sind (1-8)

    def get_variation(self, index: int) -> Variation:
        """Hole Variation 0-7 (A-H)."""
        return self.variations[index]

    def get_fill(self, index: int) -> Variation:
        """Hole Fill-In 0-1."""
        return self.fill_ins[index]


# === Binary Encoding Utilities ===

def steps_to_bitmask(steps: list[bool]) -> int:
    """Konvertiere 16 Boolean-Steps zu 16-Bit Integer."""
    mask = 0
    for i, active in enumerate(steps):
        if active:
            mask |= (1 << i)
    return mask


def bitmask_to_steps(mask: int) -> list[bool]:
    """Konvertiere 16-Bit Integer zu 16 Boolean-Steps."""
    return [bool(mask & (1 << i)) for i in range(16)]


def encode_name(name: str, length: int = 16) -> bytes:
    """Kodiere Name als null-terminierte ASCII-Bytes."""
    encoded = name.encode("ascii", errors="replace")[:length - 1]
    return encoded.ljust(length, b"\x00")


def decode_name(data: bytes) -> str:
    """Dekodiere null-terminierten ASCII-Namen."""
    return data.split(b"\x00")[0].decode("ascii", errors="replace").strip()
