# Backlog

Work top-to-bottom within a phase; respect `depends:`. Tick `[x]` when done (same commit).
`tier:strong` = capable model required (schema/compiler/audio plumbing). `tier:any` = scoped for
small models — follow existing patterns, do not redesign.
Every ticket implicitly includes: tests per docs/06, `npm run check` green, DECISIONS.md entry
if you deviated.

## Phase 0 — Foundation

- [x] **P0-01** `tier:strong` — Monorepo scaffold. npm workspaces per docs/01 layout; Vite React
  TS-strict app `apps/studio` with empty routes `/code`, `/patch`, `/library`, `/settings` and
  dark shell (topbar: workspace tabs, connection status placeholder, master volume). eslint
  (typescript-eslint strict) + prettier + vitest + Playwright configured; `npm run check`,
  `dev`, `build`, `e2e` scripts. CI workflow running check on push.
  *Accept:* fresh clone → `npm i && npm run check && npm run dev` works; app shows dark shell.
- [x] **P0-02** `tier:strong` — Design tokens + UI primitives. `packages/ui`: tokens.css per
  docs/04 §1, primitives `Knob`, `Jack`, `Select`, `Toggle`, `Slider`, `Display`, `Panel`
  (header/controls/jack-field zones), Storybook-like showcase route `/dev/ui` (plain route, no
  Storybook dep). *Accept:* showcase renders all primitives; Knob supports drag/wheel/dbl-click
  reset/shift-fine with tooltip; zero hardcoded colors outside tokens.css.
- [x] **P0-03** `tier:strong` — `packages/amy-protocol`: transcribe complete AMY param table
  from AMY README into `params.ts` (kwarg, wire letter, type, range/enum, doc link per entry);
  wire message encoder/decoder; preset tables (Juno 0–127, DX7 128–255, piano 256, drums
  384–390). *Accept:* codec property tests pass; `v0n50l1K130r0Z`-style fixtures decode/encode
  byte-exact; table completeness test green.
- [x] **P0-04** `tier:strong` — `packages/patchdoc`: zod schema v1 per docs/03 §1–2, jack/cable
  validation, migrations skeleton, `.amypatch` export/import. *Accept:* valid/invalid fixture
  suite; version-0 file rejected with friendly error.
- [x] **P0-05** `tier:strong` — AMY-WASM engine. Vendor prebuilt `amy.js`+wasm (build from AMY
  repo `make docs/amy.js`; commit artifact + BUILD.md with exact commands/commit hash).
  `packages/engine`: `AudioEngine` interface (`init`, `sendWire`, `noteOn/Off`, `renderOffline`,
  `onError`), `AmyWasmEngine` via AudioWorklet, offline render path for tests. Verify sequencer
  + ext0/ext1 exposed; if not, document export patch in BUILD.md.
  *Accept:* `/dev/audio` test page: button plays Juno patch 0 note; offline render smoke test in CI.

## Phase 1 — Patch workspace core

- [x] **P1-01** `tier:strong` — Canvas foundation. React Flow in `/patch` with Eurorack skin:
  rack rows, HP-grid snapping, pan/zoom, module drag, selection, delete, duplicate. Custom node
  renders `Panel` from manifest. *Accept:* place/move/delete a dummy module on the rack; layout
  persists in PatchDoc `pos`.
- [x] **P1-02** `tier:strong` — Core manifests + registry. `packages/modules`: schema
  `ModuleManifestV1` per docs/04 §3 + all Phase-1 core manifests (docs/04 §5) + registry API
  (list/search/byId). *Accept:* schema tests; all manifests validate; registry drives a basic
  add-module palette on the canvas.
- [x] **P1-03** `tier:strong` — Cables. Drag-from-jack interaction, bezier cable rendering per
  docs/04, kind-colored, legal-target highlighting via capability matrix stub, fan-out rules,
  disconnect (drag off / click+del). *Accept:* E2E: drag VCO→VCF cable; illegal jack (audio→midi)
  refused with reason tooltip.
- [x] **P1-04** `tier:strong` — Capability matrix + allocator per docs/03 §3
  (`capabilities.ts`, `allocate.ts`). Envelope slot limits, LFO-as-osc allocation, stable
  allocation persistence. *Accept:* unit suite incl. 3rd-envelope rejection, allocation
  determinism test.
- [x] **P1-05** `tier:strong` — `compileToWire` per docs/03 §4 + golden fixtures for
  subtractive patch and each isolated core module. *Accept:* fixture `.wire` files committed;
  audio smoke tests (offline render, non-silent) green.
- [x] **P1-06** `tier:strong` — Live preview + realtime deltas. Output router (engine target),
  `applyDelta` path knob→wire ≤15 ms, on-screen keyboard module (`core.keyboard`) triggering
  notes. *Accept:* build subtractive patch on canvas, play keyboard, tweak cutoff live — by ear
  in dev and via E2E event assertions. **Milestone M1 demo.**
