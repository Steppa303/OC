# LLM Codegen Spec — output contracts, prompts, verification

Users bring their own OpenRouter key **and model** — output quality varies wildly. We compensate
with (1) strict machine-checkable output contracts, (2) constrained generation targets,
(3) an automated verify→repair loop. Implemented in `packages/llm`.

## 1. OpenRouter integration

- Endpoint: `POST https://openrouter.ai/api/v1/chat/completions` directly from the browser
  (OpenRouter supports CORS + `HTTP-Referer`/`X-Title` headers — set them to the app).
- Settings page: API key (masked, localStorage `or_api_key`), model picker populated from
  `GET /api/v1/models` (searchable, shows pricing/context length), per-feature overrides
  (patch-gen model vs. module-gen model), temperature fixed at 0.2 for generation tasks.
- Always request `response_format: { type: "json_object" }` when supported; contract prompt
  demands raw JSON regardless, and the parser strips ``` fences defensively.
- Streaming into the UI for perceived speed; parse only the complete message.

## 2. Key design decision: generate PatchDoc, not free-form Python

The LLM's primary target is a **constrained JSON "PatchPlan"**, not Python. Rationale: JSON is
schema-validatable, model-agnostic (cheap models produce far more reliable JSON than correct
API-specific Python), and maps 1:1 onto our compilers — the *deterministic* `compileToSketch`
produces the Python, so generated code is correct by construction.

### PatchPlan contract (zod: `llm/src/contracts/patchplan.ts`)

```jsonc
{
  "contract": "patchplan.v1",
  "name": "Warm Pad",
  "modules": [ { "id": "vco1", "type": "core.vco", "params": { "wave": "saw", ... } }, ... ],
  "cables":  [ { "from": "vco1.out", "to": "vcf1.in" }, ... ],
  "globals": { "effects": { "reverb": { "level": 0.4 } }, "tempo": 100 },
  "io": { "midiChannel": 1 },
  "notes": "one sentence on the sound design intent"
}
```

Module `type` must be from the library catalog injected into the prompt; params validated
against manifests; cables validated against the capability matrix. Positions/layout are NOT
the LLM's job — auto-layout assigns them.

An **escape hatch** exists for requests that exceed PatchDoc semantics (e.g. "a complex
multi-tap delay effect unit"): the model may add `"loopCode": "python…"` (goes to
`extras.userLoopCode`, verified by the Python checks below). The prompt instructs the model to
prefer pure PatchPlan. loopCode devices are not second-class: they run audibly in the
simulator via sketch-level simulation (Level 2, Phase 6) and get a native auto-extracted
panel via the **Device Module** pipeline (`DeviceManifest` contract, ticket P6-03) — the raw
Custom Code box is only the fallback when extraction fails.

## 3. Prompt templates (`llm/src/prompts/`)

All prompts share a system preamble:

- Role + hard rules ("output exactly one JSON object, no markdown, no commentary",
  "only module types and params from the CATALOG below", "max 2 envelope targets per
  oscillator", …the capability matrix summarized in prose).
- **CATALOG**: auto-generated compact listing of available module manifests (id, params with
  ranges/enums, jacks) — regenerated from the library at prompt-build time so LLM knowledge is
  always in sync with the app.
- 2 few-shot examples (prompt → valid PatchPlan), chosen small.

Template variants: `generatePatch` (prompt→PatchPlan), `editPatch` (current PatchDoc digest +
instruction → PatchPlan diff, same contract with `"base": "<docId>"`), `generateModule`
(prompt→ModuleManifestV1, few-shot = 3 core manifests incl. one with `sequencer` and one with
`behavior.script`; script API docs embedded), `explainPatch` (doc digest → user-facing prose).

## 4. Verify → repair loop (`llm/src/pipeline.ts`)

```
raw text → strip fences → JSON.parse → zod contract → domain validation
(manifest params, capability matrix, allocator dry-run) → compileToWire
→ headless render smoke test (AmyWasmEngine offline: send wire, render 2 s,
assert non-silent RMS, no NaN, no engine errors) → accept
```

On any failure: build a **repair message** containing the exact machine error(s) (zod path +
message, validator reason, engine stderr) and re-ask the same model: "Your previous output
failed validation: … Return the corrected JSON only." Max **3 attempts**, then surface a
friendly failure with the raw errors collapsed and a "try different model" hint.
Each stage logged to a collapsible "generation trace" panel (great for debugging cheap models).

For `loopCode` / module `behavior.script`: static checks only in-app — Python: AST-parse via
tree-sitter-python or pyodide `ast` (no execution), whitelist imports (`amy`, `amyboard`,
`math`, `random`, `time`), forbid file/network/exec; JS scripts: parse + forbid
`importScripts/fetch/XMLHttpRequest/eval`, then sandbox-execute 100 simulated ticks in the
Worker with asserts on emitted event validity.

## 5. Module generation flow (user-facing)

Library → "＋ New module from prompt" → dialog (prompt + model override) → pipeline as above
with the module contract → on success: **preview card** (rendered panel + auto-connected to a
test voice for audition) → user clicks "Add to library" → stored in IndexedDB (`modules`
store), exportable/importable as JSON. Rejected manifests never enter the library. A "Remix"
action re-opens generation with the existing manifest as context.

## 6. Quality metrics ("does it match the user's wish?")

- Every generation stores prompt + accepted result in fixtures format; users get 👍/👎 on
  results (local only) — the eval harness (docs/06 §LLM evals) replays fixture prompts against
  candidate contract/prompt changes and reports pass-rate deltas before we merge prompt edits.
- `notes` field is shown to the user so they can spot intent mismatches immediately.
