# Agent Lifecycle Management Konzept

## 🚨 Current Problems

### Problem 1: Agents bleiben auf "running" hängen
- **Symptom:** Agent zeigt Status "running" obwohl längst fertig
- **Ursache:** Completion Events werden nicht zuverlässig verarbeitet
- **Folge:** Ressourcen blockiert, Dashboard zeigt falsche Infos

### Problem 2: False Positive Timeouts
- **Symptom:** Agents werden auf "timeout" gesetzt obwohl sie noch arbeiten
- **Ursache:** Feste Timeout-Zeiten (z.B. 2h) ohne Kontext
- **Folge:** Datenverlust, abgebrochene Tasks, frustrierte User

### Problem 3: Vorzeitiges Beenden
- **Symptom:** Agents werden gekillt bevor sie fertig sind
- **Ursache:** Keine Unterscheidung zwischen "langsam" und "hängend"
- **Folge:** Unvollständige Ergebnisse, manuelles Neustarten nötig

### Problem 4: Manuelles Cleanup
- **Symptom:** Hängende Agents müssen manuell identifiziert und entfernt werden
- **Ursache:** Kein automatisches Dead-Agent-Detection
- **Folge:** Admin-Aufwand, vergessene Agents konsumieren Ressourcen

---

## ✅ Solution Overview

### Kernprinzipien

1. **Trust but Verify** – Gehe davon aus dass Agents laufen, aber verifiziere regelmäßig
2. **Multi-Layer Detection** – Einzelne Fehlerquellen sollen nicht zum Timeout führen
3. **Graceful Degradation** – Lieber zu geduldig als zu aggressiv beim Killen
4. **Observability First** – Jeder Zustand muss im Dashboard sichtbar sein

### Die 3 Säulen

```
┌─────────────────────────────────────────────────────────────┐
│                    LIFECYCLE MANAGEMENT                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  HEARTBEAT   │  │  COMPLETION  │  │    SAFETY    │       │
│  │    SYSTEM    │  │  DETECTION   │  │    NETS      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  • Agent pingt     • Event-Listener   • Max Runtime        │
│    regelmäßig      • API Polling      • Hard Timeout       │
│  • Last Seen       • Double-Check     • Zombie Detection   │
│    anzeigen        • State Validate   • Auto Cleanup       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Agent States

### State Machine

```
                    ┌─────────────┐
                    │   PENDING   │
                    │  (created)  │
                    └──────┬──────┘
                           │ start()
                           ▼
                    ┌─────────────┐
         ┌─────────▶│   RUNNING   │◀─────────┐
         │          │  (active)   │          │
         │          └──────┬──────┘          │ heartbeat
         │                 │                 │
         │                 │                 │
    ┌────┴────┐      ┌─────┴─────┐     ┌────┴────┐
    │ FAILED  │      │   DONE    │     │ TIMEOUT │
    │ (error) │      │(complete) │     │ (dead)  │
    └─────────┘      └───────────┘     └─────────┘
```

### State Transitions

| Von | Nach | Bedingung |
|-----|------|-----------|
| `pending` | `running` | Agent wurde erfolgreich gestartet |
| `running` | `done` | Completion Event + API bestätigt fertig |
| `running` | `failed` | Unrecoverable Error während Execution |
| `running` | `timeout` | **NUR** wenn ALLE Checks negativ (siehe unten) |
| `running` | `running` | Heartbeat empfangen (reset timeout counter) |

### State Metadata

Jeder Agent speichert:

```typescript
interface AgentState {
  status: 'pending' | 'running' | 'done' | 'failed' | 'timeout';
  
  // Timing
  createdAt: number;           // Timestamp Erstellung
  startedAt?: number;          // Timestamp Start
  completedAt?: number;        // Timestamp Fertig
  lastHeartbeat?: number;      // Timestamp letzter Heartbeat
  
  // Heartbeat Tracking
  heartbeatCount: number;      // Anzahl empfangener Heartbeats
  missedHeartbeats: number;    // Anzahl verpasster Heartbeats (consecutive)
  
  // Completion Tracking
  completionEventReceived: boolean;
  completionEventAt?: number;
  apiPollingConfirmed: boolean;
  apiPollingConfirmedAt?: number;
  
