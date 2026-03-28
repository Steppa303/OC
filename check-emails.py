#!/usr/bin/env python3
from agentmail import AgentMail

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

print("📧 Prüfe E-Mails...")

try:
    # Inbox auflisten
    inboxes = client.inboxes.list()
    print(f"✅ Gefundene Inboxes: {len(inboxes.inboxes)}")
    
    for inbox in inboxes.inboxes:
        print(f"\n📬 Inbox: {inbox.inbox_id}")
        
        # Emails abrufen
        try:
            messages = client.inboxes.messages.list(inbox.inbox_id, limit=20)
            print(f"   Emails: {len(messages.messages)}")
            
            # Nach Knut suchen
            knut_emails = []
            for msg in messages.messages:
                if 'knut' in msg.from_.lower() or 'knut' in msg.subject.lower():
                    knut_emails.append(msg)
            
            if knut_emails:
                print(f"\n🔍 KNUT EMAILS GEFUNDEN: {len(knut_emails)}")
                for email in knut_emails:
                    print(f"\n=== Email ===")
                    print(f"Von: {email.from_}")
                    print(f"An: {email.to}")
                    print(f"Betreff: {email.subject}")
                    print(f"Datum: {email.date}")
                    print(f"Text: {email.text[:500]}...")
            else:
                print(f"\n❌ Keine Emails von Knut gefunden")
                
        except Exception as e:
            print(f"   ❌ Fehler beim Abrufen: {e}")
            
except Exception as e:
    print(f"❌ Fehler: {e}")
