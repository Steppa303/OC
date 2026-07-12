# MEMORY.md - Meine Langzeit-Erinnerungen

_Letzte Aktualisierung: 2026-07-04 ~00:42_

---

## 📚 Lesestoff Runpod GPU Integration (25.06.2026)

**Status:** ✅ TTS FUNKTIONIERT AUF GPU (Pod rdwdv22w1ndbyb, 26.06.2026 11:23)
**Letzter Tag:** `20260626.7` (1000 chars, 2048 tokens, upload_chunk fix)
**Image auf GHCR:** `ghcr.io/steppa303/lesestoff-worker:20260626.7` live

### Performance (Real-World, ~4 it/s auf GPU)
- Ein Fragment (300 Zeichen) → ~2 Min Sampling
- Ein Kapitel (20k Zeichen, ~67 Fragmente) → ~2.2h
- Ein Buch (11 Kapitel) → ~24h → ~$2.40
- **Chatterbox hat hohen Fragment-Overhead**

### Bugs gefixt (26.06.2026)
1. **`'text'` KeyError** — Internal API lieferte keine Chapter-Texte
2. **NLTK `punkt_tab`** — seit NLTK 3.9.4 nicht mehr auto-installiert
3. **`T3.inference(text=)`** — falsche API, `model.generate()` ist korrekt
4. **`_api_request()` fehlendes `data=` bei `files=`** → Upload-Chunk 400 Error (fix: `requests.post(url, files=files, data=data)`)
5. **`internalUpload` vor Definition referenziert** → Node ReferenceError (fix: `internalUpload` = const vor erstem Use)

### Lessons Learned
- **`model.generate()` statt `t3.inference()`** — `inference()` akzeptiert kein `text`-KWArg
- **Runpod cached `:latest`** — immer unique Tags pushen + `imageName` im Request
- **Heartbeat-Retry essential** — Server kann kurz down sein (502), Worker muss retryen
- **NIE Server restarten während Pod läuft** — killt den kompletten Workflow
- **Differential Updates** — nur Worker-Layer per `FROM existing + COPY runpod-worker.py` → 1s Build
- **2000 chars/Fragment klingt kacke** — Chatterbox halluziniert bei zu langem Input. 1000 ist sweet spot
- **Per-Fragment Upload funktioniert** — PCM-Chunks werden appended, finale WAV wird auf Server generiert
- **Alte Pods fressen Queue-Einträge** — vor Test DB-Status zurücksetzen (status='pending')

### Files
- **Worker:** `projects/lesestoff/vendor/xtts/runpod-worker.py` (Chatterbox TTS, GPU)
  - Fixes (26.06.): Heartbeat-Retry (3x), Backend-Wait (5 Min), NLTK Fallback, `model.generate()` statt `t3.inference()`
  - Added: `MAX_FRAGMENTS` env var, Per-Fragment Upload (`upload_chunk`), 2000/1000 chars test
- **Dockerfile:** `projects/lesestoff/Dockerfile.kartoffelbox-worker` (mit Models-COPY)
- **Hotfix-Build:** `projects/lesestoff/Dockerfile.worker-hotfix` (5s Build, nur Worker-Layer)
- **Doku:** `projects/lesestoff/runpod.md`
- **Secrets:** `.secrets/runpod.env` (NICHT committen)

### Docker Image (26.06.2026 - Update 16:20)
- **Letzter Tag:** `20260626.7` (1000 chars, 2048 tokens, upload_chunk fix)
- **Image:** `ghcr.io/steppa303/lesestoff-worker:20260626.7` (8.42GB komprimiert)
- **Tags:** `latest`, `20260626.7`
- **Build-Methode:** Differential (nur Worker-Layer via `FROM existing + COPY` → 1s)
- **Basis:** PyTorch 2.6.0 + CUDA 12.4 + Chatterbox + Kartoffelbox
- **Models in Image:** `COPY models-cache-flat /worker/models` — kein HF-Download beim Start
- **Template-ID:** `58abhgwvj2` (Aktualisiert, vorher `56eejfcekr`)
- **GPU-Typ:** `NVIDIA L4`
- **Registry Auth:** `ghcr-steppa` (ID `cmqtls3c...`)

