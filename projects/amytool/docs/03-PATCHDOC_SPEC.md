# PatchDoc Specification — canonical patch model & round-trip rules

PatchDoc is the single source of truth for a patch. The canvas, the Python sketch, and the AMY
wire messages are projections. Implemented in `packages/patchdoc` as zod schemas + pure
functions. **Any change to this spec requires updating the schema, all three
compilers/parsers, and the golden fixtures in the same ticket.**

## 1. Document shape (v1)

```jsonc
{
  "version": 1,
  "meta": { "id": "uuid", "name": "Warm Pad", "tags": ["pad"], "createdAt": "...", "modifiedAt": "...",
            "origin": "llm | manual | board-import | code-paste | group-template",
            "prompt": "optional originating prompt" },
  "modules": [
    {
      "id": "vco1",                    // stable, human-readable, unique
      "type": "core.vco",              // manifest id from the module library
      "label": "VCO 1",                // user-editable display name
      "pos": { "x": 0, "y": 0 },       // canvas rack position (HP grid units)
      "params": { "wave": "saw", "coarse": 0, "duty": 0.5 },   // manifest-typed values
      "advanced": false,               // advanced jacks visible?
      "state": {}                      // module-private state (e.g. sequencer grid contents)
    }
  ],
  "cables": [
    { "id": "c1", "from": { "module": "vco1", "jack": "out" },
                  "to":   { "module": "vcf1", "jack": "in" },
      "kind": "audio" }               // audio | cv | gate | midi  (derived from jacks, cached)
  ],
  "globals": { "effects": { "reverb": {...}, "chorus": {...}, "echo": {...}, "eq": {...} },
               "tempo": 120, "volume": 0.8 },
  "io": { "midiChannel": 1,
          "cvIn":  [ { "channel": 0, "mode": "1voct | linear | trigger" }, ... ],
          "cvOut": [ { "channel": 0, "source": "synthAudio | voltage" }, ... ] },
  "allocation": {                      // OUTPUT of the allocator (see §3), persisted for stability
    "oscMap": { "vco1": [0], "lfo1": [8] },
    "synthMap": { "voicegroup1": 1 }
  },
  "extras": { "unmappedWire": ["..."], "userLoopCode": null }   // round-trip preservation, see §5
}
```

Jack references (`module` + `jack`) must resolve against the module's manifest. Cables are
validated on insert: jack direction (out→in), kind compatibility (see §2), and AMY routability
(§3). Invalid cables are rejected with a user-facing reason string.

## 2. Jack kinds & compatibility

| kind | color token | semantics | connects to |
|---|---|---|---|
| `audio` | `--jack-audio` | signal path (osc→filter→vca→fx→out) | audio |
| `cv` | `--jack-cv` | continuous modulation (pitch, cutoff, amp, pan, duty) | cv |
| `gate` | `--jack-gate` | triggers/gates (env trigger, seq steps, cv_trigger) | gate |
| `midi` | `--jack-midi` | note/CC streams | midi |

One output jack may fan out to many inputs. One input jack accepts exactly one cable
(exception: `midi` inputs merge). No cycles in `audio`; `cv` cycles rejected in v1.

## 3. Routing model — mapping the modular metaphor onto AMY

AMY's real routing is fixed-function: each oscillator has {wave, freq, filter, 2 envelopes,
mod source, pan}; oscillators can serve as LFO/mod sources for other oscillators; global FX
bus; `synth`/`voices` for polyphony; `ext0/ext1` CtrlCoefs bind params to CV inputs.

The **allocator** (`patchdoc/src/allocate.ts`) maps the graph onto this model:

- `core.vco` → one AMY osc per voice (via synth/num_voices when driven by MIDI poly).
- `core.vcf` cable `vco.out → vcf.in` → sets the *source osc's* filter params (AMY filters live
  on the oscillator; the VCF module is a view onto them). Multiple VCOs into one VCF = same
  filter settings applied to each source osc.
- `core.env` cable `env.out → (jack)` → programs bp0/bp1 on the target osc for the targeted
  parameter (amp, freq, duty, cutoff, pan). Max **2 envelope targets per osc**; a third cable
  is rejected with "AMY supports 2 envelopes per oscillator".
