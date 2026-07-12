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
import fcntl
from pathlib import Path
from typing import List, Dict, Any, Optional

# ============================================================
# Config
# ============================================================
BASE_DIR = Path(__file__).parent
STATE_FILE = BASE_DIR / ".addbook_state.json"
RECIPE_STATE_FILE = BASE_DIR / "recipes" / ".recipe_state.json"
RECIPE_PDF_DIR = Path("/srv/addbook/recipe_pdfs")
ANSWER_PDF_DIR = Path("/srv/addbook/answer_pdfs")
QA_TEMP_DIR = Path("/tmp/addbook-qa")
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
            # Explicit UTF-8 decode — requests' r.text auto-detects wrong encoding
            return r.content.decode("utf-8")
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

def parse_content_for_question(text: str) -> Optional[str]:
    """
    Parse content for 'Frage:' trigger.
    Returns the question text (may be multi-line) or None.
    Supports:
      "Frage: Was ist der Sinn des Lebens?"
      "Frage:" + next line "Was ist der Sinn..."
    Reads all subsequent lines until file end.
    """
    lines = text.splitlines()
    in_question = False
    question_lines = []

    for i, raw_line in enumerate(lines):
        line = raw_line.strip()

        if in_question:
            # Stop if we hit a new trigger word (case-insensitive start of line)
            if line.lower().startswith(("buch:", "rezept:", "frage:")):
                break
            if line:
                question_lines.append(line)
            continue

        if not line.lower().startswith("frage:"):
            continue

        rest = line[6:].strip()
        if rest:
            question_lines.append(rest)
        in_question = True

    if not question_lines:
        return None

    question = " ".join(question_lines).strip()
    # Strip trailing special characters
    question = re.sub(r'[\s\u2713\u2714\u2716-\u271A\u271D\u274C\u2705\u2605\u2606✔✅]+$', '', question).strip()

    return question if len(question) >= 5 else None


