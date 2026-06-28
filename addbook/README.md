# 📚 AddBook

**Kindle Scribe → Buchsuche → Send to Kindle**

Schreib `Buch: Titel` auf deinen Kindle Scribe, bekomm automatisch Suchergebnisse als E-Ink-optimierte Webseite, und sende Bücher mit einem Klick auf deinen Kindle.

**URL:** `addbook.steppa.online`

---

## Architektur

```
Kindle Scribe Notiz ("p-gen")
        │
        ▼
Google Drive ("Kindle Scribe" Ordner)
        │
        ▼
Cron (alle 5 Min) / POST /api/sync
        │
        ▼
addbook_sync.py
  ├─ Composio MCP → Google Drive API
  ├─ Content parsen → "Buch: TITEL" extrahieren
  ├─ Anna's Archive Suche (search.py)
  ├─ Ergebnis-JSON speichern (/srv/addbook/results/latest.json)
  ├─ Telegram-Nachricht mit Link senden
  └─ Datei in "p-gen-archiv" verschieben
        │
        ▼
Express Server (Port 3006)
  ├─ GET /          → Landing Page
  ├─ GET /r         → Ergebnisseite (E-Ink optimiert)
  ├─ POST /api/search   → Manuelle Suche
  ├─ POST /api/download → EPUB holen + an Kindle senden
  ├─ GET /api/status/:id → Download-Status
  ├─ GET /api/bookinfo   → Open Library Proxy (Klappentext)
  └─ POST /api/sync      → Sync manuell triggern
        │
        ▼
Caddy (addbook.steppa.online → localhost:3006)
```

---

## Komponenten

### 1. Express Server (`server.js`)

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/` | GET | Landing Page (E-Ink optimiert) |
| `/r` | GET | Letzte Suchergebnisse als E-Ink-optimierte HTML-Seite |
| `/api/search` | POST | Anna's Archive Suche starten, speichert nach `latest.json` |
| `/api/download` | POST | EPUB herunterladen + automatisch an Kindle senden |
| `/api/status/:id` | GET | Download-Status abfragen (queued → downloading → sending → done) |
| `/api/bookinfo` | GET | Open Library Proxy für Klappentext (CORS-frei) |
| `/api/sync` | POST | Google Drive Sync manuell triggern |
| `/health` | GET | Healthcheck |

**Port:** 3006
**Service:** `systemctl {start|stop|restart|status} addbook`

### 2. Google Drive Monitor (`addbook_sync.py`)

Überwacht den Google Drive Ordner "Kindle Scribe" auf Dateien die mit `p-gen` beginnt.

**Content-Parsing:**
```
1                    ← Seitenzahl (ignoriert)
Buch: Dune           ← Titel in gleicher Zeile
```
oder:
```
1                    ← Seitenzahl (ignoriert)
Buch:                ← nur "Buch:" in Zeile 2
Dune                 ← Titel in Zeile 3
```

**Flow:**
1. Composio MCP → Google Drive "Kindle Scribe" Ordner scannen
2. `p-gen*` Dateien finden (case-insensitive)
3. Content herunterladen (via S3-URL von Composio)
4. "Buch:" Zeile parsen → Titel extrahieren
5. Anna's Archive Suche (Python subprocess)
6. Ergebnis als JSON speichern (`/srv/addbook/results/latest.json`)
7. Telegram-Nachricht mit Link an Bastian senden
8. Datei in `p-gen-archiv` Unterordner verschieben (nicht löschen)
9. State in `.addbook_state.json` speichern (Idempotenz)

**Cron:** `*/5 * * * *` (alle 5 Minuten via `curl -X POST http://localhost:3006/api/sync`)

### 3. Anna's Archive Suche (`scraper/search.py`)

Sucht auf Anna's Archive nach Büchern. Gibt JSON-Array zurück mit:
- `md5` — Hash für Download
- `title`, `author` — Metadaten
- `format`, `size`, `language`, `year` — Details
- `coverUrl` — Cover-Bild URL
- `description` — Metadaten-String (kein Klappentext)

**Mirrors:** annas-archive.gl, .li, .pm, .org (Fallback-Chain)
**Sprache:** Standard `de`, Format `epub`

### 4. EPUB Download (`scripts/anna-browser-download.sh`)

Lädt EPUB über Libgen-Download-Links (direkte CDN-URLs).
Prüft Magic Bytes (PK\x03\x04) für valide EPUBs.

### 5. Send to Kindle (`scripts/send-to-kindle.py`)

Sendet EPUB per AgentMail an `bastianlewin_213e22@kindle.com`.
- Von Inbox: `bastians_assistent@agentmail.to`
- Amazon SES als Versand-Provider
- Dateiname wird bereinigt (keine Sonderzeichen)

### 6. Frontend (E-Ink optimiert)

**Design-Prinzipien für Kindle Scribe:**
- Weißer Hintergrund (kein Dark Mode — E-Ink kann das nicht)
- Serif-Font (Georgia) — angenehm auf E-Paper
- Kleine Cover (160×220px) — schnelles Rendering
- Große Buttons (14px Padding) — easy tippbar
- Keine Gradienten/Animationen — E-Ink kann das nicht
- Single-Column Layout — kein horizontales Scrollen
- Hoher Kontrast — schwarz auf weiß
- Kein Tailwind CDN im Frontend — reines CSS

**Funktionen:**
- Ergebnisliste mit Cover, Titel, Autor, Format, Größe
- "📥 Zu Kindle senden" Button pro Ergebnis
- "ℹ️ Mehr Infos" Button → Open Library Klappentext
- Live-Status beim Download (⏳ → 📥 → 📧 → ✅)
- Retry-Button bei Fehlern

### 7. Open Library Proxy (`/api/bookinfo`)

