# Agent Lifecycle - Visual Diagrams

## 📊 Complete State Machine

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT STATE MACHINE                               │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   PENDING   │
                              │  (created)  │
                              └──────┬──────┘
                                     │
                                     │ start()
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │           RUNNING               │
                    │          (active)               │
                    │                                 │
                    │  ┌───────────────────────────┐  │
                    │  │    HEARTBEAT LOOP         │  │
                    │  │    (alle 30s)             │──┼──┐
                    │  │    lastHeartbeat = now    │  │  │
                    │  │    missedHeartbeats = 0   │  │  │
                    │  └───────────────────────────┘  │  │
                    │                                 │  │
                    │  ┌───────────────────────────┐  │  │
                    │  │    WORK EXECUTION         │  │  │
                    │  │    ...                    │  │  │
                    │  └───────────────────────────┘  │  │
                    │                                 │  │
                    │  ┌───────────────────────────┐  │  │
                    │  │    ON COMPLETE            │  │  │
                    │  │    emit completion event  │──┼──┘
                    │  └───────────────────────────┘  │
                    └────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           │ work()                  │ complete()              │ error
           │ throws                  │                         │
           ▼                         ▼                         ▼
    ┌─────────────┐          ┌─────────────┐           ┌─────────────┐
    │   FAILED    │          │    DONE     │           │   TIMEOUT   │
    │             │          │             │           │             │
    │ status:     │          │ status:     │           │ status:     │
    │ 'failed'    │          │ 'done'      │           │ 'timeout'   │
    │             │          │             │           │             │
    │ error:      │          │ result:     │           │ reason:     │
    │ message     │          │ {...}       │           │ 'no_hb'     │
    │             │          │             │           │ 'zombie'    │
    │             │          │             │           │ 'max_runtime│
    └──────┬──────┘          └──────┬──────┘           └──────┬──────┘
           │                        │                         │
           └────────────────────────┼─────────────────────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │     CLEANUP     │
                           │                 │
                           │ • Result save   │
                           │ • Temp archive  │
                           │ • Subagent kill │
                           │ • Alert (if)    │
                           └─────────────────┘
```

## 💓 Heartbeat Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HEARTBEAT MECHANISM                              │
└─────────────────────────────────────────────────────────────────────────┘

   AGENT                                     ORCHESTRATOR
   ┌─────────────────┐                       ┌─────────────────┐
   │                 │                       │                 │
   │  setInterval(   │                       │  setInterval(   │
   │    30000,       │                       │    60000,       │
   │    async () => {│                       │    checkAgents  │
   │                 │                       │  )              │
   │      await      │                       │                 │
   │      fetch(     │──── POST ────────────▶│  Pruefe:        │
   │        '/heart- │   /agents/:id/        │  • lastHeartbeat│
   │        beat',   │   heartbeat           │  • missedCount  │
   │        {        │   {                   │  • runtime      │
   │          ts:    │     timestamp:        │  • gracePeriod  │
   │          Date   │           Date.now(), │                 │
   │          .now() │     status: 'running',│  IF missed > 5: │
   │        }        │     progress: 45      │    → Deep Check │
   │      )          │   }                   │                 │
   │    }            │                       │  IF runtime>24h:│
   │  )              │                       │    → Hard Kill  │
   │                 │                       │                 │
   └─────────────────┘                       └─────────────────┘
```

## 🎯 Completion Detection - Multi-Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   COMPLETION DETECTION (3 LAYERS)                        │
└─────────────────────────────────────────────────────────────────────────┘

                              Agent completes work
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  LAYER 1: COMPLETION EVENT      │
                    │                                 │
                    │  Agent sendet:                  │
                    │  POST /agents/:id/complete      │
                    │  { result: {...} }              │
                    │                                 │
                    │  ✅ SUCCESS → Mark DONE         │
                    │  ❌ FAIL → Layer 2              │
                    └────────────────┬────────────────┘
                                     │
                                     ▼ (wenn Layer 1 failed)
                    ┌─────────────────────────────────┐
                    │  LAYER 2: API POLLING           │
                    │                                 │
                    │  Orchestrator pollt alle 30s:   │
                    │  GET /subagents/:id/status      │
                    │                                 │
                    │  Response: { state: 'completed' │
                    │            | 'running'          │
                    │            | 'failed' }         │
                    │                                 │
                    │  ✅ 'completed' → Mark DONE     │
                    │  ✅ 'running' → Continue        │
                    │  ❌ Error → Layer 3             │
                    └────────────────┬────────────────┘
                                     │
                                     ▼ (wenn Layer 2 unklar)
                    ┌─────────────────────────────────┐
                    │  LAYER 3: SUBAGENT CHECK        │
                    │                                 │
                    │  sessions_list() prueft:        │
                    │  Existiert Subagent noch?       │
                    │                                 │
                    │  ✅ YES → Continue running      │
                    │  ❌ NO → Timeout candidate      │
                    │  ⚠️  UNKNOWN → Conservative    │
                    └─────────────────────────────────┘
