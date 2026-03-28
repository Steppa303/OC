#!/usr/bin/env python3
from agentmail import AgentMail

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

print("📬 Verfügbare Inboxes:")
try:
    inboxes = client.inboxes.list()
    for inbox in inboxes.inboxes:
        print(f"  - {inbox.inbox_id} (ID: {inbox.inbox_id})")
except Exception as e:
    print(f"❌ Fehler: {e}")

print("\n📧 Versuche E-Mail zu senden...")
try:
    # Versuche mit erster Inbox
    inboxes = client.inboxes.list()
    if inboxes.inboxes:
        inbox_id = inboxes.inboxes[0].inbox_id
        print(f"Nutze Inbox: {inbox_id}")
        
        result = client.inboxes.messages.send(
            inbox_id=inbox_id,
            to="psycodelic.83.83@gmail.com",
            subject="Test von AgentMail",
            text="Test"
        )
        print(f"✅ Gesendet! Message ID: {result.message_id}")
    else:
        print("❌ Keine Inboxes gefunden!")
except Exception as e:
    print(f"❌ Fehler: {e}")