def parse_content_for_list(text: str) -> Optional[dict]:
    """
    Parse content for 'Liste:' trigger.

    Expected format:
      "Liste: Einkaufen"
      - Milch
      - Eier
      Brot
      Käse

    Returns dict with 'title' and 'items' (list of str), or None if no list trigger found.
    Stops scanning at the next trigger line (Buch:/Rezept:/Frage:/Liste:).
    """
    lines = text.splitlines()
    title = None
    items = []
    in_list = False
    title_line = None

    for i, raw_line in enumerate(lines):
        line = raw_line.strip()

        if in_list:
            # Stop at next trigger
            if line.lower().startswith(("buch:", "rezept:", "frage:", "liste:")):
                break
            if not line:
                continue
            # Strip leading bullet markers
            item = re.sub(r'^[-*•]\s*', '', line).strip()
            if item and len(item) >= 1:
                items.append(item)
            continue

        if not line.lower().startswith("liste:"):
            continue

        rest = line[6:].strip()
        if rest:
            title = rest
            title_line = i
            in_list = True
        elif i + 1 < len(lines):
            # Title on next line
            next_line = lines[i + 1].strip()
            if not next_line.lower().startswith(("buch:", "rezept:", "frage:", "liste:")):
                title = next_line
                title_line = i
                in_list = True

        if in_list and not items:
            # Continue to collect items
            continue

    # Also scan next lines after the title line for items
    if title is None:
        return None

    # Clean up title (trailing special chars)
    title = re.sub(r'[\s\u2713\u2714\u2716-\u271A\u271D\u274C\u2705\u2605\u2606✔✅]+$', '', title).strip()

    if not items:
        # Try scanning all subsequent non-trigger lines
        for j in range((title_line or 0) + 1, len(lines)):
            line = lines[j].strip()
            if line.lower().startswith(("buch:", "rezept:", "frage:", "liste:")):
                break
            if not line:
                continue
            item = re.sub(r'^[-*•]\s*', '', line).strip()
            if item and len(item) >= 1:
                items.append(item)

    if not items:
        return None

    return {"title": title, "items": items}


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
# Question Pipeline
# ============================================================
def process_question_trigger(file_id: str, file_name: str, question: str) -> bool:
    """
    Handle 'Frage:' trigger: ask agent → generate PDF → send to Kindle.
    Returns True on success.
    """
    import subprocess as _sp

    # Sanitize for filename
    clean_q = "".join(c for c in question if c.isascii() and (c.isalnum() or c in " _-'")).strip()[:50] or "Frage"

    log.info("❓ Question trigger: '%s' (%d chars)", clean_q, len(question))

    # Step 1: Run temp dir
    QA_TEMP_DIR.mkdir(parents=True, exist_ok=True)
    input_file = QA_TEMP_DIR / f"q_{int(time.time())}.json"
    output_pdf = ANSWER_PDF_DIR / f"antwort-{clean_q}-{time.strftime('%Y%m%d-%H%M%S')}.pdf"
    ANSWER_PDF_DIR.mkdir(parents=True, exist_ok=True)

    # Step 2: Ask the agent
    log.info("🤖 Asking OpenClaw agent...")
    ask_cmd = [
        "python3",
        str(BASE_DIR / "ask" / "ask_agent.py"),
        "--question", question,
        "--output", str(input_file),
        "--timeout", "300",
    ]
    try:
        result = _sp.run(ask_cmd, capture_output=True, text=True, timeout=350)
        if result.returncode != 0:
            log.error("Agent call failed: %s", result.stderr[:500])
            send_telegram_simple(f"❌ *Frage-Fehler*: Agent-Aufruf fehlgeschlagen\n`{question[:80]}`")
            return False
    except Exception as e:
        log.error("Agent call exception: %s", e)
        send_telegram_simple(f"❌ *Frage-Fehler*: {e}\n`{question[:80]}`")
        return False

    # Step 3: Load agent response
    try:
        with open(input_file) as f:
            qa_data = json.load(f)
    except Exception as e:
        log.error("Could not load agent output: %s", e)
        return False

    answer = qa_data.get("answer", "").strip()
    if not answer or len(answer) < 10:
        log.warning("Empty answer from agent")
        send_telegram_simple(f"❌ *Leere Antwort* für Frage\n`{question[:80]}`")
        return False

    # 🔥 CRITICAL: Check for error fallback text – don't send garbage to Kindle!
    if answer.startswith("Fehler:") or answer.startswith("Error:"):
        log.error("Agent returned error: %s", answer[:100])
        send_telegram_simple(f"❌ *Agent-Fehler* für Frage\n`{question[:80]}`\n\n_{answer}_")
        return False

    # 🔥 CRITICAL: Validate answer quality – reject hallucinated garbage
    try:
        import sys as _sys
        _sys.path.insert(0, str(BASE_DIR / "ask"))
        from ask_agent import _is_valid_answer as _check_quality
        if not _check_quality(answer):
            log.error("Agent returned garbage (failed quality check): %s", answer[:100])
            send_telegram_simple(f"❌ *Antwort-Qualitätsproblem* für Frage\n`{question[:80]}`\n\nAntwort war unbrauchbar (halluziniert).")
            return False
    except ImportError:
        log.warning("Could not import ask_agent quality check, skipping")
    except Exception as _qe:
        log.warning("Quality check error (non-fatal): %s", _qe)

    log.info("Got answer: %d chars", len(answer))

    # Step 4: Generate PDF
    pdf_temp = QA_TEMP_DIR / f"pdf_{int(time.time())}.json"
    pdf_data = {"question": question, "answer": answer}
    pdf_temp.write_text(json.dumps(pdf_data, ensure_ascii=False))

    pdf_cmd = [
        "python3",
        str(BASE_DIR / "ask" / "answer_pdf.py"),
        "--input", str(pdf_temp),
        "--output", str(output_pdf),
    ]
    try:
        pdf_result = _sp.run(pdf_cmd, capture_output=True, text=True, timeout=30)
        if pdf_result.returncode != 0:
            log.error("PDF gen failed: %s", pdf_result.stderr[:500])
            send_telegram_simple(f"❌ *PDF-Fehler* für '{clean_q}'")
            return False
    except Exception as e:
        log.error("PDF gen exception: %s", e)
        return False

    if not output_pdf.exists():
        log.error("PDF not generated at %s", output_pdf)
        return False

    log.info("PDF generated: %s (%d bytes)", output_pdf, output_pdf.stat().st_size)

    # Step 5: Send to Kindle
    pdf_title = f"Frage: {clean_q}"
    sent = send_pdf_to_kindle(str(output_pdf), pdf_title)

    if sent:
        log.info("✅ Q&A sent to Kindle: %s", clean_q)
        # Truncate answer for Telegram preview
        answer_preview = answer[:200].replace("\n", " ").strip()
        try:
            send_telegram_simple(
                f"❓ *Frage beantwortet*: '{clean_q}'\n"
                f"📖 Antwort: {answer_preview}...\n\n"
                f"📄 [PDF anzeigen](https://addbook.steppa.online/a/{output_pdf.name})"
            )
        except Exception as e:
            log.warning("Telegram preview failed: %s", e)
        return True
    else:
        log.error("Failed to send Q&A to Kindle")
        return False