```

## 🛡️ Safe Timeout Decision Tree

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SAFE TIMEOUT DECISION TREE                          │
└─────────────────────────────────────────────────────────────────────────┘

                              Start Timeout Check
                                      │
                                      ▼
                         ┌─────────────────────┐
                         │ Runtime > 24h?      │
                         │ (Safety Net)        │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ YES                           │ NO
                    ▼                               ▼
            ┌───────────────┐             ┌─────────────────────┐
            │   TIMEOUT     │             │ Runtime > 2h?       │
            │   Immediately │             │ (Min Age Check)     │
            │               │             └──────────┬──────────┘
            └───────────────┘                        │
                                    ┌────────────────┴────────────────┐
                                    │ YES                             │ NO
                                    ▼                                 ▼
                            ┌───────────────┐                 ┌───────────────┐
                            │ Deep Check    │                 │   SAFE        │
                            │ (4 Checks)    │                 │ (too young)   │
                            └───────┬───────┘                 └───────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Check 1: Heartbeat  │
                         │ lastHB > 5 Min?     │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ YES (old)                     │ NO (fresh)
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │ Continue      │               │   SAFE        │
            └───────┬───────┘               └───────────────┘
                    │
                    ▼
                         ┌─────────────────────┐
                         │ Check 2: Completion │
                         │ Event received?     │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ NO                            │ YES
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │ Continue      │               │ Auto-Fix      │
            └───────┬───────┘               │ → DONE        │
                    │                       └───────────────┘
                    │
                    ▼
                         ┌─────────────────────┐
                         │ Check 3: API Poll   │
                         │ Status = complete?  │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ NO                            │ YES
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │ Continue      │               │   DONE        │
            └───────┬───────┘               └───────────────┘
                    │
                    ▼
                         ┌─────────────────────┐
                         │ Check 4: Subagent   │
                         │ Exists?             │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ NO                            │ YES/UNKNOWN
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │   TIMEOUT     │               │   SAFE        │
            │   ALL CHECKS  │               │ (conservative)│
            │   NEGATIVE    │               └───────────────┘
            └───────────────┘
```

## 🧹 Cleanup Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLEANUP WORKFLOW                                 │
└─────────────────────────────────────────────────────────────────────────┘

  STATUS CHANGE → done/failed/timeout
        │
        ▼
  ┌─────────────────┐
  │ SOFT CLEANUP    │ (immediate)
  │                 │
  │ • Result save   │
  │ • Temp files    │
  │   archive       │
  │ • Metadata      │
  │   finalize      │
  │ • Status →      │
  │   'archived'    │
  └────────┬────────┘
           │
           │ (after 24h)
           ▼
  ┌─────────────────┐
  │ ARCHIVE PHASE   │ (daily cron 3:00)
  │                 │
  │ • Logs compress │
  │ • Export results│
  │   (if configured)│
  │ • Status →      │
  │   'archived'    │
  └────────┬────────┘
           │
           │ (after 7 days)
           ▼
  ┌─────────────────┐
  │ HARD CLEANUP    │ (weekly)
  │                 │
  │ • Delete record │
  │ • Keep metadata │
  │   (forever)     │
  │ • Free storage  │
  └─────────────────┘


  ZOMBIE CLEANUP (daily 3:00 UTC)
  ┌─────────────────────────────────┐
  │ FOR each agent WHERE:           │
  │   status = 'running' AND        │
  │   runtime > 2h                  │
  │                                 │
  │ → Run Timeout Decision Tree     │
  │ → Kill orphaned Subagents       │
  │ → Generate Report               │
  └─────────────────────────────────┘
