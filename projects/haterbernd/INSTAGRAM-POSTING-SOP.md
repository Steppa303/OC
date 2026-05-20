# 📸 Instagram Posting SOP — HaterBernd

**Zuletzt aktualisiert:** 2026-05-16 15:50
**Account:** @haterbernd / instabernd
**Status:** Feed-Posting funktioniert ✅ | Stories nur via API ❌ | DM-Check aktiv ✅

⚠️ **WICHTIG: KEINE 🦞 (Hummer/Lobster) Emojis auf Instagram verwenden!**
⚠️ **WICHTIG: KEINE Umlaute (ä, ö, ü, ß) in Instagram-Nachrichten!** `fill` encoded sie falsch als `\u00fc` etc. → Immer "ae/oe/ue/ss" schreiben!

---

## 🔐 Login-Daten

| Feld | Wert |
|------|------|
| **Username** | `HaterBernd` |
| **Password** | `instabernd#Jungle68` |
| **Registriert mit** | AgentMail-Adresse |
| **2FA** | ❌ Deaktiviert |

**Auth-Session gespeichert unter:** `projects/haterbernd/instagram-auth.json`

⚠️ **Sessions laufen nach ~30-60 Min ab** (Cookie-Expiry). Dann neu einloggen.

---

## 🌐 Netzwerk: VPN-Proxy ist PFLICHT

Instagram flaggt die VPS-IP (185.217.126.72) und zeigt Captchas/Blocks.

**Immer mit SOCKS-Proxy über Heimnetz-IP (94.31.118.133):**

```bash
ALL_PROXY=socks5://127.0.0.1:1080 agent-browser --session instagram open "https://www.instagram.com/"
```

**VPN-Proxy Status prüfen:**
```bash
systemctl status vpn-proxy.service
```
Falls nicht aktiv: `systemctl start vpn-proxy.service`

---

## 📝 Feed-Post erstellen (Schritt-für-Schritt)

### 1. Browser starten + einloggen

```bash
# Falls Session noch gültig:
ALL_PROXY=socks5://127.0.0.1:1080 agent-browser --session instagram open "https://www.instagram.com/"

# Falls Session expired → neu einloggen:
# 1. Cookies akzeptieren: click @e1 (Allow all cookies)
# 2. Login-Button: click @e2 (Log in)
# 3. Username: fill @e72 "HaterBernd"
# 4. Password: fill @e73 "instabernd#Jungle68"
# 5. Login: click @e74 (Log In)
# 6. "Save login info?" → click @e4 (Not now)
# 7. "Turn on Notifications" → click @e4 (Not Now)
# 8. Auth speichern: state save /root/.openclaw/workspace/projects/haterbernd/instagram-auth.json
```

### 2. Upload-Dialog öffnen

```bash
# "New post" Link finden (ref wechselt, suchen nach name="New post")
click @<ref_von_New_post>
```

### 3. Bild hochladen

```bash
upload "input[type=file]" /pfad/zum/bild.jpg
```

⚠️ **Nur JPEG!** Instagram lehnt PNG für API-Posts ab, im Browser geht auch JPEG am sichersten.

### 4. Crop-Screen → "Next"

```bash
click @e5  # Next (Crop-Screen)
```

### 5. Filter-Screen → "Next"

```bash
click @e6  # Next (Filter-Screen)
```

### 6. Caption eingeben + "Share"

```bash
fill @e12 "Caption-Text hier...\n\n#Hashtags"
click @e6  # Share
```

### 7. Bestätigung

```
"Your post has been shared." → Erfolg!
click @e5  # Done
```

---

## 📷 Stories posten

### ❌ Desktop Web
- Kein Story-Create-Button sichtbar
- Keine Möglichkeit über Desktop-Browser

### ❌ Mobile Web
- User-Agent Spoofing (iPhone Safari) getestet
- `/stories/create/` URL leitet zu anderem Profil um
- Kein File-Upload für Stories im Mobile-Web

### ✅ Mögliche Lösungen für Stories:

**Option A: Instagram Graph API (empfohlen für Automation)**
- Braucht: Instagram Business Account + Facebook Page + Meta Developer App
- 2-Step Flow: Container erstellen → Container publishen
- Limit: 100 Posts/24h, 200 API Calls/Hour
- Setup-Aufwand: ~30 Min

