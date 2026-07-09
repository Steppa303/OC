#!/usr/bin/env python3
"""
entertainbernd_bot – Telegram Usenet Bot mit Google Drive Upload

Flow:
  1. /start → Config-Menü (Medientyp, Sprache, Quelle)
  2. "🔍 Los" → Bot fragt nach Suchbegriff
  3. Suchbegriff → API-Suche mit cat= Parameter → Ergebnisse
  4. User antwortet mit Zahl → NZB an SABnzbd → Download starten
  5. Background-Poll alle 30s: fertige Jobs → Upload zu Google Drive "Martin"
"""

import json
import logging
import os
import re
import base64
import mimetypes
import sys
from pathlib import Path

import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
NZBHYDRA2_URL = "http://127.0.0.1:5076"
NZBHYDRA2_API_KEY = os.environ.get("NZBHYDRA2_API_KEY", "")
NZBGEEK_URL = "https://api.nzbgeek.info"
NZBGEEK_API_KEY = os.environ.get("NZBGEEK_API_KEY", "")
SABNZBD_URL = "http://127.0.0.1:8080"
SABNZBD_API_KEY = os.environ.get("SABNZBD_API_KEY", "")
DRIVE_FOLDER_ID = "1rGIvJJRcceMMs-GX-JQPSCiugzipnp0Q"  # Martin-Ordner
USEDOWN_FOLDER_ID = "1og-crcwYkHOZK5UChUjGLGeuab2f4qzx"  # usedown-Ordner (Bastian)
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
# Drive-Upload nutzt OAuth-Token aus /root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json
OAUTH_FILE = Path("/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json")
MCP_URL = "https://connect.composio.dev/mcp"
# ---------------------------------------------------------------------------
# Allowed Users – wer darf den Bot nutzen?
# Set von Telegram-Chat-IDs, persistiert in allowed_users.json
# Bastian kann via /allow <id> und /block <id> verwalten
# ---------------------------------------------------------------------------
ALLOWED_CHAT = 1400987471  # Bastian – darf /allow, /block
BASE_DIR = Path(__file__).parent
JOBS_FILE = BASE_DIR / "jobs.json"
ALLOWED_USERS_FILE = BASE_DIR / "allowed_users.json"


def load_allowed_users() -> set:
    try:
        return set(json.loads(ALLOWED_USERS_FILE.read_text()))
    except (FileNotFoundError, json.JSONDecodeError):
        return {ALLOWED_CHAT}


def save_allowed_users(users: set):
    ALLOWED_USERS_FILE.write_text(json.dumps(sorted(users), indent=2))


allowed_users = load_allowed_users()
LOG_FILE = "/var/log/entertainbernd.log"
POLL_INTERVAL = 30  # Sekunden zwischen Completion-Checks
MAX_RESULTS = 100

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()],
)
log = logging.getLogger("entertainbernd")

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
tracked_jobs: dict = {}  # nzo_id → {name, chat_id}
notified_failed: set = set()  # nzo_ids von bereits gemeldeten Failed-Jobs
notified_missing: set = set()  # nzo_ids von Jobs, deren Pfad nicht existiert
notified_completed: set = set()  # nzo_ids von erfolgreich hochgeladenen Jobs
FAILED_JOBS_FILE = BASE_DIR / "failed_notified.json"
MISSING_JOBS_FILE = BASE_DIR / "missing_notified.json"
COMPLETED_JOBS_FILE = BASE_DIR / "completed_notified.json"


def load_jobs():
    global tracked_jobs
    try:
        tracked_jobs = json.loads(JOBS_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        tracked_jobs = {}


def save_jobs():
    JOBS_FILE.write_text(json.dumps(tracked_jobs, indent=2))


def load_failed_notified():
    global notified_failed
    try:
        notified_failed = set(json.loads(FAILED_JOBS_FILE.read_text()))
    except (FileNotFoundError, json.JSONDecodeError):
        notified_failed = set()


def save_failed_notified():
    FAILED_JOBS_FILE.write_text(json.dumps(sorted(notified_failed), indent=2))


def load_missing_notified():
    global notified_missing
    try:
        notified_missing = set(json.loads(MISSING_JOBS_FILE.read_text()))
    except (FileNotFoundError, json.JSONDecodeError):
        notified_missing = set()


def save_missing_notified():
    MISSING_JOBS_FILE.write_text(json.dumps(sorted(notified_missing), indent=2))


def load_completed_notified():
    global notified_completed
    try:
        notified_completed = set(json.loads(COMPLETED_JOBS_FILE.read_text()))
    except (FileNotFoundError, json.JSONDecodeError):
        notified_completed = set()


def save_completed_notified():
    COMPLETED_JOBS_FILE.write_text(json.dumps(sorted(notified_completed), indent=2))


# ---------------------------------------------------------------------------
# Google Drive – Upload via Composio MCP (wie addbook)
# ---------------------------------------------------------------------------

class MCPClient:
    """Minimal MCP client für Composio streamable-http transport."""

    def __init__(self, url: str, oauth_path: str):
        self.url = url
        self.session = requests.Session()
        self._req_id = 0
        self._session_id = None

        with open(oauth_path) as f:
            oauth = json.load(f)
        self.token = oauth["tokens"]["access_token"]

        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {self.token}"
        })
        self._initialize()

    def _next_id(self):
        self._req_id += 1
        return self._req_id

    def _parse_sse(self, response_text: str) -> dict | None:
        for line in response_text.split("\n"):
            if line.startswith("data:"):
                try:
                    data = json.loads(line[5:].strip())
                    if "result" in data:
                        return data
                    elif "error" in data:
                        log.error("MCP error: %s", data["error"])
                        return data
                except json.JSONDecodeError:
                    continue
        return None

    def _initialize(self):
        req = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "entertainbernd-bot", "version": "1.0"}
            }
        }
        r = self.session.post(self.url, json=req, timeout=30)
        r.raise_for_status()
        self._session_id = r.headers.get("mcp-session-id")
        if self._session_id:
            self.session.headers["mcp-session-id"] = self._session_id
        notif = {"jsonrpc": "2.0", "method": "notifications/initialized"}
        self.session.post(self.url, json=notif, timeout=10)
        log.info("MCP session initialized (id=%s)", self._session_id)

    def call_tool(self, name: str, arguments: dict, timeout: int = 600) -> dict:
        req = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments}
        }
        r = self.session.post(self.url, json=req, timeout=timeout)
        r.raise_for_status()
        result = self._parse_sse(r.text)
        if not result:
            return {"error": "No result from MCP call"}
        if "error" in result:
            return result
        contents = result.get("result", {}).get("content", [])
        texts = [c.get("text", "") for c in contents if c.get("type") == "text"]
        combined = "\n".join(texts)
        try:
            return json.loads(combined)
        except json.JSONDecodeError:
            return {"raw_text": combined}


def _extract_upload_result(result: dict) -> str:
    """Extrahiere file_id aus einem GOOGLEDRIVE_UPLOAD_FILE Ergebnis."""
    data = result.get("data", result)
    if isinstance(data, dict):
        results_list = data.get("results", [])
        if results_list:
            for r_item in results_list:
                resp = r_item.get("response", {})
                r_data = resp.get("data", resp)
                if isinstance(r_data, dict):
                    fid = r_data.get("id") or r_data.get("fileId") or r_data.get("file", {}).get("id")
                    if fid:
                        return fid
        # Direkter Zugriff
        fid = data.get("id") or data.get("fileId") or data.get("file", {}).get("id")
        if fid:
            return fid
    # Fallback: raw_text parsen
    raw = result.get("raw_text", "")
    if raw:
        try:
            parsed = json.loads(raw)
            return parsed.get("id") or parsed.get("fileId") or ""
        except json.JSONDecodeError:
            pass
    # Letzter Versuch: success_count check
    if isinstance(data, dict):
        if data.get("success_count", 0) > 0 or data.get("successful"):
            log.info("Upload vermutlich erfolgreich (keine ID extrahierbar)")
            return "unknown"
    return ""


