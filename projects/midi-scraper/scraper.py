"""
Scraper/Crawler für MIDI-Dateien.
Crawlt bekannte MIDI-Websites und nutzt Google-Suchoperatoren
zum Finden elektronischer MIDI-Dateien.
"""

import re
import time
import logging
import urllib.parse
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

from utils import get_logger

logger = get_logger(__name__)

# MIDI-Dateiendungen
MIDI_EXTENSIONS = {".mid", ".midi"}

# Genre-Keywords für elektronische Musik
GENRE_KEYWORDS = [
    "techno", "house", "trance", "edm", "ambient",
    "electro", "synthwave", "drum and bass", "dnb",
    "deep house", "progressive house", "progressive trance",
    "downtempo", "breakbeat", "electro funk", "retrowave",
    "outrun", "synthpop", "darkwave", "chillout",
    "atmospheric", "big room", "future bass", "jungle",
    "neurofunk", "minimal techno", "hard techno",
    "uplifting trance", "goa trance", "electro house",
    "funky house", "electroclash"
]


class MidiScraper:
    """
    Scrapert MIDI-Websites nach Download-Links.
    Nutzt direkte Crawling-Methoden und Google-Suchoperatoren.
    """

    def __init__(self, config):
        """
        Initialisiert den Scraper mit der Konfiguration.
        """
        self.config = config
        self.rate_limit = config.get("rate_limit", {})
        self.delay = self.rate_limit.get("delay_between_requests", 2.0)
        self.timeout = self.rate_limit.get("request_timeout", 30)
        self.user_agent = self.rate_limit.get("user_agent", "")
        self.blacklist = config.get("blacklist_domains", [])
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": self.user_agent
        })
        self.found_urls = set()
        self.scraped_pages = set()

    def _is_blacklisted(self, url):
        """Prüft ob eine URL auf der Blacklist steht."""
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc.lower()
        for blocked in self.blacklist:
            if blocked.lower() in domain:
                return True
        return False

    def _is_midi_url(self, url):
        """Prüft ob eine URL möglicherweise auf eine MIDI-Datei zeigt."""
        parsed = urllib.parse.urlparse(url)
        path = parsed.path.lower()
        # Prüfe auf MIDI-Endungen
        if any(path.endswith(ext) for ext in MIDI_EXTENSIONS):
            return True
        # Prüfe auf Download-Parameter
        if "download" in parsed.path.lower() or "midi" in parsed.path.lower():
            return True
        return False

    def _normalize_url(self, base_url, link):
        """
        Normalisiert eine relative URL zu einer absoluten URL.
        """
        try:
            return urllib.parse.urljoin(base_url, link)
        except Exception as e:
            logger.debug(f"Fehler beim Normalisieren von URL {link}: {e}")
            return None

    def scrape_seed_urls(self):
        """
        Crawlt die Seed-URLs aus der Konfiguration.
        Findet MIDI-Download-Links auf den Startseiten.
        """
        seed_urls = self.config.get("seed_urls", [])
        logger.info(f"Starte Scraping von {len(seed_urls)} Seed-URLs...")

        for url in tqdm(seed_urls, desc="Seed-URLs", unit="url"):
            self._scrape_page(url)
            time.sleep(self.delay)

        logger.info(f"Gefundene MIDI-URLs nach Seed-Scraping: {len(self.found_urls)}")
        return list(self.found_urls)

    def _scrape_page(self, url, max_depth=2, current_depth=0):
        """
        Crawlt eine einzelne Seite nach MIDI-Links.
        max_depth: Maximale Crawling-Tiefe (verhindert Endlosschleifen)
        """
        if current_depth >= max_depth:
            return

        if url in self.scraped_pages:
            return

        if self._is_blacklisted(url):
            logger.debug(f"Überspringe Blacklist-Domain: {url}")
            return

        self.scraped_pages.add(url)

        try:
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()

            # Prüfe ob es direkt eine MIDI-Datei ist
            content_type = response.headers.get("Content-Type", "").lower()
            if "midi" in content_type or "audio/x-midi" in content_type:
                self.found_urls.add(url)
                logger.debug(f"MIDI-Datei direkt gefunden: {url}")
                return

            # Parse HTML
            soup = BeautifulSoup(response.text, "html.parser")

            # Finde alle Links
            links = soup.find_all("a", href=True)
            for link in links:
                href = link.get("href", "")
                full_url = self._normalize_url(url, href)
                if not full_url:
                    continue

                if self._is_midi_url(full_url) and not self._is_blacklisted(full_url):
                    if full_url not in self.found_urls:
                        self.found_urls.add(full_url)
                        logger.debug(f"MIDI-Link gefunden: {full_url}")

            # Wenn wir noch nicht die maximale Tiefe erreicht haben,
            # crawle auch Unterseiten (begrenzt)
            if current_depth < max_depth - 1:
                page_links = [
                    self._normalize_url(url, a.get("href", ""))
                    for a in soup.find_all("a", href=True)
                ]
                page_links = [
                    u for u in page_links
                    if u and not self._is_midi_url(u)
                    and not self._is_blacklisted(u)
                    and u not in self.scraped_pages
                    and urllib.parse.urlparse(u).netloc == urllib.parse.urlparse(url).netloc
                ][:20]  # Max 20 Unterseiten pro Ebene

                for sub_url in page_links:
                    self._scrape_page(sub_url, max_depth, current_depth + 1)
                    time.sleep(self.delay)

        except requests.RequestException as e:
            logger.warning(f"Fehler beim Crawlen von {url}: {e}")
        except Exception as e:
            logger.error(f"Unerwarteter Fehler beim Crawlen von {url}: {e}")

    def search_google_queries(self, genre_keywords=None):
        """
        Nutzt Google-Suchoperatoren zum Finden von MIDI-Dateien.
        Format: site:domain "keyword" filetype:mid

        Hinweis: Dies ist eine vereinfachte Implementierung die
        Google über die normale Suche simuliert. Für produktiven
        Einsatz sollte die Custom Search API verwendet werden.
        """
        if genre_keywords is None:
            genre_keywords = GENRE_KEYWORDS

        # Domains die durchsucht werden sollen
        target_domains = [
            "midiworld.com",
            "bitmidi.com",
            "freepats.com",
            "huge-midi.com",
            "midiplus.com",
            "midi-archive.com",
            "soundcloud.com",
        ]

        logger.info(f"Starte Google-Suche für {len(genre_keywords)} Keywords...")
        found_count = 0

        for keyword in tqdm(genre_keywords, desc="Google-Suche", unit="keyword"):
            for domain in target_domains:
                # Baue Suchanfrage
                query = f'site:{domain} "{keyword}" filetype:mid'
                encoded_query = urllib.parse.quote(query)
                search_url = f"https://www.google.com/search?q={encoded_query}&num=10"

                try:
                    response = self.session.get(search_url, timeout=self.timeout)
                    response.raise_for_status()

                    # Extrahiere gefundene MIDI-URLs aus den Google-Ergebnissen
                    soup = BeautifulSoup(response.text, "html.parser")
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        # Google leitet über /url?q= weiter
                        if "/url?q=" in href:
                            actual_url = href.split("/url?q=")[1].split("&")[0]
                            if self._is_midi_url(actual_url) and not self._is_blacklisted(actual_url):
                                if actual_url not in self.found_urls:
                                    self.found_urls.add(actual_url)
                                    found_count += 1

                    time.sleep(self.delay)

                except requests.RequestException as e:
                    logger.debug(f"Google-Suche fehlgeschlagen für '{keyword}' auf {domain}: {e}")
                    continue

        logger.info(f"Google-Suche abgeschlossen. {found_count} neue URLs gefunden.")
        return list(self.found_urls)

    def search_by_genre(self, genre_map):
        """
        Durchsucht nach spezifischen Genres aus der Konfiguration.
        genre_map: Dict von Genre -> Liste von Keywords
        """
        all_urls = []

        for genre, keywords in genre_map.items():
            logger.info(f"Suche MIDI-Dateien für Genre: {genre}")
            genre_urls = set()

            for keyword in keywords:
                target_domains = self.config.get("seed_urls", [])
                # Extrahiere Domains aus Seed-URLs
                domains = set()
                for url in target_domains:
                    parsed = urllib.parse.urlparse(url)
                    domains.add(parsed.netloc)

                for domain in domains:
                    query = f'site:{domain} "{keyword}" filetype:mid'
                    encoded_query = urllib.parse.quote(query)
                    search_url = f"https://www.google.com/search?q={encoded_query}&num=10"

                    try:
                        response = self.session.get(search_url, timeout=self.timeout)
                        soup = BeautifulSoup(response.text, "html.parser")
                        for a in soup.find_all("a", href=True):
                            href = a["href"]
                            if "/url?q=" in href:
                                actual_url = href.split("/url?q=")[1].split("&")[0]
                                if self._is_midi_url(actual_url):
                                    genre_urls.add(actual_url)
                        time.sleep(self.delay)
                    except requests.RequestException:
                        continue

            # Weise Genre zu
            for url in genre_urls:
                if url not in self.found_urls:
                    self.found_urls.add(url)
                    all_urls.append((url, genre))

            logger.info(f"Genre '{genre}': {len(genre_urls)} URLs gefunden")

        return all_urls

    def get_results(self):
        """Gibt alle gefundenen MIDI-URLs zurück."""
        return list(self.found_urls)

    def get_stats(self):
        """Gibt Scraping-Statistiken zurück."""
        return {
            "pages_scraped": len(self.scraped_pages),
            "midi_urls_found": len(self.found_urls),
            "blacklist_domains": len(self.blacklist)
        }
