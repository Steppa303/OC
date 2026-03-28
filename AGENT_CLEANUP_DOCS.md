# Agent Dashboard Cleanup - Dokumentation

## Übersicht

Das Agent Dashboard speichert alle Agent-Aktivitäten in der PostgreSQL-Tabelle `agent_activities`. Über die Zeit sammeln sich dort viele Einträge an, darunter auch solche von Agents, die "hängengeblieben" sind (Status `running` seit über 1 Stunde).

## Probleme

1. **Alte Agents liegen rum** - Agents älter als 7 Tage, die den Status `done` oder `failed` haben
2. **Status wird nicht aktualisiert** - Agents bleiben auf `running` hängen, obwohl sie längst fertig sind
3. **Kein Auto-Cleanup** - Die Datenbank füllt sich mit alten Einträgen

## Lösung

### 1. Manuelles Cleanup

Ein Cleanup-Skript wurde erstellt, das folgende Aktionen durchführt:

- Löscht Agents älter als 7 Tage mit Status `done` oder `failed`
- Setzt Agents mit Status `running`, die länger als 1 Stunde aktiv sind, auf `timeout`
- Loggt alle durchgeführten Änderungen

**Skriptpfad:** `/root/.openclaw/workspace/scripts/cleanup-agents.sh`

**Ausführung:**
```bash
bash /root/.openclaw/workspace/scripts/cleanup-agents.sh
```

### 2. Automatisches Cleanup (Cron-Job)

Um sicherzustellen, dass das Cleanup regelmäßig erfolgt, kann ein Cron-Job eingerichtet werden:

```bash
# Füge folgende Zeile zu deinem crontab hinzu (crontab -e):
0 2 * * * /root/.openclaw/workspace/scripts/cleanup-agents.sh >> /var/log/agent-cleanup.log 2>&1
```

Dies führt täglich um 2 Uhr nachts das Cleanup-Skript aus und loggt die Ergebnisse in `/var/log/agent-cleanup.log`.

### 3. API-Verbesserungen

Die API unterstützt nun folgende Features:

#### Paginierung
- `GET /api/agents?limit=20&offset=0` - Holt die ersten 20 Agents
- `GET /api/agents?limit=20&offset=20` - Holt die nächsten 20 Agents

#### Filterung
- `GET /api/agents?status=running` - Nur laufende Agents anzeigen
- `GET /api/agents?status=timeout` - Nur Agents mit Timeout anzeigen

#### Altersfilterung
- `GET /api/agents` - Standardmäßig nur Agents der letzten 7 Tage
- `GET /api/agents?includeOld=true` - Auch alte Agents anzeigen

#### Antwortformat
Die API gibt jetzt zusätzliche Paginierungsinformationen zurück:

```json
{
  "agents": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 127,
    "hasMore": true
  }
}
```

### 4. Automatische Timeout-Erkennung

- Agents mit Status `running`, die länger als 1 Stunde aktiv sind, werden automatisch als `timeout` erkannt
- Dies geschieht sowohl beim Abrufen der Agent-Liste als auch im Cleanup-Skript
- Die API berücksichtigt dies bereits in der `getActiveAgents` Funktion

## Wichtig zu beachten

- Das Cleanup löscht standardmäßig nur Agents älter als 7 Tage mit Status `done` oder `failed`
- Agents mit Status `running` werden auf `timeout` gesetzt, nicht gelöscht
- Die aktuelle Woche bleibt immer sichtbar (standardmäßig nur letzte 7 Tage in der API)
- Das Cleanup-Skript kann sicher täglich ausgeführt werden

## Troubleshooting

Wenn das Cleanup-Skript fehlschlägt:

1. Prüfe die PostgreSQL-Verbindung:
   ```bash
   PGPASSWORD=db#Jungle68 psql -h localhost -U webapp -d webapp_db -c "SELECT COUNT(*) FROM agent_activities;"
   ```

2. Prüfe die Berechtigungen des Skripts:
   ```bash
   ls -la /root/.openclaw/workspace/scripts/cleanup-agents.sh
   ```

3. Sieh dir die Logs an:
   ```bash
   tail -f /var/log/agent-cleanup.log
   ```