#!/usr/bin/env python3
import base64
from agentmail import AgentMail

api_key = "am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90"
client = AgentMail(api_key=api_key)

# PDF lesen
pdf_path = "/root/.openclaw/workspace/ninja-shake-rezept.pdf"
with open(pdf_path, "rb") as f:
    pdf_data = f.read()
    pdf_base64 = base64.b64encode(pdf_data).decode()

print("📧 Sende Ninja Shake Rezept an Bastian...")

result = client.inboxes.messages.send(
    inbox_id="bastians_assistent@agentmail.to",
    to="psycodelic.83.83@gmail.com",
    subject="🥤 Dein Ninja Mixer Shake Rezept - 'Das Wiener Schnitzel'",
    text="""Hey Bastian!

Hier ist dein Ninja Mixer Shake Rezept als PDF! 🎉

📄 Anhang: ninja-shake-rezept.pdf

Das Rezept enthält:
- 🥩 Schnitzel-Basis (200g gekochtes Schnitzel, Rinderbrühe, Semmelbrösel)
- 🍯 Hollandaise-Creme (150ml Hollandaise, Sahne, Eigelb, Zitrone)
- 🥛 Shake-Zutaten (Milch, Butter, Senf, Petersilie, Knoblauch)
- 🎯 Ninja Mixer Einstellungen (Stufen 1-3, Pulse)
- 📊 Nährwerte: ~650 kcal, 35g Protein, 25g Carbs, 48g Fett pro Shake

💡 Tipps:
- Für warme Version: Milch/Brühe erwärmen
- Für kalte Version: Mit Eiswürfeln mixen
- Konsistenz anpassen mit mehr Semmelbröseln oder Flüssigkeit

Viel Erfolg beim Mixen! 🥤

Liebe Grüße,
Dein OpenClaw Assistant
""",
    html="""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<h1 style="color: #667eea;">Hey Bastian! 🎉</h1>

<p>Hier ist dein <strong>Ninja Mixer Shake Rezept</strong> als PDF!</p>

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px; margin: 25px 0; color: white;">
<h2 style="color: white; margin-top: 0;">📄 ninja-shake-rezept.pdf</h2>

<h3>Das Rezept enthält:</h3>
<ul style="font-size: 1.1em;">
<li>🥩 <strong>Schnitzel-Basis</strong> (200g Schnitzel, Rinderbrühe, Semmelbrösel)</li>
<li>🍯 <strong>Hollandaise-Creme</strong> (150ml Hollandaise, Sahne, Eigelb, Zitrone)</li>
<li>🥛 <strong>Shake-Zutaten</strong> (Milch, Butter, Senf, Petersilie, Knoblauch)</li>
<li>🎯 <strong>Ninja Mixer Einstellungen</strong> (Stufen 1-3, Pulse)</li>
<li>📊 <strong>Nährwerte</strong>: ~650 kcal, 35g Protein, 25g Carbs, 48g Fett</li>
</ul>
</div>

<div style="background: #fffbeb; border-left: 4px solid #fbbf24; padding: 15px 20px; margin: 20px 0;">
<h3 style="color: #92400e; margin-top: 0;">💡 Tipps</h3>
<p><strong>Für warme Version:</strong> Milch und Brühe erwärmen (nicht kochen!)</p>
<p><strong>Für kalte Version:</strong> Alle Zutaten kühlen, 4-5 Eiswürfel hinzufügen</p>
<p><strong>Konsistenz anpassen:</strong> Dicker → Mehr Semmelbrösel | Dünner → Mehr Flüssigkeit</p>
</div>

<p style="font-size: 1.2em;"><strong>Viel Erfolg beim Mixen! 🥤</strong></p>

<p>Liebe Grüße,<br>
<strong>Dein OpenClaw Assistant</strong></p>
</body>
</html>
""",
    attachments=[{
        "filename": "ninja-shake-rezept.pdf",
        "content": pdf_base64
    }]
)

print("✅ E-Mail erfolgreich gesendet!")
print(f"📬 Von: bastians_assistent@agentmail.to")
print(f"📬 An: psycodelic.83.83@gmail.com")
print(f"📨 Message ID: {result.message_id}")
print(f"📎 Anhang: ninja-shake-rezept.pdf ({len(pdf_data)} bytes)")
