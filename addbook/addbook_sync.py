#!/usr/bin/env python3
"""
addbook_sync.py – Überwacht Google Drive Ordner "Kindle Scribe" auf neue p-gen*-Dateien.

Trigger:
  "Buch: TITEL"    → Buchsuche via Anna's Archive → Telegram Link
  "Rezept: QUERY Nx" → Rezeptsuche → ≥4.2⭐ Filter → PDF → Send to Kindle

Nutzt Composio MCP (streamable-http) für Google Drive Zugriff.
Läuft alle 10 Min via Cron.
"""

import os
import sys
import json
import logging
import time
import uuid
import base64
import re
import subprocess
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional

# ============================================================
# Config
# ============================================================
BASE_DIR = Path(__file__).parent
STATE_FILE = BASE_DIR / ".addbook_state.json"
RECIPE_STATE_FILE = BASE_DIR / "recipes" / ".recipe_state.json"
RECIPE_PDF_DIR = Path("/srv/addbook/recipe_pdfs")
LOG_FILE = BASE_DIR / "logs" / "addbook.log"
OAUTH_FILE = Path("/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json")
MCP_URL = "https://connect.composio.dev/mcp"

DRIVE_FOLDER_NAME = "Kindle Scribe"
FILE_PREFIX = "p-gen"
RESULTS_DIR = Path("/srv/addbook/results")
TELEGRAM_BOT_TOKEN = ""  # Wird aus openclaw.json gelesen
TELEGRAM_CHAT_ID = "1400987471"

MAX_RETRIES = 3
BACKOFF_BASE = 2  # seconds

# ============================================================
# Logging
# ============================================================
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
log = logging.getLogger("addbook")

# ============================================================
# MCP Client (streamable-http)
# ============================================================
class MCPClient:
    """Minimal MCP client für Composio streamable-http transport."""

    def __init__(self, url: str, oauth_path: str):
        import requests
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

    def _parse_sse(self, response_text: str) -> Optional[dict]:
        result = None
        for line in response_text.split("\n"):
            if line.startswith("data:"):
                try:
                    data = json.loads(line[5:].strip())
                    if "result" in data:
                        result = data
                    elif "error" in data:
                        log.error(f"MCP error: {data['error']}")
                        return data
                except json.JSONDecodeError:
                    continue
        return result

    def _initialize(self):
        req = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "addbook-sync", "version": "1.0"}
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

    def call_tool(self, name: str, arguments: dict) -> dict:
        req = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments}
        }
        r = self.session.post(self.url, json=req, timeout=60)
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

# ============================================================
# Google Drive operations via Composio MCP
# ============================================================
def _extract_from_results(result: dict, key_path: list = None) -> Any:
    data = result.get("data", result)
    if not isinstance(data, dict):
        return data
    results_list = data.get("results", [])
    if results_list and isinstance(results_list, list):
        first = results_list[0]
        resp = first.get("response", first)
        resp_data = resp.get("data", resp)
        if key_path:
            obj = resp_data
            for k in key_path:
                if isinstance(obj, dict):
                    obj = obj.get(k)
                else:
                    return None
            return obj
        return resp_data
    return data

def find_folder(mcp: MCPClient, name: str) -> Optional[str]:
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{
            "tool_slug": "GOOGLEDRIVE_FIND_FOLDER",
            "arguments": {"name_exact": name}
        }],
        "memory": {}
    })
    files = _extract_from_results(result, ["files"])
    if isinstance(files, list):
        for f in files:
            if isinstance(f, dict) and f.get("name", "").lower() == name.lower():
                return f.get("id")
    log.warning("Could not find folder '%s'", name)
    return None

def list_pgen_files(mcp: MCPClient, folder_id: str) -> List[Dict[str, str]]:
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{
            "tool_slug": "GOOGLEDRIVE_FIND_FILE",
            "arguments": {
                "folder_id": folder_id,
                "fields": "files(id,name,mimeType,modifiedTime)",
                "pageSize": 50
            }
        }],
        "memory": {}
    })
    files = []
    all_files = _extract_from_results(result, ["files"])
    if isinstance(all_files, list):
        for f in all_files:
            if not isinstance(f, dict):
                continue
            fname = f.get("name", "")
            mime = f.get("mimeType", "")
            if mime != "application/vnd.google-apps.folder" and fname.lower().startswith(FILE_PREFIX):
                files.append({"id": f["id"], "name": fname})
    log.info("Found %d p-gen files in folder", len(files))
    return files

def download_file(mcp: MCPClient, file_id: str) -> str:
    import requests as req_lib
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{
            "tool_slug": "GOOGLEDRIVE_DOWNLOAD_FILE",
            "arguments": {"fileId": file_id}
        }],
        "memory": {}
    })
    resp_data = _extract_from_results(result)
    if not resp_data:
        log.warning("No response data from download")
        return ""
    dl = resp_data.get("downloaded_file_content", {})
    s3url = dl.get("s3url", "")
    if s3url:
        try:
            r = req_lib.get(s3url, timeout=30)
            r.raise_for_status()
            log.info("Downloaded %d bytes via S3 URL", len(r.content))
            return r.text
        except Exception as e:
            log.error("Failed to fetch S3 URL: %s", e)
            return ""
    content = resp_data.get("content", resp_data.get("text", ""))
    if isinstance(content, str) and len(content) > 10:
        return content
    b64 = resp_data.get("base64_content", "")
    if b64:
        try:
            return base64.b64decode(b64).decode("utf-8")
        except:
            pass
    log.warning("Could not extract file content from download response")
    return ""

def move_file(mcp: MCPClient, file_id: str, new_parent_id: str, current_parents: str = None) -> bool:
    parents_to_remove = current_parents
    if not parents_to_remove:
        meta_result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
            "tools": [{
                "tool_slug": "GOOGLEDRIVE_GET_FILE_METADATA",
                "arguments": {"fileId": file_id, "fields": "id,parents"}
            }],
            "memory": {}
        })
        meta_data = _extract_from_results(meta_result)
        if isinstance(meta_data, dict):
            file_parents = meta_data.get("parents", [])
            if isinstance(file_parents, list) and file_parents:
                parents_to_remove = ",".join(file_parents)
    args = {"file_id": file_id, "add_parents": new_parent_id, "supports_all_drives": False}
    if parents_to_remove:
        args["remove_parents"] = parents_to_remove
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{"tool_slug": "GOOGLEDRIVE_MOVE_FILE", "arguments": args}],
        "memory": {}
    })
    data = result.get("data", result)
    if isinstance(data, dict):
        success_count = data.get("success_count", -1)
        if success_count == 0:
            log.error("Move failed: %s", data.get("error", "unknown"))
            return False
        if success_count > 0:
            return True
    if result.get("successful"):
        return True
    log.error("Move failed for file %s: %s", file_id, json.dumps(result)[:300])
    return False

# ============================================================
# State Management
# ============================================================
def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception as e:
            log.warning("Could not load state: %s", e)
    return {}

def save_state(state: dict):
    try:
        STATE_FILE.write_text(json.dumps(state, indent=2))
        STATE_FILE.chmod(0o600)
    except Exception as e:
        log.error("Could not save state: %s", e)

def load_recipe_state() -> dict:
    """Load recipe dedup state. Maps query -> list of sent recipe URLs."""
    try:
        RECIPE_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        if RECIPE_STATE_FILE.exists():
            return json.loads(RECIPE_STATE_FILE.read_text())
    except Exception as e:
        log.warning("Could not load recipe state: %s", e)
    return {}

def save_recipe_state(state: dict):
    try:
        RECIPE_STATE_FILE.write_text(json.dumps(state, indent=2))
        RECIPE_STATE_FILE.chmod(0o600)
    except Exception as e:
        log.error("Could not save recipe state: %s", e)

# ============================================================
# Content Parsing
# ============================================================
def parse_content_to_title(text: str) -> Optional[str]:
    """
    Parse Kindle Scribe file content to extract book title.
    Expected format:
      Zeile N: "Buch: TITEL" oder nur "Buch:"
      Zeile N+1: TITEL (falls nicht in Zeile N)
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for i, line in enumerate(lines):
        if line.lower().startswith("buch:"):
            title = line[5:].strip()
            if title:
                return title
            if i + 1 < len(lines):
                return lines[i + 1].strip()
            return None
    return None

def parse_content_for_recipe(text: str) -> Optional[tuple]:
    """
    Parse content for 'Rezept:' trigger.
    Supports single-line and multi-line formats:
      "Rezept: Suchbegriff 3x"
      "Rezept:" + next line "Suchbegriff 3"

    Multiplier:
      "Query 3x", "Query x3", "Query 3"  (bare number at end counts)
    Returns (query, count) or None. Default count = 1.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for i, line in enumerate(lines):
        if not line.lower().startswith("rezept:"):
            continue

        rest = line[7:].strip()
        if not rest:
            if i + 1 < len(lines):
                rest = lines[i + 1].strip()
            else:
                continue
        if not rest:
            continue

        count = 1
        query = rest

        # "Query 3x"
        m = re.search(r'(\d+)x\s*$', rest)
        if m:
            count = int(m.group(1))
            query = rest[:m.start()].strip()
        # "Query x3"
        elif (m := re.search(r'x(\d+)\s*$', rest)):
            count = int(m.group(1))
            query = rest[:m.start()].strip()
        # Bare "Query 3" at end
        elif (m := re.search(r'\s+(\d+)$', rest)):
            count = int(m.group(1))
            query = rest[:m.start()].strip()

        if query:
            # Strip trailing special characters (checkmarks, bullets)
            query = re.sub(r'[\s\u2713\u2714\u2716-\u271A\u271D\u274C\u2705\u2605\u2606]+$', '', query).strip()
            if query:
                return (query, max(count, 1))
    return None

# ============================================================
# Recipe Pipeline
# ============================================================
def run_recipe_search(query: str, count: int, exclude_urls: set) -> list:
    """Run recipe search via recipe_search.py script."""
    exclude_list = list(exclude_urls)
    cmd = [
        "python3",
        str(BASE_DIR / "recipes" / "recipe_search.py"),
        "--query", query,
        "--count", str(count),
    ]
    for url in exclude_list:
        cmd.extend(["--exclude", url])
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            log.error("Recipe search failed: %s", result.stderr[:500])
            return []
        recipes = json.loads(result.stdout)
        if not isinstance(recipes, list):
            return []
        return recipes
    except Exception as e:
        log.error("Recipe search error: %s", e)
        return []