  // Safety Net
  expectedCompletionAt?: number;  // Wenn Agent selbst schätzt
  gracePeriodEndsAt?: number;     // Grace Period Ende
}
```

---

## 💓 Heartbeat System

### Wie es funktioniert

```
┌─────────────────┐                          ┌─────────────────┐
│     AGENT       │                          │  ORCHESTRATOR   │
│                 │                          │                 │
│  while running: │                          │  setInterval(   │
│    send({       │───── HTTP POST ──────────▶│    60000,       │
│      type:      │     /agents/:id/heartbeat │    checkAgents  │
│      'heartbeat'│     {                     │  )              │
│      timestamp: │       timestamp: Date.now()│                 │
│      status:    │       status: 'running'   │  Pruefe alle    │
│      progress:  │       progress: 45        │  Agents auf:    │
│    })           │     }                     │  • lastHeartbeat│
│                 │                          │  • missedCount  │
│    alle 30s     │                          │  • runtime      │
└─────────────────┘                          └─────────────────┘
```

### Heartbeat Endpoint

```typescript
// POST /api/agents/:agentId/heartbeat
{
  timestamp: number;      // Client-side timestamp
  status: 'running';      // Agent bestätigt noch aktiv
  progress?: number;      // Optional: 0-100 Fortschritt
  message?: string;       // Optional: Status message
  expectedCompletion?: number; // Optional: ETA in ms
}
```

### Heartbeat Logik

```typescript
function handleHeartbeat(agentId: string, payload: HeartbeatPayload) {
  const agent = getAgent(agentId);
  
  // Update State
  agent.lastHeartbeat = Date.now();
  agent.heartbeatCount++;
  agent.missedHeartbeats = 0;  // Reset counter!
  
  // Update expected completion wenn mitgeliefert
  if (payload.expectedCompletion) {
    agent.expectedCompletionAt = Date.now() + payload.expectedCompletion;
    agent.gracePeriodEndsAt = agent.expectedCompletionAt + config.gracePeriod;
  }
  
  // Log für Debugging
  logger.debug(`Agent ${agentId} heartbeat #${agent.heartbeatCount}`);
}
```

### Timeout Thresholds

| Metrik | Warnung | Kritisch | Action |
|--------|---------|----------|--------|
| `missedHeartbeats` | 2 (1 Min) | 5 (2.5 Min) | Check einleiten |
| `lastHeartbeat` | > 5 Min | > 10 Min | Deep Check |
| `totalRuntime` | > 30 Min | > 1h | Alert Admin |
| `totalRuntime` | - | > 24h | Hard Timeout |

---

## 🎯 Multi-Layer Completion Detection

### Layer 1: Event-Based (Primary)

```typescript
// Agent sendet Completion Event wenn fertig
agent.on('complete', async (result) => {
  await api.post(`/agents/${agent.id}/complete`, {
    result,
    timestamp: Date.now(),
    runtime: Date.now() - agent.startedAt
  });
});
```

**Vorteile:**
- Sofortige Erkennung
- Agent-besteuert (weiß wann fertig)
- Kann Result direkt mitsenden

**Risiken:**
- Event könnte verloren gehen (Network, Crash)
- Agent könnte crashen VOR Event

### Layer 2: API Polling (Fallback)

```typescript
// Orchestrator pollt alle 30s bei running Agents > 1 Min
async function pollAgentCompletion(agentId: string) {
  try {
    const status = await api.get(`/subagents/${agentId}/status`);
    
    if (status.state === 'completed') {
      // Double-Check bevor wir updaten
      await verifyAndMarkComplete(agentId, status);
      return true;
    }
  } catch (error) {
    // API nicht erreichbar → nicht sofort timeout!
    logger.warn(`Polling failed for ${agentId}: ${error.message}`);
  }
  return false;
}
```

**Vorteile:**
- Unabhängig von Agent Events
- Erkennt auch "stille" Completions

**Risiken:**
- Polling Interval = Delay bis Erkennung
- API könnte falsch positives "completed" melden

### Layer 3: Subagent Existence Check (Double-Check)

```typescript
// Bevor wir timeout setzen: Prüfen ob Subagent noch existiert
async function verifySubagentExists(agentId: string): Promise<boolean> {
  try {
    const sessions = await sessions_list({ 
      limit: 100,
      // Filter nach agentId wenn möglich
    });
    
    return sessions.some(s => 
      s.id === agentId || 
      s.metadata?.parentAgent === agentId
    );
  } catch (error) {
    // Bei Fehler: "unknown" zurück, nicht "false"
    logger.warn(`Subagent check failed: ${error.message}`);
    return UNKNOWN; // Special value
  }
}
```

### Completion Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│            COMPLETION DETECTION LOGIC                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Completion Event       │
              │ received?              │
              └───────────┬────────────┘
                          │
            ┌─────────────┴─────────────┐
            │ YES                       │ NO
            ▼                           ▼
    ┌───────────────┐           ┌───────────────┐
    │ API Polling   │           │ API Polling   │
    │ confirms?     │           │ says complete?│
    └───────┬───────┘           └───────┬───────┘
            │                           │
      ┌─────┴─────┐               ┌─────┴─────┐
      │ YES       │ NO            │ YES       │ NO
      ▼           ▼               ▼           ▼
  ┌───────┐ ┌───────────┐    ┌───────────┐ ┌───────────┐
  │ DONE  │ │ Continue  │    │ Subagent  │ │ Continue  │
  │ ✅    │ │ Running   │    │ exists?   │ │ Running   │
  └───────┘ └───────────┘    └─────┬─────┘ └───────────┘
                                   │
                             ┌─────┴─────┐
                             │ YES       │ NO
                             ▼           ▼
                       ┌───────────┐ ┌───────────┐
                       │ DONE      │ │ SUSPECT   │
                       │ ✅        │ │ → Deep    │
                       └───────────┘ │   Check   │
                                     └───────────┘
```

