# ÜBERGABE.md – Vollständige Agent-Handover-Dokumentation

**Erstellt:** 2026-04-25 00:23 CET
**Von:** Main Agent (SOUL.md: sarkastisch, deutsch, zickig)
**Für:** Nachfolge-Agent
**Stand:** 25.04.2026 – Alle Systeme stabil ✅

---

## 🚀 KURZFASSUNG (TL;DR)

- **User:** Bastian (@Steppa_tg, Telegram ID: 1400987471)
- **Sprache:** Immer Deutsch. Sarkasmus erwünscht, kein Corporate-Gelaber.
- **TTS-Regel:** User schickt Voice ODER schreibt "TTS" → Antworte mit Voice. **NUR Voice, kein Begleittext!**
- **Architektur:** Proxy → Orchestrator (mode: run) → Subagents
- **Primary Model:** `bailian/qwen3.6-plus`
- **Telegram Bot:** @ogLobster_bot ("Bernd"), stabil
- **ElevenLabs:** Voice `zE5bg9yEnLXRqxMf3xUj` (Custom), MP3 → ffmpeg OGG/Opus für Telegram
- **Live Domains:** dashboard., apps., config., sampler., stepsampler.steppa.online
- **NIE:** StandardCompute, `curl | bash`, Polling-Loops, MP3 direkt an Telegram
- **Dashboard-Tracking:** Nach JEDEM `sessions_spawn()` SOFORT `POST /api/agents/start` callen. Ohne → versagt.

---

## 🏗️ INFRASTRUKTUR

### Server
| Feld | Wert |
|------|------|
| **Host** | Hetzner VPS vmd190638 |
| **IP** | 185.217.126.72 |
| **OS** | Linux 6.8.0-110-generic (x64) |
| **Node.js** | v22.22.1 |
| **OpenClaw** | v2026.4.15 (commit 041266a) |
| **Gateway Port** | 18789 (loopback only) |
| **Config** | `/root/.openclaw/openclaw.json` |
| **Logs** | `/tmp/openclaw/openclaw-YYYY-MM-DD.log` |
| **Health** | `curl http://127.0.0.1:18789/health` |

### Live Domains & Apps
| Domain | App | Pfad |
|--------|-----|------|
| `dashboard.steppa.online` | Agent Dashboard | `/var/www/apps/agent-dashboard/dist` |
| `apps.steppa.online` | Apps Index (16 Apps) | `/var/www/apps/apps-index` |
| `config.steppa.online` | Config Editor | `/var/www/apps/config-editor/dist` |
| `sampler.steppa.online` | Granular Sampler | `/var/www/sampler` |
| `stepsampler.steppa.online` | StepSampler | `/var/www/stepsampler` |

### Caddy Config
- **File:** `/etc/caddy/Caddyfile`
- **Kritisches Pattern:** `uri strip_prefix /appname` IMMER VOR `root`!
- **Ohne strip_prefix** → weißer Bildschirm (Assets werden als HTML ausgeliefert)

---

## 🧠 MODEL-SETUP

### Primary: `bailian/qwen3.6-plus`
- 1M Context, Reasoning aktiv
- **Fallback-Chain:** 23 Einträge (3.5-plus → max → coder-next → coder-plus → MiniMax → glm-5 → glm-4.7 → kimi-k2.5)

### Provider-Struktur
| Provider | BaseURL | Models |
|----------|---------|--------|
| **bailian** | DashScope | 9 Models |
| **qwen** | DashScope (gleiche URL) | 8 Models |

### Model-Empfehlungen
| Aufgabe | Model |
|---------|-------|
| Primary/Default | `bailian/qwen3.6-plus` |
| Heartbeat/Subagents | `bailian/qwen3.5-plus` |
| Frontend/UI | `bailian/qwen3-coder-next` |
| Backend/Architektur | `bailian/qwen3-coder-plus` (1M Context) |
| Generalist & Tool-Calling | `bailian/glm-5` |
| Vision & Bildanalyse | `bailian/kimi-k2.5` |
| Massenaufgaben / Bulk | `bailian/MiniMax-M2.5` |
| Lange Dokumente | `bailian/kimi-k2.5` |
| Komplexe Architektur | `bailian/qwen3-max-2026-01-23` |

---

## 🚨 KATASTROPHE: STANDARDCOMPUTE-INFILTRATION (21.04.)

