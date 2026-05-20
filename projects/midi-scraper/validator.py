"""
MIDI-Validator und Metadaten-Extraktor.
Prüft heruntergeladene Dateien auf Gültigkeit und extrahiert
Metadaten wie Titel, BPM, Tracks, Duration etc.
"""

import os
import logging

import mido
from tqdm import tqdm

from utils import get_logger, compute_md5

logger = get_logger(__name__)

# Standard-MIDI-Noten zu Key-Namen Mapping
KEY_NAMES = [
    "C", "C#/Db", "D", "D#/Eb", "E", "F",
    "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"
]


class MidiValidator:
    """
    Validiert MIDI-Dateien und extrahiert Metadaten.
    """

    def __init__(self, config, db):
        """
        Initialisiert den Validator.
        config: Konfigurations-Dict
        db: MidiDatabase-Instanz
        """
        self.config = config
        self.db = db
        self.min_size_kb = config.get("download", {}).get("min_file_size_kb", 1)
        self.results = {
            "total": 0,
            "valid": 0,
            "invalid": 0,
            "skipped": 0,
            "errors": []
        }

    def validate_all(self, directory=None):
        """
        Validiert alle MIDI-Dateien im angegebenen Verzeichnis.
        Wenn directory=None, wird das Downloads-Verzeichnis verwendet.
        """
        if directory is None:
            directory = os.path.join(
                self.config.get("output_dir", "midi-collection"),
                "downloads"
            )

        if not os.path.exists(directory):
            logger.error(f"Verzeichnis nicht gefunden: {directory}")
            return self.results

        # Finde alle MIDI-Dateien
        midi_files = []
        for root, dirs, files in os.walk(directory):
            for file in files:
                if file.lower().endswith((".mid", ".midi")):
                    midi_files.append(os.path.join(root, file))

        self.results["total"] = len(midi_files)
        logger.info(f"Validiere {len(midi_files)} MIDI-Dateien...")

        for file_path in tqdm(midi_files, desc="Validierung", unit="file"):
            self._validate_file(file_path)

        logger.info(
            f"Validierung abgeschlossen: {self.results['valid']} valide, "
            f"{self.results['invalid']} invalide, {self.results['skipped']} übersprungen"
        )
        return self.results

    def _validate_file(self, file_path):
        """
        Validiert eine einzelne MIDI-Datei.
        """
        filename = os.path.basename(file_path)

        try:
            # Prüfe Mindestgröße
            file_size = os.path.getsize(file_path)
            if file_size < self.min_size_kb * 1024:
                logger.warning(f"Datei zu klein: {filename} ({file_size} Bytes)")
                self.results["invalid"] += 1
                self.db.mark_invalid(filename, f"Datei zu klein: {file_size} Bytes")
                return

            # Versuche MIDI zu laden
            try:
                mid = mido.MidiFile(file_path)
            except Exception as e:
                logger.warning(f"Ungültige MIDI-Datei: {filename} - {e}")
                self.results["invalid"] += 1
                self.db.mark_invalid(filename, f"mido Fehler: {str(e)}")
                return

            # Extrahiere Metadaten
            metadata = self._extract_metadata(mid, file_path, filename)

            # Speichere in Datenbank
            # Finde URL für diese Datei
            cursor = self.db.conn.cursor()
            cursor.execute(
                "SELECT url FROM downloads WHERE filename = ? OR file_path = ?",
                (filename, file_path)
            )
            row = cursor.fetchone()
            url = row["url"] if row else None

            if url:
                self.db.add_metadata(url, metadata)
            else:
                # Direktes Speichern ohne URL-Referenz
                cursor.execute("""
                    INSERT INTO midi_metadata
                        (filename, title, num_tracks, bpm, key_signature,
                         time_signature, duration_seconds, validated)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                """, (
                    filename,
                    metadata.get("title"),
                    metadata.get("num_tracks"),
                    metadata.get("bpm"),
                    metadata.get("key_signature"),
                    metadata.get("time_signature"),
                    metadata.get("duration_seconds")
                ))
                self.db.conn.commit()

            self.results["valid"] += 1
            logger.debug(f"Valide: {filename} - {metadata.get('title', 'Unknown')}")

        except Exception as e:
            logger.error(f"Fehler bei der Validierung von {filename}: {e}")
            self.results["errors"].append({"file": filename, "error": str(e)})
            self.results["invalid"] += 1

    def _extract_metadata(self, mid, file_path, filename):
        """
        Extrahiert Metadaten aus einer MIDI-Datei.
        """
        metadata = {
            "file_path": file_path,
            "num_tracks": len(mid.tracks),
            "bpm": None,
            "key_signature": None,
            "time_signature": None,
            "duration_seconds": None,
            "title": None
        }

        # Titel aus Track-Namen extrahieren
        for track in mid.tracks:
            for msg in track:
                if msg.type == "track_name" and msg.name:
                    metadata["title"] = msg.name
                    break
            if metadata["title"]:
                break

        if not metadata["title"]:
            metadata["title"] = os.path.splitext(filename)[0]

        # BPM und Time-Signature aus Meta-Nachrichten
        ticks_per_beat = mid.ticks_per_beat
        total_ticks = 0

        for track in mid.tracks:
            track_ticks = 0
            for msg in track:
                track_ticks += msg.time

                if msg.type == "set_tempo":
                    metadata["bpm"] = mido.tempo2bpm(msg.tempo)

                elif msg.type == "time_signature":
                    metadata["time_signature"] = (
                        f"{msg.numerator}/{msg.denominator}"
                    )

            if track_ticks > total_ticks:
                total_ticks = track_ticks

        # Duration berechnen
        if ticks_per_beat > 0 and metadata["bpm"]:
            beats = total_ticks / ticks_per_beat
            metadata["duration_seconds"] = round(beats / metadata["bpm"] * 60, 2)
        else:
            metadata["duration_seconds"] = 0.0

        # Key Signature schätzen (falls nicht in MIDI enthalten)
        # MIDI-Dateien enthalten selten Key-Signaturen direkt
        # Wir lassen es als None

        # MD5-Hash
        metadata["md5"] = compute_md5(file_path)

        return metadata

    def validate_single(self, file_path):
        """
        Validiert eine einzelne Datei und gibt Metadaten zurück.
        """
        try:
            mid = mido.MidiFile(file_path)
            filename = os.path.basename(file_path)
            metadata = self._extract_metadata(mid, file_path, filename)
            return {"valid": True, "metadata": metadata}
        except Exception as e:
            return {"valid": False, "error": str(e)}

    def get_results(self):
        """Gibt Validierungs-Ergebnisse zurück."""
        return self.results.copy()
