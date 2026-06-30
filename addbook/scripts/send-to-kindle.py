#!/usr/bin/env python3
"""Send an EPUB file to Kindle via AgentMail.
Usage: python3 send-to-kindle.py <book_title> <epub_path> [author]
"""

import sys, os, json, base64, re, mimetypes

# Load AgentMail API key from OpenClaw config
config = json.load(open('/root/.openclaw/openclaw.json'))
api_key = config['skills']['entries']['agentmail']['env']['AGENTMAIL_API_KEY']
os.environ['AGENTMAIL_API_KEY'] = api_key

from agentmail import AgentMail

KINDLE_EMAIL = 'bastianlewin_213e22@kindle.com'
FROM_INBOX = 'bastians_assistent@agentmail.to'

if len(sys.argv) < 3:
    print(json.dumps({"error": "Usage: send-to-kindle.py <title> <file_path> [author]"}))
    sys.exit(1)

title = sys.argv[1]
file_path = sys.argv[2]
author = sys.argv[3] if len(sys.argv) > 3 else ''

if not os.path.exists(file_path):
    print(json.dumps({"error": f"File not found: {file_path}"}))
    sys.exit(1)

# Detect file type from extension (supports epub and pdf)
ext = os.path.splitext(file_path)[1].lower()
if ext == '.pdf':
    content_type = 'application/pdf'
    file_ext = '.pdf'
elif ext == '.epub':
    content_type = 'application/epub+zip'
    file_ext = '.epub'
else:
    # Fallback: guess by mimetypes
    content_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
    file_ext = ext

with open(file_path, 'rb') as f:
    file_data = f.read()

# Sanitize filename for Amazon - strip all non-ASCII
sanitized_title = re.sub(r'[^\x20-\x7E]', '', title)[:60].strip()
sanitized_title = re.sub(r'[\\/:*?"<>|!•·●◆◇■□▲△▼▽○◉◈☆★♪♫£€¥§™®©@#%^&+=~`]', '', sanitized_title)[:60].strip()
sanitized_title = re.sub(r'\s+', ' ', sanitized_title).strip()
if not sanitized_title:
    sanitized_title = 'Dokument'
filename = f"{sanitized_title}{file_ext}"

# Send via AgentMail
client = AgentMail(api_key=api_key)

# For PDF: append "Convert" to trigger Amazon's PDF-to-Kindle conversion
# For EPUB: subject = title is fine
subject = title
if ext == '.pdf':
    subject = f"{title} [Convert]"
body = f"An Kindle gesendet: {title}"
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
            "content": base64.b64encode(file_data).decode(),
            "content_type": content_type
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