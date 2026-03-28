# Agent Lifecycle Management - Executive Summary

## 🎯 Das Problem (kurz)

```
❌ Agents bleiben auf "running" hängen
❌ False positive timeouts (laufende Agents werden gekillt)
❌ Vorzeitiges Beenden von long-running Tasks
❌ Manuelles Cleanup nötig
```

## ✅ Die Lösung (3 Säulen)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   💓 HEARTBEAT      🎯 COMPLETION       🛡️ SAFETY NETS      │
│   System            Detection                                │
│                                                              │
│   Agent pingt       • Event-Listener      • Max 24h Runtime  │
│   alle 30s          • API Polling (30s)   • Hard Timeout     │
│   Last Seen         • Double-Check        • Zombie Detection │
│   anzeigen          • State Validate      • Auto Cleanup     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Agent States

```
pending → running → done
              │    → failed
              └──→ timeout (NUR wenn ALLE Checks negativ)
```

## ⏱️ Timeout Logik - Die Goldene Regel

> **Ein Agent wird NUR auf "timeout" gesetzt wenn:**
> 
> 1. ❌ Kein Heartbeat seit > 5 Minuten
> 2. ❌ Completion Event NICHT empfangen
> 3. ❌ API Polling zeigt NICHT "completed"
> 4. ❌ Subagent Existenz Check NEGATIV
> 5. ❌ Mindestens 2h seit Start vergangen

**NICHT:** Feste Zeit (2h) → Agents können länger brauchen!  
**SONDERN:** Nur wenn nachweislich inaktiv/fehlerhaft

## 📊 Config Defaults

```javascript
{
  heartbeatInterval: 30000,      // 30s - Agent pingt
  heartbeatTimeout: 300000,      // 5 Min - Max ohne HB
  minTimeoutAge: 7200000,        // 2h - Mindestalter für Timeout
  maxRuntime: 86400000,          // 24h - Hard Safety Net
  gracePeriod: 600000,           // 10 Min - Nach expected done
  checkInterval: 60000,          // 1 Min - Orchestrator prüft
  completionPollingInterval: 30000 // 30s - API Polling Fallback
}
```

## 🚀 Implementation Timeline

| Phase | Dauer | Fokus |
|-------|-------|-------|
| **Phase 1** | Week 1-2 | Heartbeat API + Dashboard |
| **Phase 2** | Week 3-4 | Completion Detection (Multi-Layer) |
| **Phase 3** | Week 5-6 | Safe Timeout Logic + Cleanup |
| **Phase 4** | Week 7-8 | Monitoring + Alerts |

## 📈 Success Metrics

| Metrik | Before | Target |
|--------|--------|--------|
| Hanging Agents (> 2h) | ~15/Woche | **0** |
| False Positive Timeouts | ~5/Woche | **0** |
| Mean Time To Detection | ~4h | **< 30 Min** |
| Data Loss Incidents | ~2/Monat | **0** |

## 🧠 Key Insights

### Warum das besser ist als "feste Timeouts":

| Ansatz | Problem | Unsere Lösung |
|--------|--------|---------------|
| "Kill nach 2h" | Lange Tasks sterben | ✅ 24h Safety Net nur für Zombies |
| "Kein Timeout" | Agents hängen forever | ✅ Heartbeat + Multi-Check |
| "Single Check" | False positives | ✅ 4 unabhängige Checks nötig |

### Grace Period für Smart Detection:

```
Agent meldet ETA: "Noch 30 Min"
→ Grace Period startet bei expected completion
→ + 10 Min Puffer
→ Erst DANN Timeout-Checks scharf
```

## 🎯 Nächste Schritte

1. **Vollständiges Konzept lesen:** `docs/agent-lifecycle-management.md`
2. **Phase 1 starten:** Heartbeat API implementieren
3. **Database Schema:** Migration vorbereiten
4. **Agent SDK:** Heartbeat-Loop einbauen

---

**TL;DR:** Heartbeat + Multi-Layer Completion + Safe Timeout = Keine hängenden Agents, keine false positives, kein Datenverlust.
