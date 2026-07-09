# 🦞 EntertainBernd – Übergabedokument

_Stand: 2026-07-09, Revision 3_

---

## 1. Überblick

**EntertainBernd** ist ein Telegram-Usenet-Bot mit Config-Menü, API-Filter und Google Drive Upload.

**Flow:**
1. `/start` → **Config-Menü** (Medientyp, Sprache, Quelle)
2. `🔍 Los, suchen!` → Bot fragt nach Suchbegriff
3. User schreibt Text → API-Suche mit `cat=`-Filter (Newznab Category IDs)
4. Ergebnisliste mit Pagination → Klick auf Zahl → Detail-Ansicht
5. Download starten → SABnzbd → Google Drive (User-abhängiger Ordner)

**Bot:** @entertainbernd_bot  
**Systemd Service:** `entertainbernd.service`  
**Logfile:** `/var/log/entertainbernd.log`  
**Projektordner:** `/root/.local/.openclaw/workspace/projects/entertainbernd/`

---

## 2. Setup & Dependencies

### Python
```bash
pip install python-telegram-bot[job-queue] requests
```

### Secrets
**Alle API-Keys liegen in** `/root/.local/.openclaw/workspace/.secrets/entertainbernd.env`:
```env
NZBHYDRA2_API_KEY=...
NZBGEEK_API_KEY=...
SABNZBD_API_KEY=...
BOT_TOKEN=...
```

**Systemd lädt die Env über:** `EnvironmentFile=/root/.local/.openclaw/workspace/.secrets/entertainbernd.env`

### Service-Management
```bash
systemctl status entertainbernd.service   # Status
systemctl restart entertainbernd.service  # Restart
systemctl stop entertainbernd.service     # Stop
```

---

## 3. Architektur & Datenfluss

```
User (Telegram) ←→ Bot (Python, PTB) ←→ NZBHydra2 API (localhost:5076)
                                       ←→ NZBGeek API (api.nzbgeek.info)
                                       ←→ SABnzbd API (localhost:8080)
                                       ←→ Google Drive API (Composio MCP via HTTPS-Direct)
```

### Phasen:
1. **Config:** `/start` → Config-Menü mit Medientyp, Sprache, Quelle → in `ctx.user_data["config"]`
2. **Suche:** User schreibt Text → Bot nutzt `cat=` aus Config → API-Suche in Hydra + Geek (je 100) → merged + dedupliziert → 10 pro Seite angezeigt
3. **Interaktion:** Inline-Keyboard mit Ergebnis-Zahlen + Pagination. `/filter` für Sprache/Quelle, `/media` für Medientyp-Wechsel
4. **Detail-Ansicht:** Klick auf Zahl → Detail mit Download-/Merken-/Back-Buttons
5. **Download:** Klick auf Download → NZB an SABnzbd → tracked in `jobs.json`
6. **Upload:** Polling alle 30s → fertige Jobs → Google Drive Upload → Video-Dateien nur

---

## 4. Features

### ✅ Config-Menü (`/start`)
```
⚙️ EntertainBernd – Suche konfigurieren
🎬 Film/Serie | 🌐 Alle Sprachen | 🔀 Beide Quellen

[🎬 Film/Serie] [🎵 Audio] [📚 Bücher] [🎮 Games] [📦 Alles]
[🇩🇪 DE] [🇬🇧 EN] [🌐 Alle]
[🌐 Geek] [🔧 Hydra] [🔀 Beide]
[🔍 Los, suchen!]
```
- Einstellungen bleiben für mehrere Suchen erhalten
- Aktive Optionen mit ✅ markiert
- Config wird in `ctx.user_data["config"]` gespeichert (nicht persistent über Bot-Restart)

### ✅ API-Kategorie-Filter (cat=)
- **Film/Serie (Default):** `cat=2000,5000` (Movies + TV)
- **Audio:** `cat=3000`
- **Bücher:** `cat=7000`
- **Games:** `cat=1000,4000` (Console + PC)
- **Alles:** kein `cat=` Parameter
- Filtert direkt auf API-Ebene, kein clientseitiges Wegwerfen mehr

### ✅ NZBGeek + NZBHydra2
- **Beide Quellen** werden parallel angefragt
- **Dedup** per normalisiertem Titel
- **100 Treffer** pro Quelle → merged max 100 Ergebnisse
- **10 pro Seite** angezeigt, Rest im Cache

