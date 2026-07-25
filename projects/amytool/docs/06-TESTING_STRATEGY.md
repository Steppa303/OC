# Testing Strategy

Gate: `npm run check` = typecheck + eslint + vitest. Runs in CI (GitHub Actions) on every push;
Playwright suite (`npm run e2e`) on PRs to main. **Agents run `npm run check` before every
"done".** No skipped/`.only` tests may land.

## Layers

### 1. Unit (vitest, colocated `*.test.ts`)
- `amy-protocol`: wire codec encode/decode symmetry for every param in `params.ts`
  (property-based: random valid values → encode → decode → equal). Table completeness test:
  every param has letter, type, range.
- `patchdoc`: schema validation cases (valid/invalid fixtures), allocator determinism + slot
  limits (3rd envelope rejected, mod source allocation), capability matrix coverage (every
  jack kind × param class has an explicit entry — no implicit undefined).
- `llm`: contract parsing (fence-stripping, truncated JSON, wrong-shape → typed errors), repair
  message construction, catalog generation from manifests.
- `board`: SysEx framing (envelope bytes, base64 chunking ≤188 raw bytes, ACK sequencing,
  timeout paths) against `MockTransport` which replays fixture transcripts.
- `modules`: every core manifest passes schema; sandbox kills over-budget scripts; script API
  surface is frozen (attempting `fetch` throws).

### 2. Golden fixtures (`fixtures/`) — the backbone of round-trip safety
- `fixtures/patches/*.amypatch` — canonical PatchDocs (subtractive, FM, drum machine, CV-mod,
  each core module isolated).
- For each: committed expected `*.wire` (compileToWire output) and `*.sketch.py`
  (compileToSketch output). Tests assert byte-exact match; intentional changes regenerate via
  `npm run fixtures:update` and show up in git diff for review.
- Round-trip: `parseSketch(compileToSketch(doc)) ≡ doc`;
  `parseWireDump(fixtures/dumps/*.txt)` → allocator-stable doc → `compileToWire` reproduces
  param-equivalent state.
- Foreign-code fixtures: hand-written sketches (incl. from amyboard docs/examples) → parseSketch
  must not throw, warnings match snapshot, unmodeled code lands in `extras`.

### 3. Audio smoke tests (vitest + AMY-WASM offline, Node)
Render 2 s per golden patch → assert: non-silent (RMS > threshold), no NaN/Inf, no engine
error log. Store a coarse spectral fingerprint (band energies) per fixture; large deviation
fails the test (catches "compiler silently changed the sound"). Thresholds loose enough to
survive AMY version bumps; tightened per-fixture only where stable.

### 4. E2E (Playwright, Chromium)
Core journeys: build subtractive patch by cable-dragging → play on-screen keyboard → hear audio
(assert via engine event hook, not actual sound); paste sketch code → canvas populates →
edit knob → code view updates; insert `group.subtractive` → pre-wired; generate patch with a
**mocked OpenRouter** (fixture responses incl. one invalid-then-repaired sequence) → patch
appears; settings persist key/model; board flow against MockTransport (connect → import dump →
canvas shows modules → upload sketch → transcript matches expected SysEx byte sequence).

### 5. LLM evals (manual/nightly, real API — not in CI)
`npm run eval:llm -- --model <id>`: replays `fixtures/prompts/*.json` (prompt + acceptance
checks: required module types present, cable count range, verification passes) against a real
model. Reports pass rate per contract version. Run before merging any prompt/contract change,
and periodically against the cheap target models (deepseek-v4-flash, mimo) to keep contracts
cheap-model-proof.

### 6. Hardware QA checklist (manual, Phase 3+)
`docs/HARDWARE_QA.md` (created in P3-06): scripted checklist — connect, ping (`zI`→`OK`),
import dump, upload sketch, realtime knob → audible change, error path (broken sketch → `X`
traceback shown), reboot recovery. Owner executes with the board; agent prepares exact steps
and expected observations.

## Conventions
- Test names describe behavior ("rejects third envelope cable with AMY limit message").
- No network in unit/E2E tests: OpenRouter and board always mocked; WASM vendored locally.
- New bug → regression test in the same commit as the fix.
