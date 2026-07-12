#!/usr/bin/env python3
"""
scribe_webhook.py – FastAPI Webhook Server für Google Drive Push Notifications.

Empfängt Drive Change-Notifications, validate Channel-Token und
triggert scribe_sync.py im Hintergrund.

Läuft auf Port 3008 hinter Caddy.
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request, Response, Header, HTTPException
import uvicorn

# ============================================================
# Config
# ============================================================
BASE_DIR = Path(__file__).parent
CHANNEL_STATE_FILE = BASE_DIR / ".webhook_channel.json"
SCRIBE_SYNC = BASE_DIR / "scribe_sync.py"
MAIL_SYNC = BASE_DIR / "mail_sync.py"
LOG_FILE = BASE_DIR / "logs" / "webhook.log"

# Max time to wait for scribe_sync.py run (seconds)
SYNC_TIMEOUT = 120

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
log = logging.getLogger("scribe-webhook")

app = FastAPI(title="Scribe Webhook")


# ============================================================
# Channel State
# ============================================================
def load_channel_state() -> dict:
    """Load saved channel info (id, resource_id, token)."""
    if CHANNEL_STATE_FILE.exists():
        try:
            return json.loads(CHANNEL_STATE_FILE.read_text())
        except Exception as e:
            log.warning("Could not load channel state: %s", e)
    return {}


def get_expected_token() -> Optional[str]:
    state = load_channel_state()
    return state.get("token")


# ============================================================
# Webhook Endpoint
# ============================================================
@app.post("/webhook")
async def drive_webhook(
    request: Request,
    x_goog_channel_id: Optional[str] = Header(None),
    x_goog_resource_state: Optional[str] = Header(None),
    x_goog_resource_id: Optional[str] = Header(None),
    x_goog_resource_uri: Optional[str] = Header(None),
    x_goog_channel_token: Optional[str] = Header(None),
    x_goog_channel_expiration: Optional[str] = Header(None),
    x_goog_message_number: Optional[str] = Header(None),
):
    """
    Receive Google Drive push notification.

    Google sends a POST with headers describing the change.
    We validate the channel token, then trigger scribe_sync.py in background.

    MUST return 200 OK within 30 seconds.
    """
    log.info(
        "Webhook received: channel=%s state=%s resource=%s",
        x_goog_channel_id, x_goog_resource_state, x_goog_resource_id
    )

    # Validate channel token
    expected_token = get_expected_token()
    if expected_token and x_goog_channel_token != expected_token:
        log.warning(
            "Invalid channel token: got %s, expected %s",
            x_goog_channel_token, expected_token
        )
        # Still return 200 to avoid Google retry spam
        return Response(status_code=200)

    # Log the notification details
    log.info(
        "Drive notification: state=%s, resourceId=%s, messageNumber=%s, expiration=%s",
        x_goog_resource_state, x_goog_resource_id,
        x_goog_message_number, x_goog_channel_expiration
    )

    # Trigger both sync scripts in background (don't block webhook response)
    asyncio.create_task(run_scribe_sync_async())
    asyncio.create_task(run_mail_sync_async())

    # Google expects quick 200 OK
    return Response(status_code=200)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "scribe-webhook"}


# ============================================================
# Background Processing
# ============================================================
async def _run_script_async(script_path: Path, name: str):
    """Run a Python script in subprocess with timeout."""
    log.info("Triggering %s...", name)
    proc = await asyncio.create_subprocess_exec(
        sys.executable, str(script_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=SYNC_TIMEOUT
        )
        log.info("%s exited with code %d", name, proc.returncode)
        if stdout:
            log.info("%s stdout: %s", name, stdout.decode().strip()[-500:])
        if stderr:
            log.warning("%s stderr: %s", name, stderr.decode().strip()[-500:])
    except asyncio.TimeoutError:
        proc.kill()
        log.error("%s timed out after %ds", name, SYNC_TIMEOUT)
    except Exception as e:
        log.exception("Error running %s: %s", name, e)


async def run_scribe_sync_async():
    await _run_script_async(SCRIBE_SYNC, "scribe_sync.py")


async def run_mail_sync_async():
    await _run_script_async(MAIL_SYNC, "mail_sync.py")


# ============================================================
# Main
# ============================================================
def main():
    port = int(os.environ.get("WEBHOOK_PORT", "3008"))
    log.info("Starting Scribe Webhook on port %d", port)
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
        access_log=False
    )


if __name__ == "__main__":
    main()