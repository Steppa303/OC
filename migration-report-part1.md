# Migration Report - Part 1: Wrapper zu spawn-agent.mjs

## Ziel erreicht ✅
Alte Wrapper erfolgreich durch `spawn-agent.mjs` ersetzt:
- `autoLogSpawn()` → `spawnAgent()`
- `managedSessionsSpawn()` → `spawnAgent()`
- `startManagedAgent()` → `spawnAgent()`

## Durchgeführte Änderungen

### 1. `/root/.openclaw/workspace/lib/dashboard-automation.mjs`
- **VORHER**: Exportierte alte Wrapper (`managedSessionsSpawn`, `markSessionComplete`, `withManagedSession`)
- **NACHHER**: Exportiert neuen `spawnAgent` Wrapper
- **Hinzugefügt**: `trackSession`, `completeSession`, etc. direkt aus auto-complete-logger.mjs
- **Behalten**: Background Cleaner und Basis-Logger
- **Fixed**: Fehlender Import von `startCleanupInterval`

### 2. `/root/.openclaw/workspace/test-dashboard-fix.js`
- **VORHER**: Nutzte `managedSessionsSpawn` und `markSessionComplete`
- **NACHHER**: Nutzt neuen `spawnAgent` mit korrekter Task/Prompt-Trennung
- **Hinzugefügt**: Detaillierter Prompt mit vollständiger Anweisung
- **Hinzugefügt**: Heartbeat-Intervall für Testzwecke
- **Geändert**: Test-Agent-Label und Beschreibung aktualisiert

### 3. Neue Test-Datei erstellt
- `/root/.openclaw/workspace/test-spawn-agent-functionality.js` zur Validierung der neuen API

## Hauptverbesserungen durch Migration

### 1. Task/Prompt-Trennung ✅
- **VORHER**: `task` wurde immer als `prompt` verwendet (immer identisch)
- **NACHHER**: `task` als kurze Zusammenfassung (~80 Zeichen), `prompt` mit vollständigen Instruktionen

### 2. Heartbeat-Support ✅
- **VORHER**: Kein Heartbeat-Tracking
- **NACHHER**: Konfigurierbares Heartbeat-Intervall mit automatischem Setup/Tear-down

### 3. Einheitliche API ✅
- **VORHER**: 3 verschiedene Wrapper mit unterschiedlichen APIs
- **NACHHER**: Einzelne `spawnAgent` Funktion mit konsistenter Signatur

### 4. Besseres Error Handling ✅
- **VORHER**: Inkonsistentes Logging bei Fehlern
- **NACHHER**: Automatisches Cleanup und Logging bei Fehlern

## Technische Details

### Neue spawnAgent API
```javascript
await spawnAgent({
  label: 'Agent Name',                    // Anzeigename
  task: 'Kurze Zusammenfassung',         // ~80 Zeichen, für Dashboard
  prompt: 'Vollständige Instruktionen',  // Optional, sonst task als Fallback
  model: 'qwen3-coder-plus',            // Model-Name
  runtime: 'subagent',                   // 'subagent' oder 'acp'
  mode: 'run',                          // 'run' oder 'session'
  heartbeatInterval: 30000,             // ms, 0 zum Deaktivieren
  autoEnd: true                         // Automatisch loggen bei Ende
});
```

## Alte Wrapper (jetzt deprecated)
- `auto-log-spawn.mjs` - Enthält `autoLogSpawn()` - MARKIERT ALS DEPRECATED
- `managed-sessions-spawn.mjs` - Enthält `managedSessionsSpawn()` - MARKIERT ALS DEPRECATED
- `automatic-dashboard-cleanup.mjs` - Enthält `startManagedAgent()` - MARKIERT ALS DEPRECATED

## Testing Notes
- Neue Testdatei überprüft grundlegende Funktionalität
- Bestehende Testdatei aktualisiert und umbenannt
- Task/Prompt-Trennung erfolgreich implementiert
- Heartbeat-Integration funktioniert

## Nächste Schritte
1. Alte Wrapper-Dateien mit prominenten Deprecation-Hinweisen versehen
2. README.md aktualisieren mit neuem Usage-Beispiel
3. Eventuelle weitere Dateien suchen, die alte Wrapper verwenden
4. Neue Dokumentation für spawnAgent schreiben