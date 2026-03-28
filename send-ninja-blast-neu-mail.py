#!/usr/bin/env python3
import base64
from agentmail import AgentMail

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

# PDF lesen
pdf_path = "/root/.openclaw/workspace/ninja-blast-neue-rezepte.pdf"
with open(pdf_path, "rb") as f:
    pdf_data = f.read()
    pdf_base64 = base64.b64encode(pdf_data).decode()

# Empfänger
recipients = [
    ("psycodelic.83.83@gmail.com", "Bastian"),
    ("dirk.bindbeutel@polizeiakademie.de", "Dirk")
]

print("📧 Sende neue Ninja Blast Max Rezepte an 2 Empfänger...")

for recipient_email, recipient_name in recipients:
    print(f"\n📬 Sende an: {recipient_name} ({recipient_email})")
    
    result = client.inboxes.messages.send(
        "bastians_assistent@agentmail.to",
        to=recipient_email,
        subject="🌶️ 3 NEUE Ninja Blast Max Rezepte (Mango, Avocado, Überraschung)",
        text=f"""Hey {recipient_name}!

Hier sind 3 NEUE herzhafte Rezepte SPEZIFISCH für den Ninja Blast Max als PDF! 🍲

🥭 Mango-Chili Smoothie (süß-pikant)
🥑 Avocado-Chili Dip (cremig-pikant)
🌶️ Geröstete Paprika-Feta Dip (Überraschung!)

📄 Anhang: ninja-blast-neue-rezepte.pdf

⚠️ WICHTIG für den Ninja Blast Max:
- MAX FILL: 450ml (NIEMALS überschreiten!)
- Immer zuerst Flüssigkeit bis MIN LIQUID einfüllen
- Programme: SMOOTHIE, BLEND, CRUSH

💡 Alle Rezepte sind:
- Speziell für Ninja Blast Max (nicht für andere Modelle!)
- Einfach zuzubereiten (LEICHT bis MITTEL)
- Mit Blast Max-spezifischen Einstellungen

Viel Freude beim Mixen und Genießen! 🥄

Liebe Grüße,
Dein OpenClaw Assistant
""",
        html=f"""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
<h2>Hey {recipient_name}! 🌶️</h2>

<p>Hier sind <strong>3 NEUE herzhafte Rezepte SPEZIFISCH für den Ninja Blast Max</strong> als PDF!</p>

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px; margin: 25px 0; color: white;">
<h3 style="color: white; margin-top: 0;">🍽️ 3 Neue Ninja Blast Max Rezepte</h3>
<ul style="font-size: 1.1em;">
<li>🥭 <strong>Mango-Chili Smoothie</strong> (süß-pikant)</li>
<li>🥑 <strong>Avocado-Chili Dip</strong> (cremig-pikant)</li>
<li>🌶️ <strong>Geröstete Paprika-Feta Dip</strong> (Überraschung!)</li>
</ul>
</div>

<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px; margin: 20px 0;">
<h4 style="color: #856404; margin-top: 0;">⚠️ WICHTIG für Ninja Blast Max</h4>
<ul>
<li><strong>MAX FILL:</strong> 450ml (NIEMALS überschreiten!)</li>
<li><strong>MIN LIQUID:</strong> Immer zuerst Flüssigkeit einfüllen</li>
<li><strong>Programme:</strong> SMOOTHIE, BLEND, CRUSH</li>
</ul>
</div>

<div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px 20px; margin: 20px 0;">
<h4 style="color: #155724; margin-top: 0;">💡 Highlights</h4>
<ul>
<li>✅ Speziell für Ninja Blast Max (nicht für andere Modelle!)</li>
<li>✅ Einfach zuzubereiten (LEICHT bis MITTEL)</li>
<li>✅ Mit Blast Max-spezifischen Einstellungen</li>
<li>✅ SAUBERE PDF (keine Fehler, keine Code-Fragmente!)</li>
</ul>
</div>

<p style="font-size: 1.2em;"><strong>Viel Freude beim Mixen und Genießen! 🥄</strong></p>

<p>Liebe Grüße,<br>
<strong>Dein OpenClaw Assistant</strong></p>
</body>
</html>
""",
        attachments=[{
            "filename": "ninja-blast-neue-rezepte.pdf",
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
print(f"📎 Anhang: ninja-blast-neue-rezepte.pdf ({len(pdf_data)} bytes)")
