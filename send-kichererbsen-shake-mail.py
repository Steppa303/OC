#!/usr/bin/env python3
import base64
from agentmail import AgentMail

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

# PDF lesen
pdf_path = "/root/.openclaw/workspace/kichererbsen-shake-rezept.pdf"
with open(pdf_path, "rb") as f:
    pdf_data = f.read()
    pdf_base64 = base64.b64encode(pdf_data).decode()

# Empfänger
recipients = [
    ("psycodelic.83.83@gmail.com", "Bastian"),
    ("dirk@bindbeutel.de", "Dirk")
]

print("📧 Sende Kichererbsen-Shake Rezept an 2 Empfänger...")

for recipient_email, recipient_name in recipients:
    print(f"\n📬 Sende an: {recipient_name} ({recipient_email})")
    
    result = client.inboxes.messages.send(
        "bastians_assistent@agentmail.to",
        to=recipient_email,
        subject="🥤 Kichererbsen-Shake Rezept ('Trinkbarer Hummus')",
        text=f"""Hey {recipient_name}!

Hier ist das coole Kichererbsen-Shake Rezept ("Trinkbarer Hummus") für den Ninja Blast and Go! 🥤

📄 Anhang: kichererbsen-shake-rezept.pdf

🌟 Highlights:
- Basis: Kichererbsen (wie Hummus zum Trinken!)
- Cremig durch Tahini & griechischen Joghurt
- Proteinreich (18g pro Portion)
- In 5 Minuten fertig
- Perfekt für unterwegs

💡 Zutaten (für 2 Portionen):
- 400g Kichererbsen (1 Dose)
- 4 EL Tahini
- 200g Griechischer Joghurt
- 3 EL Zitronensaft
- 1-2 Knoblauchzehen
- Olivenöl, Kreuzkümmel, Paprika, Salz, Pfeffer
- Frische Petersilie

Einfach alles in den Ninja Blast and Go, 60-90 Sekunden mixen, fertig!

Guten Appetit! 🥤

Liebe Grüße,
Dein OpenClaw Assistant
""",
        html=f"""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
<h2>Hey {recipient_name}! 🥤</h2>

<p>Hier ist das coole <strong>Kichererbsen-Shake Rezept</strong> ("Trinkbarer Hummus") für den Ninja Blast and Go!</p>

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px; margin: 25px 0; color: white;">
<h3 style="color: white; margin-top: 0;">🌟 Highlights</h3>
<ul style="font-size: 1.1em;">
<li>Basis: Kichererbsen (wie Hummus zum Trinken!)</li>
<li>Cremig durch Tahini & griechischen Joghurt</li>
<li>Proteinreich (18g pro Portion)</li>
<li>In 5 Minuten fertig</li>
<li>Perfekt für unterwegs</li>
</ul>
</div>

<div style="background: #fffbeb; border-left: 4px solid #fbbf24; padding: 15px 20px; margin: 20px 0;">
<h4 style="color: #92400e; margin-top: 0;">💡 Zutaten (für 2 Portionen)</h4>
<ul>
<li>400g Kichererbsen (1 Dose)</li>
<li>4 EL Tahini</li>
<li>200g Griechischer Joghurt</li>
<li>3 EL Zitronensaft</li>
<li>1-2 Knoblauchzehen</li>
<li>Olivenöl, Kreuzkümmel, Paprika, Salz, Pfeffer</li>
<li>Frische Petersilie</li>
</ul>
</div>

<p style="font-size: 1.2em;"><strong>Einfach alles in den Ninja Blast and Go, 60-90 Sekunden mixen, fertig!</strong></p>

<p style="font-size: 1.2em;"><strong>Guten Appetit! 🥤</strong></p>

<p>Liebe Grüße,<br>
<strong>Dein OpenClaw Assistant</strong></p>
</body>
</html>
""",
        attachments=[{
            "filename": "kichererbsen-shake-rezept.pdf",
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
print(f"📎 Anhang: kichererbsen-shake-rezept.pdf ({len(pdf_data)} bytes)")
