#!/usr/bin/env python3
"""
midi-scraper - Automatisierter MIDI-Datei Scraper für elektronische Musik.

CLI-Schnittstelle:
    python main.py scrape        → Startet Scraping & Download
    python main.py validate      → Validiert bestehende Sammlung
    python main.py stats         → Zeigt Sammlung-Statistiken
    python main.py search <q>    → Sucht in lokaler Sammlung
    python main.py clean         → Entfernt Duplikate & invalide Files
    python main.py organize      → Sortiert Dateien nach Genre
    python main.py index         → Erstellt metadata.json
"""

import sys
import os
import argparse
import logging
from datetime import datetime

# Stelle sicher dass der Projekt-Root im Path ist
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

from utils import load_config, setup_logging, get_logger
from database import MidiDatabase
from scraper import MidiScraper
from downloader import DownloadManager
from validator import MidiValidator
from organizer import MidiOrganizer

logger = get_logger(__name__)


def cmd_scrape(args, config, db):
    """
    Startet den kompletten Scraping-Prozess:
    1. Crawle Seed-URLs
    2. Google-Suche nach Genre-Keywords
    3. Download aller gefundenen MIDI-Dateien
    4. Validierung der Downloads
    5. Organisation nach Genre
    """
    logger.info("=" * 60)
    logger.info("START: MIDI-Scraper")
    logger.info("=" * 60)

    start_time = datetime.now()

    # 1. Scraper initialisieren und Seed-URLs crawlen
    logger.info("Schritt 1/5: Crawle Seed-URLs...")
    scraper = MidiScraper(config)
    seed_urls = scraper.scrape_seed_urls()
    logger.info(f"Seed-URLs: {len(seed_urls)} MIDI-Links gefunden")

    # 2. Google-Suche nach Genre-Keywords (optional)
    gs_config = config.get("google_search", {})
    if gs_config.get("enabled", False):
        logger.info("Schritt 2/5: Google-Suche nach Genre-Keywords...")
        genre_map = config.get("genre_keywords", {})
        genre_urls = scraper.search_by_genre(genre_map)
        logger.info(f"Genre-Suche: {len(genre_urls)} genre-spezifische URLs gefunden")
    else:
        logger.info("Schritt 2/5: Google-Suche deaktiviert - wird übersprungen")
        genre_urls = set()

    # Kombiniere alle URLs
    all_urls = scraper.get_results()
    logger.info(f"Gesamt: {len(all_urls)} eindeutige MIDI-URLs gefunden")

    # 3. Downloads
    logger.info("Schritt 3/5: Starte Downloads...")
    downloader = DownloadManager(config, db)

    # Erstelle Genre-Zuordnung
    genre_url_map = {}
    for url, genre in genre_urls:
        genre_url_map[url] = genre

    # Asynchroner Download
    import asyncio
    download_stats = asyncio.run(downloader.download_all(all_urls, genre_url_map))

    logger.info(f"Downloads abgeschlossen: {download_stats}")

    # 4. Validierung
    logger.info("Schritt 4/5: Validiere MIDI-Dateien...")
    validator = MidiValidator(config, db)
    validation_results = validator.validate_all()
    logger.info(f"Validierung: {validation_results}")

    # 5. Organisation
    logger.info("Schritt 5/5: Organisiere Sammlung...")
    organizer = MidiOrganizer(config, db)
    organizer.create_structure()
    organize_results = organizer.organize_by_genre()
    metadata_path = organizer.create_metadata_index()
    logger.info(f"Organisation: {organize_results}")

    # Abschluss
    elapsed = (datetime.now() - start_time).total_seconds()
    logger.info("=" * 60)
    logger.info("ABSCHLUSS: MIDI-Scraper")
    logger.info(f"Dauer: {elapsed:.1f}s")
    logger.info(f"Gefundene URLs: {len(all_urls)}")
    logger.info(f"Heruntergeladen: {download_stats['downloaded']}")
    logger.info(f"Übersprungen: {download_stats['skipped']}")
    logger.info(f"Duplikate: {download_stats['duplicates']}")
    logger.info(f"Fehler: {download_stats['failed']}")
    logger.info(f"Valide MIDI-Files: {validation_results['valid']}")
    logger.info(f"Invalide Files: {validation_results['invalid']}")
    logger.info(f"Sortiert: {organize_results['organized']}")
    logger.info(f"Unsortiert: {organize_results['unsorted']}")
    logger.info(f"Index: {metadata_path}")
    logger.info("=" * 60)


