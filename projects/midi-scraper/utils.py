"""
Hilfsfunktionen und Logging-Konfiguration für midi-scraper.
"""

import os
import sys
import logging
import hashlib
from logging.handlers import RotatingFileHandler
from datetime import datetime

import yaml


def load_config(config_path="config.yaml"):
    """Lädt die YAML-Konfigurationsdatei."""
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def setup_logging(config):
    """
    Richtet das Logging ein:
    - RotatingFileHandler für midi-scraper.log
    - StreamHandler für Console (INFO+)
    """
    log_cfg = config.get("logging", {})
    log_file = log_cfg.get("log_file", "midi-scraper.log")
    log_level = getattr(logging, log_cfg.get("log_level", "INFO").upper(), logging.INFO)
    max_bytes = log_cfg.get("max_log_size_mb", 10) * 1024 * 1024
    backup_count = log_cfg.get("backup_count", 3)

    # Root-Logger konfigurieren
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Verhindere Duplicate Handler
    if root_logger.handlers:
        root_logger.handlers.clear()

    # Format
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Rotating File Handler
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8"
    )
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    return root_logger


def compute_md5(file_path):
    """
    Berechnet den MD5-Hash einer Datei.
    Wird für Deduplizierung verwendet.
    """
    md5_hash = hashlib.md5()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                md5_hash.update(chunk)
        return md5_hash.hexdigest()
    except (IOError, OSError) as e:
        logging.getLogger(__name__).error(f"MD5-Berechnung fehlgeschlagen für {file_path}: {e}")
        return None


def sanitize_filename(name):
    """
    Bereinigt einen Dateinamen:
    - Entfernt unerlaubte Zeichen
    - Kürzt auf 200 Zeichen
    - Ersetzt Leerzeichen mit Unterstrichen
    """
    # Unerlaubte Zeichen entfernen
    sanitized = "".join(c for c in name if c.isalnum() or c in "._- ")
    # Leerzeichen durch Unterstriche ersetzen
    sanitized = sanitized.replace(" ", "_")
    # Mehrfache Unterstriche reduzieren
    while "__" in sanitized:
        sanitized = sanitized.replace("__", "_")
    # Kürzen
    sanitized = sanitized[:200].strip("_")
    return sanitized if sanitized else "untitled"


def get_genre_folder(genre):
    """
    Wandelt einen Genre-Namen in einen ordentlichen Ordnernamen um.
    Z.B. "drum and bass" -> "drum-and-bass"
    """
    return genre.lower().replace(" ", "-")


def format_duration(seconds):
    """Formatiert Sekunden in MM:SS."""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"


def format_timestamp(ts=None):
    """Formatiert einen Timestamp als ISO-String."""
    if ts is None:
        ts = datetime.now()
    return ts.isoformat()


def get_logger(name):
    """Gibt einen benannten Logger zurück."""
    return logging.getLogger(name)