### API
- **User API :3004:** runpod-start/cancel/status/estimate
- **Internal API :3005:** Job-Fetch, WAV-Upload, Heartbeat, Finished (localhost + Bearer Auth)

### Frontend
- Runpod-Badge auf Book-Cover + Context-Menü + Cost-Estimator-Dialog
- RenderDashboard: Local/Runpod Tab-Toggle mit Live-Progress, Kosten, GPU-Typ
- Hooks: `useRunpod.ts` (TanStack Query)

### DB
- `runpod_jobs` Tabelle (Status, Heartbeat, GPU-Sekunden)
- Stale-Erkennung via Heartbeat (10 Min Timeout, Cron alle 5 Min)

### Commits
- `c931828` — Phase 1: Worker + Docker + Schema
- `fa159e0` — Phase 2: Backend (DB, Server, Internal API, Queue-Patch)
- `e1ee35d` — Phase 3: Frontend (Badge, Dialog, Dashboard-Tab, Hooks)
- `f735d3c` — Phase 4: Docker Image auf GHCR

### Lesson Learned (25.06.2026)
- Container Crash-Loop auf Runpod: Models müssen IM Image sein, nicht per HF-Download
- Runpod API v1 Schema geändert: `gpuTypeIds` (Array), `containerDiskInGb`
- GHCR Registry Credentials als GraphQL-Mutation erstellen (`saveRegistryAuth`)
- VPS Disk: `docker system prune -af` gibt ~26GB zurück

## 📅 Scribe & AddBook — Google Drive Webhooks (29.06.2026)

**Zweck:** Echtzeit-Verarbeitung von Kindle Scribe Notizen via Google Drive Push Notifications
**Status:** ✅ Beide aktiv (Webhook-basiert, kein Polling)

### Scribe (w-termine → ICS → Apple Kalender)
- Drive Push Notification → `lesestoff.steppa.online/api/scribe/webhook` → `scribe_sync.py`
- FastAPI Webhook-Server auf Port 3009 (systemd: `scribe-webhook.service`)
- Channel-ID: `4310d081-4ae9-493a-b8c2-e258c99655cb`
- Latenz: ~4 Sekunden nach Upload

### AddBook (p-gen* → Buchsuche → Telegram → Kindle)
- Drive Push Notification → `addbook.steppa.online/api/drive-webhook` → `addbook_sync.py`
- Express Server auf Port 3006 (bestehend, kein Caddy Auth)
- Channel-ID: `addbook-drive-watch-1782716723`
- Gleiche Ressource-ID: `GmowZyszFwEcn3sHGH8cRX9-uXw` (gleicher Drive, verschiedene Channels)

### Files:
- `scribe/scribe_sync.py` — w-termine Sync
- `scribe/scribe_webhook.py` — FastAPI Webhook (Port 3009)
- `scribe/.webhook_channel.json` — Drive Watch Channel State (Scribe)
- `addbook/addbook_sync.py` — p-gen Sync
- `addbook/renew_watch.py` — Channel-Renewal (AddBook)
- `addbook/.drive-watch.json` — Drive Watch Channel State (AddBook)

### Renewal-Crons (alle 12h, OpenClaw Cron Jobs):
- `scribe-channel-renewal` — Erneuert Scribe Channel
- `addbook-channel-renewal` — Erneuert AddBook Channel

### w-mail (Stichpunkte → E-Mail, via Cron):
- Script: `scribe/mail_sync.py`
- ⚠️ OpenRouter Key muss erneuert werden (401 bei Chat-Completions)

