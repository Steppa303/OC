"""
SQLite-Datenbank für das Tracking heruntergeladener MIDI-Dateien.
Verhindert Duplikate und ermöglicht Resume-Funktionalität.
"""

import os
import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class MidiDatabase:
    """
    SQLite-basiertes Tracking-System für MIDI-Downloads.
    Speichert: URL, MD5, Status, Genre, Metadaten.
    """

    def __init__(self, db_path="midi_scraper.db"):
        """
        Initialisiert die Datenbank und erstellt Tabellen falls nötig.
        """
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self):
        """Erstellt alle benötigten Tabellen."""
        cursor = self.conn.cursor()

        # Downloads-Tabelle: Trackt jede heruntergeladene Datei
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                md5 TEXT,
                filename TEXT,
                file_path TEXT,
                genre TEXT,
                status TEXT DEFAULT 'pending',  -- pending, downloading, done, failed
                error_message TEXT,
                file_size INTEGER DEFAULT 0,
                retries INTEGER DEFAULT 0,
                date_added TEXT,
                date_completed TEXT
            )
        """)

        # MIDI-Metadaten-Tabelle: Erweiterte Info pro Datei
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS midi_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                download_id INTEGER,
                filename TEXT,
                title TEXT,
                num_tracks INTEGER,
                bpm REAL,
                key_signature TEXT,
                time_signature TEXT,
                duration_seconds REAL,
                validated INTEGER DEFAULT 0,  -- 0 = nicht validiert, 1 = valide, 2 = invalid
                validation_error TEXT,
                FOREIGN KEY (download_id) REFERENCES downloads(id)
            )
        """)

        # Indexe für schnellere Queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_downloads_md5 ON downloads(md5)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_downloads_genre ON downloads(genre)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_downloads_url ON downloads(url)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_metadata_title ON midi_metadata(title)")

        self.conn.commit()
        logger.info("Datenbank initialisiert: %s", self.db_path)

    def url_exists(self, url):
        """Prüft ob eine URL bereits in der Datenbank ist."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, status FROM downloads WHERE url = ?", (url,))
        row = cursor.fetchone()
        if row:
            return True, row["status"]
        return False, None

    def add_download(self, url, genre=None):
        """
        Fügt einen neuen Download-Eintrag hinzu.
        Gibt True zurück wenn neu, False wenn bereits existiert.
        """
        exists, status = self.url_exists(url)
        if exists:
            return False

        cursor = self.conn.cursor()
        try:
            cursor.execute(
                """INSERT INTO downloads (url, genre, status, date_added)
                   VALUES (?, ?, 'pending', ?)""",
                (url, genre, datetime.now().isoformat())
            )
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def update_status(self, url, status, error_message=None, md5=None, filename=None, file_path=None, file_size=None):
        """Aktualisiert den Status eines Downloads."""
        cursor = self.conn.cursor()
        fields = ["status = ?", "date_completed = ?"]
        values = [status, datetime.now().isoformat()]

        if error_message is not None:
            fields.append("error_message = ?")
            values.append(error_message)
        if md5 is not None:
            fields.append("md5 = ?")
            values.append(md5)
        if filename is not None:
            fields.append("filename = ?")
            values.append(filename)
        if file_path is not None:
            fields.append("file_path = ?")
            values.append(file_path)
        if file_size is not None:
            fields.append("file_size = ?")
            values.append(file_size)

        values.append(url)
        query = f"UPDATE downloads SET {', '.join(fields)} WHERE url = ?"
        cursor.execute(query, values)
        self.conn.commit()

    def increment_retry(self, url):
        """Erhöht den Retry-Zähler für einen Download."""
        cursor = self.conn.cursor()
        cursor.execute(
            "UPDATE downloads SET retries = retries + 1 WHERE url = ?",
            (url,)
        )
        self.conn.commit()

    def get_retry_count(self, url):
        """Gibt die aktuelle Retry-Anzahl zurück."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT retries FROM downloads WHERE url = ?", (url,))
        row = cursor.fetchone()
        return row["retries"] if row else 0

    def add_metadata(self, url, metadata):
        """
        Speichert MIDI-Metadaten für eine Datei.
        metadata = dict mit: title, num_tracks, bpm, key_signature, time_signature, duration_seconds
        """
        cursor = self.conn.cursor()
        # Finde den download_id
        cursor.execute("SELECT id FROM downloads WHERE url = ?", (url,))
        row = cursor.fetchone()
        if not row:
            logger.warning("Kein Download-Eintrag für URL gefunden: %s", url)
            return

        download_id = row["id"]

        # Prüfe ob bereits Metadaten existieren
        cursor.execute("SELECT id FROM midi_metadata WHERE download_id = ?", (download_id,))
        existing = cursor.fetchone()

        if existing:
            # Update
            cursor.execute("""
                UPDATE midi_metadata SET
                    title = ?, num_tracks = ?, bpm = ?,
                    key_signature = ?, time_signature = ?, duration_seconds = ?,
                    validated = ?
                WHERE download_id = ?
            """, (
                metadata.get("title"),
                metadata.get("num_tracks"),
                metadata.get("bpm"),
                metadata.get("key_signature"),
                metadata.get("time_signature"),
                metadata.get("duration_seconds"),
                1,  # validated
                download_id
            ))
        else:
            # Insert
            cursor.execute("""
                INSERT INTO midi_metadata
                    (download_id, filename, title, num_tracks, bpm,
                     key_signature, time_signature, duration_seconds, validated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            """, (
                download_id,
                os.path.basename(metadata.get("file_path", "")),
                metadata.get("title"),
                metadata.get("num_tracks"),
                metadata.get("bpm"),
                metadata.get("key_signature"),
                metadata.get("time_signature"),
                metadata.get("duration_seconds")
            ))

        self.conn.commit()

    def mark_invalid(self, url, error):
        """Markiert eine Datei als invalid."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT id FROM downloads WHERE url = ?", (url,))
        row = cursor.fetchone()
        if not row:
            return

        download_id = row["id"]
        cursor.execute("SELECT id FROM midi_metadata WHERE download_id = ?", (download_id,))
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                "UPDATE midi_metadata SET validated = 2, validation_error = ? WHERE download_id = ?",
                (error, download_id)
            )
        else:
            cursor.execute(
                """INSERT INTO midi_metadata (download_id, validated, validation_error)
                   VALUES (?, 2, ?)""",
                (download_id, error)
            )
        self.conn.commit()

    def get_pending_downloads(self, limit=100):
        """Gibt ausstehende Downloads zurück."""
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT * FROM downloads WHERE status = 'pending' ORDER BY date_added LIMIT ?",
            (limit,)
        )
        return cursor.fetchall()

    def get_all_downloads(self):
        """Gibt alle Downloads zurück."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT d.*, m.title, m.num_tracks, m.bpm, m.duration_seconds, m.validated
            FROM downloads d
            LEFT JOIN midi_metadata m ON d.id = m.download_id
            ORDER BY d.date_added DESC
        """)
        return cursor.fetchall()

    def get_stats(self):
        """Gibt Statistiken über die Sammlung zurück."""
        cursor = self.conn.cursor()

        stats = {}

        # Gesamtanzahl
        cursor.execute("SELECT COUNT(*) as count FROM downloads")
        stats["total_downloads"] = cursor.fetchone()["count"]

        # Nach Status
        cursor.execute("SELECT status, COUNT(*) as count FROM downloads GROUP BY status")
        stats["by_status"] = {row["status"]: row["count"] for row in cursor.fetchall()}

        # Nach Genre
        cursor.execute("SELECT genre, COUNT(*) as count FROM downloads WHERE genre IS NOT NULL GROUP BY genre ORDER BY count DESC")
        stats["by_genre"] = {row["genre"]: row["count"] for row in cursor.fetchall()}

        # Gesamtgröße
        cursor.execute("SELECT COALESCE(SUM(file_size), 0) as total_size FROM downloads WHERE status = 'done'")
        stats["total_size_bytes"] = cursor.fetchone()["total_size"]

        # Validierte MIDI-Files
        cursor.execute("SELECT COUNT(*) as count FROM midi_metadata WHERE validated = 1")
        stats["validated_files"] = cursor.fetchone()["count"]

        # Invalid Files
        cursor.execute("SELECT COUNT(*) as count FROM midi_metadata WHERE validated = 2")
        stats["invalid_files"] = cursor.fetchone()["count"]

        # Duplikate (gleicher MD5)
        cursor.execute("""
            SELECT md5, COUNT(*) as count FROM downloads
            WHERE md5 IS NOT NULL AND status = 'done'
            GROUP BY md5 HAVING count > 1
        """)
        duplicates = cursor.fetchall()
        stats["duplicate_groups"] = len(duplicates)

        return stats

    def search(self, query):
        """
        Sucht in der Datenbank nach einem Query-String.
        Durchsucht URL, Genre, Titel und Dateiname.
        """
        search_term = f"%{query}%"
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT d.*, m.title, m.bpm, m.duration_seconds, m.validated
            FROM downloads d
            LEFT JOIN midi_metadata m ON d.id = m.download_id
            WHERE d.url LIKE ?
               OR d.genre LIKE ?
               OR d.filename LIKE ?
               OR m.title LIKE ?
            ORDER BY d.date_added DESC
        """, (search_term, search_term, search_term, search_term))
        return cursor.fetchall()

    def get_duplicates(self):
        """Findet Duplikate basierend auf MD5-Hash."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT md5, GROUP_CONCAT(url) as urls, COUNT(*) as count
            FROM downloads
            WHERE md5 IS NOT NULL AND status = 'done'
            GROUP BY md5
            HAVING count > 1
        """)
        return cursor.fetchall()

    def close(self):
        """Schließt die Datenbankverbindung."""
        if self.conn:
            self.conn.close()
            logger.info("Datenbankverbindung geschlossen")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