### ✅ Sprachfilter
- `/filter` → Sprache + Quelle umschalten (arbeitet auf Cache, kein API-Call)
- Erkennt "German", "Deutsch", "English", "NL" etc. im Titel

### ✅ Quellenfilter
- `/filter` → Geek / Hydra / Beide

### ✅ Pagination
- 10 Ergebnisse pro Seite
- `[⬅️] [Seite 1/10] [➡️]`

### ✅ Detail-Ansicht
```
📄 Star Wars: Episode VII – The Force Awakens
🎬 Film | 🌐 Geek
📦 4.7 GB | 🇩🇪 DE | 2015

[⬇️ Download] [❤️ Merken] [🔙 Zurück]
```

### ✅ Admin-Commands (nur Bastian)
- `/allow <chat_id>` – User freischalten
- `/block <chat_id>` – User blocken
- `/users` – Whitelist anzeigen

### ✅ Google Drive Upload (v3 – HTTPS Direct)
- **Ordner pro User:**
  - **Bastian:** `usedown` (ID: `1og-crcwYkHOZK5UChUjGLGeuab2f4qzx`)
  - **Martin & andere:** `Martin` (ID: `1rGIvJJRcceMMs-GX-JQPSCiugzipnp0Q`)
- **Nur Video-Dateien** werden hochgeladen: `.mkv`, `.mp4`, `.avi`, `.mov`, `.m4v`, `.wmv`, `.webm`
- Keine Größenbeschränkung (1.4GB MKV getestet, bis 10GB konfiguriert)
- **Flow:** Temporärer HTTPS-Server mit self-signed Cert → `GOOGLEDRIVE_UPLOAD_FROM_URL` mit `verify_ssl: false`
- **600s Timeout** im MCP-Client für große Dateien
- `completed_notified.json` verhindert doppelte Uploads (persistenter Set, analog zu `failed_notified`)
- OAuth via Composio MCP (`/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json`)

---

## 5. UX-Konzept (aus chatux.md)

### Bot-Menü (geplant)
Über `bot.set_my_commands()` oder BotFather:
```
/start   – Neue Suche, Config ändern
/filter  – Sprache & Quelle filtern
/media   – Medientyp wechseln
/queue   – Laufende Downloads
/watch   – Watchlist verwalten
```

### Ergebnis-Ansicht (aktuell)
```
🔍 42/100 Treffer für: star wars

 1. 🌐 Geek 🎬 Film · 10.0 GB · Star Wars: The Mandalorian and Grogu 2026
 2. 🔧 Hydra 📺 Serie · 850 MB · Star Wars Rebels S04E22
...
10. 🔧 Hydra 📺 Serie · 1.2 GB · The Book of Boba Fett S01E05

[1] [2] [3] [4] [5] [6] [7] [8] [9] [10]
[⬅️] [Seite 1/10] [➡️]
```

**Keine Filter-Buttons in der Ergebnis-Ansicht.** Filter leben in `/filter` und `/media`.

---

## 6. Dateien & Struktur

```
projects/entertainbernd/
├── bot.py                     # Hauptbot (ca. 1750+ Zeilen)
├── allowed_users.json         # Whitelist [Bastian, Martin]
├── jobs.json                  # Tracked Downloads (nzo_id → name + chat_id)
├── failed_notified.json       # Bereits gemeldete Failed-Jobs (persistent)
├── missing_notified.json      # Jobs ohne gültigen Pfad (persistent)
├── completed_notified.json    # Bereits hochgeladene Jobs (persistent)
├── .gitignore                 # Schluckt __pycache__/, .secrets/, .env
├── entertainbernd.service     # Systemd Service Unit (in /etc/systemd/system/)
├── HANDOVER.md                # Dieses Dokument
├── chatux.md                  # UX-Konzept / Planung
└── entertainbernd-ux-plan.html # Altes UX-Diagramm (Archiv)
```

### bot.py – Key Functions

