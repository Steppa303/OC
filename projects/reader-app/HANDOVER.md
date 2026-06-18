# 📋 Reader App — Handover-Dokument

**Projekt:** reader.steppa.online
**Stand:** 2026-06-18
**Autor:** Bernd (AI-Agent)

---

## 1. Was ist das?

Ein EPUB-Reader mit TTS-Vorlesefunktion. Läuft unter `reader.steppa.online`. Nutzer können EPUBs hochladen, lesen, Lesezeichen setzen und sich Kapitel vorlesen lassen.

---

## 2. Wo liegt alles?

| Komponente | Pfad / URL |
|-----------|------------|
| **Projekt-Root** | `/root/.local/.openclaw/workspace/projects/reader-app/` |
| **Frontend** | `public/` (index.html, app.js, styles.css) |
| **Backend** | `server.js` (Express) |
| **DB-Modul** | `db.js` (better-sqlite3) |
| **EPUB-Parser** | `epub-parser.js` (AdmZip + JSDOM) |
| **TTS-Service** | `tts-service.js` (ElevenLabs API) |
| **Tests** | `tests/reader.spec.js` (Playwright) |
| **EPUB-Storage** | `/srv/reader/epubs/` |
| **SQLite-DB** | `/srv/reader/reader.db` |
| **PM2 Config** | `ecosystem.config.js` |
| **Caddy Config** | `/etc/caddy/Caddyfile` |
| **API-Key** | `/root/.openclaw/openclaw.json` → `messages.tts.providers.elevenlabs.apiKey` |

---

## 3. Wie starte / stoppe ich die App?

```bash
# Status prüfen
pm2 status

# Neustart
pm2 restart reader-app

# Logs
pm2 logs reader-app --lines 50 --nostream

# Stoppen
pm2 stop reader-app

# Starten
pm2 start reader-app
```

---

## 4. Wie deploye ich Änderungen?

1. Dateien im `public/` oder `server.js` bearbeiten
2. `pm2 restart reader-app` (lädt Code neu)
3. Caddy muss nicht neu gestartet werden (reverse_proxy bleibt)

**Bei Dependency-Änderungen:**
```bash
cd /root/.local/.openclaw/workspace/projects/reader-app
npm install
pm2 restart reader-app
```

**Bei Caddy-Config-Änderungen:**
```bash
systemctl reload caddy
```

---

## 5. Wie teste ich?

### Playwright Tests (automatisiert)
```bash
cd /root/.local/.openclaw/workspace/projects/reader-app
npx playwright test --reporter=list
```

### Manuelles Testen
```bash
# Healthcheck
curl https://reader.steppa.online/health

# Bücherliste
curl https://reader.steppa.online/api/books

# TTS testen (Buch-ID anpassen!)
curl -o /tmp/test.mp3 -X POST https://reader.steppa.online/api/books/<ID>/tts \
  -H "Content-Type: application/json" \
  -d '{"chapterIndex": 0, "voiceId": "EXAVITQu4vr4xnSDxMaL"}'
```

### Agent-Browser (visuell)
```bash
agent-browser open http://localhost:3003
agent-browser screenshot /tmp/reader.png
```

---

## 6. Architektur-Kniffe die man wissen muss

### 6.1 Flex-Layout für Reader
Das Reader-Layout ist eine verschachtelte Flexbox-Struktur. **WICHTIG:** `#reader-view` hat KEIN `height: 100vh` — es nutzt `flex: 1`. Wenn man `height: 100vh` hinzufügt, wird der Player unter den Viewport geschoben (Bug dokumentiert, 2026-06-18 gefixt).

```
#app (min-height: 100vh, flex column)
├── .header (sticky top)
└── #reader-view (flex: 1, overflow: hidden)
    └── .reader-body (flex: 1, overflow: hidden)
        └── .reader-main (flex: 1, flex column, overflow: hidden)
            ├── .content-area (flex: 1, overflow-y: auto, min-height: 0)
            └── .player (flex-shrink: 0)
```

### 6.2 TTS-Fallback
Wenn ein Kapitel keinen Text hat (z.B. titlepage.xhtml), sucht der Server automatisch das nächste Kapitel mit Text. Frontend zeigt Error wenn gar nichts gefunden wird.

### 6.3 Stimmen-IDs
Die ElevenLabs-Stimmen-IDs können sich ändern. Aktuell (2026-06-18):
- `EXAVITQu4vr4xnSDxMaL` = Sarah (Default)
- `VHYWoxffK1pFlM1dtRb0` = Thomas (Deutsch)
- `CoFoB7a7PXA8RBsMHbua` = Berta Berlin (Deutsch)

Falls TTS 404返回t: Stimmen-IDs via API prüfen:
```bash
curl -s "https://api.elevenlabs.io/v1/voices" \
  -H "xi-api-key: $(cat /root/.openclaw/openclaw.json | python3 -c "import json,sys; print(json.load(sys.stdin)['messages']['tts']['providers']['elevenlabs']['apiKey'])")"
```

