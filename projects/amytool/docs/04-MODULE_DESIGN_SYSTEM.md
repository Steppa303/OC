# Module Design System

Two audiences: (a) our own components, (b) **LLMs generating new modules** — the manifest format
below is the contract that makes generated modules look native and behave safely. All visual
constants live in `packages/ui/src/tokens.css`; components in `packages/ui` consume only tokens.

## 1. Look & feel

Dark, precise, DAW/VCV-inspired. Matte near-black rack background with subtle rails; panels
slightly lighter with 1px inset border; no skeuomorphic wood/screws kitsch — clean flat panels,
crisp typography, colored jacks and cables as the primary color accents.

### Core tokens (fixed in Phase 0, extend—don't fork)

```css
--bg-app:#0e0f12; --bg-rack:#121318; --bg-panel:#1a1c22; --bg-panel-raised:#20232b;
--border-panel:#2a2e38; --text-primary:#e6e8ee; --text-secondary:#9aa0ae; --text-dim:#5c6270;
--accent:#4fc3f7;            /* selection, active states */
--jack-audio:#ffb648; --jack-cv:#7ee08a; --jack-gate:#f26d85; --jack-midi:#8f7ef2;
--display-bg:#0a0c10; --display-fg:#7ee08a;   /* scope/value displays: green-on-black */
--danger:#ff5964; --warn:#ffcf5c; --ok:#57d99b;
--font-ui:'Inter',system-ui; --font-mono:'JetBrains Mono',monospace;
--hp:24px;                    /* 1 HP in px at zoom 1 */
--panel-h:380px;              /* one rack row */
--radius-panel:6px; --radius-control:4px;
```

Cables render as the jack-kind color at 85% opacity, bezier with gravity sag, 3px wide, glow on
hover/selection. Dragging shows legal targets highlighted (from the capability matrix) and
illegal jacks dimmed.

## 2. Panel anatomy & layout grid

- Module width: integer HP (min 4, max 24). **Node layout (Stufe 2):** modules render as
  Blender-style nodes — a header plus a vertical stack of **rows**, height auto-sizing to content
  (`Panel node`). Each row optionally carries an **input pin on its left edge** and/or an **output
  pin on its right edge**; the pin is the React Flow handle + a kind-colored socket dot.
- Row kinds (top→bottom): **header** (name, 28px, drag handle + menu ⋮ + close ×), an optional
  **advanced toggle**, **param rows** (label · `<Slider>`/`<Select>`/`<Toggle>` · value), **input
  rows** (left pin + label, for standalone inputs like audio-in / gate / note), a **widget row**
  (full-width keyboard / drum grid / scope / display), and **output rows** (label + right pin).
- **Per-control pins:** a jack whose manifest sets `param: <paramId>` renders its pin on that
  param's row (e.g. VCF `cutoff_cv` sits on the Cutoff row; mixer `in1` on the Level-1 row). Jacks
  without `param` render as their own input/output rows.
- Controls are **sliders, not knobs** (`<Slider>` shows label · range · value, kind-neutral). The
  `<Knob>` primitive still exists but modules no longer use it. Other primitives: `<Select>`,
  `<Toggle>`, `<StepGrid>`, `<Display kind="scope|value|text">`, `<Jack>`, `<NodeRow>`.
- Advanced mode: ⋮ menu → "Advanced" adds a bordered sub-zone with extra jacks/params; panel
  grows in HP if declared (`advancedHp`). Cables to advanced jacks keep working when advanced
  view is collapsed (jack renders as mini stub).

## 3. Module manifest (contract for library + LLM-generated modules)

`packages/modules/schema.ts` — zod schema `ModuleManifestV1`:

```jsonc
{
  "manifestVersion": 1,
  "id": "user.drumgrid909",            // namespace: core.* | group.* | user.*
  "name": "909 Drum Grid",
  "category": "sequencer",             // source|filter|envelope|modulation|mixer|fx|io|sequencer|display|voice
  "hp": 16, "advancedHp": 20,
  "description": "4-track 16-step drum grid…",
  "params": [
    { "id": "wave", "label": "Wave", "control": "select", "options": ["sine","saw","square","triangle","noise","pulse"],
      "default": "saw", "amyParam": "wave" },                       // amyParam must exist in amy-protocol params.ts
    { "id": "cutoff", "label": "Cutoff", "control": "knob", "min": 20, "max": 20000, "scale": "log",
      "default": 800, "unit": "Hz", "amyParam": "filter_freq", "advanced": false }
  ],
  "jacks": [
    { "id": "in",   "kind": "audio", "dir": "in" },
    { "id": "out",  "kind": "audio", "dir": "out" },
    { "id": "fm",   "kind": "cv",    "dir": "in", "target": "freq", "advanced": true }
  ],
  "displays": [ { "id": "scope", "kind": "scope", "source": "out" } ],
  "role": "vco",                        // allocator role: vco|vcf|env|lfo|vca|fx|io|seq|voice|custom
  "voice": { "patchRange": [128,255] }, // only for preset-voice modules
  "sequencer": { "tracks": 4, "steps": 16, "trackDefaults": [{ "patch": 384, "note": 36 }] },
  "behavior": null                      // or { "script": "…", see §4 }
}
```

Rules the validator enforces (and the LLM prompt states): every `amyParam` must exist in the
protocol table; jack ids unique; hp within bounds; `role` determines which allocator handles it;
no free-form code outside `behavior.script`; category picks the header accent used in the
library browser.

**Module groups** (`group.*`) are manifests containing `modules: [...]` + `cables: [...]`
(a PatchDoc fragment with relative positions) — inserting one drops the pre-wired sub-graph.

## 4. Behavior scripts (sandboxed, optional)

For modules needing logic beyond declarative mapping (e.g. a generative sequencer):
JavaScript run in a dedicated Worker, API surface frozen to:

```ts
api.onTick(cb)            // sequencer clock callbacks (tempo-synced)
api.emit(jackId, event)   // send gate/cv/midi events out of declared jacks
api.param(paramId)        // read current param values
api.state.get()/set()     // module state (persisted into PatchDoc modules[].state)
api.display(id, data)     // push data to declared displays
```

No DOM, no fetch, no dynamic import, 5 ms/tick CPU budget (terminated + module badged "script
error" on overrun). Scripts affect the patch only through `emit` → normal PatchDoc/wire paths.

## 5. Core library (Phase 1 scope)

`core.midiin`, `core.keyboard` (on-screen), `core.cvin`, `core.audioin`, `core.vco`,
`core.lfo`, `core.noise`, `core.vcf`, `core.env` (ADSR view over bp sets), `core.vca`,
`core.mixer4`, `core.fx.reverb/chorus/echo/eq`, `core.out`, `core.scope`,
`core.junovoice`, `core.dx7voice`, `core.drumvoice`.
Phase 5/6 add: `core.stepseq16`, `core.drumgrid`, `group.subtractive`, `group.fm2op`,
`group.drummachine`.

Every core module doubles as a reference implementation: an LLM generating `user.*` modules is
shown 2–3 core manifests as few-shot examples (see docs/05 §Module generation).
