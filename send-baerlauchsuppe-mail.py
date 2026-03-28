#!/usr/bin/env python3
import base64
from agentmail import AgentMail

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

# PDF lesen
pdf_path = "/root/.openclaw/workspace/baerlauchsuppe-rezept.pdf"
with open(pdf_path, "rb") as f:
    pdf_data = f.read()
    pdf_base64 = base64.b64encode(pdf_data).decode()

print("📧 Sende Bärlauchsuppe Rezept an Bastian...")

result = client.inboxes.messages.send(
    "bastians_assistent@agentmail.to",
    to="psycodelic.83.83@gmail.com",
    subject="🌿 Dein Bärlauchsuppe Rezept (PDF)",
    text="""Hey Bastian!

Hier ist dein Bärlauchsuppe Rezept als PDF! 🍲

🌿 Das BESTE Bärlauchsuppe-Rezept
- Recherchiert aus Top-Rezepten (4.5+ Sterne, 1400+ Bewertungen)
- Mit Profitipps & Geheimtipps vom Profi
- Zubereitungszeit: 30-35 Minuten
- Schwierigkeit: Einfach

📄 Anhang: baerlauchsuppe-rezept.pdf

💡 Wichtigster Tipp: Bärlauch NIEMALS lange mitkochen!
Erst am Ende hinzufügen, max. 2 Minuten ziehen lassen.

Viel Freude beim Kochen und Genießen! 🥄

Liebe Grüße,
Dein OpenClaw Assistant
""",
    html="""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
<h2>Hey Bastian! 🌿</h2>

<p>Hier ist dein <strong>Bärlauchsuppe Rezept</strong> als PDF!</p>

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px; margin: 25px 0; color: white;">
<h3 style="color: white; margin-top: 0;">🍲 Das BESTE Bärlauchsuppe-Rezept</h3>
<ul style="font-size: 1.1em;">
<li>✅ Recherchiert aus Top-Rezepten (4.5+ Sterne, 1400+ Bewertungen)</li>
<li>✅ Mit Profitipps & Geheimtipps vom Profi</li>
<li>✅ Zubereitungszeit: 30-35 Minuten</li>
<li>✅ Schwierigkeit: Einfach</li>
</ul>
</div>

<div style="background: #fffbeb; border-left: 4px solid #fbbf24; padding: 15px 20px; margin: 20px 0;">
<h4 style="color: #92400e; margin-top: 0;">💡 Wichtigster Tipp</h4>
<p><strong>Bärlauch NIEMALS lange mitkochen!</strong><br>
Erst am Ende hinzufügen, max. 2 Minuten ziehen lassen. So bleibt das Aroma und die schöne grüne Farbe erhalten!</p>
</div>

<p style="font-size: 1.2em;"><strong>Viel Freude beim Kochen und Genießen! 🥄</strong></p>

<p>Liebe Grüße,<br>
<strong>Dein OpenClaw Assistant</strong></p>
</body>
</html>
""",
    attachments=[{
        "filename": "baerlauchsuppe-rezept.pdf",
        "content": pdf_base64
    }]
)

print("✅ E-Mail erfolgreich gesendet!")
print(f"📬 Von: bastians_assistent@agentmail.to")
print(f"📬 An: psycodelic.83.83@gmail.com")
print(f"📨 Message ID: {result.message_id}")
print(f"📎 Anhang: baerlauchsuppe-rezept.pdf ({len(pdf_data)} bytes)")
