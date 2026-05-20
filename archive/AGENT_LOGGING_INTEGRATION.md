# Agent Logging Integration Guide

Dieses Dokument beschreibt, wie Agenten das zentrale Logging-System verwenden können, um ihre Aktivitäten zu protokollieren.

## Installation

Stellen Sie sicher, dass die folgenden Abhängigkeiten installiert sind:

```bash
npm install pg
```

## Verwendung

### 1. Logger importieren

```javascript
import { logAgentStart, logAgentEnd } from './lib/agent-logger.mjs';
// oder für CommonJS:
// const { logAgentStart, logAgentEnd } = require('./lib/agent-logger.cjs');
```

### 2. Agent-Start protokollieren

Rufen Sie `logAgentStart()` am Anfang Ihrer Agent-Aufgabe auf:

```javascript
const sessionKey = 'einzigartige-session-id'; // z.B. UUID
const label = 'Mein Agent Name';
const task = 'Beschreibung der Aufgabe';
const model = 'qwen3.5-plus'; // verwendetes Modell
const parentSession = 'optionale-parent-session-id'; // falls Teil einer größeren Aufgabe

await logAgentStart(sessionKey, label, task, model, parentSession);
```

### 3. Agent-Ende protokollieren

Rufen Sie `logAgentEnd()` am Ende Ihrer Agent-Aufgabe auf:

```javascript
// Zeitmessung
const startTime = Date.now();
try {
  // Ihre Agent-Logik hier
  await yourAgentLogic();
  
  const endTime = Date.now();
  const runtimeMs = endTime - startTime;
  
  // Erfolgreiches Ende protokollieren
  await logAgentEnd(sessionKey, 'done', runtimeMs);
} catch (error) {
  const endTime = Date.now();
  const runtimeMs = endTime - startTime;
  
  // Fehlerhaftes Ende protokollieren
  await logAgentEnd(sessionKey, 'failed', runtimeMs, error.message);
}
```

## Beispiel

Hier ist ein vollständiges Beispiel für einen Agenten mit Logging:

```javascript
import { logAgentStart, logAgentEnd } from './lib/agent-logger.mjs';

async function exampleAgent(sessionKey, taskDescription) {
  const startTime = Date.now();
  
  try {
    // Agent-Start protokollieren
    await logAgentStart(
      sessionKey, 
      'Beispiel-Agent', 
      taskDescription, 
      'qwen3.5-plus'
    );
    
    // Ihre Agent-Logik hier
    console.log('Agent führt Aufgabe aus:', taskDescription);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simuliere Arbeit
    
    // Erfolgreiches Ende protokollieren
    const endTime = Date.now();
    const runtimeMs = endTime - startTime;
    await logAgentEnd(sessionKey, 'done', runtimeMs);
    
    return 'Erfolg!';
  } catch (error) {
    // Fehlerhaftes Ende protokollieren
    const endTime = Date.now();
    const runtimeMs = endTime - startTime;
    await logAgentEnd(sessionKey, 'failed', runtimeMs, error.message);
    throw error;
  }
}
```

## Datenbankstruktur

Die Agent-Aktivitäten werden in der Tabelle `agent_activities` gespeichert:

- `id`: Eindeutige ID (auto-increment)
- `session_key`: Eindeutiger Schlüssel für die Sitzung
- `label`: Anzeigename des Agenten
- `task`: Beschreibung der Aufgabe
- `status`: Status ('pending', 'running', 'done', 'failed')
- `model`: Verwendetes KI-Modell
- `runtime_ms`: Laufzeit in Millisekunden
- `started_at`: Startzeit
- `ended_at`: Endzeit
- `error_message`: Fehlermeldung (falls vorhanden)
- `parent_session`: Eltern-Sitzung (optional)

## API-Endpunkte

- `GET /api/agents`: Alle Agent-Aktivitäten (letzte 50)
- `GET /api/agents/active`: Nur aktive Agenten ('running', 'pending')

## Best Practices

1. Verwenden Sie eindeutige `session_key`s (z.B. UUIDs)
2. Stellen Sie sicher, dass `logAgentEnd()` immer aufgerufen wird - auch bei Fehlern
3. Nutzen Sie aussagekräftige Labels und Aufgabenbeschreibungen
4. Messen Sie die Laufzeit korrekt
5. Protokollieren Sie aussagekräftige Fehlermeldungen