# ============================================================
# List Pipeline
# ============================================================
def process_list_trigger(file_id: str, file_name: str, list_data: dict) -> bool:
    """
    Handle 'Liste:' trigger: create a new list via POST to local server.
    Returns True on success.
    """
    import requests
    try:
        r = requests.post(
            "http://localhost:3006/api/lists",
            json={"title": list_data["title"], "items": list_data["items"]},
            timeout=10
        )
        if r.status_code == 201:
            result = r.json()
            list_id = result["id"]
            log.info("✅ List created: %s (ID: %s)", list_data["title"], list_id)
            send_telegram_simple(
                f"📋 *Liste erstellt*: '{list_data['title']}'\n"
                f"{len(list_data['items'])} Einträge\n\n"
                f"[Liste öffnen](https://addbook.steppa.online/l/{list_id})"
            )
            return True
        else:
            log.error("Server returned %d: %s", r.status_code, r.text[:200])
            return False
    except Exception as e:
        log.error("Failed to create list via server: %s", e)
        return False

# ============================================================
# Recipe Pipeline
# ============================================================
def process_recipe_trigger(file_id: str, file_name: str, query: str, count: int) -> bool:
    """
    Handle 'Rezept:' trigger: search → filter → PDF → send to Kindle.
    Returns True on success.
    """
    recipe_state = load_recipe_state()
    exclude_urls = set(recipe_state.get(query, []))

    # Step 1: Search for recipes
    recipes = run_recipe_search(query, count, exclude_urls)
    if not recipes:
        log.warning("No recipes found for '%s'", query)
        send_telegram_simple(f"🍳 *Keine Rezepte* für '{query}' gefunden")
        return False

    log.info("Found %d recipes for '%s'", len(recipes), query)

    # Step 2: Generate PDF
    pdf_name = f"rezept-{query}-{time.strftime('%Y%m%d-%H%M%S')}.pdf"
    pdf_path = RECIPE_PDF_DIR / pdf_name
    pdf_generated = generate_recipe_pdf(recipes, str(pdf_path))
    if not pdf_generated:
        log.error("Failed to generate PDF for '%s'", query)
        return False

    log.info("PDF generated: %s", pdf_path)

    # Step 3: Send to Kindle
    sent = send_pdf_to_kindle(str(pdf_path), f"Rezepte: {query}")
    if not sent:
        log.error("Failed to send recipes to Kindle")
        return False

    # Step 4: Update recipe state (mark URLs as sent)
    new_urls = [r["url"] for r in recipes if "url" in r]
    if query not in recipe_state:
        recipe_state[query] = []
    recipe_state[query].extend(new_urls)
    save_recipe_state(recipe_state)

    # Step 5: Telegram notification
    send_telegram_simple(
        f"🍳 *Rezepte gesendet*: '{query}'\n"
        f"📖 {len(recipes)} Rezepte\n\n"
        f"📄 [PDF anzeigen](https://addbook.steppa.online/r/{pdf_name})"
    )
    return True

