# Monitoring Instructions - Agent Activity System

## Übersicht
Diese Anleitung beschreibt, wie Sie das Agent-Aktivitäts-Monitoringssystem effektiv nutzen und überwachen.

## Regelmäßige Monitoring-Aufgaben

### 1. Tägliches Monitoring

#### a) Aktive Agents überprüfen
- **Zeit:** 2x täglich (Morgens und Abends)
- **Methode:** `/api/agents/active` Endpoint aufrufen
- **Ziel:** Stellen Sie sicher, dass keine unerwarteten Agents laufen

#### b) Lange laufende Agents identifizieren
- **Zeit:** 2x täglich
- **Methode:** `/api/agents?timeoutThreshold=30` (30-Minuten-Schwelle)
- **Ziel:** Agents finden, die länger als 30 Minuten laufen

#### c) System-Logs prüfen
- **Zeit:** Täglich
- **Orte:** 
  - `/var/log/auto-agent-logging.log`
  - `/var/log/agent-cleanup.log`
- **Ziel:** Auf Fehler oder ungewöhnliche Aktivitäten achten

### 2. Wöchentliches Monitoring

#### a) Agent-Aktivitäts-Trends analysieren
- **Zeit:** Montags morgens
- **Methode:** Daten der letzten Woche auswerten
- **Ziel:** Muster erkennen, Performance bewerten

#### b) Datenbank-Performance prüfen
- **Zeit:** Montags
- **Methode:** Query-Performance und Tabellengröße prüfen
- **Ziel:** Optimierungsbedarf identifizieren

## Monitoring-Endpoints

### `/api/agents`
- **Standardaufruf:** Gibt aktuelle Agents mit 60-min Timeout-Erkennung
- **Mit Parameter:** `/api/agents?timeoutThreshold=45` für 45-min Timeout
- **Filtermöglichkeit:** `/api/agents?status=running` für nur laufende Agents

### `/api/agents/active`
- **Zweck:** Nur aktuell laufende Agents (keine hängenden)
- **Aktualisierung:** Echtzeit-Status
- **Intervall:** Alle 30 Sekunden für Dashboards geeignet

### `/health`
- **Zweck:** API-Verfügbarkeit prüfen
- **Intervall:** Automatischer Health-Check empfohlen (z.B. alle 5 Minuten)

## Dashboard-Empfehlungen

### 1. Realtime-Dashboard
- **Refresh-Intervall:** Alle 30 Sekunden
- **Anzeige:** Aktive Agents, kürzlich beendete, hängende Agents
- **Farbcodierung:** 
  - Grün: `done`
  - Rot: `failed` / `timeout`
  - Gelb: `running` (älter als 30 Min)
  - Blau: `pending`

### 2. Historisches Dashboard
- **Zeitraum:** Letzte 24 Stunden, 7 Tage, 30 Tage
- **Metriken:** 
  - Durchschnittliche Laufzeit
  - Erfolgsquote
  - Timeout-Rate
  - Agent-Typen-Verteilung

## Alerting-Regeln

### Sofort-Alerts
- **Kriterium:** Agent läuft >2 Std (Hard Limit)
- **Aktion:** Sofortige Benachrichtigung
- **Methode:** API-Call oder Log-Eintrag

### Warn-Alerts
- **Kriterium:** Agent läuft >1 Std (Soft Limit)
- **Aktion:** Warnmeldung im Log
- **Methode:** Hintergrund-Service meldet

### Trend-Alerts
- **Kriterium:** >5 Timeout-Agents innerhalb 1 Std
- **Aktion:** Prüfen auf Systemprobleme
- **Methode:** Log-Analyse

## Monitoring-Befehle

### Schnelle Checks
```bash
# Aktuelle laufende Agents
curl -s "http://localhost:3002/api/agents/active" | jq '.agents[] | {session_key, label, started_at}'

# Agent-Status mit Timeout-Erkennung
curl -s "http://localhost:3002/api/agents?timeoutThreshold=45&limit=10" | jq '.agents[] | select(.effective_status == "timeout") | {session_key, label, started_at, effective_status}'

# System-Health
curl -s http://localhost:3002/health
```

### Detaillierte Analysen
```bash
# Letzte 20 Agents mit Status
curl -s "http://localhost:3002/api/agents?limit=20" | jq '.agents[] | {session_key, label, status, effective_status, started_at, runtime_ms}'

# Anzahl Agents nach Status
curl -s "http://localhost:3002/api/agents" | jq '.agents | group_by(.effective_status) | map({status: .[0].effective_status, count: length})'
```

### Log-Monitoring
```bash
# Live-Monitoring der Agent-Logs
tail -f /var/log/auto-agent-logging.log | grep -E "(timeout|error|critical)"

# Statistiken aus den Logs
grep "Marked as timeout" /var/log/auto-agent-logging.log | wc -l
grep "Found long-running" /var/log/auto-agent-logging.log | wc -l
```

## Performance-Indikatoren (KPIs)

### Primäre Metriken
1. **Agent-Erfolgsquote:** (%) erfolgreiche vs. fehlgeschlagene Agents
2. **Durchschnittliche Laufzeit:** (Minuten) pro Agent-Typ
3. **Timeout-Rate:** (%) Agents, die als timeout markiert wurden
4. **System-Verfügbarkeit:** (%) Zeit, in der API verfügbar ist

### Sekundäre Metriken
1. **Agent-Durchsatz:** (Anzahl/Stunde) gestartete Agents
2. **Queue-Länge:** (Anzahl) wartende Agents
3. **Ressourcen-Nutzung:** CPU/Memory des API-Servers
4. **Datenbank-Performance:** Query-Response-Zeiten

## Reporting

### Tägliche Reports
- **Inhalt:** Anzahl gestarteter/beendeter Agents, Fehlerquote, Timeout-Rate
- **Zeit:** 09:00 Uhr
- **Format:** JSON oder CSV für weitere Verarbeitung

### Wöchentliche Reports
- **Inhalt:** Trends, Performance-Vergleich, Empfehlungen
- **Zeit:** Montag 10:00 Uhr
- **Format:** Detaillierter Bericht mit Grafiken

## Best Practices

### Für Entwickler
- Nutzen Sie `createCompleteAgent()` für korrektes Status-Management
- Setzen Sie sinnvolle Labels für bessere Identifizierung
- Implementieren Sie frühzeitiges Error-Handling
- Protokollieren Sie wichtige Meilensteine im Agent-Lebenszyklus

### Für Administratoren
- Überwachen Sie regelmäßig die Log-Größe
- Halten Sie die Datenbank sauber (automatisches Cleanup aktiv)
- Stellen Sie genügend Ressourcen für den API-Server bereit
- Planen Sie regelmäßige Updates des Monitoring-Systems

### Für Analysten
- Nutzen Sie die API-Filter für gezielte Analysen
- Kombinieren Sie Agent-Daten mit anderen Metriken
- Erstellen Sie benutzerdefinierte Dashboards für spezielle Anforderungen
- Nutzen Sie den Search-Endpoint für schnelle Datensuche