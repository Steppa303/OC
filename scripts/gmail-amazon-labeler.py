#!/usr/bin/env python3
"""Gmail Amazon Labeler v7 - Fetch IDs to file, then label in small batches."""

import json
import time
import requests
import sys
import os

MCP_URL = "https://connect.composio.dev/mcp"

with open("/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json") as f:
    TOKEN = json.load(f)["tokens"]["access_token"]

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}

LABEL_ORDERS = "Label_8576888075046521439"
LABEL_PRIME = "Label_3091358819193955614"
ID_FILE = "/root/.local/.openclaw/workspace/scripts/amazon-email-ids.json"

rid = 0


def call_mcp(tool_name, arguments):
    global rid
    rid += 1
    payload = {"jsonrpc": "2.0", "id": rid, "method": "tools/call",
               "params": {"name": tool_name, "arguments": arguments}}
    for attempt in range(3):
        try:
            resp = requests.post(MCP_URL, headers=HEADERS, json=payload, timeout=90)
            for line in resp.text.split("\n"):
                if line.startswith("data: "):
                    d = json.loads(line[6:])
                    if "error" in d:
                        if "rate" in str(d["error"]).lower():
                            time.sleep(10 * (attempt + 1))
                            continue
                        return {"error": d["error"]}
                    return d.get("result", {})
            return {"error": "no data"}
        except Exception as e:
            if attempt < 2:
                time.sleep(5)
            else:
                return {"error": str(e)}


def get_email_data(result):
    for c in result.get("content", []):
        if c.get("type") == "text":
            try:
                p = json.loads(c["text"])
                data = p.get("data", {})
                results = data.get("results", [])
                if results:
                    resp = results[0].get("response", {})
                    rd = resp.get("data", {})
                    if rd and rd.get("messages"):
                        return rd
                    pv = resp.get("data_preview", {})
                    if pv and pv.get("messages"):
                        return pv
            except:
                pass
    return {}


def fetch_ids(query, sid, max_pages=100):
    ids = set()
    token = None
    for page in range(1, max_pages + 1):
        args = {"query": query, "max_results": 15}
        if token:
            args["page_token"] = token
        r = call_mcp("COMPOSIO_MULTI_EXECUTE_TOOL", {
            "tools": [{"tool_slug": "GMAIL_FETCH_EMAILS", "arguments": args}],
            "sync_response_to_workbench": False,
            "session_id": sid,
        })
        rd = get_email_data(r)
        if not rd:
            break
        msgs = rd.get("messages", [])
        if not msgs:
            break
        for m in msgs:
            if isinstance(m, str):
                ids.add(m)
            elif isinstance(m, dict):
                mid = m.get("messageId") or m.get("id")
                if mid:
                    ids.add(mid)
        token = rd.get("nextPageToken")
        if page % 20 == 0:
            print(f"      p{page}: {len(ids)} ids", flush=True)
        if not token:
            break
        time.sleep(0.5)
    return ids


def batch_label_chunks(ids_list, label_id, name, sid, chunk_size=100):
    if not ids_list:
        return 0
    total = 0
    for i in range(0, len(ids_list), chunk_size):
        chunk = ids_list[i:i + chunk_size]
        print(f"  🏷️ {len(chunk)} → {name} (batch {i//chunk_size+1})...", end="", flush=True)
        r = call_mcp("COMPOSIO_MULTI_EXECUTE_TOOL", {
            "tools": [{"tool_slug": "GMAIL_BATCH_MODIFY_MESSAGES",
                       "arguments": {"messageIds": chunk, "addLabelIds": [label_id]}}],
            "sync_response_to_workbench": False,
            "session_id": sid,
        })
        success = False
        for c in r.get("content", []):
            if c.get("type") == "text":
                try:
                    p = json.loads(c["text"])
                    data = p.get("data", {})
                    results = data.get("results", [])
                    if results:
                        resp = results[0].get("response", {})
                        if resp.get("successful"):
                            success = True
                except:
                    pass
        if success:
            total += len(chunk)
            print(" ✅", flush=True)
        else:
            print(f" ❌", flush=True)
        time.sleep(2)
    return total


def main():
    sid = "amazon-labeler-v7"

    # Check if we already have IDs saved
    if os.path.exists(ID_FILE):
        with open(ID_FILE) as f:
            saved = json.load(f)
        order_ids = set(saved.get("order_ids", []))
        prime_ids = set(saved.get("prime_ids", []))
        print(f"📂 Loaded from cache: {len(order_ids)} orders, {len(prime_ids)} prime\n", flush=True)
    else:
        # Step 1: Fetch Amazon Order IDs
        print("📦 Step 1: Amazon Order emails...", flush=True)
        order_queries = [
            "from:amazon.de subject:Bestellung",
            "from:amazon.de subject:Order",
            "from:amazon.de subject:Ihre Amazon",
            "from:amazon.de subject:versandt",
            "from:amazon.de subject:Shipped",
            "from:amazon.de subject:Dispatched",
            "from:amazon.com subject:Order",
            "from:amazon.com subject:Shipped",
        ]
        order_ids = set()
        for q in order_queries:
            ids = fetch_ids(q, sid)
            order_ids.update(ids)
            print(f"  → '{q[:45]}': {len(ids)} | unique: {len(order_ids)}", flush=True)
            time.sleep(1)
        print(f"\n📊 Total Amazon Orders: {len(order_ids)}\n", flush=True)

        # Step 2: Prime Video IDs
        print("🎬 Step 2: Prime Video emails...", flush=True)
        prime_queries = [
            'from:amazon.de subject:"Prime Video"',
            'from:amazon.de subject:"Prime Channel"',
            'from:amazon.de subject:"Amazon Channels"',
            'from:amazon.de subject:"Prime-Kanal"',
        ]
        prime_ids = set()
        for q in prime_queries:
            ids = fetch_ids(q, sid)
            prime_ids.update(ids)
            print(f"  → '{q[:45]}': {len(ids)} | unique: {len(prime_ids)}", flush=True)
            time.sleep(1)
        print(f"\n📊 Total Prime Video: {len(prime_ids)}\n", flush=True)

        # Save IDs
        with open(ID_FILE, "w") as f:
            json.dump({"order_ids": list(order_ids), "prime_ids": list(prime_ids)}, f)
        print(f"💾 Saved IDs to {ID_FILE}\n", flush=True)

    # Dedup
    overlap = order_ids & prime_ids
    if overlap:
        print(f"⚠️ {len(overlap)} overlap → Orders only\n", flush=True)
        prime_ids -= overlap

    # Step 3: Label in small batches
    print("🏷️ Step 3: Applying labels (100/batch)...", flush=True)
    ol = batch_label_chunks(list(order_ids), LABEL_ORDERS, "Orders", sid)
    pl = batch_label_chunks(list(prime_ids), LABEL_PRIME, "PrimeVideo", sid)

    print(f"\n{'=' * 50}")
    print(f"📊 ZUSAMMENFASSUNG")
    print(f"{'=' * 50}")
    print(f"  📦 Amazon Orders:   {ol} gelabelt")
    print(f"  🎬 Prime Video:     {pl} gelabelt")
    print(f"  🔀 Überschneidung:  {len(overlap)}")
    print(f"  📧 Gesamt:          {ol + pl}")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