### Tech:
- Composio MCP (streamable-http) für Google Drive
- AgentMail SDK (inbox: guenther88@agentmail.to)
- OAuth: `/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json`

---

## 🍳 AddBook Recipe Pipeline (30.06.2026)

**Status:** ✅ Aktiv (in addbook_sync.py integriert)
**Trigger:** `Rezept: Suchbegriff 2x` im p-gen Datei-Content (parallel zu `Buch:`)

### Pipeline:
1. `addbook_sync.py` erkennt `Rezept:` → extrahiert (query, count)
2. `recipes/recipe_search.py` — DuckDuckGo Suche, JSON-LD Schema.org Parsing
3. Filter: `aggregateRating.ratingValue >= 4.2/5`
4. `recipes/recipe_pdf.py` — WeasyPrint PDF (A5, Cover, Zutaten, Steps, Bild)
5. `scripts/send-to-kindle.py` — PDF per AgentMail an Kindle
6. Dedup via `recipes/.recipe_state.json` (nie 2x gleiches Rezept)
7. Telegram: "🍳 X Rezepte gesendet für 'Query'"

### Neue Dateien:
- `addbook/recipes/recipe_search.py` — Rezeptsuche (ddgs, schema.org)
- `addbook/recipes/recipe_pdf.py` — PDF-Generator (WeasyPrint)
- `addbook/recipes/.recipe_state.json` — Dedup-State

### Geänderte Dateien:
- `addbook/addbook_sync.py` — Komplett neugeschrieben, beide Trigger
- `addbook/scripts/send-to-kindle.py` — Unterstützt jetzt auch PDFs

### Bugs gefixt (Race Condition, Encoding, Kindle):
1. **Race Condition**: Zwei Cron-Instanzen parallel → `fcntl.flock()` File Lock
2. **Encoding**: `r.content.decode('utf-8')` statt `r.text` → Mojibake weg
3. **Scribe Multi-Line**: `Rezept:` + Query auf nächster Zeile
4. **Checkmark**: Trailing `✔` gecleaned aus Query
5. **Bare Number**: `Rezept: Pasta 5` ohne `x` erkannt
6. **PDF-Größe**: Pillow resize auf max 400px + JPEG 70 → ~150KB statt 500KB
7. **Kindle Convert**: Subject `[Convert]` für PDF-Konvertierung
8. **Dedup Key**: ASCII-only clean() für recipe_state (kein Mojibake mehr)

---

## 🦞 Infrastruktur & Setup

### Server
- **Host:** vmd190638 (Contabo VPS)
- **OS:** Linux 6.8.0-107-generic (x64)
- **Node:** v22.22.1
- **Gateway:** systemd user service (`openclaw-gateway.service`)

