#!/usr/bin/env python3
import base64
from agentmail import AgentMail

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

# PDF lesen
pdf_path = "/root/.openclaw/workspace/ninja-herzhafte-rezepte.pdf"
with open(pdf_path, "rb") as f:
    pdf_data = f.read()
    pdf_base64 = base64.b64encode(pdf_data).decode()

# Empfänger
recipients = [
    "psycodelic.83.83@gmail.com",  # Bastian
    "dirk.bindbeutel@polizeiakademie.de"  # Dirk
]

print("📧 Sende Ninja Rezepte an 2 Empfänger...")

for recipient in recipients:
    print(f"\n📬 Sende an: {recipient}")
    
    result = client.inboxes.messages.send(
        "bastians_assistent@agentmail.to",
        to=recipient,
        subject="🍽️ 3 Herzhafte Ninja Mixer Rezepte (PDF)",
        text=f"""Hey!

Hier sind 3 herzhafte Rezepte für deinen Ninja Mixer als PDF! 🍲

🍅 Tomaten-Basilikum Suppe (Klassisch, Pikant)
🥦 Käse-Brokkoli Suppe (Cremig, Herzhaft)
🥒 Gazpacho (Kalt, Spanisch, Pikant)

📄 Anhang: ninja-herzhafte-rezepte.pdf

💡 Alle Rezepte sind:
- Einfach zuzubereiten (LEICHT)
- Ninja Mixer-spezifisch (mit Einstellungen)
- Perfekt für den Herbst/Winter

Viel Freude beim Kochen und Genießen! 🥄

Liebe Grüße,
Dein OpenClaw Assistant
""",
        html=f"""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
<h2>Hey! 🍽️</h2>

<p>Hier sind <strong>3 herzhafte Rezepte</strong> für deinen Ninja Mixer als PDF!</p>

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px; margin: 25px 0; color: white;">
<h3 style="color: white; margin-top: 0;">🍲 3 Herzhafte Ninja Mixer Rezepte</h3>
<ul style="font-size: 1.1em;">
<li>🍅 <strong>Tomaten-Basilikum Suppe</strong> (Klassisch, Pikant)</li>
<li>🥦 <strong>Käse-Brokkoli Suppe</strong> (Cremig, Herzhaft)</li>
<li>🥒 <strong>Gazpacho</strong> (Kalt, Spanisch, Pikant)</li>
</ul>
</div>

<div style="background: #fffbeb; border-left: 4px solid #fbbf24; padding: 15px 20px; margin: 20px 0;">
<h4 style="color: #92400e; margin-top: 0;">💡 Highlights</h4>
<ul>
<li>✅ Einfach zuzubereiten (LEICHT)</li>
<li>✅ Ninja Mixer-spezifisch (mit Einstellungen)</li>
<li>✅ Perfekt für den Herbst/Winter</li>
</ul>
</div>

<p style="font-size: 1.2em;"><strong>Viel Freude beim Kochen und Genießen! 🥄</strong></p>

<p>Liebe Grüße,<br>
<strong>Dein OpenClaw Assistant</strong></p>
</body>
</html>
""",
        attachments=[{
            "filename": "ninja-herzhafte-rezepte.pdf",
            "content": pdf_base64
        }]
    )
    
    print(f"✅ Erfolgreich gesendet!")
    print(f"📨 Message ID: {result.message_id}")

print("\n" + "="*50)
print("✅ ALLE MAILS ERFOLGREICH GESENDET!")
print("="*50)
print(f"📬 Von: bastians_assistent@agentmail.to")
print(f"📬 An: {len(recipients)} Empfänger")
print(f"📎 Anhang: ninja-herzhafte-rezepte.pdf ({len(pdf_data)} bytes)")
