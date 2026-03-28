# Migration Report: Alt Wrapper zu Neu Wrapper

## Ziel
Migration aller alten Wrapper-Funktionen zu neuen Standard-Funktionen:
- `autoLogSpawn()` → `spawnAgent()`
- `managedSessionsSpawn()` → `sessions_spawn()`
- `spawnWithLogging()` → `sessions_spawn()` mit Logging
- `startManagedAgent()` → `sessions_spawn()` mit Management

## Gefundene Dateien

### 1. `/root/.openclaw/workspace/lib/spawn-with-logging.mjs`
- Verwendet: `spawnWithLogging()`
- Zeile: 79
- Kontext: Exportierte Funktion mit Logging-Funktionalität
- Migration: Ersetzen durch `sessions_spawn()` mit eigenem Logging
- Status: **Alte Wrapper-Definition** (zu aktualisieren)

### 2. `/root/.openclaw/workspace/lib/auto-log-spawn.mjs`
- Verwendet: `autoLogSpawn()`
- Zeile: 44
- Kontext: Exportierte Funktion mit automatischem Logging
- Migration: Ersetzen durch `spawnAgent()` oder `sessions_spawn()`
- Status: **Alte Wrapper-Definition** (zu aktualisieren)

### 3. `/root/.openclaw/workspace/lib/managed-sessions-spawn.mjs`
- Verwendet: `managedSessionsSpawn()`
- Zeile: 33
- Kontext: Exportierte Funktion zur Verwaltung von Sessions
- Migration: Ersetzen durch `sessions_spawn()` mit eigenem Management
- Status: **Alte Wrapper-Definition** (zu aktualisieren)

### 4. `/root/.openclaw/workspace/lib/dashboard-automation.mjs`
- Verwendet: `managedSessionsSpawn` (Import + Export)
- Zeile: 15, 93
- Kontext: Importiert und exportiert die Funktion für andere Module
- Migration: Anpassen der Imports/Exports
- Status: **Nutzt alte Wrapper** (zu aktualisieren)

### 5. `/root/.openclaw/workspace/lib/automatic-dashboard-cleanup.mjs`
- Verwendet: `startManagedAgent()`
- Zeile: 38
- Kontext: Startet verwalteten Agenten mit automatischem Cleanup
- Migration: Ersetzen durch `sessions_spawn()` mit eigenem Cleanup
- Status: **Alte Wrapper-Definition** (zu aktualisieren)

### 6. `/root/.openclaw/workspace/test-dashboard-fix.js`
- Verwendet: `managedSessionsSpawn()`
- Zeile: 22
- Kontext: Test-Datei, die die alte Funktion nutzt
- Migration: Anpassen des Imports und der Nutzung
- Status: **Nutzt alte Wrapper** (zu aktualisieren)

## Migrations-Plan

### Phase 1: Core Wrapper-Dateien (Hohe Priorität)
1. **`/root/.openclaw/workspace/lib/spawn-with-logging.mjs`** - (kritisch)
   - Aktualisieren der Funktion `spawnWithLogging` auf neues `sessions_spawn`
   - Implementierung des gleichen Logging-Verhaltens mit neuem Interface
   - Zeitbedarf: 2-3 Stunden

2. **`/root/.openclaw/workspace/lib/auto-log-spawn.mjs`** - (kritisch)
   - Aktualisieren der Funktion `autoLogSpawn` auf neues `sessions_spawn`
   - Implementierung des gleichen Logging-Verhaltens mit neuem Interface
   - Zeitbedarf: 2-3 Stunden

3. **`/root/.openclaw/workspace/lib/managed-sessions-spawn.mjs`** - (kritisch)
   - Aktualisieren der Funktion `managedSessionsSpawn` auf neues `sessions_spawn`
   - Implementierung des gleichen Management-Verhaltens mit neuem Interface
   - Zeitbedarf: 2-3 Stunden

4. **`/root/.openclaw/workspace/lib/automatic-dashboard-cleanup.mjs`** - (kritisch)
   - Aktualisieren der Funktion `startManagedAgent` auf neues `sessions_spawn`
   - Implementierung des gleichen Cleanup-Verhaltens mit neuem Interface
   - Zeitbedarf: 2-3 Stunden

### Phase 2: Import-/Export-Dateien (Mittlere Priorität)
5. **`/root/.openclaw/workspace/lib/dashboard-automation.mjs`** - (wichtig)
   - Anpassung der Imports/Exports auf neue Funktionen
   - Sicherstellen der Abwärtskompatibilität oder Update aller Nutzer
   - Zeitbedarf: 1-2 Stunden

### Phase 3: Nutzende Dateien (Niedrige Priorität)
6. **`/root/.openclaw/workspace/test-dashboard-fix.js`** - (niedrig)
   - Anpassung des Imports und der Nutzung auf neue Funktionen
   - Aktualisierung des Tests für neue API
   - Zeitbedarf: 1 Stunde

## Dependencies und Reihenfolge

Die Reihenfolge ist wichtig, da einige Dateien die Funktionen aus anderen Dateien importieren:
1. Zuerst die Core Wrapper-Dateien aktualisieren (Phase 1)
2. Dann die Import-/Export-Dateien anpassen (Phase 2)
3. Zum Schluss die Nutzenden Dateien aktualisieren (Phase 3)

## Testing nach Migration

- [ ] Unit Tests für jede Funktion laufen lassen
- [ ] Integrationstests durchführen
- [ ] Manuelle Tests auf Staging-Umgebung
- [ ] Sicherstellen, dass alle Abhängigkeiten korrekt funktionieren
- [ ] Performance-Vergleich durchführen

## Geschätzter Gesamtaufwand

- Anzahl Dateien: 6
- Entwicklungsaufwand: 10-15 Stunden
- Testaufwand: 4-6 Stunden
- Review & Deployment: 2-3 Stunden
- **Gesamtaufwand geschätzt: 16-24 Stunden**

## Risiken

- Breaking Changes falls andere Teile der Codebase davon abhängen
- Notwendigkeit, alle Nutzer der alten Funktionen gleichzeitig zu aktualisieren
- Komplexität der Logging- und Management-Funktionalitäten
- Zeitbedarf für umfassendes Testing