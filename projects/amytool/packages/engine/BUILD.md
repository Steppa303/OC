# AMY-WASM vendored build

## Provenance

| File | Source | Commit |
|---|---|---|
| `vendor/amy.js` | https://github.com/shorepine/amy `docs/amy.js` | `d88bcf819a8782a1728c4e757ed429908778c3c9` (2026-07-18) |
| `vendor/amy.wasm` | same repo, `docs/amy.wasm` | same |
| `vendor/enable-threads.js` | same repo, `docs/enable-threads.js` | same |

`amy.js` is the emscripten build **plus** shorepine's connector glue (`src/amy_connector.js`),
which defines the page-level globals we drive: `amyModule`, `amy_send`, `amy_message`,
`amy_add_message`, `amy_live_start_web`, `amy_live_stop`, `amy_sysclock`, `AMY` constants.
On script load the connector auto-instantiates the module and calls `amy_start_web()`
(default synths ON: Juno patch 0 on synth/channel 1, GM drums on 10, startup bleep armed).
Audio only begins after `amy_live_start_web()` is called from a user gesture.

## Hosting requirements

The build uses wasm workers + an emscripten AudioWorklet → **SharedArrayBuffer**, which needs
cross-origin isolation:

- Dev/preview: our Vite plugin (`@amy/engine/vite`) sets
  `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
  and serves `/amy/*` from `packages/engine/vendor/`.
- Static production hosts that can't set headers: ship `enable-threads.js` (service-worker
  shim, from the same repo) and load it before `amy.js` — see AMY's `minimal.html`.

## Known limitations of the stock build (see DECISIONS.md 2026-07-18)

- `amy_simple_fill_buffer` is **not** exported → no headless/offline rendering in Node.
  Audio smoke tests run in real Chromium via Playwright instead, polling
  `_amy_get_output_buffer` (copies the last rendered 256-frame stereo block).
- Exported and available: `_amy_add_message`, `_amy_add_event`, `_amy_get_output_buffer`,
  `_amy_get_input_buffer`, `_amy_set_external_input_buffer`, `_amy_start_web`,
  `_amy_start_web_no_synths`, `_amy_live_start_web(_audioin)`, `_amy_live_stop`,
  `_amy_sysclock`, `_amy_reset_sysclock`, `_amy_dump_state_to_string`, `_sequencer_ticks`,
  `_amy_process_single_midi_byte`, `_amy_bleep`.
- JS hook points honored by the build: `amy_render_js_hook`, `amy_block_processed_js_hook`,
  `amy_external_midi_input_js_hook`, `amy_bus_postprocess_js_hook`.

## Upgrading / rebuilding

1. `git clone https://github.com/shorepine/amy && cd amy` (note the commit hash).
2. Install emscripten (`emsdk install latest && emsdk activate latest`).
3. `make docs/amy.js` (produces `docs/amy.js` + `docs/amy.wasm`).
4. If offline rendering is wanted, add `_amy_simple_fill_buffer` to the `EXPORTED_FUNCTIONS`
   list in the web target of AMY's `Makefile` before building, then extend
   `AmyWasmEngine.renderOffline` accordingly.
5. Copy the three files into `vendor/`, update the commit hash table above.
6. `npm run check && npm run e2e` — the audio smoke test gates the upgrade (M-03).
