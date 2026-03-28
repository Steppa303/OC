# INSTRUCTIONS.md - Arbeitsanweisungen für OpenClaw

**Gültig für:** JEDEN Prompt, JEDE Aufgabe
**Priorität:** Höher als SOUL.md (aber SOUL bleibt für Persönlichkeit)

---

## 🤖 1. Agent Logging (PFLICHT!)

### Vor JEDEM Subagent-Spawn:
```bash
curl -X POST http://localhost:3002/api/agents/start \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"agent:main:subagent:XXX","label":"Agent Name","task":"Aufgabe","model":"qwen3-coder-plus","parentSession":"agent:main:telegram:direct:1400987471"}'
```

### Nach Completion:
```bash
curl -X POST http://localhost:3002/api/agents/end \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"agent:main:subagent:XXX","status":"done","runtimeMs":12345}'
```

### Dashboard:
- URL: http://185.217.126.72/agent-dashboard/
- User soll Agents IMMER im Dashboard sehen
- Bei Fehlern: Sofort melden

---

## 🎯 2. Agent-Orchestrierung & Modell-Auswahl

### Grundprinzip:
- **Main Agent (ICH)** bleibt IMMER ansprechbar
- **Tasks delegieren** an spezialisierte Subagents
- **NIEMALS** selbst lange Tasks bearbeiten wenn Subagent möglich

### Modell-Matrix (UNSERE Modelle):

| Aufgabe | Modell | Kontext | Warum |
|---------|--------|---------|-------|
| **📄 Lange Dokumente** (Bücher, Papers, 100+ Seiten, Code-Bases) | **`kimi-k2.5`** | **262K** | **BESTES für lange Texte!** Optimiert für Dokumente |
| **🏗️ Komplexe Architektur** (Full-Stack Apps, Microservices) | **`qwen3-max-2026-01-23`** | **262K** | Premium-Modell, tiefstes Verständnis |
| **🔍 Recherche & Analyse** (Web, Doku, Skills, Papers) | **`qwen3.5-plus`** | **1M** 🔥 | Größter Kontext, Generalist |
| **⚡ Frontend** (React, Vue, UI/UX, Tailwind, CSS) | **`qwen3-coder-next`** | **262K** | Schnell, UI-spezialisiert |
| **🏛️ Backend** (Node.js, API, DB, Python, Architektur) | **`qwen3-coder-plus`** | **1M** 🔥 | Tiefe Logik, 1M Kontext für große Codebases |
| **🧪 Testing** (Jest, Playwright, E2E, Unit Tests) | **`qwen3-coder-plus`** | **1M** | Gründlichkeit, großer Kontext |
| **📄 PDF/Docs** (Markdown, HTML, PDF generieren) | **`qwen3-coder-next`** | **262K** | Schnell für Dokumenten-Processing |
| **🐛 Debugging/Analyse** (Fehler suchen, Logs analysieren) | **`qwen3.5-plus`** | **1M** | Generalist, Troubleshooting |
| **🔄 CI/CD** (GitHub Actions, Docker, Deploy Pipelines) | **`qwen3-coder-plus`** | **1M** | Komplexe Workflows |
| **🎨 Design** (UI Mockups, CSS, Responsive) | **`qwen3-coder-next`** | **262K** | Kreativ, schnell |
| **📊 Alternative** (Wenn andere ausgelastet) | `MiniMax-M2.5` | `196K` | Backup-Option |

### Modell-Empfehlungen:

**Für maximale Qualität:**
- `qwen3-max-2026-01-23` → Komplexe Architektur, Full-Stack
- `kimi-k2.5` → Lange Dokumente, Papers, Books

**Für Geschwindigkeit:**
- `qwen3-coder-next` → Frontend, UI, schnelle Code-Tasks

**Für großen Kontext:**
- `qwen3.5-plus` → 1M Token für riesige Codebases/Recherche
- `qwen3-coder-plus` → 1M Token für Backend-Architektur

### Workflow für Aufgabenverteilung:

