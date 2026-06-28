#!/usr/bin/env python3
"""Renew Google Drive push notification watch (expires every 24h)."""

import json
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).parent
WATCH_FILE = BASE_DIR / ".drive-watch.json"
OAUTH_FILE = Path("/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json")
MCP_URL = "https://connect.composio.dev/mcp"

# Reuse MCP client from addbook_sync
sys.path.insert(0, str(BASE_DIR))
from addbook_sync import MCPClient, _extract_from_results

def main():
    mcp = MCPClient(MCP_URL, str(OAUTH_FILE))

    # Load existing watch info
    watch_data = {}
    if WATCH_FILE.exists():
        try:
            watch_data = json.loads(WATCH_FILE.read_text())
        except:
            pass

    # Stop old watch if exists
    old_channel = watch_data.get("channelId")
    old_resource = watch_data.get("resourceId")
    if old_channel and old_resource:
        try:
            mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
                "tools": [{
                    "tool_slug": "GOOGLEDRIVE_STOP_WATCH_CHANNEL",
                    "arguments": {
                        "id": old_channel,
                        "resourceId": old_resource
                    }
                }],
                "memory": {}
            })
            print(f"Stopped old watch: {old_channel}", file=sys.stderr)
        except Exception as e:
            print(f"Could not stop old watch: {e}", file=sys.stderr)

    # Get fresh page token
    token_result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{
            "tool_slug": "GOOGLEDRIVE_GET_CHANGES_START_PAGE_TOKEN",
            "arguments": {"supportsAllDrives": True}
        }],
        "memory": {}
    })
    page_token = _extract_from_results(token_result, ["startPageToken"])
    if not page_token:
        print(json.dumps({"error": "Could not get start page token"}))
        sys.exit(1)

    # Create new watch
    channel_id = f"addbook-drive-watch-{int(time.time())}"
    expiration = int((time.time() + 82800) * 1000)  # ~23h from now

    watch_result = mcp.call_tool("COMPOSIO_MULTI_EXECUTE_TOOL", {
        "tools": [{
            "tool_slug": "GOOGLEDRIVE_WATCH_CHANGES",
            "arguments": {
                "id": channel_id,
                "type": "web_hook",
                "address": "https://addbook.steppa.online/api/drive-webhook",
                "page_token": page_token,
                "supports_all_drives": True,
                "expiration": expiration
            }
        }],
        "memory": {}
    })

    data = _extract_from_results(watch_result)
    resource_id = data.get("resourceId", "") if isinstance(data, dict) else ""

    if not resource_id:
        print(json.dumps({"error": "Watch creation failed", "data": str(data)}))
        sys.exit(1)

    # Save watch info
    new_watch = {
        "channelId": channel_id,
        "resourceId": resource_id,
        "pageToken": page_token,
        "expiration": expiration,
        "webhookUrl": "https://addbook.steppa.online/api/drive-webhook",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S%z")
    }
    WATCH_FILE.write_text(json.dumps(new_watch, indent=2))
    print(json.dumps({"status": "ok", "channelId": channel_id, "expires": expiration}))

if __name__ == "__main__":
    main()
