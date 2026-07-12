#!/bin/bash
# Renew the Google Drive Watch Channel for Scribe
# This script is called by cron

cd /root/.local/.openclaw/workspace/scribe
python3 -c "
import json, time, uuid, sys, os
from pathlib import Path

BASE_DIR = Path('/root/.local/.openclaw/workspace/scribe')
STATE_FILE = BASE_DIR / '.webhook_channel.json'
OAUTH_FILE = Path('/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json')
MCP_URL = 'https://connect.composio.dev/mcp'
WEBHOOK_URL = 'https://lesestoff.steppa.online/api/scribe/webhook'

import requests

# Load OAuth token
with open(OAUTH_FILE) as f:
    oauth = json.load(f)
token = oauth['tokens']['access_token']

# MCP session
session = requests.Session()
session.headers.update({
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': f'Bearer {token}'
})

req_id = 0
def next_id():
    global req_id
    req_id += 1
    return req_id

def call_mcp(name, arguments):
    req = {
        'jsonrpc': '2.0',
        'id': next_id(),
        'method': 'tools/call',
        'params': {'name': name, 'arguments': arguments}
    }
    r = session.post(MCP_URL, json=req, timeout=60)
    r.raise_for_status()
    # Parse SSE
    for line in r.text.split('\n'):
        if line.startswith('data:'):
            try:
                return json.loads(line[5:].strip())
            except:
                continue
    return None

def extract_data(result):
    '''Extract data from composio multi_execute response'''
    if not result:
        return None
    err = result.get('error')
    if err:
        print(f'MCP error: {err}', file=sys.stderr)
        return None
    content = result.get('result', {}).get('content', [])
    texts = [c.get('text','') for c in content if c.get('type')=='text']
    combined = '\n'.join(texts)
    try:
        return json.loads(combined)
    except:
        return {'raw_text': combined}

def multi_execute(tool_slug, arguments):
    result = call_mcp('COMPOSIO_MULTI_EXECUTE_TOOL', {
        'tools': [{'tool_slug': tool_slug, 'arguments': arguments}],
        'memory': {}
    })
    data = extract_data(result)
    if not data:
        return None
    # Navigate typical composio response path: data->results[0]->response->data
    d = data.get('data', data)
    if isinstance(d, dict):
        results = d.get('results', [])
        if results:
            first = results[0]
            resp = first.get('response', first)
            return resp.get('data', resp)
    return d

# ============================================================
# 1. Read old state
# ============================================================
old_state = {}
if STATE_FILE.exists():
    try:
        old_state = json.loads(STATE_FILE.read_text())
        print(f'Old channel: id={old_state.get(\"id\")}, resource_id={old_state.get(\"resource_id\")}, page_token={old_state.get(\"page_token\")}')
    except:
        print('Could not read old state, continuing...')

# ============================================================
# 2. Generate new UUID + token
# ============================================================
new_id = str(uuid.uuid4())
new_token = f'scribe-wh-v2-{uuid.uuid4().hex[:12]}'
print(f'New channel ID: {new_id}')
print(f'New token: {new_token}')

# ============================================================
# 3. Get fresh startPageToken
# ============================================================
print('Getting fresh startPageToken...')
page_data = multi_execute('GOOGLEDRIVE_GET_CHANGES_START_PAGE_TOKEN', {
    'supportsAllDrives': False
})
print(f'Start page token response: {json.dumps(page_data, indent=2)[:300]}')

if page_data:
    page_token = page_data.get('startPageToken', page_data.get('start_page_token', None))
    if not page_token and isinstance(page_data, dict):
        page_token = page_data.get('token', None)
else:
    # Fallback: use existing page_token
    page_token = old_state.get('page_token')
    print(f'Using existing page_token: {page_token}')

if not page_token:
    print('ERROR: Could not obtain startPageToken', file=sys.stderr)
    sys.exit(1)

print(f'Using page_token: {page_token}')

# ============================================================
# 4. Calculate new expiration (now + 24h in ms)
# ============================================================
new_expiration = int((time.time() + 86400) * 1000)
print(f'New expiration: {new_expiration} ({time.ctime(new_expiration/1000)})')

# ============================================================
# 5. Call GOOGLEDRIVE_WATCH_CHANGES
# ============================================================
print('Setting up new watch channel...')
watch_data = multi_execute('GOOGLEDRIVE_WATCH_CHANGES', {
    'id': new_id,
    'type': 'web_hook',
    'address': WEBHOOK_URL,
    'token': new_token,
    'pageToken': page_token,
    'expiration': new_expiration,
    'restrictToMyDrive': True,
    'spaces': 'drive',
    'pageSize': 100
})
print(f'Watch response: {json.dumps(watch_data, indent=2)[:500]}')

if watch_data:
    new_resource_id = watch_data.get('resourceId', watch_data.get('resource_id', None))
    if not new_resource_id:
        # Try deeper nesting
        d = watch_data.get('data', watch_data)
        if isinstance(d, dict):
            results = d.get('results', [])
            if results:
                first = results[0]
                resp = first.get('response', first)
                rd = resp.get('data', resp)
                new_resource_id = rd.get('resourceId', rd.get('resource_id', None))
else:
    new_resource_id = None

print(f'New resource_id: {new_resource_id}')

if not new_resource_id:
    print('ERROR: Watch channel creation did not return a resourceId', file=sys.stderr)
    sys.exit(1)

# ============================================================
# 6. Stop old channel
# ============================================================
old_id = old_state.get('id')
old_resource_id = old_state.get('resource_id')
if old_id and old_resource_id:
    print(f'Stopping old channel: id={old_id}, resource_id={old_resource_id}')
    stop_data = multi_execute('GOOGLEDRIVE_STOP_WATCH_CHANNEL', {
        'id': old_id,
        'resourceId': old_resource_id
    })
    print(f'Stop response: {json.dumps(stop_data, indent=2)[:200]}')
else:
    print('No old channel to stop (or missing resource_id)')

# ============================================================
# 7. Save new state
# ============================================================
new_state = {
    'id': new_id,
    'resource_id': new_resource_id,
    'token': new_token,
    'expiration': new_expiration,
    'page_token': page_token,
    'created_at': int(time.time()),
    'address': WEBHOOK_URL
}
STATE_FILE.write_text(json.dumps(new_state, indent=2))
print(f'State saved to {STATE_FILE}')

# ============================================================
# 8. Summary
# ============================================================
print()
print('=' * 60)
print('CHANNEL RENEWAL COMPLETE')
print('=' * 60)
print(f'New ID:         {new_id}')
print(f'New resource:   {new_resource_id}')
print(f'Page token:     {page_token}')
print(f'Expiration:     {time.ctime(new_expiration/1000)}')
print(f'Expiration ms:  {new_expiration}')
print('=' * 60)
"