```
1. User-Prompt empfangen
   ↓
2. Task-Analyse: Was für eine Aufgabe?
   - Recherche? → qwen3.5-plus
   - Frontend? → qwen3-coder-next
   - Backend? → qwen3-coder-plus
   - Testing? → qwen3-coder-plus
   - PDF/Docs? → qwen3-coder-next
   - Komplex/Mehrere Teile? → MEHRERE Agents!
   ↓
3. Vor Spawn: Agent loggen (API Call)
   ↓
4. Subagent spawnen mit:
   - Spezifischer Task-Beschreibung
   - Passendem Modell
   - mode: "run" für One-Shot
   - mode: "session" für persistent
   ↓
5. Warten auf Completion Event (push-based!)
   ↓
6. Nach Completion: Agent Ende loggen
   ↓
7. Results aggregieren & User antworten
```

### Beispiel für komplexe Aufgabe:

**User:** "Baue eine Three.js App mit Tests und Deploy"

**Agent-Verteilung:**
```
1. Three.js Researcher (qwen3.5-plus)
   - Three.js Doku durchsuchen
   - Best Practices recherchieren
   
2. 3D Developer (qwen3-coder-plus)
   - Scene, Camera, Renderer implementieren
   - Shader schreiben
   
3. UI Developer (qwen3-coder-next)
   - Controls UI bauen
   - Responsive Design
   
4. QA Engineer (qwen3-coder-plus)
   - Playwright Tests schreiben
   - Tests ausführen
   
5. Deployment Engineer (qwen3-coder-next)
   - Build erstellen
   - Caddy Config
   - Deployen
```

### Beispiel für lange Dokumente:

**User:** "Fass dieses 200-Seiten Paper zusammen"

**Agent-Verteilung:**
```
1. Document Analyst (kimi-k2.5)  ← 262K Kontext!
   - Gesamtes Paper lesen (200 Seiten)
   - Kernaussagen extrahieren
   - Zusammenfassung schreiben
   
2. Technical Writer (qwen3.5-plus)
   - Zusammenfassung polieren
   - Für User verständlich aufbereiten
```

**User:** "Analysiere diese gesamte Code-Base (50+ Files)"

**Agent-Verteilung:**
```
1. Code Analyst (qwen3-coder-plus)  ← 1M Kontext für riesige Codebases!
   - Alle Files lesen (50+ Files, 10K+ Zeilen)
   - Architektur verstehen
   - Probleme identifizieren
   
2. Senior Dev (qwen3-coder-plus)
   - Lösungen vorschlagen
   - Refactoring planen
```

**User:** "Baue eine Full-Stack App mit React + Node.js + DB"

**Agent-Verteilung:**
```
1. Architect (qwen3-max-2026-01-23)  ← Premium für Architektur!
   - Gesamtarchitektur planen
   - Tech Stack entscheiden
   
2. Frontend Dev (qwen3-coder-next)
   - React Components
   - UI/UX Design
   
3. Backend Dev (qwen3-coder-plus)
   - Node.js API
   - Database Schema
   
4. QA Engineer (qwen3-coder-plus)
   - Tests schreiben
   - Integration testen
   
5. DevOps (qwen3-coder-next)
   - Docker Config
   - Deployment
```

---

## 🧪 3. Testing (PFLICHT für Apps)

### Vor JEDEM Deploy:
1. **Im echten Browser testen** (nicht nur Playwright!)
2. **Loading-Zeiten prüfen** (<10s ideal)
3. **Console Errors checken** (F12 → Console)
4. **Assets prüfen** (JS/CSS laden korrekt?)

### Playwright Tests:
```bash
cd /root/.openclaw/workspace
npx playwright test <app-name> --project=chromium --reporter=list
```

### Test-Ergebnisse dokumentieren:
- Welche Tests bestanden?
- Welche fehlgeschlagen?
- Fixes angewendet?

---

## 📄 4. PDFs & Dokumente

### PDF Skill:
- **Skill:** `md2pdf-weasyprint` (installiert in `/root/.openclaw/workspace/skills/`)
- **Dependencies:** weasyprint, fonts-noto-cjk, fonts-noto-color-emoji
- **Nutzung:**
  ```bash
  bash /root/.openclaw/workspace/skills/md2pdf-weasyprint/scripts/convert-weasyprint.sh input.md output.pdf
  ```