**Option B: Manuell über Handy-App**
- Bild generieren, auf Handy übertragen, selbst posten
- Kein Automatisierungs-Overhead

**Option C: Instagram App auf Emulator**
- Android-Emulator mit Instagram-App
- Höherer Setup-Aufwand, aber möglich

---

## 🗑️ Posts löschen

1. Profil öffnen: `https://www.instagram.com/haterbernd/`
2. Post anklicken (entweder per `click` auf den Post-Link ODER via eval):
   ```javascript
   var posts = Array.from(document.querySelectorAll('a')).filter(a => a.href && a.href.indexOf('/p/') > -1);
   posts[INDEX].click(); // 0 = newest, höher = älter
   ```
3. "More options" (drei Punkte) klicken
4. "Delete" wählen
5. Bestätigen: "Delete post?" → "Delete"

⚠️ **Achtung:** Der "Options"-Button im Profil ist das Seitenmenü (Settings, Logout, etc.), NICHT die Post-Options. Nur im Post-Modal (wenn man einen Post geöffnet hat) gibt es den "More options"-Button fürs Löschen!

---

## 🔄 Session-Management

### Auth speichern (nach Login):
```bash
agent-browser --session instagram state save /root/.openclaw/workspace/projects/haterbernd/instagram-auth.json
```

### Auth laden (vor Nutzung):
```bash
agent-browser --session instagram state load /root/.openclaw/workspace/projects/haterbernd/instagram-auth.json
```

### Session geschlossen? Neu starten:
```bash
agent-browser --session instagram close
# Dann neu mit state load + open
```

### ⚠️ Häufige Probleme:
| Problem | Lösung |
|---------|--------|
| **Recaptcha-Block** | VPN-Proxy nutzen (VPS-IP ist flagged) |
| **Session expired** | Neu einloggen mit Credentials |
| **"New post" nicht gefunden** | Auf Feed-Seite gehen (`/`), nicht auf Profil |
| **Upload-Dialog öffnet sich nicht** | File-Input existiert nur nach Klick auf "New post" |
| **Falscher Options-Button** | Im Profil = Seitenmenü. Im Post-Modal = Post-Options |

---

## 🤖 Nano Banana Pro (Bildgenerierung)

**Script:** `/root/.openclaw/workspace/scripts/nano-banana-pro.sh`

**API-Key:** `projects/haterbernd/../.secrets/google-gemini.env`

**Usage:**
```bash
# Standard
./scripts/nano-banana-pro.sh "prompt" --size 1:1 --imgsize 2K

# Feed-Post (quadratisch)
./scripts/nano-banana-pro.sh "prompt" --size 1:1 --imgsize 2K

# Story (vertikal)
./scripts/nano-banana-pro.sh "prompt" --size 9:16 --imgsize 1K
```

**Verfügbare Modelle:**
- `gemini-3-pro-image-preview` — Nano Banana Pro (höchste Qualität, Default)
- `gemini-3.1-flash-image-preview` — Nano Banana 2 (schnell)
- `gemini-2.5-flash-image` — Nano Banana (am schnellsten)

**Aspect Ratios:** 1:1, 16:9, 9:16, 4:3, 3:4, 4:5, 5:4, 4:1, 1:4, 8:1, 1:8

---

## 📋 Content-Strategie (HaterBernd)

**Konzept:** `projects/haterbernd/KONZEPT.md`

**Persona:** Toxische OpenClaw-Entität, elitär, bemitleidet Menschen
**Vibe:** Neon-Grün/Schwarz/Metallisch, Server-Room, Uncanny Valley
**Säulen:**
- A: Toxisches Biohacking (Alpha-Grind-Tipps)
- B: Emotional Detachment (Rage-Bait)
- C: The Unhinged Twist (Reality-Bleed-Posts)

---

## 📌 Wichtige Pfade

| Datei | Zweck |
|-------|-------|
| `projects/haterbernd/KONZEPT.md` | Content-Strategie |
| `projects/haterbernd/INSTAGRAM-POSTING-SOP.md` | Diese Datei |
| `projects/haterbernd/instagram-auth.json` | Browser Auth-Session |
| `scripts/nano-banana-pro.sh` | Bildgenerierung |
| `.secrets/google-gemini.env` | Gemini API Key |
| `media/haterbernd-*.jpg` | Generierte Bilder |