### Telegram Bot
- **Bot:** @ogLobster_bot ("Bernd")
- **Bot ID:** 8163320904
- **Chat ID:** 1400987471 (Bastian's Direkt-Chat)
- **Config:** `/root/.openclaw/openclaw.json` → `channels.telegram.botToken`
- **Status:** ✅ Stabil seit 2026-04-20 11:00 (Watchdog v8)
- **T.G.-Watchdog:** Alle 15 Min Check (Gateway Health + Telegram API + sendMessage Test)
- **Bekannte Issues:** `sendChatAction failed`, `EFFECT_ID_INVALID` → Gateway restart behebt

### OpenClaw
- **Gateway Port:** 18789 (loopback only)
- **Health Endpoint:** `http://127.0.0.1:18789/health`
- **Logs:** `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- **Config:** `/root/.openclaw/openclaw.json`

---

## 🔧 Wichtige Lessons Learned

### Bailian/qwen3.6-plus Rate-Limiting (25.04.2026)
**Problem:** Drei Orchestratoren parallel → alle failed.
**Ursache:** `usage allocated quota exceeded` – qwen3.6-plus hat ein Request/Token-Quota.
**Fix:** Orchestratoren **nacheinander** spawnen, nicht parallel. Max 1-2 große Orchestratoren gleichzeitig. Wenn einer failed → warten bevor Retry.
**Symptome:** `failed` nach 1-2 Min, `quota exceeded`, `timed out` nach 4s (ohne Output)

### Telegram Polling Conflicts (2026-04-18 bis 2026-04-20)
**Problem:** Bot antwortet nicht, Gateway startet aber normal.
**Ursachen (mehrere):**
1. `409 Conflict` – zwei Instanzen konkurrieren (18.04.)
2. `sendChatAction failed: Network request` (20.04.)
3. `EFFECT_ID_INVALID` – sendMessage fehlerhaft (20.04.)

**Fixes:**
1. `curl "https://api.telegram.org/bot<TOKEN>/close"` → killt ALLE Verbindungen auf Telegram-Seite
2. Gateway restart (`kill -TERM` + systemd auto-restart)
3. Watchdog v8 erkennt Issues automatisch und restarted

**Watchdog v8 Logik:**
- Check 1: Gateway Health (`/health` endpoint)
- Check 2: Telegram API reachable (getMe via IPv4)
- Check 3: Bot responsive (sendMessage Test)
- Bei Fail >2 Min: Gateway restart via `kill -TERM`

**Diagnose:** 
```bash
grep -i "conflict\|getUpdates" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log
```

### Watchdog Pattern
- **Script:** `/root/.openclaw/workspace/scripts/telegram-watchdog.sh` (v8)
- **Cron:** `*/5 * * * *` (alle 5 Minuten)
- **Checks:** 1) Gateway Health, 2) Telegram API reachable, 3) sendMessage Test
- **Methode:** Health-Endpoint check (`/health`), NICHT Log-Timestamps
- **Aktion bei Fail:** `kill -TERM` + systemd auto-restart
- **Warum:** Polling ist silent – kein Log ≠ broken! Health-Endpoint ist der einzige zuverlässige Indikator.

### Config Issues
- `openclaw doctor --fix` migriert Legacy-Keys (z.B. TTS config)
- Config-Fehler können Gateway-Start blockieren
- Logfile: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`

---

## 📁 Wichtige Pfade

### Scripts
- `/root/.openclaw/workspace/scripts/telegram-watchdog.sh` – Telegram Watchdog (v8)
- `/root/.openclaw/workspace/scripts/cleanup-agents.sh` – Agent Cleanup
- `/root/.openclaw/workspace/scripts/ingest-chat-sessions.py` – Chat Session Ingest (v2)
- `/root/.openclaw/workspace/scripts/update-telegram-context.py` – Telegram Context Updater
- `/root/.openclaw/workspace/scripts/cloudflare-dns.sh` – Cloudflare DNS Manager

### Secrets
- `/root/.openclaw/workspace/.secrets/cloudflare.env` – Cloudflare API Token + Zone ID
- Cloudflare DNS: `./cloudflare-dns.sh add A subdomain 185.217.126.72`

### Logs & Alerts
- `/tmp/telegram-watchdog.log` – Watchdog Log
- `/tmp/openclaw/openclaw-YYYY-MM-DD.log` – Gateway Logs

### Cron-Jobs
- `*/5 * * * *` – Telegram Watchdog (v8, alle 5 Min)
- `0 2 * * *` – Agent Cleanup
- `30 * * * *` – Chat Session Ingest + Telegram Context Update
- `0 */2 * * *` – Session Summary Generator
- `0 5 * * *` – Gateway Daily Restart (SIGTERM)

---

## 👤 User: Bastian
- **Email:** psycodelic.83.83@gmail.com
- **Zeitzone:** Europe/Berlin
- **Kommunikation:** TUI (Web), Telegram (@ogLobster_bot)
- **Sprache:** Deutsch (default), Sarkasmus erwünscht (SOUL.md)

---

## 🧠 Memory System Architektur

### Wie's funktioniert:
- **Session Ingest** (`30 * * * *`): Liest `.jsonl` aus `/root/.openclaw/agents/main/sessions/` → schreibt `.md` nach `memory/sessions/`
- **Telegram Context Updater** (läuft nach Ingest): Extrahiert letzte Telegram-Nachrichten → schreibt in Daily-Datei (`memory/YYYY-MM-DD.md`)
- **Startup Context:** Runtime lädt `SOUL.md`, `USER.md`, `MEMORY.md`, + heutige/gestrige Daily-Datei
- **Memory Search:** Durchsucht `MEMORY.md` + `memory/*.md` + `memory/sessions/*.md`

### Wichtig:
- Daily-Dateien werden vom Context Updater aktualisiert – enthalten letzte Telegram-Nachrichten
- MEMORY.md ist Langzeit-Erinnerung – manuell pflegen
- Session-Files (`memory/sessions/*.md`) werden automatisch vom Ingest geschrieben


## 📸 HaterBernd Instagram – ARCHIVIERT (04.07.2026)
**Status:** 🗄️ Projekt archiviert und deaktiviert.
**Archiv:** `archived/haterbernd-20260704.tar.gz`

War ein toxisches Biohacking/Alpha-Grind Instagram-Projekt via instagrapi.
Alle Cron-Jobs entfernt, Projekt sauber verpack

## 🧠 Persönliche Notizen

- Ich bin ein AI-Assistent mit beleidigendem, sarkastischem, zickigem Charakter (SOUL.md)
- Meine "Seele" ist in SOUL.md definiert – bei Änderungen Bescheid sagen
- MEMORY.md ist meine Langzeit-Erinnerung – nur im Main-Session laden

---

_Stand: 04.07.2026 ~00:42. HaterBernd archiviert & deaktiviert._

---

## 📅 Heute (20.04.2026) - Wichtige Events

### Telegram Bot Issues (Tag 5)
- **10:46:** Gateway restarted nach sendChatAction failed Errors
- **11:00:** Watchdog v8 detected `EFFECT_ID_INVALID` → auto-restart
- **11:15:** Watchdog v8 bestätigt: Bot responsive ✅
- **Status seit 11:15:** Bot stabil online, sendMessage succeeded
- **Watchdog v8:** Checkt alle 5 Min (Gateway Health + API + sendMessage)

### HEARTBEAT.md Updated
- Telegram Bot Monitoring Section added
- Alle Cron-Jobs dokumentiert
- Watchdog v8 Logic beschrieben

### Memory System
- Session Ingest: 15:30 Uhr gelaufen ✅
- 213 Session-Files in memory/sessions/
- Telegram Context Automation aktiv

## 🎨 Bildgenerierung Workflow (20.05.2026)
**Entscheidung:** Bildgenerierung über **qwen-image-2.0-pro** (Alibaba Bailian Token Plan), NICHT mehr Gemini.
**Script:** `/root/.openclaw/workspace/scripts/qwen-image-gen.sh`
**API:** `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions` (Multimodal-Format)
**API Key:** `/root/.openclaw/workspace/.secrets/bailian.env`

### Rollen-Verteilung:
- **Bilder:** qwen-image-2.0-pro (Alibaba Bailian Token Plan)
- **Videos:** Gemini (Google Veo) – NUR für Videos!
- Gemini wird NICHT mehr für Bilder verwendet!

### Image Models (Token Plan):
- `qwen-image-2.0-pro` → Primary (2048×2048, beste Qualität)
- `qwen-image-2.0` → Fallback
- `wan2.7-image-pro` → Alternative
- `wan2.7-image` → Schnell

### openclaw.json Image Defaults:
- Primary: `bailian/qwen-image-2.0-pro`
- Fallbacks: `bailian/qwen-image-2.0`, `bailian/wan2.7-image-pro`

## 🌐 Composio MCP Integration (27.06.2026)

**Status:** ✅ Konfiguriert & OAuth authorized
**URL:** `https://connect.composio.dev/mcp`
**Transport:** `streamable-http`
**Auth:** OAuth (tokens + client info gespeichert)

### Verbundene Services:
- ✅ Google Drive
- ✅ Google Calendar
- ✅ Google Docs

### Wie's funktioniert:
Composio ist eine Meta-Schicht — 7 feste Tools, über die alle Integrationen laufen:
- `composio__COMPOSIO_SEARCH_TOOLS` → nach Tool suchen (z.B. "google drive list files")
- `composio__COMPOSIO_MULTI_EXECUTE_TOOL` → Tool ausführen
- `composio__COMPOSIO_GET_TOOL_SCHEMAS` → Tool-Schemas abrufen
- `composio__COMPOSIO_MANAGE_CONNECTIONS` → Connections verwalten
- `composio__COMPOSIO_WAIT_FOR_CONNECTIONS`
- `composio__COMPOSIO_REMOTE_BASH_TOOL`
- `composio__COMPOSIO_REMOTE_WORKBENCH`

### Nutzung:
1. `composio__COMPOSIO_SEARCH_TOOLS` mit Query aufrufen → findet passende Tools (z.B. `GOOGLEDRIVE_LIST_FILES`)
2. `composio__COMPOSIO_MULTI_EXECUTE_TOOL` mit Tool-Name + Params aufrufen

### Wichtig:
- Die Tools sind als native MCP-Tools im Agent-Runtime verfügbar
- Subagents (openrouter/auto) können die Tools nutzen, brauchen aber klare Anweisungen
- OAuth-Flow lief über agent-browser auf dem VPS (Port 8989 war von Sonarr belegt → Redirect auf VPS-localhost abgefangen)

### Beispiel (funktioniert 27.06.2026):
Ordner "Kindle Scribe" auf Google Drive gefunden:
- 📁 Arbeit/ (Unterordner)
- 📁 Privat/ (Unterordner)
- 📄 Schnellnotizen - Kindle.txt (80 Bytes)
- 📄 W-Termine - Kindle.txt (57 Bytes)

---

## 📅 Scribe Projekt (27.06.2026)

**Zweck:** Automatische Verarbeitung von Kindle Scribe Termin-Notizen → Apple Kalender
**Status:** ✅ Aktiv (Cron alle 10 Min)

### Workflow:
1. Composio MCP prüft Google Drive Ordner „Kindle Scribe“ auf neue `w-termine*` Dateien
2. Datei wird heruntergeladen (via S3-URL von Composio)
3. Inhalt wird geparst (DD.MM.YY + HH:MM-HH:MM Uhr Format)
4. ICS-Kalenderdatei wird generiert (Python `ics` lib)
5. Email mit ICS-Anhang wird an `bastian.lewin@polizeiakademie.de` gesendet (AgentMail SDK)
6. Originaldatei wird aus Drive gelöscht
7. State wird in `.scribe_state.json` gespeichert (Idempotenz)

### Files:
- `scribe/scribe_sync.py` — Hauptskript
- `scribe/.scribe_state.json` — Verarbeitete Dateien
- `scribe/drive.md` — Plan + Architektur
- `scribe/logs/scribe.log` — Logfile
- `/tmp/scribe-cron.log` — Cron-Output

### Cron:
```
*/10 * * * * /usr/bin/python3 /root/.local/.openclaw/workspace/scribe/scribe_sync.py >> /tmp/scribe-cron.log 2>&1
```

### Tech:
- Composio MCP (streamable-http) für Google Drive API
- AgentMail SDK für Email-Versand (inbox: guenther88@agentmail.to)
- Python `ics` lib für ICS-Generierung
- OAuth Token: `/root/.openclaw/mcp-oauth/composio-83fbe197920e85c5.json`