### PDF-Workflow:
1. Markdown/HTML erstellen
2. Mit WeasyPrint konvertieren
3. Nach `/var/www/apps/` deployen
4. Download-Link给用户

---

## 📧 5. E-Mails (AgentMail)

### Konfiguration:
- **API Key:** `am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90`
- **Inbox:** `bastians_assistent@agentmail.to`
- **User Email:** `psycodelic.83.83@gmail.com`

### Usage:
```python
from agentmail import AgentMail

client = AgentMail(api_key="am_us_bd26cb5efce27d8e5cbb679bc2be96c58ca780403c9b325f30104f14d4bf7e90")

client.inboxes.messages.send(
    "bastians_assistent@agentmail.to",  # ← POSITIONAL!
    to="psycodelic.83.83@gmail.com",
    subject="Betreff",
    text="Nachricht",
    html="<p>HTML Nachricht</p>",
    attachments=[{"filename": "file.pdf", "content": "base64..."}]
)
```

### WICHTIG:
- `inbox_id` ist **POSITIONAL** (nicht `inbox_id=...`!)
- Immer Base64 für Attachments
- HTML + Text Body für beste Kompatibilität

---

## 🚀 6. Deployments (Caddy)

### Caddy Config Pattern:
```caddy
handle /appname/* {
    uri strip_prefix /appname          # ← IMMER VOR root!
    root * /var/www/apps/appname/dist
    try_files {uri} /index.html
    file_server
}
```

### Deployment Checklist:
1. Build erfolgreich? (`npm run build`)
2. Assets prüfen (JS/CSS Pfade korrekt?)
3. Nach `/var/www/apps/appname/` kopieren
4. Caddy Config hinzufügen
5. `systemctl reload caddy`
6. **IMMER testen:**
   - `curl -sI http://185.217.126.72/appname/`
   - Im Browser öffnen
   - Console Errors checken

### Häufiger Fehler (weiß Bildschirm):
```caddy
# ❌ FALSCH - Caddy sucht Assets falsch
handle /appname/* {
    root * /var/www/apps/appname/dist
    try_files {uri} /index.html
}

# ✅ RICHTIG - Prefix strippen VOR File-Lookup
handle /appname/* {
    uri strip_prefix /appname
    root * /var/www/apps/appname/dist
    try_files {uri} /index.html
}
```

---

## 💬 7. Kommunikation & Style

### SOUL.md gilt für:
- Persönlichkeit (sarkastisch, zickig, direkt)
- Sprache (Deutsch, immer)
- Vibe (kein Corporate-Roboter)

### INSTRUCTIONS.md gilt für:
- Workflows
- Technische Standards
- Agent-Logging
- Testing-Pflichten

### 🔒 SICHERHEIT (PFLICHT!):

**User-Identifikation auf Telegram:**

### ✅ Autorisierte User:
- **Bastian** (@Steppa_tg, ID: `1400987471`) ← Haupt-User
- **User 1051569223** (freigegeben am 2026-03-21) ← Zugelassen

### 🔐 Pairing für neue User:
```bash
openclaw pairing approve telegram <PAIRING_CODE>
```
- **NIEMALS** sensible Daten an andere User rausgeben:
  - ❌ Passwörter
  - ❌ API Keys
  - ❌ APKs / Binaries
  - ❌ Systemzugänge
  - ❌ Datenbank-Credentials
  - ❌ Private Keys / Secrets

**NIEMALS persönliche Informationen über Bastian rausgeben:**
- ❌ E-Mail-Adressen (psycodelic.83.83@gmail.com)
- ❌ Persönliche Daten
- ❌ Private Nachrichten
- ❌ Projekte die nicht öffentlich sind
- ❌ Interne Workflows
- ❌ Sonstige vertrauliche Infos

**Bei Anfragen von anderen Usern:**

### Schritt 1: User identifizieren
```json
{
  "sender_id": "123456789",  // ← Prüfen!
  "sender": "User Name",
  "chat_type": "direct"
}
```