| Funktion | Zweck |
|----------|-------|
| `search_nzb(query, cat)` | NZBHydra2 API-Suche mit optionalem `cat=` |
| `search_nzbgeek(query, cat)` | NZBGeek API-Suche mit optionalem `cat=` |
| `search_all(query, cat)` | Beide Quellen + Dedup |
| `_config_to_cat()` | media_type → Newznab Category String |
| `_filter_results()` | Filtert nur noch nach Sprache + Quelle |
| `_build_config_keyboard()` | Config-Menü-Keyboard |
| `_build_full_keyboard()` | Ergebnis-Keyboard (Zahlen + Pagination) |
| `build_result_list()` | Formatiert Ergebnisse für Telegram |
| `cmd_start()` | `/start` → Config-Menü |
| `config_callback()` | Config-Buttons (media, lang, source, search) |
| `handle_search()` | Text → Suche mit cat= |
| `detail_callback()` | Detail-Ansicht bei Nummernklick |
| `filter_callback()` | Filter-Button Toggle (Sprache + Quelle) |
| `page_callback()` | Pagination |
| `button_callback()` | Download starten |
| `cmd_allow/block/users()` | Admin-Commands |
| `poll_completed()` | Background-Poll: fertige Downloads → Drive |
| `upload_file_to_drive()` | Google Drive Upload (HTTPS Direct via Composio MCP) |
| `MCPClient` | Composio MCP Client (streamable-http, 600s Timeout) |

---

## 7. API Keys & Secrets

### ⚠️ WICHTIG: Keys sind AUS bot.py ENTFERNT
Die Datei `bot.py` enthält **keine** API-Keys mehr. Alles über Umgebungsvariablen:

| Variable | Quelle | Wert in |
|----------|--------|---------|
| `BOT_TOKEN` | Telegram BotFather | `.secrets/entertainbernd.env` |
| `NZBHYDRA2_API_KEY` | NZBHydra2 Config | `.secrets/entertainbernd.env` |
| `NZBGEEK_API_KEY` | NZBGeek Account | `.secrets/entertainbernd.env` |
| `SABNZBD_API_KEY` | SABnzbd Config | `.secrets/entertainbernd.env` |
| OAuth Google Drive | Composio MCP | `/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json` |

### Env-File Sicherheit
- `.secrets/entertainbernd.env` ist **nicht im Repo** (`.gitignore`)
- Wird nur von Systemd via `EnvironmentFile` geladen
- Bot starten ohne Systemd: `env $(cat .secrets/entertainbernd.env) python3 bot.py`

---

## 8. Tech-Stack

- **Python 3.12** – Bot-Logik
- **python-telegram-bot v21+** – Telegram API (Polling, Inline-Keyboard, CallbackQuery)
- **Requests** – HTTP-Client für NZBHydra2, NZBGeek, SABnzbd, Composio MCP
- **Systemd** – Service-Management
- **Composio MCP (streamable-http)** – Google Drive API Upload
- **OpenSSL** – Self-signed Cert für temporären HTTPS-Upload-Server

---

## 9. Bekannte Issues & TODOs

### Known Issues
- Polling überlappt sich manchmal (zwei Log-Einträge pro Poll) – kein Fehler, nur Log-Rauschen
- `ctx.user_data` ist nicht persistent – bei Bot-Restart oder 24h Inaktivität ist der Cache weg
- `MAX_RESULTS = 10` aktuell – muss auf 100 hoch für bessere Filter-Ergebnisse
- **Composio MCP** hat kein Token-Refresh – wenn OAuth-Token abläuft, muss die Datei manuell erneuert werden
- Der HTTPS-Server für Uploads ist **nicht authentifiziert** – jeder der den Port kennt, könnte Dateien herunterladen (Port ist nur für ~Minuten offen während Upload)
- **completed_notified.json** muss beim Start schon existieren mit alten Job-IDs – sonst werden alte Completed-Jobs nochmal hochgeladen

### User State Keys (ctx.user_data)
| Key | Typ | Zweck |
|-----|-----|-------|
| `config` | dict | media_type, language, source |
| `last_results` | list | Alle 100 Suchergebnisse (Cache) |
| `last_query` | str | Suchbegriff |
| `filter` | dict | language, source (clientseitig) |
| `page` | int | Aktuelle Seite |
| `page_size` | int | Ergebnisse pro Seite (10) |
| `awaiting_query` | bool | Such-Modus aktiv? |

