# Project Plan

## Product vision

AmyPatch Studio turns natural language into runnable AMYboard patches, makes any patch visually
editable as a Eurorack-style module graph, and lets users hear everything instantly — in the
browser via AMY-WASM or on real hardware via WebMIDI. The official amyboard.com editor is the
baseline to beat, not a feature ceiling: its layout is rigid (fixed 16-channel knob columns),
it has no modular canvas, no drum-machine UX, no module library and no LLM assistance. **Our
goal is to be strictly better for patch building**: click a subtractive synth and a drum
machine together from pre-wired groups, cable them freely, and have *anything* the code
workspace generates — including complex custom effect devices with their own loop logic —
show up as a polished, editable, audible device in the patch workspace. We stay
protocol-compatible (same sketch format, same SysEx API) so users can move freely between
tools, but we do not inherit amyboard.com's UX limitations or scope.

## Guiding constraints

- **Fully client-side.** Static hosting, no backend. OpenRouter is called directly from the
  browser (their API supports CORS); the API key lives in localStorage and never leaves the
  client except toward openrouter.ai. Board I/O via WebMIDI. Persistence via IndexedDB +
  file export/import. This keeps deployment trivial for a non-programmer owner.
- **Agent-first development.** Phase 0–1 by a strong model; later phases sized for cheap models.
- **AMY reality check.** AMY is *not* a free-form modular engine — it has oscillators with
  fixed-function mod routing, per-osc filters/envelopes, global effects, synth/voice management.
  The patch workspace presents a modular metaphor but the compiler maps cables onto what AMY can
  actually do, and the UI refuses impossible connections with a helpful message
  (see docs/03-PATCHDOC_SPEC.md §Routing model).

## Phases & milestones

### Phase 0 — Foundation (tier:strong)
Monorepo scaffold (Vite + React + TS strict, npm workspaces), design tokens & UI kit shell,
`amy-protocol` package (typed AMY param table, wire-message codec, event model), PatchDoc zod
schema, AMY-WASM build integrated behind an `AudioEngine` interface with AudioWorklet.
**Milestone M0:** a test page plays a note through AMY-WASM; `npm run check` pipeline green.

### Phase 1 — Patch workspace core (tier:strong → any)
React Flow canvas with Eurorack skin, core module set (VCO, VCF, ENV, LFO, VCA/mixer, FX,
MIDI-in, CV-in, output), cable interaction (drag from jack, type-checked, auto-reroute),
PatchDoc↔graph binding, PatchDoc→wire-message compiler, live audio preview, undo/redo,
save/load to IndexedDB + .amypatch JSON file.
**Milestone M1:** build a subtractive synth by hand on the canvas and play it via on-screen
keyboard, entirely in the simulator.

### Phase 2 — Code workspace + LLM generation (tier:mixed)
Settings (OpenRouter key, model picker with fetched model list), code editor (CodeMirror 6,
Python), prompt→patch pipeline with strict output contract, verifier (schema + param validation
+ headless AMY render smoke test) and bounded self-repair loop, code↔PatchDoc round-trip
(paste code → graph appears; edit graph → code updates).
**Milestone M2:** "warm pad with slow filter sweep" prompt yields code that passes verification,
renders audibly, and appears correctly cabled on the canvas.

### Phase 3 — Board I/O (tier:mixed; needs hardware for final QA)
WebMIDI device discovery, SysEx transport with ACK flow control, sketch upload (`zT` chunked),
state import (`zD` dump → PatchDoc), realtime parameter push (MIDI CC + `zP` amy messages),
connection status UI, error/traceback surface (`X` frames).
**Milestone M3:** round-trip with a real AMYboard: import board state to canvas, tweak a knob,
hear it change on hardware, save sketch back.

### Phase 4 — Simulator I/O (tier:any)
Virtual MIDI keyboard + external WebMIDI controller pass-through, simulated CV inputs (draggable
voltage sliders + LFO/sequence sources, 1V/oct helper), audio-in via getUserMedia, oscilloscope
/ level meter display modules, transport (sequencer start/stop).
**Milestone M4:** full patch workflow with MIDI+CV+audio-in without any hardware.

### Phase 5 — Library, sequencing, groups, LLM modules (tier:mixed)
Library browser (search, categories, favorites), sequencer engine glue + step-sequencer and
**drum-grid modules** (4×16 grid, per-track drum voice select — a first-class drum-machine UX),
pre-wired groups (Subtractive Synth, FM Synth, Drum Machine) inserted as cabled sub-graphs,
module manifest format + sandboxed behavior scripts, LLM module generator ("4-track 16-step
drum grid with 909 kick…") with manifest validation + auto-preview, advanced-mode jacks,
display widgets.
**Milestone M5:** subtractive-synth group + drum-machine group clicked together on one canvas,
both playing in the simulator; the drum-grid prompt from the product brief produces a working
library module.

### Phase 6 — Sketch-level simulation & Device Modules (tier:strong, committed)
Run full MicroPython sketches in-browser (micropython-wasm in a Worker with an `amyboard` shim
wired to the simulator's CV/MIDI/display and the AMY-WASM engine). This makes LLM-generated
code with custom `loop()` logic — e.g. a bespoke effect device — *audible* in the simulator,
not just visible. On top of it: **Device Modules** — generated custom-code devices get an
auto-built native panel (extracted tweakable parameters as knobs, declared jacks) instead of a
raw code box, fully editable and patchable like any library module. Spike ticket may start any
time after Phase 2.
**Milestone M6:** a generated custom effect device runs audibly in the simulator and appears
as a polished, knob-controllable module on the canvas.

### Phase 7 — QoL & beta polish (tier:any)
Patch browser with tags/thumbnails, starter gallery, keyboard shortcuts, context menus, command
palette, onboarding tour, performance pass, accessibility pass.
**Milestone M7:** public-beta quality.

## Cross-cutting workstreams

- **LLM output contracts** (docs/05) — maintained from Phase 2 on; every new module type extends
  the contract fixtures.
- **Testing** (docs/06) — golden fixtures grow every phase; CI gate from Phase 0.
- **Design system** (docs/04) — tokens frozen in Phase 0, component additions reviewed against it.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| AMY-WASM build friction | Vendor a prebuilt `amy.js`/`.wasm` artifact in-repo; upgrade deliberately (ticket P0-05) |
| Modular metaphor vs. AMY's fixed routing | Routing capability matrix in PatchDoc spec; UI blocks invalid cables early |
| Cheap models breaking schemas | Schemas + compilers locked in Phase 0–1 behind typed APIs; `tier:` labels on tickets |
| WebMIDI only in Chromium | Detect & message clearly; simulator is the universal fallback |
| LLM output variance across user models | Strict contract + validators + repair loop (docs/05); contract tested against multiple models |
| No hardware during development | All board code behind `BoardTransport` interface with a loopback mock (ticket P3-01) |