import secrets
import shutil

TEMPUPLOAD_DIR = Path("/srv/clawshare/.entertainbernd-upload")


def upload_file_to_drive(file_path: str, folder_id: str = DRIVE_FOLDER_ID) -> bool:
    """Upload eine Datei nach Google Drive über Composio MCP.

    Flow:
      1. Temporären HTTPS-Server mit self-signed Cert starten
      2. GOOGLEDRIVE_UPLOAD_FROM_URL mit verify_ssl:false
      3. Google holt Datei direkt vom VPS
    """
    if not os.path.isfile(file_path):
        log.error("Datei nicht gefunden: %s", file_path)
        return False

    file_name = os.path.basename(file_path)
    if not file_name:
        return False

    file_sz = os.path.getsize(file_path)
    mime_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
    log.info("Starte Drive-Upload: %s (%s MB) → Ordner %s", file_name, file_sz / 1_048_576, folder_id)

    import http.server
    import socketserver
    import threading

    abs_path = os.path.abspath(file_path)
    serve_dir = os.path.dirname(abs_path)
    basename = os.path.basename(abs_path)

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=serve_dir, **kwargs)
        def log_message(self, fmt, *args):
            log.debug("HTTP[stage]: %s", fmt % args)

    httpd = None
    for port in range(15000, 16000):
        try:
            httpd = socketserver.TCPServer(("0.0.0.0", port), QuietHandler)
            break
        except OSError:
            continue
    if not httpd:
        log.error("Kein freier Port für Temp-Server")
        return False

    # Self-signed cert + HTTPS wrapper
    import ssl as ssl_mod
    ctx = ssl_mod.SSLContext(ssl_mod.PROTOCOL_TLS_SERVER)
    try:
        ctx.load_cert_chain("/tmp/temp-upload-cert.pem", "/tmp/temp-upload-key.pem")
    except OSError:
        # Generate fresh cert
        import subprocess as sp
        sp.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", "/tmp/temp-upload-key.pem",
            "-out", "/tmp/temp-upload-cert.pem",
            "-days", "1", "-nodes",
            "-subj", "/CN=185.217.126.72"
        ], capture_output=True, timeout=10)
        ctx.load_cert_chain("/tmp/temp-upload-cert.pem", "/tmp/temp-upload-key.pem")

    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    port = httpd.server_address[1]

    try:
        file_url = f"https://185.217.126.72:{port}/{basename}"
        log.info("Upload via HTTPS-URL: %s", file_url)

        mcp = MCPClient(MCP_URL, str(OAUTH_FILE))
        result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
            "tools": [{
                "tool_slug": "GOOGLEDRIVE_UPLOAD_FROM_URL",
                "arguments": {
                    "source_url": file_url,
                    "name": file_name,
                    "mime_type": mime_type,
                    "parent_folder_id": folder_id,
                    "verify_ssl": False
                }
            }],
            "session_id": None
        }, timeout=600)

        fid = _extract_upload_result(result)
        if fid:
            log.info("✅ %s uploaded (Drive ID: %s, %s MB)", file_name, fid, file_sz / 1_048_576)
            return True
        else:
            log.error("UPLOAD_FROM_URL fehlgeschlagen: %s", json.dumps(result)[:500])
            return False

    except Exception as e:
        log.error("Drive-Upload-Fehler: %s", e)
        return False
    finally:
        httpd.shutdown()
        log.info("Temp HTTPS-Server gestoppt")


# ---------------------------------------------------------------------------
# NZBHydra2
# ---------------------------------------------------------------------------

def _normalize_results(raw) -> list:
    """NZBHydra2 liefert bei 1 Treffer ein Dict, bei mehreren eine Liste."""
    if isinstance(raw, dict):
        return [raw]
    return raw if isinstance(raw, list) else []


