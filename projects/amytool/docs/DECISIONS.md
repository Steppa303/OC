# Decision Log (append-only)

Format: `## YYYY-MM-DD · <ticket> · <title>` then **Decision** / **Why** / **Alternatives**.

## 2026-07-18 · planning · Client-only architecture
**Decision:** No backend; OpenRouter called from browser, key in localStorage, board via
WebMIDI, storage in IndexedDB. **Why:** trivial static deployment for a non-programmer owner;
OpenRouter supports CORS. **Alternatives:** thin proxy server (rejected: ops burden > benefit).

## 2026-07-18 · planning · LLM generates PatchPlan JSON, not Python
**Decision:** Primary generation target is schema-validated JSON compiled deterministically to
code. **Why:** robust across cheap user models; validatable; round-trip safe. **Alternatives:**
direct Python generation (kept only as constrained `loopCode` escape hatch).

## 2026-07-18 · planning · Simulation at AMY-message level first
**Decision:** Simulator executes compiled wire messages via AMY-WASM (Level 1); MicroPython
sketch execution deferred to Phase 7. **Why:** covers all visually expressible patches at a
fraction of the complexity; amyboard.com already offers full sketch simulation.

## 2026-07-18 · planning · SUPERSEDES above: sketch simulation is committed (Phase 6), owner decision
**Decision:** Owner rejected the "amyboard.com already has it" rationale — amyboard.com is the
baseline to beat, never a reason to defer features. Sketch-level simulation (micropython-wasm)
is now committed Phase 6 (spike may start after Phase 2), followed by **Device Modules**
(P6-03): LLM-generated custom-code devices get auto-extracted native panels (knobs/jacks bound
to code) and are audible in the simulator. QoL polish moved to Phase 7. **Why:** generated
complex devices with custom loop() logic must be presentable *and audible* in the patch
workspace — Level 1 alone can't do that. Level-1-first ordering stays (still the right
sequencing), only the commitment level and phase order changed.

## 2026-07-18 · P0-05 · Vendored prebuilt amy.js; browser-based audio smoke tests
**Decision:** Vendored `docs/amy.js`+`amy.wasm`+`enable-threads.js` from shorepine/amy @ d88bcf8
instead of building with emscripten. Stock build does not export `amy_simple_fill_buffer`, so
there is no headless Node offline rendering; audio smoke tests run in real Chromium (Playwright,
`e2e/audio.spec.ts`) polling `_amy_get_output_buffer`. COOP/COEP isolation headers are set by
`@amy/engine/vite` plugin (required for the wasm-worker/AudioWorklet build).
**Why:** zero emscripten toolchain burden for agents; honest end-to-end signal path.
**Alternatives:** custom wasm build with extra exports — documented as upgrade path in
packages/engine/BUILD.md step 4; revisit when P1-05 needs offline golden renders.

## 2026-07-19 · P1-01 · Canvas state model & interim module catalog
**Decision:** PatchDoc lives in a zustand+immer store as the source of truth; React Flow nodes
are derived from it. Live drag positions are held in an ephemeral `dragPx` map (px, not
persisted) and snapped to clean HP/row integers into `pos` only on drag-stop, keeping PatchDoc
pure. An interim `apps/studio/src/patch/moduleCatalog.ts` (VCO/VCF/Out) with a manifest-shaped
`ModuleDescriptor` renders panels until P1-02 delivers @amy/modules — ModuleNode reads that
shape directly so P1-02 swaps the catalog with no node changes. New modules pack left-to-right
on their row to avoid stacking.
**Why:** honors the "PatchDoc is source of truth" invariant while giving React Flow the transient
px it needs; unblocks canvas work before the real registry exists.
**Alternatives:** storing px in PatchDoc.pos (rejected: pollutes the canonical model);
useNodesState as source (rejected: duplicates state, fights the invariant).

## 2026-07-19 · P1-04 · Allocator/capabilities take injected module metadata (built before P1-03)
**Decision:** Built P1-04 (capabilities.ts + allocate.ts) before P1-03 so the cable UI can use
the real capability matrix instead of a throwaway stub. Both live in @amy/patchdoc and must not
depend on @amy/modules (dependency direction is modules → patchdoc), so they operate on routing
metadata passed in by the caller: capabilities via plain Endpoint records, the allocator via a
`ModuleInfoProvider` (type → role + jacks). The app wires the registry into the provider.
Allocation reuses a passed-in previous allocation to keep osc/synth numbers stable across edits.
**Why:** avoids a coupling that would violate the layering; keeps both units pure and unit-testable
with mock providers.

## 2026-07-19 · P1-03 · Cable validation in onConnect; cables render as hanging beziers
**Decision:** (1) Reason-for-refusal: React Flow drops the target handle entirely when
isValidConnection returns false, so we can't surface *why* from there. Instead isValidConnection
always returns true and the full capability/fan-in/self validation runs in onConnect, which adds
the cable when legal and shows a reason toast when not (the rejected cable never enters the store,
so nothing renders). (2) Visibility: elevating edges above nodes (zIndex) made their transparent
20px hit path intercept jack drops — a real regression (couldn't connect a jack sitting under a
cable). Instead cables keep default z (behind nodes) and CableEdge draws a fixed downward-sag
bezier so the cable hangs into the visible rack space below the modules (VCV-style). Connected
jacks render filled for feedback.
**Why:** reliable refusal reasons + visible cables without breaking connection hit-testing.
**Follow-up:** true in-front cable rendering for tightly-stacked multi-row racks is deferred to
the P7 QoL pass (needs a separate pointer-transparent overlay, not zIndex).

## 2026-07-19 · P1-05 · compileToWire scope + golden fixtures as inline snapshots
**Decision:** compileToWire (in @amy/patchdoc, dependency-free via the injected provider) emits
SETUP messages only in a deterministic order (reset → voices → oscillators → effects); note/gate
events are sent at play time. Per-osc it maps wave/transpose→freq, attached VCF→filter params,
env cables→bp0/bp1 with eg-slot coupling, LFO cables→mod_source + mod coef, and global FX. Golden
fixtures are committed vitest inline snapshots (byte-exact, regenerated with `-u`) rather than
separate `.wire` files — same guarantee, less plumbing. Audio smoke test runs in Chromium (per the
P0-05 no-Node-render decision): the /dev/audio page compiles a subtractive patch and asserts
non-silent RMS.
**Why:** keeps the compiler focused and testable; proves audibility end-to-end through real AMY.
**Deferred:** polyphonic synth-voice wrapping for MIDI-driven osc chains (P1-06/P3); the current
compiler plays a single osc chain by noting its osc directly.