---

## 🛡️ Safe Timeout Logic

### Die Goldene Regel

> **Ein Agent wird NUR auf "timeout" gesetzt wenn ALLE folgenden Bedingungen zutreffen:**
> 
> 1. ❌ Kein Heartbeat seit > 5 Minuten
> 2. ❌ Completion Event NICHT empfangen
> 3. ❌ API Polling zeigt NICHT "completed"
> 4. ❌ Subagent Existenz Check NEGATIV
> 5. ❌ Mindestens 2h seit Start vergangen

### Timeout Decision Algorithm

```typescript
async function evaluateTimeout(agent: Agent): Promise<'safe' | 'timeout' | 'unknown'> {
  const now = Date.now();
  const runtime = now - agent.startedAt;
  
  // === SAFETY NET: 24h Hard Limit ===
  if (runtime > config.maxRuntime) { // 24h
    logger.warn(`Agent ${agent.id} exceeded 24h hard limit`);
    return 'timeout';
  }
  
  // === EARLY EXIT: Agent ist noch jung (< 2h) ===
  if (runtime < config.minTimeoutAge) { // 2h
    return 'safe'; // Zu jung für Timeout
  }
  
  // === CHECK 1: Heartbeat ===
  const timeSinceHeartbeat = now - (agent.lastHeartbeat || agent.startedAt);
  if (timeSinceHeartbeat < config.heartbeatTimeout) { // 5 Min
    return 'safe'; // Heartbeat noch aktuell
  }
  
  // === CHECK 2: Completion Event ===
  if (agent.completionEventReceived) {
    // Event kam aber Status nicht updated? Bug!
    logger.warn(`Agent ${agent.id} has completion event but status != done`);
    await fixAgentStatus(agent.id, 'done');
    return 'safe';
  }
  
  // === CHECK 3: API Polling ===
  const apiStatus = await pollAgentCompletion(agent.id);
  if (apiStatus === 'completed') {
    await markAgentDone(agent.id);
    return 'safe';
  }
  if (apiStatus === 'running') {
    return 'safe'; // API sagt noch running
  }
  // apiStatus === 'unknown' (API error) → weiter prüfen
  
  // === CHECK 4: Subagent Existence ===
  const subagentExists = await verifySubagentExists(agent.id);
  if (subagentExists === true) {
    return 'safe'; // Subagent lebt noch
  }
  if (subagentExists === UNKNOWN) {
    // Können nicht prüfen → lieber geduldig
    logger.warn(`Cannot verify subagent ${agent.id}, being conservative`);
    return 'safe';
  }
  
  // === ALLE CHECKS NEGATIV → TIMEOUT ===
  logger.warn(`Agent ${agent.id} failed all checks, marking timeout`);
  return 'timeout';
}
```

### Grace Period Logic

```typescript
// Wenn Agent expectedCompletion meldet, geben wir Grace Period
function calculateGracePeriod(agent: Agent): number {
  if (!agent.expectedCompletionAt) {
    return config.gracePeriod; // Default 10 Min
  }
  
  const now = Date.now();
  const timeOverExpected = now - agent.expectedCompletionAt;
  
  // Noch innerhalb expected time?
  if (timeOverExpected < 0) {
    return config.gracePeriod; // Volle Grace Period
  }
  
  // Schon drüber, aber innerhalb Grace Period?
  if (timeOverExpected < config.gracePeriod) {
    return config.gracePeriod - timeOverExpected; // Restliche Grace Period
  }
  
  // Grace Period abgelaufen
  return 0;
}
```

### Timeout Action

