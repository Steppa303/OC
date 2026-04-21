# Dashboard Cleanup Solution

## Problem
Das Dashboard wird NICHT zuverlässig bereinigt wenn Agents fertig sind.
- Agents bleiben auf "running" stehen
- Status wird nicht aktualisiert
- Manuelles Cleanup nötig
- Ursache: `logAgentEnd()` wird NICHT automatisch nach Completion aufgerufen

## Lösung implementiert

### 1. ✅ Problem analysiert:
- Agents werden mit `sessions_spawn` erstellt
- `logAgentStart()` wird aufgerufen, aber `logAgentEnd()` oft vergessen
- Completion-Events kommen als User-Messages, nicht automatisch verarbeitet
- Kein Mechanismus für automatisches Cleanup von hängenden Agenten

### 2. ✅ Lösung implementiert (automatisches Cleanup):

#### Option A: Wrapper-Funktion (implementiert)
- `startManagedAgent()` - Startet Agent mit automatischem Logging
- `completeManagedAgent()` - Beendet Agent mit automatischem Logging
- `withAutomaticCleanup()` - Hilfsfunktion mit try/catch für automatisches Logging

#### Option B: Hook/Callback (implementiert)
- `startAutomaticCleanup()` - Startet Hintergrund-Service
- Erkennt und behebt hängende Agenten automatisch
- Prüft regelmäßig Agenten, die länger als X Minuten laufen

#### Option C: Background-Cleanup (implementiert)
- `detectAndFixHangingAgents()` - Findet und behebt hängende Agenten
- `startHangingAgentDetection()` - Startet regelmäßige Bereinigung

### 3. ✅ Testing durchgeführt:
- Neue Funktionen getestet und validiert
- Hängende Agenten korrekt identifiziert und bereinigt
- Dashboard zeigt korrekte Statuswerte

### 4. ✅ Code an richtige Stelle implementiert:
- `/root/.openclaw/workspace/lib/automatic-dashboard-cleanup.mjs` - Hauptlösung
- `/root/.openclaw/workspace/lib/hanging-agent-detector.mjs` - Hängende Agenten Detection
- `/root/.openclaw/workspace/agent-dashboard/INTEGRATION.md` - Dokumentation
- `/root/.openclaw/workspace/lib/dashboard-automation.mjs` - Bündelung aller Funktionen

## Anwendung

### Sofortige Bereinigung:
```javascript
import { startAutomaticCleanup } from './lib/automatic-dashboard-cleanup.mjs';

// Startet automatische Bereinigung
const cleanupService = startAutomaticCleanup({
  intervalMinutes: 30,    // Alle 30 Min Bereinigung
  maxAgeMinutes: 60,      // Agenten >60 Min als timeout
  immediateCheck: true    // Sofortige Prüfung
});
```

### Neue Agenten erstellen:
```javascript
import { startManagedAgent, completeManagedAgent, withAutomaticCleanup } from './lib/automatic-dashboard-cleanup.mjs';

// Neuen Agent starten
await startManagedAgent({
  sessionKey: 'my-agent-123',
  label: 'Mein Agent',
  task: 'Führt Aufgaben durch',
  model: 'qwen3.5-plus'
});

// Agent mit automatischem Cleanup
await withAutomaticCleanup(async () => {
  // Agent-Logik hier
  await doWork();
}, 'my-agent-123');
```

## Dateien

- `lib/automatic-dashboard-cleanup.mjs` - Hauptlösung mit vollständigem Management
- `lib/hanging-agent-detector.mjs` - Erkennung und Bereinigung hängender Agenten
- `lib/dashboard-automation.mjs` - Bündelung aller Dashboard-Funktionen
- `lib/managed-sessions-spawn.mjs` - Managed sessions wrapper
- `lib/auto-complete-logger.mjs` - Auto-complete logging
- `lib/background-cleaner.mjs` - Hintergrund-Bereinigung
- `agent-dashboard/INTEGRATION.md` - Vollständige Dokumentation

## Benefits

✅ **Automatisches Logging**: Agents werden automatisch gestartet/beendet geloggt
✅ **Hängende Agenten werden erkannt**: Regelmäßige Prüfung auf lange laufende Agenten
✅ **Kein manuelles Cleanup mehr nötig**: Vollautomatische Bereinigung
✅ **Robuste Fehlerbehandlung**: Auch bei Fehlern wird korrekt geloggt
✅ **Leicht zu integrieren**: Einfache API für neue Agenten
✅ **Skalierbar**: Funktioniert für beliebig viele gleichzeitige Agenten

Die Lösung ist vollständig implementiert und betriebsbereit!