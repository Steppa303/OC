#!/usr/bin/env python3
"""Renew Google Drive Watch Channel for Scribe via Composio MCP"""

import json, time, uuid, sys
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
access_token = oauth['tokens']['access_token']

# Init MCP session
session = requests.Session()
session.headers.update({
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': f'Bearer {access_token}'
})

req_id = 0

def _next_id():
    global req_id
    req_id += 1
    return req_id

def _parse_sse(text):
    for line in text.split('\n'):
        if line.startswith('data:'):
            try:
                return json.loads(line[5:].strip())
            except:
                continue
    return None

def _mcp_call(method, params=None):
    req = {
        'jsonrpc': '2.0',
        'id': _next_id(),
        'method': method,
    }
    if params:
        req['params'] = params
    r = session.post(MCP_URL, json=req, timeout=60)
    r.raise_for_status()
    return _parse_sse(r.text)

def _extract_content(result):
    if not result:
        return None
    if result.get('error'):
        print(f'MCP error: {result["error"]}', file=sys.stderr)
        return None
    content = result.get('result', {}).get('content', [])
    texts = [c.get('text','') for c in content if c.get('type')=='text']
    combined = '\n'.join(texts)
    if not combined:
        return None
    try:
        return json.loads(combined)
    except:
        return {'raw_text': combined}

# Initialize MCP
init_result = _mcp_call('initialize', {
    'protocolVersion': '2024-11-05',
    'capabilities': {},
    'clientInfo': {'name': 'scribe-renew', 'version': '1.0'}
})
session_id = session.headers.get('mcp-session-id',
    init_result.get('result', {}).get('_meta', {}).get('sessionId'))
if session_id:
    session.headers['mcp-session-id'] = session_id

_mcp_call('notifications/initialized')
print('MCP session initialized')

def multi_execute(tool_slug, arguments):
    result = _mcp_call('tools/call', {
        'name': 'COMPOSIO_MULTI_EXECUTE_TOOL',
        'arguments': {
            'tools': [{'tool_slug': tool_slug, 'arguments': arguments}],
            'memory': {}
        }
    })
    data = _extract_content(result)
    if not data:
        return None
    # Navigate composio response nesting
    d = data.get('data', data)
    if isinstance(d, dict):
        results = d.get('results', [])
        if results:
            first = results[0]
            resp = first.get('response', first)
            return resp.get('data', resp)
    return d

# ---------------------------------------------------------------
# 1. Read old state
# ---------------------------------------------------------------
old_state = {}
if STATE_FILE.exists():
    try:
        old_state = json.loads(STATE_FILE.read_text())
        print(f'Old channel: id={old_state.get("id")}, '
              f'resource_id={old_state.get("resource_id")}, '
              f'page_token={old_state.get("page_token")}')
    except Exception as e:
        print(f'Could not read old state: {e}')

# ---------------------------------------------------------------
# 2. Generate new UUID + token
# ---------------------------------------------------------------
new_id = str(uuid.uuid4())
new_token = f'scribe-wh-v2-{uuid.uuid4().hex[:12]}'
print(f'New channel ID: {new_id}')
print(f'New token: {new_token}')

# ---------------------------------------------------------------
# 3. Get fresh startPageToken
# ---------------------------------------------------------------
print('Getting startPageToken...')
page_data = multi_execute('GOOGLEDRIVE_GET_CHANGES_START_PAGE_TOKEN', {
    'supportsAllDrives': False
})
page_token = None
if isinstance(page_data, dict):
    page_token = (page_data.get('startPageToken') or
                  page_data.get('start_page_token') or
                  page_data.get('token'))
print(f'Page token response: {json.dumps(page_data, default=str)[:300] if page_data else "None"}')

if not page_token:
    page_token = old_state.get('page_token')
    print(f'Fallback to old page_token: {page_token}')

if not page_token:
    print('ERROR: No page_token available', file=sys.stderr)
    sys.exit(1)

print(f'Using page_token: {page_token}')

# ---------------------------------------------------------------
# 4. Calculate expiry (now + 24h)
# ---------------------------------------------------------------
new_expiration = int((time.time() + 86400) * 1000)
expiry_human = time.strftime('%Y-%m-%d %H:%M:%S %Z', time.localtime(new_expiration / 1000))
print(f'New expiration: {new_expiration} ({expiry_human})')

# ---------------------------------------------------------------
# 5. Create new watch channel
# ---------------------------------------------------------------
print('Creating new watch channel...')
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
new_resource_id = None
if isinstance(watch_data, dict):
    new_resource_id = (watch_data.get('resourceId') or
                       watch_data.get('resource_id'))
    if not new_resource_id:
        for key in ('id', 'channelId', 'channel_id'):
            candidate = watch_data.get(key)
            if candidate and candidate != new_id:
                new_resource_id = candidate
                break
print(f'Watch response: {json.dumps(watch_data, default=str)[:400] if watch_data else "None"}')

if not new_resource_id:
    print('ERROR: No resourceId from watch channel creation', file=sys.stderr)
    # Write partial state for debugging
    partial_state = {
        'id': new_id,
        'token': new_token,
        'expiration': new_expiration,
        'page_token': page_token,
        'created_at': int(time.time()),
        'address': WEBHOOK_URL,
        'status': 'failed_no_resource_id',
        'watch_response': str(watch_data)[:500]
    }
    STATE_FILE.write_text(json.dumps(partial_state, indent=2))
    sys.exit(1)

print(f'New resource_id: {new_resource_id}')

# ---------------------------------------------------------------
# 6. Stop old channel
# ---------------------------------------------------------------
old_id = old_state.get('id')
old_resource_id = old_state.get('resource_id')
if old_id and old_resource_id:
    print(f'Stopping old channel: id={old_id}, resource_id={old_resource_id}')
    stop_data = multi_execute('GOOGLEDRIVE_STOP_WATCH_CHANNEL', {
        'id': old_id,
        'resourceId': old_resource_id
    })
    print(f'Stop response: {json.dumps(stop_data, default=str)[:200]}')
else:
    print('No old channel to stop')

# ---------------------------------------------------------------
# 7. Save new state
# ---------------------------------------------------------------
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

# ---------------------------------------------------------------
# 8. Summary
# ---------------------------------------------------------------
print()
print('=' * 60)
print('CHANNEL RENEWAL COMPLETE')
print('=' * 60)
print(f'  New ID:         {new_id}')
print(f'  New resource:   {new_resource_id}')
print(f'  Page token:     {page_token}')
print(f'  Expiration:     {expiry_human}')
print(f'  Old stopped:    {old_id if old_id else "N/A"}')
print('=' * 60)