```typescript
async function handleTimeout(agent: Agent) {
  // 1. Status updaten
  agent.status = 'timeout';
  agent.completedAt = Date.now();
  
  // 2. Subagent killen (wenn noch da)
  try {
    await sessions_spawn({ 
      action: 'kill',
      target: agent.subagentId 
    });
    logger.info(`Killed subagent ${agent.subagentId}`);
  } catch (error) {
    logger.warn(`Failed to kill subagent ${agent.subagentId}: ${error.message}`);
  }
  
  // 3. Cleanup (Ressourcen freigeben)
  await cleanupAgentResources(agent.id);
  
  // 4. Alert (nur wenn > 24h, sonst nur loggen)
  const runtime = Date.now() - agent.startedAt;
  if (runtime > config.maxRuntime) {
    await sendAlert(`Agent ${agent.id} timed out after 24h`);
  } else {
    logger.info(`Agent ${agent.id} timed out after ${formatDuration(runtime)}`);
  }
  
  // 5. State persistieren (für Debugging)
  await persistAgentState(agent);
}
```

---

## 🧹 Cleanup Rules

### Automatische Cleanup Phasen

```
┌─────────────────────────────────────────────────────────────┐
│                    CLEANUP WORKFLOW                          │
└─────────────────────────────────────────────────────────────┘

Phase 1: Soft Cleanup (bei Status → done/failed/timeout)
├─ Result speichern (wenn vorhanden)
├─ Temp Files archivieren
├─ Session Metadata finalisieren
└─ Status auf "archived" setzen (nach 24h)

Phase 2: Hard Cleanup (Agents im Status "done" > 7 Tage)
├─ Results exportieren (wenn configured)
├─ Agent Record löschen
├─ Logs komprimieren und archivieren
└─ Storage freigeben

Phase 3: Zombie Cleanup (täglich um 3:00)
├─ Alle "running" Agents > 2h prüfen
├─ Timeout Logic ausführen
├─ orphaned Subagents killen
└─ Report generieren
```

### Cleanup Konfiguration

```typescript
const cleanupConfig = {
  // Soft Cleanup Delay (wie lange保留 done Agents bevor archived)
  archiveAfter: 24 * 60 * 60 * 1000, // 24h
  
  // Hard Cleanup (wie lange archived Agents保留 bevor gelöscht)
  deleteAfter: 7 * 24 * 60 * 60 * 1000, // 7 Tage
  
  // Zombie Check Interval
  zombieCheckInterval: 60 * 60 * 1000, // 1h
  
  // Was保留 werden muss
  preserve: {
    results: true,      // Ergebnisse immer speichern
    logs: 'compressed', // Logs komprimiert archivieren
    metadata: 'forever' // Metadata nie löschen (für Audit)
  }
};
```

---

## 📊 Monitoring & Alerts

### Dashboard Metriken

| Metrik | Beschreibung | Update |
|--------|--------------|--------|
| `agents.total` | Alle Agents (alle States) | Real-time |
| `agents.running` | Aktuell laufende Agents | Real-time |
| `agents.pending` | Wartende Agents | Real-time |
| `agents.done` | Erfolgreich abgeschlossene | Real-time |
| `agents.failed` | Fehlgeschlagene | Real-time |
| `agents.timeout` | Timed out | Real-time |
| `agents.avgRuntime` | Durchschnittliche Laufzeit | 5 Min |
| `agents.maxRuntime` | Längster laufender Agent | Real-time |
| `heartbeats.missed` | Agents ohne Heartbeat > 5 Min | 1 Min |
| `heartbeats.oldest` | Ältester letzter Heartbeat | 1 Min |

### Alert Thresholds

```typescript
const alertConfig = {
  // Warning Level (Slack Message, kein Page)
  warning: {
    runningOver30Min: true,     // Agent > 30 Min laufend
    missedHeartbeats: 2,        // 2 verpasste Heartbeats
    failedLastHour: 5,          // 5 Failures in letzter Stunde
  },
  
  // Critical Level (Page On-Call)
  critical: {
    runningOver1h: true,        // Agent > 1h laufend
    missedHeartbeats: 5,        // 5 verpasste Heartbeats
    timeoutLastHour: 3,         // 3 Timeouts in letzter Stunde
    totalRunning: 50,           // > 50 Agents gleichzeitig
  },
  
  // Emergency Level (Immediate Action)
  emergency: {
    runningOver24h: true,       // Agent > 24h (should never happen)
    failedLastHour: 20,         // 20 Failures in letzter Stunde
  }
};
```