- `core.lfo` → an extra AMY osc allocated as mod source (`mod_source` + target param).
- `core.cvin` → `ext0/ext1` CtrlCoefs on the target param (1V/oct helper for pitch), or
  `cv_trigger` when cabled to a gate input.
- `core.midiin` → synth note routing on the configured channel.
- FX modules → global effects params (bus semantics: cable into FX = "sends enabled"; the
  compiler warns that AMY FX are global, and the UI shows FX modules docked in a fixed rack row).
- Preset-based modules (`core.junovoice`, `core.dx7voice`, drums) → `patch`/`synth` load plus
  param overrides.

The **capability matrix** (`patchdoc/src/capabilities.ts`) declares, per (jack kind, target
param), whether AMY can realize the connection and by which mechanism (envelope slot, mod_source
slot, CtrlCoef, direct param). The canvas queries this matrix *while the user drags a cable* and
highlights only legal targets. This file is the one place where "what AMY can do" is encoded.

Allocation is **stable**: re-running the allocator on an unchanged graph must yield identical
osc numbers (persisted in `allocation`), so realtime deltas and board state stay consistent.

## 4. Compilers & parsers (pure functions, all in `packages/patchdoc`)

| Function | Direction | Notes |
|---|---|---|
| `compileToWire(doc): WireMessage[]` | doc → AMY wire messages | deterministic; ordered: resets, synth/patch loads, osc params, envelopes, mods, FX, CtrlCoefs |
| `compileToSketch(doc): string` | doc → Python `sketch.py` | header comment with PatchDoc JSON embedded (see §5); setup = amy.send lines mirroring wire; generated `loop()` only for CV polling/seq glue the compiler itself owns |
| `parseSketch(src): ParseResult` | Python → doc | Level A: if embedded PatchDoc JSON present & hash-valid, load it directly. Level B: statically parse `amy.send(...)` kwargs + known `amyboard.*` calls (regex/AST via a small tolerant parser — **no code execution**). Unrecognized code goes to `extras.userLoopCode` verbatim |
| `parseWireDump(lines): doc` | board `zD` dump → doc | inverse allocator: cluster oscs into modules (osc with mod targets → LFO; filter params → attached VCF view; envelopes → ENV modules), auto-layout left→right by signal flow |
| `applyDelta(doc, moduleId, paramId, value): {doc, wire: WireMessage[]}` | knob tweaks | emits the minimal wire delta for the realtime path |

`ParseResult = { doc, warnings: string[], lossy: boolean }`. Parsers never throw on unknown
constructs — they degrade to warnings + `extras`.

## 5. Round-trip guarantees

1. `parseSketch(compileToSketch(doc))` ≡ `doc` (modulo `meta.modifiedAt`). Golden-tested.
2. `compileToWire(parseWireDump(dump))` reproduces the audible state of `dump` (same params on
   same osc allocation). Golden-tested against fixture dumps.
3. Sketch files carry their PatchDoc as a compressed base64 JSON block in a trailing comment
   (`# amypatch:v1:<base64>` + content hash of the code above it). If a user edits the code
   externally, the hash mismatch triggers Level B parsing and the UI shows "imported with N
   warnings" instead of silently trusting stale layout data.
4. Pasted foreign code (no embedded block) always goes through Level B; whatever can't be
   modeled lands visibly in a "Custom Code" module on the canvas (read-only badge, opens the
   code view) rather than being dropped. From Phase 6 on, custom-code content is upgraded
   where possible to a **Device Module** — an auto-extracted native panel with knobs/jacks
   bound to the code (ticket P6-03) — and is audible in the simulator via sketch-level
   simulation (Level 2). Custom Code remains the graceful fallback.

## 6. Undo/redo & persistence

Store PatchDoc in zustand with immer patches; undo stack = inverse patch list, knob gestures
coalesced (pointerdown→pointerup = one entry). Persist debounced to IndexedDB
(`patches` store, keyed by `meta.id`); export/import as `.amypatch` (pretty JSON, version field,
migrations in `patchdoc/src/migrate.ts`).