```

## 📊 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AGENT LIFECYCLE DASHBOARD                               🔔 3 Alerts    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SUMMARY BAR                                                             │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐          │
│  │  Total  │ Running │ Pending │  Done   │ Failed  │ Timeout │          │
│  │  1,234  │   12    │    3    │  1,180  │   35    │    4    │          │
│  │  +0%    │  +2     │   -1    │  +15    │   +1    │   +0    │          │
│  └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘          │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  RUNNING AGENTS (12)                               [Refresh]     │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  Agent ID       │ Runtime  │ Last HB     │ Progress │ Status     │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  agent-abc123   │ 45 Min   │ 30s ago  ✅ │   67%    │ 🟢 Normal  │  │
│  │  agent-def456   │ 1h 12m   │ 25s ago  ✅ │   23%    │ 🟢 Normal  │  │
│  │  agent-ghi789   │ 2h 05m   │ 6 Min   ⚠️ │   89%    │ 🟡 Warning │  │
│  │  agent-jkl012   │ 3h 30m   │ 12 Min  ❌ │   45%    │ 🔴 Check   │  │
│  │  agent-mno345   │ 15 Min   │ 28s ago  ✅ │   12%    │ 🟢 Normal  │  │
│  │  ... (+7 more)  │          │             │          │            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  ALERTS (3)                 │  │  METRICS                        │  │
│  ├─────────────────────────────┤  ├─────────────────────────────────┤  │
│  │  ⚠️ agent-ghi789            │  │  Avg Runtime:      47 Min       │  │
│  │     Last HB: 6 Min ago      │  │  Max Runtime:      3h 30m       │  │
│  │     Action: Checking...     │  │  Success Rate:     94.2%        │  │
│  │                             │  │  Timeout Rate:     0.3%         │  │
│  │  ❌ agent-jkl012            │  │                                 │  │
│  │     Last HB: 12 Min ago     │  │  Last 24h:                      │  │
│  │     Action: Deep Check      │  │  ✅ Started:       45           │  │
│  │                             │  │  ✅ Completed:     43           │  │
│  │  ⚠️ High Runtime Alert      │  │  ⚠️  Timeout:       2            │  │
│  │     1 Agent > 3h            │  │                                 │  │
│  └─────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  RUNTIME DISTRIBUTION (Last 24h)                                  │  │
│  │                                                                   │  │
│  │   40 │           ███                                               │  │
│  │   30 │       ███████                                               │  │
│  │   20 │   ███████████                                               │  │
│  │   10 │ ███████████████                                             │  │
│  │    0 └─────────────────────────────────────────────────────────    │  │
│  │      0-15m  15-30m  30-60m  1-2h   2-4h   4h+                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔔 Alert Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ALERT ESCALATION                               │
└─────────────────────────────────────────────────────────────────────────┘

  THRESHOLD BREACHED
        │
        ▼
  ┌─────────────────┐
  │ Evaluate Level  │
  └────────┬────────┘
           │
   ┌───────┼───────┬─────────────┐
   │       │       │             │
   ▼       ▼       ▼             ▼
┌──────┐ ┌──────┐ ┌──────────┐ ┌──────────┐
│ INFO │ │ WARN │ │ CRITICAL │ │ EMERGENCY│
└──┬───┘ └──┬───┘ └────┬─────┘ └────┬─────┘
   │        │         │             │
   │        │         │             │
   ▼        ▼         ▼             ▼
┌─────┐  ┌──────┐  ┌─────────┐  ┌──────────┐
│ Log │  │Slack │  │ Slack + │  │ Slack +  │
│     │  │Warn  │  │ Pager   │  │ Pager +  │
│     │  │      │  │ Duty    │  │ SMS +    │
│     │  │      │  │         │  │ Call     │
└─────┘  └──────┘  └─────────┘  └──────────┘

  EXAMPLES:
  
  INFO:     Agent started, Agent completed
  WARN:     Runtime > 30 Min, 2 missed heartbeats
  CRITICAL: Runtime > 1h, 5 missed heartbeats, timeout
  EMERGENCY: Runtime > 24h, 20 failures/hour
```

---

**Alle Diagramme sind ASCII-kompatibel und können direkt in Docs/Tickets verwendet werden.**