### Dashboard Views

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT LIFECYCLE DASHBOARD                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SUMMARY                                                     │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐   │
│  │ Total  │Running │Pending │ Done   │ Failed │Timeout │   │
│  │  1,234 │   12   │   3    │ 1,180  │   35   │    4   │   │
│  └────────┴────────┴────────┴────────┴────────┴────────┘   │
│                                                              │
│  RUNNING AGENTS (12)                                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Agent ID        │ Runtime  │ Last HB    │ Progress    │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ agent-abc123    │ 45 Min   │ 30s ago ✅ │ 67%         │ │
│  │ agent-def456    │ 1h 12m   │ 25s ago ✅ │ 23%         │ │
│  │ agent-ghi789    │ 2h 05m   │ 6 Min ⚠️   │ 89%         │ │
│  │ agent-jkl012    │ 3h 30m   │ 12 Min ❌  │ 45%         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ALERTS                                                      │
│  ⚠️ agent-ghi789: Last heartbeat 6 Min ago                  │
│  ❌ agent-jkl012: Last heartbeat 12 Min ago (checking...)   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Plan

### Phase 1: Heartbeat API (Week 1-2)

**Goals:**
- [ ] Heartbeat Endpoint implementieren (`POST /agents/:id/heartbeat`)
- [ ] Agent SDK um Heartbeat-Loop erweitern
- [ ] Last-Heartbeat Tracking in Database
- [ ] Basic Dashboard Integration

**Deliverables:**
- Heartbeat API Route
- Agent Library Update (auto-heartbeat)
- Database Schema Migration
- Dashboard Widget "Last Heartbeat"

**Success Metrics:**
- 95%+ der Agents senden regelmäßige Heartbeats
- Dashboard zeigt korrekte "Last Seen" Zeiten

---

### Phase 2: Completion Detection (Week 3-4)

**Goals:**
- [ ] Completion Event Handler robust implementieren
- [ ] API Polling Fallback (30s Interval)
- [ ] Subagent Existence Check
- [ ] Double-Check Logic vor Status-Update

**Deliverables:**
- Event Handler mit Retry Logic
- Polling Service (configurable Interval)
- Subagent Verification Module
- State Machine mit Validation

**Success Metrics:**
- 0 false-positive Completions
- < 60s Delay zwischen actual completion und detection
- 100% der Completions korrekt erkannt

---

### Phase 3: Safe Timeout (Week 5-6)

**Goals:**
- [ ] Timeout Decision Algorithm implementieren
- [ ] Grace Period Logic
- [ ] 24h Hard Safety Net
- [ ] Cleanup Workflow

**Deliverables:**
- Timeout Evaluator Service
- Grace Period Handler
- Cleanup Job (cron)
- Alert Integration

**Success Metrics:**
- 0 false-positive Timeouts
- Alle hängenden Agents innerhalb 3h erkannt
- Cleanup läuft ohne Datenverlust

---

### Phase 4: Monitoring & Alerts (Week 7-8)

**Goals:**
- [ ] Dashboard vollständig
- [ ] Alert Rules konfigurieren
- [ ] Reporting (täglich/wöchentlich)
- [ ] Runbook für Incidents

**Deliverables:**
- Vollständiges Dashboard
- Alert Config (Slack/PagerDuty)
- Daily/Weekly Reports
- Incident Runbook

**Success Metrics:**
- Mean Time To Detection < 5 Min
- Alert Fatigue < 5 false alerts/week
- 100% Visibility über alle Agents

---

## 📋 Configuration Options

### Vollständige Config

```typescript
interface AgentLifecycleConfig {
  // === HEARTBEAT ===
  heartbeatInterval: number;      // 30000 (30s) - Wie oft Agent pingt
  heartbeatTimeout: number;       // 300000 (5 Min) - Max Zeit ohne HB
  heartbeatEndpoint: string;      // '/api/agents/:id/heartbeat'
  
  // === COMPLETION DETECTION ===
  completionPollingInterval: number;  // 30000 (30s) - API Polling
  completionDoubleCheck: boolean;     // true - Vor Update verifizieren
  completionEventRetry: number;       // 3 - Retry attempts bei Failure
  
  // === TIMEOUT LOGIC ===
  minTimeoutAge: number;          // 7200000 (2h) - Mindestalter für Timeout
  maxRuntime: number;             // 86400000 (24h) - Hard Limit
  gracePeriod: number;            // 600000 (10 Min) - Nach expected done
  checkInterval: number;          // 60000 (1 Min) - Wie oft prüfen
  
  // === CLEANUP ===
  archiveAfter: number;           // 86400000 (24h) - Wann archivieren
  deleteAfter: number;            // 604800000 (7 Tage) - Wann löschen
  zombieCheckCron: string;        // '0 3 * * *' - Täglich 3:00
  
  // === ALERTS ===
  alertChannels: {
    warning: string[];            // ['slack:warnings']
    critical: string[];           // ['slack:critical', 'pagerduty']
    emergency: string[];          // ['slack:emergency', 'pagerduty', 'sms']
  };
  alertThresholds: AlertThresholds;
  
  // === MONITORING ===
  metricsEnabled: boolean;        // true - Prometheus Metrics
  dashboardEnabled: boolean;      // true - Web Dashboard
  loggingLevel: string;           // 'info' | 'debug' | 'warn'
}
```

