#!/usr/bin/env python3
from agentmail import AgentMail
from collections import Counter

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

print("📧 Absender der eingegangenen E-Mails:\n")
print("=" * 60)

try:
    # Inbox auflisten
    inboxes = client.inboxes.list()
    
    for inbox in inboxes.inboxes:
        print(f"\n📬 Inbox: {inbox.inbox_id}\n")
        
        # Emails abrufen
        messages = client.inboxes.messages.list(inbox.inbox_id, limit=50)
        
        # Absender zählen
        senders = Counter()
        emails_by_sender = {}
        
        for msg in messages.messages:
            sender = msg.from_
            senders[sender] += 1
            
            if sender not in emails_by_sender:
                emails_by_sender[sender] = []
            emails_by_sender[sender].append(msg.subject)
        
        # Absender auflisten
        print(f"{'Absender':<50} {'Anzahl':<10}")
        print("-" * 60)
        
        for sender, count in senders.most_common():
            print(f"{sender:<50} {count:<10}")
        
        print("\n" + "=" * 60)
        print("\n📋 DETAILLIERTE LISTE:\n")
        
        for sender, subjects in emails_by_sender.items():
            print(f"\n📧 {sender} ({len(subjects)} E-Mails)")
            for subject in subjects[:5]:  # Zeige max 5 pro Absender
                print(f"   📄 {subject[:60]}")
            if len(subjects) > 5:
                print(f"   ... und {len(subjects) - 5} weitere")
            
except Exception as e:
    print(f"❌ Fehler: {e}")

print("\n" + "=" * 60)
