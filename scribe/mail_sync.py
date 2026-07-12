#!/usr/bin/env python3
"""
mail_sync.py – Verarbeitet w-mail*-Dateien aus Google Drive Ordner „Kindle Scribe":
1. Erkennt neue w-mail* Dateien (case-insensitive)
2. Lädt Inhalt herunter (Bullet Points / Stichpunkte)
3. Generiert professionelle E-Mail via OpenClaw Agent (DeepSeek)
4. Versendet per AgentMail an bastian.lewin@polizeiakademie.de
5. Löscht Originaldatei aus Drive nach erfolgreichem Versand

Läuft alle 10 Min via Cron.
"""

import os
import sys
import json
import logging
import time
import re
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional

# ============================================================
# Config
# ============================================================
BASE_DIR = Path(__file__).parent
STATE_FILE = BASE_DIR / ".mail_state.json"
LOG_FILE = BASE_DIR / "logs" / "mail.log"
OAUTH_FILE = Path("/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json")
MCP_URL = "https://connect.composio.dev/mcp"

DRIVE_FOLDER_NAME = "Kindle Scribe"
FILE_PREFIX = "w-mail"
RECIPIENT = "bastian.lewin@polizeiakademie.de"

MAX_RETRIES = 3
BACKOFF_BASE = 2

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
log = logging.getLogger("mail")

# ============================================================
# API Keys
# ============================================================
def _load_openclaw_key(path_parts: list) -> str:
    try:
        c = json.loads(Path("/root/.openclaw/openclaw.json").read_text())
        obj = c
        for p in path_parts:
            obj = obj.get(p, {})
        return obj if isinstance(obj, str) else ""
    except:
        return ""

AGENTMAIL_API_KEY = _load_openclaw_key(["skills", "entries", "agentmail", "env", "AGENTMAIL_API_KEY"])

# ============================================================
# MCP Client
# ============================================================
class MCPClient:
    def __init__(self, url: str, oauth_path: str):
        import requests
        self.url = url
        self.session = requests.Session()
        self._req_id = 0
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

    def _parse_sse(self, text: str) -> Optional[dict]:
        result = None
        for line in text.split("\n"):
            if line.startswith("data:"):
                try:
                    data = json.loads(line[5:].strip())
                    if "result" in data:
                        result = data
                    elif "error" in data:
                        log.error("MCP error: %s", data["error"])
                        return data
                except json.JSONDecodeError:
                    continue
        return result

    def _initialize(self):
        r = self.session.post(self.url, json={
            "jsonrpc": "2.0", "id": self._next_id(), "method": "initialize",
            "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                       "clientInfo": {"name": "mail-sync", "version": "1.0"}}
        }, timeout=30)
        r.raise_for_status()
        sid = r.headers.get("mcp-session-id")
        if sid:
            self.session.headers["mcp-session-id"] = sid
        self.session.post(self.url, json={"jsonrpc": "2.0", "method": "notifications/initialized"}, timeout=10)
        log.info("MCP initialized (id=%s)", sid)

    def call_tool(self, name: str, arguments: dict) -> dict:
        r = self.session.post(self.url, json={
            "jsonrpc": "2.0", "id": self._next_id(),
            "method": "tools/call", "params": {"name": name, "arguments": arguments}
        }, timeout=60)
        r.raise_for_status()
        result = self._parse_sse(r.text)
        if not result:
            return {"error": "No result"}
        if "error" in result:
            return result
        contents = result.get("result", {}).get("content", [])
        combined = "\n".join(c.get("text", "") for c in contents if c.get("type") == "text")
        try:
            return json.loads(combined)
        except:
            return {"raw_text": combined}

# ============================================================
# State
# ============================================================
def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {}

def save_state(state: dict):
    try:
        STATE_FILE.write_text(json.dumps(state, indent=2))
        STATE_FILE.chmod(0o600)
    except Exception as e:
        log.error("State save error: %s", e)

# ============================================================
# Drive Operations
# ============================================================
def _extract(result: dict, key_path: list = None) -> Any:
    data = result.get("data", result)
    if not isinstance(data, dict):
        return data
    results = data.get("results", [])
    if results and isinstance(results, list):
        resp = results[0].get("response", results[0])
        resp_data = resp.get("data", resp)
        if key_path:
            obj = resp_data
            for k in key_path:
                obj = obj.get(k) if isinstance(obj, dict) else None
            return obj
        return resp_data
    return data

def find_folder(mcp: MCPClient, name: str) -> Optional[str]:
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{"tool_slug": "GOOGLEDRIVE_FIND_FOLDER", "arguments": {"name_exact": name}}],
        "memory": {}
    })
    files = _extract(result, ["files"])
    if isinstance(files, list):
        for f in files:
            if isinstance(f, dict) and f.get("name", "").lower() == name.lower():
                return f.get("id")
    return None