def cmd_validate(args, config, db):
    """Validiert die bestehende MIDI-Sammlung."""
    logger.info("Starte Validierung der bestehenden Sammlung...")

    validator = MidiValidator(config, db)
    results = validator.validate_all()

    print(f"\n{'='*50}")
    print(f"VALIDIERUNGSERGEBNISSE")
    print(f"{'='*50}")
    print(f"Gesamt:       {results['total']}")
    print(f"Valide:       {results['valid']}")
    print(f"Invalide:     {results['invalid']}")
    print(f"Übersprungen: {results['skipped']}")
    if results['errors']:
        print(f"\nFehler:")
        for err in results['errors']:
            print(f"  - {err['file']}: {err['error']}")
    print(f"{'='*50}")


def cmd_stats(args, config, db):
    """Zeigt Statistiken der MIDI-Sammlung."""
    stats = db.get_stats()

    print(f"\n{'='*60}")
    print(f"MIDI-SAMMLUNG STATISTIKEN")
    print(f"{'='*60}")
    print(f"Gesamt-Downloads:    {stats['total_downloads']}")
    print(f"Valide MIDI-Files:   {stats['validated_files']}")
    print(f"Invalide Files:      {stats['invalid_files']}")
    print(f"Duplikat-Gruppen:    {stats['duplicate_groups']}")

    # Gesamtgröße formatieren
    total_size = stats['total_size_bytes']
    if total_size > 1024 * 1024:
        print(f"Gesamtgröße:         {total_size / (1024*1024):.2f} MB")
    elif total_size > 1024:
        print(f"Gesamtgröße:         {total_size / 1024:.2f} KB")
    else:
        print(f"Gesamtgröße:         {total_size} Bytes")

    # Nach Status
    if stats['by_status']:
        print(f"\nNach Status:")
        for status, count in stats['by_status'].items():
            print(f"  {status:15s}: {count}")

    # Nach Genre
    if stats['by_genre']:
        print(f"\nNach Genre:")
        for genre, count in sorted(stats['by_genre'].items(), key=lambda x: -x[1]):
            print(f"  {genre:20s}: {count}")

    # Ordnerstruktur
    organizer = MidiOrganizer(config, db)
    structure = organizer.get_structure_info()
    if structure:
        print(f"\nOrdnerstruktur:")
        for folder, count in sorted(structure.items()):
            print(f"  {folder:25s}: {count} Dateien")

    print(f"{'='*60}")


def cmd_search(args, config, db):
    """Sucht in der lokalen MIDI-Sammlung."""
    query = args.query

    print(f"\n{'='*60}")
    print(f"SUCHERGEBNISSE für: '{query}'")
    print(f"{'='*60}")

    results = db.search(query)

    if not results:
        print("Keine Ergebnisse gefunden.")
    else:
        print(f"Gefunden: {len(results)} Einträge\n")
        for i, row in enumerate(results, 1):
            print(f"{i}. {row['filename'] or 'Unknown'}")
            print(f"   Genre: {row['genre'] or 'N/A'}")
            print(f"   BPM:   {row['bpm'] or 'N/A'}")
            print(f"   Dauer: {row['duration_seconds'] or 'N/A'}s")
            print(f"   URL:   {row['url']}")
            print()

    print(f"{'='*60}")