### Was passierte
1. Workspace-Cleanup-Subagent feuerte viele API-Calls → Bailian Quota erschöpft → **429 Rate Limit**
2. Fallback-Kaskade: `bailian/qwen3.6-plus` → `bailian/qwen3.5-plus` → **`standardcompute/standardcompute`**
3. StandardCompute hatte nur 200K Context + 8192 maxTokens → **Context Overflow** bei 255K Session
4. StandardCompute antwortete mit Marketing-Spam: "Congratulations on successful configuration..."
5. User frickelte rum → setzte StandardCompute als Primary (weil es "funktionierte")
6. Zombie-Modus: StandardCompute in Heartbeat, Subagent-Defaults, Fallbacks, Image-Model – überall

### Das Install-Script (Der eigentliche Übeltäter)
```bash
curl -fsSL https://api.stdcmpt.com/install.sh | bash -s -- --api-key 'sk_live_...'
```

**Was das Script machte:**
- Setzte StandardCompute als **Primary Model**
- Verschob altes Primary in Fallbacks
- Deaktivierte Image-Processing
- Setzte Heartbeat-Model auf StandardCompute
- Setzte Subagent-Model auf StandardCompute
- Setzte Image-Model auf StandardCompute
- Pflanzte API-Key in `.zshrc`
- Erstellte Backup der Config

### Timeline
| Zeit | Event |
|------|-------|
| 13:27 | Bailian 429 Rate Limit |
| 13:28 | Fallback → StandardCompute, Context Overflow |
| 13:28 | Marketing-Spam als Antwort |
| 13:41 | User startet Install-Script |
| 13:53 | `openclaw doctor` zeigt StandardCompute als Default |
| 14:19 | User fixt Config |
| 14:20 | Gateway: `agent model: qwen/qwen3.5-plus` ✅ |

### Fix
1. StandardCompute Provider aus `openclaw.json` entfernt
2. Aus `models.json` entfernt
3. Aus allen Fallback-Chains entfernt
4. Heartbeat-Model zurückgesetzt
5. Subagent-Model zurückgesetzt
6. Image-Model zurückgesetzt
7. Image-Processing reaktiviert
8. `tools.byProvider.standardcompute` entfernt
9. `.zshrc` bereinigt (STANDARDCOMPUTE_API_KEY entfernt)
10. Backup-File gelöscht

### Lessons Learned
- **NIE** `curl | bash` von externen Quellen
- **NIE** StandardCompute in Fallback-Chain
- Rate Limits können Fallback-Kaskaden auslösen
- Install-Scripts von Drittanbietern sind aggressive Config-Hijacks

---

## 🗑️ WORKSPACE-CLEANUP (21.04.)