def list_prefixed_files(mcp: MCPClient, folder_id: str) -> List[Dict[str, str]]:
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{"tool_slug": "GOOGLEDRIVE_FIND_FILE", "arguments": {
            "folder_id": folder_id, "fields": "files(id,name,mimeType,modifiedTime)", "pageSize": 50
        }}], "memory": {}
    })
    out = []
    for f in (_extract(result, ["files"]) or []):
        if isinstance(f, dict) and f.get("mimeType") != "application/vnd.google-apps.folder" and f.get("name", "").lower().startswith(FILE_PREFIX):
            out.append({"id": f["id"], "name": f["name"]})
    return out

def download_file(mcp: MCPClient, file_id: str) -> str:
    import requests as req_lib
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{"tool_slug": "GOOGLEDRIVE_DOWNLOAD_FILE", "arguments": {"fileId": file_id}}],
        "memory": {}
    })
    resp = _extract(result)
    if not resp:
        return ""
    s3url = resp.get("downloaded_file_content", {}).get("s3url", "")
    if s3url:
        try:
            r = req_lib.get(s3url, timeout=30)
            r.raise_for_status()
            log.info("Downloaded %d bytes", len(r.content))
            return r.text
        except Exception as e:
            log.error("S3 fetch failed: %s", e)
            return ""
    content = resp.get("content", resp.get("text", ""))
    return content if isinstance(content, str) and len(content) > 10 else ""

def delete_file(mcp: MCPClient, file_id: str) -> bool:
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{"tool_slug": "GOOGLEDRIVE_DELETE_FILE", "arguments": {"fileId": file_id}}],
        "memory": {}
    })
    data = result.get("data", result)
    if isinstance(data, dict):
        if data.get("success_count", 0) > 0:
            return True
        if data.get("success_count") == 0:
            log.error("Delete failed: %s", data.get("error", "unknown"))
            return False
    return bool(result.get("successful", True))

# ============================================================
# LLM via OpenRouter API (statt openclaw agent)
# ============================================================
def generate_email(bullet_points: str) -> Optional[str]:
    """Generiert eine professionelle E-Mail via openclaw agent CLI."""
    prompt = (
        "Du bist ein professioneller Assistent. Konvertiere die folgenden Bullet Points "
        "in eine gut formatierte, geschäftliche E-Mail auf Deutsch.\n\n"
        "Regeln:\n"
        "- Beginne mit einer passenden Anrede\n"
        "- Formuliere die Stichpunkte zu zusammenhängenden Sätzen aus\n"
        "- Füge eine höfliche Schlussformel hinzu\n"
        "- Gib ZUERST eine Zeile 'Betreff: ...' aus, DANN den E-Mail-Text\n"
        "- Gib NUR den E-Mail-Text zurück, keine Erklärungen\n\n"
        f"Bullet Points:\n{bullet_points}\n\n"
        "Generiere jetzt die E-Mail:"
    )

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = subprocess.run(
                ["openclaw", "agent", "--agent", "main", "-m", prompt, "--json"],
                capture_output=True, text=True, timeout=60
            )
            if result.returncode != 0:
                log.warning("Agent failed (attempt %d): %s", attempt, result.stderr[:200])
                time.sleep(BACKOFF_BASE ** attempt)
                continue

            try:
                data = json.loads(result.stdout)
                reply = ""
                payloads = data.get("result", {}).get("payloads", [])
                if payloads and isinstance(payloads, list):
                    reply = payloads[0].get("text", "")
                if not reply:
                    reply = data.get("finalAssistantVisibleText", "")
                if reply:
                    log.info("LLM response: %d chars", len(reply))
                    return reply.strip()
            except json.JSONDecodeError:
                log.warning("Invalid JSON from agent (attempt %d)", attempt)

        except subprocess.TimeoutExpired:
            log.warning("Agent timed out (attempt %d)", attempt)
        except Exception as e:
            log.error("Agent exception: %s", e)

        if attempt < MAX_RETRIES:
            time.sleep(BACKOFF_BASE ** attempt)

    log.error("All %d agent attempts failed", MAX_RETRIES)
    return None

# ============================================================
# Drive Move (wie in addbook_sync.py)
# ============================================================
def move_file(mcp: MCPClient, file_id: str, new_parent_id: str, current_parents: str = None) -> bool:
    """Move a file to a different folder in Google Drive."""
    parents_to_remove = current_parents
    if not parents_to_remove:
        meta_result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
            "tools": [{
                "tool_slug": "GOOGLEDRIVE_GET_FILE_METADATA",
                "arguments": {"fileId": file_id, "fields": "id,parents"}
            }],
            "memory": {}
        })
        meta_data = _extract(meta_result)
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
        sc = data.get("success_count", -1)
        if sc > 0:
            return True
        if sc == 0:
            log.error("Move failed: %s", data.get("error", "unknown"))
            return False
    if result.get("successful"):
        return True
    log.error("Move failed for %s", file_id)
    return False