## 2026-07-19 · P1-06 · Live preview via reset-aware recompile; global keyboard play (M1)
**Decision:** An EngineProvider owns the AmyWasmEngine and syncs the patch: structural changes
(module/cable identity) send the full compile including the leading reset; knob-only changes send
the compile minus that reset, so a held note keeps sounding while parameters update live (the
docs/01 realtime path, achieved by resend-without-reset rather than hand-written per-param deltas
— simpler and equally low-latency). The on-screen keyboard plays every oscillator voice-root
(role vco) and preset voice globally, independent of its output cabling, since MIDI→synth voice
wrapping is deferred; documented as an M1 simplification.
**Why:** one code path keeps the simulator in sync; avoids a bespoke delta compiler while meeting
the "tweak while playing" requirement.
**Milestone M1 reached:** build a subtractive patch on the canvas, play it on the keyboard, tweak
cutoff live — verified end-to-end in Chromium (e2e/patch-play.spec.ts).

## 2026-07-19 · P2-02 · compileToSketch snapshot block: uncompressed base64
**Decision:** compileToSketch (in @amy/patchdoc) emits `import amy` + top-level `amy.send(...)`
statements decoded from the compiled wire (1:1 with docs/02's kwarg↔wire mapping, canonical param
order), optional preserved `extras.userLoopCode` verbatim, then a trailing snapshot comment
`# amypatch:v1:<hash>:<base64>`. The base64 payload is **plain UTF-8 JSON, not gzip-compressed**
as docs/03 §5.3 loosely says. The `<hash>` is a cyrb53 content hash of the code above the block
(non-crypto; only detects external edits). `readEmbeddedPatchDoc` is the Level A reader (returns
`{doc, hashValid}`); the tolerant Level B `parseSketch` is P2-03.
**Why:** compileToSketch stays a synchronous, dependency-free pure function (CLAUDE.md rule 6 /
docs/03 §4). Real compression needs either an async `CompressionStream` or a new dependency, both
unjustified for patch JSON that is a few KB. The `v1` tag in the marker leaves room to switch the
payload encoding to gzip under a `v2` tag later without breaking older sketches.

