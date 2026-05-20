# 🚀 MIGRATIONSPLAN: Zeitplanungstool
## Von Firebase + Gemini API → PostgreSQL/SQLite + Qwen API

**Dokument Version:** 1.0  
**Erstellt:** 27. März 2025  
**Gesamtumfang:** 25 Arbeitstage (5 Wochen)  
**Risikoklasse:** 🔴 HOCH (Datenmigration + API-Wechsel)

---

# 📋 INHALTSVERZEICHNIS

1. [Executive Summary](#executive-summary)
2. [Ausgangslage & Analyse](#ausgangslage--analyse)
3. [Migrationsstrategie](#migrationsstrategie)
4. [Phase 1: Vorbereitung (Tag 1-5)](#phase-1-vorbereitung-tag-1-5)
5. [Phase 2: Qwen API Integration (Tag 6-10)](#phase-2-qwen-api-integration-tag-6-10)
6. [Phase 3: Datenbank Migration (Tag 11-15)](#phase-3-datenbank-migration-tag-11-15)
7. [Phase 4: Server & Frontend Migration (Tag 16-20)](#phase-4-server--frontend-migration-tag-16-20)
8. [Phase 5: Deployment & Go-Live (Tag 21-25)](#phase-5-deployment--go-live-tag-21-25)
9. [Risikomanagement](#risikomanagement)
10. [Rollback-Strategie](#rollback-strategie)
11. [Anhang: Code-Beispiele](#anhang-code-beispiele)

---

# EXECUTIVE SUMMARY

## Ziel der Migration

Das bestehende Zeitplanungstool soll von einer cloud-basierten Architektur (Firebase Firestore + Gemini API) auf eine lokale/selbstgehostete Lösung (PostgreSQL/SQLite + Qwen API via Bailian) migriert werden.

## Hauptgründe

- **Kostenkontrolle**: Firebase und Gemini API verursachen laufende Kosten
- **Datensouveränität**: Alle Daten lokal gespeichert
- **Unabhängigkeit**: Keine Abhängigkeit von Google-Diensten
- **Performance**: Lokale Datenbank = schnellere Queries

## Kern-Änderungen im Überblick

| Komponente | VORHER | NACHHER |
|------------|--------|---------|
| AI/LLM | Google Gemini API | Qwen API (Bailian) |
| Datenbank | Firebase Firestore | PostgreSQL oder SQLite |
| Storage | Firebase Storage | Lokales Dateisystem |
| Auth | Firebase Auth | JWT-basiert (optional) |
| Realtime | Firestore Listener | Polling / WebSocket |

## Aufwandsschätzung

- **Gesamtdauer:** 25 Arbeitstage (5 Wochen)
- **Kritische Pfade:** Qwen API Integration, Datenbank-Migration
- **Team:** 1-2 Entwickler
- **Risiko:** Mittel bis Hoch (API-Inkompatibilitäten, Datenverlust)

---

# AUSGANGSLAGE & ANALYSE

## Aktuelle Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                │
│  App.tsx, components/, types.ts, utils.ts                   │
└─────────────────────────────────────────────────────────────┘
         │                    │
         │ (Firestore)        │ (Gemini API)
         ▼                    ▼
┌─────────────────┐  ┌─────────────────────────────────────────┐
│  Firebase       │  │  Server (Express.js)                    │
│  - Firestore    │  │  - API Proxy zu Gemini                  │
│  - Storage      │  │  - WebSocket Proxy                      │
│  - Auth         │  │  - Rate Limiting                        │
└─────────────────┘  └─────────────────────────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Gemini API     │
                   │  (Google Cloud) │
                   └─────────────────┘
```

## Bestehende Dateien & Abhängigkeiten

### Frontend (`zeitplanung-ki/`)

| Datei | Größe | Funktion | Migrationsbedarf |
|-------|-------|----------|------------------|
| `App.tsx` | 64 KB | Hauptanwendung | 🔴 HOCH - Firebase + Gemini Calls |
| `types.ts` | 3.6 KB | TypeScript Types | 🟡 MITTEL - Anpassungen nötig |
| `utils.ts` | 5.3 KB | Helper Functions | 🟡 MITTEL - DB-Integration |
| `lib/firebase.ts` | 915 B | Firebase Config | 🔴 KRITISCH - Kompletter Ersatz |
| `services/geminiService.ts` | 29 KB | AI Service | 🔴 KRITISCH - Kompletter Ersatz |
| `services/shareService.ts` | 3.6 KB | Sharing Logic | 🟢 NIEDRIG - Minimal |

### Backend (`zeitplanung-ki/server/`)

| Datei | Größe | Funktion | Migrationsbedarf |
|-------|-------|----------|------------------|
| `server.js` | 14.7 KB | Express Server | 🔴 HOCH - Proxy anpassen |
| `package.json` | 389 B | Dependencies | 🟡 MITTEL - Neue Packages |

### Aktuelle Dependencies (package.json)

```json
{
  "dependencies": {
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "firebase": "^12.8.0",           // ← ENTFERNEN
    "@google/genai": "^1.38.0",      // ← ENTFERNEN
    "lucide-react": "^0.562.0",
    "canvas-confetti": "1.9.2",
    "postal-mime": "2.3.0",
    "pdfjs-dist": "4.0.379"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}
```

## Gemini API Calls - Detaillierte Analyse

Aus `geminiService.ts` identifiziert:

### 1. `transcribeAudio()` - Audio-Transkription
- **Modell:** `gemini-2.0-flash-exp`
- **Input:** Base64 Audio (wav/webm)
- **Output:** Transkribierter Text
- **Migration:** → Qwen Audio-Transkription ODER Whisper API

### 2. `detectOversizeRequest()` - Lokale Logik
- **Keine API-Abhängigkeit** - Regex-basiert
- **Migration:** 🟢 Unverändert übernehmen

### 3. `calculateLiquidSchedule()` - Liquid Task Flow
- **Modell:** `gemini-3-flash-preview`
- **Input:** Projekt, Stunden, Deadline, Verfügbarkeit
- **Output:** JSON Array von Phasen
- **Migration:** → Qwen Prompt (Schema-basiert)

### 4. `detectUserIntent()` - Intent Klassifizierung
- **Modell:** `gemini-3-flash-preview`
- **Output:** PROJECT | TIMEOFF | MANAGEMENT
- **Migration:** → Qwen Prompt (einfach)

### 5. `parseManagementRequest()` - Management Commands
- **Modell:** `gemini-3-flash-preview`
- **Output:** ManagementCommand JSON
- **Migration:** → Qwen Prompt (komplex)

### 6. `extractTimeOffDetails()` - Zeitabwesenheit
- **Modell:** `gemini-3-flash-preview`
- **Output:** TimeOffDetails JSON
- **Migration:** → Qwen Prompt (mittel)

### 7. `rebalanceSchedule()` - Rescheduling
- **Modell:** `gemini-3-flash-preview`
- **Input:** Urlaub, Konflikte, Auslastung
- **Output:** Neue Daten für Phasen
- **Migration:** → Qwen Prompt (komplex)

### 8. `parseProjectRequest()` - Hauptfunktion
- **Modell:** `gemini-3-flash-preview`
- **Input:** Natürlichsprachiger Prompt
- **Output:** AIPlanResponse (komplexes Schema)
- **Migration:** → Qwen Prompt (sehr komplex)

### 9. `generatePhases()` - Phasengenerierung
- **Modell:** `gemini-3-flash-preview`
- **Migration:** → Qwen Prompt

### 10. `refineProjectPlan()` - Plananpassung
- **Modell:** `gemini-3-flash-preview`
- **Migration:** → Qwen Prompt

### 11. `generateProjectDescription()` - Beschreibung
- **Modell:** `gemini-3-flash-preview`
- **Input:** Text + Bilder
- **Migration:** → Qwen Vision (falls verfügbar)

### 12. `suggestSchedule()` - Terminvorschläge
- **Modell:** `gemini-3-flash-preview`
- **Migration:** → Qwen Prompt

## Firebase Collections - Analyse

Aus `firebase.ts` und `App.tsx`:

### Erwartete Collections:

```javascript
// Users
users/{userId}
  - name: string
  - initials: string
  - color: string

// Projects
projects/{projectId}
  - userId: string
  - title: string
  - description: string
  - totalHours: number
  - startDate: string
  - deadline: string
  - createdAt: timestamp
  - updatedAt: timestamp
  - isExternal: boolean
  - location: string
  - recurrence: { isRecurring, weekDays, time }
  - confidenceScore: number
  - rationale: string

// Phases (Subcollection)
projects/{projectId}/phases/{phaseId}
  - name: string
  - hours: number
  - date: string (YYYY-MM-DD)
  - rationale: string
  - completed: boolean
  - suggestedDate: string

// Time Off
timeOff/{userId}/{timeOffId}
  - title: string
  - startDate: string
  - endDate: string
  - reason: string
```

---

# MIGRATIONSSTRATEGIE

## Ansatz: "Strangler Fig Pattern"

Statt Big-Bang-Migration wird schrittweise migriert:

1. **Neue Services parallel aufbauen** (Qwen Service, Database Layer)
2. **Feature-für-Feature umschalten** (Feature Flags)
3. **Daten synchron halten** während Übergangsphase
4. **Alte Services entfernen** nach erfolgreicher Migration

## Datenbank-Entscheidung: PostgreSQL vs. SQLite

| Kriterium | PostgreSQL | SQLite | Empfehlung |
|-----------|------------|--------|------------|
| Performance | 🔴 Hoch | 🟡 Mittel | PostgreSQL |
| Setup-Aufwand | 🔴 Hoch (Server) | 🟢 Niedrig (File) | SQLite |
| Skalierbarkeit | 🔴 Exzellent | 🟡 Begrenzt | PostgreSQL |
| Concurrent Writes | 🔴 Ja | 🟡 Eingeschränkt | PostgreSQL |
| Backup | 🔴 Tools vorhanden | 🟢 File-Copy | SQLite |
| Multi-User | 🔴 Ja | 🟡 Nein | PostgreSQL |

### Entscheidungsmatrix:

**SQLite wählen, wenn:**
- Single-User Anwendung
- Einfaches Deployment (kein DB-Server)
- < 100 GB Daten
- Keine hohen Concurrent-Write-Anforderungen

**PostgreSQL wählen, wenn:**
- Multi-User Zugriff
- Hohe Schreiblast
- Komplexe Queries
- Enterprise-Anforderungen

### Empfehlung für dieses Projekt:

**🎯 SQLite für Entwicklung & Single-User**  
**🎯 PostgreSQL für Production mit Multi-User**

Begründung: Das Tool ist primär für Einzelnutzer konzipiert. SQLite reduziert Komplexität massiv. Bei späterem Multi-User-Bedarf kann auf PostgreSQL migriert werden (Schema ist kompatibel).

---

# PHASE 1: VORBEREITUNG (TAG 1-5)

## 📅 TAG 1: Environment Setup

### Checkliste

- [ ] Node.js Version prüfen und dokumentieren
- [ ] Datenbank-Entscheidung finalisieren (SQLite empfohlen)
- [ ] Qwen API Zugang konfigurieren
- [ ] Git Repository strukturieren
- [ ] Branch-Strategie festlegen

### 1.1 Node.js Version prüfen

```bash
# Aktuelle Version prüfen
node --version
# Erwartet: v22.x.x

# npm Version prüfen
npm --version

# Im Projektverzeichnis
cd /root/.openclaw/workspace/zeitplanung-ki
cat package.json | grep -A 5 "engines"
```

**Akzeptanzkriterien:**
- Node.js v22.x installiert
- npm v10.x installiert
- Alle bestehenden Commands funktionieren (`npm run dev`, `npm run build`)

### 1.2 Datenbank-Entscheidung

**Empfehlung:** SQLite für MVP

Begründung:
- Kein separater DB-Server nötig
- File-basiert (einfache Backups)
- `better-sqlite3` Package bietet synchrone API (einfacher zu migrieren)
- Bei Bedarf später PostgreSQL-Upgrade möglich (SQL ist kompatibel)

### 1.3 Qwen API Zugang konfigurieren

#### Option A: Bailian Cloud (Empfohlen)

1. **Account erstellen:** https://bailian.console.aliyun.com/
2. **API Key generieren:**
   - Dashboard → API Keys → Create New Key
   - Key speichern als `QWEN_API_KEY`
3. **Modelle aktivieren:**
   - Qwen-Max (für komplexe Tasks)
   - Qwen-Plus (für Standard-Tasks)
   - Qwen-VL (für Bild-Analyse, falls benötigt)

#### Option B: Lokale Qwen-Installation

```bash
# Ollama (einfachste Option)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b

# API Endpoint: http://localhost:11434/api/generate
```

**Environment Variables einrichten:**

```bash
# .env.local (existiert bereits)
cp .env.local .env.local.backup

# Neue Variables hinzufügen
cat >> .env.local << EOF

# Qwen API Configuration
QWEN_API_KEY=your_api_key_here
QWEN_BASE_URL=https://api.bailian.ai/v1
QWEN_MODEL_MAX=qwen-max
QWEN_MODEL_PLUS=qwen-plus

# Database Configuration
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/zeitplanung.db

# Optional: PostgreSQL
# DATABASE_TYPE=postgresql
# DATABASE_URL=postgresql://user:password@localhost:5432/zeitplanung
EOF
```

### 1.4 Git Repository initialisieren

```bash
cd /root/.openclaw/workspace/zeitplanung-ki

# Git Status prüfen
git status

# Falls noch kein Git Repo
git init
git add .
git commit -m "Initial commit: Firebase + Gemini Version"

# Remote hinzufügen (optional)
git remote add origin https://github.com/username/zeitplanung-ki.git
```

### 1.5 Branch-Strategie

```
main (Production)
  └── develop (Integration)
      ├── feature/qwen-integration
      ├── feature/database-migration
      ├── feature/server-update
      └── feature/frontend-adaptation
```

**Commands:**

```bash
# Develop Branch erstellen
git checkout -b develop

# Feature Branches für jede Phase
git checkout -b feature/qwen-integration
git checkout -b feature/database-migration
git checkout -b feature/server-update
git checkout -b feature/frontend-adaptation
```

### Aufwand: 4-6 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Qwen API Zugang verzögert | 🟡 Mittel | 🔴 Hoch | Lokales Fallback (Ollama) vorbereiten |
| Node.js Inkompatibilität | 🟢 Niedrig | 🟡 Mittel | NVM für Version Management |
| Git Konflikte im Team | 🟡 Mittel | 🟡 Mittel | Klare Branch-Strategie kommunizieren |

---

## 📅 TAG 2-3: Code-Analyse vertiefen

### Checkliste

- [ ] Jede .ts/.tsx Datei im Detail analysieren
- [ ] Alle Gemini API Calls identifizieren und dokumentieren
- [ ] Alle Firebase Calls identifizieren und dokumentieren
- [ ] Abhängigkeitsgraph erstellen

### 2.1 File-System Analyse

```bash
# Alle TypeScript Files finden
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules

# Lines of Code pro Datei
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs wc -l
```

### 2.2 Gemini API Calls - Vollständige Liste

Basierend auf der Analyse von `geminiService.ts`:

| Funktion | Modell | Input | Output | Komplexität |
|----------|--------|-------|--------|-------------|
| `transcribeAudio` | gemini-2.0-flash-exp | Base64 Audio | String | 🟡 Mittel |
| `detectOversizeRequest` | - (lokal) | String | Boolean | 🟢 Einfach |
| `calculateLiquidSchedule` | gemini-3-flash-preview | Projekt + Slots | Phase[] | 🔴 Komplex |
| `detectUserIntent` | gemini-3-flash-preview | String | Enum | 🟢 Einfach |
| `parseManagementRequest` | gemini-3-flash-preview | String + Date | ManagementCommand | 🔴 Komplex |
| `extractTimeOffDetails` | gemini-3-flash-preview | String + Date | TimeOffDetails | 🟡 Mittel |
| `rebalanceSchedule` | gemini-3-flash-preview | Phases + Load | Reschedule[] | 🔴 Sehr komplex |
| `parseProjectRequest` | gemini-3-flash-preview | String + Date | AIPlanResponse | 🔴 Sehr komplex |
| `generatePhases` | gemini-3-flash-preview | Projekt-Info | Phase[] | 🟡 Mittel |
| `refineProjectPlan` | gemini-3-flash-preview | Projekt + Prompt | AIPlanResponse | 🔴 Komplex |
| `generateProjectDescription` | gemini-3-flash-preview | Text + Images | String | 🟡 Mittel |
| `suggestSchedule` | gemini-3-flash-preview | Phases + Dates | Schedule[] | 🟡 Mittel |

### 2.3 Firebase Calls - Vollständige Liste

Aus `App.tsx` und `firebase.ts`:

#### Firestore Reads:

```typescript
// Projects laden
db.collection('projects').where('userId', '==', userId).get()

// Einzelnes Projekt
db.collection('projects').doc(projectId).get()

// Phases (Subcollection)
db.collection('projects').doc(projectId)
  .collection('phases')
  .orderBy('date', 'asc')
  .get()

// Time Off
db.collection('timeOff').where('userId', '==', userId)
  .where('startDate', '<=', endDate)
  .where('endDate', '>=', startDate)
  .get()
```

#### Firestore Writes:

```typescript
// Neues Projekt
db.collection('projects').add({ ...data })

// Projekt updaten
db.collection('projects').doc(projectId).update({ ...data })

// Phase hinzufügen
db.collection('projects').doc(projectId)
  .collection('phases')
  .add({ ...phaseData })

// Phase updaten
db.collection('projects').doc(projectId)
  .collection('phases')
  .doc(phaseId)
  .update({ completed: true })

// Löschen
db.collection('projects').doc(projectId).delete()
```

#### Realtime Listener:

```typescript
db.collection('projects')
  .where('userId', '==', userId)
  .onSnapshot(snapshot => { ... })
```

#### Firebase Storage:

```typescript
// Upload
const storageRef = ref(storage, `audio/${filename}`);
await uploadBytes(storageRef, blob);
const url = await getDownloadURL(storageRef);

// Download
const url = await getDownloadURL(ref(storage, path));
```

### 2.4 Abhängigkeitsgraph

```
App.tsx
├── lib/firebase.ts
│   ├── firebase/app
│   ├── firebase/storage
│   └── firebase/compat/firestore
├── services/geminiService.ts
│   └── @google/genai
├── services/shareService.ts
│   └── postal-mime
├── utils.ts
│   ├── firebase (storage)
│   └── geminiService
├── components/
│   ├── ProjectCard.tsx
│   ├── PhaseList.tsx
│   └── ...
└── types.ts

server/server.js
├── express
├── axios (Proxy zu Gemini)
├── ws (WebSocket Proxy)
├── express-rate-limit
└── dotenv
```

### 2.5 Migration Priority Matrix

| Komponente | Aufwand | Risiko | Priorität | Reihenfolge |
|------------|---------|--------|-----------|-------------|
| `lib/firebase.ts` → `lib/database.ts` | 🔴 Hoch | 🔴 Hoch | 1 | Tag 11-14 |
| `services/geminiService.ts` → `services/qwenService.ts` | 🔴 Hoch | 🔴 Hoch | 2 | Tag 6-10 |
| `App.tsx` anpassen | 🟡 Mittel | 🟡 Mittel | 3 | Tag 18-19 |
| `server/server.js` anpassen | 🟡 Mittel | 🟡 Mittel | 4 | Tag 16-17 |
| `utils.ts` anpassen | 🟢 Niedrig | 🟢 Niedrig | 5 | Tag 19 |

### Aufwand: 8-12 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Versteckte Abhängigkeiten | 🟡 Mittel | 🔴 Hoch | Systematische Code-Durchsicht |
| Undokumentierte Features | 🟡 Mittel | 🟡 Mittel | User Testing einplanen |
| Third-Party Dependencies | 🟢 Niedrig | 🟡 Mittel | Alle Packages dokumentieren |

---

## 📅 TAG 4: Datenbank-Schema designen

### Checkliste

- [ ] Firebase Collections analysieren
- [ ] PostgreSQL/SQLite Schema designen
- [ ] Migration Scripts vorbereiten
- [ ] Test-Daten erstellen

### 3.1 Firebase → Relational Mapping

#### Users Table

```sql
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,           -- Firebase UID
  name VARCHAR(100) NOT NULL,
  initials VARCHAR(5) NOT NULL,
  color VARCHAR(50),                    -- HEX Color für UI
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index für schnelle Lookups
CREATE INDEX idx_users_name ON users(name);
```

#### Projects Table

```sql
CREATE TABLE projects (
  id VARCHAR(50) PRIMARY KEY,           -- UUID
  userId VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,                     -- Markdown Briefing
  totalHours INTEGER NOT NULL,
  startDate DATE NOT NULL,
  deadline DATE NOT NULL,
  
  -- Metadata
  confidenceScore INTEGER,              -- 0-100
  rationale TEXT,                       -- AI Begründung
  
  -- External Meeting
  isExternal BOOLEAN DEFAULT FALSE,
  location VARCHAR(200),
  
  -- Recurrence
  isRecurring BOOLEAN DEFAULT FALSE,
  recurringWeekDays INTEGER[],          -- [1,2,3,4,5] für Mo-Fr
  recurringTime TIME,
  
  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Key
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Indizes
CREATE INDEX idx_projects_user ON projects(userId);
CREATE INDEX idx_projects_deadline ON projects(deadline);
CREATE INDEX idx_projects_start ON projects(startDate);
CREATE INDEX idx_projects_recurring ON projects(isRecurring);
```

#### Phases Table

```sql
CREATE TABLE phases (
  id VARCHAR(50) PRIMARY KEY,           -- UUID
  projectId VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  hours INTEGER NOT NULL,
  date DATE NOT NULL,                   -- Geplantes Datum
  suggestedDate DATE,                   -- Original Vorschlag
  rationale TEXT,
  completed BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Key
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indizes für Performance
CREATE INDEX idx_phases_project ON phases(projectId);
CREATE INDEX idx_phases_date ON phases(date);
CREATE INDEX idx_phases_completed ON phases(completed);
CREATE INDEX idx_phases_project_date ON phases(projectId, date);
```

#### TimeOff Table

```sql
CREATE TABLE timeOff (
  id VARCHAR(50) PRIMARY KEY,
  userId VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  reason VARCHAR(100),                  -- Urlaub, Krank, Zeitausgleich
  
  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Key
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Indizes
CREATE INDEX idx_timeoff_user ON timeOff(userId);
CREATE INDEX idx_timeoff_dates ON timeOff(startDate, endDate);
```

#### CalendarBusy Table (für bestehende Termine)

```sql
CREATE TABLE calendarBusy (
  id VARCHAR(50) PRIMARY KEY,
  userId VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  hours INTEGER NOT NULL,
  source VARCHAR(50),                   -- 'manual', 'import', 'recurring'
  
  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Key
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Indizes
CREATE INDEX idx_calendar_user_date ON calendarBusy(userId, date);
```

### 3.2 Database Layer Architecture

```
lib/
├── database.ts           # Haupt-Database-Klasse
├── database.types.ts     # TypeScript Types für DB
├── migrations/           # Migration Scripts
│   ├── 001_initial.sql
│   └── 002_add_indexes.sql
└── seeds/               # Test-Daten
    └── seed.ts
```

### 3.3 Database Class Design

```typescript
// lib/database.ts
import Database from 'better-sqlite3';
import path from 'path';

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string = './data/zeitplanung.db') {
    // Verzeichnis erstellen falls nicht existiert
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrency
    this.initializeTables();
  }

  private initializeTables() {
    // Tables erstellen falls nicht existiert
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        initials VARCHAR(5) NOT NULL,
        color VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Weitere Tables...
    `);
  }

  // === USER METHODS ===
  
  async getUser(userId: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId) as User | null;
  }

  async createUser(user: User): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, name, initials, color)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(user.id, user.name, user.initials, user.color);
  }

  // === PROJECT METHODS ===
  
  async getProjects(userId: string): Promise<Project[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM projects 
      WHERE userId = ? 
      ORDER BY deadline ASC
    `);
    return stmt.all(userId) as Project[];
  }

  async getProject(projectId: string): Promise<Project | null> {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(projectId) as Project | null;
  }

  async createProject(project: Project): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, userId, title, description, totalHours,
        startDate, deadline, confidenceScore, rationale,
        isExternal, location, isRecurring, recurringWeekDays, recurringTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      project.id, project.userId, project.title, project.description,
      project.totalHours, project.startDate, project.deadline,
      project.confidenceScore, project.rationale,
      project.isExternal, project.location,
      project.isRecurring, project.recurringWeekDays, project.recurringTime
    );
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    // Dynamisches UPDATE basierend auf provided fields
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const stmt = this.db.prepare(`
      UPDATE projects SET ${setClause}, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(...values, projectId);
  }

  async deleteProject(projectId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(projectId);
    // CASCADE löscht automatisch Phases
  }

  // === PHASE METHODS ===
  
  async getPhases(projectId: string): Promise<Phase[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM phases 
      WHERE projectId = ? 
      ORDER BY date ASC
    `);
    return stmt.all(projectId) as Phase[];
  }

  async createPhase(phase: Phase): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO phases (
        id, projectId, name, hours, date, suggestedDate, rationale, completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      phase.id, phase.projectId, phase.name, phase.hours,
      phase.date, phase.suggestedDate, phase.rationale, phase.completed
    );
  }

  async updatePhase(phaseId: string, updates: Partial<Phase>): Promise<void> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const stmt = this.db.prepare(`
      UPDATE phases SET ${setClause}, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(...values, phaseId);
  }

  async deletePhase(phaseId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM phases WHERE id = ?');
    stmt.run(phaseId);
  }

  // === TIME OFF METHODS ===
  
  async getTimeOff(userId: string, startDate: string, endDate: string): Promise<TimeOff[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM timeOff
      WHERE userId = ?
        AND startDate <= ?
        AND endDate >= ?
      ORDER BY startDate ASC
    `);
    return stmt.all(userId, endDate, startDate) as TimeOff[];
  }

  async createTimeOff(timeOff: TimeOff): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO timeOff (id, userId, title, startDate, endDate, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      timeOff.id, timeOff.userId, timeOff.title,
      timeOff.startDate, timeOff.endDate, timeOff.reason
    );
  }

  // === CALENDAR BUSY METHODS ===
  
  async getCalendarBusy(userId: string, startDate: string, endDate: string): Promise<CalendarBusy[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM calendarBusy
      WHERE userId = ?
        AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `);
    return stmt.all(userId, startDate, endDate) as CalendarBusy[];
  }

  // === TRANSACTION SUPPORT ===
  
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // === CLEANUP ===
  
  close() {
    this.db.close();
  }
}

// Singleton Export
let dbInstance: DatabaseService | null = null;

export function getDatabase(): DatabaseService {
  if (!dbInstance) {
    const dbPath = process.env.DATABASE_PATH || './data/zeitplanung.db';
    dbInstance = new DatabaseService(dbPath);
  }
  return dbInstance;
}
```

### 3.4 Migration Scripts

```sql
-- migrations/001_initial.sql

-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  initials VARCHAR(5) NOT NULL,
  color VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY,
  userId VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  totalHours INTEGER NOT NULL,
  startDate DATE NOT NULL,
  deadline DATE NOT NULL,
  confidenceScore INTEGER,
  rationale TEXT,
  isExternal BOOLEAN DEFAULT FALSE,
  location VARCHAR(200),
  isRecurring BOOLEAN DEFAULT FALSE,
  recurringWeekDays INTEGER[],
  recurringTime TIME,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Phases Table
CREATE TABLE IF NOT EXISTS phases (
  id VARCHAR(50) PRIMARY KEY,
  projectId VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  hours INTEGER NOT NULL,
  date DATE NOT NULL,
  suggestedDate DATE,
  rationale TEXT,
  completed BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

-- TimeOff Table
CREATE TABLE IF NOT EXISTS timeOff (
  id VARCHAR(50) PRIMARY KEY,
  userId VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  reason VARCHAR(100),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- CalendarBusy Table
CREATE TABLE IF NOT EXISTS calendarBusy (
  id VARCHAR(50) PRIMARY KEY,
  userId VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  hours INTEGER NOT NULL,
  source VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(userId);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline);
CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(projectId);
CREATE INDEX IF NOT EXISTS idx_phases_date ON phases(date);
CREATE INDEX IF NOT EXISTS idx_timeoff_user ON timeoff(userId);
CREATE INDEX IF NOT EXISTS idx_timeoff_dates ON timeoff(startDate, endDate);
CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON calendarBusy(userId, date);
```

### 3.5 Test-Daten erstellen

```typescript
// seeds/seed.ts
import { getDatabase } from '../lib/database';
import { v4 as uuidv4 } from 'uuid';

export async function seedDatabase() {
  const db = getDatabase();

  // Test User
  const testUser = {
    id: 'test-user-001',
    name: 'Max Mustermann',
    initials: 'MM',
    color: '#3B82F6'
  };

  // Test Project
  const testProject = {
    id: uuidv4(),
    userId: testUser.id,
    title: 'Website Relaunch',
    description: '**Anforderungen:**\n- Responsive Design\n- SEO Optimierung\n- CMS Integration',
    totalHours: 40,
    startDate: '2025-03-27',
    deadline: '2025-04-30',
    confidenceScore: 85,
    rationale: 'Basierend auf typischen Web-Projekten dieser Größe',
    isExternal: false,
    location: null,
    isRecurring: false,
    recurringWeekDays: null,
    recurringTime: null
  };

  // Test Phases
  const testPhases = [
    {
      id: uuidv4(),
      projectId: testProject.id,
      name: 'Konzept & Wireframes',
      hours: 8,
      date: '2025-03-27',
      suggestedDate: '2025-03-27',
      rationale: 'Erste Phase: Grundlagen schaffen',
      completed: false
    },
    {
      id: uuidv4(),
      projectId: testProject.id,
      name: 'Design Mockups',
      hours: 12,
      date: '2025-04-03',
      suggestedDate: '2025-04-03',
      rationale: 'Visuelle Gestaltung nach Wireframes',
      completed: false
    },
    {
      id: uuidv4(),
      projectId: testProject.id,
      name: 'Frontend Entwicklung',
      hours: 16,
      date: '2025-04-10',
      suggestedDate: '2025-04-10',
      rationale: 'Umsetzung der Designs in Code',
      completed: false
    },
    {
      id: uuidv4(),
      projectId: testProject.id,
      name: 'Testing & Launch',
      hours: 4,
      date: '2025-04-24',
      suggestedDate: '2025-04-24',
      rationale: 'Finalisierung und Go-Live',
      completed: false
    }
  ];

  // Test Time Off
  const testTimeOff = {
    id: uuidv4(),
    userId: testUser.id,
    title: 'Urlaub',
    startDate: '2025-04-14',
    endDate: '2025-04-18',
    reason: 'Urlaub'
  };

  // Insert in Transaction
  db.transaction(() => {
    db.createUser(testUser);
    db.createProject(testProject);
    testPhases.forEach(phase => db.createPhase(phase));
    db.createTimeOff(testTimeOff);
  })();

  console.log('✅ Database seeded successfully!');
  console.log(`   User: ${testUser.name}`);
  console.log(`   Project: ${testProject.title}`);
  console.log(`   Phases: ${testPhases.length}`);
  console.log(`   Time Off: ${testTimeOff.title}`);
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
```

### Aufwand: 6-8 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Schema-Änderungen später teuer | 🟡 Mittel | 🔴 Hoch | Gründliche Analyse vorher |
| Datenverlust bei Migration | 🟡 Mittel | 🔴 Kritisch | Backups + Test-Migration |
| Performance-Probleme | 🟢 Niedrig | 🟡 Mittel | Indexes + Query-Optimierung |

---

## 📅 TAG 5: Qwen Service planen

### Checkliste

- [ ] API Endpoints dokumentieren
- [ ] Request/Response Formate analysieren
- [ ] Prompt Templates vorbereiten
- [ ] Error Handling planen

### 4.1 Qwen API Endpoints (Bailian)

#### Base URL

```
https://api.bailian.ai/v1
```

#### Authentication

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

#### Chat Completion Endpoint

```http
POST /chat/completions
```

**Request Body:**

```json
{
  "model": "qwen-max",
  "messages": [
    {
      "role": "system",
      "content": "Du bist ein experter Zeitplanungsassistent..."
    },
    {
      "role": "user",
      "content": "Erstelle einen Plan für..."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 2000,
  "response_format": {
    "type": "json_object"
  }
}
```

**Response:**

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "qwen-max",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"phases\": [...]}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

#### Vision Endpoint (für Bild-Analyse)

```http
POST /chat/completions
```

**Request Body mit Bild:**

```json
{
  "model": "qwen-vl-max",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Analysiere dieses Bild..."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
          }
        }
      ]
    }
  ]
}
```

### 4.2 Prompt Templates

#### Template 1: Project Request Parsing

```typescript
const PARSE_PROJECT_PROMPT = `
DU BIST EIN EXPERTER ZEITPLANUNGSASSISTENT.

Deine Aufgabe: Analysiere die User-Anfrage und erstelle einen strukturierten Projektplan.

HEUTE: {currentDate}

INPUT:
{userPrompt}

REGELN:
1. Extrahiere den Projekttitel (bei E-Mails: Betreff nutzen, "WG:", "Fwd:" entfernen)
2. Ermittle STARTDATUM und DEADLINE:
   - START: Bei "ab dem..." explizites Datum, sonst HEUTE
   - DEADLINE: Explizites Datum oder relative Angabe berechnen
3. Schätze GESAMTSTUNDEN basierend auf Komplexität
4. Unterteile in logische PHASEN (sequenziell)
5. Bei Serienterminen ("jeden Tag", "wöchentlich"):
   - isRecurring: true
   - weekDays: [1,2,3,4,5] für Mo-Fr
   - ERSTELLE NUR EINE PHASE (keine "Analyse", "Setup" etc.)
6. Bei konkreten Terminen ("Meeting am Mittwoch"): suggestedDate setzen

OUTPUT FORMAT (JSON):
{
  "title": "Projektname",
  "description": "Markdown mit technischen Details",
  "totalHours": 40,
  "startDate": "YYYY-MM-DD",
  "deadline": "YYYY-MM-DD",
  "confidenceScore": 85,
  "rationale": "Begründung",
  "isExternal": false,
  "location": null,
  "recurrence": {
    "isRecurring": false,
    "weekDays": null,
    "time": null
  },
  "phases": [
    {
      "name": "Phase 1",
      "hours": 8,
      "rationale": "Warum diese Phase",
      "suggestedDate": null
    }
  ]
}

ANTWORTE AUF DEUTSCH. NUR JSON.
`;
```

#### Template 2: Liquid Schedule

```typescript
const LIQUID_SCHEDULE_PROMPT = `
DU BIST EIN EXPERTER FÜR KAPAZITÄTSPRANUNG.

PROJEKT: "{projectTitle}"
GESAMTSTUNDEN: {totalHours}
STARTDATUM: {startDate} (KEINE Aufgaben VOR diesem Datum!)
DEADLINE: {deadline}

VERFÜGBARKEIT:
{availabilityContext}

STRATEGIE: {granularity}
- coarse: Große Blöcke, wenige Teile
- balanced: Ausgewogen (4-6h Blöcke)
- fine: Viele kleine Schritte (2-4h)

REGELN:
1. NUR gelistete Tage mit freier Kapazität nutzen
2. NIEMALS freie Stunden eines Tages überschreiten
3. Summe aller Phasen ≈ {totalHours}
4. Zusammenhängende Blöcke bilden
5. JSON Array als Antwort

OUTPUT FORMAT:
[
  {
    "name": "Teil 1: Setup",
    "hours": 6,
    "date": "YYYY-MM-DD",
    "rationale": "Warum dieser Tag"
  }
]
`;
```

#### Template 3: Intent Detection

```typescript
const INTENT_DETECTION_PROMPT = `
KLASSIFIZIERE DEN USER-INPUT IN EINE KATEGORIE:

1. "PROJECT": Neues Projekt planen (z.B. "Erstelle Plan für...", "SoMe Dreh in Hannover")
2. "TIMEOFF": Abwesenheit eintragen (z.B. "Urlaub nächste Woche", "Montag frei")
3. "MANAGEMENT": Bestehendes verwalten (z.B. "Lösche alle Meetings", "Sage Termin ab")

INPUT: {userPrompt}

ANTWORTE NUR MIT: PROJECT, TIMEOFF, oder MANAGEMENT
`;
```

#### Template 4: Management Command Parsing

```typescript
const MANAGEMENT_COMMAND_PROMPT = `
HEUTE: {currentDate}

EXTRAHIERE DEN LÖSCH-BEFEHL:

INPUT: {userPrompt}

REGELN:
- targetLevel: "PHASE" für Termine/Meetings, "PROJECT" für ganzes Projekt
- dateFilter: "ab dem 29.3." → AFTER, "vor dem" → BEFORE, "am" → ON
- keywords: Welche Projekte/Termine? (z.B. "Daily", "Leitungsrunde")

OUTPUT FORMAT (JSON):
{
  "action": "DELETE",
  "targetLevel": "PHASE",
  "keywords": ["Daily", "Meeting"],
  "dateFilter": {
    "operator": "AFTER",
    "date": "2025-03-29"
  },
  "confirmationMessage": "Lösche alle Dailys ab 29.03."
}
`;
```

#### Template 5: Time Off Extraction

```typescript
const TIMEOFF_EXTRACTION_PROMPT = `
HEUTE: {currentDate}

EXTRAHIERE DIE ABWESENHEIT:

INPUT: {userPrompt}

REGELN:
- Ein Tag genannt → startDate = endDate
- "Nächste Woche" → Montag bis Freitag
- Titel basierend auf Grund (Urlaub, Krank, Zeitausgleich)

OUTPUT FORMAT (JSON):
{
  "title": "Urlaub",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "reason": "Erholung"
}
`;
```

#### Template 6: Rebalance Schedule

```typescript
const REBALANCE_PROMPT = `
SITUATION: Urlaub von {vacationStart} bis {vacationEnd}

PROBLEM: Diese Aufgaben liegen im Urlaubszeitraum:
{conflictingPhases}

HEUTE: {currentDate}

AKTUELLE AUSLASTUNG:
{existingLoad}

REGELN (PRIORITÄT):
1. KAPAZITÄT BEACHTEN: Max 8h/Tag, keine Überlast!
2. DEADLINE RETTUNG: Aufgaben VOR Urlaub ziehen wenn möglich
3. FALLBACK: Nach Urlaub ({vacationEnd}) wenn vorher voll
4. KEINE Wochenenden

OUTPUT FORMAT (JSON):
[
  {
    "phaseId": "phase-123",
    "newDate": "YYYY-MM-DD"
  }
]
`;
```

### 4.3 Error Handling Strategy

```typescript
// services/qwenClient.ts

export class QwenAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'QwenAPIError';
  }
}

export class QwenRateLimitError extends QwenAPIError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 429, 'rate_limit_exceeded');
    this.name = 'QwenRateLimitError';
  }
}

export class QwenAuthenticationError extends QwenAPIError {
  constructor(message: string) {
    super(message, 401, 'invalid_api_key');
    this.name = 'QwenAuthenticationError';
  }
}

// Retry Logic mit Exponential Backoff
export async function callQwenWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof QwenRateLimitError) {
        const delay = error.retryAfter || (baseDelay * Math.pow(2, attempt));
        console.log(`Rate limit hit, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      if (error instanceof QwenAuthenticationError) {
        // Auth errors should not be retried
        throw error;
      }

      // Other errors: retry with backoff
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 4.4 Logging Strategy

```typescript
// services/qwenLogger.ts

interface QwenLogEntry {
  timestamp: string;
  function: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  duration: number;
  success: boolean;
  error?: string;
}

export class QwenLogger {
  private logs: QwenLogEntry[] = [];

  log(entry: Omit<QwenLogEntry, 'timestamp'>) {
    const fullEntry: QwenLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };
    this.logs.push(fullEntry);

    // Console logging
    const status = entry.success ? '✅' : '❌';
    console.log(
      `${status} [Qwen] ${entry.function} | ` +
      `${entry.model} | ` +
      `${entry.totalTokens} tokens | ` +
      `${entry.duration}ms`
    );

    // Error logging
    if (!entry.success && entry.error) {
      console.error(`Error: ${entry.error}`);
    }
  }

  // Optional: Logs zu File schreiben
  async flushToFile(logPath: string = './logs/qwen.log') {
    const fs = require('fs').promises;
    const dir = require('path').dirname(logPath);
    await fs.mkdir(dir, { recursive: true });
    
    const logContent = this.logs
      .map(entry => JSON.stringify(entry))
      .join('\n');
    
    await fs.appendFile(logPath, logContent + '\n');
    this.logs = [];
  }

  // Statistics
  getStats() {
    const total = this.logs.length;
    const success = this.logs.filter(l => l.success).length;
    const totalTokens = this.logs.reduce((sum, l) => sum + l.totalTokens, 0);
    const avgDuration = this.logs.reduce((sum, l) => sum + l.duration, 0) / total;

    return {
      totalRequests: total,
      successRate: (success / total * 100).toFixed(2) + '%',
      totalTokens,
      avgDurationMs: Math.round(avgDuration)
    };
  }
}

export const qwenLogger = new QwenLogger();
```

### Aufwand: 4-6 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Qwen API anders als erwartet | 🟡 Mittel | 🔴 Hoch | Ausgiebiges Testing einplanen |
| Prompt Tuning nötig | 🔴 Hoch | 🟡 Mittel | Iterative Entwicklung |
| Rate Limits | 🟡 Mittel | 🟡 Mittel | Retry Logic + Caching |
| Vision API nicht verfügbar | 🟢 Niedrig | 🟡 Mittel | Fallback: Text-only |

---

# PHASE 2: QWEN API INTEGRATION (TAG 6-10)

## 📅 TAG 6-7: Qwen Service erstellen

### Checkliste

- [ ] services/geminiService.ts → services/qwenService.ts
- [ ] API Client implementieren
- [ ] Error Handling implementieren
- [ ] Logging implementieren
- [ ] Unit Tests schreiben

### 1.1 Qwen Client Implementierung

```typescript
// services/qwenClient.ts

import axios from 'axios';

export interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

export interface QwenChatCompletionRequest {
  model: string;
  messages: QwenMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  stream?: boolean;
}

export interface QwenChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class QwenClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.bailian.ai/v1';
  }

  async chatCompletion(
    request: QwenChatCompletionRequest
  ): Promise<QwenChatCompletionResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    try {
      const response = await axios.post(url, request, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;

        if (status === 401) {
          throw new QwenAuthenticationError('Invalid API key');
        }

        if (status === 429) {
          const retryAfter = error.response?.headers?.['retry-after'];
          throw new QwenRateLimitError(
            'Rate limit exceeded',
            retryAfter ? parseInt(retryAfter) * 1000 : undefined
          );
        }

        throw new QwenAPIError(
          data?.error?.message || 'Qwen API request failed',
          status,
          data?.error?.code
        );
      }

      throw error;
    }
  }

  async chatCompletionWithRetry(
    request: QwenChatCompletionRequest,
    maxRetries: number = 3
  ): Promise<QwenChatCompletionResponse> {
    return callQwenWithRetry(
      () => this.chatCompletion(request),
      maxRetries
    );
  }
}
```

### 1.2 Qwen Service Implementation

```typescript
// services/qwenService.ts

import { QwenClient, QwenMessage } from './qwenClient';
import { qwenLogger } from './qwenLogger';
import { AIPlanResponse, ProjectPhase, TimeOffDetails, ManagementCommand } from '../types';

export class QwenService {
  private client: QwenClient;
  private model: string;

  constructor() {
    this.client = new QwenClient({
      apiKey: process.env.QWEN_API_KEY || 'dummy_key',
      baseUrl: process.env.QWEN_BASE_URL || 'https://api.bailian.ai/v1'
    });
    this.model = process.env.QWEN_MODEL_PLUS || 'qwen-plus';
  }

  // === AUDIO TRANSCRIPTION ===
  async transcribeAudio(base64Audio: string): Promise<string> {
    const startTime = Date.now();

    try {
      // Qwen Audio-Transkription (falls unterstützt)
      // Alternative: Whisper API verwenden
      const messages: QwenMessage[] = [
        {
          role: 'system',
          content: 'Transkribiere diese Sprachnachricht. Korrigiere Füllwörter (Ähs, Öhs). Gib NUR den Text zurück.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'audio_url',
              image_url: { url: `data:audio/wav;base64,${base64Audio}` }
            }
          ]
        }
      ];

      const response = await this.client.chatCompletionWithRetry({
        model: this.model,
        messages,
        max_tokens: 500
      });

      const text = response.choices[0]?.message?.content || '';

      qwenLogger.log({
        function: 'transcribeAudio',
        model: this.model,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        duration: Date.now() - startTime,
        success: true
      });

      return text.trim();
    } catch (error) {
      qwenLogger.log({
        function: 'transcribeAudio',
        model: this.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });

      console.error('Transcription failed', error);
      throw new Error('Spracherkennung fehlgeschlagen.');
    }
  }

  // === INTENT DETECTION ===
  async detectUserIntent(prompt: string): Promise<'PROJECT' | 'TIMEOFF' | 'MANAGEMENT'> {
    const startTime = Date.now();

    try {
      const messages: QwenMessage[] = [
        {
          role: 'system',
          content: `Klassifiziere den User-Input in eine von drei Kategorien:
1. "PROJECT": User will neues Projekt planen
2. "TIMEOFF": User will Abwesenheit eintragen
3. "MANAGEMENT": User will bestehendes verwalten/löschen

Antworte NUR mit dem String "PROJECT", "TIMEOFF" oder "MANAGEMENT".`
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await this.client.chatCompletionWithRetry({
        model: this.model,
        messages,
        max_tokens: 10,
        temperature: 0
      });

      const text = response.choices[0]?.message?.content?.trim().toUpperCase() || '';

      qwenLogger.log({
        function: 'detectUserIntent',
        model: this.model,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        duration: Date.now() - startTime,
        success: true
      });

      if (text === 'TIMEOFF') return 'TIMEOFF';
      if (text === 'MANAGEMENT') return 'MANAGEMENT';
      return 'PROJECT';
    } catch (error) {
      qwenLogger.log({
        function: 'detectUserIntent',
        model: this.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });

      console.error('Intent detection failed', error);
      return 'PROJECT'; // Fallback
    }
  }

  // === PROJECT REQUEST PARSING ===
  async parseProjectRequest(
    prompt: string,
    currentDate: string,
    autoSplit: boolean = true
  ): Promise<AIPlanResponse> {
    const startTime = Date.now();

    const splitInstruction = autoSplit
      ? `3. Unterteile das Projekt in logische Phasen (z.B. "Rohschnitt", "Feinschnitt", "Export").`
      : `3. Erstelle GENAU EINE Phase als Hauptaufgabe.`;

    const systemPrompt = `
DU BIST EIN EXPERTER ZEITPLANUNGSASSISTENT.

HEUTE: ${currentDate}

REGELN:
1. Extrahiere Projekttitel (bei E-Mails: Betreff nutzen)
2. Ermittle STARTDATUM und DEADLINE
3. ${splitInstruction}
4. Bei Serienterminen ("jeden Tag", "wöchentlich"):
   - isRecurring: true
   - weekDays: [1,2,3,4,5] für Mo-Fr
   - NUR EINE PHASE erstellen
5. Bei konkreten Terminen: suggestedDate setzen
6. Extrahiere technische Details für description (Markdown)
7. Prüfe auf Außentermine (isExternal, location)

OUTPUT FORMAT (JSON):
{
  "title": "string",
  "description": "string",
  "totalHours": number,
  "startDate": "YYYY-MM-DD",
  "deadline": "YYYY-MM-DD",
  "confidenceScore": number,
  "rationale": "string",
  "isExternal": boolean,
  "location": "string|null",
  "recurrence": {
    "isRecurring": boolean,
    "weekDays": number[]|null,
    "time": "HH:MM"|null
  },
  "phases": [
    {
      "name": "string",
      "hours": number,
      "rationale": "string",
      "suggestedDate": "YYYY-MM-DD"|null
    }
  ]
}

ANTWORTE AUF DEUTSCH. NUR JSON.
`;

    try {
      const messages: QwenMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      const response = await this.client.chatCompletionWithRetry({
        model: this.model,
        messages,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content) as AIPlanResponse;

      qwenLogger.log({
        function: 'parseProjectRequest',
        model: this.model,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        duration: Date.now() - startTime,
        success: true
      });

      return result;
    } catch (error) {
      qwenLogger.log({
        function: 'parseProjectRequest',
        model: this.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });

      console.error('Qwen Error:', error);
      throw error;
    }
  }

  // === LIQUID SCHEDULE ===
  async calculateLiquidSchedule(
    projectTitle: string,
    totalHours: number,
    deadline: string,
    startDate: string,
    availableSlots: { date: string; freeHours: number }[],
    granularity: 'coarse' | 'balanced' | 'fine' = 'balanced'
  ): Promise<ProjectPhase[]> {
    const startTime = Date.now();

    const validSlots = availableSlots.filter(s => s.freeHours > 0 && s.date >= startDate);
    const availabilityContext = validSlots.map(s => `${s.date}: ${s.freeHours}h frei`).join('\n');

    const grainPrompt = {
      coarse: 'Strategie: Große Blöcke. Wenige Teile. Tage komplett auffüllen.',
      balanced: 'Strategie: Ausgewogen. Sinnvolle Arbeitspakete (4-6h).',
      fine: 'Strategie: Aggressive Atomisierung. Viele kleine Schritte (2-4h).'
    }[granularity];

    const systemPrompt = `
DU BIST EIN EXPERTER FÜR KAPAZITÄTSPRANUNG.

PROJEKT: "${projectTitle}"
GESAMTSTUNDEN: ${totalHours}
STARTDATUM: ${startDate} (KEINE Aufgaben VOR diesem Datum!)
DEADLINE: ${deadline}

VERFÜGBARKEIT:
${availabilityContext}

${grainPrompt}

REGELN:
1. NUR gelistete Tage nutzen
2. NIEMALS freie Stunden überschreiten
3. Summe ≈ ${totalHours}
4. JSON Array als Antwort

OUTPUT:
[{"name": "string", "hours": number, "date": "YYYY-MM-DD", "rationale": "string"}]
`;

    try {
      const messages: QwenMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Erstelle den Liquid Schedule.' }
      ];

      const response = await this.client.chatCompletionWithRetry({
        model: this.model,
        messages,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '[]';
      const result = JSON.parse(content) as ProjectPhase[];

      qwenLogger.log({
        function: 'calculateLiquidSchedule',
        model: this.model,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        duration: Date.now() - startTime,
        success: true
      });

      return result;
    } catch (error) {
      qwenLogger.log({
        function: 'calculateLiquidSchedule',
        model: this.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });

      console.error('Liquid Schedule Error', error);
      return [];
    }
  }

  // === MANAGEMENT COMMAND PARSING ===
  async parseManagementRequest(
    prompt: string,
    currentDate: string
  ): Promise<ManagementCommand> {
    const startTime = Date.now();

    const systemPrompt = `
HEUTE: ${currentDate}

EXTRAHIERE DEN LÖSCH-BEFEHL:

REGELN:
- targetLevel: "PHASE" für Termine, "PROJECT" für ganzes Projekt
- dateFilter: "ab dem" → AFTER, "vor dem" → BEFORE, "am" → ON
- keywords: Welche Projekte/Termine?

OUTPUT (JSON):
{
  "action": "DELETE",
  "targetLevel": "PHASE"|"PROJECT",
  "keywords": ["string"],
  "dateFilter": {
    "operator": "BEFORE"|"AFTER"|"ON"|"BETWEEN",
    "date": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD"|null
  },
  "confirmationMessage": "string"
}
`;

    try {
      const messages: QwenMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      const response = await this.client.chatCompletionWithRetry({
        model: this.model,
        messages,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content) as ManagementCommand;

      qwenLogger.log({
        function: 'parseManagementRequest',
        model: this.model,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        duration: Date.now() - startTime,
        success: true
      });

      return result;
    } catch (error) {
      qwenLogger.log({
        function: 'parseManagementRequest',
        model: this.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });

      throw error;
    }
  }

  // === TIME OFF EXTRACTION ===
  async extractTimeOffDetails(
    prompt: string,
    currentDate: string
  ): Promise<TimeOffDetails> {
    const startTime = Date.now();

    const systemPrompt = `
HEUTE: ${currentDate}

EXTRAHIERE DIE ABWESENHEIT:

REGELN:
- Ein Tag → startDate = endDate
- "Nächste Woche" → Montag bis Freitag
- Titel basierend auf Grund

OUTPUT (JSON):
{
  "title": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "reason": "string"
}
`;

    try {
      const messages: QwenMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      const response = await this.client.chatCompletionWithRetry({
        model: this.model,
        messages,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content) as TimeOffDetails;

      qwenLogger.log({
        function: 'extractTimeOffDetails',
        model: this.model,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        duration: Date.now() - startTime,
        success: true
      });

      return result;
    } catch (error) {
      qwenLogger.log({
        function: 'extractTimeOffDetails',
        model: this.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });

      throw error;
    }
  }

  // === REBALANCE SCHEDULE ===
  async rebalanceSchedule(
    vacationStart: string,
    vacationEnd: string,
    conflictingPhases: Array<{
      id: string;
      name: string;
      date: string;
      deadline: string;
      projectTitle: string;
      hours: number;
    }>,
    currentDate: string,
    existingLoad: { date: string; hours: number }[]
  ): Promise<{ phaseId: string; newDate: string }[]> {
    const startTime = Date.now();

    if (conflictingPhases.length === 0) return [];

    const relevantLoad = existingLoad
      .filter(l => l.hours > 0)
      .map(l => `${l.date}: ${l.hours}h bereits gebucht`);

    const systemPrompt = `
SITUATION: Urlaub von ${vacationStart} bis ${vacationEnd}

PROBLEM: Diese Aufgaben liegen im Urlaubszeitraum:
${JSON.stringify(conflictingPhases)}

HEUTE: ${currentDate}

AKTUELLE AUSLASTUNG:
${JSON.stringify(relevantLoad)}

REGELN (PRIORITÄT):
1. KAPAZITÄT: Max 8h/Tag, keine Überlast!
2. DEADLINE: Aufgaben VOR Urlaub ziehen wenn möglich
3. FALLBACK: Nach Urlaub wenn vorher voll
4. KEINE Wochenenden

OUTPUT (JSON):
[{"phaseId": "string", "newDate": "YYYY-MM-DD"}]
`;

    try {
      const messages: QwenMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Berechne neue Daten.' }
      ];

      const response = await this.client.chatCompletionWithRetry({
        model: this.model,
        messages,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '[]';
      const result = JSON.parse(content) as Array<{ phaseId: string; newDate: string }>;

      qwenLogger.log({
        function: 'rebalanceSchedule',
        model: this.model,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        duration: Date.now() - startTime,
        success: true
      });

      return result;
    } catch (error) {
      qwenLogger.log({
        function: 'rebalanceSchedule',
        model: this.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });

      console.error('Reschedule error', error);
      return [];
    }
  }

  // === HELPER FUNCTIONS ===

  // detectOversizeRequest bleibt lokal (Regex)
  detectOversizeRequest(text: string, dailyCapacity: number = 8): boolean {
    const match = text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:h|std|stunden|hours)\b/i);
    if (match) {
      const hours = parseFloat(match[1].replace(',', '.'));
      return hours > dailyCapacity;
    }
    return false;
  }
}

// Singleton Export
export const qwenService = new QwenService();
```

### 1.3 Unit Tests

```typescript
// services/__tests__/qwenService.test.ts

import { QwenService } from '../qwenService';
import { QwenClient } from '../qwenClient';

// Mock QwenClient
jest.mock('../qwenClient');

describe('QwenService', () => {
  let service: QwenService;
  let mockClient: jest.Mocked<QwenClient>;

  beforeEach(() => {
    mockClient = new QwenClient({ apiKey: 'test' }) as jest.Mocked<QwenClient>;
    service = new QwenService();
    (service as any).client = mockClient;
  });

  describe('detectOversizeRequest', () => {
    it('should detect hours over limit', () => {
      expect(service.detectOversizeRequest('Ich brauche 10h für das')).toBe(true);
      expect(service.detectOversizeRequest('5h Arbeit')).toBe(false);
    });

    it('should handle different formats', () => {
      expect(service.detectOversizeRequest('12 Stunden')).toBe(true);
      expect(service.detectOversizeRequest('3,5h')).toBe(false);
      expect(service.detectOversizeRequest('20 std')).toBe(true);
    });
  });

  describe('detectUserIntent', () => {
    it('should detect PROJECT intent', async () => {
      mockClient.chatCompletionWithRetry.mockResolvedValue({
        choices: [{ message: { content: 'PROJECT' } }]
      } as any);

      const result = await service.detectUserIntent('Erstelle Plan für Website');
      expect(result).toBe('PROJECT');
    });

    it('should detect TIMEOFF intent', async () => {
      mockClient.chatCompletionWithRetry.mockResolvedValue({
        choices: [{ message: { content: 'TIMEOFF' } }]
      } as any);

      const result = await service.detectUserIntent('Ich bin nächste Woche im Urlaub');
      expect(result).toBe('TIMEOFF');
    });
  });
});
```

### Aufwand: 8-12 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| API Inkompatibilität | 🟡 Mittel | 🔴 Hoch | Fallback-Mechanismen |
| Prompt-Tuning nötig | 🔴 Hoch | 🟡 Mittel | Iterative Tests |
| Response-Format anders | 🟡 Mittel | 🟡 Mittel | Robustes Parsing |

---

## 📅 TAG 8-9: Funktionen migrieren

### Checkliste

- [ ] transcribeAudio() → Qwen/Whisper
- [ ] detectOversizeRequest() → Lokal übernehmen
- [ ] calculateLiquidSchedule() → Qwen Prompt
- [ ] suggestSchedule() → Qwen Prompt
- [ ] parseProjectRequest() → Qwen Prompt
- [ ] Alle anderen Funktionen migrieren

### 2.1 Migrations-Matrix

| Gemini Funktion | Qwen Äquivalent | Status | Notes |
|----------------|-----------------|--------|-------|
| `transcribeAudio()` | Qwen Audio ODER Whisper | 🟡 | Whisper als Fallback |
| `detectOversizeRequest()` | Lokal (Regex) | 🟢 | Keine Änderung |
| `calculateLiquidSchedule()` | Qwen Prompt | 🟡 | Schema-basiert |
| `detectUserIntent()` | Qwen Prompt | 🟢 | Einfach |
| `parseManagementRequest()` | Qwen Prompt | 🟡 | Komplexes Schema |
| `extractTimeOffDetails()` | Qwen Prompt | 🟢 | Mittel |
| `rebalanceSchedule()` | Qwen Prompt | 🔴 | Sehr komplex |
| `parseProjectRequest()` | Qwen Prompt | 🔴 | Hauptfunktion |
| `generatePhases()` | Qwen Prompt | 🟡 | Mittel |
| `refineProjectPlan()` | Qwen Prompt | 🟡 | Komplex |
| `generateProjectDescription()` | Qwen Vision | 🟡 | Bild-Support prüfen |
| `suggestSchedule()` | Qwen Prompt | 🟡 | Mittel |

### 2.2 Whisper Integration (Alternative für Audio)

```typescript
// services/whisperService.ts

import FormData from 'form-data';
import fetch from 'node-fetch';

export class WhisperService {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async transcribe(base64Audio: string): Promise<string> {
    // Base64 → Buffer
    const audioBuffer = Buffer.from(base64Audio, 'base64');

    // FormData für Upload
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-1');
    form.append('language', 'de'); // Deutsch erzwingen

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text;
  }
}
```

### 2.3 Prompt Engineering Best Practices

```typescript
// services/prompts.ts

export const PROMPTS = {
  PARSE_PROJECT: {
    system: `DU BIST EIN EXPERTER ZEITPLANUNGSASSISTENT.

HEUTE: {currentDate}

DEINE AUFGABE:
Analysiere die User-Anfrage und erstelle einen strukturierten Projektplan.

WICHTIGE REGELN:
1. TITEL: Extrahiere aus Betreff (E-Mails: "WG:", "Fwd:" entfernen)
2. STARTDATUM: 
   - Explizit: "ab dem 15.3." → 2025-03-15
   - Sonst: HEUTE ({currentDate})
3. DEADLINE:
   - Explizites Datum: Nutzen
   - "in 3 Tagen": Berechnen
   - "Laufe der Woche": Freitag
   - Keine Angabe: +14 Tage ab Start
4. PHASEN:
   - Normal: Logische Schritte (Setup → Entwurf → Umsetzung → Test)
   - Routine ("jeden Tag"): NUR EINE PHASE!
5. SERIENTERMINE:
   - "täglich", "jeden Tag" → weekDays: [1,2,3,4,5]
   - "jeden Montag" → weekDays: [1]
6. SUMMEN bei Routinen:
   - "1h täglich für 20 Tage" → totalHours: 20, phase.hours: 1
7. AUßENTERMINE:
   - Keywords: "Dreh", "Shooting", "Vor Ort", "Baustelle"
   - isExternal: true, location extrahieren

OUTPUT FORMAT (JSON):
{
  "title": "string",
  "description": "Markdown mit technischen Details",
  "totalHours": number,
  "startDate": "YYYY-MM-DD",
  "deadline": "YYYY-MM-DD",
  "confidenceScore": 80-100,
  "rationale": "string",
  "isExternal": boolean,
  "location": "string|null",
  "recurrence": {
    "isRecurring": boolean,
    "weekDays": number[]|null,
    "time": "HH:MM"|null
  },
  "phases": [
    {
      "name": "string",
      "hours": number,
      "rationale": "string",
      "suggestedDate": "YYYY-MM-DD"|null
    }
  ]
}

ANTWORTE AUF DEUTSCH. NUR JSON.`,

    user: `{userPrompt}`
  },

  LIQUID_SCHEDULE: {
    system: `DU BIST EIN EXPERTER FÜR KAPAZITÄTSPRANUNG.

PROJEKT: "{projectTitle}"
GESAMTSTUNDEN: {totalHours}
START: {startDate} (KEINE Aufgaben VOR diesem Datum!)
DEADLINE: {deadline}

VERFÜGBARKEIT:
{availabilityContext}

STRATEGIE: {granularity}

REGELN:
1. NUR gelistete Tage mit freier Kapazität
2. NIEMALS freie Stunden überschreiten
3. Summe ≈ {totalHours}
4. JSON Array

OUTPUT:
[{"name": "string", "hours": number, "date": "YYYY-MM-DD", "rationale": "string"}]`,

    user: `Erstelle den Liquid Schedule.`
  }
};
```

### Aufwand: 12-16 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Prompt Tuning nötig | 🔴 Hoch | 🟡 Mittel | Iterative Entwicklung |
| Qwen versteht Schema nicht | 🟡 Mittel | 🟡 Mittel | Few-Shot Examples |
| Performance langsamer | 🟢 Niedrig | 🟡 Mittel | Caching + Timeout |

---

## 📅 TAG 10: Testing & Debugging

### Checkliste

- [ ] Alle Funktionen testen
- [ ] API Responses validieren
- [ ] Performance testen
- [ ] Bugs fixen

### 3.1 Test-Plan

#### Unit Tests

```bash
# Jest Tests ausführen
npm test

# Coverage Report
npm test -- --coverage
```

**Test-Coverage Ziel:** >80%

#### Integration Tests

```typescript
// tests/integration/qwen-integration.test.ts

describe('Qwen Integration Tests', () => {
  it('should parse project request correctly', async () => {
    const result = await qwenService.parseProjectRequest(
      'Erstelle Plan für Website Relaunch, 40h, Deadline Ende April',
      '2025-03-27'
    );

    expect(result.title).toContain('Website');
    expect(result.totalHours).toBe(40);
    expect(result.phases.length).toBeGreaterThan(0);
  });

  it('should detect time off intent', async () => {
    const intent = await qwenService.detectUserIntent(
      'Ich bin nächste Woche im Urlaub'
    );
    expect(intent).toBe('TIMEOFF');
  });

  it('should calculate liquid schedule', async () => {
    const slots = [
      { date: '2025-03-27', freeHours: 6 },
      { date: '2025-03-28', freeHours: 4 },
      { date: '2025-03-31', freeHours: 8 }
    ];

    const schedule = await qwenService.calculateLiquidSchedule(
      'Test Projekt',
      12,
      '2025-04-10',
      '2025-03-27',
      slots
    );

    expect(schedule.length).toBeGreaterThan(0);
    const totalHours = schedule.reduce((sum, p) => sum + p.hours, 0);
    expect(totalHours).toBeCloseTo(12, 0);
  });
});
```

### 3.2 API Response Validation

```typescript
// utils/validateResponse.ts

export function validateAIPlanResponse(response: any): response is AIPlanResponse {
  const errors: string[] = [];

  if (!response.title) errors.push('title missing');
  if (!response.totalHours || response.totalHours <= 0) errors.push('invalid totalHours');
  if (!response.startDate) errors.push('startDate missing');
  if (!response.deadline) errors.push('deadline missing');
  if (!Array.isArray(response.phases) || response.phases.length === 0) {
    errors.push('phases missing or empty');
  }

  // Validate phases
  response.phases?.forEach((phase: any, index: number) => {
    if (!phase.name) errors.push(`phase[${index}].name missing`);
    if (!phase.hours || phase.hours <= 0) errors.push(`phase[${index}].hours invalid`);
    if (!phase.rationale) errors.push(`phase[${index}].rationale missing`);
  });

  if (errors.length > 0) {
    console.error('Validation errors:', errors);
    return false;
  }

  return true;
}
```

### 3.3 Performance Testing

```typescript
// tests/performance/qwen-performance.test.ts

describe('Qwen Performance Tests', () => {
  it('should respond within 10 seconds', async () => {
    const start = Date.now();
    await qwenService.parseProjectRequest('Test Projekt', '2025-03-27');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(10000); // 10 seconds
    console.log(`Response time: ${duration}ms`);
  });

  it('should handle concurrent requests', async () => {
    const promises = Array(5).fill(null).map(() =>
      qwenService.detectUserIntent('Test')
    );

    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(30000); // 30 seconds for 5 requests
  });
});
```

### Aufwand: 6-8 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Unerwartete Bugs | 🟡 Mittel | 🟡 Mittel | Ausgiebiges Testing |
| Performance zu langsam | 🟢 Niedrig | 🟡 Mittel | Caching + Optimization |
| API Rate Limits | 🟡 Mittel | 🟡 Mittel | Retry Logic |

---

# PHASE 3: DATENBANK MIGRATION (TAG 11-15)

## 📅 TAG 11-12: Datenbank Setup

### Checkliste

- [ ] PostgreSQL installieren/configurieren ODER SQLite einrichten
- [ ] Schema erstellen (Users, Projects, Phases, etc.)
- [ ] Connection Pool einrichten
- [ ] Migration Scripts testen

### 1.1 SQLite Setup (Empfohlen für MVP)

```bash
# Dependencies installieren
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3

# Database Directory erstellen
mkdir -p data

# Migration Script ausführen
npx ts-node lib/database.ts
```

### 1.2 PostgreSQL Setup (Alternative)

```bash
# PostgreSQL installieren (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Service starten
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Database und User erstellen
sudo -u postgres psql << EOF
CREATE DATABASE zeitplanung;
CREATE USER zeitplanung_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE zeitplanung TO zeitplanung_user;
EOF

# Connection String
# postgresql://zeitplanung_user:your_secure_password@localhost:5432/zeitplanung
```

### 1.3 Database Connection Layer

```typescript
// lib/dbConnection.ts

import { Pool } from 'pg'; // Für PostgreSQL
// ODER
import Database from 'better-sqlite3'; // Für SQLite

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool | Database.Database;
  private type: 'postgresql' | 'sqlite';

  private constructor() {
    this.type = (process.env.DATABASE_TYPE as 'postgresql' | 'sqlite') || 'sqlite';

    if (this.type === 'postgresql') {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });

      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });
    } else {
      const dbPath = process.env.DATABASE_PATH || './data/zeitplanung.db';
      this.pool = new Database(dbPath);
      (this.pool as Database.Database).pragma('journal_mode = WAL');
    }
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  getPool(): Pool | Database.Database {
    return this.pool;
  }

  getType(): 'postgresql' | 'sqlite' {
    return this.type;
  }

  async close(): Promise<void> {
    if (this.type === 'postgresql') {
      await (this.pool as Pool).end();
    } else {
      (this.pool as Database.Database).close();
    }
  }
}

export function getDbConnection(): DatabaseConnection {
  return DatabaseConnection.getInstance();
}
```

### 1.4 Schema Creation Script

```typescript
// lib/createSchema.ts

import { getDbConnection } from './dbConnection';

export async function createSchema() {
  const db = getDbConnection();
  const type = db.getType();

  if (type === 'sqlite') {
    const sqlite = db.getPool() as Database.Database;

    sqlite.exec(`
      -- Users Table
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        initials VARCHAR(5) NOT NULL,
        color VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Projects Table
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        totalHours INTEGER NOT NULL,
        startDate DATE NOT NULL,
        deadline DATE NOT NULL,
        confidenceScore INTEGER,
        rationale TEXT,
        isExternal BOOLEAN DEFAULT FALSE,
        location VARCHAR(200),
        isRecurring BOOLEAN DEFAULT FALSE,
        recurringWeekDays TEXT, -- JSON Array für SQLite
        recurringTime TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Phases Table
      CREATE TABLE IF NOT EXISTS phases (
        id VARCHAR(50) PRIMARY KEY,
        projectId VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        hours INTEGER NOT NULL,
        date DATE NOT NULL,
        suggestedDate DATE,
        rationale TEXT,
        completed BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- TimeOff Table
      CREATE TABLE IF NOT EXISTS timeOff (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50) NOT NULL,
        title VARCHAR(100) NOT NULL,
        startDate DATE NOT NULL,
        endDate DATE NOT NULL,
        reason VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- CalendarBusy Table
      CREATE TABLE IF NOT EXISTS calendarBusy (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        date DATE NOT NULL,
        hours INTEGER NOT NULL,
        source VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(userId);
      CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline);
      CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(projectId);
      CREATE INDEX IF NOT EXISTS idx_phases_date ON phases(date);
      CREATE INDEX IF NOT EXISTS idx_timeoff_user ON timeOff(userId);
      CREATE INDEX IF NOT EXISTS idx_timeoff_dates ON timeOff(startDate, endDate);
      CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON calendarBusy(userId, date);
    `);

    console.log('✅ SQLite schema created successfully');
  } else {
    // PostgreSQL Schema
    const pg = db.getPool() as Pool;

    await pg.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        initials VARCHAR(5) NOT NULL,
        color VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        totalHours INTEGER NOT NULL,
        startDate DATE NOT NULL,
        deadline DATE NOT NULL,
        confidenceScore INTEGER,
        rationale TEXT,
        isExternal BOOLEAN DEFAULT FALSE,
        location VARCHAR(200),
        isRecurring BOOLEAN DEFAULT FALSE,
        recurringWeekDays INTEGER[],
        recurringTime TIME,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Weitere Tables...
    `);

    console.log('✅ PostgreSQL schema created successfully');
  }
}

// Run if called directly
if (require.main === module) {
  createSchema()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
```

### Aufwand: 8-12 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Datenverlust bei Migration | 🟡 Mittel | 🔴 Kritisch | Backups + Test-Migration |
| Schema-Inkompatibilität | 🟢 Niedrig | 🟡 Mittel | Gründliches Design |
| Connection Pool Issues | 🟢 Niedrig | 🟡 Mittel | Retry Logic |

---

## 📅 TAG 13-14: Firebase → Lokal

### Checkliste

- [ ] lib/firebase.ts → lib/database.ts
- [ ] Firestore Calls → SQL Queries
- [ ] Firebase Storage → Lokale Files
- [ ] Realtime Updates → Polling oder WebSocket

### 2.1 Firebase zu SQL Mapping

#### Firestore Query → SQL

```typescript
// BEFORE: Firebase
const projects = await db.collection('projects')
  .where('userId', '==', userId)
  .orderBy('deadline', 'asc')
  .get();

// AFTER: SQLite
const stmt = db.prepare(`
  SELECT * FROM projects 
  WHERE userId = ? 
  ORDER BY deadline ASC
`);
const projects = stmt.all(userId);
```

```typescript
// BEFORE: Firebase
const phases = await db.collection('projects')
  .doc(projectId)
  .collection('phases')
  .orderBy('date', 'asc')
  .get();

// AFTER: SQLite
const stmt = db.prepare(`
  SELECT * FROM phases 
  WHERE projectId = ? 
  ORDER BY date ASC
`);
const phases = stmt.all(projectId);
```

```typescript
// BEFORE: Firebase
const timeOff = await db.collection('timeOff')
  .where('userId', '==', userId)
  .where('startDate', '<=', endDate)
  .where('endDate', '>=', startDate)
  .get();

// AFTER: SQLite
const stmt = db.prepare(`
  SELECT * FROM timeOff
  WHERE userId = ?
    AND startDate <= ?
    AND endDate >= ?
  ORDER BY startDate ASC
`);
const timeOff = stmt.all(userId, endDate, startDate);
```

### 2.2 Storage Migration

```typescript
// BEFORE: Firebase Storage
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const storageRef = ref(storage, `audio/${filename}`);
await uploadBytes(storageRef, blob);
const url = await getDownloadURL(storageRef);

// AFTER: Local File System
import fs from 'fs/promises';
import path from 'path';

const storageDir = './data/storage/audio';
await fs.mkdir(storageDir, { recursive: true });

const filePath = path.join(storageDir, filename);
await fs.writeFile(filePath, Buffer.from(base64Audio, 'base64'));

// URL für Frontend
const url = `/api/storage/audio/${filename}`;
```

### 2.3 Realtime Updates - Optionen

#### Option A: Polling (Einfach)

```typescript
// hooks/useDataPolling.ts

export function useProjects(userId: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    const data = await db.getProjects(userId);
    setProjects(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProjects();
    
    // Poll alle 5 Sekunden
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  return { projects, loading, refetch: fetchProjects };
}
```

#### Option B: WebSocket (Komplexer, aber echtzeitfähig)

```typescript
// server/websocketHandler.ts

import WebSocket from 'ws';

export class WebSocketHandler {
  private clients: Map<string, WebSocket[]> = new Map();

  addClient(userId: string, ws: WebSocket) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)!.push(ws);

    ws.on('close', () => {
      this.removeClient(userId, ws);
    });
  }

  removeClient(userId: string, ws: WebSocket) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const index = userClients.indexOf(ws);
      if (index > -1) {
        userClients.splice(index, 1);
      }
    }
  }

  broadcast(userId: string, event: string, data: any) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const message = JSON.stringify({ event, data });
      userClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }
}

// Usage in server.js
const wsHandler = new WebSocketHandler();

wss.on('connection', (ws, req) => {
  const userId = extractUserIdFromRequest(req);
  wsHandler.addClient(userId, ws);
});

// When data changes
db.on('project-updated', (userId, project) => {
  wsHandler.broadcast(userId, 'project-updated', project);
});
```

### 2.4 Complete Database Service

```typescript
// lib/database.ts (Vollständig)

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  totalHours: number;
  startDate: string;
  deadline: string;
  confidenceScore: number | null;
  rationale: string | null;
  isExternal: boolean;
  location: string | null;
  isRecurring: boolean;
  recurringWeekDays: string | null; // JSON
  recurringTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Phase {
  id: string;
  projectId: string;
  name: string;
  hours: number;
  date: string;
  suggestedDate: string | null;
  rationale: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeOff {
  id: string;
  userId: string;
  title: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  createdAt: string;
}

export interface CalendarBusy {
  id: string;
  userId: string;
  title: string;
  date: string;
  hours: number;
  source: string;
  createdAt: string;
}

export class DatabaseService {
  private db: Database.Database;
  private storageDir: string;

  constructor(dbPath: string = './data/zeitplanung.db') {
    // Verzeichnis erstellen
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.storageDir = './data/storage';

    this.initializeTables();
  }

  private initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        initials VARCHAR(5) NOT NULL,
        color VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        totalHours INTEGER NOT NULL,
        startDate DATE NOT NULL,
        deadline DATE NOT NULL,
        confidenceScore INTEGER,
        rationale TEXT,
        isExternal BOOLEAN DEFAULT FALSE,
        location VARCHAR(200),
        isRecurring BOOLEAN DEFAULT FALSE,
        recurringWeekDays TEXT,
        recurringTime TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS phases (
        id VARCHAR(50) PRIMARY KEY,
        projectId VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        hours INTEGER NOT NULL,
        date DATE NOT NULL,
        suggestedDate DATE,
        rationale TEXT,
        completed BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS timeOff (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50) NOT NULL,
        title VARCHAR(100) NOT NULL,
        startDate DATE NOT NULL,
        endDate DATE NOT NULL,
        reason VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS calendarBusy (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        date DATE NOT NULL,
        hours INTEGER NOT NULL,
        source VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(userId);
      CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline);
      CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(projectId);
      CREATE INDEX IF NOT EXISTS idx_phases_date ON phases(date);
      CREATE INDEX IF NOT EXISTS idx_timeoff_user ON timeOff(userId);
      CREATE INDEX IF NOT EXISTS idx_timeoff_dates ON timeOff(startDate, endDate);
      CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON calendarBusy(userId, date);
    `);
  }

  // === USER METHODS ===

  getUser(userId: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId) as User | null;
  }

  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, name, initials, color)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(user.id, user.name, user.initials, user.color);
  }

  // === PROJECT METHODS ===

  getProjects(userId: string): Project[] {
    const stmt = this.db.prepare(`
      SELECT * FROM projects 
      WHERE userId = ? 
      ORDER BY deadline ASC
    `);
    return stmt.all(userId) as Project[];
  }

  getProject(projectId: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(projectId) as Project | null;
  }

  createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, userId, title, description, totalHours,
        startDate, deadline, confidenceScore, rationale,
        isExternal, location, isRecurring, recurringWeekDays, recurringTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, project.userId, project.title, project.description,
      project.totalHours, project.startDate, project.deadline,
      project.confidenceScore, project.rationale,
      project.isExternal, project.location,
      project.isRecurring, 
      project.recurringWeekDays ? JSON.stringify(project.recurringWeekDays) : null,
      project.recurringTime
    );
    return id;
  }

  updateProject(projectId: string, updates: Partial<Project>): void {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'recurringWeekDays' && Array.isArray(value)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return;

    fields.push(`updatedAt = CURRENT_TIMESTAMP`);
    values.push(projectId);

    const stmt = this.db.prepare(`
      UPDATE projects SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);
  }

  deleteProject(projectId: string): void {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(projectId);
    // CASCADE löscht automatisch Phases
  }

  // === PHASE METHODS ===

  getPhases(projectId: string): Phase[] {
    const stmt = this.db.prepare(`
      SELECT * FROM phases 
      WHERE projectId = ? 
      ORDER BY date ASC
    `);
    return stmt.all(projectId) as Phase[];
  }

  createPhase(phase: Omit<Phase, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO phases (
        id, projectId, name, hours, date, suggestedDate, rationale, completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, phase.projectId, phase.name, phase.hours,
      phase.date, phase.suggestedDate, phase.rationale, phase.completed
    );
    return id;
  }

  updatePhase(phaseId: string, updates: Partial<Phase>): void {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return;

    fields.push(`updatedAt = CURRENT_TIMESTAMP`);
    values.push(phaseId);

    const stmt = this.db.prepare(`
      UPDATE phases SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);
  }

  deletePhase(phaseId: string): void {
    const stmt = this.db.prepare('DELETE FROM phases WHERE id = ?');
    stmt.run(phaseId);
  }

  // === TIME OFF METHODS ===

  getTimeOff(userId: string, startDate: string, endDate: string): TimeOff[] {
    const stmt = this.db.prepare(`
      SELECT * FROM timeOff
      WHERE userId = ?
        AND startDate <= ?
        AND endDate >= ?
      ORDER BY startDate ASC
    `);
    return stmt.all(userId, endDate, startDate) as TimeOff[];
  }

  createTimeOff(timeOff: Omit<TimeOff, 'id' | 'createdAt'>): string {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO timeOff (id, userId, title, startDate, endDate, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, timeOff.userId, timeOff.title,
      timeOff.startDate, timeOff.endDate, timeOff.reason
    );
    return id;
  }

  deleteTimeOff(timeOffId: string): void {
    const stmt = this.db.prepare('DELETE FROM timeOff WHERE id = ?');
    stmt.run(timeOffId);
  }

  // === CALENDAR BUSY METHODS ===

  getCalendarBusy(userId: string, startDate: string, endDate: string): CalendarBusy[] {
    const stmt = this.db.prepare(`
      SELECT * FROM calendarBusy
      WHERE userId = ?
        AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `);
    return stmt.all(userId, startDate, endDate) as CalendarBusy[];
  }

  createCalendarBusy(busy: Omit<CalendarBusy, 'id' | 'createdAt'>): string {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO calendarBusy (id, userId, title, date, hours, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, busy.userId, busy.title, busy.date, busy.hours, busy.source
    );
    return id;
  }

  // === STORAGE METHODS ===

  async saveFile(category: string, filename: string, base64Data: string): Promise<string> {
    const dir = path.join(this.storageDir, category);
    await fs.promises.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, filename);
    await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));

    return `/api/storage/${category}/${filename}`;
  }

  getFile(category: string, filename: string): Buffer {
    const filePath = path.join(this.storageDir, category, filename);
    return fs.readFileSync(filePath);
  }

  // === TRANSACTION SUPPORT ===

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // === CLEANUP ===

  close() {
    this.db.close();
  }
}

// Singleton Export
let dbInstance: DatabaseService | null = null;

export function getDatabase(): DatabaseService {
  if (!dbInstance) {
    const dbPath = process.env.DATABASE_PATH || './data/zeitplanung.db';
    dbInstance = new DatabaseService(dbPath);
  }
  return dbInstance;
}
```

### Aufwand: 12-16 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Query Performance | 🟡 Mittel | 🟡 Mittel | Indexes + Query Optimization |
| Dateninkonsistenzen | 🟡 Mittel | 🔴 Hoch | Transactions + Validation |
| Storage Migration | 🟢 Niedrig | 🟡 Mittel | Schrittweise Migration |

---

## 📅 TAG 15: Testing & Migration

### Checkliste

- [ ] Test-Daten migrieren
- [ ] Datenintegrität prüfen
- [ ] Performance testen
- [ ] Backup-Strategie testen

### 3.1 Firebase Data Export

```typescript
// scripts/export-firebase-data.ts

import admin from 'firebase-admin';
import fs from 'fs/promises';

// Firebase Admin SDK initialisieren
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

export async function exportFirebaseData() {
  const exportDir = './data/firebase-export';
  await fs.mkdir(exportDir, { recursive: true });

  // Users exportieren
  const users = await db.collection('users').get();
  const usersData = users.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  await fs.writeFile(
    `${exportDir}/users.json`,
    JSON.stringify(usersData, null, 2)
  );

  // Projects exportieren
  const projects = await db.collection('projects').get();
  const projectsData = [];

  for (const projectDoc of projects.docs) {
    const project = { id: projectDoc.id, ...projectDoc.data() };

    // Phases (Subcollection)
    const phasesRef = db.collection('projects').doc(projectDoc.id).collection('phases');
    const phasesSnapshot = await phasesRef.get();
    const phases = phasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    projectsData.push({ ...project, phases });
  }

  await fs.writeFile(
    `${exportDir}/projects.json`,
    JSON.stringify(projectsData, null, 2)
  );

  // TimeOff exportieren
  const timeOff = await db.collection('timeOff').get();
  const timeOffData = timeOff.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  await fs.writeFile(
    `${exportDir}/timeoff.json`,
    JSON.stringify(timeOffData, null, 2)
  );

  console.log('✅ Firebase data exported successfully');
  console.log(`   Users: ${usersData.length}`);
  console.log(`   Projects: ${projectsData.length}`);
}

exportFirebaseData().catch(console.error);
```

### 3.2 Data Import to SQLite

```typescript
// scripts/import-to-sqlite.ts

import fs from 'fs/promises';
import { getDatabase } from '../lib/database';

export async function importToSqlite() {
  const db = getDatabase();
  const exportDir = './data/firebase-export';

  // Users importieren
  const usersData = JSON.parse(await fs.readFile(`${exportDir}/users.json`, 'utf-8'));
  for (const user of usersData) {
    try {
      db.createUser({
        id: user.id,
        name: user.name,
        initials: user.initials,
        color: user.color
      });
    } catch (error) {
      console.error(`Failed to import user ${user.id}:`, error);
    }
  }

  // Projects importieren
  const projectsData = JSON.parse(await fs.readFile(`${exportDir}/projects.json`, 'utf-8'));
  for (const project of projectsData) {
    try {
      const projectId = db.createProject({
        userId: project.userId,
        title: project.title,
        description: project.description,
        totalHours: project.totalHours,
        startDate: project.startDate,
        deadline: project.deadline,
        confidenceScore: project.confidenceScore,
        rationale: project.rationale,
        isExternal: project.isExternal || false,
        location: project.location,
        isRecurring: project.isRecurring || false,
        recurringWeekDays: project.recurringWeekDays,
        recurringTime: project.recurringTime
      });

      // Phases importieren
      if (project.phases) {
        for (const phase of project.phases) {
          db.createPhase({
            projectId,
            name: phase.name,
            hours: phase.hours,
            date: phase.date,
            suggestedDate: phase.suggestedDate,
            rationale: phase.rationale,
            completed: phase.completed || false
          });
        }
      }
    } catch (error) {
      console.error(`Failed to import project ${project.id}:`, error);
    }
  }

  // TimeOff importieren
  const timeOffData = JSON.parse(await fs.readFile(`${exportDir}/timeoff.json`, 'utf-8'));
  for (const item of timeOffData) {
    try {
      db.createTimeOff({
        userId: item.userId,
        title: item.title,
        startDate: item.startDate,
        endDate: item.endDate,
        reason: item.reason
      });
    } catch (error) {
      console.error(`Failed to import time off ${item.id}:`, error);
    }
  }

  console.log('✅ Data imported to SQLite successfully');
}

importToSqlite().catch(console.error);
```

### 3.3 Data Integrity Checks

```typescript
// scripts/verify-data-integrity.ts

import { getDatabase } from '../lib/database';

export async function verifyDataIntegrity() {
  const db = getDatabase();
  const errors: string[] = [];

  // Check 1: Alle Projects haben validen User
  const projects = db.getProjects(''); // Alle holen
  for (const project of projects) {
    const user = db.getUser(project.userId);
    if (!user) {
      errors.push(`Project ${project.id} has invalid userId: ${project.userId}`);
    }
  }

  // Check 2: Alle Phases haben valides Project
  // (Müsste durch CASCADE gelöst sein, aber prüfen wir trotzdem)

  // Check 3: Phasen-Summen prüfen
  for (const project of projects) {
    const phases = db.getPhases(project.id);
    const phaseSum = phases.reduce((sum, p) => sum + p.hours, 0);
    
    if (Math.abs(phaseSum - project.totalHours) > 0.1) {
      errors.push(
        `Project ${project.title}: totalHours (${project.totalHours}) != ` +
        `sum of phases (${phaseSum})`
      );
    }
  }

  // Check 4: Date validity
  const today = new Date().toISOString().split('T')[0];
  for (const project of projects) {
    if (project.startDate < today) {
      // Warning, nicht Error
      console.warn(`Project ${project.title} has start date in past`);
    }
    if (project.deadline < project.startDate) {
      errors.push(
        `Project ${project.title}: deadline (${project.deadline}) ` +
        `before startDate (${project.startDate})`
      );
    }
  }

  // Report
  if (errors.length > 0) {
    console.error('❌ Data integrity check FAILED:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('✅ Data integrity check PASSED');
  }
}

verifyDataIntegrity().catch(console.error);
```

### 3.4 Backup Strategy

```bash
#!/bin/bash
# scripts/backup-database.sh

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Verzeichnis erstellen
mkdir -p $BACKUP_DIR

# SQLite Backup
cp ./data/zeitplanung.db $BACKUP_DIR/zeitplanung_$DATE.db
cp ./data/zeitplanung.db-wal $BACKUP_DIR/zeitplanung_$DATE.db-wal 2>/dev/null
cp ./data/zeitplanung.db-shm $BACKUP_DIR/zeitplanung_$DATE.db-shm 2>/dev/null

# Storage Backup
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz ./data/storage/

# Alte Backups löschen (>30 Tage)
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "✅ Backup created: zeitplanung_$DATE.db"
```

### Aufwand: 6-8 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Dateninkonsistenzen | 🟡 Mittel | 🔴 Hoch | Validation Scripts |
| Backup-Fehler | 🟢 Niedrig | 🔴 Hoch | Test-Restore durchführen |
| Performance-Probleme | 🟢 Niedrig | 🟡 Mittel | Index-Optimierung |

---

# PHASE 4: SERVER & FRONTEND MIGRATION (TAG 16-20)

## 📅 TAG 16-17: Server anpassen

### Checkliste

- [ ] server/server.js anpassen
- [ ] Gemini Proxy → Qwen Proxy
- [ ] REST API für DB hinzufügen
- [ ] Authentication hinzufügen (JWT optional)

### 1.1 Server REST API Endpoints

```javascript
// server/api/routes.js

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../../lib/database');

// === PROJECTS ===

// GET /api/projects - Alle Projekte eines Users
router.get('/projects', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const db = getDatabase();
    const projects = db.getProjects(userId);

    // Phases für jedes Projekt laden
    const projectsWithPhases = projects.map(project => ({
      ...project,
      phases: db.getPhases(project.id)
    }));

    res.json(projectsWithPhases);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - Einzelnes Projekt
router.get('/projects/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const project = db.getProject(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const phases = db.getPhases(project.id);

    res.json({ ...project, phases });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - Neues Projekt erstellen
router.post('/projects', async (req, res) => {
  try {
    const { userId, title, description, totalHours, startDate, deadline, ...rest } = req.body;

    if (!userId || !title || !totalHours || !startDate || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDatabase();
    const projectId = db.createProject({
      userId,
      title,
      description,
      totalHours,
      startDate,
      deadline,
      ...rest
    });

    // Phases erstellen falls vorhanden
    if (rest.phases && Array.isArray(rest.phases)) {
      for (const phase of rest.phases) {
        db.createPhase({ ...phase, projectId });
      }
    }

    const project = db.getProject(projectId);
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Projekt updaten
router.put('/projects/:id', async (req, res) => {
  try {
    const db = getDatabase();
    db.updateProject(req.params.id, req.body);

    const project = db.getProject(req.params.id);
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Projekt löschen
router.delete('/projects/:id', async (req, res) => {
  try {
    const db = getDatabase();
    db.deleteProject(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// === PHASES ===

// PUT /api/phases/:id - Phase updaten
router.put('/phases/:id', async (req, res) => {
  try {
    const db = getDatabase();
    db.updatePhase(req.params.id, req.body);

    const phase = db.getPhases('') // Alle holen und filtern
      .find(p => p.id === req.params.id);

    res.json(phase);
  } catch (error) {
    console.error('Error updating phase:', error);
    res.status(500).json({ error: 'Failed to update phase' });
  }
});

// DELETE /api/phases/:id - Phase löschen
router.delete('/phases/:id', async (req, res) => {
  try {
    const db = getDatabase();
    db.deletePhase(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting phase:', error);
    res.status(500).json({ error: 'Failed to delete phase' });
  }
});

// === TIME OFF ===

// GET /api/timeoff - Time Off eines Users
router.get('/timeoff', async (req, res) => {
  try {
    const userId = req.query.userId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const db = getDatabase();
    const timeOff = db.getTimeOff(userId, startDate, endDate);

    res.json(timeOff);
  } catch (error) {
    console.error('Error fetching time off:', error);
    res.status(500).json({ error: 'Failed to fetch time off' });
  }
});

// POST /api/timeoff - Time Off erstellen
router.post('/timeoff', async (req, res) => {
  try {
    const { userId, title, startDate, endDate, reason } = req.body;

    if (!userId || !title || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDatabase();
    const id = db.createTimeOff({ userId, title, startDate, endDate, reason });

    const timeOff = db.getTimeOff(userId, startDate, endDate)
      .find(t => t.id === id);

    res.status(201).json(timeOff);
  } catch (error) {
    console.error('Error creating time off:', error);
    res.status(500).json({ error: 'Failed to create time off' });
  }
});

// DELETE /api/timeoff/:id - Time Off löschen
router.delete('/timeoff/:id', async (req, res) => {
  try {
    const db = getDatabase();
    db.deleteTimeOff(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting time off:', error);
    res.status(500).json({ error: 'Failed to delete time off' });
  }
});

// === STORAGE ===

// POST /api/storage/upload - File upload
router.post('/storage/upload', async (req, res) => {
  try {
    const { category, filename, base64Data } = req.body;

    if (!category || !filename || !base64Data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDatabase();
    const url = await db.saveFile(category, filename, base64Data);

    res.json({ url });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET /api/storage/:category/:filename - File download
router.get('/storage/:category/:filename', async (req, res) => {
  try {
    const db = getDatabase();
    const data = db.getFile(req.params.category, req.params.filename);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(data);
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

module.exports = router;
```

### 1.2 Server.js Anpassungen

```javascript
// server/server.js (angepasst)

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./api/routes');

const app = express();
const port = process.env.PORT || 3000;

const staticPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests'
});

// API Routes
app.use('/api', apiLimiter, apiRoutes);

// Serve static files
app.use(express.static(staticPath));
app.use('/public', express.static(publicPath));

// SPA Fallback
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  res.sendFile(indexPath);
});

// Start server
const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`API available at /api/**`);
});

// WebSocket Setup (optional für Realtime)
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname.startsWith('/ws/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    // Handle WebSocket messages
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});
```

### Aufwand: 8-12 Stunden

### Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Security Lücken | 🟡 Mittel | 🔴 Hoch | Input Validation + Auth |
| API Inkompatibilität | 🟡 Mittel | 🟡 Mittel | Frontend anpassen |
| Performance | 🟢 Niedrig | 🟡 Mittel | Caching + Indexes |

---

## 📅 TAG 18-19: Frontend anpassen

### Checkliste

- [ ] App.tsx Imports anpassen
- [ ] Error Handling verbessern
- [ ] Loading States hinzufügen
- [ ] Offline Support prüfen

### 2.1 App.tsx Migration Guide

```typescript
// App.tsx - BEFORE
import { db } from './lib/firebase';
import { storage } from './lib/firebase';
import { 
  parseProjectRequest, 
  calculateLiquidSchedule,
  detectUserIntent 
} from './services/geminiService';

// App.tsx - AFTER
import { getDatabase } from './lib/database';
import { 
  parseProjectRequest, 
  calculateLiquidSchedule,
  detectUserIntent 
} from './services/qwenService';

const db = getDatabase();
```

### 2.2 Data Fetching Hooks

```typescript
// hooks/useProjects.ts

import { useState, useEffect, useCallback } from 'react';
import { getDatabase, Project, Phase } from '../lib/database';

export function useProjects(userId: string) {
  const [projects, setProjects] = useState<(Project & { phases: Phase[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects =