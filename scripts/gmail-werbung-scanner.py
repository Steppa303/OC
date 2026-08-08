#!/usr/bin/env python3
"""Werbung Scanner v5 - Direct COMPOSIO_MULTI_EXECUTE_TOOL calls."""

import json
import time
import requests

MCP_URL = "https://connect.composio.dev/mcp"
with open("/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json") as f:
    TOKEN = json.load(f)["tokens"]["access_token"]

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}

LABEL_DELETABLE = "Label_11"
LABEL_CHECK = "Label_10"
sid = "werbung-v5"
rid = 0

def call_composio(tool_slug, arguments, retries=3):
    global rid
    for attempt in range(retries):
        rid += 1
        payload = {
            "jsonrpc": "2.0", "id": rid,
            "method": "tools/call",
            "params": {
                "name": "COMPOSIO_MULTI_EXECUTE_TOOL",
                "arguments": {
                    "tools": [{"tool_slug": tool_slug, "arguments": arguments}],
                    "sync_response_to_workbench": False,
                    "session_id": sid,
                }
            }
        }
        try:
            resp = requests.post(MCP_URL, headers=HEADERS, json=payload, timeout=180)
            text = resp.text
            for line in text.split("\n"):
                if line.startswith("data: "):
                    d = json.loads(line[6:])
                    if "error" in d:
                        if "rate" in str(d["error"]).lower():
                            time.sleep(15 * (attempt + 1))
                            break
                        return None
                    result = d.get("result", {})
                    for c in result.get("content", []):
                        if c.get("type") == "text":
                            p = json.loads(c["text"])
                            data = p.get("data", {})
                            results_list = data.get("results", [])
                            if results_list:
                                resp_data = results_list[0].get("response", {})
                                rd = resp_data.get("data", {})
                                if not rd:
                                    rd = resp_data.get("data_preview", {})
                                if rd:
                                    return rd
                    return None
        except Exception as e:
            print(f"    ⚠️ Error: {e}", flush=True)
            time.sleep(5 * (attempt + 1))
    return None


def fetch_all_ids(query):
    all_ids = []
    token = None
    page = 0
    while True:
        page += 1
        args = {"query": query, "max_results": 15, "ids_only": True}
        if token:
            args["page_token"] = token
        rd = call_composio("GMAIL_FETCH_EMAILS", args)
        if not rd:
            print(f"    p{page}: no data", flush=True)
            break
        msgs = rd.get("messages", [])
        if not msgs:
            break
        for m in msgs:
            if isinstance(m, dict):
                mid = m.get("messageId") or m.get("id")
            else:
                mid = m
            if mid and len(str(mid)) > 5:
                all_ids.append(mid)
        token = rd.get("nextPageToken")
        if page % 20 == 0:
            print(f"    p{page}: {len(all_ids)} ids", flush=True)
        if not token:
            break
        time.sleep(0.15)
    return all_ids


def batch_label(ids, label_id, label_name):
    if not ids:
        return 0
    labeled = 0
    for i in range(0, len(ids), 50):
        chunk = ids[i:i+50]
        rd = call_composio("GMAIL_BATCH_MODIFY_MESSAGES", {
            "messageIds": chunk, "addLabelIds": [label_id]
        })
        labeled += len(chunk)
        if (i + 50) % 500 == 0:
            print(f"    🏷️ {labeled}/{len(ids)}", flush=True)
        time.sleep(0.3)
    return labeled


