# Agent Briefing — AmyPatch Studio

You are a coding agent working on AmyPatch Studio. The project owner is a non-programmer
("vibe-coder"): **you are fully responsible for code quality, correctness and verification.**
Never hand back work that you have not run and tested yourself. Never ask the owner to debug.

## Read order (once per session)

1. This file.
2. [docs/07-BACKLOG.md](docs/07-BACKLOG.md) — find your ticket. Work tickets **in order** unless
   told otherwise; respect `depends:` fields.
3. The spec docs referenced by your ticket (each ticket lists them).

Do **not** re-research AMY/AMYboard on the web unless a spec doc explicitly says a detail is
unverified — [docs/02-AMY_AMYBOARD_REFERENCE.md](docs/02-AMY_AMYBOARD_REFERENCE.md) contains the
verified facts and links to primary sources.

## Non-negotiable rules

1. **PatchDoc is the single source of truth.** The visual graph, the generated Python code and
   the AMY wire messages are all *projections* of the PatchDoc JSON
   ([docs/03-PATCHDOC_SPEC.md](docs/03-PATCHDOC_SPEC.md)). Never let the canvas mutate code
   directly or vice versa — always go through PatchDoc and its compilers.
2. **TypeScript strict mode, no `any`** except in third-party type shims. Zod schemas validate
   every boundary: LLM output, board messages, imported files, module manifests.
3. **LLM-generated content is untrusted input.** Generated patch code and module manifests must
   pass schema validation + the verifier pipeline before touching the audio engine or the DOM.
   Module behavior scripts run only in the sandbox (Worker, no DOM, no network).
4. **Every ticket ships with tests** (see [docs/06-TESTING_STRATEGY.md](docs/06-TESTING_STRATEGY.md)).
   `npm run check` (typecheck + lint + unit tests) must pass before you declare a ticket done.
   If a ticket has UI acceptance criteria, verify them in the browser preview yourself.
5. **Do not invent AMY parameters.** Only use parameter names present in
   `packages/amy-protocol/src/params.ts` (generated from the AMY docs). If you believe a
   parameter is missing, add it there *with a link to the AMY source line* — never inline
   magic strings elsewhere.
6. **Keep modules declarative.** New library modules are manifests + design-system components.
   Custom imperative behavior goes into the sandboxed script slot only.
7. **Small commits, one ticket per branch/commit series**, commit message prefixed with the
   ticket id (e.g. `P1-03: patch cable rendering`). Update the ticket checkbox in
   docs/07-BACKLOG.md in the same commit.
8. **Dark-mode design tokens only.** No hard-coded colors/sizes in components; everything comes
   from `packages/ui/src/tokens.css` ([docs/04-MODULE_DESIGN_SYSTEM.md](docs/04-MODULE_DESIGN_SYSTEM.md)).
9. **Hardware code must degrade gracefully.** Every board feature needs a no-hardware code path
   (feature-detect WebMIDI, show connect state, fall back to simulator).
10. **If a spec is ambiguous, decide, implement, and record the decision** in
    `docs/DECISIONS.md` (append-only log: date, ticket, decision, why). Do not stall.

## Workflow per ticket

1. Read the ticket + linked specs. Restate acceptance criteria to yourself.
2. Look at neighboring code and match its style.
3. Implement. Write/extend tests alongside.
4. `npm run check`. Fix everything.
5. For UI tickets: launch the dev server, exercise the feature, check the browser console.
6. Tick the checkbox in docs/07-BACKLOG.md, append to docs/DECISIONS.md if you made a call,
   commit.

## Model-tier guidance

Phase 0–1 tickets (marked `tier:strong`) establish schemas, compilers and the audio engine —
these need a strong model. Tickets marked `tier:any` are deliberately scoped so smaller models
(e.g. deepseek-v4-flash, mimo) can complete them: they have exhaustive acceptance criteria,
name the exact files to touch, and rely on already-established patterns. If you are a smaller
model and a `tier:strong` ticket is next, skip it and report; never guess your way through
schema or compiler design.

## What "done" means

A ticket is done when: acceptance criteria demonstrably met, tests added and green,
`npm run check` green, UI verified in browser (if applicable), backlog checkbox ticked,
decisions logged, committed. Nothing else counts.