def search_nzb(query: str, cat: str | None = None) -> list:
    """Suche via NZBHydra2 Newznab-API, gebe Liste mit max MAX_RESULTS Items.

    Args:
        query: Suchbegriff
        cat: Newznab-Category-String (z.B. "2000,5000") oder None für alle
    """
    try:
        params = {"apikey": NZBHYDRA2_API_KEY, "t": "search", "q": query, "o": "json", "limit": MAX_RESULTS}
        if cat:
            params["cat"] = cat
        r = requests.get(
            f"{NZBHYDRA2_URL}/api",
            params=params,
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        items = data.get("channel", {}).get("item", [])
        items = _normalize_results(items)[:MAX_RESULTS]
        # Tag mit Quelle
        for it in items:
            it["_source"] = "Hydra"
        return items
    except Exception as e:
        log.error("NZBHydra2-Suche fehlgeschlagen: %s", e)
        return []


def search_nzbgeek(query: str, cat: str | None = None) -> list:
    """Suche via NZBGeek API (Newznab-kompatibel).

    Args:
        query: Suchbegriff
        cat: Newznab-Category-String (z.B. "2000,5000") oder None für alle
    """
    try:
        params = {"apikey": NZBGEEK_API_KEY, "t": "search", "q": query, "o": "json", "limit": MAX_RESULTS}
        if cat:
            params["cat"] = cat
        r = requests.get(
            f"{NZBGEEK_URL}/api",
            params=params,
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        items = data.get("channel", {}).get("item", [])
        items = _normalize_results(items)[:MAX_RESULTS]
        # Tag mit Quelle
        for it in items:
            it["_source"] = "Geek"
        return items
    except Exception as e:
        log.error("NZBGeek-Suche fehlgeschlagen: %s", e)
        return []


def search_all(query: str, cat: str | None = None) -> list:
    """Suche in beiden Quellen und merge dedupliziert.

    Args:
        query: Suchbegriff
        cat: Newznab-Category-String (z.B. "2000,5000") oder None für alle
    """
    hydra_items = search_nzb(query, cat)
    geek_items = search_nzbgeek(query, cat)

    # Dedup: Titel normalisiert vergleichen
    seen = set()
    merged = []
    # Zuerst Geek-Ergebnisse (NZBGeek), dann Hydra
    for item in geek_items + hydra_items:
        key = _clean_title(item.get("title", "")).lower().strip()
        if key and key not in seen:
            seen.add(key)
            merged.append(item)

    return merged[:MAX_RESULTS]


# ---------------------------------------------------------------------------
# Filter Helpers
# ---------------------------------------------------------------------------

def _detect_language(item: dict) -> str:
    """Erkenne Sprache aus dem Titel. Returns 'de', 'en' oder '?'."""
    title = item.get("title", "").lower()
    # Deutsch-Indikatoren
    de_patterns = ["german", "deutsch", "synchro", "ac3d", "ger", "nl.", "german", "dt."]
    # Englisch-Indikatoren
    en_patterns = ["english", "en.", "subbed"]
    for p in de_patterns:
        if p in title:
            return "de"
    for p in en_patterns:
        if p in title:
            return "en"
    return "?"


def _format_size(size_val) -> str:
    """Größe formatiert anzeigen (Bytes → MB/GB)."""
    try:
        s = float(size_val)
        if s >= 1_073_741_824:
            return f"{s / 1_073_741_824:.1f} GB"
        return f"{s / 1_048_576:.0f} MB"
    except (ValueError, TypeError):
        return str(size_val)


def _clean_title(title: str) -> str:
    """Title aufräumen: Indexer-Tags entfernen, kürzen."""
    cleaned = re.sub(r'\s+yEnc$', '', title)
    cleaned = re.sub(r'\s*\[.*?\]\s*', ' ', cleaned)
    if len(cleaned) > 120:
        cleaned = cleaned[:117] + "..."
    return cleaned.strip()


def _get_item_size(item: dict) -> str:
    """Hole die Größe aus item – entweder direkt, aus attr-Array oder aus enclosure."""
    size = item.get("size")
    if size:
        return _format_size(size)
    attrs = item.get("attr", [])
    if attrs:
        for a in attrs:
            at = a.get("@attributes", a.get("attributes", {}))
            if at.get("name") == "size":
                return _format_size(at.get("value", 0))
    enc = item.get("enclosure", {})
    enc_attrs = enc.get("@attributes", {})
    if enc_attrs.get("length"):
        return _format_size(enc_attrs["length"])
    return "?"


def _get_media_type(item: dict) -> str:
    """Extrahiere Medientyp (Anzeigeformat) aus der Newznab-Category."""
    cat = item.get("category", "")
    if isinstance(cat, list):
        cat = cat[0] if cat else ""
    cat_lower = cat.lower()
    if "tv" in cat_lower:
        return "📺 Serie"
    if "movie" in cat_lower or "film" in cat_lower:
        return "🎬 Film"
    if "audio" in cat_lower or "music" in cat_lower:
        return "🎵 Audio"
    if "book" in cat_lower or "comic" in cat_lower or "manga" in cat_lower:
        return "📚 Buch"
    if "pc" in cat_lower or "console" in cat_lower or "game" in cat_lower or "nintendo" in cat_lower or "playstation" in cat_lower or "xbox" in cat_lower:
        return "🎮 Game"
    if "xxx" in cat_lower or "adult" in cat_lower:
        return "🔞 XXX"
    if "other" in cat_lower:
        return "📦 Other"
    return f"🏷️ {cat}" if cat else "📦 Other"


def _get_source_emoji(item: dict) -> str:
    source = item.get("_source", "?")
    return "🌐 Geek" if source == "Geek" else "🔧 Hydra"


def _get_media_type_key(item: dict) -> str:
    """Normalisierter Medientyp-Key für Filtervergleich."""
    cat = item.get("category", "")
    if isinstance(cat, list):
        cat = cat[0] if cat else ""
    cat_lower = cat.lower()
    if "tv" in cat_lower or "series" in cat_lower:
        return "serie"
    if "movie" in cat_lower or "film" in cat_lower:
        return "film"
    if "audio" in cat_lower or "music" in cat_lower:
        return "audio"
    if "book" in cat_lower or "comic" in cat_lower or "manga" in cat_lower:
        return "buch"
    if "pc" in cat_lower or "console" in cat_lower or "game" in cat_lower or "nintendo" in cat_lower or "playstation" in cat_lower or "xbox" in cat_lower or "ps4" in cat_lower or "ps5" in cat_lower:
        return "game"
    if "xxx" in cat_lower or "adult" in cat_lower:
        return "xxx"
    return "other"


def _filter_results(items: list, config: dict) -> list:
    """Wende clientseitige Filter auf Result-Liste an (Sprache, Quelle).

    Der media_type-Filter wird NICHT mehr hier angewendet – das macht
    die API über den cat-Parameter.
    """
    result = items

    lang = config.get("language")
    if lang:
        result = [it for it in result if _detect_language(it) == lang]

    source = config.get("source")
    if source:
        result = [it for it in result if it.get("_source", "").lower() == source.lower()]

    return result


# ---------------------------------------------------------------------------
# Config -> Newznab Category ID
# ---------------------------------------------------------------------------

def _config_to_cat(media_type: str) -> str | None:
    """Wandle media_type in Newznab Category-String um."""
    return {
        "film": "2000",
        "serie": "5000",
        "audio": "3000",
        "buch": "7000",
        "game": "1000,4000",
        "all": None,
    }.get(media_type)


# ---------------------------------------------------------------------------
# Config Keyboard Builder
# ---------------------------------------------------------------------------

def _build_config_status_text(config: dict) -> str:
    """Baue den Status-Text für das Config-Menü."""
    media_labels = {
        "film": "🎬 Film",
        "serie": "📺 Serie",
        "audio": "🎵 Audio",
        "buch": "📚 Bücher",
        "game": "🎮 Games",
        "all": "📦 Alles",
    }
    lang_labels = {
        "de": "🇩🇪 Deutsch",
        "en": "🇬🇧 Englisch",
        None: "🌐 Alle Sprachen",
    }
    source_labels = {
        "geek": "🌐 Geek",
        "hydra": "🔧 Hydra",
        None: "🔀 Beide",
    }

    media = media_labels.get(config.get("media_type", "film"), "🎬 Film")
    lang = lang_labels.get(config.get("language"), "🌐 Alle Sprachen")
    source = source_labels.get(config.get("source"), "🔀 Beide")

    return (
        "⚙️ EntertainBernd – Suche konfigurieren\n\n"
        f"{media} | {lang} | {source}"
    )


def _build_config_keyboard(config: dict) -> InlineKeyboardMarkup:
    """Baue das Config-Inline-Keyboard."""
    current_media = config.get("media_type", "film")
    current_lang = config.get("language")
    current_source = config.get("source")

    # Media Type Buttons
    media_btns = [
        InlineKeyboardButton(
            ("✅ " if current_media == "film" else "") + "🎬 Film",
            callback_data="config_media_film",
        ),
        InlineKeyboardButton(
            ("✅ " if current_media == "serie" else "") + "📺 Serie",
            callback_data="config_media_serie",
        ),
        InlineKeyboardButton(
            ("✅ " if current_media == "audio" else "") + "🎵 Audio",
            callback_data="config_media_audio",
        ),
    ]
    media_btns2 = [
        InlineKeyboardButton(
            ("✅ " if current_media == "buch" else "") + "📚 Bücher",
            callback_data="config_media_buch",
        ),
        InlineKeyboardButton(
            ("✅ " if current_media == "game" else "") + "🎮 Games",
            callback_data="config_media_game",
        ),
        InlineKeyboardButton(
            ("✅ " if current_media == "all" else "") + "📦 Alles",
            callback_data="config_media_all",
        ),
    ]

    # Language Buttons
    lang_btns = [
        InlineKeyboardButton(
            ("✅ " if current_lang == "de" else "") + "🇩🇪 DE",
            callback_data="config_lang_de",
        ),
        InlineKeyboardButton(
            ("✅ " if current_lang == "en" else "") + "🇬🇧 EN",
            callback_data="config_lang_en",
        ),
        InlineKeyboardButton(
            ("✅ " if current_lang is None else "") + "🌐 Alle Sprachen",
            callback_data="config_lang_all",
        ),
    ]

    # Source Buttons
    src_btns = [
        InlineKeyboardButton(
            ("✅ " if current_source == "geek" else "") + "🌐 Geek",
            callback_data="config_source_geek",
        ),
        InlineKeyboardButton(
            ("✅ " if current_source == "hydra" else "") + "🔧 Hydra",
            callback_data="config_source_hydra",
        ),
        InlineKeyboardButton(
            ("✅ " if current_source is None else "") + "🔀 Beide",
            callback_data="config_source_all",
        ),
    ]

    # Search button
    search_btn = [InlineKeyboardButton("🔍 Los, suchen!", callback_data="config_search")]

    rows = [
        media_btns,
        media_btns2,
        lang_btns,
        src_btns,
        search_btn,
    ]
    return InlineKeyboardMarkup(rows)


# ---------------------------------------------------------------------------
# Keyboard Builder (für Ergebnisse)
# ---------------------------------------------------------------------------




def _build_pagination_keyboard(total_items: int, page: int, page_size: int) -> list:
    """Baue Pagination-Buttons."""
    total_pages = max(1, (total_items + page_size - 1) // page_size)
    btns = []
    if page > 0:
        btns.append(InlineKeyboardButton("⬅️", callback_data="page_prev"))
    btns.append(InlineKeyboardButton(f"Seite {page + 1}/{total_pages}", callback_data="page_info"))
    if page < total_pages - 1:
        btns.append(InlineKeyboardButton("➡️", callback_data="page_next"))
    return [btns] if btns else []


def _build_result_keyboard(num_items: int, page: int, page_size: int) -> list:
    """Baue nummerierte Ergebnis-Buttons (eine Reihe pro 5)."""
    start = page * page_size
    end = min(start + page_size, num_items)
    buttons = []
    for i in range(start + 1, end + 1):
        buttons.append(InlineKeyboardButton(str(i), callback_data=f"detail_{i}"))
    rows = [buttons[i:i+5] for i in range(0, len(buttons), 5)]
    return rows


def _build_full_keyboard(ctx: ContextTypes.DEFAULT_TYPE, total_items: int) -> InlineKeyboardMarkup:
    """Baue das komplette Keyboard: Ergebnisse + Pagination + 1 Filter-Button."""
    page = ctx.user_data.get("page", 0)
    page_size = ctx.user_data.get("page_size", 10)
    rows = []
    rows.extend(_build_result_keyboard(total_items, page, page_size))
    rows.extend(_build_pagination_keyboard(total_items, page, page_size))
    # Ein einziger Filter-Button, der /filter triggert
    rows.append([InlineKeyboardButton("📋 Filter: Sprache / Quelle", callback_data="open_filter")])
    return InlineKeyboardMarkup(rows)


def build_result_list(items: list, page: int = 0, page_size: int = 10) -> str:
    """Baue nummerierte Ergebnis-Liste für eine Seite (max 4096 Zeichen, plain text)."""
    start = page * page_size
    end = min(start + page_size, len(items))
    page_items = items[start:end]

    lines = []
    for i, item in enumerate(page_items, start + 1):
        title = _clean_title(item.get("title", "?"))
        size_str = _get_item_size(item)
        media_type = _get_media_type(item)
        source = _get_source_emoji(item)
        lines.append(f"{i}. {source} {media_type} · {size_str}\n   {title}")

    msg = "\n\n".join(lines)
    if len(msg) > 4000:
        msg = msg[:3997] + "..."
    return msg


# ---------------------------------------------------------------------------
# SABnzbd
# ---------------------------------------------------------------------------

def add_nzb(nzb_url: str, nzb_name: str) -> str | None:
    """NZB via URL an SABnzbd übergeben → nzo_id zurück."""
    try:
        r = requests.get(
            f"{SABNZBD_URL}/api",
            params={
                "mode": "addurl",
                "name": nzb_url,
                "apikey": SABNZBD_API_KEY,
                "nzbname": nzb_name,
            },
            timeout=30,
        )
        r.raise_for_status()
        # SABnzbd returned z.B. {"status": true, "nzo_ids": ["SAB_UUID"]}
        data = r.json()
        ids = data.get("nzo_ids", [])
        return ids[0] if ids else None
    except Exception as e:
        log.error("SABnzbd addurl fehlgeschlagen: %s", e)
        return None


def fetch_history() -> list:
    """Hole die letzten 50 History-Einträge von SABnzbd."""
    try:
        r = requests.get(
            f"{SABNZBD_URL}/api",
            params={"mode": "history", "start": 0, "limit": 50, "output": "json", "apikey": SABNZBD_API_KEY},
            timeout=15,
        )
        r.raise_for_status()
        return r.json().get("history", {}).get("slots", [])
    except Exception as e:
        log.error("SABnzbd History fehlgeschlagen: %s", e)
        return []


def container_to_host(container_path: str) -> str:
    """Wandle Container-Pfad (/downloads/complete/…) in Host-Pfad um."""
    if container_path.startswith("/downloads/complete/"):
        return container_path.replace("/downloads/complete/", "/srv/clawshare/usenet/downloads/complete/")
    return container_path


# ---------------------------------------------------------------------------
# Telegram Handler – Start / Config
# ---------------------------------------------------------------------------

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Zeige das Config-Menü an."""
    chat_id = update.effective_chat.id
    name = update.effective_user.full_name if update.effective_user else "unbekannt"
    username = update.effective_user.username if update.effective_user else ""
    log.info("📩 /start von %s (@%s, Chat-ID: %s)", name, username, chat_id)

    if chat_id not in allowed_users:
        log.info("🔴 Unauthorized /start von %s (Chat-ID: %s)", name, chat_id)
        await update.message.reply_text(
            "❌ Du hast keine Berechtigung. Bitte lass dich von Bastian freischalten."
        )
        return

    # Config initialisieren (Default-Werte)
    ctx.user_data["config"] = {
        "media_type": "film",
        "language": None,
        "source": None,
    }

    # Anleitung
    guide = (
        "🎬 **EntertainBernd – Usenet Downloader**\n\n"
        "1️⃣ **Konfigurieren** – Medientyp, Sprache & Quelle unten einstellen\n"
        "2️⃣ **🔍 Los, suchen!** klicken und Suchbegriff eingeben\n"
        "3️⃣ **Ergebnis wählen** – Zahl klicken für Details\n"
        "4️⃣ **⬇️ Download** – landet bei SABnzbd → Google Drive\n\n"
        "📍 **Slash-Commands** (immer im Menü links):\n"
        "/filter – Sprache & Quelle nachträglich filtern\n"
        "/media – Medientyp wechseln (neue Suche)\n"
        "/queue – Laufende Downloads checken\n"
        "/watch – Watchlist (coming soon)\n"
    )

    await update.message.reply_text(guide, parse_mode="Markdown")

    status_text = _build_config_status_text(ctx.user_data["config"])
    keyboard = _build_config_keyboard(ctx.user_data["config"])

    await update.message.reply_text(status_text, reply_markup=keyboard)


async def config_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Config-Button gedrückt: media, language, source ändern oder search starten."""
    query = update.callback_query
    await query.answer()

    if update.effective_chat.id not in allowed_users:
        return

    parts = query.data.split("_")
    # config_media_film → ["config", "media", "film"]
    # config_search → ["config", "search"]
    action = parts[1]

    # Sicherstellen, dass config existiert
    if "config" not in ctx.user_data:
        ctx.user_data["config"] = {
            "media_type": "film",
            "language": None,
            "source": None,
        }

    cfg = ctx.user_data["config"]

    if action == "search":
        # Such-Modus aktivieren
        ctx.user_data["awaiting_query"] = True
        await query.edit_message_text(
            "🔍 Suchbegriff eingeben:\n"
            "(Schreib einfach los – ich such dann mit deinen Einstellungen)"
        )
        return

    if action == "media":
        # media_type ändern
        value = parts[2]
        if cfg.get("media_type") == value:
            # Toggle: gleicher Wert → zurücksetzen auf film
            cfg["media_type"] = "film"
        else:
            cfg["media_type"] = value
    elif action == "lang":
        # Sprache umschalten
        value = parts[2]
        if value == "all":
            cfg["language"] = None
        elif cfg.get("language") == value:
            cfg["language"] = None
        else:
            cfg["language"] = value
    elif action == "source":
        # Quelle umschalten
        value = parts[2]
        if value == "all":
            cfg["source"] = None
        elif cfg.get("source") == value:
            cfg["source"] = None
        else:
            cfg["source"] = value

    ctx.user_data["config"] = cfg

    # Config-Menü aktualisieren
    status_text = _build_config_status_text(cfg)
    keyboard = _build_config_keyboard(cfg)
    await query.edit_message_text(status_text, reply_markup=keyboard)


# ---------------------------------------------------------------------------
# Telegram Handler – Search
# ---------------------------------------------------------------------------

async def handle_search(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Jeder Text nach Config-Setup → Suche mit cat= Parameter ausführen."""
    if update.effective_chat.id not in allowed_users:
        chat_id = update.effective_chat.id
        name = update.effective_user.full_name if update.effective_user else "unbekannt"
        log.info("🔴 Unauthorized Zugriff von %s (Chat-ID: %s)", name, chat_id)
        await update.message.reply_text(
            "❌ Du bist nicht freigeschaltet. Bitte lass dich von Bastian freischalten."
        )
        return

    query = update.message.text.strip()
    if not query:
        return

    # Config auslesen und cat-Parameter ableiten
    config = ctx.user_data.get("config", {})
    cat = _config_to_cat(config.get("media_type", "film"))

    # Suche mit cat-Parameter direkt in der API
    items = search_all(query, cat)
    if not items:
        await update.message.reply_text("❌ Nix gefunden. Anderer Suchbegriff?")
        return

    # State initialisieren – Config-Einstellungen als filter kopieren
    ctx.user_data["last_results"] = items
    ctx.user_data["last_query"] = query
    ctx.user_data["filter"] = {
        "language": config.get("language"),
        "source": config.get("source"),
    }
    ctx.user_data["page"] = 0
    ctx.user_data["page_size"] = 10
    ctx.user_data["awaiting_query"] = False

    # Clientseitig nur noch Sprache + Quelle filtern
    filtered = _filter_results(items, ctx.user_data["filter"])

    msg = f"🔍 {len(filtered)}/{len(items)} Treffer für: {query}\n\n"
    msg += build_result_list(filtered, 0, 10)

    await update.message.reply_text(
        msg,
        reply_markup=_build_full_keyboard(ctx, len(filtered))
    )


async def detail_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """User hat eine Ergebnisnummer gedrückt → Detail-Ansicht mit Download-Button."""
    query = update.callback_query
    await query.answer()

    if update.effective_chat.id not in allowed_users:
        return

    choice = int(query.data.split("_")[1])
    items = ctx.user_data.get("last_results", [])
    filtered = _filter_results(items, ctx.user_data.get("filter", {}))

    if not filtered or choice < 1 or choice > len(filtered):
        await query.edit_message_text("⚠️ Suchergebnisse abgelaufen – bitte neu suchen.")
        return

    selected = filtered[choice - 1]
    title = _clean_title(selected.get("title", "?"))
    size_str = _get_item_size(selected)
    media_type = _get_media_type(selected)
    source = _get_source_emoji(selected)
    lang = "🇩🇪 Deutsch" if _detect_language(selected) == "de" else ("🇬🇧 Englisch" if _detect_language(selected) == "en" else "🌐 Unbekannt")

    # Info-Text
    info = (
        f"📄 {title}\n\n"
        f"{media_type} | {source}\n"
        f"📦 {size_str} | {lang}\n"
    )

    # Buttons: Download und Zurück
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("⬇️ Download", callback_data=f"dl_{choice}"),
            InlineKeyboardButton("❤️ Watchlist", callback_data=f"watch_{choice}"),
            InlineKeyboardButton("🔙 Zurück", callback_data="back_to_results"),
        ]
    ])

    await query.edit_message_text(info, reply_markup=keyboard)


async def page_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Pagination-Button gedrückt."""
    query = update.callback_query
    await query.answer()

    if update.effective_chat.id not in allowed_users:
        return

    action = query.data.split("_")[1]  # next, prev
    items = ctx.user_data.get("last_results", [])
    filtered = _filter_results(items, ctx.user_data.get("filter", {}))
    page = ctx.user_data.get("page", 0)
    page_size = ctx.user_data.get("page_size", 10)

    if action == "next" and (page + 1) * page_size < len(filtered):
        page += 1
    elif action == "prev" and page > 0:
        page -= 1
    else:
        return

    ctx.user_data["page"] = page

    query_text = ctx.user_data.get("last_query", "")
    msg = f"🔍 {len(filtered)}/{len(items)} Treffer für: {query_text}\n\n"
    msg += build_result_list(filtered, page, page_size)

    await query.edit_message_text(
        msg,
        reply_markup=_build_full_keyboard(ctx, len(filtered))
    )


async def open_filter_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """📋 Filter-Button gedrückt → /filter-UI anzeigen."""
    query = update.callback_query
    await query.answer()

    if update.effective_chat.id not in allowed_users:
        return

    items = ctx.user_data.get("last_results", [])
    if not items:
        return

    f = ctx.user_data.get("filter", {})
    total = len(items)
    filtered = _filter_results(items, f)

    lang_btns = [
        InlineKeyboardButton("🇩🇪 DE" + (" ✅" if f.get("language") == "de" else ""), callback_data="flt_lang_de"),
        InlineKeyboardButton("🇬🇧 EN" + (" ✅" if f.get("language") == "en" else ""), callback_data="flt_lang_en"),
    ]
    has_lang = f.get("language") is not None
    lang_btns.append(InlineKeyboardButton("🌐 All" + ("" if has_lang else " ✅"), callback_data="flt_lang_all"))

    src_btns = [
        InlineKeyboardButton("🌐 Geek" + (" ✅" if f.get("source") == "geek" else ""), callback_data="flt_source_geek"),
        InlineKeyboardButton("🔧 Hydra" + (" ✅" if f.get("source") == "hydra" else ""), callback_data="flt_source_hydra"),
    ]
    has_src = f.get("source") is not None
    src_btns.append(InlineKeyboardButton("🔀 All" + ("" if has_src else " ✅"), callback_data="flt_source_all"))

    apply_btns = [InlineKeyboardButton("🔄 Anwenden", callback_data="flt_apply")]

    keyboard = InlineKeyboardMarkup([lang_btns, src_btns, apply_btns])

    await query.edit_message_text(
        f"🔍 Filter ({len(filtered)}/{total} Treffer)\n\n"
        "Sprache & Quelle wählen – arbeitet auf dem Ergebnis-Cache:",
        reply_markup=keyboard,
    )


async def flt_apply_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """"Anwenden"-Button im Filter → zurück zur Ergebnisliste."""
    query = update.callback_query
    await query.answer()

    items = ctx.user_data.get("last_results", [])
    filtered = _filter_results(items, ctx.user_data.get("filter", {}))
    query_text = ctx.user_data.get("last_query", "")
    page = ctx.user_data.get("page", 0)

    msg = f"🔍 {len(filtered)}/{len(items)} Treffer für: {query_text}\n\n"
    msg += build_result_list(filtered, page, ctx.user_data.get("page_size", 10))

    await query.edit_message_text(
        msg,
        reply_markup=_build_full_keyboard(ctx, len(filtered))
    )


async def back_to_results(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Zurück zur Ergebnisliste aus Detail-Ansicht."""
    query = update.callback_query
    await query.answer()

    items = ctx.user_data.get("last_results", [])
    filtered = _filter_results(items, ctx.user_data.get("filter", {}))
    query_text = ctx.user_data.get("last_query", "")
    page = ctx.user_data.get("page", 0)
    page_size = ctx.user_data.get("page_size", 10)

    msg = f"🔍 {len(filtered)}/{len(items)} Treffer für: {query_text}\n\n"
    msg += build_result_list(filtered, page, page_size)

    await query.edit_message_text(
        msg,
        reply_markup=_build_full_keyboard(ctx, len(filtered))
    )


async def button_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """User hat Download in Detail-Ansicht gedrückt → Download starten."""
    query = update.callback_query
    await query.answer()

    if update.effective_chat.id not in allowed_users:
        chat_id = update.effective_chat.id
        log.info("🔴 Unauthorized Button-Zugriff von Chat-ID: %s", chat_id)
        return

    # callback_data = "dl_3" → choice = 3
    choice = int(query.data.split("_")[1])

    items = ctx.user_data.get("last_results", [])
    filtered = _filter_results(items, ctx.user_data.get("filter", {}))

    if not filtered or choice < 1 or choice > len(filtered):
        await query.edit_message_text("⚠️ Suchergebnisse abgelaufen – bitte neu suchen.")
        return

    selected = filtered[choice - 1]
    raw_link = selected.get("link", "")
    if not raw_link:
        await query.edit_message_text("❌ Kein Download-Link für diesen Treffer.")
        return

    if raw_link.startswith("http"):
        # NZBHydra2 returned absolute URL mit localhost – für SABnzbd (Docker!) auf hostname umbiegen
        nzb_url = raw_link.replace("127.0.0.1", "nzbhydra2").replace("localhost", "nzbhydra2")
    else:
        nzb_url = f"{NZBHYDRA2_URL}{raw_link}"

    nzb_name = _clean_title(selected.get("title", "unknown"))
    log.info("Starte Download: %s", nzb_name)

    # Buttons entfernen, Status zeigen
    await query.edit_message_reply_markup(reply_markup=None)

    nzo_id = add_nzb(nzb_url, nzb_name)
    if nzo_id:
        tracked_jobs[nzo_id] = {"name": nzb_name, "chat_id": update.effective_chat.id}
        save_jobs()
        await query.message.reply_text(f"✅ Download gestartet:\n{nzb_name}")
    else:
        await query.message.reply_text("❌ Konnte Download nicht starten (SABnzbd-Fehler).")


# ---------------------------------------------------------------------------
# Admin-Commands (nur Bastian)
# ---------------------------------------------------------------------------

async def cmd_allow(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    "/allow <chat_id> – Füge User zur Whitelist hinzu (nur Bastian)"
    if update.effective_chat.id != ALLOWED_CHAT:
        await update.message.reply_text("❌ Nur Bastian darf das.")
        return

    args = ctx.args
    if not args:
        await update.message.reply_text(
            "🔢 Nutzung: /allow <chat_id>\n"
            "Die Chat-ID bekommst du, wenn Martin dem Bot schreibt – "
            "ich logge sie dann im Log (/var/log/entertainbernd.log)."
        )
        return

    try:
        new_id = int(args[0])
    except ValueError:
        await update.message.reply_text("❌ Ungültige Chat-ID. Muss eine Zahl sein.")
        return

    global allowed_users
    allowed_users.add(new_id)
    save_allowed_users(allowed_users)
    await update.message.reply_text(
        f"✅ User {new_id} freigeschaltet!\n"
        f"📋 Aktuell {len(allowed_users)} User in der Whitelist."
    )
    log.info("User %s wurde freigeschaltet von Bastian", new_id)


async def cmd_block(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    "/block <chat_id> – Entferne User aus der Whitelist (nur Bastian)"
    if update.effective_chat.id != ALLOWED_CHAT:
        await update.message.reply_text("❌ Nur Bastian darf das.")
        return

    args = ctx.args
    if not args:
        await update.message.reply_text(
            "🔢 Nutzung: /block <chat_id>"
        )
        return

    try:
        remove_id = int(args[0])
    except ValueError:
        await update.message.reply_text("❌ Ungültige Chat-ID. Muss eine Zahl sein.")
        return

    global allowed_users
    if remove_id == ALLOWED_CHAT:
        await update.message.reply_text("😂 Dich kann ich nicht blocken, Chef.")
        return

    if remove_id not in allowed_users:
        await update.message.reply_text(f"⚠️ User {remove_id} ist gar nicht freigeschaltet.")
        return

    allowed_users.discard(remove_id)
    save_allowed_users(allowed_users)
    await update.message.reply_text(
        f"🗑️ User {remove_id} blockiert.\n"
        f"📋 Aktuell {len(allowed_users)} User in der Whitelist."
    )
    log.info("User %s wurde blockiert von Bastian", remove_id)


async def cmd_users(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    "/users – Zeigt alle freigeschalteten User (nur Bastian)"
    if update.effective_chat.id != ALLOWED_CHAT:
        await update.message.reply_text("❌ Nur Bastian darf das.")
        return

    if len(allowed_users) == 1 and ALLOWED_CHAT in allowed_users:
        await update.message.reply_text(
            "👤 Nur du (Bastian) bist aktuell freigeschaltet.\n"
            "Sag Martin, er soll dem Bot schreiben – "
            "dann krieg ich seine Chat-ID und du kannst ihn freischalten."
        )
        return

    lines = []
    for uid in sorted(allowed_users):
        marker = "👑" if uid == ALLOWED_CHAT else "👤"
        lines.append(f"{marker} `{uid}`")

    await update.message.reply_text(
        f"📋 Whitelist ({len(allowed_users)} User):\n" + "\n".join(lines),
        parse_mode="Markdown"
    )


# ---------------------------------------------------------------------------
# Background-Poll: fertige Jobs erkennen & hochladen
# ---------------------------------------------------------------------------

async def poll_completed(ctx: ContextTypes.DEFAULT_TYPE):
    """Läuft alle POLL_INTERVAL Sekunden: checkt History auf fertige Jobs (tracked + untracked)."""
    history = fetch_history()
    if not history:
        return

    # Bereits in diesem Durchlauf hochgeladene/verarbeitete Jobs merken
    uploaded_nzo_ids = set()

    for slot in history:
        nzo_id = slot.get("nzo_id", "")
        if not nzo_id:
            continue
        if slot.get("status") not in ("Completed", "Failed"):
            continue

        # Bereits verarbeitet in diesem Poll-Durchlauf → überspringen
        if nzo_id in uploaded_nzo_ids:
            continue

        # --- Failed Jobs ---
        if slot.get("status") == "Failed":
            # Nur einmal melden – wenn nzo_id schon in notified_failed, überspringen
            if nzo_id in notified_failed:
                continue

            name = slot.get("name", nzo_id)
            log.warning("Job fehlgeschlagen: %s (%s)", name, nzo_id)

            # Chat-ID ermitteln: aus tracked_jobs falls vorhanden, sonst an Bastian
            info = tracked_jobs.get(nzo_id, {})
            chat_id = info.get("chat_id", ALLOWED_CHAT)

            try:
                await ctx.bot.send_message(
                    chat_id=chat_id,
                    text=f"❌ Download fehlgeschlagen:\n{name}",
                )
            except Exception:
                pass

            # Persistently merken: nicht nochmal melden
            notified_failed.add(nzo_id)
            save_failed_notified()

            # Aus tracked_jobs entfernen falls vorhanden (nicht erneut adden!)
            if nzo_id in tracked_jobs:
                del tracked_jobs[nzo_id]
                save_jobs()

            uploaded_nzo_ids.add(nzo_id)
            continue

        # --- Completed Jobs ---
        # Bereits in diesem Poll-Durchlauf oder in früheren Läufen hochgeladen?
        if nzo_id in uploaded_nzo_ids:
            continue

        if nzo_id in notified_completed:
            log.debug("Überspringe bereits hochgeladenen Job: %s", nzo_id)
            continue

        # Bereits als "Pfad nicht gefunden" markierte Jobs überspringen
        if nzo_id in notified_missing:
            uploaded_nzo_ids.add(nzo_id)
            continue

        # Untrackte Completed-Jobs: nur tracken wenn noch nie verarbeitet
        if nzo_id not in tracked_jobs and nzo_id not in notified_completed:
            name = slot.get("name", nzo_id)
            log.info("Neuer untrackter Completed-Job gefunden: %s (%s) – tracke …", name, nzo_id)
            tracked_jobs[nzo_id] = {"name": name, "chat_id": ALLOWED_CHAT}
            save_jobs()

        info = tracked_jobs[nzo_id]
        name = info.get("name", nzo_id)
        log.info("Job fertig: %s (%s) – starte Drive-Upload …", name, nzo_id)

        # Container-Pfad → Host-Pfad
        raw_storage = slot.get("storage", "")
        if not raw_storage:
            log.warning("Kein storage-Pfad für %s", nzo_id)
            notified_missing.add(nzo_id)
            save_missing_notified()
            del tracked_jobs[nzo_id]
            save_jobs()
            continue

        host_path = container_to_host(raw_storage)
        # storage ist ein Pfad zu einer Datei (nicht Ordner)
        base_dir = host_path
        if not os.path.isdir(base_dir):
            # Vielleicht ist storage direkt eine Datei
            base_dir = os.path.dirname(host_path)

        if not os.path.isdir(base_dir):
            log.warning("Host-Pfad existiert nicht: %s", base_dir)
            notified_missing.add(nzo_id)
            save_missing_notified()
            del tracked_jobs[nzo_id]
            save_jobs()
            continue

        # Ziel-Ordner bestimmen: Bastian → usedown, Martin → Martin
        chat_id = info.get("chat_id", ALLOWED_CHAT)
        if chat_id == ALLOWED_CHAT:  # Bastian
            target_folder_id = USEDOWN_FOLDER_ID
            folder_label = "usedown"
        else:  # Martin & andere
            target_folder_id = DRIVE_FOLDER_ID
            folder_label = "Martin"

        # Nur Video-Dateien hochladen (MKV, MP4, AVI, MOV, M4V, WMV)
        VIDEO_EXTS = {".mkv", ".mp4", ".avi", ".mov", ".m4v", ".wmv", ".webm"}
        uploaded_any = False
        for root, _dirs, files in os.walk(base_dir):
            for fname in files:
                ext = os.path.splitext(fname)[1].lower()
                if ext not in VIDEO_EXTS:
                    log.debug("Überspringe Non-Video: %s", fname)
                    continue
                fpath = os.path.join(root, fname)
                if os.path.getsize(fpath) == 0:
                    log.debug("Überspringe leere Datei: %s", fname)
                    continue
                if upload_file_to_drive(fpath, target_folder_id):
                    uploaded_any = True
                else:
                    log.error("Upload fehlgeschlagen: %s", fname)

        if uploaded_any:
            log.info("Upload abgeschlossen für: %s → %s", name, folder_label)
            notified_completed.add(nzo_id)
            save_completed_notified()
            try:
                await ctx.bot.send_message(
                    chat_id=chat_id,
                    text=f"✅ Fertig + Hochgeladen ↳ Google Drive → {folder_label}\n{name}",
                )
            except Exception:
                pass
        else:
            log.warning("Keine Dateien hochgeladen für: %s", name)
            # Auch als erledigt markieren (keine relevanten Dateien vorhanden)
            notified_completed.add(nzo_id)
            save_completed_notified()

        uploaded_nzo_ids.add(nzo_id)
        del tracked_jobs[nzo_id]
        save_jobs()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Bot-Menü (Telegram native) – /filter, /media, /queue, /watch
# ---------------------------------------------------------------------------

async def cmd_filter(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/filter – Sprache & Quelle umschalten, arbeitet auf Cache."""
    chat_id = update.effective_chat.id
    if chat_id not in allowed_users:
        return

    items = ctx.user_data.get("last_results", [])
    if not items:
        await update.message.reply_text("🔍 Erstmal suchen (/start → Suchbegriff), dann filtern.")
        return

    f = ctx.user_data.get("filter", {})
    filtered = _filter_results(items, f)
    total = len(items)

    lines = [
        f"🔍 Filter ({len(filtered)}/{total} Treffer)\n",
        "Sprache:",
    ]

    # Sprach-Buttons
    lang_btns = [
        InlineKeyboardButton("🇩🇪 DE" + (" ✅" if f.get("language") == "de" else ""), callback_data="flt_lang_de"),
        InlineKeyboardButton("🇬🇧 EN" + (" ✅" if f.get("language") == "en" else ""), callback_data="flt_lang_en"),
    ]
    has_lang_filter = f.get("language") is not None
    lang_btns.append(InlineKeyboardButton("🌐 All" + ("" if has_lang_filter else " ✅"), callback_data="flt_lang_all"))

    # Quell-Buttons
    src_btns = [
        InlineKeyboardButton("🌐 Geek" + (" ✅" if f.get("source") == "geek" else ""), callback_data="flt_source_geek"),
        InlineKeyboardButton("🔧 Hydra" + (" ✅" if f.get("source") == "hydra" else ""), callback_data="flt_source_hydra"),
    ]
    has_src_filter = f.get("source") is not None
    src_btns.append(InlineKeyboardButton("🔀 All" + ("" if has_src_filter else " ✅"), callback_data="flt_source_all"))

    keyboard = InlineKeyboardMarkup([lang_btns, src_btns])

    await update.message.reply_text(
        f"🔍 Filter ({len(filtered)}/{total} Treffer)\n\n"
        "Sprache & Quelle wählen – arbeitet auf dem Ergebnis-Cache:",
        reply_markup=keyboard,
    )


async def cmd_media(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/media – Medientyp wechseln (neuer API-Call nötig)."""
    chat_id = update.effective_chat.id
    if chat_id not in allowed_users:
        return

    config = ctx.user_data.get("config", {})
    current = config.get("media_type", "film")

    media_labels = {
        "film": "🎬 Film",
        "serie": "📺 Serie",
        "audio": "🎵 Audio",
        "buch": "📚 Bücher",
        "game": "🎮 Games",
        "all": "📦 Alles",
    }
    current_label = media_labels.get(current, "🎬 Film")

    btns = []
    for key, label in media_labels.items():
        active = key == current
        btn_label = f"✅ {label}" if active else label
        btns.append(InlineKeyboardButton(btn_label, callback_data=f"media_{key}"))

    keyboard = InlineKeyboardMarkup([btns[i:i+3] for i in range(0, len(btns), 3)])

    await update.message.reply_text(
        f"📺 Medientyp wechseln\n\n"
        f"Aktuell: {current_label}\n\n"
        "Nach Auswahl startet eine neue Suche mit deinem letzten Suchbegriff.",
        reply_markup=keyboard,
    )


async def cmd_queue(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/queue – SABnzbd Queue-Status anzeigen."""
    chat_id = update.effective_chat.id
    if chat_id not in allowed_users:
        return

    try:
        r = requests.get(
            f"{SABNZBD_URL}/api",
            params={"mode": "queue", "output": "json", "apikey": SABNZBD_API_KEY},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json().get("queue", {})
        slots = data.get("slots", [])
        if not slots:
            await update.message.reply_text("📭 SABnzbd-Queue ist leer.")
            return

        lines = []
        for s in slots:
            name = s.get("filename", "?")[:60]
            status = s.get("status", "?")
            mb = s.get("mb", "?")
            mb_left = s.get("mbleft", "?")
            pct = s.get("percentage", "?")
            lines.append(f"• {name}\n  [{status}] {mb}MB total, {mb_left}MB left ({pct}%)")

        msg = "📥 **SABnzbd Queue**\n\n" + "\n\n".join(lines)
        await update.message.reply_text(msg, parse_mode="Markdown")
    except Exception as e:
        log.error("Queue-Abruf fehlgeschlagen: %s", e)
        await update.message.reply_text("❌ Konnte SABnzbd-Queue nicht abrufen.")


async def cmd_watch(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/watch – Watchlist (coming soon)."""
    await update.message.reply_text(
        "📋 **Watchlist**\n\n"
        "Kommt demnächst – hier kannst du später deine Merkliste verwalten.\n"
        "📍 Aktuell: Ein Ergebnis in der Detail-Ansicht mit ❤️ Merken speichern.",
        parse_mode="Markdown",
    )


# ---------------------------------------------------------------------------
# Filter Callback (kompakt, für /filter und Ergebnis-Keyboard)
# ---------------------------------------------------------------------------

async def flt_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Filter-Callback: Sprache/Quelle umschalten, Ergebnisliste neu anzeigen."""
    query = update.callback_query
    await query.answer()

    if update.effective_chat.id not in allowed_users:
        return

    parts = query.data.split("_")
    # flt_lang_de → ["flt", "lang", "de"]
    filter_type = parts[1]
    filter_value = parts[2]

    f = ctx.user_data.get("filter", {})

    if filter_value == "all":
        f.pop(filter_type, None)
    else:
        if f.get(filter_type) == filter_value:
            f.pop(filter_type, None)
        else:
            f[filter_type] = filter_value

    ctx.user_data["filter"] = f
    ctx.user_data["page"] = 0

    items = ctx.user_data.get("last_results", [])
    filtered = _filter_results(items, f)
    query_text = ctx.user_data.get("last_query", "")

    msg = f"🔍 {len(filtered)}/{len(items)} Treffer für: {query_text}\n\n"
    msg += build_result_list(filtered, 0, ctx.user_data.get("page_size", 10))

    await query.edit_message_text(
        msg,
        reply_markup=_build_full_keyboard(ctx, len(filtered))
    )


# ---------------------------------------------------------------------------
# Media-Callback (für /media)
# ---------------------------------------------------------------------------

async def media_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Media-Type wurde im /media-Menü gewählt → neuen API-Call ausführen."""
    query = update.callback_query
    await query.answer()

    if update.effective_chat.id not in allowed_users:
        return

    media_type = query.data.split("_", 1)[1]  # media_film → "film"

    cfg = ctx.user_data.get("config", {})
    if cfg.get("media_type") == media_type:
        await query.edit_message_text(f"✅ Medientyp bleibt: {media_type}. Nix geändert.")
        return

    cfg["media_type"] = media_type
    ctx.user_data["config"] = cfg

    # Prüfen ob wir einen letzten Suchbegriff haben
    last_query = ctx.user_data.get("last_query", "")
    if not last_query:
        await query.edit_message_text(
            f"✅ Medientyp gewechselt zu: {media_type}\n"
            "Jetzt einfach einen Suchbegriff eingeben!"
        )
        return

    # Neue Suche mit neuem cat-Parameter
    cat = _config_to_cat(media_type)
    await query.edit_message_text(f"🔄 Suche neu mit '{media_type}' für: {last_query} …")

    items = search_all(last_query, cat)
    if not items:
        await query.message.reply_text("❌ Nix gefunden mit neuem Medientyp.")
        return

    ctx.user_data["last_results"] = items
    ctx.user_data["filter"] = {
        "language": cfg.get("language"),
        "source": cfg.get("source"),
    }
    ctx.user_data["page"] = 0

    filtered = _filter_results(items, ctx.user_data["filter"])

    msg = f"🔍 {len(filtered)}/{len(items)} Treffer für: {last_query}\n\n"
    msg += build_result_list(filtered, 0, 10)

    await query.message.reply_text(
        msg,
        reply_markup=_build_full_keyboard(ctx, len(filtered))
    )


async def catch_all(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Fängt alle unverarbeiteten Nachrichten (muss als letzter Handler!)."""
    chat_id = update.effective_chat.id
    user = update.effective_user
    name = user.full_name if user else "unbekannt"
    username = f"@{user.username}" if user and user.username else ""
    text = update.message.text if update.message else "?"
    log.info("📩 UNHANDLED: %s %s (Chat-ID: %d): %s", name, username, chat_id, text[:100])


async def _post_init(app):
    """Setup nach App-Initialisierung: Bot-Menü setzen."""
    await app.bot.set_my_commands([
        BotCommand("start", "Neue Suche konfigurieren"),
        BotCommand("filter", "Sprache & Quelle filtern"),
        BotCommand("media", "Medientyp wechseln"),
        BotCommand("queue", "Downloads anzeigen"),
        BotCommand("watch", "Watchlist verwalten"),
        BotCommand("allow", "[Admin] User freischalten"),
        BotCommand("block", "[Admin] User blocken"),
        BotCommand("users", "[Admin] User-Liste"),
    ])


def main():
    load_jobs()
    load_failed_notified()
    load_missing_notified()
    load_completed_notified()
    log.info("entertainbernd_bot startet … (%d tracked, %d failed-notified, %d missing-notified, %d completed-notified geladen)",
             len(tracked_jobs), len(notified_failed), len(notified_missing), len(notified_completed))

    app = Application.builder().token(BOT_TOKEN).post_init(_post_init).build()

    # Handler
    # Admin-Commands (nur Bastian)
    app.add_handler(CommandHandler("allow", cmd_allow))
    app.add_handler(CommandHandler("block", cmd_block))
    app.add_handler(CommandHandler("users", cmd_users))

    # User-Commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("filter", cmd_filter))
    app.add_handler(CommandHandler("media", cmd_media))
    app.add_handler(CommandHandler("queue", cmd_queue))
    app.add_handler(CommandHandler("watch", cmd_watch))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_search))

    # Config-Callback
    app.add_handler(CallbackQueryHandler(config_callback, pattern=r"^config_"))

    # Slash-Command Callbacks (für /media, /filter)
    app.add_handler(CallbackQueryHandler(media_callback, pattern=r"^media_"))
    app.add_handler(CallbackQueryHandler(flt_apply_callback, pattern=r"^flt_apply$"))
    app.add_handler(CallbackQueryHandler(flt_callback, pattern=r"^flt_"))

    # Ergebnis-Callbacks (neue UX)
    app.add_handler(CallbackQueryHandler(detail_callback, pattern=r"^detail_"))
    app.add_handler(CallbackQueryHandler(button_callback, pattern=r"^dl_"))
    app.add_handler(CallbackQueryHandler(page_callback, pattern=r"^page_"))
    app.add_handler(CallbackQueryHandler(open_filter_callback, pattern=r"^open_filter$"))
    app.add_handler(CallbackQueryHandler(back_to_results, pattern=r"^back_to_results$"))

    # Globaler Alles-Logger – fängt alle unverarbeiteten Nachrichten (muss als letzter Handler!)
    app.add_handler(MessageHandler(filters.ALL, catch_all), group=-1)

    # Background-Polling für fertige Downloads
    app.job_queue.run_repeating(poll_completed, interval=POLL_INTERVAL, first=10)

    log.info("Bot läuft (Polling)")
    app.run_polling(drop_pending_updates=False)


if __name__ == "__main__":
    main()