# ============================================================
# Main File Processing
# ============================================================
def process_files():
    """Process all unprocessed files in the Kindle Scribe folder."""
    processed_count = 0
    mcp = MCPClient(MCP_URL, OAUTH_FILE)
    folder_id = find_folder(mcp, DRIVE_FOLDER_NAME)
    if not folder_id:
        log.error("Could not find folder '%s'", DRIVE_FOLDER_NAME)
        return

    # Archive folder (create if needed)
    archive_id = find_folder(mcp, "Kindle Scribe Archive")
    if not archive_id:
        result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
            "tools": [{
                "tool_slug": "GOOGLEDRIVE_CREATE_FOLDER",
                "arguments": {"name": "Kindle Scribe Archive", "parents": [folder_id]}
            }],
            "memory": {}
        })
        archive_data = _extract_from_results(result)
        if not isinstance(archive_data, dict) or not archive_data.get("id"):
            log.error("Failed to create archive folder: %s", json.dumps(result)[:200])
            return
        archive_id = archive_data["id"]
        log.info("Created archive folder: %s", archive_id)

    # Load state
    state = load_state()

    # List files
    files = list_pgen_files(mcp, folder_id)
    if not files:
        log.info("No new files to process")
        return

    for f in files:
        fid = f["id"]
        fname = f["name"]

        if fid in state:
            prev = state[fid]
            prev_status = prev.get("status", "")
            prev_time = prev.get("processed_at", 0)
            age = time.time() - prev_time

            # Retry stale processing files after 15 minutes
            if prev_status == "processing" and age > 900:
                log.warning("Stale processing entry for %s (%.0f min old), retrying", fname, age / 60)
            else:
                log.debug("Skipping already processed: %s (status=%s, age=%.0fs)", fname, prev_status, age)
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

        # Step 5: Check for list trigger FIRST (before other triggers)
        list_data = parse_content_for_list(content)
        list_processed = False

        if list_data:
            log.info("📋 List trigger: '%s' (%d items)", list_data['title'], len(list_data['items']))
            list_processed = process_list_trigger(fid, fname, list_data)

        # Step 6: Check for question trigger
        question_text = parse_content_for_question(content)
        question_processed = False

        # Mark as processing NOW to prevent race conditions
        state[fid] = {"name": fname, "processed_at": time.time(), "status": "processing"}
        save_state(state)

        if question_text:
            log.info("❓ Question trigger found: '%s'", question_text[:100])
            question_processed = process_question_trigger(fid, fname, question_text)

        # Check if this is a list-only file (no other triggers)
        if list_processed and not question_text and not parse_content_to_title(content) and not parse_content_for_recipe(content):
            if move_file(mcp, fid, archive_id, current_parents=folder_id):
                log.info("Moved %s to archive (list)", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "list_done"}
            save_state(state)
            processed_count += 1
            continue

        if question_processed and not parse_content_to_title(content) and not parse_content_for_recipe(content) and not list_data:
            # Question-only file → archive and done
            if move_file(mcp, fid, archive_id, current_parents=folder_id):
                log.info("Moved %s to archive (question)", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "question_done"}
            save_state(state)
            processed_count += 1
            continue
        elif question_processed:
            # File has question AND other triggers
            log.info("Question processed, continuing for other triggers")
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "question_done_also_other"}

        # Step 7: Check for recipe trigger (independent of book trigger)
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

        # Step 8: Parse book title
        title = parse_content_to_title(content)
        if not title:
            if recipe_info or question_processed:
                continue  # Already handled as recipe/question-only
            log.warning("No trigger found in %s", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "no_title"}
            save_state(state)
            continue

        log.info("Extracted title: %s", title)

        # Step 8: Run book search
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

        # Step 9: Generate results JSON
        json_path = generate_results_json(title, books)
        if not json_path:
            log.error("Failed to generate results for '%s'", title)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "html_failed"}
            save_state(state)
            continue

        # Step 10: Send Telegram notification
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