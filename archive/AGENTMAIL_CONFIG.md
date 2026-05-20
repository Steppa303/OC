# AgentMail Konfiguration

## API Key
```
am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90
```

## Inbox
- **ID:** bastians_assistent@agentmail.to
- **Display Name:** Bastian's Assistant

## Usage

### E-Mail senden
```python
from agentmail import AgentMail

client = AgentMail(api_key="am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90")

client.inboxes.messages.send(
    "bastians_assistent@agentmail.to",  # inbox_id (POSITIONAL, nicht keyword!)
    to="psycodelic.83.83@gmail.com",
    subject="Betreff",
    text="Text body",
    html="<p>HTML body</p>",
    attachments=[{"filename": "file.pdf", "content": "base64..."}]
)
```

### Wichtige Notes:
1. **inbox_id ist POSITIONAL** - nicht `inbox_id=...`!
2. **API Key** in Environment oder hardcoded
3. **Inbox existiert bereits:** bastians_assistent@agentmail.to

### Getestete Funktionen:
✅ E-Mail senden mit Anhang
✅ HTML + Text Body
✅ Base64 Attachments

### Datei: send-rezept.py
Das Script funktioniert korrekt und wurde erfolgreich getestet!
