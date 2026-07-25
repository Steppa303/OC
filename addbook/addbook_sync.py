#!/usr/bin/env python3
"""
addbook_sync.py – Überwacht Google Drive Ordner "Kindle Scribe" auf neue p-gen*-Dateien.

PHASE 1 (Webhook/Cron):
  - Datei erkennen, runterladen, Trigger parsen, als Job-JSON ablegen, archivieren
  - Rückkehr in < 5 Sekunden

PHASE 2 (Worker-Cron, alle 30s):
  - Stehende Jobs abarbeiten (Agent fragen, Rezepte suchen, Ergebnisse speichern)
  - Telegram-Benachrichtigung

Trigger:
  "Buch: TITEL"    → Buchsuche via Anna's Archive → Telegram Link
  "Frage: TEXT"    → Agent-Frage → Webseite /a/<id>
  "Rezept: QUERY Nx" → Rezeptsuche → Webseite /rezepte/<id>
  "Liste: TITEL"   → Checkliste → Webseite /l/<id>
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
JOBS_DIR = Path("/srv/addbook/jobs")
RECIPE_RESULTS_DIR = Path("/srv/addbook/recipes")
ANSWER_DIR = Path("/srv/addbook/answers")
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
    except Exception as e:
        log.error("Could not save recipe state: %s", e)

# ============================================================
# Content Parsing
# ============================================================
def parse_content_to_title(text: str) -> Optional[str]:
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
    lines = text.splitlines()
    in_question = False
    question_lines = []

    for i, raw_line in enumerate(lines):
        line = raw_line.strip()
        if in_question:
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
    question = re.sub(r'[\s\u2713\u2714\u2716-\u271A\u271D\u274C\u2705\u2605\u2606✔✅]+$', '', question).strip()
    return question if len(question) >= 5 else None

def parse_content_for_recipe(text: str) -> Optional[tuple]:
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
        m = re.search(r'(\d+)x\s*$', rest)
        if m:
            count = int(m.group(1))
            query = rest[:m.start()].strip()
        elif (m := re.search(r'x(\d+)\s*$', rest)):
            count = int(m.group(1))
            query = rest[:m.start()].strip()
        elif (m := re.search(r'\s+(\d+)$', rest)):
            count = int(m.group(1))
            query = rest[:m.start()].strip()
        if query:
            query = re.sub(r'[\s\u2713\u2714\u2716-\u271A\u271D\u274C\u2705\u2605\u2606]+$', '', query).strip()
            if query:
                return (query, max(count, 1))
    return None

def parse_content_for_list(text: str) -> Optional[dict]:
    lines = text.splitlines()
    title = None
    items = []
    in_list = False
    title_line = None

    for i, raw_line in enumerate(lines):
        line = raw_line.strip()
        if in_list:
            if line.lower().startswith(("buch:", "rezept:", "frage:", "liste:")):
                break
            if not line:
                continue
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
            next_line = lines[i + 1].strip()
            if not next_line.lower().startswith(("buch:", "rezept:", "frage:", "liste:")):
                title = next_line
                title_line = i
                in_list = True
        if in_list and not items:
            continue

    if title is None:
        return None
    title = re.sub(r'[\s\u2713\u2714\u2716-\u271A\u271D\u274C\u2705\u2605\u2606✔✅]+$', '', title).strip()
    if not items:
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

# ============================================================
# Telegram
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

# ============================================================
# PHASE 1: File Discovery & Job Creation (aufgerufen von Webhook/Cron)
# ============================================================
def create_job_from_file(mcp, file_id: str, file_name: str, content: str) -> Optional[str]:
    """
    Parse content, create job JSON, save to JOBS_DIR, return job_id or None on failure.
    PHASE 1 – sollte < 1s dauern.
    """
    jobs = []
    triggers = []

    # Buch-Trigger
    title = parse_content_to_title(content)
    if title:
        triggers.append({"type": "book", "query": title})

    # Frage-Trigger
    question = parse_content_for_question(content)
    if question:
        triggers.append({"type": "question", "query": question})

    # Rezept-Trigger
    recipe_info = parse_content_for_recipe(content)
    if recipe_info:
        triggers.append({"type": "recipe", "query": recipe_info[0], "count": recipe_info[1]})

    # Listen-Trigger
    list_data = parse_content_for_list(content)
    if list_data:
        triggers.append({"type": "list", "title": list_data["title"], "items": list_data["items"]})
        # Liste sofort verarbeiten, kein Job nötig
        import requests
        try:
            r = requests.post(
                "http://localhost:3006/api/lists",
                json={"title": list_data["title"], "items": list_data["items"]},
                timeout=10
            )
            if r.status_code == 201:
                result = r.json()
                send_telegram_simple(
                    f"📋 *Liste erstellt*: '{list_data['title']}'\n"
                    f"{len(list_data['items'])} Einträge\n\n"
                    f"[Liste öffnen](https://addbook.steppa.online/l/{result['id']})"
                )
            else:
                log.error("List creation returned %d: %s", r.status_code, r.text[:200])
        except Exception as e:
            log.error("Failed to create list: %s", e)

    if not triggers:
        log.warning("No trigger found in '%s'", file_name)
        return None

    job_id = str(uuid.uuid4())[:8]
    job = {
        "id": job_id,
        "source": {"file_id": file_id, "file_name": file_name},
        "triggers": triggers,
        "created_at": time.time(),
        "status": "pending"
    }

    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    job_file = JOBS_DIR / f"{job_id}.json"
    with open(job_file, "w") as f:
        json.dump(job, f, ensure_ascii=False, indent=2)

    log.info("📝 Job created: %s (triggers: %s)", job_id, [t["type"] for t in triggers])
    return job_id


# ============================================================
# PHASE 2: Job Processing (aufgerufen von Cron alle 30s)
# ============================================================
def process_pending_jobs():
    """Process all pending jobs. Uses atomic lock dirs to prevent races."""
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    jobs = sorted(JOBS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime)
    processed = 0

    for job_file in jobs:
        job_id = job_file.stem
        lock_dir = JOBS_DIR / f"{job_id}.lock"

        # Atomic lock: mkdir fails if lock exists
        try:
            lock_dir.mkdir(mode=0o700)
        except FileExistsError:
            continue

        try:
            job = json.loads(job_file.read_text())

            if job.get("status") in ("done", "processing"):
                continue

            job["status"] = "processing"
            job["started_at"] = time.time()
            with open(job_file, "w") as f:
                json.dump(job, f, ensure_ascii=False, indent=2)

            log.info("⚙️ Processing job %s (%d triggers)", job_id, len(job.get("triggers", [])))

            for trigger in job.get("triggers", []):
                try:
                    if trigger["type"] == "question":
                        job_result = process_question_job(job_id, trigger["query"])
                        if job_result:
                            send_telegram_simple(
                                f"❓ *Frage beantwortet*: '{trigger['query'][:50]}'\n\n"
                                f"[Antwort lesen](https://addbook.steppa.online/a/{job_result})"
                            )

                    elif trigger["type"] == "recipe":
                        count = trigger.get("count", 1)
                        job_result = process_recipe_job(job_id, trigger["query"], count)
                        if job_result:
                            send_telegram_simple(
                                f"🍳 *{job_result['count']} Rezepte* für '{trigger['query']}' gefunden\n\n"
                                f"[Rezepte ansehen](https://addbook.steppa.online/rezepte/{job_result['id']})"
                            )

                    elif trigger["type"] == "book":
                        job_result = process_book_job(job_id, trigger["query"])
                        if job_result:
                            send_telegram_book_link(trigger["query"], job_result)

                except Exception as e:
                    log.exception("Job %s trigger %s failed: %s", job_id, trigger.get("type"), e)

            # Mark done
            job["status"] = "done"
            job["finished_at"] = time.time()
            with open(job_file, "w") as f:
                json.dump(job, f, ensure_ascii=False, indent=2)

            processed += 1
            log.info("✅ Job %s done", job_id)

        except Exception as e:
            log.exception("Failed to process job %s: %s", job_id, e)
        finally:
            # Cleanup lock
            try:
                lock_dir.rmdir()
            except:
                pass

    return processed


def process_question_job(job_id: str, question: str) -> Optional[str]:
    """Ask agent, save answer, return answer_id or None."""
    clean_q = "".join(c for c in question if c.isascii() and (c.isalnum() or c in " _-'")).strip()[:50] or "Frage"
    log.info("🤖 Asking agent for: '%s' (%d chars)", clean_q, len(question))

    QA_TEMP_DIR = Path("/tmp/addbook-qa")
    QA_TEMP_DIR.mkdir(parents=True, exist_ok=True)
    input_file = QA_TEMP_DIR / f"q_{job_id}.json"

    ask_cmd = [
        "python3",
        str(BASE_DIR / "ask" / "ask_agent.py"),
        "--question", question,
        "--output", str(input_file),
        "--timeout", "300",
    ]

    try:
        result = subprocess.run(ask_cmd, capture_output=True, text=True, timeout=350)
        if result.returncode != 0:
            log.error("Agent call failed: %s", result.stderr[:500])
            send_telegram_simple(f"❌ *Frage-Fehler*: Agent-Aufruf fehlgeschlagen\n`{question[:80]}`")
            return None
    except Exception as e:
        log.error("Agent call exception: %s", e)
        send_telegram_simple(f"❌ *Frage-Fehler*: {e}\n`{question[:80]}`")
        return None

    try:
        with open(input_file) as f:
            qa_data = json.load(f)
    except Exception as e:
        log.error("Could not load agent output: %s", e)
        return None

    answer = qa_data.get("answer", "").strip()
    if not answer or len(answer) < 10:
        log.warning("Empty answer from agent")
        send_telegram_simple(f"❌ *Leere Antwort* für Frage\n`{question[:80]}`")
        return None

    if answer.startswith("Fehler:") or answer.startswith("Error:"):
        log.error("Agent returned error: %s", answer[:100])
        send_telegram_simple(f"❌ *Agent-Fehler* für Frage\n`{question[:80]}`\n\n_{answer}_")
        return None

    # Quality check
    try:
        import sys as _sys
        _sys.path.insert(0, str(BASE_DIR / "ask"))
        from ask_agent import _is_valid_answer as _check_quality
        if not _check_quality(answer):
            log.error("Agent returned garbage: %s", answer[:100])
            send_telegram_simple(f"❌ *Antwort-Qualitätsproblem* für Frage\n`{question[:80]}`")
            return None
    except Exception:
        pass

    log.info("Got answer: %d chars", len(answer))

    answer_id = str(uuid.uuid4())[:8]
    answer_data = {
        "id": answer_id,
        "question": question,
        "answer": answer,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }

    ANSWER_DIR.mkdir(parents=True, exist_ok=True)
    with open(ANSWER_DIR / f"{answer_id}.json", "w") as f:
        json.dump(answer_data, f, ensure_ascii=False, indent=2)
    with open(ANSWER_DIR / "latest.json", "w") as f:
        json.dump(answer_data, f, ensure_ascii=False, indent=2)

    log.info("✅ Answer saved: %s", answer_id)
    return answer_id


def process_recipe_job(job_id: str, query: str, count: int) -> Optional[dict]:
    """Search recipes, save result, return {"id": ..., "count": ...} or None."""
    recipe_state = load_recipe_state()
    exclude_urls = set(recipe_state.get(query, []))

    cmd = [
        "python3",
        str(BASE_DIR / "recipes" / "recipe_search.py"),
        "--query", query,
        "--count", str(count),
    ]
    for url in list(exclude_urls)[:50]:
        cmd.extend(["--exclude", url])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if result.returncode != 0:
            log.error("Recipe search failed: %s", result.stderr[:500])
            return None
        recipes = json.loads(result.stdout)
        if not isinstance(recipes, list) or not recipes:
            log.warning("No recipes found for '%s'", query)
            send_telegram_simple(f"🍳 *Keine Rezepte* für '{query}' gefunden")
            return None
    except Exception as e:
        log.error("Recipe search error: %s", e)
        return None

    result_id = str(uuid.uuid4())[:8]
    recipe_data = {
        "id": result_id,
        "query": query,
        "count": len(recipes),
        "recipes": recipes,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }

    RECIPE_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(RECIPE_RESULTS_DIR / f"{result_id}.json", "w") as f:
        json.dump(recipe_data, f, ensure_ascii=False, indent=2)
    with open(RECIPE_RESULTS_DIR / "latest.json", "w") as f:
        json.dump(recipe_data, f, ensure_ascii=False, indent=2)

    # Dedup
    new_urls = [r["url"] for r in recipes if "url" in r]
    if query not in recipe_state:
        recipe_state[query] = []
    recipe_state[query].extend(new_urls)
    save_recipe_state(recipe_state)

    log.info("✅ Recipe result saved: %s (%d recipes)", result_id, len(recipes))
    return {"id": result_id, "count": len(recipes)}


def process_book_job(job_id: str, title: str) -> Optional[int]:
    """Search books, save result, return count or None."""
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
            log.error("Book search failed for '%s': %s", title, result.stderr[:500])
            return None
        search_result = json.loads(result.stdout)
    except Exception as e:
        log.error("Book search error for '%s': %s", title, e)
        return None

    books = search_result if isinstance(search_result, list) else search_result.get("results", [])
    if not books:
        log.warning("No books found for '%s'", title)
        return None

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        "id": "latest",
        "query": title,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "books": books
    }
    with open(RESULTS_DIR / "latest.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Telegram (hier direkt, es ist ja async)
    sent = False
    for attempt in range(1, MAX_RETRIES + 1):
        if send_telegram_book_link(title, len(books)):
            sent = True
            break
        time.sleep(BACKOFF_BASE ** attempt)

    if not sent:
        log.error("Telegram failed for '%s' nach %d Versuchen", title, MAX_RETRIES)

    log.info("✅ Book results saved for '%s' (%d books)", title, len(books))
    return len(books)


def send_telegram_book_link(title: str, count: int) -> bool:
    import requests as req_lib
    if not _ensure_bot_token():
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
        return True
    except Exception as e:
        log.error("Telegram send failed: %s", e)
        return False


# ============================================================
# PHASE 1: Main Entry Point (Webhook/Cron)
# ============================================================
def phase1_discover():
    """
    Called by webhook or 5-min cron:
    - Scan Drive for new files
    - Download, parse, create job, archive file
    - Return immediately (< 5s)
    """
    log.info("=== Phase 1: Discover start ===")
    processed_count = 0

    try:
        mcp = MCPClient(MCP_URL, OAUTH_FILE)
        folder_id = find_folder(mcp, DRIVE_FOLDER_NAME)
        if not folder_id:
            log.error("Could not find folder '%s'", DRIVE_FOLDER_NAME)
            return

        # Archive folder
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
                log.error("Failed to create archive folder")
                return
            archive_id = archive_data["id"]

        state = load_state()
        files = list_pgen_files(mcp, folder_id)

        for f in files:
            fid = f["id"]
            fname = f["name"]

            if fid in state:
                prev = state[fid]
                prev_status = prev.get("status", "")
                prev_time = prev.get("processed_at", 0)
                age = time.time() - prev_time
                if prev_status == "processing" and age > 900:
                    log.warning("Stale entry %s, retrying", fname)
                else:
                    continue

            log.info("Processing: %s", fname)

            content = download_file(mcp, fid)
            if not content or len(content.strip()) < 5:
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "empty"}
                save_state(state)
                continue

            # Mark processing
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "processing"}
            save_state(state)

            # Create job
            job_id = create_job_from_file(mcp, fid, fname, content)

            if job_id:
                # Archive file
                if move_file(mcp, fid, archive_id):
                    state[fid] = {"name": fname, "processed_at": time.time(), "status": f"job_{job_id}"}
                else:
                    state[fid] = {"name": fname, "processed_at": time.time(), "status": "job_created_not_archived"}
            else:
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "no_trigger"}
                # Archive anyway
                move_file(mcp, fid, archive_id)

            save_state(state)
            processed_count += 1

        log.info("Phase 1: %d files processed", processed_count)
    except Exception as e:
        log.exception("Phase 1 error: %s", e)


# ============================================================
# PHASE 2: Worker (Cron alle 30s)
# ============================================================
def phase2_worker():
    """Process pending jobs. Called by fast cron (every 30s)."""
    log.info("=== Phase 2: Worker start ===")
    try:
        count = process_pending_jobs()
        log.info("Phase 2: %d jobs processed", count)
    except Exception as e:
        log.exception("Phase 2 error: %s", e)


# ============================================================
# CLI Entry Point
# ============================================================
def main():
    mode = "phase1"
    if len(sys.argv) > 1:
        mode = sys.argv[1]

    if mode == "phase2":
        phase2_worker()
    elif mode == "worker":
        phase2_worker()
    else:
        phase1_discover()


if __name__ == "__main__":
    main()