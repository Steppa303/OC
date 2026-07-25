"""
TR8 — Kit-Datei Writer (.t8k)

Schreibt TR-8S-kompatible .t8k Dateien.
ACHTUNG: Das .t8k Format ist proprietär und nicht vollständig dokumentiert.
Dieser Writer basiert auf Reverse Engineering und kann fehlerhaft sein.
Validierung mit echter Hardware ist erforderlich!
"""

import struct
import binascii
from pathlib import Path
from typing import Optional

from .models import (
    Kit, InstrumentType, InstrumentParams, INSTRUMENT_ORDER,
    encode_name,
)


# WAV Header für 44.1kHz/16bit/Mono PCM
WAV_HEADER_PREFIX = b'\x52\x49\x46\x46'  # "RIFF"
WAV_HEADER_REST = (
    b'\x57\x41\x56\x45'  # "WAVE"
    b'\x66\x6D\x74\x20'  # "fmt "
    b'\x10\x00\x00\x00'  # 16 (PCM chunk size)
    b'\x01\x00'          # PCM format
    b'\x01\x00'          # 1 channel (mono)
    b'\x44\xAC\x00\x00'  # 44100 Hz
    b'\x88\x58\x01\x00'  # 88200 byte rate
    b'\x02\x00'          # 2 block align
    b'\x10\x00'          # 16 bits per sample
    b'\x64\x61\x74\x61'  # "data"
)