# ============================================================
# AgentMail
# ============================================================
def send_email(subject: str, body: str) -> bool:
    try:
        from agentmail import AgentMail
    except ImportError:
        log.error("agentmail SDK not installed")
        return False

    if not AGENTMAIL_API_KEY:
        log.error("No AgentMail API key")
        return False

    try:
        client = AgentMail(api_key=AGENTMAIL_API_KEY)
        inboxes = client.inboxes.list()
        inbox_id = None
        for i in inboxes.inboxes:
            if "scribe" in i.inbox_id.lower() or "mail" in i.inbox_id.lower():
                inbox_id = i.inbox_id
                break
        if not inbox_id and inboxes.inboxes:
            inbox_id = inboxes.inboxes[0].inbox_id
        if not inbox_id:
            log.error("No inbox available")
            return False

        msg = client.inboxes.messages.send(
            inbox_id=inbox_id, to=RECIPIENT, subject=subject, text=body
        )
        log.info("Email sent to %s via %s (msg_id=%s)", RECIPIENT, inbox_id, msg.message_id)
        return True
    except Exception as e:
        log.error("AgentMail error: %s", e)
        return False

# ============================================================
# Main
# ============================================================
def process_mail_files():
    state = load_state()
    mcp = MCPClient(MCP_URL, str(OAUTH_FILE))

    folder_id = find_folder(mcp, DRIVE_FOLDER_NAME)
    if not folder_id:
        log.error("Folder '%s' not found", DRIVE_FOLDER_NAME)
        return
    log.info("Folder found: %s", folder_id)

    # Find/create archive folder (w-mail-archiv inside Kindle Scribe)
    archive_id = find_folder(mcp, "w-mail-archiv")
    if not archive_id:
        result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
            "tools": [{"tool_slug": "GOOGLEDRIVE_CREATE_FOLDER",
                        "arguments": {"name": "w-mail-archiv", "parentId": folder_id}}],
            "memory": {}
        })
        archive_id = _extract(result).get("id") if isinstance(_extract(result), dict) else None
        if archive_id:
            log.info("Created archive folder (ID: %s)", archive_id)
        else:
            log.warning("Could not create w-mail-archiv folder")
    else:
        log.info("Archive folder found (ID: %s)", archive_id)

    files = list_prefixed_files(mcp, folder_id)
    if not files:
        log.info("No new w-mail files found")
        return

    processed = 0
    for f in files:
        fid, fname = f["id"], f["name"]
        if fid in state:
            continue

        log.info("Processing: %s (ID: %s)", fname, fid)

        content = download_file(mcp, fid)
        if not content or len(content.strip()) < 3:
            log.warning("Empty content for %s", fname)
            state[fid] = {"name": fname, "ts": time.time(), "status": "empty"}
            save_state(state)
            continue

        # Extract bullet points
        lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
        bullets = []
        for ln in lines:
            cleaned = re.sub(r'^[-*•]\s+', '', ln)
            cleaned = re.sub(r'^\d+[.)]\s+', '', cleaned)
            if cleaned:
                bullets.append(cleaned)

        if not bullets:
            log.warning("No content in %s", fname)
            state[fid] = {"name": fname, "ts": time.time(), "status": "no_content"}
            save_state(state)
            continue

        bullet_text = "\n".join(f"- {b}" for b in bullets)
        log.info("Extracted %d bullet points", len(bullets))

        # Generate email via OpenClaw agent
        generated = generate_email(bullet_text)
        if not generated:
            log.error("LLM failed for %s", fname)
            state[fid] = {"name": fname, "ts": time.time(), "status": "llm_failed"}
            save_state(state)
            continue

        # Extract subject and body
        subject = "Nachricht vom Kindle Scribe"
        body = generated
        gen_lines = [ln.strip() for ln in generated.splitlines() if ln.strip()]
        if gen_lines:
            first = gen_lines[0].lower()
            if first.startswith("betreff:") or first.startswith("subject:"):
                subject = gen_lines[0].split(":", 1)[1].strip()
                body = "\n".join(gen_lines[1:]).strip()

        # Send email with retry
        sent = False
        for attempt in range(1, MAX_RETRIES + 1):
            if send_email(subject, body):
                sent = True
                break
            time.sleep(BACKOFF_BASE ** attempt)

        if sent:
            log.info("Email sent for %s", fname)
            # Move to archive folder instead of delete
            if archive_id and move_file(mcp, fid, archive_id, current_parents=folder_id):
                log.info("Moved %s to archive", fname)
                state[fid] = {"name": fname, "ts": time.time(), "status": "done_archived"}
            else:
                if delete_file(mcp, fid):
                    log.info("Deleted %s from Drive", fname)
                    state[fid] = {"name": fname, "ts": time.time(), "status": "done_deleted"}
                else:
                    state[fid] = {"name": fname, "ts": time.time(), "status": "done_not_archived"}
            processed += 1
        else:
            log.error("Send failed for %s after %d attempts", fname, MAX_RETRIES)
            state[fid] = {"name": fname, "ts": time.time(), "status": "send_failed"}

        save_state(state)

    log.info("Processed %d files this run", processed)


def main():
    log.info("=== mail_sync start ===")
    try:
        process_mail_files()
    except Exception as e:
        log.exception("Unexpected error: %s", e)
        sys.exit(1)
    finally:
        log.info("=== mail_sync end ===")


if __name__ == "__main__":
    main()
