# KI-Zeitplanungstool - Analyse & Zielsetzung

> **Dokumentations-Version:** 1.0  
> **Erstellt:** 27. März 2026  
> **Projekt-Status:** Migration von Google Gemini/Firebase zu Qwen/Lokaler Stack  
> **Autor:** OpenClaw Code Analyst Subagent

---

## Inhaltsverzeichnis

1. [Projekt-Übersicht](#1-projekt-übersicht)
2. [Technische Architektur](#2-technische-architektur)
3. [Detaillierte Code-Analyse](#3-detaillierte-code-analyse)
4. [Abhängigkeits-Matrix](#4-abhängigkeits-matrix)
5. [Migrations-Ziele](#5-migrations-ziele)
6. [Offene Fragen & Risiken](#6-offene-fragen--risiken)
7. [Empfohlene Migrations-Strategie](#7-empfohlene-migrations-strategie)
8. [Anhang: Datei-Referenz](#8-anhang-datei-referenz)

---

## 1. Projekt-Übersicht

### 1.1 Ursprüngliches Projekt

| Attribut | Wert |
|----------|------|
| **Quelle** | Backup "Großartige Zeitplanung Redesign Version 10" |
| **Original Tech** | React 19 + Vite 6 + TypeScript 5.8 |
| **Original KI** | Google Gemini API (@google/genai v1.38.0) |
| **Original DB** | Firebase Firestore + Storage |
| **Original Hosting** | Firebase Hosting + Cloud Run Proxy |
| **Projektname** | `backup-grossartigezeitplanung---redesign` |

### 1.2 Projekt-Ziel

KI-gestütztes Zeitplanungstool für:

- **Projektmanagement mit KI-Unterstützung** - Natürlichsprachliche Eingabe von Projekten und Aufgaben
- **Sprach-/Texteingabe für Aufgaben** - Audio-Transkription und Textanalyse
- **Automatische Zeitplanung basierend auf Kalenderverfügbarkeit** - Intelligente Slot-Erkennung
- **Liquid Task Flow** - Große Aufgaben automatisch in verfügbare Kapazitäten splitten
- **Team-Kollaboration** - Multi-User Support (Bastian, Martin)
- **Offline-First Ansatz** - Safe Mode für lokale Simulation

### 1.3 Kern-Features

| Feature | Beschreibung | Status |
|---------|--------------|--------|
| **Magic Input** | Multi-Modal Input (Text, Audio, PDF, E-Mail, ICS) | ✅ Implementiert |
| **Intent Detection** | PROJECT / TIMEOFF / MANAGEMENT Klassifizierung | ✅ Implementiert |
| **Liquid Task Flow** | Auto-Split bei Aufgaben > 8h | ✅ Implementiert |
| **Heatmap Calendar** | Visuelle Kapazitäts-Ampel (Free/Optimal/Busy/Overloaded) | ✅ Implementiert |
| **Plan Proposal** | KI-generierte Vorschläge mit manueller Nachbearbeitung | ✅ Implementiert |
| **Drag & Drop** | Phasen zwischen Kalender und Proposal verschieben | ✅ Implementiert |
| **Safe Mode** | Lokaler Playground ohne DB-Schreibzugriff | ✅ Implementiert |
| **Bug Tracker** | Integriertes Ticket-System mit Notifications | ✅ Implementiert |
| **Share & Inbox** | Geteilte Ansichten mit eingehenden Anfragen | ✅ Implementiert |
| **Focus Mode** | Heute-Ansicht mit Quick-Actions | ✅ Implementiert |

---

## 2. Technische Architektur

### 2.1 System-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ MagicInput  │  │ Heatmap      │  │ PlanProposal            │ │
│  │ - Text      │  │ Calendar     │  │ - KI-Vorschläge         │ │
│  │ - Audio     │  │ - Kapazität  │  │ - Editierung            │ │
│  │ - PDF/EML   │  │ - Drag&Drop  │  │ - Granularität          │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Services Layer                            │ │
│  │  geminiService.ts  │  firebase.ts  │  shareService.ts       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND PROXY (Node.js)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  server.js (Express + WebSocket)                         │   │
│  │  - /api-proxy/* → Gemini API (HTTP + WS)                 │   │
│  │  - Rate Limiting (100 req/15min)                         │   │
│  │  - API Key Management                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNE DIENSTE                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ Google Gemini    │  │ Firebase         │  │ Firebase       │ │
│  │ - Generative AI  │  │ - Firestore DB   │  │ - Storage      │ │
│  │ - Audio STT      │  │ - Realtime Sync  │  │ - File Upload  │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Datenfluss

1. **User Input** → MagicInput.tsx
2. **Datei-Processing** → emailParser.ts / pdfParser.ts / calendarParser.ts
3. **Intent Detection** → geminiService.ts (detectUserIntent)
4. **KI-Verarbeitung** → geminiService.ts (parseProjectRequest / etc.)
5. **Vorschlag** → PlanProposal.tsx (Bearbeitung)
6. **Speicherung** → firebase.ts (Firestore Batch-Write)
7. **Visualisierung** → HeatmapCalendar.tsx + Components

### 2.3 State Management

**App.tsx** als zentrale State-Hub:

```typescript
// User & Session
currentUser: User
isSafeMode: boolean
mockData: {projects, phases} | null

// Data
dbProjects: Project[]
dbPhases: ProjectPhase[]
isDataLoading: boolean

// UI State
proposal: AIPlanResponse | null
editingProjectId: string | null
currentPrompt: string
isLoading: boolean
zoomLevel: ZoomLevel
calendarStartDate: Date

// Modals
projectToDelete: string | null
quickEditDate: string | null
isBugTrackerOpen: boolean
isShareModalOpen: boolean
isInboxOpen: boolean
```

---

## 3. Detaillierte Code-Analyse

### 3.1 Kritische Dateien (🔴)

#### 3.1.1 `/services/geminiService.ts` (29KB)

**Zweck:** Zentrale KI-Schnittstelle - Alle Gemini API Aufrufe

**Exportierte Funktionen:**

| Funktion | Zweck | Model | Rückgabe |
|----------|-------|-------|----------|
| `transcribeAudio()` | Sprachnachrichten transkribieren | `gemini-2.0-flash-exp` | `Promise<string>` |
| `detectUserIntent()` | PROJECT/TIMEOFF/MANAGEMENT | `gemini-3-flash-preview` | `Promise<'PROJECT'\|'TIMEOFF'\|'MANAGEMENT'>` |
| `parseProjectRequest()` | Projektanfrage parsen | `gemini-3-flash-preview` | `Promise<AIPlanResponse>` |
| `calculateLiquidSchedule()` | Liquid Task Flow Planung | `gemini-3-flash-preview` | `Promise<Phase[]>` |
| `extractTimeOffDetails()` | Urlaubsanträge extrahieren | `gemini-3-flash-preview` | `Promise<TimeOffDetails>` |
| `parseManagementRequest()` | Lösch-Befehle parsen | `gemini-3-flash-preview` | `Promise<ManagementCommand>` |
| `rebalanceSchedule()` | Planung neu balancieren | `gemini-3-flash-preview` | `Promise<{phaseId, newDate}[]>` |
| `suggestSchedule()` | Zeitvorschläge generieren | `gemini-3-flash-preview` | `Promise<{phaseIndex, date}[]>` |
| `generatePhases()` | Phasen generieren | `gemini-3-flash-preview` | `Promise<Phase[]>` |
| `refineProjectPlan()` | bestehenden Plan bearbeiten | `gemini-3-flash-preview` | `Promise<AIPlanResponse>` |
| `generateProjectDescription()` | Beschreibung aus Bildern/PDF | `gemini-3-flash-preview` | `Promise<string>` |

**Abhängigkeiten:**
```typescript
import { GoogleGenAI, Type } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "dummy_key" });
```

**API-EndPoints (Hardcoded):**
- HTTP: `https://generativelanguage.googleapis.com`
- WebSocket: `wss://generativelanguage.googleapis.com`

**Schema-Definitionen:**
- Verwendet `Type.OBJECT`, `Type.ARRAY`, `Type.STRING`, `Type.NUMBER`, `Type.BOOLEAN`
- `responseMimeType: "application/json"` für strukturierte Ausgaben
- `responseSchema` für type-safe Responses

**Migration:**
- ✅ → `/services/qwenService.ts` umbenennen
- ✅ → Alle `GoogleGenAI` Calls durch Qwen API ersetzen
- ✅ → `Type.*` Schema durch Qwen-kompatibles Format ersetzen
- ✅ → API Endpoints anpassen (lokal: `http://localhost:11434` oder Bailian Cloud)
- ⚠️ → Audio-Transkription benötigt separates STT (Whisper)

---

#### 3.1.2 `/lib/firebase.ts` (<1KB)

**Zweck:** Firebase Konfiguration und Initialisierung

**Enthält:**
```typescript
const firebaseConfig = {
  apiKey: "AIzaSyAf0Jnso3VOr3yFLpKTq0JYzNnXyBhpqkk",
  authDomain: "grandiosezeitplanung.firebaseapp.com",
  projectId: "grandiosezeitplanung",
  storageBucket: "grandiosezeitplanung.firebasestorage.app",
  messagingSenderId: "866078134526",
  appId: "1:866078134526:web:d953044a1bd653d90d55af"
};
```

**Exporte:**
- `storage` - Firebase Storage Instance (modular API)
- `db` - Firestore Database Instance (compat API)

**Verwendung:**
```typescript
// Projects
db.collection('projects').onSnapshot(...)
db.collection('projects').doc(id).set(...)
db.collection('projects').doc(id).delete(...)

// Phases
db.collection('phases').onSnapshot(...)
db.collection('phases').where('projectId', '==', id).get()

// Storage
uploadFile(file) → uploadBytes(ref, file) → getDownloadURL()
```

**Migration:**
- ✅ → `/lib/database.ts` erstellen
- ✅ → PostgreSQL (empfohlen) oder SQLite auswählen
- ✅ → Schema für `Projects`, `Phases`, `Users`, `Bugs`, `SharedViews`, `InboundRequests`
- ✅ → Firestore `.onSnapshot()` durch PostgreSQL LISTEN/NOTIFY oder Polling ersetzen
- ✅ → Firebase Storage durch lokale Dateispeicherung oder S3-kompatiblen Service

---

#### 3.1.3 `/server/server.js` (12KB)

**Zweck:** Backend Proxy Server für Gemini API

**Technologien:**
- Express.js (Port 3000)
- WebSocket (ws)
- Rate Limiting (express-rate-limit)
- Axios für HTTP Proxy

**Funktionen:**

| Endpoint | Methode | Zweck |
|----------|---------|-------|
| `/api-proxy/*` | HTTP POST/GET | Proxy für Gemini API Calls |
| `/api-proxy/*` | WebSocket | Proxy für Gemini Streaming |
| `/` | GET | Serve index.html mit Script-Injection |
| `/public/*` | GET | Statische Assets |
| `/service-worker.js` | GET | Service Worker |

**Rate Limiting:**
```javascript
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 100, // 100 Requests pro IP
    message: 'Too many requests from this IP'
});
```

**WebSocket Proxy:**
- Client ↔ Proxy ↔ Gemini WebSocket
- Message Queueing während Verbindungsaufbau
- Bidirektionales Streaming

**Migration:**
- ✅ → Gemini Proxy durch Qwen Proxy ersetzen
- ✅ → REST API für lokale DB hinzufügen (`/api/projects`, `/api/phases`)
- ✅ → WebSocket für Qwen Streaming (falls unterstützt)
- ✅ → Authentication/Authorization hinzufügen
- ✅ → CORS konfigurieren

---

#### 3.1.4 `/App.tsx` (64KB)

**Zweck:** Hauptkomponente - State Management & Integration

**Größe:** ~1500 Zeilen

**State-Variablen (Auszug):**
```typescript
// User
const [currentUser, setCurrentUser] = useState<User>(USERS[0]);
const [isSafeMode, setIsSafeMode] = useState(false);

// Data
const [dbProjects, setDbProjects] = useState<Project[]>([]);
const [dbPhases, setDbPhases] = useState<ProjectPhase[]>([]);

// UI
const [proposal, setProposal] = useState<AIPlanResponse | null>(null);
const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('standard');
const [calendarStartDate, setCalendarStartDate] = useState(new Date());

// Modals
const [isBugTrackerOpen, setIsBugTrackerOpen] = useState(false);
const [isShareModalOpen, setIsShareModalOpen] = useState(false);
const [isInboxOpen, setIsInboxOpen] = useState(false);
```

**Wichtige Handler:**

| Handler | Zweck |
|---------|-------|
| `handleAIRequest()` | Haupt-Input-Verarbeitung (Text + Files) |
| `handleAcceptProposal()` | KI-Vorschlag speichern (Create/Update) |
| `handleMovePhase()` | Phase auf neuen Datum verschieben |
| `handleDeleteRequest()` | Projekt löschen |
| `handleOpenProject()` | Projekt zur Bearbeitung öffnen |
| `handleToggleSafeMode()` | Safe Mode ein/aus |
| `handleRefineLiquidSplit()` | Liquid Flow Granularität anpassen |

**Integrationen:**
- Importiert aus `geminiService.ts` (muss angepasst werden)
- Importiert aus `firebase.ts` (muss angepasst werden)
- Verwendet `canvas-confetti` für Success-Effects

**Migration:**
- ✅ → Imports auf `qwenService.ts` umstellen
- ✅ → Firebase Calls durch REST API Calls ersetzen
- ✅ → Safe Mode Logik beibehalten (wertvoll für Testing)

---

### 3.2 Wichtige Dateien (🟡)

#### 3.2.1 `/types.ts`

**Zweck:** TypeScript Interface-Definitionen

**Wichtige Interfaces:**

```typescript
interface Project {
  id: string;
  userId?: string;
  title: string;
  totalHours: number;
  startDate?: string;
  deadline: string;
  color: string;
  attachments?: string[];
  description?: string;
  isTimeOff?: boolean;
  isExternal?: boolean;
  location?: string;
}

interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  hours: number;
  suggestedDate: string;
  status: 'pending' | 'scheduled' | 'completed';
  isGhost?: boolean;
  isExternal?: boolean;
}

interface AIPlanResponse {
  title: string;
  description?: string;
  totalHours: number;
  startDate?: string;
  deadline: string;
  confidenceScore: number;
  phases: Array<{
    id?: string;
    name: string;
    hours: number;
    rationale: string;
    suggestedDate?: string;
    status?: 'pending' | 'scheduled' | 'completed';
  }>;
  rationale: string;
  recurrence?: RecurrenceConfig;
  isExternal?: boolean;
  location?: string;
  attachments?: string[];
}

interface BugTicket {
  id: string;
  reporterId: string;
  reporterName: string;
  title: string;
  description: string;
  priority: BugPriority;
  status: BugStatus;
  createdAt: string;
  updatedAt: string;
  comments: BugComment[];
}
```

**Migration:** 
- ✅ → Interfaces weitgehend unverändert übernehmbar
- ✅ → Eventuell neue Felder für lokale DB (createdAt, updatedAt, etc.)

---

#### 3.2.2 `/utils.ts`

**Zweck:** Helper Functions

**Funktionen:**
- `formatDate()` - Date → YYYY-MM-DD
- `addDays()` - Tage addieren
- `getDaysArray()` - Date-Range generieren
- `generateId()` - Zufalls-ID
- `getRandomColor()` - Zufällige Tailwind-Farbe
- `generateRecurringDates()` - Serientermine berechnen
- `compressImage()` - Bilder komprimieren (max 800x800, 60% Quality)
- `uploadFile()` - Firebase Storage Upload
- `cleanText()` - Text bereinigen (\n, URL-Encoding)

**Migration:**
- ✅ → `uploadFile()` muss angepasst werden (lokaler Upload oder S3)
- ✅ → Rest unverändert übernehmbar

---

#### 3.2.3 `/utils/emailParser.ts`

**Zweck:** E-Mail (.eml) Parsing

**Bibliothek:** `postal-mime` v2.3.0

**Funktion:**
```typescript
parseEmail(file: File): Promise<ParsedEmail>
```

**Extrahiert:**
- Subject
- Body (plain text oder aus HTML)
- Date (ISO)
- Attachments (Images + PDFs)

**Migration:** ✅ Unverändert übernehmbar

---

#### 3.2.4 `/utils/pdfParser.ts`

**Zweck:** PDF Text-Extraktion

**Bibliothek:** `pdfjs-dist` v4.0.379

**Funktion:**
```typescript
extractTextFromPDF(file: File): Promise<string>
```

**Limitierung:** Max. 5 Seiten werden gelesen

**Migration:** ✅ Unverändert übernehmbar

---

#### 3.2.5 `/utils/calendarParser.ts`

**Zweck:** Kalender (.ics) Parsing

**Funktion:**
```typescript
parseCalendarFile(file: File): Promise<string>
```

**Extrahiert:**
- Summary (Titel)
- Start/End Datum
- Location
- Description

**Migration:** ✅ Unverändert übernehmbar

---

### 3.3 Komponenten (🟢)

#### 3.3.1 Übersicht

| Komponente | Zeilen | Zweck | Migrations-Bedarf |
|------------|--------|-------|-------------------|
| `MagicInput.tsx` | ~350 | Multi-Modal Input | ✅ Keine |
| `HeatmapCalendar.tsx` | ~800 | Kalender mit Kapazität | ✅ Keine |
| `PlanProposal.tsx` | ~750 | KI-Vorschläge anzeigen/bearbeiten | ✅ Keine |
| `ProjectList.tsx` | ~200 | Projektübersicht | ✅ Keine |
| `EditProjectModal.tsx` | - | Projekt bearbeiten | ✅ Keine |
| `FocusMode.tsx` | ~150 | Heute-Ansicht | ✅ Keine |
| `TimelineWidget.tsx` | ~200 | Zeitstrahl | ✅ Keine |
| `QuickEditModal.tsx` | ~150 | Schnelle Bearbeitung | ✅ Keine |
| `BugTrackerModal.tsx` | ~400 | Bug Tracker | ✅ Keine |
| `CapacityTrend.tsx` | ~150 | Kapazitätstrend | ✅ Keine |
| `ZoomController.tsx` | ~100 | Zoom-Steuerung | ✅ Keine |
| `ShareModal.tsx` | ~250 | Teilen-Funktion | ✅ Keine |
| `InboxModal.tsx` | ~200 | Eingehende Anfragen | ✅ Keine |
| `GoldenVacationTile.tsx` | ~100 | Urlaubsplanung | ✅ Keine |
| `ExternalMeetingTile.tsx` | ~100 | Externe Meetings | ✅ Keine |
| `NewsWidget.tsx` | ~150 | News Widget | ✅ Keine |
| `DeleteConfirmModal.tsx` | ~80 | Löschen-Bestätigung | ✅ Keine |
| `TaskRequestModal.tsx` | ~150 | Aufgaben-Anfrage | ✅ Keine |
| `SharedViewApp.tsx` | ~300 | Geteilte Ansicht | ✅ Keine |

#### 3.3.2 Besondere Komponenten

**MagicInput.tsx:**
- Drag & Drop für Files
- EML/ICS Auto-Parsing
- Oversize Detection (>8h)
- Externe Text-Injection (aus Inbox)

**HeatmapCalendar.tsx:**
- Orbital Ring Colors (Kapazitäts-Ampel)
- Drag & Drop für Phasen/Deadlines
- Ghost Phases (Proposal Preview)
- Zoom-Level (Micro/Standard/Macro)

**PlanProposal.tsx:**
- Live-Editing von KI-Vorschlägen
- Granularitäts-Steuerung (Coarse/Balanced/Fine)
- Attachment-Management
- Drag & Drop zurück zum Kalender

---

### 3.4 Services

#### 3.4.1 `/services/shareService.ts`

**Zweck:** Shared Views & Inbound Requests

**Funktionen:**
- `createSharedView()` - Geteilte Ansicht erstellen
- `subscribeToRequests()` - Eingehende Anfragen abonnieren

**Firebase-Struktur:**
```
/sharedViews/{id}
  - creatorId
  - config: {projectId, allowRequests, showDetails, expiresAt}
  - createdAt

/inboundRequests/{id}
  - shareViewId
  - creatorId
  - guestName
  - requestText
  - priority
  - status: pending|processed|dismissed
```

**Migration:** 
- ✅ → REST Endpoints needed: `POST /api/share`, `GET /api/share/:id`, `POST /api/request`

---

### 3.5 Server-Public

#### 3.5.1 `/server/public/service-worker.js`

**Zweck:** Offline-Caching

**Strategie:** Cache-First für statische Assets

**Migration:** ✅ Unverändert übernehmbar

#### 3.5.2 `/server/public/websocket-interceptor.js`

**Zweck:** WebSocket Interception für Gemini Streaming

**Funktion:** 
- Fängt WebSocket Calls ab
- Leitet durch Proxy um

**Migration:** 
- ⚠️ → Muss an Qwen WebSocket-Protokoll angepasst werden (falls unterstützt)

---

## 4. Abhängigkeits-Matrix

### 4.1 NPM Dependencies (Frontend)

```json
{
  "dependencies": {
    "react": "^19.2.3",                    // ✅ Behalten
    "react-dom": "^19.2.3",                // ✅ Behalten
    "firebase": "^12.8.0",                 // 🔴 ERSETZEN
    "@google/genai": "^1.38.0",            // 🔴 ERSETZEN
    "lucide-react": "^0.562.0",            // ✅ Behalten
    "canvas-confetti": "1.9.2",            // ✅ Behalten
    "postal-mime": "2.3.0",                // ✅ Behalten
    "pdfjs-dist": "4.0.379"                // ✅ Behalten
  },
  "devDependencies": {
    "@types/node": "^22.14.0",             // ✅ Behalten
    "@vitejs/plugin-react": "^5.0.0",      // ✅ Behalten
    "typescript": "~5.8.2",                // ✅ Behalten
    "vite": "^6.2.0"                       // ✅ Behalten
  }
}
```

### 4.2 NPM Dependencies (Server)

```json
{
  "dependencies": {
    "axios": "^1.6.7",                     // ✅ Behalten
    "dotenv": "^16.4.5",                   // ✅ Behalten
    "express": "^4.18.2",                  // ✅ Behalten
    "express-rate-limit": "^7.5.0",        // ✅ Behalten
    "ws": "^8.17.0"                        // ✅ Behalten (für WebSocket)
  },
  "devDependencies": {
    "nodemon": "^3.1.0"                    // ✅ Behalten
  }
}
```

### 4.3 Externe APIs

| Service | Verwendung | Ersatz |
|---------|------------|--------|
| Google Gemini API | KI-Verarbeitung | Qwen API (lokal oder Bailian) |
| Firebase Firestore | Datenbank | PostgreSQL / SQLite |
| Firebase Storage | File-Storage | Lokales FS / S3-kompatibel |
| Firebase Hosting | Hosting | Caddy / Nginx |

### 4.4 Environment Variables

**Aktuell:**
```bash
GEMINI_API_KEY=...
API_KEY=...
PORT=3000
```

**Nach Migration:**
```bash
# Qwen API
QWEN_API_KEY=...              # Falls Bailian Cloud
QWEN_BASE_URL=...             # https://dashscope.aliyuncs.com oder lokal

# Datenbank
DATABASE_URL=postgresql://... # Oder SQLITE_PATH=/path/to/db.sqlite

# Server
PORT=3000
NODE_ENV=production
```

---

## 5. Migrations-Ziele

### 5.1 Ziel 1: Qwen API Integration

**Priorität:** 🔴 KRITISCH

**Aufgaben:**

- [ ] **geminiService.ts → qwenService.ts umbenennen**
  - Datei kopieren und umbenennen
  - Alle Imports in App.tsx und Components aktualisieren

- [ ] **API Client austauschen**
  ```typescript
  // ALT
  import { GoogleGenAI, Type } from "@google/genai";
  const ai = new GoogleGenAI({ apiKey });
  
  // NEU (Beispiel Bailian)
  import axios from 'axios';
  const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
  ```

- [ ] **Model-Mapping definieren**
  | Gemini Model | Qwen Ersatz | Zweck |
  |--------------|-------------|-------|
  | `gemini-2.0-flash-exp` | `qwen-audio` oder Whisper | Audio STT |
  | `gemini-3-flash-preview` | `qwen3.5-plus` | Text-Analyse |
  | `gemini-3-flash-preview` | `qwen3-coder-plus` | Strukturierte Outputs |

- [ ] **Schema-Definition anpassen**
  ```typescript
  // Gemini Type.* Schema
  responseSchema: {
    type: Type.OBJECT,
    properties: { ... }
  }
  
  // Qwen (JSON Mode via System Prompt)
  systemInstruction: "Antworte IMMER als valides JSON..."
  ```

- [ ] **Streaming Support prüfen**
  - Qwen HTTP Streaming: ✅ Verfügbar
  - Qwen WebSocket: ❓ Unklar (dokumentieren)

- [ ] **Rate Limiting anpassen**
  - Bailian Cloud: 10-100 RPM je nach Plan
  - Lokal: Keine Limits (Hardware-abhängig)

- [ ] **Error Handling aktualisieren**
  - Gemini Error-Format → Qwen Error-Format
  - Retry-Logic implementieren

---

### 5.2 Ziel 2: Lokale Datenbank

**Priorität:** 🔴 KRITISCH

**Aufgaben:**

- [ ] **Datenbank auswählen**
  - **PostgreSQL** (empfohlen):
    - ✅ Production-ready
    - ✅ LISTEN/NOTIFY für Realtime
    - ✅ JSONB für flexible Schemas
    - ❌ Setup-Aufwand höher
  
  - **SQLite**:
    - ✅ Zero-Configuration
    - ✅ Single-File
    - ❌ Keine Multi-User Concurrency
    - ❌ Kein LISTEN/NOTIFY
  
  - **Empfehlung:** PostgreSQL für Production, SQLite für Development

- [ ] **Schema designen**
  ```sql
  -- Users
  CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    initials VARCHAR(10) NOT NULL,
    color VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  
  -- Projects
  CREATE TABLE projects (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    total_hours DECIMAL(10,2) NOT NULL,
    start_date DATE,
    deadline DATE NOT NULL,
    color VARCHAR(50),
    attachments JSONB DEFAULT '[]',
    description TEXT,
    is_time_off BOOLEAN DEFAULT FALSE,
    is_external BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  
  -- Phases
  CREATE TABLE phases (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    hours DECIMAL(10,2) NOT NULL,
    suggested_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    is_ghost BOOLEAN DEFAULT FALSE,
    is_external BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  );
  
  -- Bugs
  CREATE TABLE bugs (
    id UUID PRIMARY KEY,
    reporter_id UUID REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    attachment_url VARCHAR(500),
    has_unread_update BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  
  -- Bug Comments
  CREATE TABLE bug_comments (
    id UUID PRIMARY KEY,
    bug_id UUID REFERENCES bugs(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    author_name VARCHAR(255),
    text TEXT NOT NULL,
    is_system_message BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  );
  
  -- Shared Views
  CREATE TABLE shared_views (
    id UUID PRIMARY KEY,
    creator_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    allow_requests BOOLEAN DEFAULT FALSE,
    show_details BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );
  
  -- Inbound Requests
  CREATE TABLE inbound_requests (
    id UUID PRIMARY KEY,
    share_view_id UUID REFERENCES shared_views(id),
    creator_id UUID REFERENCES users(id),
    guest_name VARCHAR(255),
    request_text TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
  );
  
  -- Indexes
  CREATE INDEX idx_phases_project_id ON phases(project_id);
  CREATE INDEX idx_phases_suggested_date ON phases(suggested_date);
  CREATE INDEX idx_projects_user_id ON projects(user_id);
  CREATE INDEX idx_projects_deadline ON projects(deadline);
  ```

- [ ] **Database Client implementieren**
  ```typescript
  // lib/database.ts
  import { Pool } from 'pg'; // Oder better-sqlite3
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  export const db = {
    projects: {
      findAll: async (userId: string) => ...,
      findById: async (id: string) => ...,
      create: async (data: Project) => ...,
      update: async (id: string, data: Partial<Project>) => ...,
      delete: async (id: string) => ...
    },
    phases: {
      findByProjectId: async (projectId: string) => ...,
      create: async (data: Phase) => ...,
      update: async (id: string, data: Partial<Phase>) => ...,
      delete: async (id: string) => ...
    }
    // ... weitere Tables
  };
  ```

- [ ] **Firestore → PostgreSQL Migration**
  ```typescript
  // ALT (Firebase)
  db.collection('projects').doc(id).set(data);
  
  // NEU (PostgreSQL)
  await db.projects.create(data);
  ```

- [ ] **Realtime-Updates implementieren**
  - Option A: PostgreSQL LISTEN/NOTIFY + WebSocket
  - Option B: Polling alle 5 Sekunden (einfacher)
  - Option C: Server-Sent Events (SSE)

- [ ] **File Storage migrieren**
  - Firebase Storage → Lokales Dateisystem oder MinIO/S3
  - Upload-Endpoint: `POST /api/upload`
  - Dateien speichern unter: `/uploads/{userId}/{filename}`

---

### 5.3 Ziel 3: Lokales Hosting

**Priorität:** 🟡 WICHTIG

**Aufgaben:**

- [ ] **Caddyfile konfigurieren**
  ```caddy
  # /root/.openclaw/workspace/zeitplanung-ki/Caddyfile
  
  :80 {
      # Frontend
      handle /zeitplanung/* {
          uri strip_prefix /zeitplanung
          root * /var/www/zeitplanung-ki/dist
          try_files {uri} /index.html
          file_server
      }
      
      # Backend API
      handle /api/* {
          reverse_proxy localhost:3000
      }
      
      # WebSocket
      handle /ws {
          reverse_proxy localhost:3000 {
              header_up Upgrade {http.request.header.Upgrade}
              header_up Connection {http.request.header.Connection}
          }
      }
  }
  ```

- [ ] **Build-Pipeline einrichten**
  ```bash
  # Build-Skript
  npm run build          # Vite Build → dist/
  cp -r dist/* /var/www/zeitplanung-ki/
  systemctl restart caddy
  ```

- [ ] **Environment Variables setzen**
  ```bash
  # /etc/environment oder .env
  QWEN_API_KEY=sk-...
  DATABASE_URL=postgresql://user:pass@localhost:5432/zeitplanung
  PORT=3000
  NODE_ENV=production
  ```

- [ ] **Systemd Service erstellen**
  ```ini
  # /etc/systemd/system/zeitplanung-server.service
  [Unit]
  Description=Zeitplanung Backend Server
  After=network.target postgresql.service
  
  [Service]
  Type=simple
  User=www-data
  WorkingDirectory=/root/.openclaw/workspace/zeitplanung-ki/server
  ExecStart=/usr/bin/node server.js
  Restart=always
  Environment=NODE_ENV=production
  
  [Install]
  WantedBy=multi-user.target
  ```

- [ ] **CI/CD Pipeline (optional)**
  - GitHub Actions oder GitLab CI
  - Auto-Deploy bei Push auf main

---

### 5.4 Ziel 4: Datenschutz & Compliance

**Priorität:** 🟡 WICHTIG

**Aufgaben:**

- [ ] **Keine Daten an Google senden**
  - ✅ Qwen lokal oder EU-Cloud (Bailian Frankfurt?)
  - ✅ Firebase Firestore → PostgreSQL lokal

- [ ] **Alle Daten lokal speichern**
  - ✅ Datenbank auf eigenem Server
  - ✅ Files im lokalen Dateisystem

- [ ] **DSGVO Compliance prüfen**
  - [ ] Privacy Policy erstellen
  - [ ] Datenverarbeitungsverzeichnis führen
  - [ ] Löschkonzept implementieren
  - [ ] Export-Funktion für User-Daten

- [ ] **Backup-Strategie implementieren**
  ```bash
  # Daily Backup Script
  pg_dump zeitplanung > /backups/zeitplanung_$(date +%Y%m%d).sql
  
  # Weekly Offsite
  rsync -avz /backups/ user@offsite:/backups/
  ```

- [ ] **Verschlüsselung**
  - [ ] Database Encryption at Rest
  - [ ] TLS für API (Caddy übernimmt)
  - [ ] Sensitive Daten verschlüsseln (API Keys in .env)

---

## 6. Offene Fragen & Risiken

### 6.1 Offene Fragen

#### 6.1.1 Qwen Model Auswahl

**Frage:** Welches Qwen Model für welche Aufgabe?

**Analyse:**

| Aufgabe | Gemini Original | Qwen Empfehlung | Begründung |
|---------|-----------------|-----------------|------------|
| Audio STT | `gemini-2.0-flash-exp` | **Whisper** (lokal) | Qwen hat kein natives Audio STT |
| Intent Detection | `gemini-3-flash-preview` | `qwen3.5-plus` | Gute Text-Klassifizierung |
| Project Parsing | `gemini-3-flash-preview` | `qwen3.5-plus` | Balanced Performance/Cost |
| Liquid Schedule | `gemini-3-flash-preview` | `qwen3-coder-plus` | Logik-intensive Aufgabe |
| Phase Generation | `gemini-3-flash-preview` | `qwen3.5-plus` | Kreative Aufgabe |
| Management Parse | `gemini-3-flash-preview` | `qwen3-coder-plus` | Strukturierte JSON-Ausgabe |

**Empfehlung:**
- Primär: `qwen3.5-plus` für alle Text-Aufgaben
- Für komplexe Logik: `qwen3-coder-plus`
- Für Audio: Separate Whisper-Integration

---

#### 6.1.2 Audio Transkription

**Frage:** Qwen kann kein Audio direkt transkribieren. Lösung?

**Optionen:**

| Option | Beschreibung | Aufwand | Qualität |
|--------|--------------|---------|----------|
| **Whisper (lokal)** | `whisper.cpp` oder `faster-whisper` | 🟡 Mittel | 🟢 Sehr gut |
| **Whisper API** | OpenAI Whisper API | 🟢 Niedrig | 🟢 Sehr gut |
| **Vosk** | Offline STT Engine | 🟡 Mittel | 🟡 Gut |
| **Feature entfernen** | Nur Text-Input | 🟢 Kein | 🔴 Feature Loss |

**Empfehlung:** 
- **Whisper lokal** mit `whisper.cpp` (GGML Format)
- Model: `medium` oder `large-v3` für Deutsch
- Integration als separater Service oder Node.js Binding

**Implementierung:**
```typescript
// services/whisperService.ts
import { whisper } from 'node-whisper'; // Oder exec von whisper.cpp

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  // Base64 → WAV File
  const wavPath = `/tmp/audio_${Date.now()}.wav`;
  await fs.writeFile(wavPath, Buffer.from(base64Audio, 'base64'));
  
  // Whisper transcribe
  const result = await whisper({
    audio: wavPath,
    model: 'medium',
    language: 'de'
  });
  
  // Cleanup
  await fs.unlink(wavPath);
  
  return result.text;
};
```

---

#### 6.1.3 Datenbank-Schema

**Frage:** Wie komplex ist das Firebase Schema? Müssen Daten migriert werden?

**Analyse:**

**Firebase Struktur:**
```
/projects/{projectId}
  - id, userId, title, totalHours, startDate, deadline, color
  - attachments[], description, isTimeOff, isExternal, location

/phases/{phaseId}
  - id, projectId, name, hours, suggestedDate, status
  - isGhost, isExternal

/bugs/{bugId}
  - id, reporterId, reporterName, title, description
  - priority, status, createdAt, updatedAt
  - attachmentUrl, hasUnreadUpdate
  - comments[] (Subcollection)

/sharedViews/{viewId}
  - id, creatorId, config{}, createdAt

/inboundRequests/{requestId}
  - id, shareViewId, creatorId, guestName, requestText
  - priority, status, createdAt
```

**Migration:**
- ✅ Schema ist flach und einfach
- ✅ Keine komplexen Relationsgeflechte
- ✅ Firebase Export als JSON möglich
- ✅ PostgreSQL Import mit Skript machbar

**Empfehlung:**
- Firebase Export durchführen (`gcloud firestore export`)
- JSON → SQL Migration Script schreiben
- Test-Migration auf Staging-Umgebung

---

#### 6.1.4 WebSocket Streaming

**Frage:** Unterstützt Qwen WebSocket Streaming?

**Recherche-Ergebnis:**

| Anbieter | WebSocket | HTTP Streaming | Server-Sent Events |
|----------|-----------|----------------|-------------------|
| **Bailian Cloud** | ❓ Unklar | ✅ Ja | ❓ Unklar |
| **Lokal (Ollama)** | ❌ Nein | ✅ Ja | ✅ Ja |
| **Lokal (vLLM)** | ❌ Nein | ✅ Ja | ✅ Ja |

**Empfehlung:**
- **HTTP Streaming** als primäre Methode
- WebSocket-Fallback entfernen oder adaptieren
- Server-Sent Events (SSE) als Alternative prüfen

**Implementierung (HTTP Streaming):**
```typescript
// server.js
app.post('/api/qwen/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const stream = await qwen.chat.completions.create({
    model: 'qwen3.5-plus',
    messages: req.body.messages,
    stream: true
  });
  
  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  
  res.end();
});
```

---

### 6.2 Risiken

#### 6.2.1 Feature Loss

**Risiko:** Bestimmte Gemini Features sind bei Qwen nicht verfügbar

**Betroffene Features:**

| Feature | Gemini | Qwen | Impact |
|---------|--------|------|--------|
| Native Audio STT | ✅ | ❌ | 🟡 Mittel (Whisper nötig) |
| Multimodal (Bilder) | ✅ | ✅ | 🟢 Kein Impact |
| JSON Schema | ✅ | ⚠️ Partial | 🟡 Mittel (Prompt Engineering) |
| Function Calling | ✅ | ⚠️ Partial | 🟡 Mittel |

**Mitigation:**
- Audio STT mit Whisper lösen
- JSON Schema durch strikte System Prompts ersetzen
- Function Calling durch strukturierte Outputs ersetzen

---

#### 6.2.2 Performance

**Risiko:** Lokale DB langsamer als Firebase? Qwen API Latenz vs. Gemini?

**Analyse:**

| Komponente | Firebase/Gemini | Lokal/Qwen | Erwartung |
|------------|-----------------|------------|-----------|
| DB Read | ~50ms | ~5ms (lokal) | 🟢 Schneller |
| DB Write | ~100ms | ~10ms (lokal) | 🟢 Schneller |
| KI Latenz | ~500-2000ms | ~1000-5000ms | 🟡 Langsamer (lokal) |
| KI Latenz (Cloud) | ~500-2000ms | ~500-2000ms | 🟢 Vergleichbar |

**Mitigation:**
- PostgreSQL Indexes optimieren
- Qwen Cloud für Production (Bailian)
- Caching für häufige Anfragen
- Optimistic UI Updates

---

#### 6.2.3 Kompatibilität

**Risiko:** API Response Format anders? Prompt Engineering anpassen?

**Analyse:**

**Gemini Response:**
```json
{
  "text": "{...JSON...}",
  "usageMetadata": {...}
}
```

**Qwen Response (Bailian):**
```json
{
  "choices": [{
    "message": {
      "content": "{...JSON...}"
    }
  }],
  "usage": {...}
}
```

**Mitigation:**
- Response Parser anpassen
- JSON-Parsing mit Retry-Logic (falls KI malformed JSON liefert)
- Fallback auf nicht-strukturierte Ausgabe

**Prompt Engineering:**
- Gemini: `responseMimeType: "application/json"`
- Qwen: System Prompt `"Antworte IMMER als valides JSON..."`
- Testen mit gleichen Prompts, Output vergleichen

---

#### 6.2.4 Daten-Migration

**Risiko:** Datenverlust bei Firebase → PostgreSQL Migration

**Mitigation:**
1. **Backup erstellen:**
   ```bash
   gcloud firestore export gs://zeitplanung-backup/
   ```

2. **Migration Script testen:**
   - Auf Staging-Umgebung
   - Mit kopierten Production-Daten

3. **Dual-Write Phase:**
   - Für 1-2 Wochen in beide Systeme schreiben
   - Daten konsistenz prüfen

4. **Rollback Plan:**
   - Firebase bleibt lesend aktiv
   - Bei Problemen: Switch zurück

---

## 7. Empfohlene Migrations-Strategie

### 7.1 Phasen-Plan

#### Phase 1: Vorbereitung (Woche 1-2)

- [ ] Qwen API Zugang einrichten (Bailian oder lokal)
- [ ] PostgreSQL installieren und konfigurieren
- [ ] Datenbank-Schema erstellen
- [ ] Backup von Firebase Daten erstellen
- [ ] Development-Umgebung setuppen

#### Phase 2: Qwen Integration (Woche 3-4)

- [ ] `geminiService.ts` → `qwenService.ts` umbenennen
- [ ] API Client implementieren
- [ ] Alle KI-Funktionen migrieren
- [ ] Audio STT mit Whisper integrieren
- [ ] Unit Tests für qwenService.ts

#### Phase 3: Datenbank-Migration (Woche 5-6)

- [ ] `firebase.ts` → `database.ts` erstellen
- [ ] CRUD-Operationen implementieren
- [ ] Realtime-Updates (Polling oder LISTEN/NOTIFY)
- [ ] File-Storage migrieren
- [ ] Migration Script testen

#### Phase 4: App.tsx Anpassung (Woche 7)

- [ ] Imports aktualisieren
- [ ] Firebase Calls durch REST/DB Calls ersetzen
- [ ] Error Handling anpassen
- [ ] Integrationstests

#### Phase 5: Server-Anpassung (Woche 8)

- [ ] Gemini Proxy durch Qwen Proxy ersetzen
- [ ] REST API Endpoints hinzufügen
- [ ] WebSocket/SSE für Realtime
- [ ] Rate Limiting konfigurieren

#### Phase 6: Testing & QA (Woche 9-10)

- [ ] End-to-End Tests
- [ ] Performance Tests
- [ ] Security Audit
- [ ] User Acceptance Testing (Bastian, Martin)

#### Phase 7: Deployment (Woche 11)

- [ ] Production-Server einrichten
- [ ] Caddy konfigurieren
- [ ] Database Migration durchführen
- [ ] Go-Live
- [ ] Monitoring einrichten

---

### 7.2 Success Metrics

| Metrik | Ziel | Messung |
|--------|------|---------|
| **API Latenz** | < 2000ms | Response Time Monitoring |
| **DB Query Time** | < 50ms | PostgreSQL Logs |
| **Feature Parity** | 100% | Feature-Checkliste |
| **Daten-Konsistenz** | 100% | Validation Scripts |
| **User Satisfaction** | > 4/5 | User Feedback |

---

### 7.3 Rollback-Plan

**Bei kritischen Problemen:**

1. **Sofort-Maßnahmen:**
   - Traffic auf Firebase/Gemini zurückleiten
   - Caddy Config reverten
   - User benachrichtigen

2. **Problem-Analyse:**
   - Logs auswerten
   - Error-Reports sammeln
   - Root Cause identifizieren

3. **Fix & Re-Deploy:**
   - Bug fixen
   - Testing wiederholen
   - Erneuter Deploy-Versuch

---

## 8. Anhang: Datei-Referenz

### 8.1 Vollständige Dateiliste

```
zeitplanung-ki/
├── ANALYSE_UND_ZIELSETZUNG.md    # Dieses Dokument
├── README.md                      # Original README (Google)
├── metadata.json                  # Projekt-Metadaten
├── package.json                   # Frontend Dependencies
├── tsconfig.json                  # TypeScript Config
├── vite.config.ts                 # Vite Config
├── index.tsx                      # Entry Point
├── App.tsx                        # Hauptkomponente (64KB)
├── types.ts                       # TypeScript Interfaces
├── utils.ts                       # Helper Functions
├── share.md                       # Share Feature Docs
│
├── lib/
│   └── firebase.ts                # Firebase Config (🔴)
│
├── services/
│   ├── geminiService.ts           # KI-Service (29KB, 🔴)
│   └── shareService.ts            # Share Service
│
├── components/
│   ├── MagicInput.tsx             # Input Component
│   ├── HeatmapCalendar.tsx        # Kalender
│   ├── PlanProposal.tsx           # KI-Vorschläge
│   ├── ProjectList.tsx            # Projektliste
│   ├── EditProjectModal.tsx       # Edit Modal
│   ├── FocusMode.tsx              # Fokus-Modus
│   ├── TimelineWidget.tsx         # Zeitstrahl
│   ├── QuickEditModal.tsx         # Quick Edit
│   ├── BugTrackerModal.tsx        # Bug Tracker
│   ├── CapacityTrend.tsx          # Kapazitätstrend
│   ├── ZoomController.tsx         # Zoom
│   ├── ShareModal.tsx             # Teilen
│   ├── InboxModal.tsx             # Inbox
│   ├── GoldenVacationTile.tsx     # Urlaub
│   ├── ExternalMeetingTile.tsx    # Externe Meetings
│   ├── NewsWidget.tsx             # News
│   ├── DeleteConfirmModal.tsx     # Löschen
│   ├── TaskRequestModal.tsx       # Anfrage
│   └── SharedViewApp.tsx          # Shared View
│
├── utils/
│   ├── emailParser.ts             # E-Mail Parser
│   ├── pdfParser.ts               # PDF Parser
│   └── calendarParser.ts          # Kalender Parser
│
├── data/
│   └── changelog.ts               # Changelog
│
├── server/
│   ├── package.json               # Server Dependencies
│   ├── server.js                  # Express Server (🔴)
│   └── public/
│       ├── service-worker.js      # Service Worker
│       └── websocket-interceptor.js # WS Interceptor
│
└── dist/                          # Build Output (nicht im Repo)
```

### 8.2 Code-Statistiken

| Kategorie | Dateien | Zeilen (ca.) | Größe (ca.) |
|-----------|---------|--------------|-------------|
| **Core** | 3 | 2,500 | 100KB |
| **Components** | 18 | 4,500 | 180KB |
| **Services** | 2 | 900 | 35KB |
| **Utils** | 4 | 400 | 15KB |
| **Server** | 3 | 400 | 20KB |
| **Gesamt** | 30 | 8,700 | 350KB |

### 8.3 Wichtige Code-Stellen

**App.tsx - Key Functions:**
- Zeile 280-400: `handleAIRequest()` - Haupt-Input-Verarbeitung
- Zeile 600-750: `handleAcceptProposal()` - Speichern
- Zeile 800-900: `handleMovePhase()` - Drag & Drop
- Zeile 1000-1100: `handleToggleSafeMode()` - Safe Mode

**geminiService.ts - Key Functions:**
- Zeile 10-40: `transcribeAudio()` - Audio STT
- Zeile 50-150: `calculateLiquidSchedule()` - Liquid Flow
- Zeile 200-400: `parseProjectRequest()` - Projekt-Parsing
- Zeile 450-550: `rebalanceSchedule()` - Rebalancing

**server.js - Key Routes:**
- Zeile 50-150: `/api-proxy` HTTP Proxy
- Zeile 200-300: `/` Serve index.html
- Zeile 350-450: WebSocket Upgrade Handler

---

## Schlussbemerkung

Diese Dokumentation bietet eine umfassende Grundlage für die Migration des KI-Zeitplanungstools von Google Gemini/Firebase zu einem lokalen Stack mit Qwen API und PostgreSQL. 

**Nächste Schritte:**
1. Dokumentation im Team reviewen
2. Offene Fragen klären (insb. Qwen Model-Auswahl, Audio STT)
3. Migrations-Plan finalisieren
4. Phase 1 beginnen (Vorbereitung)

**Kontakt bei Fragen:**
- OpenClaw Code Analyst Subagent
- Dokumentation: `/root/.openclaw/workspace/zeitplanung-ki/ANALYSE_UND_ZIELSETZUNG.md`

---

*Dokument erstellt am 27. März 2026*  
*OpenClaw Code Analyst - Zeitplanung Code Analyst Session*