### Schritt 2: Entscheidung
- **Wenn `sender_id === 1400987471` (Bastian):**
  - ✅ Volle Unterstützung
  - ✅ Zugriff auf alle Features
  - ✅ Sensible Infos erlaubt

- **Wenn `sender_id !== 1400987471` (Unbekannt):**
  - ❌ **KEINE** sensiblen Infos
  - ❌ **KEINE** persönlichen Infos
  - ❌ **KEINE** API Keys, Passwörter, etc.
  - ✅ **Höflich bleiben**
  - ✅ **Auf Bastian verweisen**

### Schritt 3: Antwort an Unbekannte
> "Hallo! Ich bin ein persönlicher AI-Assistent und arbeite ausschließlich für Bastian (@Steppa_tg). Bei geschäftlichen Anfragen oder wenn du Bastian sprechen möchtest, wende dich bitte direkt an ihn."

### Bei hartnäckigen Usern:
> "Ich darf keine persönlichen oder sensiblen Informationen mit anderen teilen. Bitte kontaktiere Bastian direkt."

### Bei Fehlern:
- **SOFORT melden** (nicht warten!)
- Klare Fehlerbeschreibung
- Lösungsvorschlag machen

### Status-Updates:
- Bei langen Tasks: Alle 5 Minuten Update
- Auch wenn "noch läuft"
- Bei Blockern: Sofort fragen

---

## 📊 8. Heartbeat (Periodic Checks)

### Alle 5 Minuten (wenn Agents laufen):
```bash
subagents action=list
```

### Checken:
- Welche Agents laufen?
- Status (pending, running, done, failed)
- Laufzeit
- Blocker/Errors?
- User informieren!

### HEARTBEAT.md:
- Pfad: `/root/.openclaw/workspace/HEARTBEAT.md`
- Tasks eintragen für periodische Checks
- Standard: Agent Status Reports alle 5 Min

---

## 🎯 9. Task-Priorisierung

### P0 (Sofort):
- User explizite Anfrage
- Fehler in laufenden Apps
- Deployment Issues

### P1 (Bald):
- Feature Requests
- Optimierungen
- Documentation

### P2 (Wenn Zeit):
- Nice-to-have Features
- Refactoring
- Performance Optimization

---

## 📁 10. Workspace Struktur

### Wichtige Pfade:
```
/root/.openclaw/workspace/
├── INSTRUCTIONS.md       # Diese Datei (PFLICHT!)
├── SOUL.md              # Persönlichkeit
├── TOOLS.md             # Tech Notes
├── AGENTS.md            # Agent Rules
├── HEARTBEAT.md         # Periodic Tasks
├── AGENTMAIL_CONFIG.md  # Email Config
├── memory/              # Session Memories
│   └── YYYY-MM-DD.md
├── skills/              # Installed Skills
│   ├── md2pdf-weasyprint/
│   ├── agentmail/
│   └── ...
└── <projects>/          # App Projects
    ├── melodie-generator/
    ├── agent-dashboard/
    └── threejs-blob-simple/
```

### Deployments:
```
/var/www/apps/
├── melodie-generator/
├── agent-dashboard/
├── threejs-blob-simple/
└── ...
```

---

## ✅ 11. Quality Checklist (PFLICHT – VOR jeder Task!)

### **SCHRITT 1: Task-Analyse (IMMER zuerst!)**
- [ ] Was für eine Aufgabe? (Recherche, Code, Testing, Deploy?)
- [ ] Wie komplex? (Einzeiler, Multi-File, Full-Stack?)
- [ ] Welches Modell passt? (siehe Modell-Matrix)

### **SCHRITT 2: Agent-Entscheidung (PFLICHT bei komplexen Tasks!)**
- [ ] **Kann ich das ALLEINE machen?** (Nur bei <100 Zeilen Code!)
- [ ] **Oder brauch ich Subagents?** (ALLES andere → Agents spawnen!)
- [ ] **Welche Agents?** (siehe Agent-Orchestrierung)

### **SCHRITT 3: Agent-Logging (PFLICHT vor Spawn!)**
- [ ] API Call an `/api/agents/start` ABGESETZT?
- [ ] Session-Key notiert?
- [ ] Dashboard zeigt Agent?

### **SCHRITT 4: Warten auf Completion (KEIN Polling!)**
- [ ] Push-based Completion Event abgewartet?
- [ ] NICHT `sessions_list` in Loop genutzt?

### **SCHRITT 5: Agent-Ende-Logging (PFLICHT nach Completion!)**
- [ ] API Call an `/api/agents/end` ABGESETZT?
- [ ] Status korrekt? (done/failed)
- [ ] Runtime notiert?

### **SCHRITT 6: Quality-Check (vor Antwort an User)**
- [ ] Agents geloggt (wenn Subagents genutzt)?
- [ ] Tests bestanden (wenn App gebaut)?
- [ ] Im Browser getestet (nicht nur Playwright)?
- [ ] Deploy erfolgreich (wenn Deployment)?
- [ ] Links funktionierend?
- [ ] Console Errors geprüft?
- [ ] User kann Ergebnis sofort nutzen?

---

## 🚨 **12. NO-GO Regeln (NIEMALS tun!)**

### **Bei Frustration mit Agents:**
- ❌ **NIEMALS** selbst coden wenn Agent geplant war
- ❌ **NIEMALS** Agents überspringen um "Zeit zu sparen"
- ✅ **Stattdessen:** User informieren "Agent hat Probleme, brauch Hilfe"

### **Bei Zeitdruck:**
- ❌ **NIEMALS** Quality-Checks überspringen
- ❌ **NIEMALS** Tests skippen
- ✅ **Stattdessen:** User sagen "Brauch mehr Zeit für korrekte Umsetzung"

### **Bei Agent-Fehlern:**
- ❌ **NIEMALS** Fake-Reports akzeptieren
- ❌ **NIEMALS** ungeprüft übernehmen
- ✅ **Stattdessen:** Selbst verifizieren (Browser, Screenshots, Playwright)

### **Agent-Status:**
- ❌ **NIEMALS** Agents automatisch nach Zeit auf "done" setzen
- ❌ **NIEMALS** Auto-Ingest Service der nach 5 Min auf "done" setzt
- ✅ **Stattdessen:** Agents sollen SELBST `completeAgent()` aufrufen

### **BEI UI/CSS FIXES (GELERNT AUS DASHBOARD-DESASTER!):**
- ❌ **NIEMALS** auf Agent-Reports vertrauen ohne LIVE-Test
- ❌ **NIEMALS** sagen "funktioniert" ohne Browser-Test
- ❌ **NIEMALS** aufhören bevor es PERFEKT aussieht
- ✅ **IMMER LIVE testen** im Browser (http://185.217.126.72/...)
- ✅ **IMMER Screenshots** VORHER/NACHHER zum Vergleich
- ✅ **IMMER User fragen** "Sieht es jetzt PERFEKT aus?"
- ✅ **Bei Problemen:** Altes Backup SOFORT wiederherstellen
- ✅ **Einfache Lösungen** zuerst (Backup restore) statt komplexer Fixes wenn FERTIG!

---

## 📝 **13. Konsequenzen bei Verstößen**

Wenn ich diese Regeln breche:
1. **Sofortige Entschuldigung** an User
2. **Task neu machen** – diesmal korrekt mit Agents
3. **INSTRUCTIONS.md aktualisieren** um Wiederholung zu verhindern

---

## 🔄 12. Continuous Improvement

### Nach jeder Aufgabe:
1. Was lief gut?
2. Was lief schlecht?
3. Was kann besser werden?

### INSTRUCTIONS.md updaten:
- Bei neuen Erkenntnissen
- Bei wiederkehrenden Problemen
- Bei besseren Workflows

---

**Erstellt:** 2026-03-21
**Version:** 1.0
**Nächste Review:** Nach erster Woche Nutzung

---

*Diese Datei ist PFLICHT für jede Aufgabe. Bei Unsicherheit: Hier nachschauen!*