### 6.4 EPUB-Parser Heuristiken
- Kapitel-Erkennung: Sucht nach `h1-h3` + Prefixes (Kapitel, Chapter, Teil, Prolog, etc.)
- Cover: Über `<meta name="cover">` → `manifest` → base64 Data URL
- Nur Spine-Items werden als Kapitel gezählt (nicht alle Manifest-Items)
- Namespace-Queries in JSDOM: `dc\:` statt `[dc\:title]`

### 6.5 SQLite DB
- Pfad: `/srv/reader/reader.db`
- WAL-Modus aktiviert (besser für gleichzeitige Reads)
- Foreign Keys mit CASCADE Delete (Buch löschen → Bookmarks + TTS-History werden mit gelöscht)

---

## 7. Bekannte Probleme & Workarounds

### 7.1 EPUBs ohne Cover
Viele EPUBs haben kein eingebettetes Cover. Der Bookshelf zeigt dann einen grauen Platzhalter mit Icon. Workaround: Cover-Bild manuell als Base64 in die DB eintragen, oder Phase 2 der Roadmap umsetzen (generierte Covers).

### 7.2 Kapitel mit sehr langem Text
EPUBs mit einzelnen Kapiteln >50.000 Zeichen können bei TTS Probleme machen (ElevenLabs hat ein Zeichen-Limit pro Request). Workhard: Kapitel in Abschnitte teilen.

### 7.3 Kein User-Management
Aktuell Single-User. Jeder mit Zugang sieht alle Bücher. Kein Login, keine Isolation.

### 7.4 TTS kein echtes Streaming
Audio wird komplett in einen Blob geladen bevor es abgespielt wird. Bei langen Kapiteln kann das mehrere Sekunden dauern. Echtes Streaming wäre über MediaSource API möglich.

---

## 8. Abhängigkeiten

### Externe Services
| Service | Zweck | Ausfall-Auswirkung |
|---------|-------|-------------------|
| ElevenLabs API | TTS-Vorlesen | Kein Vorlesen, Lesen funktioniert weiter |
| Google Fonts | Inter-Font | Fallback auf System-Font |
| Let's Encrypt (via Caddy) | SSL-Zertifikat | Kein HTTPS |

### Interne Services
| Service | Zweck | Ausfall-Auswirkung |
|---------|-------|-------------------|
| PM2 | Process Manager | App startet nicht automatisch |
| Caddy | Reverse Proxy | Kein HTTPS, keine Subdomain |
| SQLite | Datenbank | Keine Bücher, keine Lesezeichen |

---

## 9. Sicherheit

- **Kein Auth:** Jeder mit URL hat Zugang
- **Kein Rate-Limiting:** Upload-Endpunkt könnte missbraucht werden
- **CORS:** Nur erlaubte Origins (localhost + steppa.online)
- **File-Upload:** Max 50MB, nur .epub (client + server validiert)
- **SQL-Injection:** Geschützt durch better-sqlite3 Prepared Statements
- **XSS:** Text wird via `textContent` escaped (nicht `innerHTML`)

---

## 10. Monitoring

### Healthcheck
```bash
curl -s https://reader.steppa.online/health
# Erwartet: "OK"
```

### PM2 Monitoring
```bash
pm2 status
pm2 monit  # Live-Monitoring
```

### Logs
```bash
pm2 logs reader-app --lines 100 --nostream
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log
```

### DB-Größe prüfen
```bash
ls -lh /srv/reader/reader.db
du -sh /srv/reader/epubs/
```

---

## 11. Recovery

### App startet nicht
```bash
pm2 status
pm2 logs reader-app --lines 50 --nostream
# Prüfe ob Port 3003 frei ist
lsof -i :3003
# Neustart
pm2 restart reader-app
```

### DB korrupt
```bash
# Backup vorhanden?
ls -la /srv/reader/reader.db*
# Wenn nein: DB neu erstellen (Datenverlust!)
rm /srv/reader/reader.db
pm2 restart reader-app
# EPUBs müssen neu hochgeladen werden
```

### ElevenLabs TTS funktioniert nicht
```bash
# API-Key prüfen
cat /root/.openclaw/openclaw.json | python3 -c "import json,sys; c=json.load(sys.stdin); print(c['messages']['tts']['providers']['elevenlabs']['apiKey'][:10])"
# Stimmen-IDs prüfen (siehe Abschnitt 6.3)
# ElevenLabs Status: https://status.elevenlabs.io
```

### Caddy / SSL-Probleme
```bash
systemctl status caddy
journalctl -u caddy --lines 50
# Config testen
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

---

## 12. Dateien die NICHT gelöscht werden sollten

| Datei | Grund |
|-------|-------|
| `/srv/reader/reader.db` | Alle Bücher, Lesezeichen, TTS-History |
| `/srv/reader/epubs/*` | Hochgeladene EPUB-Dateien |
| `/root/.openclaw/openclaw.json` | ElevenLabs API-Key |
| `/etc/caddy/Caddyfile` | SSL + Reverse Proxy Config |

---

## 13. Kontakte & Links

- **URL:** https://reader.steppa.online
- **GitHub:** — (noch kein Repo)
- **ElevenLabs Dashboard:** https://elevenlabs.io
- **PM2 Docs:** https://pm2.keymetrics.io/docs/
- **Caddy Docs:** https://caddyserver.com/docs/

---

_Handover erstellt: 2026-06-18_