class T8KWriter:
    """
    Schreibt .t8k Kit-Dateien für die Roland TR-8S.

    Usage:
        writer = T8KWriter(kit)
        writer.add_sample(InstrumentType.BD, "path/to/kick.wav")
        writer.write("output/MyKit.t8k")
    """

    def __init__(self, kit: Kit):
        self.kit = kit
        self.samples: dict[InstrumentType, bytes] = {}  # PCM data (raw)
        self.sample_names: dict[InstrumentType, str] = {}

    def add_sample(self, inst: InstrumentType, wav_path: str):
        """
        Lade ein WAV-Sample und extrahiere die PCM-Daten.
        Muss 44.1kHz/16bit/Mono sein.
        """
        path = Path(wav_path)
        if not path.exists():
            raise FileNotFoundError(f"Sample nicht gefunden: {wav_path}")

        with open(path, "rb") as f:
            data = f.read()

        # WAV parsen (vereinfacht — erwartet Standard-Format)
        pcm_data = self._extract_pcm(data)
        self.samples[inst] = pcm_data
        self.sample_names[inst] = path.stem[:15]  # Max 15 Zeichen

    def add_raw_pcm(self, inst: InstrumentType, pcm_data: bytes, name: str = ""):
        """Füge rohe PCM-Daten hinzu (44.1kHz/16bit/Mono)."""
        self.samples[inst] = pcm_data
        self.sample_names[inst] = name[:15] if name else inst.value

    def _extract_pcm(self, wav_data: bytes) -> bytes:
        """Extrahiere PCM-Daten aus WAV-Datei."""
        if wav_data[:4] != b'RIFF':
            raise ValueError("Keine gültige WAV-Datei (kein RIFF Header)")

        # Finde den 'data' Chunk
        pos = 12  # Nach RIFF header
        while pos < len(wav_data) - 8:
            chunk_id = wav_data[pos:pos + 4]
            chunk_size = struct.unpack_from("<I", wav_data, pos + 4)[0]

            if chunk_id == b'data':
                return wav_data[pos + 8:pos + 8 + chunk_size]

            # Nächster Chunk (Chunks sind 2-byte-aligned)
            pos += 8 + chunk_size
            if chunk_size % 2 != 0:
                pos += 1

        raise ValueError("Kein 'data' Chunk in WAV-Datei gefunden")

    def _build_chunk(self, magic: bytes, data: bytes) -> bytes:
        """Baue einen einzelnen Chunk: Magic + Size + Data."""
        assert len(magic) == 4, f"Magic muss 4 Bytes sein, ist {len(magic)}"
        return magic + struct.pack("<I", len(data)) + data

    def _build_t8k_header(self) -> bytes:
        """Baue den T8K File Header."""
        # Version / File-Type Marker
        # Geniale Struktur unbannnt — wir verwenden das was wir wissen
        header = b'\x00' * 16  # Placeholder für Header-Daten
        return header

    def _build_name_chunk(self) -> bytes:
        """Baue den NAME Chunk mit dem Kit-Namen."""
        name_bytes = encode_name(self.kit.name, 16)
        return self._build_chunk(b'NAME', name_bytes)

    def _build_kit_chunk(self) -> bytes:
        """
        Baue den KIT Chunk mit Instrument-Parametern.

        Struktur (vermutet, pro Instrument):
        - Tune: 1 Byte (0-127)
        - Decay: 1 Byte (0-127)
        - Level: 1 Byte (0-127)
        - Ctrl: 1 Byte (0-127)
        - Flags: 1 Byte (use_alt, etc.)
        """
        data = bytearray()
        for inst in INSTRUMENT_ORDER:
            params = self.kit.instruments[inst]
            data.extend([
                params.tune & 0x7F,
                params.decay & 0x7F,
                params.level & 0x7F,
                params.ctrl & 0x7F,
                0x01 if params.use_alt else 0x00,
            ])

        # Reverb/Delay Send pro Instrument
        for inst in INSTRUMENT_ORDER:
            data.append(self.kit.reverb_send.get(inst, 0) & 0x7F)
        for inst in INSTRUMENT_ORDER:
            data.append(self.kit.delay_send.get(inst, 0) & 0x7F)

        # Master FX
        data.extend([
            self.kit.reverb_type & 0x7F,
            self.kit.reverb_time & 0x7F,
            self.kit.reverb_level & 0x7F,
            self.kit.delay_type & 0x7F,
            self.kit.delay_time & 0x7F,
            self.kit.delay_level & 0x7F,
        ])

        return self._build_chunk(b'KIT ', bytes(data))

    def _build_tone_chunk(self) -> bytes:
        """
        Baue den TONE Chunk mit Wave-Namen.

        Struktur:
        [0x10] Anzahl Waves (uint32 LE)
        [0x20 + j*0x24] Wave-Name (16 Bytes) pro Wave
        """
        wave_count = len(self.samples)
        data = bytearray(b'\x00' * 0x10)  # Padding bis Offset 0x10
        data.extend(struct.pack("<I", wave_count))
        data.extend(b'\x00' * (0x20 - len(data)))  # Padding bis Offset 0x20

        for inst in INSTRUMENT_ORDER:
            if inst in self.sample_names:
                name = encode_name(self.sample_names[inst], 16)
            else:
                name = encode_name("", 16)
            # Wave-Name + Padding auf 0x24 Bytes
            data.extend(name.ljust(0x24, b'\x00'))

        return self._build_chunk(b'TONE', bytes(data))

    def _build_smpl_chunk(self, inst: InstrumentType) -> Optional[bytes]:
        """Baue einen SMPL Chunk für ein Instrument."""
        if inst not in self.samples:
            return None

        pcm_data = self.samples[inst]
        crc = binascii.crc32(pcm_data) & 0xFFFFFFFF

        # SMPL Header: Size + CRC32 + CRC32(header)
        header_data = struct.pack("<I", len(pcm_data)) + struct.pack("<I", crc)
        header_crc = binascii.crc32(header_data) & 0xFFFFFFFF
        header_data += struct.pack("<I", header_crc)

        return b'SMPL' + header_data + pcm_data

    def build(self) -> bytes:
        """Baue die komplette .t8k Datei."""
        chunks = bytearray()

        # File Header
        chunks.extend(b'T8K ')
        chunks.extend(self._build_t8k_header())

        # Name
        chunks.extend(self._build_name_chunk())

        # Kit Parameters
        chunks.extend(self._build_kit_chunk())

        # Tone/Wave Names
        chunks.extend(self._build_tone_chunk())

        # PCMT (PCM Table) — Platzhalter
        # TODO: Korrekte PCMT Struktur herausfinden
        chunks.extend(self._build_chunk(b'PCMT', b'\x00' * 64))

        # WAVE — Platzhalter
        chunks.extend(self._build_chunk(b'WAVE', b'\x00' * 64))

        # SMPL Chunks (eines pro Instrument mit Sample)
        for inst in INSTRUMENT_ORDER:
            smpl = self._build_smpl_chunk(inst)
            if smpl:
                chunks.extend(smpl)

        return bytes(chunks)

    def write(self, path: str):
        """Schreibe die .t8k Datei."""
        data = self.build()
        output = Path(path)
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "wb") as f:
            f.write(data)

        # Companion .txt Datei schreiben
        txt_path = output.with_suffix(".txt")
        with open(txt_path, "w") as f:
            f.write(self._build_txt())

    def _build_txt(self) -> str:
        """Baue die Begleit-.txt Datei."""
        lines = [
            f"; Kit: {self.kit.name}",
            f"; Slot: {self.kit.slot}",
            "",
            "[KIT]",
            f'NAME = "{self.kit.name}"',
            "",
            "[INSTRUMENTS]",
        ]
        for inst in INSTRUMENT_ORDER:
            params = self.kit.instruments[inst]
            alt = " (ALT)" if params.use_alt else ""
            sample = self.sample_names.get(inst, "INIT")
            lines.append(
                f"{inst.value} = \"{sample}\" T:{params.tune} "
                f"D:{params.decay} L:{params.level}{alt}"
            )
        return "\n".join(lines) + "\n"
