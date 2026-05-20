# Agent Logging Guide

## ✅ RICHTIGE Methode: Agents loggen sich SELBST!

---

## 🚫 **FALSCH (NICHT machen!):**

```javascript
// ❌ Auto-Ingest Service der nach 5 Min auf "done" setzt
// ❌ Agents automatisch nach Zeit updaten
// ❌ Dashboard pollt und setzt Status
```

**Warum falsch?**
- ❌ Agent läuft noch → Wird auf "done" gesetzt
- ❌ Status ist FALSCH!
- ❌ Dashboard zeigt falsche Daten!

---

## ✅ **RICHTIG (SO machen!):**

### **1. Wrapper-Funktion nutzen:**

```javascript
import { createCompleteAgent } from './lib/agent-complete.mjs';

// Beim Spawn:
const sessionKey = 'agent:main:subagent:my-agent-123';
const startTime = Date.now();
const complete = createCompleteAgent(sessionKey, startTime);

// ... Agent arbeitet ...

// Am ENDE (wenn FERTIG!):
await complete('done');  // ✅ Setzt Status auf "done"
// ODER bei Fehler:
await complete('failed', 'Error message');  // ✅ Setzt auf "failed"
```

### **2. Manuell loggen:**

```javascript
import { completeAgent } from './lib/agent-complete.mjs';

// Am ENDE des Agents:
await completeAgent(
  'agent:main:subagent:my-agent-123',  // Session Key
  'done',                               // Status
  startTime,                            // Startzeit
  null                                  // Error (optional)
);
```

### **3. API direkt nutzen:**

```javascript
// Am ENDE des Agents:
await fetch('http://localhost:3002/api/agents/end', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionKey: 'agent:main:subagent:my-agent-123',
    status: 'done',
    runtimeMs: Date.now() - startTime
  })
});
```

---

## 📋 **Komplettes Beispiel:**

```javascript
import { createCompleteAgent } from './lib/agent-complete.mjs';

// Agent startet
const sessionKey = `agent:main:subagent:my-task-${Date.now()}`;
const startTime = Date.now();
const complete = createCompleteAgent(sessionKey, startTime);

try {
  // ... Agent arbeitet ...
  await doSomeWork();
  await doMoreWork();
  
  // Fertig!
  await complete('done');
  console.log('✅ Agent completed successfully');
  
} catch (error) {
  // Fehler!
  await complete('failed', error.message);
  console.error('❌ Agent failed:', error);
}
```

---

## 🎯 **Wann wird geloggt?**

| Zeitpunkt | Status | Wer macht's? |
|-----------|--------|--------------|
| **Beim Spawn** | "running" | Main Agent (vor Spawn) |
| **Agent arbeitet** | "running" | - |
| **Agent fertig** | "done" | **Agent SELBST!** ✅ |
| **Agent Fehler** | "failed" | **Agent SELBST!** ✅ |

---

## 🔧 **Helfer-Dateien:**

| Datei | Zweck |
|-------|-------|
| `lib/agent-complete.mjs` | `completeAgent()` Funktion |
| `lib/spawn-with-logging.mjs` | Wrapper für Spawn + Log |
| `bin/log-agent-start` | CLI: Start loggen |
| `bin/log-agent-end` | CLI: Ende loggen |

---

## ✅ **Checkliste für Agent-Spawn:**

- [ ] **VOR Spawn:** `logAgentStart()` aufrufen
- [ ] **Session Key** notieren
- [ ] **Start Time** notieren
- [ ] **Agent spawnen**
- [ ] **Warten** auf Completion
- [ ] **NACH Completion:** Agent ruft `completeAgent()` auf
- [ ] **Status prüfen** im Dashboard

---

## 🎯 **Zusammenfassung:**

**NICHT:**
- ❌ Auto-Ingest Service
- ❌ Automatisch nach Zeit
- ❌ Dashboard setzt Status

**SONDERN:**
- ✅ Agent ruft `completeAgent()` auf
- ✅ Wenn er FERTIG ist
- ✅ Mit korrektem Status (done/failed)

---

**Das ist die EINZIG richtige Methode!** ✅