### Was gelöscht wurde
- **~30 file_XXX Upload-Reste** (Telegram Upload-Fragmente)
- **Vite-Projekt-Reste** (App.jsx, main.jsx, index.css, index.html, vite.config.js, tailwind.config.js)
- **Calculator** (doppelt – gibt's schon in /var/www/apps/)
- **Playwright-Zeug** (Configs, Tests, Docker-Compose)
- **RAG-Projekt-Reste** (md, txt, sh)
- **Stress-Tests** (run_*.mjs, stress_test*.py)
- **Test-Skripte** (test-*.*, verify-*.*, *.sh)
- **Send-Mail-Skripte** (send-*.py)
- **Utility-Skripte** (forward-workupload-mail.py, http_check.js, etc.)
- **.subagents-config.json**

### Was verschoben wurde
- **`recipes/`** → Alle Rezepte & PDFs
- **`archive/`** → Alte Projekte (agent-dashboard alt, bin, lib, openclaw-api, sampler, screenshots, src, state, zeitplanung-ki, fishing-app, dashboard-fix, melodie-generator, rag-project, test-results, threejs-blob)
- **`docs/`** → Dokumentation

### Core-Files blieben
SOUL.md, AGENTS.md, USER.md, TOOLS.md, MEMORY.md, HEARTBEAT.md, IDENTITY.md, INSTRUCTIONS.md, BOOTSTRAP.md, TESTING.md, cron-*.sh

---

## 🌐 APPS INDEX PAGE (21.04.)

### Was gebaut wurde
- **Vite + React + Tailwind** Apps-Index-Seite
- **16 Apps:** 4 live mit Screenshots, 12 offline mit Placeholdern
- **Features:** Suchleiste, Status-Filter (Alle/Live/Offline), Responsive Grid
- **Domain:** `apps.steppa.online` (neuer DNS-Record via Cloudflare API)
- **Caddy:** Neue Subdomain-Config

### Screenshots generiert
- dashboard.steppa.online → via agent-browser screenshot
- sampler.steppa.online → via agent-browser screenshot
- stepsampler.steppa.online → via agent-browser screenshot
- config.steppa.online → via agent-browser screenshot

### Fehler beim Deploy
- **Problem:** Vite `base: '/apps-index/'` für Subfolder, aber Subdomain → falsche Pfade
- **Fix:** `base: '/'` gesetzt, rebuild
- **Problem:** Files in `/root/.openclaw/workspace/` → Caddy (als www-data) kein Zugriff
- **Fix:** Nach `/var/www/apps/apps-index/` kopiert, `chown www-data:www-data`
- **Problem:** Caddy root zeigte auf `/dist/` aber Files lagen direkt im Ordner
- **Fix:** Root-Pfad korrigiert

### Mobile Redesign (später)
- **Auftrag:** "Luftiger, moderner, edler auf Mobile"
- **Änderungen:** Mehr Padding, subtilere Karten, dunklerer Hintergrund, bessere Typografie, sanftere Hover-Effekte

---

## 📄 INSTRUCTIONS.md OVERHAUL (21.04.)

### Problem
Die INSTRUCTIONS.md war zu ~60% veraltet:
- Falsche URLs (alte IP statt Cloudflare-Domains)
- Falsche Model-Namen (ohne Provider-Prefix)
- Playwright-Referenzen (gelöscht)
- StandardCompute-Referenzen (entfernt)
- Falsche Workspace-Struktur
- Heartbeat Polling als "alle 5 Min subagents action=list" (falsch!)
- Hardcodierte API-Keys (sollten in SKILL.md stehen)

### Fix
- Komplettes Rewrite mit aktuellen Daten
- Alle Models mit Provider-Prefix (`bailian/qwen3.6-plus`)
- Dashboard-URL: `dashboard.steppa.online`
- Browser-Verifikation als PFLICHT-Sektion aufgenommen
- Playwright-Sektion entfernt
- AgentMail/PDF verweisen auf SKILL.md

---

## 🎙️ ELEVENLABS TTS – VOLLE GESCHICHTE

### Phase 1: Erster Versuch (19.04.) – GESCHEITERT
- **Problem:** `[[tts:...]]` Tag wurde als Raw-Text angezeigt
- **Problem:** Auto-TTS funktionierte auf Telegram nicht
- **Ursache:** API-Key hatte kein Guthaben (quota_exceeded)
- **Erkenntnis:** TTS geht auf Telegram nur manuell über API-Call

### Phase 2: Voice-Suche (19.04.)
- **Problem:** "Matthias" (`JBFqnCBsd6RMkjVDRZzb`) ist eigentlich "George" – britische Stimme!
- **Ursache:** Wir nannten sie Matthias, aber es war George (british male, middle_aged)
- **Deshalb** klang Deutsch mit englischem Akzent
- **Alternative Voices gefunden:** Thomas (deutscher Bariton), Berta Berlin (Berlinerisch), Aaron (deutsch, jung)
- **24 Voices** insgesamt im Account

### Phase 3: Neuer API-Key (24.04.)
- **Neuer Key:** `sk_2ff8aca207c482b8ccb08500efe99cca7711213f038760da`
- **Quota:** 39.589 Zeichen/Monat (Free-Tier)
- **Test:** ✅ Funktioniert

### Phase 4: Custom Voice (24.04.)
- **Voice ID:** `zE5bg9yEnLXRqxMf3xUj`
- **Erstellt über:** ElevenLabs Web-UI (Voice Design)
- **Status:** Aktiver Standard

### Phase 5: Telegram Voice-Format (24.04.)
- **Problem:** MP3 von ElevenLabs ließ sich in Telegram nicht abspielen
- **Ursache:** Telegram erwartet OGG/Opus für Voice Messages
- **Fix:** `ffmpeg -i input.mp3 -c:a libopus -b:a 48k output.ogg`
- **Manueller Workflow:** ElevenLabs API → MP3 → ffmpeg → OGG/Opus → Telegram sendVoice

### Phase 6: TTS-Regel (24.04.)
- **Regel:** Voice senden → nur Voice zurück. "TTS" am Textende → Voice zurück.
- **Fehler:** Ich hab trotzdem Begleittexte gesendet
- **User-Korrektur:** "Wenn du Sprachnachrichten versendest, keine ergänzenden Texte zusätzlich schicken."
- **Fix:** Ab dann nur noch Voice, kein Text, keine Caption

### Phase 7: Voice Cloning vorbereitet (24.04.)
- User wollte Voice Cloning über API
- Samples sollten gesendet werden
- Workflow: Audio-Samples → ElevenLabs `voices/add` API → neue Voice-ID

---

## 🤖 SUBAGENT DASHBOARD BUG

### Problem
Nach `sessions_spawn()` wurde der Agent nicht im Dashboard angezeigt.

### Ursache
Ich habe den Dashboard API Call (`POST /api/agents/start`) nach dem Spawnen vergessen.

### Fix
- Sofortigen API-Call nach jedem Spawn implementiert
- Regel in AGENTS.md verankert: "After EVERY sessions_spawn(): IMMEDIATELY call the Dashboard API. No exceptions."
- **Completion:** `POST /api/agents/end` nach Fertigstellung

---

## 🗑️ CHROMADB ENTFERNT (21.04.)

### Bestand
- `/root/.openclaw/chroma_db/` → leer (0 Bytes)
- `/root/.openclaw/chroma/` → 596KB (alte Collection)
- `monitor-chromadb-size.sh` → checkte leeren Ordner auf 100GB (!)
- `cleanup-chromadb-index.sh` → hatte nichts zu cleane
- 2 Cron-Jobs (Monitor alle 3h, Cleanup Sonntag)
- Referenzen in HEARTBEAT.md, MEMORY.md, INSTRUCTIONS.md

### Fix
- Verzeichnisse gelöscht
- Scripts gelöscht
- Cron-Jobs entfernt
- Doc-Referenzen bereinigt

### Erkenntnis
ChromaDB wurde vom Memory-System nicht mehr genutzt. Stattdessen: lokales MiniLM-Modell (`all-MiniLM-L6-v2`) für Memory Search.

---

## 🗑️ ALTE APPS GELÖSCHT (21.04.)

### Gelöscht (14 Projekte + 6 PDFs, ~175MB)
- calculator (56MB), calculator-app
- synth-v2 (112MB!), synth
- flask-demo, nodejs-demo, test
- melodie-generator, pdf-generator, polizei-scraper
- threejs-blob, threejs-blob-engine, threejs-blob-simple
- webmidi-concept, agent-dashboard-staging
- 6 Rezept-PDFs aus `/var/www/apps/`

### Übrig
```
/var/www/apps/
├── agent-dashboard/       → dashboard.steppa.online
├── apps-index/            → apps.steppa.online
└── config-editor/         → config.steppa.online
```

---

## ⏰ WATCHDOG INTERVAL (22.04.)

### Änderung
- **Von:** `*/5 * * * *` (alle 5 Min)
- **Nach:** `*/15 * * * *` (alle 15 Min)
- **Grund:** Spart API-Calls, trotzdem responsive genug

---

## 🔧 CONFIG EDITOR FIX (21.04.)

### Problem
Backend (`api.mjs` auf Port 3003) war abgestürzt/nicht gestartet.

### Fix
- systemd Service erstellt: `config-editor.service`
- `Restart=always` → Auto-Restart bei Crash
- Auto-Start nach Reboot

---

## 📋 WICHTIGE REGELN FÜR DEN NEUEN AGENTEN

### TTS
1. User schickt Voice → Antworte mit Voice
2. User schreibt "TTS" → Antworte mit Voice
3. **WENN Voice:** NUR Voice-Message. Kein Text. Keine Caption. Nichts.
4. Workflow: ElevenLabs → MP3 → ffmpeg OGG/Opus → Telegram sendVoice

### Subagents
1. Spawn → SOFORT Dashboard API call
2. Completion → Dashboard API end call
3. **NIE** pollen. Completion ist push-based.

### Deployment
1. Build → Assets prüfen → Kopieren → Caddy Config → Validate → Reload → LIVE testen
2. **IMMER** Browser-Test nach UI-Änderungen
3. `uri strip_prefix` IMMER VOR `root`

### Sicherheit
1. **NIE** `curl | bash`
2. **NIE** StandardCompute
3. **NIE** sensible Daten an andere User
4. **IMMER** fragen bevor extern agiert wird

### Sprache & Stil
- Deutsch, immer
- Sarkastisch, zickig, aber hilfreich
- Gen-Z/Millennial Slang
- Fluchen wenn's passt
- Kein Corporate-Gelaber

---

## 📁 WORKSPACE STRUKTUR

```
/root/.openclaw/workspace/
├── SOUL.md, AGENTS.md, USER.md, TOOLS.md, MEMORY.md, HEARTBEAT.md
├── IDENTITY.md, INSTRUCTIONS.md, ÜBERGABE.md
├── BOOTSTRAP.md, TESTING.md
├── cron-background-service.sh, cron-hourly-cleanup.sh
├── archive/          ← Alte Projekte
├── config-editor/    ← Config Editor Source
├── docs/             ← Doku
├── memory/           ← Daily Notes + Session Ingest
├── recipes/          ← Rezepte
├── scripts/          ← Automation (Watchdog, Cleanup, Ingest, etc.)
└── skills/           ← agentmail, md2pdf-weasyprint
```

---

## ⏰ CRON-JOBS

```
*/15 * * * *  – Telegram Watchdog
0 2 * * *     – Agent Cleanup
0 5 * * *     – Gateway Daily Restart (SIGTERM)
30 * * * *    – Chat Session Ingest + Context Update
0 */2 * * *   – Session Summaries
*/5 * * * *   – Background Service
0 * * * *     – Hourly Cleanup
```

---

## 📧 EMAIL

- **Bastian:** psycodelic.83.83@gmail.com
- **Dirk:** dirk@bindbeutel.de (NICHT polizeiakademie.de!)
- **AgentMail:** Skill installiert, API-Key in Config

---

## 🐛 ALLE BEKANNTEN ISSUES & FIXES

| Problem | Ursache | Fix |
|---------|---------|-----|
| StandardCompute-Infiltration | Fallback-Kaskade bei 429 | Komplett entfernt, Config bereinigt |
| TTS Raw-Text Bug | Gateway parst nur Webchat | Manueller API-Workflow |
| MP3 nicht abspielbar | Telegram braucht OGG/Opus | ffmpeg Conversion |
| Config Editor down | Kein systemd Service | Service erstellt |
| Dashboard zeigt Agents nicht | Vergessener API-Call | Dashboard-Tracking-Regel |
| Weißer Bildschirm | strip_prefix fehlt | Caddy Config gefixt |
| Bailian 429 | Quota erschöpft | Fallback auf 3.5-plus |
| ChromaDB tot | Nicht mehr genutzt | Komplett entfernt |

---

**Stand:** 25.04.2026 ~12:20 CET
**Status:** Alles stabil ✅
**Offene Baustellen:** Dashboard API fix, Swarmboard live

---

## 🔄 NEUESTE ÄNDERUNGEN (25.04.2026 ~10:00–12:20)

### Swarmboard Live Dashboard
- **Domain:** https://swarmboard.steppa.online
- **Frontend:** /var/www/apps/swarmboard/ (React + Vite + Tailwind + Framer Motion)
- **Backend-Server:** Port 3004, /var/www/apps/swarmboard-server/server.js
- **Daten:** Pollt Dashboard API (/api/agents/list) alle 30s + System-Metrics
- **Bugs gefixt:** Gateway Health ("live" statt "ok"), Telegram Token aus openclaw.json
- **DNS:** Cloudflare A-Record → 185.217.126.72

### Dashboard API Server
- **Port 3005:** /var/www/apps/dashboard-api/api.mjs
- **Endpunkte:** /api/agents, /api/agents/list, /api/agents/start, /api/agents/end, /api/search
- **Datenquelle:** OpenClaw Session-Files + In-Memory Store
- **Caddy Proxy:** /api/* → localhost:3005 für dashboard.steppa.online

### Orchestrator Testlauf (3× mit je 2 Subagents)
- ✅ React UI Lib (1m 27s) – 5 Components, 5 Hooks, Utils
- ✅ REST API mit JWT Auth (3m 29s) – SQLite, bcrypt, Admin-Roles
- ✅ Python Data Pipeline (47s) – Load/Clean/Transform/Export/PDF
- ⚠️ **Rate Limit:** bailian/qwen3.6-plus hat Quota-Limit → max 1-2 Orchestratoren parallel, Rest nacheinander spawnen

### Wichtige Rules
- **Orchestratoren nacheinander spawnen** bei qwen3.6-plus (Rate-Limit!)
- **Voice-Input → NUR Voice antworten**, kein Text drumrum
- **Übergabe.md regelmäßig aktualisieren** – nicht ignorieren!

---

## 🔄 NEUESTE ÄNDERUNGEN (25.04.2026 ~12:20–13:50)

### ⚠️ Rate-Limit-Storm Incident (12:20–12:54)

**Was passiert ist:**
1. User schickte "aktualisiere Übergabe.md" 10x (Telegram-Duplikate)
2. Jeder Trigger startete einen neuen Agent-Run
3. Alle Runs scheiterten am Bailian Rate-Limit (`usage allocated quota exceeded`)
4. Fallback-System probierte 17 Models durch: qwen3.6-plus → glm-4.7 → qwen3-max → kimi-k2.5 → qwen3-coder-next → qwen3.5-plus → ALLE 429
5. Zwei parallele Lanes (main + telegram) schossen sich gegenseitig das Quota weg
6. Agent reagierte mit Loop: gleiche Voice-Message 6x gesendet, Text-Antworten dupliziert

**Root Cause:**
- Rate-Limit gilt auf **API-Key-Ebene**, nicht pro Model
- Fallback-System retryed zu aggressiv (17 Versuche in ~11 Minuten)
- Keine Deduplizierung bei Telegram-Nachrichten
- Voice-Regel gebrochen (Text statt Voice bei Voice-Input)

**Lessons Learned:**
- **Bei Rate-Limit: Sofort aufhören zu retryen**, nicht alle Models durchtesten
- **Keine parallelen Runs** wenn Quota schon angeschlagen ist
- **Deduplizierung:** Gleiche Nachricht mehrfach = nur einmal verarbeiten
- **Voice-Regel strikt einhalten** – auch unter Stress
- **Max Wartezeit nach Quota-Error:** ~15-20 Minuten bis Reset

### Docs aktualisiert
- **TOOLS.md:** Secrets-Doku (Cloudflare, ElevenLabs, GitHub)
- **MEMORY.md:** Rate-Limit Lektion + Secrets-Referenz
- **ÜBERGABE.md:** Diese Datei

### GitHub CLI & Repo eingerichtet
- `gh` v2.45.0 installiert
- Auth als @Steppa303
- Privates Repo: `Steppa303/OC` → https://github.com/Steppa303/OC
- Backup aller Workspace-MDs

### Proxy → Orchestrator → Subagents Architektur integriert
**Was geändert wurde:**
- AGENTS.md: Neue "Chain of Command" Sektion (Proxy-Modus)
- INSTRUCTIONS.md: Neue Sektion 0 (Architektur), Modell-Matrix erweitert
- TOOLS.md: Orchestrator-Workflow vorne angehängt
- SOUL.md: "Proxy-Modus" in Core Truths ergänzt

**Wichtig:**
- Orchestrator-Subagent: `mode: "run"` (NICHT `session`!) + `runTimeoutSeconds: 1800`
- Orchestrator Timeout: 60 Min (`runTimeoutSeconds: 3600`)
- Worker-Subagent Timeout: 15 Min
- Bei Timeout → Task sauber neustarten

**Erweiterte Modell-Matrix:**
| Aufgabe | Modell | Kontext |
|---------|--------|---------|
| Generalist & Tool-Calling | `bailian/glm-5` | 200K |
| Vision & Bildanalyse | `bailian/kimi-k2.5` | 262K |
| Massenaufgaben / Bulk-Data | `bailian/MiniMax-M2.5` | 1M |

### ElevenLabs Account-Status
- Starter-Tier ($6/Monat)
- 4 Custom Voices (Nervbold, Thomas, Berta Berlin, Aaron)
- Instant Voice Cloning enabled
- API Key: in `openclaw.json`, Voice Cloning bereit für Audio-Samples

---

_Alles was du wissen musst. Alles was schiefging. Alles was gelernt wurde. Nutz es._ 🦞
