"""
Asynchroner Download-Manager für MIDI-Dateien.
Nutzt aiohttp für parallele Downloads mit Rate-Limiting,
Retry-Logik und Deduplizierung.
"""

import os
import asyncio
import hashlib
import logging
from datetime import datetime

import aiohttp
from tqdm import tqdm
from tqdm.asyncio import tqdm as tqdm_asyncio

from utils import get_logger, compute_md5

logger = get_logger(__name__)


class DownloadManager:
    """
    Verwaltet asynchrone Downloads von MIDI-Dateien.
    Features:
    - Parallele Downloads mit aiohttp
    - Rate Limiting
    - Exponential Backoff Retry
    - MD5-Deduplizierung
    - Resume-Fähigkeit via SQLite
    """

    def __init__(self, config, db):
        """
        Initialisiert den Download-Manager.
        config: Konfigurations-Dict
        db: MidiDatabase-Instanz
        """
        self.config = config
        self.db = db
        download_cfg = config.get("download", {})
        rate_cfg = config.get("rate_limit", {})

        self.max_parallel = download_cfg.get("max_parallel", 5)
        self.min_size_kb = download_cfg.get("min_file_size_kb", 1)
        self.max_size_mb = download_cfg.get("max_file_size_mb", 10)
        self.resume_enabled = download_cfg.get("resume_enabled", True)

        self.delay = rate_cfg.get("delay_between_requests", 2.0)
        self.max_retries = rate_cfg.get("max_retries", 5)
        self.backoff_factor = rate_cfg.get("retry_backoff_factor", 2.0)
        self.timeout = rate_cfg.get("request_timeout", 30)
        self.user_agent = rate_cfg.get("user_agent", "")

        self.output_dir = config.get("output_dir", "midi-collection")
        self.downloads_dir = os.path.join(self.output_dir, "downloads")

        # Stelle Verzeichnisse sicher
        os.makedirs(self.downloads_dir, exist_ok=True)

        # Semaphore für parallele Downloads
        self.semaphore = asyncio.Semaphore(self.max_parallel)

        # Statistiken
        self.stats = {
            "total": 0,
            "downloaded": 0,
            "skipped": 0,
            "failed": 0,
            "duplicates": 0,
            "errors": []
        }

    async def download_all(self, urls, genre_map=None):
        """
        Lädt alle URLs asynchron herunter.
        urls: Liste von URLs oder (URL, Genre) Tupeln
        genre_map: Optional - Dict von URL -> Genre
        """
        if genre_map is None:
            genre_map = {}

        # Füge URLs zur Datenbank hinzu
        for item in urls:
            if isinstance(item, tuple):
                url, genre = item
            else:
                url = item
                genre = genre_map.get(url)

            # Prüfe ob bereits vorhanden
            exists, status = self.db.url_exists(url)
            if exists and status == "done":
                self.stats["skipped"] += 1
                logger.debug(f"Überspringe vorhandenen Download: {url}")
                continue

            self.db.add_download(url, genre)

        self.stats["total"] = len(urls)

        logger.info(f"Starte Download von {self.stats['total']} Dateien...")

        # Erstelle Download-Tasks
        async with aiohttp.ClientSession(
            headers={"User-Agent": self.user_agent},
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        ) as session:
            tasks = []
            for item in urls:
                if isinstance(item, tuple):
                    url, genre = item
                else:
                    url = item
                    genre = genre_map.get(url)

                exists, status = self.db.url_exists(url)
                if exists and status == "done":
                    continue

                tasks.append(self._download_file(session, url, genre))

            # Führe alle Tasks aus mit Fortschrittsanzeige
            async def wrapped_task(task):
                result = await task
                pbar.update(1)
                return result

            with tqdm(total=len(tasks), desc="Downloads", unit="file") as pbar:
                wrapped_tasks = [wrapped_task(t) for t in tasks]
                results = await asyncio.gather(*wrapped_tasks)

        return self.stats

    async def _download_file(self, session, url, genre=None):
        """
        Lädt eine einzelne Datei herunter mit Retry-Logik.
        Retries werden nur bei Netzwerkfehlern gemacht, nicht bei Validierungsfehlern.
        """
        async with self.semaphore:
            for attempt in range(self.max_retries + 1):
                try:
                    result = await self._do_download(session, url, genre)
                    return result
                except ValueError as e:
                    # Validierungsfehler (z.B. Datei zu klein) - kein Retry!
                    error_msg = f"Validierungsfehler: {url} - {e}"
                    logger.debug(error_msg)
                    self.db.update_status(url, "failed", error_message=str(e))
                    self.stats["failed"] += 1
                    return {"url": url, "status": "failed", "error": str(e)}
                except Exception as e:
                    if attempt < self.max_retries:
                        wait_time = self.backoff_factor ** attempt
                        logger.warning(
                            f"Download fehlgeschlagen ({attempt + 1}/{self.max_retries}): {url} - {e}. "
                            f"Warte {wait_time}s..."
                        )
                        self.db.increment_retry(url)
                        await asyncio.sleep(wait_time)
                    else:
                        error_msg = f"Download nach {self.max_retries} Versuchen fehlgeschlagen: {url} - {e}"
                        logger.error(error_msg)
                        self.db.update_status(url, "failed", error_message=str(e))
                        self.stats["failed"] += 1
                        self.stats["errors"].append({"url": url, "error": str(e)})

    async def _do_download(self, session, url, genre=None):
        """
        Führt den eigentlichen Download durch.
        """
        # Rate Limiting
        await asyncio.sleep(self.delay)

        # Extrahiere Dateinamen aus URL
        parsed = __import__("urllib.parse", fromlist=["urlparse"]).urlparse(url)
        filename = os.path.basename(parsed.path)
        if not filename or not filename.lower().endswith((".mid", ".midi")):
            # Generiere Dateinamen aus URL-Hash
            url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
            filename = f"midi_{url_hash}.mid"

        file_path = os.path.join(self.downloads_dir, filename)

        # Prüfe ob Datei bereits existiert (Resume)
        if self.resume_enabled and os.path.exists(file_path):
            file_size = os.path.getsize(file_path)
            if file_size >= self.min_size_kb * 1024:
                # Prüfe MD5
                md5 = compute_md5(file_path)
                self.db.update_status(
                    url, "done",
                    md5=md5,
                    filename=filename,
                    file_path=file_path,
                    file_size=file_size
                )
                self.stats["skipped"] += 1
                logger.debug(f"Datei existiert bereits: {filename}")
                return filename

        # Lade Datei herunter
        async with session.get(url) as response:
            if response.status != 200:
                raise ValueError(f"HTTP {response.status}")

            # Prüfe Content-Length
            content_length = response.headers.get("Content-Length")
            if content_length:
                size = int(content_length)
                if size < self.min_size_kb * 1024:
                    raise ValueError(f"Datei zu klein: {size} Bytes")
                if size > self.max_size_mb * 1024 * 1024:
                    raise ValueError(f"Datei zu groß: {size} Bytes")

            # Schreibe Datei
            content = await response.read()
            file_size = len(content)

            # Prüfe Mindestgröße
            if file_size < self.min_size_kb * 1024:
                raise ValueError(f"Datei zu klein nach Download: {file_size} Bytes")

            # Schreibe auf Festplatte
            with open(file_path, "wb") as f:
                f.write(content)

            # Berechne MD5
            md5 = hashlib.md5(content).hexdigest()

            # Prüfe Duplikate
            existing = self.db.conn.cursor()
            existing.execute(
                "SELECT filename FROM downloads WHERE md5 = ? AND status = 'done'",
                (md5,)
            )
            dup = existing.fetchone()
            if dup:
                # Duplikat - lösche die neue Datei
                os.remove(file_path)
                self.stats["duplicates"] += 1
                self.db.update_status(url, "done", md5=md5, file_size=file_size)
                logger.debug(f"Duplikat gefunden: {filename} = {dup['filename']}")
                return dup["filename"]

            # Update Datenbank
            self.db.update_status(
                url, "done",
                md5=md5,
                filename=filename,
                file_path=file_path,
                file_size=file_size
            )

            self.stats["downloaded"] += 1
            logger.debug(f"Heruntergeladen: {filename} ({file_size} Bytes)")
            return filename

    def get_stats(self):
        """Gibt Download-Statistiken zurück."""
        return self.stats.copy()