### Default Config

```typescript
const defaultConfig: AgentLifecycleConfig = {
  // Heartbeat
  heartbeatInterval: 30000,       // 30 Sekunden
  heartbeatTimeout: 300000,       // 5 Minuten
  heartbeatEndpoint: '/api/agents/:id/heartbeat',
  
  // Completion
  completionPollingInterval: 30000,  // 30 Sekunden
  completionDoubleCheck: true,
  completionEventRetry: 3,
  
  // Timeout
  minTimeoutAge: 7200000,         // 2 Stunden
  maxRuntime: 86400000,           // 24 Stunden
  gracePeriod: 600000,            // 10 Minuten
  checkInterval: 60000,           // 1 Minute
  
  // Cleanup
  archiveAfter: 86400000,         // 24 Stunden
  deleteAfter: 604800000,         // 7 Tage
  zombieCheckCron: '0 3 * * *',   // Täglich 3:00 UTC
  
  // Alerts
  alertChannels: {
    warning: ['slack:warnings'],
    critical: ['slack:critical', 'pagerduty:oncall'],
    emergency: ['slack:emergency', 'pagerduty:oncall', 'sms:admin'],
  },
  
  // Monitoring
  metricsEnabled: true,
  dashboardEnabled: true,
  loggingLevel: 'info',
};
```

---

## 🔧 Data Flow Diagramm

### Complete Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT LIFECYCLE FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────┐
  │  CREATE  │
  │  Agent   │
  └────┬─────┘
       │
       ▼
  ┌──────────┐     ┌─────────────────────────────────────────┐
  │ PENDING  │────▶│ Wait for Start Signal                   │
  │          │     │ - Resources allocated                   │
  │ status:  │     │ - Subagent spawned                      │
  │ pending  │     │ - State persisted                       │
  └────┬─────┘     └─────────────────────────────────────────┘
       │
       │ start()
       ▼
  ┌──────────┐     ┌─────────────────────────────────────────┐
  │ RUNNING  │────▶│ MAIN EXECUTION LOOP                     │
  │          │     │                                         │
  │ status:  │     │  ┌─────────────────┐                   │
  │ running  │     │  │  HEARTBEAT LOOP │                   │
  │          │     │  │  (alle 30s)     │                   │
  │ startedAt│     │  │  POST /heartbeat│───────────┐       │
  │ = now    │     │  └─────────────────┘           │       │
  │          │     │                                │       │
  │          │     │  ┌─────────────────┐           │       │
  │          │     │  │  WORK EXECUTION │           │       │
  │          │     │  │  ...            │           │       │
  │          │     │  └─────────────────┘           │       │
  │          │     │                                │       │
  │          │     │  ┌─────────────────┐           │       │
  │          │     │  │  ON COMPLETE    │           │       │
  │          │     │  │  emit event     │───────────┼───┐   │
  │          │     │  └─────────────────┘           │   │   │
  └────┬─────┘     └────────────────────────────────┘   │   │
       │                                                │   │
       │              ┌─────────────────────────────────┘   │
       │              │                                     │
       │    ┌─────────┴──────────┐                         │
       │    │                    │                         │
       │    ▼                    ▼                         │
       │  ┌──────────┐      ┌──────────┐                  │
       │  │   DONE   │      │  FAILED  │                  │
       │  │          │      │          │                  │
       │  │ status:  │      │ status:  │                  │
       │  │ done     │      │ failed   │                  │
       │  │          │      │ error:   │                  │
       │  │ result:  │      │ message  │                  │
       │  │ {...}    │      │          │                  │
       │  └────┬─────┘      └────┬─────┘                  │
       │       │                 │                        │
       │       └────────┬────────┘                        │
       │                │                                  │
       │                ▼                                  │
       │         ┌──────────┐                             │
       │         │ CLEANUP  │                             │
       │         │ - Archive│                             │
       │         │ - Report │                             │
       │         └──────────┘                             │
       │                                                  │
       │              ORCHESTRATOR CHECK LOOP             │
       │              (alle 60s)                          │
       │                                                  │
       │    ┌─────────────────────────────────────┐      │
       │    │  FOR EACH running Agent:            │      │
       │    │                                     │      │
       │    │  1. Check Heartbeat Age             │◀─────┘
       │    │     lastHeartbeat > 5 Min?          │
       │    │                                     │
       │    │  2. Check Completion Event          │
       │    │     event received?                 │
       │    │                                     │
       │    │  3. API Polling                     │
       │    │     status = completed?             │
       │    │                                     │
       │    │  4. Subagent Check                  │
       │    │     exists?                         │
       │    │                                     │
       │    │  5. Runtime Check                   │
       │    │     runtime > 2h?                   │
       │    │                                     │
       │    │  → ALL NEGATIVE? → TIMEOUT          │
       │    └─────────────────────────────────────┘
       │
       │
       ▼
  ┌──────────┐     ┌─────────────────────────────────────────┐
  │ TIMEOUT  │────▶│ SAFE TIMEOUT LOGIC                      │
  │          │     │                                         │
  │ status:  │     │  IF runtime > 24h:                      │
  │ timeout  │     │    → Hard Timeout (immer)               │
  │          │     │                                         │
  │ reason:  │     │  ELSE IF runtime > 2h:                  │
  │ "no_hb"  │     │    → Check Heartbeat (5 Min)            │
  │          │     │    → Check Completion Event             │
  │          │     │    → Check API Status                   │
  │          │     │    → Check Subagent Exists              │
  │          │     │    → ALL negative? → Timeout            │
  │          │     │                                         │
  │          │     │  ELSE:                                  │
  │          │     │    → Too young, skip timeout            │
  └────┬─────┘     └─────────────────────────────────────────┘
       │
       ▼
  ┌──────────┐
 │ CLEANUP  │
 │ - Kill   │
 │ Subagent │
 │ - Archive│
 │ - Alert  │
 └──────────┘
