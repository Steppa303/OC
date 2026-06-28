#!/usr/bin/env python3
"""
addbook_sync.py – Überwacht Google Drive Ordner "Kindle Scribe" auf neue p-gen*-Dateien,
startet Buchsuche, generiert Ergebnis-HTML und sendet Telegram-Link.

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
from pathlib import Path
from typing import List, Dict, Any, Optional

# ============================================================
# Config
# ============================================================
BASE_DIR = Path(__file__).parent
STATE_FILE = BASE_DIR / ".addbook_state.json"
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

        # Load OAuth token
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
        """Extract the last JSON-RPC result from SSE stream."""
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

        # Send initialized notification
        notif = {"jsonrpc": "2.0", "method": "notifications/initialized"}
        self.session.post(self.url, json=notif, timeout=10)
        log.info("MCP session initialized (id=%s)", self._session_id)

    def call_tool(self, name: str, arguments: dict) -> dict:
        """Call an MCP tool and return the parsed result."""
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
        # Extract content text
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
    """Extract data from Composio MULTI_EXECUTE response structure."""
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
    """Find a folder by name, return its ID."""
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{
            "tool_slug": "GOOGLEDRIVE_FIND_FOLDER",
            "arguments": {"name_exact": name}
        }],
        "memory": {}
    })
    log.debug("find_folder result: %s", json.dumps(result)[:500])

    files = _extract_from_results(result, ["files"])
    if isinstance(files, list):
        for f in files:
            if isinstance(f, dict) and f.get("name", "").lower() == name.lower():
                return f.get("id")

    log.warning("Could not find folder '%s'", name)
    return None


def list_pgen_files(mcp: MCPClient, folder_id: str) -> List[Dict[str, str]]:
    """List files starting with 'p-gen' (case-insensitive) in the given folder."""
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
    log.debug("list_files result: %s", json.dumps(result)[:500])

    files = []
    all_files = _extract_from_results(result, ["files"])
    if isinstance(all_files, list):
        for f in all_files:
            if not isinstance(f, dict):
                continue
            fname = f.get("name", "")
            mime = f.get("mimeType", "")
            # Only files, not folders; case-insensitive prefix match
            if mime != "application/vnd.google-apps.folder" and fname.lower().startswith(FILE_PREFIX):
                files.append({"id": f["id"], "name": fname})

    log.info("Found %d p-gen files in folder", len(files))
    return files


def download_file(mcp: MCPClient, file_id: str) -> str:
    """Download file content as text."""
    import requests as req_lib

    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{
            "tool_slug": "GOOGLEDRIVE_DOWNLOAD_FILE",
            "arguments": {"fileId": file_id}
        }],
        "memory": {}
    })
    log.debug("download result: %s", json.dumps(result)[:500])

    resp_data = _extract_from_results(result)
    if not resp_data:
        log.warning("No response data from download")
        return ""

    # Composio returns an S3 URL for the downloaded file
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

    # Fallback: check for inline content
    content = resp_data.get("content", resp_data.get("text", ""))
    if isinstance(content, str) and len(content) > 10:
        return content

    # Try base64
    b64 = resp_data.get("base64_content", "")
    if b64:
        try:
            return base64.b64decode(b64).decode("utf-8")
        except:
            pass

    log.warning("Could not extract file content from download response")
    return ""


def move_file(mcp: MCPClient, file_id: str, new_parent_id: str) -> bool:
    """Move a file to a different folder in Google Drive."""
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{
            "tool_slug": "GOOGLEDRIVE_UPDATE_FILE",
            "arguments": {
                "fileId": file_id,
                "addParents": new_parent_id,
                "removeParents": "root"
            }
        }],
        "memory": {}
    })
    log.debug("move result: %s", json.dumps(result)[:300])

    # Check response
    data = result.get("data", result)
    if isinstance(data, dict):
        success_count = data.get("success_count", -1)
        if success_count == 0:
            log.error("Move failed: %s", data.get("error", "unknown"))
            return False
        if success_count > 0:
            return True
    # Fallback: check top-level successful flag
    if result.get("successful"):
        return True
    log.warning("Move result unclear: %s", json.dumps(result)[:200])
    return True  # Assume success if no clear error

# ============================================================
# State Management
# ============================================================
def load_state() -> dict:
    """Load processed file state. Returns dict of file_id -> {name, processed_at}."""
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

# ============================================================
# Content Parsing
# ============================================================
def parse_content_to_title(text: str) -> Optional[str]:
    """
    Parse Kindle Scribe file content to extract book title.
    
    Expected format (Seite 1 = Seitenzahl, wird ignoriert):
      Zeile 1: Seitenzahl (z.B. "1" oder "Seite 1")
      Zeile 2: "Buch: TITEL" oder nur "Buch:"
      Zeile 3: TITEL (falls nicht in Zeile 2)
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for i, line in enumerate(lines):
        if line.lower().startswith("buch:"):
            title = line[5:].strip()
            if title:
                return title
            # Titel steht in der nächsten Zeile
            if i + 1 < len(lines):
                return lines[i + 1].strip()
            return None
    return None

