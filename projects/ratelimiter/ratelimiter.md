# Rate Limiter Projekt

## Ziel
Erstelle ein zuverlässiges System, das die **Rate Limits** der kostenlosen OpenRouter‑Modelle umschifft und gleichzeitig flexibel genug bleibt, um sich an sich ändernde Limits anzupassen. Das System soll:
1. **Verhindern**, dass Anfragen wegen Rate‑Limits fehlschlagen.
2. **Automatisch** Log‑Daten sammeln, um später Optimierungen vorzunehmen.
3. **Fallback‑Strategien** zu kostenpflichtigen Modellen oder zu einem Queue‑Mechanismus bieten.
4. **Einfach konfigurierbar** sein und sich nahtlos in die bestehende OpenClaw‑Agenten‑Architektur einbinden.

---

## 1. Analyse der benötigten Informationen
| Quelle | Benötigte Daten |
|--------|-----------------|
| OpenRouter API Docs | Aktuelle Rate‑Limit‑Grenzen pro Modell (Requests/Minute, Tokens/Minute, Tages‑Limits). |
| Bisherige Fehlermeldungen | Fehlermeldungen wie `429 Too Many Requests`, Header‑Felder `X-RateLimit-Remaining`, `Reset`. |
| Bot‑Konfiguration | Welche Modelle werden aktuell verwendet, welche Optionen stehen zur Verfügung (z. B. `model=...`). |
| Historische Logs | Anzahl gescheiterter Anfragen, Zeitpunkt, Modell. |

## 2. Architektur‑Entwurf
```
+-------------------+        +-------------------+        +-------------------+
| OpenClaw Agent    | --->   | RateLimiter API   | --->   | OpenRouter API    |
+-------------------+        +-------------------+        +-------------------+
        ^                               |
        |                               v
+-------------------+        +-------------------+
| Log‑Collector     | <---   | Queue / Scheduler |
+-------------------+        +-------------------+
```

### Komponenten
1. **RateLimiter Service (Node.js / TypeScript)** – Exponiert eine simple `request(model, payload)`‑Funktion.
   * Intern verwendet ein **Token‑Bucket** pro Modell.
   * Beim Erreichen des Limits wird die Anfrage in eine **FIFO‑Queue** geschoben.
2. **Queue‑Worker** – verarbeitet wartende Anfragen, sobald das Bucket wieder Tokens hat.
3. **Log‑Collector** – schreibt jede Anfrage (Erfolg/Fehler, Timestamp, Modell) in `logs/ratelimiter.log` (JSON‑Zeilen). Optional: separate CSV für Analyse.
4. **Fallback‑Handler** – bei dauerhaftem Fehlversuch (z. B. 5 Fehlversuche) automatisch auf ein kostenpflichtiges Modell umschalten.
5. **Monitoring / Cron** – prüft einmal pro Stunde das aktuelle Limit via OpenRouter‑Headers und aktualisiert die Bucket‑Konfiguration.

## 3. Implementierungsschritte
| Schritt | Aufgabe | Technische Details | Verantwortlich |
|--------|----------|--------------------|----------------|
| 1 | Projektordner anlegen | `projects/ratelimiter/` | – |
| 2 | `package.json` & Abhängigkeiten | `npm init -y`; `npm i axios bottleneck winston` (Bottleneck = Rate‑Limiter, Winston = Logging) | – |
| 3 | RateLimiter‑Klasse | - Pro Modell ein Bottleneck‑Instanz mit `maxConcurrent=1` und `reservoir` (Tokens).<br>- `reservoirRefreshAmount` und `reservoirRefreshInterval` dynamisch aus API‑Headers setzen. | – |
| 4 | Queue‑Worker | - Event‑Emitter, der Anfragen aus einer In‑Memory‑Queue (`Array`) nimmt.<br>- Bereits in Bottleneck integriert (falls `reservoir` leer, werden Jobs automatisch verzögert). | – |
| 5 | Log‑Collector | - Winston‑Transport zu `logs/ratelimiter.log` (JSON).<br>- Zusätzlich `failed.log` für Fehlversuche. | – |
| 6 | Fallback‑Logik | - Konfigurationsdatei `config.json` mit `fallbackModel`.
- Nach X Fehlversuchen (`maxRetries`) den Request an das Fallback‑Modell senden.
- Logge den Wechsel. | – |
| 7 | Monitoring‑Cron | - Bash‑Script `scripts/ratelimiter-sync.sh` ruft einmal pro Stunde `curl ${OPENROUTER_ENDPOINT}` mit einem Dummy‑Request.
- Extrahiere Header `X-RateLimit-Remaining`, `X-RateLimit-Reset` und schreibe in `state/ratelimiter_state.json`.
- Das Node‑Service liest die Datei und passt das Bottleneck‑Reservoir an. | – |
| 8 | Integration in bestehende Agenten | - Ersetze direkte `axios.post` Aufrufe durch `RateLimiter.request(model, payload)`.
- Exportiere als Modul `require('../ratelimiter')` in den jeweiligen Bot‑Skripten. | – |
| 9 | Tests & CI | - Unit‑Tests mit `jest` für Token‑Bucket‑Verhalten.
- Integrationstest: Simuliere 100 Anfragen, prüfe, dass nicht mehr als das Limit pro Minute ausgeführt wird.
- CI‑Pipeline (GitHub Actions) führt Tests bei jedem Push aus. | – |
|10| Dokumentation | - `README.md` mit Install‑/Run‑Anleitung.
- `ratelimiter.md` (dieses Dokument) als ausführlicher Plan.
- Beispiel‑Config `config.example.json`. | – |

