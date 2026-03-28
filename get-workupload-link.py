#!/usr/bin/env python3
from agentmail import AgentMail
import re
import requests
from bs4 import BeautifulSoup

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

print("📧 Suche workupload-Mail...\n")

try:
    inboxes = client.inboxes.list()
    
    for inbox in inboxes.inboxes:
        print(f"📬 Inbox: {inbox.inbox_id}\n")
        
        messages = client.inboxes.messages.list(inbox.inbox_id, limit=50)
        
        for msg in messages.messages:
            if 'workupload' in msg.from_.lower() or 'workupload' in msg.subject.lower():
                print(f"✅ workupload-Mail gefunden!\n")
                
                # Mail-Details abrufen
                url = f"https://api.agentmail.to/inboxes/{inbox.inbox_id}/messages/{msg.message_id}"
                headers = {'Authorization': f'Bearer {api_key}'}
                response = requests.get(url, headers=headers)
                
                if response.status_code == 200:
                    email_data = response.json()
                    
                    # HTML parsen
                    if 'html' in email_data and email_data['html']:
                        soup = BeautifulSoup(email_data['html'], 'html.parser')
                        
                        # Alle Links finden
                        links = soup.find_all('a', href=True)
                        print(f"🔗 Gefundene Links ({len(links)}):\n")
                        
                        for link in links:
                            href = link['href']
                            text = link.get_text(strip=True)[:100]
                            print(f"  📄 {text}")
                            print(f"     {href}\n")
                            
                            if 'workupload.com' in href.lower() and 'download' in href.lower():
                                print(f"\n✅ DOWNLOAD-LINK GEFUNDEN:")
                                print(f"   {href}\n")
                                print(f"   Text: {text}\n")
                    
                    # Auch Text prüfen falls vorhanden
                    if 'text' in email_data and email_data['text']:
                        print(f"\n📄 Mail-Text:\n{email_data['text']}\n")
                        
                else:
                    print(f"❌ API-Fehler: {response.status_code}")
                
except Exception as e:
    print(f"❌ Fehler: {e}")
    import traceback
    traceback.print_exc()