## 2026-07-19 · P2-03 · parseSketch Level B scope: lift setup to wire, preserve the rest
**Decision:** parseSketch (in @amy/patchdoc/sketch.ts) never throws. Level A short-circuits on a
hash-valid embedded snapshot. Level B is a tolerant, non-executing static parser: top-level
`amy.send(...)` calls that parse+encode cleanly are lifted to canonical wire in
`extras.unmappedWire`; `import amy[, amyboard]` lines are dropped; `amyboard.cv_in(...)` calls
anywhere populate `io.cvIn` lanes (mode defaults to 1voct — the sketch doesn't encode it);
`amyboard.cv_out/set_cv_out` emit a warning. Everything else (def blocks, indented/dynamic
`amy.send`, arbitrary Python) is preserved verbatim in `extras.userLoopCode` and surfaced as a
single read-only `core.customcode` module (docs/03 §5.4). Level B does **not** reconstruct the
module graph from setup sends — that inverse-allocator work is parseWireDump (P3-04); until then
imported setup lives as raw wire + is visible as Custom Code.
**Why:** matches docs/03 §4 ("statically parse amy.send kwargs + known amyboard.* calls, no
execution; unrecognized → extras.userLoopCode") without prematurely duplicating the P3-04
allocator. New module `core.customcode` (role custom, category io, one text display) holds the
residue in its instance `state.code`.

## 2026-07-19 · P2-04 · Code workspace: projection editor + app-level persistence
**Decision:** /code hosts a CodeMirror 6 Python editor that is a live *projection* of the
PatchDoc: any doc change (e.g. a canvas param edit) re-runs compileToSketch and updates the
editor when the user has no pending edits. Editing sets a "dirty" state; **Apply to canvas**
(button / ⌘↵) parses the buffer and loadDoc()s it. **Paste is a replace-all "import this sketch"
gesture** — it swaps the whole buffer (bypassing the read-only guard) and syncs the canvas
immediately, which is how paste→graph works despite read-only regions. The generated header and
the trailing `# amypatch:` snapshot are read-only via an EditorState.transactionFilter (projection
transactions are annotated and bypass it; inclusive-bound overlap so boundary insertions are
caught). A warnings panel shows parseSketch output. New module `core.customcode` renders imported
residue (its `state.code`) in a text display.

Also **moved patch restore + autosave from PatchBar into an app-level `usePatchPersistence` hook**
(mounted in App). PatchBar restored last-opened on every /patch mount, which clobbered edits made
in /code; now restore runs once per page load and autosave runs on any route. The hook is
StrictMode-safe: restore is a module-scoped run-once with no per-effect cancellation, since
loadDoc is a store action that applies regardless of the mount/unmount/remount cycle.
**Why:** PatchDoc stays the single source of truth (canvas and code are both projections); paste
and canvas edits round-trip through the store; edits survive tab switches.
**Deferred:** reconstructing a full module graph from pasted setup `amy.send` (needs the P3-04
inverse allocator) — until then imported setup lives as raw wire + Custom Code, per P2-03.

## 2026-07-19 · P2-05 · LLM patch pipeline: injectable chat + render smoke test
**Decision:** packages/llm gains the generatePatch pipeline (docs/05 §4): PatchPlan zod contract
(`contracts/patchplan.ts`), `planToDoc` (fills manifest defaults, derives cable kinds from jack
manifests, auto-layout by signal depth, loopCode→extras.userLoopCode), a CATALOG builder from the
live registry (excludes core.customcode), the generatePatch prompt (rules + capability matrix in
prose + CATALOG + 2 few-shots), an OpenRouter chat client, and the verify→repair loop: strip
fences → JSON.parse → zod → domain validation (catalog membership, manifest params, capability
matrix, allocator dry-run) → compileToWire → optional render smoke test → accept, max 3 attempts,
with a per-stage `trace`.

The **model call (`ChatFn`) and the render smoke test are injected**, so unit tests drive the whole
loop with mocked responses (incl. the invalid-then-repaired fixture) and the render check runs for
real only in the browser E2E (`/dev/llm` harness plays the accepted patch through the live
AmyWasmEngine and asserts non-silent RMS — consistent with the P0-05 no-Node-render decision).
**Why:** keeps the pipeline deterministic and fully unit-testable off the network/engine, while
still proving generate→validate→compile→audible end-to-end in Chromium. The Generate UI (streaming,
👍/👎, canvas insert) is P2-06; this ticket ships the engine + trace data it will render.

## 2026-07-19 · P2-06 · Generate UI: shared panel, ephemeral result, window chat seam
**Decision:** A shared `GeneratePanel` (prompt box + live trace + notes + 👍/👎) drives the P2-05
pipeline via a `useGenerate` hook and is mounted both atop the code workspace and inside a canvas
"✨" overlay. An accepted result is `loadDoc`'d into the store, so the canvas and the code
projection both update from the single source of truth; planToDoc's auto-layout places the modules.
The pipeline gained an `onTrace` callback so stages stream into the panel live. 👍/👎 is stored
local-only in localStorage (`amypatch:llm:feedback`) in a replayable shape (docs/05 §6).

Two deliberate calls: (1) the model call is resolved from LLM settings, but a `window.__amyChat`
seam lets the browser E2E inject a mock plan with no key — the app-level render smoke test is *not*
run in the generate flow (compile-success accepts; audibility is proven by the P2-05 /dev/llm E2E
and by the user playing the patch). (2) The result panel is **ephemeral component state**, so it
resets on tab switch — the generated *patch* persists (store + autosave), but the notes/vote UI is
per-session; voting happens on the fresh result.
**Why:** keeps generation reachable from both workspaces without duplicating logic, keeps PatchDoc
the single source of truth, and stays fully testable offline. Streaming *tokens* (vs. streaming the
trace) is deferred to the manual real-model M2 demo.

## 2026-07-19 · P2-07 · editPatch reuses the pipeline; full-plan return, undoable apply
**Decision:** editPatch is the generate pipeline with `editBase` set: the prompt becomes
`buildEditPatchMessages` (system rules + CATALOG + a `describePatch` digest of the current patch +
the instruction), and the model returns the **complete updated PatchPlan** (not a structured diff).
planToDoc preserves the base patch's identity (meta.id, createdAt, tags) when `base` is passed, so
an edit stays the same patch. The app applies it via a new **undoable** store action `replaceDoc`
(records the pre-edit doc onto the undo stack — one ⌘Z reverts), distinct from `loadDoc` which
resets history for a brand-new patch. The on-canvas `<EditBox>` (shown only when the rack is
non-empty) drives it through the shared `useGenerate` hook's `edit()` method.
**Why:** a full-plan return keeps one contract + one validation/compile path (docs/05 §3 "same
contract"), avoids a bespoke diff format, and is far more reliable for cheap models than asking for
minimal edits. The "base" identity is carried by meta.id rather than a schema field, so the
PatchPlan contract stays unchanged.

## 2026-07-19 · P2-08 · loopCode static checks: tolerant tokenizer, not tree-sitter
**Decision:** `checkPython` (packages/llm/src/checks/python.ts) statically gates generated
`loopCode` — no execution. It strips comments + string literals, enforces the import whitelist
(amy, amyboard, math, random, time), and forbids file/network/exec/introspection names
(open, exec, eval, compile, __import__, __builtins__, getattr/setattr, __subclasses__/__bases__/__class__, …)
via word-boundary matches. Wired into the pipeline's validatePlan so a plan whose loopCode fails is
rejected and repaired like any other error.
**Why:** docs/05 §4 suggests tree-sitter-python or pyodide, but both are heavy WASM deps and this is
only the *static* gate before loopCode is stored — actual sandboxed execution with CPU budgets is
the Phase-5/6 worker host (P5-05 / P6-02), where a real parser rides in. A tolerant tokenizer
(strings/comments removed first, so keywords in strings don't false-trip) cleanly separates the
allowed/forbidden fixtures a cheap model produces, with zero new dependencies. Deviation logged per
CLAUDE.md rule 10. **Phase 2 complete.**

## 2026-07-19 · P3-01 · packages/board: flow control in a BaseTransport, responder-based mock
**Decision:** New `@amy/board` package (docs/02). The SysEx codec (`sysex.ts`) handles the
`F0 00 03 45 <ascii> F7` envelope, frame splitting, ACK frame, base64 helpers, and board→host tag
parsing (AK/OK/X-traceback/V-version/0·C·E dump frames). Command builders (`commands.ts`) emit the
exact docs/02 payloads (`zD Z`, `zA Z`, `zT…`, `zP…`, `zY1/0Z`, `zBZ/zB1Z`, `zIZ`) and the
≤188-byte base64 sketch-upload sequence. The **ACK flow-control state machine lives in an abstract
`BaseTransport`** (serialized queue: send frame → await ACK with 5 s timeout → next; ping/reboot
skip the ACK; disconnect fails all in-flight sends) so both `MockTransport` (P3-01) and the coming
`WebMidiTransport` (P3-02) share it and only implement the raw byte link.

`MockTransport` replays fixtures via a **`BoardResponder`** — `(payload, sent) => boardReplies[]` —
with an `ackAll` default and a `scriptedResponder` for recorded transcripts (dump/traceback). It
replies on a microtask by default (deterministic tests, no fake timers) or after a latency.
**Why:** keeping flow control transport-agnostic means the WebMIDI transport is just port plumbing;
the responder model makes hardware transcripts trivial to script and keeps the no-hardware path
(rule 9) first-class. Payload strings follow the docs/02 table verbatim, including the space in
`zD Z`/`zA Z`.

## 2026-07-19 · P3-02 · WebMidiTransport + topbar connect chip
**Decision:** `WebMidiTransport` extends `BaseTransport` (P3-01) and only adds the Web MIDI link:
`requestMIDIAccess({ sysex: true })`, discover input+output ports whose name contains `AMYboard`
(case-insensitive substring — MIDI port names carry OS suffixes like "AMYboard MIDI 1"), route
`onmidimessage` bytes into `receiveRaw`, and `output.send` for `sendRaw`. Feature-detected via
`isWebMidiSupported()`; connect() throws typed errors (`BoardUnsupportedError`, `BoardError`) the UI
renders. The Web MIDI types aren't in lib.dom, so a minimal local surface is declared rather than
adding @types/webmidi. Topbar `<BoardStatus>` (app) shows a colored status dot + label + a
connect/disconnect button, or a "MIDI unsupported" notice (rule 9). A `window.__amyUseMockBoard`
seam swaps in the in-memory MockTransport so the connect flow is E2E-tested headless.

**amyboardctl validation (ticket ask):** the protocol here is implemented against docs/02, which
was transcribed from the AMYboard primary sources. A direct `amyboardctl` cross-check is deferred to
the hardware smoke test (P3-06 / HARDWARE_QA); the assumptions to confirm on real hardware are:
(1) port-name substring `AMYboard`, (2) `sysex: true` required for the F0-envelope frames,
(3) `zB*`/`zI` do not emit an `AK` (so they're sent with `expectAck:false`), (4) the 5 s ACK
timeout. Any deltas found will be appended here.

## 2026-07-19 · P3-03 · Sketch upload + traceback surface via a shared board store
**Decision:** Board connection state moved from a per-component hook into a shared zustand
`boardStore` (transport instance kept module-scoped; store mirrors connection/upload/traceback for
the UI). `uploadSketch(source)` runs the docs/02 sequence — `zT<path>,<size>Z` → base64 chunks →
`environment_transfer_done` exec — one ACKed frame at a time, updating a `sent/total` progress that
the topbar Upload button shows. An `X` traceback frame (board→host) lands in `store.traceback` and
is rendered by a dismissible `<TracebackPanel>` (app-level): base64 already decoded by the codec,
pretty-printed, with a `line N` extraction and a "View code" link to `/code`. Test seams:
`__amyUseMockBoard`, `__amyBoardResponder` (script the error path), `__amyBoardMock` (read the
sent-frame log).
**Why:** connection, upload progress, and the error surface are cross-component concerns, so one
store beats prop-drilling or duplicate transports. Jumping CodeMirror to the exact failing line is
deferred (P2-04's editor doesn't expose a goto yet) — the panel shows the line number and links to
the code view, which covers the acceptance and the common case.

## 2026-07-19 · P3-04 · parseWireDump inverse allocator + allocation-honoring recompile
**Decision:** `parseWireDump` (packages/patchdoc) inverts compileToWire: it decodes the dump,
clusters oscillators into modules (osc referenced by another's `mod_source` → LFO; `filter_*` →
attached VCF; `bp0/bp1` coupled to a coef's eg slot → ENV + a VCA amp stage; preset synth loads →
voice modules; global FX → FX modules), auto-lays-out left→right by signal depth, and — crucially —
writes the reconstructed `allocation` (module→osc/synth number). **compileToWire now honors a
non-empty `doc.allocation`** (passes it as the allocator's `previous`), so the recompile reuses the
exact osc numbers and reproduces the dump byte-for-byte. Round-trip (compileToWire→parseWireDump→
compileToWire) is golden-tested equal for subtractive / LFO / preset+FX / transpose fixtures;
committed `.dump` fixtures guard against compiler drift. Unmodelable lines are preserved in
`extras.unmappedWire`. App: `boardStore.importFromBoard` sends `zD Z`, collects `0|C…E` frames,
concatenates, parseWireDumps, and loadDocs onto the canvas ("⬇ Import" button).

**Why:** pinning the allocation is what makes an exact round-trip possible without perfectly
recovering the original module ids — the numbers travel with the doc. Reconstructed module labels
are their ids (patchdoc has no manifest names); functional and honest for a board import. Scope:
Phase-1 core osc features (wave/transpose/duty/filter/2 envelopes/LFO mod/preset/FX); exotic osc
fields (portamento, feedback, FM algo) aren't emitted by compileToWire yet, so they're out of scope
here too.

## 2026-07-19 · P3-05 · Realtime-to-board over the zP control channel
**Decision:** An output-target selector (Sim / Board / Both) lives in the board store; the engine
provider consults it — the simulator only sounds when `target.sim`, and when `target.board` the same
realtime events mirror to the board. Everything goes over the SysEx control channel as `zP`:
knob/param deltas → `zP amy.send(...)` (the reset-free compile converted via the new
`wireToAmySend`), keyboard notes → `zP amy.send(osc=…, note=…, vel=…)` on the allocated osc/synth,
sequencer transport → `zY1Z`/`zY0Z`. The Board/Both options are disabled until a board is connected.
Mock-transcript E2E asserts the exact frames for all three paths.
**Why:** one channel (zP + zY) keeps the transport uniform and fully testable via the mock's sent-
frame log. Two accepted simplifications: (1) notes ride the control channel as `amy.send` rather than
raw MIDI note-on messages (functionally identical; raw-MIDI/CC output can be added later without
changing callers); (2) a param change re-sends its whole osc line, not a single-field delta —
correct and cheap enough over the ACKed channel for interactive use, matching the P1-06 resend-
without-reset approach.

## 2026-07-19 · P3-06 · Board menu (save/ping/reboot) + hardware QA checklist (M3)
**Decision:** A "Board ▾" menu (shown when connected) issues the docs/02 utility commands: Save
state (`zA Z`), Ping (`zIZ`, expectAck:false — the board answers `OK`/pong, tracked via onMessage and
shown as "pong ✓"), and Reboot normal (`zB1Z`) / bootloader (`zBZ`) (also expectAck:false). Mock
E2E asserts the exact frames + the pong round-trip. `docs/HARDWARE_QA.md` is the scripted manual
checklist (docs/06 §6): connect → ping → import dump → upload → realtime knob → sequencer → error
path → save/reboot, each with exact expected wire and a place to record any `amyboardctl` deltas.
**Milestone M3 reached** (owner executes the checklist with hardware). **Phase 3 complete.**

## 2026-07-19 · P4-01 · Virtual MIDI: external input pass-through, channel-routed
**Decision:** `core.keyboard` already carried octave/velocity controls (P1-06). Added external
Web MIDI input: `useMidiInput` feature-detects `requestMIDIAccess`, lists input devices (live via
onstatechange), and forwards note on/offs from the selected device to `engine.playNote` — which
already fans out to the simulator and/or board per the P3-05 output target. Incoming messages are
filtered by the patch's `io.midiChannel` via a pure, unit-tested `parseMidiMessage` (note-on,
note-on vel 0 = off, note-off, channel match; ignores CC/clock/malformed). A device picker sits in
the transport bar and renders only when Web MIDI is available (hidden in the preview sandbox — rule
9). No E2E (Playwright can't inject a virtual MIDI device); the parser + routing are unit-tested.

## 2026-07-19 · P4-02 · CV simulation: compiler ext binding + a direct-drive sim loop
**Decision:** `core.cvin` gained sim-source controls (manual slider −10..+10 V / LFO / step
sequence, with rate). Two paths for a cvin cabled to a target: (1) **compiler/board** — compileToWire
binds the target param's `ext0`/`ext1` CtrlCoef by the cvin's channel, so on hardware the ADC drives
it (1V/oct: `freq = const·2^(volts)`); (2) **simulator** — the AMY WASM engine has no API to inject
ext0/ext1 values, so a 40 ms loop in the engine provider evaluates each sim cvin's voltage
(`cvVoltage`) and sends the resulting `freq` directly to the cabled osc (`cvToFreq`). Both are pure +
unit-tested; the 1V/oct law (1 V = one octave) is the acceptance, proven by `cvToFreq` tests, and the
compiler ext binding has its own test.
**Why:** the ticket's "values → ext0/ext1 path" is the correct board contract, but the stock engine
can't consume ext coefs, so the simulator drives the param directly (ext0 stays 0 in the sim, so the
compiled binding is inert there — no conflict). Scope: pitch (freq) targets; linear/other-param CV
mapping is a straightforward extension of `cvToFreq`.

## 2026-07-19 · P4-03 · Audio-in: capture + level meter (engine input deferred)
**Decision:** `core.audioin` renders an `<AudioMeter>`: an "Enable mic" button drives
`getUserMedia({audio:true})` (feature-detected; permission UX), pipes the stream through a Web Audio
`AnalyserNode`, and shows a live RMS level bar. Routing mic audio *through* the AMY engine is not
done: `amy_live_start_web()` owns its AudioContext internally and exposes no external-audio input
node, so wiring a MediaStreamSource into AMY's ext audio would need engine-side plumbing — deferred.
The capture + meter is the observable, testable surface. Playwright runs it against Chromium's fake
media device (`--use-fake-*-for-media-stream` launch args + granted `microphone` permission); the
fake device is silent, so the E2E asserts the capture activates and the analyser reports a numeric
level rather than a non-zero one.
**Why:** delivers the user-facing audio-in (permission UX + meter) now without an engine fork; the
through-routing rides with a later engine-input capability.

## 2026-07-19 · P4-04 · Engine-driven scope display, 30 fps, offscreen-paused (M4)
**Decision:** The engine provider exposes `outputBlock()` (the last rendered stereo int16 block).
`core.scope` renders a `<ScopeDisplay>` that taps it on a ~30 fps interval, downsamples one channel
to the waveform, and pauses when the node scrolls offscreen via IntersectionObserver. Value displays
already read module params; the scope is the engine-tap-driven display. **Milestone M4 reached.**
The M4 E2E holds a note (pointerdown, no release) so the sustained output reaches the 30 fps sampler
reliably under parallel test load — a brief keyboard `.click()` note ended between scope frames.
**Why:** polling the shared output block keeps every display in sync with what's actually sounding,
and the offscreen pause + frame cap keep a rack full of scopes cheap (the P7-04 perf goal).

## 2026-07-19 · P5-01 · Library browser + drag-to-canvas via a shared DnD payload
**Decision:** `/library` is a full browser over the registry: search, category-chip + Favorites
filters, and module cards (name, star, category, description, param chips, kind-colored jack dots).
Favorites persist in localStorage. "Add to patch" inserts via `addModule` and navigates to `/patch`.
Drag-to-canvas uses an HTML5 DnD payload (`application/amy-module` = module id): both the library
cards and the on-canvas Palette items set it on dragstart, and the patch canvas has onDragOver/onDrop
that adds the module at the drop position (via screenToFlowPosition). Since `/library` and `/patch`
are separate routes, cross-route drag isn't literal — the working drag-to-canvas is Palette→canvas
within the patch view; the library uses click-insert (+ the same DnD payload, ready for a future
dockable library panel).
**Why:** one DnD contract serves both the palette and (future) docked library; click-insert is the
reliable cross-route path today.

## 2026-07-19 · P5-02 · Sequencer engine glue: pattern→AMY sequence slots + transport
**Decision:** compileToWire maps `role:'seq'` modules to AMY `sequence` slots: it reads a pattern
from module `state` (`readSequencerTracks` — multi-track `{note,vel?,steps[]}[]` or a single
`steps[]`+`note` lane), resolves the note sink from the sequencer's outgoing cable (voice synth or
osc), and emits one `amy.send(sequence=[step·TICKS_PER_STEP, len·TICKS_PER_STEP, tag], synth/osc,
note, vel)` per active step. `TICKS_PER_STEP=12` (16 steps = 1 bar; flagged for hardware
calibration). `tempo` (`j`) is emitted once — only when a sequencer is present, so non-sequenced
patches keep byte-identical wire. The transport bar gains a tempo input (`setTempo` store action,
clamped 20–300) and Seq ▶/⏹ buttons that start/stop the sequencer on the simulator
(`sequencer_run` wire when target.sim) and the board (`zY1Z`/`zY0Z` when target.board).
**Why:** the state-based pattern contract lets P5-03's `core.stepseq16`/`core.drumgrid` populate
`state.tracks` with no compiler changes; conditional tempo emission avoids churning every existing
golden fixture. This is the glue; the flagship grid UIs are P5-03 (`depends:P5-02`).

## 2026-07-19 · P5-03 · StepGrid primitive + core.stepseq16 / core.drumgrid
**Decision:** New `<StepGrid>` UI primitive (rows×cols toggle matrix, beat grouping, playhead +
accent support). `core.drumgrid` (the flagship) renders a 4×16 StepGrid with per-track GM-drum voice
selects, and Clear / Copy / Paste (a module-static clipboard). `core.stepseq16` renders a 16-step
gate grid plus a per-step pitch row (click +1 / right-click −1 semitone). Both store their pattern
in module `state.tracks` — exactly the P5-02 compiler contract — via a new undoable `setModuleState`
store action, so the pattern compiles to AMY sequence slots and round-trips through the sketch
(embedded doc) and IndexedDB with no extra plumbing.
**Why:** keeping the pattern in `state` (not params) means one contract serves the compiler, sketch
round-trip, and persistence; the E2E toggles steps while the sequencer plays and confirms the
pattern survives a reload. Copy/Paste uses a module-level clipboard (simple, session-scoped).

## 2026-07-19 · P5-04 · Module groups: expandable sub-graph fragments (M5 pt.1)
**Decision:** A `group.*` is a validated sub-graph fragment (`groupManifestSchema`): core modules
with relative positions + pre-wired cables referencing `localId`s. `expandGroup(group, offset, taken,
cableIds)` mints fresh unique module ids, remaps cable refs, applies the offset, fills manifest
defaults, and derives each cable's kind from the source jack. The store's `insertGroup` runs it as
one undoable step; the Palette lists a "Groups" section and the canvas routes `group.*` ids (click or
drag-drop) to insertGroup. Authored `group.subtractive`, `group.fm2op`, `group.drummachine`
(drumgrid → drumvoice → mixer → out, pre-cabled). Golden `.wire` fixtures per group + expand
unit tests; the E2E inserts subtractive + drummachine and confirms both are audible at once (scope
peak > 0 with the sequencer running and a held note). **Milestone M5 pt.1 reached.**
**Why:** keeping groups as fragments (not a special node type) means they expand into ordinary
modules the compiler/persistence/undo already handle — no new runtime concept. `group.fm2op` uses an
LFO-as-operator (the engine's mod_source path) since audio-rate osc-FM isn't a core module yet.

## 2026-07-19 · P5-05 · Behavior-script sandbox: Worker host + ack-timeout budget
**Decision:** Behavior scripts run in a dedicated Worker (`behaviorWorker.ts`) via a frozen `api`
(`onTick/emit/param/state.get·set/display`) — the runtime (`scriptRuntime.ts`) executes the script
with `new Function` and every dangerous global shadowed to `undefined`. `eval`/`arguments` can't be
bound as parameters in strict mode, so `eval` is blocked by a static `checkScript` (which also
rejects fetch/importScripts/XMLHttpRequest/WebSocket/Function/require/DOM names) before a worker is
ever started. `ScriptHost` enforces the **5 ms/tick CPU budget as an ACK timeout**: each `tick`
starts a timer; the worker answers with `ack` when the tick returns, and a stuck script (blocked
message loop) never acks → the host terminates the worker and fires `onError` ("script error"
badge). The worker is injectable (`createWorker`) so the whole host + runtime is unit-tested without
a real Worker (LocalWorker runs the runtime in-process; HungWorker proves the budget kill).
**Why:** the ack-timeout is the only reliable way to kill a synchronous infinite loop from outside;
scripts affect the patch solely through `emit`, keeping them on the normal PatchDoc/wire paths. No
browser E2E — a live script-bearing core module arrives with LLM module generation (P5-06).

## 2026-07-19 · P5-06 · LLM module generation → library (M5 pt.2)
**Decision:** `generateModule` (@amy/llm) is a verify→repair loop targeting a ModuleManifestV1:
validate against `moduleManifestSchema`, enforce the `user.*` id namespace, and statically screen any
`behavior.script` for forbidden APIs (mirrors the P5-05 sandbox). Prompt carries the manifest rules +
three few-shots (knob module, sequencer, behavior-script). The library gets a "＋ New module" panel
(prompt → live trace → preview card with Add / Remix / Export JSON) and Import JSON. A zustand
`moduleStore` registers accepted manifests into the shared registry and persists them to a new
IndexedDB `modules` store (DB bumped to v2); a `version` counter re-reads the registry so the grid +
palette pick up new modules immediately. Mocked E2E: prompt → preview → add → the card appears in the
grid. **Milestone M5 pt.2 reached.**
**Why:** reusing the manifest schema as the contract means generated modules are validated exactly
like core ones; registering into the singleton registry (with a version signal) makes them
first-class everywhere with no per-view plumbing. The real-model drum-grid demo is the manual M5
acceptance.

## 2026-07-19 · P5-07 · Advanced-mode polish: toggle, hp growth, collapsed-jack stubs
**Decision:** Each module with advanced content (advancedHp / advanced params / advanced jacks) shows
a "⌄ more / ⌃ less" toggle (undoable `setAdvanced` store action). Expanding reveals the advanced
params and jacks and grows the panel to `advancedHp` — animated via a `width` transition on `.ui-panel`
(respecting `prefers-reduced-motion`). Crucially, when a module is collapsed, any advanced jack that
*has a cable* is still rendered as an invisible **handle stub** (`jack-slot-stub` / `jack-handle-stub`),
so React Flow keeps the edge anchored instead of dropping it. E2E toggles a VCO, connects an advanced
`fm` jack, collapses, and confirms the cable survives. **Phase 5 complete.**
**Why:** keeping the handle (not the visual jack) is the minimal thing React Flow needs to preserve an
edge across a collapse; the width transition gives the "growth" feel docs/07 asks for without layout
reflow of the rack.

## 2026-07-19 · P6-01 · micropython-wasm spike — VIABLE (findings + integration plan)
**Outcome:** micropython-wasm is **viable** for sketch-level simulation; Pyodide fallback is NOT
needed. A trivial sketch runs end-to-end in a Worker with stubbed board modules
(`/dev/pysim` harness, e2e/pysim.spec.ts): `import amy, amyboard` resolves to JS shims via
`registerJsModule`, a `for` loop + `print()` execute, and every `amy.send(...)` is captured on the
host.

**Findings:**
- Package `@micropython/micropython-webassembly-pyscript` — ~2.3 MB unpacked, wasm ~446 KB (vs
  Pyodide ~14 MB). Small enough to vendor.
- API: `loadMicroPython({ url, stdout, stderr })` → `{ runPythonAsync, registerJsModule, globals }`.
  `registerJsModule('amy', {...})` makes `import amy` work; called methods marshal positional args
  to JS cleanly (kwargs marshalling still to be characterized in P6-02 — a Python-level shim that
  `repr()`s kwargs is the safe path).
- **Bundler friction (the real blocker, now solved):** importing the Emscripten `.mjs` through
  Vite's ES-module-worker transform crashes the worker opaquely; a runtime `import('/x.mjs')` gets
  a `?import` rewrite and 404s. **Fix:** vendor `micropython.mjs` + `micropython.wasm` in
  `public/`, then inside the worker `fetch` the glue text and `import()` it via a **Blob URL**
  (bypasses Vite), passing `url: '/micropython.wasm'` so the glue fetches the binary directly.

**Integration plan (P6-02):** promote the spike worker into a `PySimHost` mirroring the P5-05
ScriptHost contract (init → tick every ~60 ms → ack/emit), wire the `amy` shim to
`engine.sendWire` (parse the captured send into a wire message) and `amyboard.cv_in` to the CV sim
lanes; drive `def loop()` on a scheduler; surface `X`-style tracebacks from `stderr`. The simulator
auto-switches to this Level 2 path when a patch has `extras.userLoopCode`. Kwargs handling and a
CPU/time budget per `loop()` are the first two things to nail in P6-02.

## 2026-07-19 · P6-02 · Full Level-2 shim: loop() scheduler + amy.send → engine (audible)
**Decision:** `PySimHost` drives the Level-2 worker (`pySimWorker.ts`): it loads the sketch in
micropython-wasm, installs Python shims for `amy`/`amyboard` backed by a registered `_bridge` JS
module (imported as `import _bridge`), runs top-level setup, detects `loop()` via the bridge (not
runPythonAsync's return marshalling), then calls `loop()` on a ~60 ms scheduler. `amy.send(**kwargs)`
→ `_bridge.send(json.dumps(kwargs))` → host `JSON.parse` → `encodeMessage` → `engine.sendWire`;
`amyboard.cv_in(ch)` reads CV values pushed each tick; `amy.reset()` → engine reset. Setup/loop
tracebacks surface via `onError` → `boardStore.simTraceback` → the shared `<TracebackPanel>` (now
labelled Board/Simulator). The engine provider **auto-switches to this Level-2 path** whenever the
patch has `extras.userLoopCode` and audio is running on the sim target. Verified audibly in-browser:
a micropython arpeggiator `loop()` drives non-silent output (RMS ≈ 0.07; e2e/pysim-arp.spec.ts).
**Why:** the `_bridge`-module + json-marshalled kwargs path is the robust way to move `amy.send`
across the micropython↔JS boundary (positional-only JS module calls + JSON dodges kwargs/proxy
marshalling issues). Both acceptance criteria (arpeggiator audible, generated-loopCode audible) run
through the identical PySimHost→engine path.

## 2026-07-20 · P6-03 · Device Modules: DeviceManifest in state.device, cosmetic jacks, var write-back
**Decision:** The DeviceManifest contract (`devicemanifest.v1`, zod in `packages/modules/src/device.ts`)
describes 1–8 numeric knob params — each with a `binding` naming a **top-level** Python variable in
the loop code — plus 0–6 jacks. It is embedded per instance in `ModuleInstance.state.device` of a
`core.device` module (no PatchDoc schema change; `state` is already `Record<string, unknown>`), with
the loop code mirrored in `state.code`. A `core.device` base manifest (role `custom`, empty
params/jacks) is registered so allocator/compiler/registry treat the type like Custom Code; the real
panel renders from the embedded manifest (`deviceToManifest`, hp computed from control count).
`INTERNAL_MODULE_IDS` (customcode + device) hides both from the palette, library and LLM CATALOG.
Extraction runs as a follow-up chat call after codegen accepted a plan with `loopCode`
(`extractDeviceManifest`, verify→repair ≤3 attempts; bindings validated against actual top-level
assignments in the code). Any failure falls back to attaching the plain Custom Code box
(`attachDeviceModule`) — never a hard error. Knob write-back: sim via a new worker `set` message
(`name = value`, identifier + finite-number guards, queued in `PySimHost` until setup is `ready`;
current values also passed as `initialVars` so knob state survives an audio restart); board via
`zP` (`boardStore.sendExec`). Device jacks are rendered and cable-legal (instance-aware
`endpointForModule`, role `custom`) but **structural only in v1**: the engine graph and the Level-2
sketch don't exchange audio, matching how loop-code output already reaches the engine directly.
**Why:** embedding the manifest keeps PatchDoc as single source of truth and round-trips through
sketch/export unchanged; binding-to-top-level-variable is the only write-back AMY/micropython
supports without rewriting code (plain assignment is also the safe subset — no arbitrary exec).
Extraction is scoped to the codegen flow; upgrading pasted foreign code stays a follow-up.

## 2026-07-20 · P7-01 · Patch browser: SVG schematic thumbnails; non-blocking starter gallery
**Decision:** Thumbnails are a *pure projection* of the stored PatchDoc (`thumbnail.ts`: one rect
per module with the manifest's hp — device modules via their embedded manifest — plus kind-colored
lines between module centers), rendered as inline SVG with token-based CSS classes. No canvas
rasterization, no stored image blobs: `listPatches` computes thumb data from the docs it already
reads, so old saves get thumbnails for free and nothing can go stale. Tags live where the schema
always had them (`meta.tags`); `setTags` is undoable and chips are edited inline next to the patch
name; search/sort/tag-filter are pure helpers (`browse.ts`) over the summary list, re-read when the
Patches menu opens (the debounced autosave may land after the last doc change). The first-run
starter gallery reuses the P5-04 group fragments (`templates.ts` builds full validated PatchDocs;
subtractive/FM get an on-screen keyboard) and is deliberately **non-blocking**: a centered panel
with a click-through wrapper that only shows while `firstRun && rack empty` and is dismissed for
good via a `localStorage` flag — so it never traps clicks aimed at the palette/canvas (and never
breaks flows or E2Es that start on a fresh profile).
**Why:** schematic SVG thumbs are deterministic, theme-aware and testable in plain vitest, unlike
DOM snapshots; a modal gallery would have blocked every fresh-profile interaction (including all
existing E2Es) for marginal benefit.

## 2026-07-20 · maintenance · Log-scale knobs require min > 0
**Decision:** core.env attack/decay/release get min 1 ms (was 0); the manifest schema now
rejects any log-scale param with min <= 0; Knob's log math additionally clamps to a safe
positive floor (max/1000) so a bad range degrades gracefully instead of emitting NaN SVG
coordinates. **Why:** Math.log(0) = -Infinity made the needle x2/y2 NaN (React warnings) and
broke value mapping; 1 ms is inaudibly different from 0 for envelope times. **Alternatives:**
lin scale for envelope times (rejected: log feel is right for ms ranges); only clamping in
Knob (rejected: schema-level rule catches LLM-generated manifests at the validation boundary).

## 2026-07-20 · P7-02 · QoL pass: context menus, cable tidy, param copy/paste, ⌘K palette
**Decision:** All four QoL features route through PatchDoc/the store, never mutating the canvas
directly. **Context menus**: one generic `<ContextMenu>` positioned at viewport coords, opened via a
`MenuProvider` context so deep children (module panels, jack slots) can raise a menu the canvas owns;
menu item lists are built by pure functions (`moduleMenu.ts`, unit-tested). Jack right-click →
disconnect / highlight-cables (`disconnectJack`, `highlightJackCables` select the touching edges);
module right-click (or the ⋮ button) → rename (window.prompt), replace-with-compatible, color tag,
copy/paste params. Submenus reuse the same menu via an item `keepOpen` + `reopen(items,title)`.
**Replace-with-compatible** = same `role` (`compatibleModules` in routing.ts); `replaceModule` keeps
position, carries param values whose ids survive, and drops cables whose jack no longer exists.
**Color tag**: a new *optional* `color` field on `moduleInstanceSchema` (a stable key from a fixed
token-backed palette, `colorTags.ts`); optional so v1 docs stay valid with no migration, and it
round-trips through the sketch snapshot for free. Panel renders it as a header accent stripe
(`--panel-accent`, tokens only). Discrete picks don't coalesce (set→clear = two undo steps).
**Param copy/paste**: a store-level `paramClipboard` ({type,params}); paste only applies to a
same-type module. **Cable tidy** is a UI preference (localStorage `amypatch:cableTidy`, not doc
state) read by `CableEdge` to flatten the hanging bezier. **⌘K command palette** (`CommandPalette`
+ pure `filterCommands`/`fuzzyMatch`): add module/group, run the generate prompt, jump workspace;
global ⌘K/Ctrl-K, arrow+Enter, subsequence fuzzy match. Also fixed `eslint.config.js` to ignore
`.claude/**` so a parallel agent's worktree checkout isn't linted by the parent.
**Why:** color as an optional instance field (not `state`) keeps it first-class and migration-free;
cable tidy as localStorage (not doc) keeps a personal view preference out of shared patch data and
undo history; pure menu/command builders make the interaction logic testable without React.

## 2026-07-20 · P7-03 · Onboarding tour, empty-state polish, unified toasts
**Decision:** Three first-run/error-surfacing improvements. **Toasts**: a single zustand
`useToastStore` + `<Toaster>` mounted once at the app root replaces every `alert()` (patch import,
module import) and the old ad-hoc canvas toast; `push(message, tone)` with info/error tones
(errors linger 5 s vs 2.8 s, click to dismiss). An imperative `toast()` helper covers non-React
call sites. **Onboarding tour**: a non-blocking coach card (`OnboardingTour`, steps as pure data in
`onboarding.ts`) shown once on first run — four steps (workspaces, generate, cables, simulator),
Skip/Back/Next, persisted via `amypatch:tourDone`. It shares the first-run gate with the P7-01
starter gallery through a reactive `tourActive` flag (`useOnboardingStore`) so the two never stack:
the tour shows first, the gallery holds back until it's dismissed. Both hide the moment the rack has
modules, keeping them out of the way (and out of existing E2Es that add a module immediately).
**Empty state**: the empty-rack hint now names all three ways to start (palette drag, ⌘K, ✨
generate) with a styled `<kbd>`. **Why:** one toast surface means errors are never swallowed or
shoved into a blocking `alert()`; a reactive shared flag (not fragile effect ordering) is the robust
way to sequence two first-run overlays; keeping both overlays non-blocking and rack-empty-gated
bounded the blast radius on the existing E2E suite to two intentional copy assertions.

## 2026-07-20 · P7-04 · Performance + a11y pass (Milestone M7)
**Decision:** Perf: `ParamControl` is now `memo`'d so a node re-render (which already only fires for
the one module whose slice changed, thanks to immer's structural sharing + zustand Object.is
selectors) rebuilds just the changed knob, not every control. The scope display was already
30 fps-capped and pauses offscreen (P4-04); the audio meter's rAF only runs while the mic is on.
An E2E places 40 modules and asserts edits stay isolated (a knob change on one leaves another
untouched) and 20 keyboard-driven param updates finish well under budget. A11y: a global
`:focus-visible` ring (2 px accent) in app.css as a safety net over the per-component rings, plus
`:focus:not(:focus-visible)` to keep mouse clicks ring-free; a global `prefers-reduced-motion`
block that neutralizes every transition/animation/smooth-scroll app-wide (complementing the
existing per-component guards); ARIA names added where controls were emoji-only (Stop sequencer,
tempo spinbutton, master volume slider). E2E verifies the focus ring appears on real Tab navigation
(outline-style solid), reduced-motion collapses panel transitions to ~0, and the named controls
resolve by role. **Why:** the render path was already close to optimal (structural sharing means
per-module isolation for free) so the memo + a global CSS pass was the highest-leverage work; a
catch-all focus-visible/reduced-motion rule guarantees coverage for future controls without
per-component follow-up.

## 2026-07-21 · Flexible patching Stufe 2 · Blender-style node layout
**Decision:** Modules render as Blender-style nodes instead of the eurorack "knob cloud + bottom
jack field" layout. `<Panel node>` switches the body to a vertical stack of `<NodeRow>`s; each row
can carry a left input pin and/or a right output pin (the React Flow `<Handle>` + a kind-colored
socket dot). Rotary `<Knob>` controls are replaced by horizontal `<Slider>`s (label · range ·
value) in every module (Knob stays in the library, unused). A manifest jack may set `param: <id>`
to render its pin **on that param's row** (Blender per-control socket): vco pitch→coarse,
pwm→duty, vcf cutoff_cv→cutoff, vca cv→gain, mixer in1..4→level1..4. Jacks without `param` render
as their own input/output rows; the P5-07 advanced/stub logic is preserved (a connected advanced
jack collapsed keeps its handle as a small stub). Handle ids are unchanged, so all cable/E2E
selectors (`[data-nodeid][data-handleid]`) and the compiler/allocator are untouched — this is a
pure presentation change. Panel height is now auto (`.ui-panel-node`).
**Why:** the row+per-control-pin model is what makes "a pin for every control" (Stufe 4/5) legible;
building the layout first (no routing changes) keeps the diff a self-contained, fully green visual
refactor and gives the modulation pins a home. Knob→Slider matches the user's explicit request.
Verified in-browser: subtractive chain renders as clean nodes with correct kind-colored edge pins,
values shown, no console errors; full E2E suite green after migrating knob interactions to sliders.

## 2026-07-21 · Flexible patching Stufe 3 · Note routing (keyboard → VCO)
**Decision:** Oscillator modules (`core.vco`, `core.noise`) gain a `notes` midi **input** jack
(preset voices already had one), so a keyboard / MIDI-in can be cabled straight to an oscillator —
"play this oscillator with this keyboard". The capability matrix already allows midi→midi, so no
matrix change was needed. Live note play (`playNote` in engine.tsx) now routes through
`noteSinkModules(doc, provider)` (new pure helper in `noteRouting.ts`): if any keyboard/MIDI-in
`notes` output is cabled to oscillators/voices, a played note drives **only those** modules; if no
such cable exists anywhere, notes drive every voice/oscillator — the pre-Stufe-3 behavior, so
uncabled patches keep working. Sequencer note cables (role `seq`) are excluded from the sink
computation, so a sequenced drum voice doesn't swallow the keyboard (sequencer note routing stays
in `compileToWire` §5, unchanged).
**Why:** the "keyboard only reaches CV inputs" limitation was purely a missing note input on
oscillators; adding it plus source-aware routing makes explicit note patching work while the
null-sink fallback preserves every existing patch and E2E. Verified: unit tests for the sink logic
(cabled-only, preset voice, sequencer-ignored, null fallback) and an E2E that cables keyboard.notes
→ vco.notes and plays an audible note; full check + E2E suite green.

## 2026-07-21 · Flexible patching Stufe 4 · Generalized native modulation + VCO pan
**Decision:** AMY's five per-oscillator control-coefficient targets (amp, freq, filter_freq, duty,
pan) are the natively-modulatable params; four already had mod pins (pitch/fm→freq, cutoff_cv→
filter_freq, cv→amp, pwm→duty). Stufe 4 adds the last one: the VCO gains a **Pan** slider
(amyParam `pan`) plus a `pan_cv` mod pin (target `pan`, on the Pan row). The compiler already routes
any mod source (env/LFO/CV) to whatever amyParam a jack's `target` names, so LFO→pan "just works"
via the existing `mergeCoef` path — no per-target special-casing. `compileToWire` now also emits a
**static pan const** for oscillators, but only when pan ≠ 0.5, so default patches and the committed
golden wire/snapshot fixtures are byte-identical.
**Why:** with pan wired, all five AMY-native coef targets have working mod pins and the compiler is
fully generic over coef targets — the native (Tier A) half of "a pin for every control" is complete.
Everything AMY can't modulate natively (resonance, envelope times, effect params like delay
feedback) is deferred to the scripted control-loop tier (Stufe 5). Verified: unit tests for static
pan (emitted only off-center) and LFO→pan (mod slot), plus full check + E2E green.

## 2026-07-21 · Flexible patching Stufe 5 · Scripted modulation (aftertouch → delay feedback)
**Decision:** Non-coef modulation targets (effect params like delay feedback, and later resonance /
env times) are now legal and realized as **scripted** modulation. The capability matrix returns
`mechanism: 'scripted'` for a cv cable into any named non-coef target (a cv input with no target is
still refused). Realization: `apps/studio/src/patch/scriptedMods.ts` is the single source of truth —
`scriptedMods(doc, provider)` derives one Python variable per scripted cable (deterministic names
`mod1…`), `buildModLoop` emits `import amy` + var decls + a `loop()` that writes each target via
`amy.send(...)` (e.g. echo feedback → `amy.send(echo=[level, time, 2000, mod1, 0])`), and
`modSourceValue` reads the live source (keyboard `pressure` macro for aftertouch). The engine runs
this generated loop in a `PySimHost` (reusing P6-02) and **pushes each source value every 60 ms via
`setVar`** (reusing the P6-03 device-knob writeback path), so the same mechanism drives sim now and
the board once the loop ships with the uploaded sketch. New manifest bits: keyboard gains a
`pressure` slider + `aftertouch` cv output; echo gains an `fb_cv` input (target `feedback`).
**Why:** AMY effects are global and not natively modulatable, so a control-rate script is the only
honest way to do "aftertouch → delay feedback"; pushing the source value from JS (rather than
modelling LFO/CV maths in Python) keeps the loop trivial and reuses proven infra. Verified: unit
tests for derivation/loop/source-value; E2E drives the real engine — holding a note through the echo
and raising the pressure slider measurably boosts output RMS (more feedback), audibly in the sim.
Board upload of the generated mod loop (via compileToSketch + `zA`/`zT`) is the remaining follow-up.