```

### Heartbeat Flow Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                     HEARTBEAT MECHANISM                          │
└─────────────────────────────────────────────────────────────────┘

AGENT SIDE:
┌──────────────────────────────────────────────────────────────┐
│  Agent Process                                                │
│                                                               │
│  async function main() {                                      │
│    // Start Heartbeat Loop                                    │
│    const heartbeatInterval = setInterval(async () => {        │
│      await sendHeartbeat({                                    │
│        agentId: this.id,                                      │
│        timestamp: Date.now(),                                 │
│        status: 'running',                                     │
│        progress: this.getProgress(),                          │
│        expectedCompletion: this.getETA()                      │
│      });                                                      │
│    }, 30000); // 30 Sekunden                                  │
│                                                               │
│    // Execute Work                                            │
│    const result = await this.execute();                       │
│                                                               │
│    // Stop Heartbeat                                          │
│    clearInterval(heartbeatInterval);                          │
│                                                               │
│    // Send Completion                                         │
│    await this.complete(result);                               │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP POST /agents/:id/heartbeat
                            │ {
                            │   timestamp: 1711612800000,
                            │   status: 'running',
                            │   progress: 45,
                            │   expectedCompletion: 600000
                            │ }
                            ▼
ORCHESTRATOR SIDE:
┌──────────────────────────────────────────────────────────────┐
│  Express Route                                                │
│                                                               │
│  app.post('/agents/:agentId/heartbeat', async (req, res) => {│
│    const { agentId } = req.params;                            │
│    const { timestamp, status, progress, expectedCompletion }  │
│      = req.body;                                              │
│                                                               │
│    // Validate Agent exists & running                         │
│    const agent = await getAgent(agentId);                     │
│    if (!agent || agent.status !== 'running') {                │
│      return res.status(400).json({ error: 'Invalid agent' }); │
│    }                                                          │
│                                                               │
│    // Update State                                            │
│    await db.agents.update(agentId, {                          │
│      lastHeartbeat: Date.now(),                               │
│      heartbeatCount: agent.heartbeatCount + 1,                │
│      missedHeartbeats: 0,                                     │
│      expectedCompletionAt: expectedCompletion                 │
│        ? Date.now() + expectedCompletion                      │
│        : agent.expectedCompletionAt,                          │
│      gracePeriodEndsAt: expectedCompletion                    │
│        ? Date.now() + expectedCompletion + config.gracePeriod │
│        : agent.gracePeriodEndsAt                              │
│    });                                                        │
│                                                               │
│    // Log for debugging                                       │
│    logger.debug(`Heartbeat from ${agentId} (#${             │
│      agent.heartbeatCount + 1})`);                            │
│                                                               │
│    res.json({ ok: true });                                    │
│  });                                                          │
└──────────────────────────────────────────────────────────────┘

                            │
                            │ Database Update
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Database (agents table)                                      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ id: agent-abc123                                       │  │
│  │ status: running                                        │  │
│  │ startedAt: 1711610000000                               │  │
│  │ lastHeartbeat: 1711612800000  ← UPDATED               │  │
│  │ heartbeatCount: 94                                     │  │
│  │ missedHeartbeats: 0         ← RESET                   │  │
│  │ expectedCompletionAt: 1711613400000                    │  │
│  │ gracePeriodEndsAt: 1711614000000                       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 Success Criteria

### Definition of Done

Das Konzept ist erfolgreich implementiert wenn:

1. **Keine hängenden Agents mehr**
   - Alle Agents > 2h werden innerhalb 30 Min erkannt
   - 100% der hängenden Agents korrekt als "timeout" markiert

2. **Keine false positives**
   - 0 Agents die noch laufen werden als "timeout" markiert
   - Alle legitimen long-running Agents (auch > 4h) laufen durch

3. **Kein Datenverlust**
   - Alle Results werden vor Cleanup gespeichert
   - Alle Logs sind archiviert und zugreifbar

4. **Full Observability**
   - Dashboard zeigt alle States in Echtzeit
   - Alerts kommen < 5 Min nach Incident
   - Alle Metriken sind tracked

### KPIs

| Metrik | Before | Target | After |
|--------|--------|--------|-------|
| Hanging Agents (> 2h) | ~15/Woche | 0 | TBD |
| False Positive Timeouts | ~5/Woche | 0 | TBD |
| Mean Time To Detection | ~4h | < 30 Min | TBD |
| Data Loss Incidents | ~2/Monat | 0 | TBD |

---

## 📝 Anhang

### A. Database Schema

```sql
CREATE TABLE agents (
  id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) NOT NULL,  -- pending, running, done, failed, timeout
  
  -- Timing
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Heartbeat Tracking
  last_heartbeat TIMESTAMP,
  heartbeat_count INTEGER DEFAULT 0,
  missed_heartbeats INTEGER DEFAULT 0,
  
  -- Completion Tracking
  completion_event_received BOOLEAN DEFAULT FALSE,
  completion_event_at TIMESTAMP,
  api_polling_confirmed BOOLEAN DEFAULT FALSE,
  api_polling_confirmed_at TIMESTAMP,
  
  -- Safety Net
  expected_completion_at TIMESTAMP,
  grace_period_ends_at TIMESTAMP,
  
  -- Metadata
  parent_session_id VARCHAR(255),
  subagent_id VARCHAR(255),
  task_description TEXT,
  result JSONB,
  error_message TEXT,
  
  -- Audit
  created_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_last_heartbeat ON agents(last_heartbeat);