def generate_recipe_pdf(recipes: list, output_path: str) -> Optional[str]:
    """Generate PDF from recipes via recipe_pdf.py."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(recipes, f, ensure_ascii=False)
        tmp_path = f.name
    try:
        RECIPE_PDF_DIR.mkdir(parents=True, exist_ok=True)
        cmd = [
            "python3",
            str(BASE_DIR / "recipes" / "recipe_pdf.py"),
            "--input", tmp_path,
            "--output", output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            log.error("PDF gen failed: %s", result.stderr[:500])
            return None
        return output_path
    except Exception as e:
        log.error("PDF gen error: %s", e)
        return None
    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass

def send_pdf_to_kindle(pdf_path: str, title: str) -> bool:
    """Send PDF to Kindle via send-to-kindle.py."""
    cmd = [
        "python3",
        str(BASE_DIR / "scripts" / "send-to-kindle.py"),
        title,
        pdf_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            log.error("Kindle send failed: %s", result.stderr[:500])
            return False
        resp = json.loads(result.stdout)
        if resp.get("success"):
            log.info("Sent to Kindle: %s (msg_id: %s)", title, resp.get("message_id"))
            return True
        log.error("Kindle send response: %s", resp)
        return False
    except Exception as e:
        log.error("Kindle send error: %s", e)
        return False

# ============================================================
# Telegram Notification
# ============================================================
def _ensure_bot_token() -> bool:
    global TELEGRAM_BOT_TOKEN
    if TELEGRAM_BOT_TOKEN:
        return True
    try:
        with open("/root/.openclaw/openclaw.json") as f:
            config = json.load(f)
        TELEGRAM_BOT_TOKEN = (
            config.get("channels", {}).get("telegram", {}).get("botToken", "")
            or config.get("channels", {}).get("telegram", {}).get("accounts", {}).get("default", {}).get("botToken", "")
        )
        return bool(TELEGRAM_BOT_TOKEN)
    except Exception as e:
        log.error("Could not read Telegram token: %s", e)
        return False

def send_telegram_simple(text: str) -> bool:
    """Send a plain Telegram Markdown message."""
    import requests as req_lib
    if not _ensure_bot_token():
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        r = req_lib.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": False
        }, timeout=10)
        r.raise_for_status()
        return True
    except Exception as e:
        log.error("Telegram send failed: %s", e)
        return False

def send_telegram_book_link(title: str, count: int) -> bool:
    """Send Telegram notification with book results link."""
    if not _ensure_bot_token():
        return False
    import requests as req_lib
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    message = f"📚 {count} Bücher gefunden für '{title}'. [Ergebnisse ansehen](https://addbook.steppa.online/r)"
    try:
        r = req_lib.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "Markdown",
            "disable_web_page_preview": False
        }, timeout=10)
        r.raise_for_status()
        return True
    except Exception as e:
        log.error("Telegram send failed: %s", e)
        return False

# ============================================================
# Book Search
# ============================================================
def run_book_search(title: str) -> Dict[str, Any]:
    """Run book search via search.py script."""
    cmd = [
        "python3",
        str(BASE_DIR / "scraper" / "search.py"),
        "--query", title,
        "--lang", "de",
        "--ext", "epub"
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            return {"error": result.stderr}
        return json.loads(result.stdout)
    except Exception as e:
        return {"error": str(e)}

# ============================================================
# Results JSON Generation
# ============================================================
def generate_results_json(title: str, books: List[Dict]) -> str:
    """Save search results as JSON for the results page to render."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_file = RESULTS_DIR / "latest.json"
    data = {
        "id": "latest",
        "query": title,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "books": books
    }
    with open(output_file, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return str(output_file)

# ============================================================
# Recipe Pipeline Main Entry
# ============================================================
def process_recipe_trigger(file_id: str, file_name: str, query: str, count: int) -> bool:
    """
    Handle 'Rezept:' trigger: search → filter ≥4.2⭐ → PDF → send to Kindle.

    Dedup per query: never send the same recipe URL twice.
    Returns True if at least one recipe was successfully sent to Kindle.
    """
    recipe_state = load_recipe_state()
    exclude_urls = set(recipe_state.get(query, []))

    log.info("🍳 Recipe search: '%s' (need %d, %d excluded URLs)", query, count, len(exclude_urls))

    recipes = run_recipe_search(query, count, exclude_urls)
    if not recipes:
        log.warning("No ≥4.2⭐ recipes found for '%s'", query)
        send_telegram_simple(
            f"🍳 *Keine Rezepte gefunden* für '{query}'\n"
            f"Keine Rezepte mit ≥ 4.2⭐ Bewertung gefunden."
        )
        return False

    found_count = len(recipes)
    log.info("Found %d recipes for '%s'", found_count, query)

    # Generate PDF
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    safe_query = "".join(c if c.isalnum() or c in " -_" else "" for c in query)[:50].strip()
    pdf_filename = f"rezept-{safe_query}-{timestamp}.pdf"
    pdf_path = str(RECIPE_PDF_DIR / pdf_filename)

    pdf_result = generate_recipe_pdf(recipes, pdf_path)
    if not pdf_result:
        log.error("PDF generation failed for '%s'", query)
        send_telegram_simple(
            f"🍳 *PDF-Fehler* für '{query}'\n"
            f"{found_count} Rezepte gefunden, aber PDF-Erstellung fehlgeschlagen."
        )
        return False

    # Send to Kindle
    pdf_title = f"🍳 {query} ({found_count}x)"
    sent = send_pdf_to_kindle(pdf_path, pdf_title)

    if sent:
        # Dedup: mark all sent URLs
        new_urls = [r["url"] for r in recipes if r.get("url")]
        recipe_state[query] = list(set(recipe_state.get(query, []) + new_urls))
        save_recipe_state(recipe_state)

        ratings = ", ".join(f"{r.get('title','?')} ({r.get('rating',0)}⭐)" for r in recipes)
        log.info("✅ Recipes sent to Kindle: %s", ratings)
        send_telegram_simple(
            f"🍳 *{found_count} Rezepte gesendet* für '{query}'\n"
            f"{ratings}"
        )
        return True
    else:
        log.error("Failed to send recipe PDF to Kindle for '%s'", query)
        send_telegram_simple(
            f"🍳 *Kindle-Versand fehlgeschlagen* für '{query}'\n"
            f"PDF wurde erstellt, aber Versand fehlgeschlagen.\n"
            f"Datei: {pdf_path}"
        )
        return False

# ============================================================
# Main Workflow
# ============================================================
def process_files():
    """Main processing loop."""
    state = load_state()
    mcp = MCPClient(MCP_URL, str(OAUTH_FILE))

    # Step 1: Find the "Kindle Scribe" folder
    folder_id = find_folder(mcp, DRIVE_FOLDER_NAME)
    if not folder_id:
        log.error("Folder '%s' not found", DRIVE_FOLDER_NAME)
        return
    log.info("Found folder '%s' (ID: %s)", DRIVE_FOLDER_NAME, folder_id)

    # Step 2: Find/create "p-gen-archiv" subfolder
    archive_id = find_folder(mcp, "p-gen-archiv")
    if not archive_id:
        result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
            "tools": [{
                "tool_slug": "GOOGLEDRIVE_CREATE_FOLDER",
                "arguments": {"name": "p-gen-archiv", "parentId": folder_id}
            }],
            "memory": {}
        })
        archive_id = _extract_from_results(result, ["id"])
        if not archive_id:
            log.error("Could not create archive folder")
            return
        log.info("Created archive folder (ID: %s)", archive_id)

    # Step 3: List p-gen files
    files = list_pgen_files(mcp, folder_id)
    if not files:
        log.info("No new p-gen files found")
        return

    processed_count = 0

    for f in files:
        fid = f["id"]
        fname = f["name"]

        if fid in state:
            log.debug("Skipping already processed: %s", fname)
            continue

        log.info("Processing: %s (ID: %s)", fname, fid)

        # Step 4: Download content
        content = download_file(mcp, fid)
        if not content or len(content.strip()) < 5:
            log.warning("Empty content for %s", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "empty"}
            save_state(state)
            continue

        log.info("Downloaded %d chars from %s", len(content), fname)

        # Step 5: Check for recipe trigger (independent of book trigger)
        recipe_info = parse_content_for_recipe(content)
        recipe_processed = False
        if recipe_info:
            rquery, rcount = recipe_info
            log.info("🍳 Recipe trigger: query='%s', count=%d", rquery, rcount)
            recipe_processed = process_recipe_trigger(fid, fname, rquery, rcount)

            if recipe_processed and not parse_content_to_title(content):
                # Recipe-only file → archive and done
                if move_file(mcp, fid, archive_id, current_parents=folder_id):
                    log.info("Moved %s to archive (recipe)", fname)
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "recipe_done"}
                save_state(state)
                processed_count += 1
                continue
            elif recipe_processed:
                # File has both recipe AND book trigger
                log.info("Recipe processed, file also has book trigger — continuing")
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "recipe_done_also_book"}

        # Step 6: Parse book title
        title = parse_content_to_title(content)
        if not title:
            if recipe_info:
                continue  # Already handled as recipe-only
            log.warning("No trigger found in %s", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "no_title"}
            save_state(state)
            continue

        log.info("Extracted title: %s", title)

        # Step 7: Run book search
        search_result = run_book_search(title)
        if isinstance(search_result, dict) and "error" in search_result:
            log.error("Book search failed for '%s': %s", title, search_result["error"])
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "search_failed"}
            save_state(state)
            continue

        books = search_result if isinstance(search_result, list) else search_result.get("results", [])
        if not books:
            log.warning("No books found for '%s'", title)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "no_results"}
            save_state(state)
            continue

        log.info("Found %d books for '%s'", len(books), title)

        # Step 8: Generate results JSON
        json_path = generate_results_json(title, books)
        if not json_path:
            log.error("Failed to generate results for '%s'", title)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "html_failed"}
            save_state(state)
            continue

        # Step 9: Send Telegram notification
        sent = False
        for attempt in range(1, MAX_RETRIES + 1):
            if send_telegram_book_link(title, len(books)):
                sent = True
                break
            wait = BACKOFF_BASE ** attempt
            log.warning("Telegram attempt %d failed, waiting %ds...", attempt, wait)
            time.sleep(wait)

        if sent:
            log.info("Telegram sent for %s", fname)
            if move_file(mcp, fid, archive_id, current_parents=folder_id):
                log.info("Moved %s to archive", fname)
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "done_archived"}
            else:
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "done_not_archived"}
            processed_count += 1
        else:
            log.error("Telegram failed for %s after %d attempts", fname, MAX_RETRIES)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "telegram_failed"}

        save_state(state)

    log.info("Processed %d files this run", processed_count)

def main():
    log.info("=== addbook_sync start ===")
    try:
        process_files()
    except Exception as e:
        log.exception("Unexpected error: %s", e)
        sys.exit(1)
    finally:
        log.info("=== addbook_sync end ===")

if __name__ == "__main__":
    main()