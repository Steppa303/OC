# Architecture

## Stack (fixed — do not substitute)

| Concern | Choice | Why |
|---|---|---|
| Build / app | Vite + React 18 + TypeScript strict | Ubiquitous; cheap models handle it reliably |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) | No extra tooling |
| State | zustand (one store per workspace) + immer | Simple, serializable, undo-friendly |
| Validation | zod (schemas are the API between subsystems) | Runtime safety for LLM/board/file input |
| Node canvas | @xyflow/react (React Flow) with fully custom nodes/edges | Battle-tested graph UX; we skin it as Eurorack |
| Code editor | CodeMirror 6 (`@codemirror/lang-python`) | Light, embeddable |
| Audio | AMY compiled to WASM + AudioWorklet | Same DSP as the hardware |
| Board I/O | Web MIDI API (SysEx enabled) | Official AMYboard control path |
| Persistence | IndexedDB (via `idb`) + JSON file export | Client-only |
| Tests | vitest + @testing-library/react + Playwright | See docs/06 |
| Lint/format | eslint (typescript-eslint strict) + prettier | `npm run check` gate |

## Repository layout

```
apps/
  studio/               # the web app (routes: /code, /patch, /library, /settings)
packages/
  amy-protocol/         # AMY param table, wire codec, amy_event types, patch-number tables
  patchdoc/             # PatchDoc schema, graph ops, compilers (doc→wire, doc→python, python→doc)
  engine/               # AudioEngine interface; AmyWasmEngine (worklet) + vendored amy.js/.wasm
  board/                # BoardTransport interface; WebMidiTransport (SysEx), MockTransport
  sim/                  # simulated MIDI/CV/audio-in sources, clocks, scopes
  llm/                  # OpenRouter client, prompt templates, output parsing, repair loop
  modules/              # module manifests (core library), module groups, manifest sandbox host
  ui/                   # design tokens, primitives (Knob, Jack, Panel, Display, Select, …)
docs/                   # specs (this folder)
fixtures/               # golden files: prompts, patches, wire dumps, board transcripts
```

Dependency direction (enforce by review): `ui` ← everything; `amy-protocol` ← patchdoc ←
(engine|board|llm|modules) ← apps. Nothing imports from `apps/`.

## Data flow — one diagram to rule them all

```
        user prompt                    pasted/generated code            AMYboard (zD dump)
             │                                  │                              │
             ▼                                  ▼                              ▼
      llm: generate ──contract──▶  patchdoc: python→doc parser   board: wire→doc importer
             │                                  │                              │
             └──────────────┬───────────────────┴──────────────────────────────┘
                            ▼
                     ┌─────────────┐   graph ops (add module, drag cable, turn knob)
                     │  PatchDoc   │◀──────────────────────────────────────────────┐
                     │ (zustand)   │                                               │
                     └─────────────┘                                               │
                        │       │                                          Patch canvas UI
        doc→python      │       │ doc→wire messages                        (React Flow)
             ▼          │       ▼
      Code editor view  │   ┌──────────────────────────────┐
                        │   │ Output router                │
                        │   │  ├─ AmyWasmEngine (simulator)│──▶ AudioWorklet ──▶ speakers
                        │   │  └─ WebMidiTransport (board) │──▶ SysEx/MIDI  ──▶ hardware
                        │   └──────────────────────────────┘
                        ▼
              sim sources (virtual MIDI kbd, CV lanes, audio-in) feed events into the router
```

Key invariant: **edits happen on PatchDoc only**. Code view and canvas are synchronized
projections. Realtime tweaks (knob drag) additionally emit *delta* wire messages immediately
(low latency) while the PatchDoc updates; full recompiles happen debounced.

## Simulation levels

- **Level 1 (Phases 0–5): AMY-message level.** The PatchDoc compiles to wire messages executed
  by AMY-WASM. Simulated MIDI/CV/audio-in are translated to the same messages the board firmware
  would produce (e.g. CV-in jack → `CtrlCoefs ext0` values / `cv_trigger` events; MIDI note →
  `amy.send(note=…, vel=…)` on the target synth). This covers every patch the visual workspace
  can express, without running Python.
- **Level 2 (Phase 6, committed): sketch level.** micropython-wasm executes the actual
  `sketch.py` in a Worker with an `amyboard` shim module bridging to `sim/` and `engine/`.
  Required whenever a sketch has custom `loop()` logic beyond what PatchDoc expresses — in
  particular LLM-generated custom devices (`extras.userLoopCode`), which must be *audible* in
  the simulator, not just displayed. Level 2 also powers **Device Modules** (auto-built native
  panels for such devices, see docs/03 §5 and ticket P6-03).

The doc→python compiler always emits sketches whose behavior is fully captured by Level 1
(declarative setup + a generated `loop()` only for constructs the compiler itself created, e.g.
CV polling), so simulator and hardware stay equivalent.

## Realtime parameter path

Knob drag → `paramChanged(moduleId, paramId, value)` →
1. PatchDoc update (debounced 30 ms, coalesced, undoable as one gesture)
2. delta wire message via Output router → WASM engine and/or board (`zP` amy.send or mapped
   MIDI CC, see docs/02 §Realtime control)
Target: ≤15 ms perceived latency in simulator.

## Security model

- OpenRouter key: localStorage, masked in UI, never logged, sent only to `openrouter.ai`.
- LLM patch code is **never executed in the app**. It is parsed (Level 1) into PatchDoc; only
  validated wire messages reach the engine. On hardware, code runs on the board (as with any
  sketch) — the verifier (docs/05) gates uploads.
- LLM module manifests: zod-validated; behavior scripts run in a Worker sandbox with a frozen
  API surface (no DOM, no fetch, no import), CPU-budgeted, terminated on overrun.
- File imports (.amypatch, module JSON): zod-validated, version-migrated, rejected loudly on
  mismatch.

## Browser support

Chromium-first (WebMIDI). Firefox/Safari get the full simulator experience; board features
render a "requires Chrome/Edge" notice via capability detection in `board/capabilities.ts`.