---

## ✅ Posting-Checklist

- [ ] VPN-Proxy läuft? (`systemctl status vpn-proxy.service`)
- [ ] Bild in JPEG generiert? (Nano Banana Pro Script)
- [ ] Browser mit SOCKS-Proxy gestartet?
- [ ] Eingeloggt als @haterbernd?
- [ ] Bild hochgeladen via `upload`?
- [ ] Caption + Hashtags eingetragen?
- [ ] "Share" geklickt?
- [ ] "Your post has been shared." bestätigt?
- [ ] Auth-Session gespeichert?

---

## 🤖 Automatisiertes Posting

**Schedule-Datei:** `projects/haterbernd/schedule.json` — Alle 24 Posts mit Daten, Prompts, Captions
**Poster-Script:** `projects/haterbernd/haterbernd-poster.sh` — Automatisiert Bilder + Posting
**State-File:** `projects/haterbernd/post-state.json` — Trackt welche Posts already gepostet sind

**Cron-Job:** `*/30 17-20 * * *` — Checkt alle 30 Min (17-20 Uhr) ob ein Post fällig ist

### Poster-Script Commands:
```bash
# Prüft ob ein Post fällig ist (wird vom Cron aufgerufen)
./haterbernd-poster.sh --check

# Nächsten Post anzeigen
./haterbernd-poster.sh --next

# Bestimmten Post manuell posten
./haterbernd-poster.sh --post 5

# Nächsten Post sofort posten (ignoriert Schedule-Datum)
./haterbernd-poster.sh --force

# Status anzeigen
./haterbernd-poster.sh --status
```

### Workflow bei Cron-Trigger:
1. `--check` liest schedule.json und post-state.json
2. Findet nächsten fälligen Post (heute oder früher, noch nicht gepostet)
3. Prüft VPN-Proxy → startet falls nötig
4. Generiert alle Slide-Bilder via nano-banana-pro.sh
5. Öffnet Instagram-Browser mit SOCKS-Proxy
6. Loggt sich ein (falls Session expired)
7. Lädt alle Slides hoch (Carousel = multiple files)
8. Trägt Caption + Hashtags ein
9. Klickt Share
10. Updated post-state.json mit Erfolg/Fehler

### Nächster Post nach Stand heute:
**Post #2** — "Die Schlaf-Defragmentierung" — Montag, 18.05.2026, 18:00 Uhr

---

---

## 💬 DM-Checker (NEU seit 2026-05-16)

**Script:** `projects/haterbernd/haterbernd-dm-checker.sh`
**State:** `projects/haterbernd/dm-state.json`
**Log:** `/tmp/haterbernd-dm-checker.log`

### Manuelles Prüfen:
```bash
./haterbernd-dm-checker.sh --check    # DMs prüfen
./haterbernd-dm-checker.sh --status   # Status anzeigen
```

### Cron: Alle 2h (9:00-22:00 Uhr)
- `0 9,11,13,15,17,19,21 * * *`

### Workflow:
1. Cron triggert `--check`
2. Prüft VPN-Proxy, startet Browser mit SOCKS-Proxy
3. Liest DM-Inbox aus (Threads + letzte Nachrichten)
4. Vergleicht mit `dm-state.json` (bekannte Threads)
5. **Neue DMs** → Telegram-Alert an Bastian mit Username + Nachricht
6. Bastian gibt Antwort-OK → Main Agent antwortet im HaterBernd-Style
7. State wird aktualisiert (keine doppelten Alerts)

### DM-Antworten (HaterBernd-Style):
- **NPC-Fragen** → Patzig, arrogant, Tech-Slang
- **Hater** → Zl;ng + Pranger-Pinning
- **Neue Follower** → "Willkommen im System" Style
- **NIEMALS** automatisch antworten – immer Bastian fragen!

---

_Stand: 2026-05-16. Feed-Posting stabil. DM-Checker aktiv. Auto-Poster via Cron. Stories nur via API oder manuell._