- [x] **P1-07** `tier:any` — Undo/redo (immer patches, gesture coalescing) + keyboard shortcuts
  (⌘Z/⇧⌘Z, del, ⌘D). *Accept:* E2E: knob gesture = one undo step; cable add/remove undoable.
- [x] **P1-08** `tier:any` — Persistence. IndexedDB save/load (debounced autosave), patch
  browser sidebar (list, rename, delete, duplicate), `.amypatch` file export/import.
  *Accept:* reload restores last patch; export→import round-trip equal.

## Phase 2 — Code workspace + LLM

- [x] **P2-01** `tier:any` — Settings page: OpenRouter key (masked), model list fetch/search
  picker with pricing display, per-feature model overrides, key stored localStorage only.
  *Accept:* E2E with mocked models endpoint.
- [x] **P2-02** `tier:strong` — `compileToSketch` + embedded PatchDoc block per docs/03 §4–5.
  Golden `.sketch.py` fixtures. *Accept:* round-trip test Level A green.
- [x] **P2-03** `tier:strong` — `parseSketch` Level B (static amy.send/amyboard.* extraction,
  no execution) + Custom Code module for residue. *Accept:* foreign-code fixtures parse with
  snapshot warnings; docs example sketches import.
- [x] **P2-04** `tier:any` — Code workspace UI. CodeMirror 6 Python editor bound to
  doc→sketch projection; paste → parse → canvas sync; parse warnings panel; read-only regions
  for generated header. *Accept:* E2E paste-code→graph and knob→code-updates journeys.
- [x] **P2-05** `tier:strong` — LLM pipeline per docs/05 §4: OpenRouter client, PatchPlan
  contract, catalog builder, verify→repair loop (max 3), generation trace panel. All tests via
  mocked responses incl. invalid-then-repaired fixture. *Accept:* unit + E2E green.
- [x] **P2-06** `tier:any` — Generate UI. Prompt box in `/code` (and "✨" on canvas), streaming
  display, result → PatchDoc → auto-layout → canvas + code views, `notes` shown, 👍/👎 stored.
  *Accept:* E2E with mock; **Milestone M2 demo with a real model (manual)**.