def cmd_clean(args, config, db):
    """Entfernt Duplikate und invalide Dateien."""
    logger.info("Starte Bereinigung...")

    organizer = MidiOrganizer(config, db)

    # Duplikate entfernen
    duplicates_removed = organizer.clean_duplicates()

    # Invalide Dateien entfernen
    invalid_removed = organizer.remove_invalid_files()

    # metadata.json aktualisieren
    organizer.create_metadata_index()

    print(f"\n{'='*50}")
    print(f"BEREINIGUNG ABGESCHLOSSEN")
    print(f"{'='*50}")
    print(f"Duplikate entfernt:  {duplicates_removed}")
    print(f"Invalide entfernt:   {invalid_removed}")
    print(f"{'='*50}")


def cmd_organize(args, config, db):
    """Sortiert MIDI-Dateien nach Genre."""
    logger.info("Starte Organisation...")

    organizer = MidiOrganizer(config, db)
    organizer.create_structure()
    results = organizer.organize_by_genre()
    metadata_path = organizer.create_metadata_index()

    print(f"\n{'='*50}")
    print(f"ORGANISATION ABGESCHLOSSEN")
    print(f"{'='*50}")
    print(f"Sortiert:    {results['organized']}")
    print(f"Unsortiert:  {results['unsorted']}")
    print(f"Index:       {metadata_path}")
    print(f"{'='*50}")


def cmd_index(args, config, db):
    """Erstellt/aktualisiert den metadata.json Index."""
    organizer = MidiOrganizer(config, db)
    metadata_path = organizer.create_metadata_index()

    print(f"\nmetadata.json erstellt: {metadata_path}")


def main():
    """Haupteinstiegspunkt der CLI."""
    parser = argparse.ArgumentParser(
        description="midi-scraper - Automatisierter MIDI-Datei Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Beispiele:
  python main.py scrape              → Komplett-Scraping
  python main.py validate            → Sammlung validieren
  python main.py stats               → Statistiken anzeigen
  python main.py search techno       → Nach 'techno' suchen
  python main.py clean               → Duplikate entfernen
  python main.py organize            → Nach Genre sortieren
  python main.py index               → metadata.json erstellen
        """
    )

    parser.add_argument(
        "--config",
        default=os.path.join(PROJECT_ROOT, "config.yaml"),
        help="Pfad zur Konfigurationsdatei (default: config.yaml)"
    )

    subparsers = parser.add_subparsers(dest="command", help="Verfügbare Kommandos")

    # scrape
    subparsers.add_parser("scrape", help="Startet Scraping & Download")

    # validate
    subparsers.add_parser("validate", help="Validiert bestehende Sammlung")

    # stats
    subparsers.add_parser("stats", help="Zeigt Sammlung-Statistiken")

    # search
    search_parser = subparsers.add_parser("search", help="Sucht in lokaler Sammlung")
    search_parser.add_argument("query", help="Suchbegriff")

    # clean
    subparsers.add_parser("clean", help="Entfernt Duplikate & invalide Files")

    # organize
    subparsers.add_parser("organize", help="Sortiert Dateien nach Genre")

    # index
    subparsers.add_parser("index", help="Erstellt metadata.json")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Konfiguration laden
    try:
        config = load_config(args.config)
    except Exception as e:
        print(f"Fehler beim Laden der Konfiguration: {e}")
        sys.exit(1)

    # Logging einrichten
    setup_logging(config)
    logger.info(f"midi-scraper gestartet mit Kommando: {args.command}")

    # Datenbank öffnen
    db_path = os.path.join(
        PROJECT_ROOT,
        config.get("download", {}).get("database_file", "midi_scraper.db")
    )
    db = MidiDatabase(db_path)

    try:
        # Kommando ausführen
        commands = {
            "scrape": cmd_scrape,
            "validate": cmd_validate,
            "stats": cmd_stats,
            "search": cmd_search,
            "clean": cmd_clean,
            "organize": cmd_organize,
            "index": cmd_index,
        }

        cmd_func = commands.get(args.command)
        if cmd_func:
            cmd_func(args, config, db)
        else:
            parser.print_help()

    except KeyboardInterrupt:
        logger.info("Durch Benutzer abgebrochen.")
        print("\nAbgebrochen.")
    except Exception as e:
        logger.exception(f"Unerwarteter Fehler: {e}")
        print(f"Fehler: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
