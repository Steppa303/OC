#!/usr/bin/env python3
import os
import base64
from agentmail import AgentMail

# API Key setzen
api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

# PDF Datei lesen
pdf_path = "/root/.openclaw/workspace/ninja-shake-rezept.pdf"
with open(pdf_path, "rb") as f:
    pdf_data = f.read()
    pdf_base64 = base64.b64encode(pdf_data).decode()

print("📧 Sende E-Mail...")

# E-Mail senden (ohne eigene Inbox - direkt senden)
try:
    result = client.inboxes.messages.send(
        inbox_id="default",
        to="psycodelic.83.83@gmail.com",
        subject="🥤 Dein Ninja Mixer Shake Rezept 'Das Wiener Schnitzel'",
        text="""Hey Bastian!

Hier ist dein Ninja Mixer Shake Rezept als PDF! 🎉

📄 Anhang: ninja-shake-rezept.pdf

Das Rezept enthält:
- 🥩 Schnitzel-Basis
- 🍯 Hollandaise-Creme  
- 🥛 Perfekt abgestimmte Zutaten
- 🎯 Ninja Mixer Einstellungen
- 📊 Nährwerte (650 kcal pro Shake)

Viel Erfolg beim Mixen! 🥤

Liebe Grüße,
Dein OpenClaw Assistant
""",
        html="""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
<h2>Hey Bastian! 🎉</h2>

<p>Hier ist dein <strong>Ninja Mixer Shake Rezept</strong> als PDF!</p>

<div style="background: #f0f0f0; padding: 20px; border-radius: 10px; margin: 20px 0;">
<h3>📄 Anhang: ninja-shake-rezept.pdf</h3>

<p>Das Rezept enthält:</p>
<ul>
<li>🥩 Schnitzel-Basis</li>
<li>🍯 Hollandaise-Creme</li>
<li>🥛 Perfekt abgestimmte Zutaten</li>
<li>🎯 Ninja Mixer Einstellungen</li>
<li>📊 Nährwerte (650 kcal pro Shake)</li>
</ul>
</div>

<p><strong>Viel Erfolg beim Mixen! 🥤</strong></p>

<p>Liebe Grüße,<br>
Dein OpenClaw Assistant</p>
</body>
</html>
""",
        attachments=[{
            "filename": "ninja-shake-rezept.pdf",
            "content": pdf_base64
        }]
    )
    
    print("✅ E-Mail erfolgreich gesendet!")
    print(f"Message ID: {result.message_id}")
    
except Exception as e:
    print(f"❌ Fehler beim Senden: {e}")
    print("\nVersuche alternative Methode...")
    
    # Alternative: Ohne inbox_id
    try:
        result = client.send(
            to="psycodelic.83.83@gmail.com",
            subject="🥤 Dein Ninja Mixer Shake Rezept",
            text="Hey Bastian! Hier ist dein Rezept als PDF. Liebe Grüße, OpenClaw",
            attachments=[{
                "filename": "ninja-shake-rezept.pdf",
                "content": pdf_base64
            }]
        )
        print("✅ E-Mail gesendet (alternative Methode)!")
    except Exception as e2:
        print(f"❌ Alternative auch fehlgeschlagen: {e2}")
