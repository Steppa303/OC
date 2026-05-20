"""
Organizer für MIDI-Sammlung.
Erstellt die Ordnerstruktur, sortiert Dateien nach Genre
und erstellt den metadata.json Index.
"""

import os
import json
import shutil
import logging
from datetime import datetime

from tqdm import tqdm

from utils import get_logger, sanitize_filename, get_genre_folder

logger = get_logger(__name__)


class MidiOrganizer:
    """
    Organisiert die MIDI-Sammlung in eine strukturierte Ordnerhierarchie.
    """

    def __init__(self, config, db):
        """
        Initialisiert den Organizer.
        config: Konfigurations-Dict
        db: MidiDatabase-Instanz
        """
        self.config = config
        self.db = db
        self.output_dir = config.get("output_dir", "midi-collection")
        self.genre_map = config.get("genre_keywords", {})

    def create_structure(self):
        """
        Erstellt die vollständige Ordnerstruktur.
        """
        genres = list(self.genre_map.keys())
        subdirs = [
            "downloads",
            "unsorted",
        ] + [f"by-genre/{get_genre_folder(g)}" for g in genres]

        for subdir in subdirs:
            path = os.path.join(self.output_dir, subdir)
            os.makedirs(path, exist_ok=True)

        logger.info(f"Ordnerstruktur erstellt in: {self.output_dir}")
        return self.output_dir

    def organize_by_genre(self):
        """
        Sortiert MIDI-Dateien nach Genre in die by-genre/ Ordner.
        """
        logger.info("Sortiere MIDI-Dateien nach Genre...")

        # Hole alle fertigen Downloads
        downloads = self.db.get_all_downloads()
        done_downloads = [d for d in downloads if d["status"] == "done"]

        organized = 0
        unsorted = 0

        for download in tqdm(done_downloads, desc="Organisieren", unit="file"):
            file_path = download["file_path"]
            genre = download["genre"]

            if not file_path or not os.path.exists(file_path):
                logger.warning(f"Datei nicht gefunden: {file_path}")
                continue

            filename = os.path.basename(file_path)
            target_dir = None

            if genre:
                genre_folder = get_genre_folder(genre)
                target_dir = os.path.join(self.output_dir, "by-genre", genre_folder)
            else:
                # Versuche Genre aus Metadaten zu bestimmen
                genre = self._detect_genre_from_metadata(download)
                if genre:
                    genre_folder = get_genre_folder(genre)
                    target_dir = os.path.join(self.output_dir, "by-genre", genre_folder)

            if target_dir:
                os.makedirs(target_dir, exist_ok=True)
                target_path = os.path.join(target_dir, filename)

                # Vermeide Namenskonflikte
                if os.path.exists(target_path):
                    base, ext = os.path.splitext(filename)
                    counter = 1
                    while os.path.exists(target_path):
                        target_path = os.path.join(target_dir, f"{base}_{counter}{ext}")
                        counter += 1

                try:
                    shutil.copy2(file_path, target_path)
                    organized += 1
                    logger.debug(f"Sortiert: {filename} -> {target_dir}")
                except Exception as e:
                    logger.error(f"Fehler beim Kopieren von {filename}: {e}")
            else:
                # Unsorted
                unsorted_dir = os.path.join(self.output_dir, "unsorted")
                os.makedirs(unsorted_dir, exist_ok=True)
                target_path = os.path.join(unsorted_dir, filename)

                if not os.path.exists(target_path):
                    try:
                        shutil.copy2(file_path, target_path)
                        unsorted += 1
                    except Exception as e:
                        logger.error(f"Fehler beim Kopieren nach unsorted: {e}")

        logger.info(f"Organisiert: {organized} Dateien sortiert, {unsorted} unsortiert")
        return {"organized": organized, "unsorted": unsorted}

    def _detect_genre_from_metadata(self, download):
        """
        Versucht das Genre aus den Metadaten der Datei zu bestimmen.
        """
        title = (download["title"] or "").lower()
        filename = (download["filename"] or "").lower()
        text = f"{title} {filename}"

        for genre, keywords in self.genre_map.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    return genre

        return None

    def create_metadata_index(self):
        """
        Erstellt metadata.json mit einem Index aller MIDI-Dateien.
        """
        logger.info("Erstelle metadata.json Index...")

        downloads = self.db.get_all_downloads()
        done_downloads = [d for d in downloads if d["status"] == "done"]

        index = []
        for download in done_downloads:
            entry = {
                "filename": download["filename"],
                "source_url": download["url"],
                "genre": download["genre"],
                "bpm": download["bpm"],
                "tracks": download["num_tracks"],
                "duration": download["duration_seconds"],
                "date_added": download["date_added"],
                "md5": download["md5"],
                "file_size": download["file_size"],
                "validated": download["validated"] == 1 if download["validated"] is not None else None
            }
            index.append(entry)

        # Sortiere nach Genre und Dateiname
        index.sort(key=lambda x: (x["genre"] or "zzz", x["filename"] or "zzz"))

        metadata_path = os.path.join(self.output_dir, "metadata.json")
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2, ensure_ascii=False)

        logger.info(f"metadata.json erstellt: {len(index)} Einträge")
        return metadata_path

    def clean_duplicates(self):
        """
        Entfernt Duplikate basierend auf MD5-Hash.
        Behält die erste gefundene Datei, entfernt die anderen.
        """
        logger.info("Suche nach Duplikaten...")

        duplicates = self.db.get_duplicates()
        removed = 0

        for dup in duplicates:
            md5 = dup["md5"]
            urls = dup["urls"].split(",")

            # Behalte die erste, entferne den Rest
            for url in urls[1:]:
                cursor = self.db.conn.cursor()
                cursor.execute(
                    "SELECT file_path FROM downloads WHERE url = ? AND md5 = ?",
                    (url, md5)
                )
                row = cursor.fetchone()
                if row and row["file_path"] and os.path.exists(row["file_path"]):
                    try:
                        os.remove(row["file_path"])
                        removed += 1
                        logger.debug(f"Duplikat entfernt: {row['file_path']}")
                    except Exception as e:
                        logger.error(f"Fehler beim Entfernen von {row['file_path']}: {e}")

        logger.info(f"Duplikate bereinigt: {removed} Dateien entfernt")
        return removed

    def remove_invalid_files(self):
        """
        Entfernt Dateien die als invalid markiert sind.
        """
        logger.info("Entferne invalide Dateien...")

        cursor = self.db.conn.cursor()
        cursor.execute("""
            SELECT d.file_path, d.filename
            FROM downloads d
            JOIN midi_metadata m ON d.id = m.download_id
            WHERE m.validated = 2
        """)
        invalid_files = cursor.fetchall()

        removed = 0
        for row in invalid_files:
            file_path = row["file_path"]
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    removed += 1
                    logger.debug(f"Invalide Datei entfernt: {row['filename']}")
                except Exception as e:
                    logger.error(f"Fehler beim Entfernen: {e}")

        logger.info(f"Invalide Dateien entfernt: {removed}")
        return removed

    def get_structure_info(self):
        """
        Gibt Informationen über die aktuelle Ordnerstruktur zurück.
        """
        info = {}
        by_genre_dir = os.path.join(self.output_dir, "by-genre")

        if os.path.exists(by_genre_dir):
            for genre_folder in os.listdir(by_genre_dir):
                genre_path = os.path.join(by_genre_dir, genre_folder)
                if os.path.isdir(genre_path):
                    files = [f for f in os.listdir(genre_path)
                             if f.lower().endswith((".mid", ".midi"))]
                    info[genre_folder] = len(files)

        unsorted_dir = os.path.join(self.output_dir, "unsorted")
        if os.path.exists(unsorted_dir):
            unsorted_files = [f for f in os.listdir(unsorted_dir)
                              if f.lower().endswith((".mid", ".midi"))]
            info["unsorted"] = len(unsorted_files)

        return info