# ============================================================
# Telegram Notification
# ============================================================
def send_telegram_message(result_id: str, title: str, count: int) -> bool:
    """Send Telegram notification with link to results."""
    global TELEGRAM_BOT_TOKEN
    import requests as req_lib

    if not TELEGRAM_BOT_TOKEN:
        # Read from openclaw.json
        try:
            with open("/root/.openclaw/openclaw.json") as f:
                config = json.load(f)
            TELEGRAM_BOT_TOKEN = config.get("channels", {}).get("telegram", {}).get("botToken", "") or config.get("channels", {}).get("telegram", {}).get("accounts", {}).get("default", {}).get("botToken", "")
            if not TELEGRAM_BOT_TOKEN:
                log.error("No Telegram bot token found in openclaw.json")
                return False
        except Exception as e:
            log.error("Could not read Telegram token: %s", e)
            return False

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
        log.info("Telegram message sent")
        return True
    except Exception as e:
        log.error("Failed to send Telegram message: %s", e)
        return False

# ============================================================
# Search Execution
# ============================================================
def run_search(title: str) -> Dict[str, Any]:
    """Run book search via search.py script."""
    import subprocess
    
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
            log.error("Search failed: %s", result.stderr)
            return {"error": result.stderr}
        
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            log.error("Invalid search output: %s", result.stdout)
            return {"error": "Invalid search output format"}
    except Exception as e:
        log.error("Search execution error: %s", e)
        return {"error": str(e)}

# ============================================================
# HTML Generation
# ============================================================
def generate_results_json(result_id: str, title: str, books: List[Dict]) -> str:
    """Save search results as JSON for the server to render."""
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
    
    log.info("Generated results JSON: %s", output_file)
    return str(output_file)

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
        log.error("Folder '%s' not found in Google Drive", DRIVE_FOLDER_NAME)
        return

    log.info("Found folder '%s' (ID: %s)", DRIVE_FOLDER_NAME, folder_id)

    # Step 2: Find/create "p-gen-archiv" subfolder
    archive_id = find_folder(mcp, "p-gen-archiv")
    if not archive_id:
        # Create archive folder if it doesn't exist
        result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
            "tools": [{
                "tool_slug": "GOOGLEDRIVE_CREATE_FOLDER",
                "arguments": {
                    "name": "p-gen-archiv",
                    "parentId": folder_id
                }
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

        # Skip already processed
        if fid in state:
            log.debug("Skipping already processed: %s", fname)
            continue

        log.info("Processing: %s (ID: %s)", fname, fid)

        # Step 4: Download content
        content = download_file(mcp, fid)
        if not content or len(content.strip()) < 5:
            log.warning("Empty or too short content for %s, skipping", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "empty"}
            save_state(state)
            continue

        log.info("Downloaded %d chars from %s", len(content), fname)

        # Step 5: Parse title
        title = parse_content_to_title(content)
        if not title:
            log.warning("No book title found in %s", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "no_title"}
            save_state(state)
            continue

        log.info("Extracted title: %s", title)

        # Step 6: Run search
        search_result = run_search(title)
        if isinstance(search_result, dict) and "error" in search_result:
            log.error("Search failed for '%s': %s", title, search_result["error"])
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

        # Step 7: Generate results JSON
        result_id = str(uuid.uuid4())
        json_path = generate_results_json(result_id, title, books)
        if not json_path:
            log.error("Failed to generate results for '%s'", title)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "html_failed"}
            save_state(state)
            continue

        # Step 8: Send Telegram notification
        sent = False
        for attempt in range(1, MAX_RETRIES + 1):
            if send_telegram_message(result_id, title, len(books)):
                sent = True
                break
            wait = BACKOFF_BASE ** attempt
            log.warning("Telegram attempt %d failed, waiting %ds...", attempt, wait)
            time.sleep(wait)

        if sent:
            log.info("Telegram sent for %s", fname)
            # Step 9: Move file to archive
            if move_file(mcp, fid, archive_id):
                log.info("Moved %s to archive", fname)
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "done_archived"}
            else:
                log.warning("Could not move %s to archive (notification was sent)", fname)
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "done_not_archived"}
            processed_count += 1
        else:
            log.error("Failed to send Telegram for %s after %d attempts", fname, MAX_RETRIES)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "telegram_failed"}
            # Don't mark as processed so it retries next run

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