CREATE INDEX idx_agents_started_at ON agents(started_at);
```

### B. API Endpoints

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| `POST` | `/agents` | Neuen Agent erstellen |
| `GET` | `/agents` | Alle Agents (mit Filter) |
| `GET` | `/agents/:id` | Agent Details |
| `POST` | `/agents/:id/start` | Agent starten |
| `POST` | `/agents/:id/heartbeat` | Heartbeat empfangen |
| `POST` | `/agents/:id/complete` | Completion melden |
| `POST` | `/agents/:id/fail` | Failure melden |
| `DELETE` | `/agents/:id` | Agent löschen (soft) |
| `GET` | `/agents/stats` | Dashboard Stats |
| `GET` | `/agents/alerts` | Aktive Alerts |

### C. Error Codes

| Code | Beschreibung | Action |
|------|--------------|--------|
| `HB_TIMEOUT` | Kein Heartbeat > 5 Min | Deep Check |
| `HB_MISSING` | Kein Heartbeat > 10 Min | Timeout Candidate |
| `RUNTIME_EXCEEDED` | Runtime > 24h | Hard Timeout |
| `COMPLETION_MISMATCH` | Event aber Status != done | Auto-Fix |
| `SUBAGENT_LOST` | Subagent nicht mehr found | Check + Timeout |
| `API_UNREACHABLE` | Polling API antwortet nicht | Retry + Log |

---

**Dokument Version:** 1.0  
**Erstellt:** 2026-03-28  
**Autor:** Agent Lifecycle Concept Designer (Subagent)  
**Status:** ✅ Fertig zur Implementierung
