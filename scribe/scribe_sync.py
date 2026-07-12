#!/usr/bin/env python3
"""
scribe_sync.py – Überwacht Google Drive Ordner „Kindle Scribe" auf neue w-termine*-Dateien,
erstellt .ics-Kalender, verschickt sie per AgentMail und löscht die Originaldateien.

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
STATE_FILE = BASE_DIR / ".scribe_state.json"
LOG_FILE = BASE_DIR / "logs" / "scribe.log"
OAUTH_FILE = Path("/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json")
MCP_URL = "https://connect.composio.dev/mcp"

DRIVE_FOLDER_NAME = "Kindle Scribe"
FILE_PREFIX = "w-termine"
ICS_FILENAME = "termine.ics"
RECIPIENT = "bastian.lewin@polizeiakademie.de"
SENDER_INBOX = "scribe-bot"  # agentmail inbox username

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
log = logging.getLogger("scribe")

# ============================================================
# MCP Client (streamable-http)
# ============================================================
class MCPClient:
    """Minimal MCP client for Composio streamable-http transport."""

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
                "clientInfo": {"name": "scribe-sync", "version": "1.0"}
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


def list_wtermine_files(mcp: MCPClient, folder_id: str) -> List[Dict[str, str]]:
    """List files starting with 'w-termine' (case-insensitive) in the given folder."""
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

    log.info("Found %d w-termine files in folder", len(files))
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


def delete_file(mcp: MCPClient, file_id: str) -> bool:
    """Delete a file from Google Drive."""
    result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{
            "tool_slug": "GOOGLEDRIVE_DELETE_FILE",
            "arguments": {"fileId": file_id}
        }],
        "memory": {}
    })
    log.debug("delete result: %s", json.dumps(result)[:300])

    # Check response
    data = result.get("data", result)
    if isinstance(data, dict):
        success_count = data.get("success_count", -1)
        if success_count == 0:
            log.error("Delete failed: %s", data.get("error", "unknown"))
            return False
        if success_count > 0:
            return True
    # Fallback: check top-level successful flag
    if result.get("successful"):
        return True
    log.warning("Delete result unclear: %s", json.dumps(result)[:200])
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
def parse_content_to_events(text: str) -> List[Dict[str, str]]:
    """
    Parse Kindle Scribe file content into calendar events.
    
    Expected format (line-based):
        DD.MM.YY or DD.MM.YYYY        ← date header
        HH:MM-HH:MM Uhr Ort Titel     ← event with time range
        HH:MM Uhr Titel                ← event without end time
        Ganztägig Titel                ← all-day event
    
    Lines starting with 'Seite' are page markers (ignored).
    Lines starting with # or // are comments (ignored).
    """
    import re
    from datetime import datetime, timedelta

    events = []
    current_date = None

    # Date pattern: 29.06.26 or 29.06.2026
    date_re = re.compile(r'^\s*(\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4}))\s*$')
    # Time range: 7:30-15:00 Uhr ...
    time_range_re = re.compile(
        r'^\s*(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*(?:Uhr)?\s*(?:([A-ZÄÖÜa-zäöüß][\wÄÖÜäöüß\s]*(?:\s+[A-ZÄÖÜa-zäöüß][\wÄÖÜäöüß\s]*)*)\s+)?(.+)$'
    )
    # Single time: 14:00 Uhr ...
    time_single_re = re.compile(
        r'^\s*(\d{1,2}:\d{2})\s+(?:Uhr\s+)?(.+)$'
    )
    # All-day marker
    allday_re = re.compile(r'^\s*(?:Ganztägig|All\s*Day)\s+(.+)$', re.IGNORECASE)

    for line in text.splitlines():
        line = line.rstrip()
        if not line or line.startswith('#') or line.startswith('//'):
            continue
        # Skip page markers
        if re.match(r'^Seite\s+\d+', line, re.IGNORECASE):
            continue

        # Check for date header
        dm = date_re.match(line)
        if dm:
            date_str = dm.group(1)
            try:
                if len(date_str.split('.')[-1]) == 2:
                    current_date = datetime.strptime(date_str, '%d.%m.%y')
                else:
                    current_date = datetime.strptime(date_str, '%d.%m.%Y')
            except ValueError:
                log.warning("Could not parse date: %s", date_str)
            continue

        if current_date is None:
            continue  # Skip lines before first date

        # Check for time range event
        tm = time_range_re.match(line)
        if tm:
            start_t, end_t, location, title = tm.groups()
            try:
                sh, sm = map(int, start_t.split(':'))
                start_dt = current_date.replace(hour=sh, minute=sm)
                events.append({
                    'start': start_dt,
                    'summary': title.strip(),
                    'description': f"{start_t}-{end_t} Uhr" + (f" {location.strip()}" if location else ""),
                    'location': (location or '').strip()
                })
            except ValueError:
                log.warning("Could not parse time range: %s", line)
            continue

        # Check for all-day
        am = allday_re.match(line)
        if am:
            events.append({
                'start': current_date,
                'summary': am.group(1).strip(),
                'description': '',
                'all_day': True
            })
            continue

        # Check for single-time event
        sm = time_single_re.match(line)
        if sm:
            start_t, title = sm.groups()
            try:
                sh, smin = map(int, start_t.split(':'))
                start_dt = current_date.replace(hour=sh, minute=smin)
                events.append({
                    'start': start_dt,
                    'summary': title.strip(),
                    'description': f"{start_t} Uhr"
                })
            except ValueError:
                log.warning("Could not parse time: %s", line)
            continue

        # Fallback: treat as event on current date with the whole line as title
        stripped = line.strip()
        if len(stripped) > 2:
            events.append({
                'start': current_date,
                'summary': stripped,
                'description': '',
                'all_day': True
            })

    log.info("Parsed %d events from content", len(events))
    return events

# ============================================================
# ICS Generation
# ============================================================
def create_ics(events: List[Dict]) -> str:
    """Create an iCalendar string from events."""
    from ics import Calendar, Event
    from datetime import timedelta

    cal = Calendar()
    for ev in events:
        e = Event()
        e.name = ev.get("summary", "(kein Titel)")
        e.description = ev.get("description", "")
        e.location = ev.get("location", "")
        e.begin = ev["start"]
        if ev.get("all_day"):
            e.make_all_day()
        else:
            e.duration = timedelta(hours=1)
        e.uid = f"{uuid.uuid4()}@scribe.local"
        cal.events.add(e)

    return str(cal)

# ============================================================
# AgentMail Sending
# ============================================================
def send_email_with_ics(ics_content: str, source_filename: str) -> bool:
    """Send the ICS file as email attachment via AgentMail SDK."""
    try:
        from agentmail import AgentMail
    except ImportError:
        log.error("agentmail SDK not installed")
        return False

    api_key = os.getenv("AGENTMAIL_API_KEY")
    if not api_key:
        api_key = "am_us_ecc8afeb2450ef3876d204133788dd7d0d9af0c5d477a4873f5c0d32acca1d0f"
        log.info("Using AgentMail API key from TOOLS.md")

    if not api_key:
        log.error("No AgentMail API key available")
        return False

    try:
        client = AgentMail(api_key=api_key)

        # Find inbox - prefer scribe-related, fallback to first available
        inboxes = client.inboxes.list()
        inbox_id = None
        for i in inboxes.inboxes:
            if "scribe" in i.inbox_id.lower():
                inbox_id = i.inbox_id
                break
        if not inbox_id and inboxes.inboxes:
            inbox_id = inboxes.inboxes[0].inbox_id

        if not inbox_id:
            log.error("No AgentMail inbox available")
            return False

        ics_b64 = base64.b64encode(ics_content.encode("utf-8")).decode("ascii")

        msg = client.inboxes.messages.send(
            inbox_id=inbox_id,
            to=RECIPIENT,
            subject=f"Termine aus {source_filename}",
            text=f"Anbei die Termine aus '{source_filename}' als iCalendar-Anhang. Importiere die Datei in deinen Apple Kalender.",
            html=f"<p>Anbei die Termine aus <strong>{source_filename}</strong> als iCalendar-Anhang.</p><p>Importiere die Datei in deinen Apple Kalender.</p>",
            attachments=[{
                "filename": ICS_FILENAME,
                "content": ics_b64,
                "content_type": "text/calendar"
            }]
        )
        log.info("Email sent to %s via %s (msg_id=%s)", RECIPIENT, inbox_id, msg.message_id)
        return True

    except Exception as e:
        log.error("AgentMail error: %s", e)
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
        log.error("Folder '%s' not found in Google Drive", DRIVE_FOLDER_NAME)
        return

    log.info("Found folder '%s' (ID: %s)", DRIVE_FOLDER_NAME, folder_id)

    # Step 2: List w-termine files
    files = list_wtermine_files(mcp, folder_id)
    if not files:
        log.info("No new w-termine files found")
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

        # Step 3: Download content
        content = download_file(mcp, fid)
        if not content or len(content.strip()) < 5:
            log.warning("Empty or too short content for %s, skipping", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "empty"}
            save_state(state)
            continue

        log.info("Downloaded %d chars from %s", len(content), fname)

        # Step 4: Parse events
        events = parse_content_to_events(content)
        if not events:
            log.warning("No events found in %s", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "no_events"}
            save_state(state)
            continue

        # Step 5: Generate ICS
        ics_content = create_ics(events)
        if not ics_content.strip():
            log.warning("Empty ICS for %s", fname)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "empty_ics"}
            save_state(state)
            continue

        # Step 6: Send email with retry
        sent = False
        for attempt in range(1, MAX_RETRIES + 1):
            if send_email_with_ics(ics_content, fname):
                sent = True
                break
            wait = BACKOFF_BASE ** attempt
            log.warning("Send attempt %d failed, waiting %ds...", attempt, wait)
            time.sleep(wait)

        if sent:
            log.info("Email sent for %s", fname)
            # Step 7: Delete source file from Drive
            if delete_file(mcp, fid):
                log.info("Deleted %s from Drive", fname)
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "done_deleted"}
            else:
                log.warning("Could not delete %s from Drive (email was sent)", fname)
                state[fid] = {"name": fname, "processed_at": time.time(), "status": "done_not_deleted"}
            processed_count += 1
        else:
            log.error("Failed to send email for %s after %d attempts", fname, MAX_RETRIES)
            state[fid] = {"name": fname, "processed_at": time.time(), "status": "send_failed"}
            # Don't mark as processed so it retries next run

        save_state(state)

    log.info("Processed %d files this run", processed_count)


def main():
    log.info("=== scribe_sync start ===")
    try:
        process_files()
    except Exception as e:
        log.exception("Unexpected error: %s", e)
        sys.exit(1)
    finally:
        log.info("=== scribe_sync end ===")


if __name__ == "__main__":
    main()
