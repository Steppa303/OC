# Agent Self-Logging & Monitoring System

## Overview
Dieses System stellt sicher, dass Agent-Aktivitäten korrekt geloggt werden und hängende Agents automatisch erkannt und behandelt werden.

## Components

### 1. Agent Self-Logging (`lib/agent-complete.mjs`)
- Erlaubt Agents, ihren eigenen Status selbstständig zu aktualisieren
- Enthält Retry-Logik mit exponentialer Backoff
- Max 3 Versuche mit 1s, 2s, 3s Delay zwischen den Versuchen
- API-Integration für Status-Updates

### 2. Background Service (`lib/auto-agent-logging.mjs`)
- Überwacht laufende Agents alle 5 Minuten
- Erkennt und markiert hängende Agents als "timeout"
- Threshold: 2+ Stunden Laufzeit = timeout
- Gibt Warnungen für 30+ Minuten laufende Agents aus
- Robustes Error-Handling für Datenbank- und API-Verbindungen

### 3. API Erweiterungen (`agent-dashboard/api.mjs`)
- Neue Parameter für `/api/agents`: `timeoutThreshold` (in Minuten)
- Automatisches Markieren von hängenden Agents als "timeout"
- Verbesserte Error-Handling und detaillierte Meldungen
- Default Timeout: 60 Minuten

### 4. Cron-Jobs
- `*/5 * * * *` - Background Service zur Agent-Überwachung
- `0 * * * *` - Stündlicher Cleanup alter Agent-Einträge (>7 Tage)

## Configuration

### Timeout Thresholds
- **Short Running**: < 30 Minuten
- **Long Running Warning**: 30-60 Minuten  
- **Auto Timeout**: 60+ Minuten (änderbar via `timeoutThreshold` Parameter)
- **Hard Timeout**: 2+ Stunden (Background Service)

### Environment Requirements
- PostgreSQL-Datenbank mit Zugangsdaten
- API-Server läuft auf `http://localhost:3002`
- Cron-Zugriff für regelmäßige Aufgaben

## API Endpoints

### GET /api/agents
Parameter:
- `limit` (default: 50) - Anzahl Ergebnisse
- `offset` (default: 0) - Offset für Paginierung
- `status` (optional) - Status-Filter
- `includeOld` (default: true) - Alte Einträge einbeziehen
- `timeoutThreshold` (default: 60) - Timeout-Schwelle in Minuten

### POST /api/agents/end
- Zum manuellen Setzen des Agent-Status
- Wird auch von `completeAgent()` verwendet

## Error Handling

### Retry-Strategie
- `completeAgent()` versucht bis zu 3 Mal mit exponentiellem Backoff
- 1s, 2s, 3s Delay zwischen den Versuchen
- Gibt detaillierte Fehlermeldungen aus

### Database Failures
- Robuste Abfragen mit Error-Catching
- Fortsetzung trotz teilweiser DB-Fehler
- Detaillierte Logging für Fehlersuche

## Best Practices

### Für Agent-Entwicklung
- Nutze `createCompleteAgent(sessionKey, startTime)` am Anfang eines Agents
- Rufe `completeAgent('done')` am Ende der Task
- Bei Fehlern: `completeAgent('failed', 'Fehlermeldung')`
- Bei Timeout-Verdacht: `completeAgent('timeout', 'Timeout-Meldung')`

### Monitoring
- Überprüfe regelmäßig `/api/agents` für aktuelle Status
- Nutze `timeoutThreshold` Parameter für dynamische Timeout-Erkennung
- Prüfe Log-Dateien: `/var/log/auto-agent-logging.log` und `/var/log/agent-cleanup.log`