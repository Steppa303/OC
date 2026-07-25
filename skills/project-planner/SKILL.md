---
name: "project-planner"
description: "Plan-first workflow for projects: auto-detect scope, present plan with Telegram buttons, only execute after approval."
---

# Project Planner — Plan-First Workflow

## Purpose

When the user describes a multi-step project, do NOT start implementing immediately. Instead, enter a planning phase, present a concise plan with Telegram inline buttons, and only execute after explicit approval.

## Trigger Rules

### Skip Planning (execute directly)
- Single-line fixes, config changes, status checks
- Explicit "mach mal", "mach einfach", "erledige das", "sofort"
- Simple file reads, web searches, memory lookups
- Anything clearly under ~5 minutes of work

### Enter Planning Mode (auto-detected)
- New features, multi-file changes, architecture decisions
- Anything involving spawning sub-agents
- New projects, deployments, refactors
- Tasks with unclear scope or multiple possible approaches
- Anything the user hasn't done before with this setup

### Force Planning Mode (explicit override)
- User says "plan", "plan mal", "erstmal planen", "/plan"
- Even if it's a small task — force the planning flow

## Planning Flow

### Step 1 — Analyze
When a project is detected:
1. Read relevant files/context
2. Identify scope, dependencies, risks
3. Formulate 2-5 concrete plan steps
4. Note open questions for the user

### Step 2 — Present Plan with Buttons

Send a structured plan message:

```
📋 *Plan: [Project Name]*

*Was ich mache:*
1. [Step 1]
2. [Step 2]
3. [Step 3]

*Offene Fragen:*
- [Question 1]
- [Question 2]

*Aufwand:* [Quick (~5min) | Worker (~15min) | Projekt (~30min+)]
*Risiken:* [optional]
```

**Include Telegram inline buttons:**
- `✅ Go` — Plan approved, start executing
- `🔄 Anpassen` — User wants to modify the plan
- `📝 Details` — Show more detailed breakdown
- `❌ Stopp` — Abort, don't do anything

### Step 3 — Handle Button Response

**✅ Go:**
- Start execution immediately
- Follow the approved plan steps
- Report progress at milestones

**🔄 Anpassen:**
- Ask user what to change
- Revise plan, present again with buttons
- Max 2 revision rounds, then ask "so gut oder nochmal?"

**📝 Details:**
- Expand plan with technical details
- Show file list, API endpoints, config changes
- Re-show same buttons

**❌ Stopp:**
- Acknowledge, don't execute
- "Alles klar, vergessen wir's."

## Implementation Notes

- Buttons are sent via Telegram inline keyboard (native OpenClaw capability)
- Button callbacks route back to the same session
- Planning phase should NOT spawn sub-agents or write files
- If user sends a new message during planning (ignoring buttons), treat as plan revision

## Examples

### Auto-detect trigger:
User: "Ich will eine neue Web-App für X bauen"
→ Planning mode activated
→ Present plan with buttons

### Skip trigger:
User: "Ändere die Config auf Port 3010"
→ Execute directly, no planning needed

### Explicit override:
User: "Mach mal eben schnell nen neuen Cron-Job für Y"
→ Execute directly ("mach mal" = skip planning)

### Force planning:
User: "plan mal wie wir das Feature am besten bauen"
→ Planning mode forced, even if it's simple
