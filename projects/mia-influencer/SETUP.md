# 🚀 Mia Influencer – Setup-Anleitung

## Status
- ✅ Projektordner: `projects/mia-influencer/`
- ✅ Konzept + SOP + Content-Plan: Erstellt
- ✅ System Prompt Framework: 5-Layer
- ✅ schedule.json: 7 Leit-Posts
- ✅ Auto-Poster Script: Bereit
- ✅ DM-Checker: Bereit
- ✅ Health Check: Bereit
- ✅ ElevenLabs Voice: Getestet (Jessica + Laura)
- ❌ **Instagram Account: Noch nicht registriert**
- ❌ **Email Forward: Nicht automatisiert (kein Email Routing API Token)**

---

## Was du tun musst

### 1. Instagram Account registrieren
Instagram braucht eine Handynummer zur Verifizierung. Kann ich nicht vom Server machen.

1. App installieren oder browser öffnen
2. Account mit **mia@steppa.online** registrieren
3. Username: **mia_influencer_de** (oder was du willst)
4. Passwort: EIGENES wählen, dann in der Config eintragen
5. Profil-Bild + Bio hinzufügen (aus KONZEPT.md)
6. Account **1-2 Wochen warmlaufen lassen** (keine Politik, nur Follows + Likes)
7. Dann sagst du mir Bescheid, ich übernehme mit instagrapi

### 2. Email für mia@steppa.online einrichten
Cloudflare Email Routing braucht extra API Permissions. Entweder:
- Im Cloudflare Dashboard manuell einrichten: Email → Routing Rules → `mia@steppa.online` → Forward
- Oder Google Mail Catch-All nutzen, falls konfiguriert

### 3. Voice testen
Ich hab zwei Stimmen in der Pipeline:
- **Jessica (primär):** Playful, Bright, Warm – junge weibliche Stimme, gute deutsche Aussprache
- **Laura (Fallback):** Enthusiast, Quirky Attitude – etwas lebhafter

Beide getestet ✅ – funktionieren mit `eleven_multilingual_v2`
Testdateien liegen unter `/tmp/test-laura-mia.mp3` und `/tmp/test-jessica-mia.mp3`
Hör sie dir an und sag mir welche besser passt, dann fixe ich das.

### 4. Account live machen (nach deiner Registrierung)
Sobald Account existiert, update ich:
1. `scripts/mia-poster.py` → USERNAME + PASSWORD
2. `mia-influencer/CONFIG.md` → Account-Daten
3. Ersten Testpost manuell auslösen
4. Bei Erfolg: Cron-Jobs aktivieren

---

## Cron-Jobs (nach Aktivierung)

```cron
# Mia Auto-Poster – alle 30 Min zwischen 16-21 Uhr
*/30 16-21 * * * cd /root/.openclaw/workspace/projects/mia-influencer && python3 scripts/mia-poster.py >> /tmp/mia-poster.log 2>&1

# Mia DM Checker – alle 2h zwischen 9-22 Uhr
0 9,11,13,15,17,19,21 * * * cd /root/.openclaw/workspace/projects/mia-influencer && python3 scripts/mia-dm-checker.py >> /tmp/mia-dm-checker.log 2>&1

# Mia Health Check – täglich 12:00
0 12 * * * cd /root/.openclaw/workspace/projects/mia-influencer && python3 scripts/mia-health-check.py >> /tmp/mia-health.log 2>&1
```

---

## Schnellstart (wenn Account ready)

```bash
# 1. Account-Daten in Config eintragen
nano projects/mia-influencer/scripts/mia-poster.py
# USERNAME + PASSWORD setzen

# 2. Manuell testen
cd projects/mia-influencer && python3 scripts/mia-poster.py

# 3. Cron aktivieren
crontab -e
# Jobs aus dem Abschnitt oben einfügen

# 4. Status checken
python3 scripts/mia-health-check.py
```