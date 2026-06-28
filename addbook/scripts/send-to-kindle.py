#!/usr/bin/env python3
"""Send an EPUB file to Kindle via AgentMail.
Usage: python3 send-to-kindle.py <book_title> <epub_path> [author]
"""

import sys, os, json, base64, re

# Load AgentMail API key from OpenClaw config
config = json.load(open('/root/.openclaw/openclaw.json'))
api_key = config['skills']['entries']['agentmail']['env']['AGENTMAIL_API_KEY']
os.environ['AGENTMAIL_API_KEY'] = api_key

from agentmail import AgentMail

KINDLE_EMAIL = 'bastianlewin_213e22@kindle.com'
FROM_INBOX = 'bastians_assistent@agentmail.to'

if len(sys.argv) < 3:
    print(json.dumps({"error": "Usage: send-to-kindle.py <title> <epub_path> [author]"}))
    sys.exit(1)

title = sys.argv[1]
epub_path = sys.argv[2]
author = sys.argv[3] if len(sys.argv) > 3 else ''

# Read EPUB file
if not os.path.exists(epub_path):
    print(json.dumps({"error": f"EPUB file not found: {epub_path}"}))
    sys.exit(1)

with open(epub_path, 'rb') as f:
    epub_data = f.read()

# Use the actual book title as filename, not the server UUID name
# Amazon mag keine Sonderzeichen in Dateinamen
sanitized_title = re.sub(r'[\\/:*?"<>|!•·●◆◇■□▲△▼▽○◉◈☆★♪♫£€¥§™®©@#%^&+=~`]', '', title)[:80].strip()
sanitized_title = re.sub(r'\s+', ' ', sanitized_title)
if not sanitized_title:
    sanitized_title = 'Buch'
filename = f"{sanitized_title}.epub"

# Send via AgentMail
client = AgentMail(api_key=api_key)

subject = title
body = f"An Kindle gesendet aus der Lesestoff Bibliothek: {title}"
if author:
    body += f" von {author}"

try:
    result = client.inboxes.messages.send(
        inbox_id=FROM_INBOX,
        to=[KINDLE_EMAIL],
        subject=subject,
        text=body,
        attachments=[{
            "filename": filename,
            "content": base64.b64encode(epub_data).decode(),
            "content_type": "application/epub+zip"
        }]
    )
    print(json.dumps({
        "success": True,
        "message_id": result.message_id,
        "thread_id": result.thread_id
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)