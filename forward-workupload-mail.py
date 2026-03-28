#!/usr/bin/env python3
from agentmail import AgentMail
import requests

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

print("📧 Leite workupload-Mail an Bastian weiter...\n")

try:
    # workupload-Mail finden
    inboxes = client.inboxes.list()
    
    for inbox in inboxes.inboxes:
        messages = client.inboxes.messages.list(inbox.inbox_id, limit=50)
        
        for msg in messages.messages:
            if 'workupload' in msg.from_.lower() or 'workupload' in msg.subject.lower():
                print(f"✅ workupload-Mail gefunden!")
                print(f"   Von: {msg.from_}")
                print(f"   Betreff: {msg.subject}")
                
                # Mail-Details abrufen (für den Download-Link)
                url = f"https://api.agentmail.to/inboxes/{inbox.inbox_id}/messages/{msg.message_id}"
                headers = {'Authorization': f'Bearer {api_key}'}
                response = requests.get(url, headers=headers)
                
                download_link = ""
                if response.status_code == 200:
                    email_data = response.json()
                    if 'html' in email_data and email_data['html']:
                        from bs4 import BeautifulSoup
                        soup = BeautifulSoup(email_data['html'], 'html.parser')
                        links = soup.find_all('a', href=True)
                        for link in links:
                            if 'workupload.com' in link['href'].lower():
                                download_link = link['href']
                                break
                
                # Mail an Bastian weiterleiten
                result = client.inboxes.messages.send(
                    "bastians_assistent@agentmail.to",
                    to="psycodelic.83.83@gmail.com",
                    subject=f"📦 workupload Download-Link (von {msg.from_})",
                    text=f"""Hey Bastian!

Hier ist die workupload-Mail zum Download:

📬 Original-Mail:
Von: {msg.from_}
Betreff: {msg.subject}

🔗 DOWNLOAD-LINK:
{download_link}

📝 Anleitung:
1. Link im Browser öffnen
2. CAPTCHA lösen (falls erforderlich)
3. ZIP-Datei herunterladen
4. Zu mir schicken oder selbst entpacken

Der Download-Link sollte direkt zur ZIP-Datei führen.

Liebe Grüße,
Bernd
""",
                    html=f"""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
<h2>Hey Bastian! 📦</h2>

<p>Hier ist die <strong>workupload-Mail</strong> zum Download:</p>

<div style="background: #f0f0f0; padding: 20px; border-radius: 10px; margin: 20px 0;">
<p><strong>📬 Original-Mail:</strong><br>
Von: {msg.from_}<br>
Betreff: {msg.subject}</p>
</div>

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px; margin: 20px 0; color: white;">
<h3 style="color: white; margin-top: 0;">🔗 DOWNLOAD-LINK</h3>
<p style="font-size: 1.2em; word-break: break-all;">
<a href="{download_link}" style="color: white; text-decoration: underline;">{download_link}</a>
</p>
</div>

<div style="background: #fffbeb; border-left: 4px solid #fbbf24; padding: 15px 20px; margin: 20px 0;">
<h4 style="color: #92400e; margin-top: 0;">📝 Anleitung</h4>
<ol>
<li>Link im Browser öffnen</li>
<li>CAPTCHA lösen (falls erforderlich)</li>
<li>ZIP-Datei herunterladen</li>
<li>Zu mir schicken oder selbst entpacken</li>
</ol>
</div>

<p>Der Download-Link sollte direkt zur ZIP-Datei führen.</p>

<p>Liebe Grüße,<br>
<strong>Bernd</strong></p>
</body>
</html>
"""
                )
                
                print(f"\n✅ Mail weitergeleitet an: psycodelic.83.83@gmail.com")
                print(f"📨 Message ID: {result.message_id}")
                
except Exception as e:
    print(f"❌ Fehler: {e}")
    import traceback
    traceback.print_exc()