- [x] **P2-07** `tier:any` — `editPatch` flow: instruction box on canvas ("make the filter
  snappier") → diff contract → applied with undo entry. *Accept:* E2E with mock.
- [x] **P2-08** `tier:any` — Python static checks for `loopCode` per docs/05 §4 (AST parse,
  import whitelist). *Accept:* fixture suite of allowed/forbidden snippets.

## Phase 3 — Board I/O

- [x] **P3-01** `tier:strong` — `packages/board`: `BoardTransport` interface + `MockTransport`
  replaying fixture transcripts + SysEx codec (envelope, base64 chunking ≤188B, ACK state
  machine, timeouts) per docs/02. *Accept:* unit suite on framing/flow control.
- [x] **P3-02** `tier:strong` — `WebMidiTransport`: port discovery ("AMYboard"), connect UI in
  topbar (status chip: disconnected/connecting/connected/error), capability detection notice.
  Validate protocol details against `amyboardctl` source; record deltas in DECISIONS.md.
  *Accept:* E2E against mock; manual smoke with hardware if available.
- [x] **P3-03** `tier:any` — Sketch upload: `zT` sequence + progress UI + `X` traceback surface
  (pretty-printed, links to code line). *Accept:* mock-transcript E2E incl. error path.
- [x] **P3-04** `tier:strong` — Board import: `zD` dump collection → `parseWireDump` inverse
  allocator per docs/03 §4 → auto-layouted canvas. Golden dump fixtures. *Accept:* fixture dump
  renders expected module graph; round-trip wire-equivalence test.
- [x] **P3-05** `tier:any` — Realtime-to-board: Output router "board" target; knob deltas →
  `zP amy.send` / CC; keyboard → MIDI notes; sequencer start/stop (`zY`). Simulator and board
  targets switchable, optionally simultaneous. *Accept:* mock transcript matches expected bytes.
- [x] **P3-06** `tier:any` — `docs/HARDWARE_QA.md` checklist per docs/06 §6 + "Save to board"
  (`zA`) + reboot/ping utilities in a board menu. **Milestone M3 = owner runs checklist.**

## Phase 4 — Simulator I/O

- [x] **P4-01** `tier:any` — Virtual MIDI: `core.keyboard` velocity/octave controls; external
  WebMIDI input pass-through with device picker; channel routing per PatchDoc `io`.
- [x] **P4-02** `tier:any` — CV simulation: `core.cvin` panel gets sim-mode source select
  (manual slider −10..+10 V, LFO, step sequence), 1V/oct pitch helper, values→ext0/ext1 path.
  *Accept:* pitch follows simulated 1V/oct CV in test patch.
- [x] **P4-03** `tier:any` — Audio-in: getUserMedia → engine input (feature-detect, permission
  UX); `core.audioin` level meter. *Accept:* E2E with fake media stream.
- [x] **P4-04** `tier:any` — Displays: `core.scope` (waveform), level meters, value displays
  driven by engine taps; 30 fps cap, pauses offscreen. **Milestone M4.**

## Phase 5 — Library, sequencing, groups, LLM modules

- [x] **P5-01** `tier:any` — Library browser `/library`: category filter, search, favorites,
  module cards with mini panel preview; drag-to-canvas insert.
- [x] **P5-02** `tier:strong` — Sequencer engine glue: AMY sequencer mapping for `sequencer`
  manifests; transport bar (play/stop/tempo) syncing sim + board (`zY`).
- [x] **P5-03** `tier:any` `depends:P5-02` — `core.stepseq16` (pitch/gate lanes) +
  `core.drumgrid` (4×16, per-track voice select from drum presets, accent, pattern
  copy/clear) using `StepGrid`. This is the flagship drum-machine UX — polish counts.
  *Accept:* pattern plays in sim; state round-trips through sketch; E2E toggles steps while
  playing.
- [x] **P5-04** `tier:strong` `depends:P5-03` — Module groups: `group.*` manifest support
  (sub-graph fragment), insertion with relative layout + pre-wired cables; author
  `group.subtractive`, `group.fm2op`, `group.drummachine` (drum grid pre-cabled to drum
  voices + mixer). *Accept:* insert subtractive + drummachine groups on one canvas, both play
  simultaneously in sim (E2E); golden fixtures. **Milestone M5 demo part 1.**
- [x] **P5-05** `tier:strong` — Behavior-script sandbox per docs/04 §4 (Worker host, frozen
  API, CPU budget, kill+badge). *Accept:* unit suite incl. budget-overrun kill; sample script
  module works.
- [x] **P5-06** `tier:strong` — LLM module generation per docs/05 §5: contract, few-shots,
  preview card with audition wiring, add-to-library, remix, export/import module JSON.
  *Accept:* mocked E2E; manual: drum-grid prompt from product brief on a real model.
  **Milestone M5 demo part 2.**
- [x] **P5-07** `tier:any` — Advanced mode polish: per-module advanced toggle, `advancedHp`
  growth animation, collapsed-jack stubs keep cables. *Accept:* E2E toggle with connected
  advanced jack.

## Phase 6 — Sketch-level simulation & Device Modules (committed)

- [x] **P6-01** `tier:strong` — micropython-wasm spike (may start any time after Phase 2):
  run trivial sketch with stubbed `amy`/`amyboard` shims in a Worker; write findings +
  integration plan to DECISIONS.md. If micropython-wasm proves unworkable, evaluate Pyodide
  as fallback before reporting back — this feature is committed, not optional.
- [x] **P6-02** `tier:strong` `depends:P6-01` — Full shim: `amy.send`→engine,
  `amyboard.cv_in`→sim lanes, `loop()` scheduler at 60 ms, display shim, `X`-style traceback
  panel; simulator auto-switches to Level 2 when a patch has `extras.userLoopCode`.
  *Accept:* docs example arpeggiator sketch runs audibly in browser; a patch with generated
  loopCode is audible in the simulator.
- [x] **P6-03** `tier:strong` `depends:P6-02` — **Device Modules**: LLM-generated custom-code
  devices (e.g. a complex effect unit from the code workspace) render as native panels instead
  of a raw Custom Code box. Pipeline: after codegen, a follow-up LLM call (same contract
  discipline, docs/05) extracts a `DeviceManifest` — tweakable parameters (name, range,
  default, code binding) + jacks — validated like any manifest; knob changes write back into
  the running sketch (sim: shim variable update; board: `zP` assignment). Falls back to the
  plain Custom Code module if extraction fails. *Accept:* fixture "stereo ping-pong delay with
  feedback and tone knobs" prompt → device panel with working knobs, audible in sim, E2E with
  mocked LLM.

## Phase 7 — QoL & beta polish

- [x] **P7-01** `tier:any` — Patch browser upgrades: tags, search, sort, canvas thumbnail
  snapshots, starter template gallery on first run.
- [x] **P7-02** `tier:any` — QoL pass: context menus (jack: disconnect/highlight cables;
  module: replace-with-compatible, rename, color tag), cable tidy/auto-sag toggle, param
  copy/paste between same-type modules, ⌘K command palette (add module, run prompt, toggle
  workspace).
- [x] **P7-03** `tier:any` — Onboarding tour (first-run overlay: workspaces, generate, cable
  drag, simulator) + empty states + error toasts audit.
- [x] **P7-04** `tier:any` — Performance + a11y pass: 60 fps canvas with 40 modules (memoized
  nodes, throttled displays), focus-visible rings, ARIA on controls, reduced-motion support.
  **Milestone M7.**

## Maintenance track (any time, `tier:any`)
- [ ] **M-01** Keep CATALOG prompt builder in sync when manifests change (test guards it).
- [ ] **M-02** Run `npm run eval:llm` against target cheap models after any prompt/contract
  change; record pass rates in DECISIONS.md.
- [ ] **M-03** AMY version bump procedure per `packages/engine/BUILD.md` (rebuild, rerun audio
  fixtures, review fingerprint diffs).