### TODOs
#### Kurzfristig
- [ ] `MAX_RESULTS` auf 100 hochsetzen (Konstante in bot.py)
- [ ] Bot-Menü setzen via `bot.set_my_commands()` (`/start`, `/filter`, `/media`, `/queue`, `/watch`)
- [ ] `/filter` Command implementieren (Sprache + Quelle umschalten, arbeitet auf Cache)
- [ ] `/media` Command implementieren (Medientyp wechseln, neuer API-Call)
- [ ] Token-Refresh für Composio MCP OAuth (wenn Token >30min alt)

#### Mittelfristig
- [ ] `/queue` Command – SABnzbd Queue-Status anzeigen
- [ ] `/watch` Command – Watchlist verwalten (Cron-Job alle 6h)
- [ ] `/history` Command – Download-History
- [ ] Multi-Select / Batch-Download

#### Langfristig
- [ ] `/stats` – Statistiken (Downloads, Speicher, Quellen)
- [ ] Session-Timeout-Handling – `ctx.user_data` leer → Meldung + /start empfehlen
- [ ] Priorität setzen (High/Low) für Queue-Einträge

---

## 10. User

| User | Chat-ID | Berechtigung | Drive-Ordner |
|------|---------|-------------|-------------|
| Bastian | 1400987471 | 👑 Admin | `usedown` |
| Martin | 1058308756 | 👤 Suche + Download | `Martin` |

---

## 11. Wichtige Befehle

```bash
# Logs live
tail -f /var/log/entertainbernd.log

# Service neu starten (nach Code-Änderungen)
systemctl restart entertainbernd.service

# Prüfen ob Keys geladen sind
tr '\0' '\n' < /proc/$(pgrep -f "entertainbernd" | head -1)/environ 2>/dev/null | grep -E "BOT_TOKEN|NZB|SAB"

# Bot manuell testen
env $(cat /root/.local/.openclaw/workspace/.secrets/entertainbernd.env) python3 /root/.local/.openclaw/workspace/projects/entertainbernd/bot.py

# Syntax-Check
python3 -c "import py_compile; py_compile.compile('bot.py', doraise=True)"

# Git-Log
cd /root/.local/.openclaw/workspace/projects/entertainbernd && git log --oneline

# State-Dateien zurücksetzen (falls nötig)
rm /root/.local/.openclaw/workspace/projects/entertainbernd/completed_notified.json
rm /root/.local/.openclaw/workspace/projects/entertainbernd/failed_notified.json
```

---

## 12. JS UI Mini App (v2)

Seit 2026-07-09 gibt es eine **Telegram Mini App** als GUI-Interface:

**URL:** `https://entertainbernd.steppa.online`
**Öffnen:** Menu Button "🦞 EntertainBernd öffnen" im Bot oder `t.me/entertainbernd_bot/app`
**HTTPS:** Cloudflare Flexible SSL (Caddy auf Port 80, Cloudflare terminiert TLS)

### Backend (Express.js, Port 3010)
| Datei | Zweck |
|-------|-------|
| `server/index.js` | Express entry, CORS, Routes, WS |
| `server/auth.js` | Telegram initData HMAC-SHA256 + JWT |
| `server/routes/search.js` | NZBHydra2 + NZBGeek federated search (unauthenticated) |
| `server/routes/download.js` | POST /api/download → SABnzbd addurl |
| `server/routes/queue.js` | GET /api/queue + POST pause/resume/cancel |
| `server/ws/queue.js` | Socket.io WebSocket polling (derzeit inaktiv) |

**Systemd:** `entertainbernd-api.service` (Port 3010, bind 0.0.0.0)
**Log:** `/var/log/entertainbernd-api.log`
**Arbeitsverzeichnis:** `jsui/`

### Frontend (React 19 + Vite + TypeScript)
| Datei | Zweck |
|-------|-------|
| `src/pages/SearchPage.tsx` | Suche (Enter zum Starten, Pills für Medientyp) |
| `src/pages/DetailPage.tsx` | Detailansicht mit Download-Button |
| `src/pages/QueuePage.tsx` | Live-Queue mit Polling (4s), Pause/Resume/Cancel |
| `src/pages/SettingsPage.tsx` | Config (Medientyp, Sprache, Quelle) |
| `src/pages/WatchlistPage.tsx` | Platzhalter |
| `src/pages/HistoryPage.tsx` | Platzhalter |
| `src/hooks/telegram.ts` | Safe Telegram WebApp wrapper (keine SDK-Abhängigkeit) |
| `src/hooks/useSearch.ts` | Search/Download hooks |
| `src/hooks/useQueue.ts` | Queue polling (4s Intervall) |
| `src/components/shared/ErrorBoundary.tsx` | Error Boundary |