Server-seitiger Proxy für Open Library API (umgeht CORS-Beschränkungen).
- Versucht zuerst deutsche Edition (`language=ger`)
- Fallback auf alle Sprachen
- Liefert: Klappentext (description), Autor, Ersterscheinung, Themen

---

## Dateistruktur

```
addbook/
├── addbook.md                    # Plan
├── README.md                     # Diese Datei
├── package.json                  # Dependencies
├── server.js                     # Express Server (Port 3006)
├── addbook_sync.py               # Google Drive Monitor (Cron)
├── .addbook_state.json           # Verarbeitete Dateien
├── scraper/
│   └── search.py                 # Anna's Archive Suche
├── scripts/
│   ├── anna-browser-download.sh  # EPUB Download
│   └── send-to-kindle.py         # Kindle Versand
├── templates/
│   └── results.html              # E-Ink-optimiertes Frontend
└── logs/
    └── addbook.log               # Sync-Log

/srv/addbook/
├── results/
│   └── latest.json               # Letzte Suchergebnisse
└── epubs/
    └── *.epub                    # Temporäre Downloads
```

---

## Konfiguration

### Secrets (aus `/root/.openclaw/openclaw.json`)

| Secret | Pfad | Zweck |
|--------|------|-------|
| Telegram Bot Token | `channels.telegram.accounts.default.botToken` | Telegram-Benachrichtigung |
| AgentMail API Key | `skills.entries.agentmail.env.AGENTMAIL_API_KEY` | Kindle-Versand |

### Externe Services

| Service | Zweck | Auth |
|---------|-------|------|
| Composio MCP | Google Drive Zugriff | OAuth (`/root/.openclaw/mcp-oauth/composio-*.json`) |
| Anna's Archive | Büchersuche + Download | Keine (öffentlich) |
| Open Library | Klappentext/Infos | Keine (öffentlich) |
| AgentMail | Kindle-Versand | API Key |
| Telegram Bot | Benachrichtigung | Bot Token |

### Caddy

```caddy
addbook.steppa.online {
    reverse_proxy localhost:3006
}
```

### systemd Service

```ini
# /etc/systemd/system/addbook.service
[Unit]
Description=AddBook Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/.local/.openclaw/workspace/addbook
ExecStart=/usr/bin/node /root/.local/.openclaw/workspace/addbook/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Cron

```
*/5 * * * * curl -s -X POST http://localhost:3006/api/sync > /dev/null 2>&1
```

---

## Nutzung

### Automatisch (via Kindle Scribe)
1. Neue Notiz auf dem Kindle Scribe erstellen
2. Inhalt: `Buch: Der Name des Windes` (oder nur `Buch:` + Titel in nächster Zeile)
3. Datei wird automatisch in den "Kindle Scribe" Drive-Ordner syncen
4. Innerhalb von 5 Min: Telegram-Nachricht mit Link zu den Ergebnissen
5. Link im Kindle Browser öffnen → Ergebnisse sehen
6. "📥 Zu Kindle senden" klicken → Buch kommt auf den Kindle

### Manuell (via API)
```bash
# Suche triggern
curl -X POST http://localhost:3006/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Dune", "lang": "de", "ext": "epub"}'

# Sync triggern (prüft Drive auf neue p-gen Dateien)
curl -X POST http://localhost:3006/api/sync

# Download + Send to Kindle
curl -X POST http://localhost:3006/api/download \
  -H "Content-Type: application/json" \
  -d '{"md5": "...", "title": "Buchtitel", "author": "Autor"}'

# Status prüfen
curl http://localhost:3006/api/status/<download-id>
```

---

## Betrieb

### Befehle

```bash
# Server
systemctl start addbook
systemctl stop addbook
systemctl restart addbook
systemctl status addbook

# Logs
journalctl -u addbook -f                    # Server-Logs
tail -f /root/.local/.openclaw/workspace/addbook/logs/addbook.log  # Sync-Logs

# Cron
crontab -l | grep addbook                    # Cron prüfen

# Manueller Sync
curl -X POST http://localhost:3006/api/sync

# DNS prüfen
dig +short addbook.steppa.online
curl -s https://addbook.steppa.online/health
```

### Bekannte Probleme

1. **PDF-Dateien werden übersprungen** — Kindle Scribe kann auch PDFs erzeugen, aber die sind Binärdaten und der Parser kann "Buch:" nicht extrahieren. Workaround: Nur Text-Notizen verwenden.

2. **Open Library hat wenige deutsche Bücher** — Klappentexte kommen primär auf Englisch. Bei bekannten Titeln (Dune, Inferno etc.) gibt es oft eine englische Beschreibung.

3. **Archiv-Verschiebung fehlschlägt** — Die Google Drive API braucht manchmal die explizite Parent-ID. Workaround: Dateien werden als "processed" markiert und nicht erneut verarbeitet.

4. **DNS-Propagation** — Bei DNS-Änderungen kann es bis zu 24h dauern, bis alle Resolver aktualisiert sind. Cloudflare-Proxy beschleunigt das.

---

## Git

Lokale Commits im Workspace-Repo:
```bash
cd /root/.local/.openclaw/workspace
git log --oneline addbook/
```

---

## Technologie-Stack

| Komponente | Tech | Version |
|------------|------|---------|
| Server | Node.js + Express | 4.18+ |
| Frontend | Vanilla HTML/CSS/JS | — |
| Fonts | Georgia (System Serif) | — |
| Drive Monitor | Python 3 + Composio MCP | — |
| Suche | Python 3 + BeautifulSoup | — |
| Download | Bash + curl | — |
| Kindle Versand | Python 3 + AgentMail SDK | — |
| Reverse Proxy | Caddy | 2.x |
| DNS | Cloudflare | — |
| Service | systemd | — |
