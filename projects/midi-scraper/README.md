# 🎵 midi-scraper

Automatisierter MIDI-Datei Scraper für elektronische Musik. Findet, lädt, validiert und organisiert MIDI-Dateien von verschiedenen Quellen.

## Features

- 🔍 **Smart Scraping** - Crawlt MIDI-Websites und nutzt Google-Suchoperatoren
- ⚡ **Asynchrone Downloads** - Parallele Downloads mit aiohttp
- 🛡️ **Validierung** - Prüft MIDI-Dateien auf Gültigkeit mit mido
- 📁 **Organisation** - Sortiert automatisch nach Genre
- 🔄 **Deduplizierung** - Verhindert Duplikate via MD5-Hash
- 📊 **Statistiken** - Umfangreiche Auswertungen der Sammlung
- 🔎 **Suche** - Durchsuche deine lokale MIDI-Sammlung

## Installation

### Voraussetzungen

- Python 3.10 oder höher
- pip

### Setup

```bash
# Projekt-Verzeichnis öffnen
cd midi-scraper

# Virtuelle Umgebung erstellen (empfohlen)
python -m venv venv
source venv/bin/activate  # Linux/macOS
# oder: venv\Scripts\activate  # Windows

# Abhängigkeiten installieren
pip install -r requirements.txt
```

## Konfiguration

Die Datei `config.yaml` enthält alle Einstellungen:

```yaml
# Ausgabe-Verzeichnis
output_dir: "midi-collection"

# Seed-URLs zum Starten
seed_urls:
  - "https://www.midiworld.com/"
  - "https://bitmidi.com/"
  # ... weitere URLs

# Genre-Keywords
genre_keywords:
  techno: ["techno", "tech house", ...]
  house: ["house", "deep house", ...]
  # ... weitere Genres

# Rate-Limiting
rate_limit:
  delay_between_requests: 2.0
  max_retries: 5
  # ...

# Download-Einstellungen
download:
  max_parallel: 5
  min_file_size_kb: 1
  # ...
```

## Verwendung

### Komplett-Scraping

Startet den gesamten Prozess: Crawlen, Suchen, Downloaden, Validieren, Organisieren.

```bash
python main.py scrape
```

### Validierung

Überprüft alle existierenden MIDI-Dateien auf Gültigkeit und extrahiert Metadaten.

```bash
python main.py validate
```

### Statistiken

Zeigt eine Übersicht der Sammlung: Anzahl Files, Genres, Größen, etc.

```bash
python main.py stats
```

### Suche

Durchsucht die lokale Sammlung nach einem Begriff.

```bash
python main.py search techno
python main.py search "drum and bass"
```

### Bereinigung

Entfernt Duplikate und invalide Dateien.

```bash
python main.py clean
```

### Organisation

Sortiert MIDI-Dateien nach Genre in die by-genre/ Ordner.

```bash
python main.py organize
```

### Index erstellen

Erstellt oder aktualisiert die metadata.json Datei.

```bash
python main.py index
```

## Projekt-Struktur

```
midi-scraper/
├── main.py              # CLI-Einstiegspunkt
├── config.yaml          # Konfiguration
├── scraper.py           # Crawling-Logik
├── downloader.py        # Asynchroner Download-Manager
├── validator.py         # MIDI-Validierung & Metadaten
├── organizer.py         # Datei-Organisation
├── database.py          # SQLite-Tracking
├── utils.py             # Hilfsfunktionen
├── requirements.txt     # Python-Abhängigkeiten
├── .gitignore
├── README.md
├── midi-scraper.log     # Log-Datei (wird erstellt)
└── midi_scraper.db      # SQLite-Datenbank (wird erstellt)
```

## Ausgabe-Struktur

Nach dem Scraping wird folgende Ordnerstruktur erstellt:

```
midi-collection/
├── downloads/           # Original-Downloads
├── by-genre/
│   ├── techno/
│   ├── house/
│   ├── trance/
│   ├── ambient/
│   ├── drum-and-bass/
│   ├── synthwave/
│   ├── electro/
│   └── edm/
├── unsorted/            # Dateien ohne Genre-Zuordnung
└── metadata.json        # Vollständiger Index aller Dateien
```

## metadata.json Format

Jeder Eintrag enthält:

```json
{
  "filename": "track_name.mid",
  "source_url": "https://example.com/track.mid",
  "genre": "techno",
  "bpm": 128.0,
  "tracks": 4,
  "duration": 185.5,
  "date_added": "2024-01-15T10:30:00",
  "md5": "a1b2c3d4e5f6...",
  "file_size": 15234,
  "validated": true
}
```

## Logging

Alle Aktionen werden in `midi-scraper.log` protokolliert. Die Log-Datei wird automatisch rotiert (max 10 MB, 3 Backups).

## Technische Details

- **aiohttp** - Asynchrone HTTP-Requests
- **mido** - MIDI-Datei Parsing und Validierung
- **BeautifulSoup4** - HTML-Parsing
- **tqdm** - Fortschrittsanzeigen
- **PyYAML** - Konfigurations-Management
- **SQLite** - Download-Tracking und Metadaten

## Hinweise

- Respektiert Rate-Limits um IP-Bans zu vermeiden
- Deduplizierung verhindert doppelte Downloads
- Resume-fähig: Unterbrochene Downloads können fortgesetzt werden
- Alle Kommentare im Code sind auf Deutsch

## Lizenz

Dieses Projekt ist für den persönlichen Gebrauch bestimmt. Respektiere die Urheberrechte der MIDI-Dateien.