## 4. Konfigurationsdatei (`config.json`)
```json
{
  "models": {
    "openrouter/deepseek/deepseek-chat": {
      "limitPerMinute": 60,
      "limitPerDay": 5000
    },
    "openrouter/google/gemma-4-31b-it:free": {
      "limitPerMinute": 30,
      "limitPerDay": 2000
    }
  },
  "fallbackModel": "openrouter/deepseek/deepseek-v4-pro",
  "maxRetries": 5,
  "logPath": "logs/ratelimiter.log"
}
```
Die Werte können später per `scripts/ratelimiter-sync.sh` überschrieben werden.

## 5. Beispiel‑Code‑Snippets
### RateLimiter‑Modul (TypeScript‑Pseudocode)
```ts
import Bottleneck from 'bottleneck';
import axios from 'axios';
import winston from 'winston';
import config from './config.json';

const logger = winston.createLogger({
  transports: [new winston.transports.File({ filename: config.logPath, format: winston.format.json() })]
});

type Model = keyof typeof config.models;
const limiters: Record<Model, Bottleneck> = {} as any;

for (const model in config.models) {
  const { limitPerMinute } = config.models[model as Model];
  limiters[model as Model] = new Bottleneck({
    reservoir: limitPerMinute,
    reservoirRefreshAmount: limitPerMinute,
    reservoirRefreshInterval: 60_000, // 1 min
    maxConcurrent: 1
  });
}

export async function request(model: Model, payload: any): Promise<any> {
  const limiter = limiters[model];
  return limiter.schedule(async () => {
    try {
      const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', payload, {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
      });
      logger.info({model, status: 'success', ts: Date.now()});
      return resp.data;
    } catch (e:any) {
      logger.warn({model, error: e.message, ts: Date.now()});
      // fallback logic – simple example
      if (config.fallbackModel && e.response?.status === 429) {
        return request(config.fallbackModel as Model, payload);
      }
      throw e;
    }
  });
}
```
### Cron‑Sync‑Script (Bash)
```bash
#!/usr/bin/env bash
set -euo pipefail

TOKEN=${OPENROUTER_API_KEY}
ENDPOINT="https://openrouter.ai/api/v1/models"
TMP=$(mktemp)

curl -s -H "Authorization: Bearer $TOKEN" "$ENDPOINT" -o "$TMP"
# Beispiel‑Header aus Dummy‑Call auswerten (hier nur demonstrativ)
# In der Praxis: einen kleinen Test‑Request senden und Header auswerten

# Schreiben in state‑Datei
cat > state/ratelimiter_state.json <<EOF
{
  "updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

rm "$TMP"
```

## 6. Einsatz‑ und Wartungsplan
1. **Initial‑Setup** (Tag 1)
   * Repo klonen, `npm ci`, `.env` mit API‑Key anlegen.
   * `npm run start` – Service läuft im Hintergrund (systemd‑Unit `ratelimiter.service`).
2. **Monitoring** (laufend)
   * Log‑Rotation via `logrotate` (wöchentlich).
   * Cron‑Job (`scripts/ratelimiter-sync.sh`) jede Stunde.
3. **Fein‑Tuning** (nach 1‑2 Wochen)
   * Analyse der `ratelimiter.log` → Anpassung der `limitPerMinute` Werte.
   * Eventuell weitere Modelle hinzufügen.
4. **Rollback** (falls nötig)
   * Deaktivieren des Services in `openclaw.json` (Model‑Alias zurücksetzen).
   * Alte Direkt‑Aufrufe beibehalten.

---

## 7. Risiken & Mitigation
| Risiko | Auswirkung | Gegenmaßnahme |
|--------|------------|--------------|
| Rate‑Limits ändern plötzlich | Queue läuft über, API‑Fehler | Cron‑Sync aktualisiert Limits jede Stunde; Fallback‑Modelle schützen.
| Fehlkonfiguration des Buckets | Unter-/Über‑Utilisation | Unit‑Tests & CI‑Checks sichern korrekte Werte.
| Log‑Overflow | Festplattenspeicher belegt | Logrotate + max‑size‑Einstellung.
| Service‑Ausfall | Bot‑Antworten verzögert | Systemd‑Restart, Health‑Check (`systemctl status ratelimiter`). |

## 8. Next Steps (Sofortmaßnahmen)
1. **Projektordner anlegen** – erledigt durch dieses Dokument.
2. **Git‑Repo initialisieren** (falls noch nicht vorhanden) → `git init` in `projects/ratelimiter`.
3. **Skeleton‑Code** (RateLimiter‑Modul, Config, Cron‑Script) erstellen.
4. **Integration in einen bestehenden Bot‑Agent** – z. B. in `projects/haterbernd` die OpenRouter‑Aufrufe umleiten.
5. **Erste Tests** mit einem Dummy‑Payload ausführen.

---

*Dieser Plan ist bewusst granular, damit du sofort loslegen kannst, ohne später stundenlang zu rätseln. Viel Erfolg – und wenn du wieder von Rate‑Limits genervt wirst, sitzt du jetzt mit einer soliden Basis da.*