def main():
    print(f"🔍 Werbung Scanner v5\n", flush=True)

    # IMPORTANT QUERIES (subject-based)
    queries = [
        "category:promotions subject:Rechnung", "category:promotions subject:Invoice",
        "category:promotions subject:Zahlung", "category:promotions subject:Payment",
        "category:promotions subject:Beleg", "category:promotions subject:Bestellung",
        "category:promotions subject:Order", "category:promotions subject:Versand",
        "category:promotions subject:Lieferung", "category:promotions subject:Paket",
        "category:promotions subject:Konto", "category:promotions subject:Account",
        "category:promotions subject:Sicherheit", "category:promotions subject:Security",
        "category:promotions subject:Passwort", "category:promotions subject:Password",
        "category:promotions subject:Vertrag", "category:promotions subject:Abo",
        "category:promotions subject:Subscription", "category:promotions subject:Kündigung",
        "category:promotions subject:Garantie", "category:promotions subject:Warranty",
        "category:promotions subject:Steuer", "category:promotions subject:Tax",
        "category:promotions subject:Bank", "category:promotions subject:Überweisung",
        "category:promotions subject:Mahnung", "category:promotions subject:Fällig",
        "category:promotions subject:Lastschrift", "category:promotions subject:SEPA",
        "category:promotions subject:PayPal", "category:promotions subject:Klarna",
        "category:promotions subject:Bestätigung", "category:promotions subject:Confirmation",
        "category:promotions subject:Datenschutz", "category:promotions subject:DSGVO",
        "category:promotions subject:Receipt", "category:promotions subject:Shipping",
        "category:promotions subject:Delivery", "category:promotions subject:Tracking",
        "category:promotions subject:Billing", "category:promotions subject:Charged",
        "category:promotions subject:Refund", "category:promotions subject:Verify",
        'category:promotions subject:"action required"',
        "category:promotions subject:Alert", "category:promotions subject:Renewal",
        "category:promotions subject:Expiring", "category:promotions subject:Cancel",
        "category:promotions subject:Statement", "category:promotions subject:Balance",
        "category:promotions from:noreply@amazon.de", "category:promotions from:noreply@amazon.com",
        "category:promotions from:service@amazon.de", "category:promotions from:service@paypal.de",
        "category:promotions from:service@paypal.com", "category:promotions from:noreply@paypal",
        "category:promotions from:ebay@ebay.de", "category:promotions from:noreply@ebay",
        "category:promotions from:sparkasse", "category:promotions from:volksbank",
        "category:promotions from:commerzbank", "category:promotions from:postbank",
        "category:promotions from:ing.de", "category:promotions from:n26",
        "category:promotions from:revolut",
    ]

    print("⚠️ Step 1: Wichtige Mails suchen...", flush=True)
    important_ids = set()
    for i, q in enumerate(queries):
        ids = fetch_all_ids(q)
        important_ids.update(ids)
        if ids:
            print(f"  [{i+1}/{len(queries)}] +{len(ids)} → {len(important_ids)} total", flush=True)
        time.sleep(0.1)
    print(f"\n📊 Wichtige Mails: {len(important_ids)}\n", flush=True)

    print("📥 Step 2: Alle Werbe-Mails...", flush=True)
    all_ids = fetch_all_ids("category:promotions")
    unique_all = list(dict.fromkeys(all_ids))  # dedupe preserving order
    print(f"📊 Gesamt: {len(unique_all)}\n", flush=True)

    if not unique_all:
        print("❌ Keine Mails!", flush=True)
        return

    check_set = important_ids & set(unique_all)
    del_set = set(unique_all) - check_set
    check_list = [x for x in unique_all if x in check_set]
    del_list = [x for x in unique_all if x in del_set]

    print(f"🗑️ deletable: {len(del_list)}", flush=True)
    print(f"⚠️ check4delete: {len(check_list)}\n", flush=True)

    print("🏷️ Labeling check4delete...", flush=True)
    cl = batch_label(check_list, LABEL_CHECK, "check4delete")
    print(f"  ✅ {cl}\n", flush=True)

    print("🏷️ Labeling deletable...", flush=True)
    dl = batch_label(del_list, LABEL_DELETABLE, "deletable")
    print(f"  ✅ {dl}\n", flush=True)

    pct = len(check_list) / len(unique_all) * 100 if unique_all else 0
    print(f"{'='*50}")
    print(f"📊 ZUSAMMENFASSUNG")
    print(f"{'='*50}")
    print(f"  📧 Gesamt:        {len(unique_all)}")
    print(f"  🗑️ deletable:     {dl}")
    print(f"  ⚠️ check4delete:  {cl}")
    print(f"  📊 Quote wichtig: {pct:.1f}%")
    print(f"{'='*50}")

    with open("/root/.local/.openclaw/workspace/scripts/werbung-scan-result.json", "w") as f:
        json.dump({"total": len(unique_all), "deletable": dl, "check": cl}, f)
    print("💾 Saved")


if __name__ == "__main__":
    main()