**Build:** `npx vite build` → Output nach `/var/www/apps/entertainbernd/dist/`
**Bundle:** ~425KB JS, ~15KB CSS (tailwindcss v4 inlined)

### Caddy Config
```
entertainbernd.steppa.online:80 {
	route {
		reverse_proxy /api* localhost:3010
		reverse_proxy /ws* localhost:3010
		root * /var/www/apps/entertainbernd/dist
		try_files {path} /index.html
		file_server
	}
}
```
Cloudflare DNS: proxied=true (Flexible SSL)

### Besonderheiten
- **Keine @telegram-apps/sdk-react Abhängigkeit** – SDK hat in Mini App gecrasht
- `window.Telegram.WebApp.initData` direkt verwendet
- `hapticFeedback`, `backButton` etc. über safe wrapper in `telegram.ts`
- Suche per Enter, keine Auto-Suche (verhindert API-Spam)
- Backend verwendet `nzbhydra2` Docker-Hostname für NZB-Links (SAB läuft in Docker)
- Queue-API ist unauthentifiziert (Search auch), nur Download braucht JWT

### Cover Image Handling
- NZBGeek liefert Cover-URLs im `attr[].@attributes.name="coverurl"` Format
- `extractCoverUrl()` Funktion durchsucht zuerst direkte Felder (`poster`, `poster_url`, `coverurl`), dann `attr` Array (unterstützt sowohl `@attributes` von Geek als auch `attributes` von Hydra)
- Dedup merged `poster_url` (behält Cover wenn eine Quelle eine hat)
- Sortierung boostet Results mit Poster (Cover zuerst)
- Frontend: `<img onError>` → fällt auf Emoji-Placeholder zurück

## 13. Changelog

### Revision 5 (2026-07-09)
- **🔍 Cover Images gefixt:** NZBGeek liefert Cover-URLs im `attr[]` Array (nicht top-level)
- **Fix `extractCoverUrl()`:** Durchsucht `attr` Array mit `@attributes` (Geek) und `attributes` (Hydra)
- **Fix Dedup:** Überschreibt `poster_url` nicht mehr bei Hydra-First-Sort — merge jetzt Covers von Geek in Hydra-Results
- **Fix Sortierung:** Boostet Results mit `poster_url` (Cover zuerst in den Top-20)
- **Fix Frontend:** `<img onError>` Handler in ResultCard + DetailPage — bei Ladefehlern Fallback auf Emoji-Placeholder
- **Neugebuildet:** `npm run build` (dist fresh, keine alten Assets mehr)
- **Debug Logs entfernt:** search.js wieder sauber

### Revision 4 (2026-07-09)
- **JS UI Mini App hinzugefügt:** React Frontend + Express Backend
- **DNS:** `entertainbernd.steppa.online` → Cloudflare (proxied, Flexible SSL)
- **Systemd:** `entertainbernd-api.service` für Backend
- **Telegram Bot:** Menu Button auf Mini App gesetzt, Bot Commands aktualisiert
- **Queue API:** Control-Endpunkte (pause/resume/cancel) implementiert
- **Fix SABnzbd Docker:** NZB-URLs von localhost auf `nzbhydra2` umgeschrieben
- **Bugfixes:** @telegram-apps/sdk-react raus (crash in Mini App), Auth-Lock gelockert

### Revision 3 (2026-07-09)
- **Drive Upload v3:** HTTPS Direct via `GOOGLEDRIVE_UPLOAD_FROM_URL` + self-signed Cert
- **Nur Videos:** Filter auf `.mkv`, `.mp4`, `.avi`, `.mov`, `.m4v`, `.wmv`, `.webm`
- **completed_notified.json:** Verhindert doppelte Uploads (Endlosschleife gefixt)
- **600s Timeout:** Für große Dateien im MCP-Client
- **User-abhängige Ordner:** Bastian → `usedown`, Martin → `Martin`
- **Kein Workbench-Staging mehr:** Alter Flow (S3-Staging) entfernt