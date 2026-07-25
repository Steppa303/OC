/// <reference lib="webworker" />
export {}; // ensure module scope
/**
 * Level-2 simulation worker (P6-02). Runs a user sketch in micropython-wasm with
 * Python shims for `amy` / `amyboard`: `amy.send(**kwargs)` forwards the kwargs as
 * JSON to the host (→ engine wire), `amyboard.cv_in(ch)` reads CV values pushed by
 * the host each tick, and a `loop()` if defined is called every tick. Tracebacks
 * from setup/loop are surfaced as `error` messages.
 */
const WASM_URL = '/micropython.wasm';
const GLUE_URL = '/micropython.mjs';

interface Mp {
  runPythonAsync(code: string): Promise<unknown>;
  registerJsModule(name: string, mod: Record<string, unknown>): void;
}
type LoadMicroPython = (opts: { url?: string; stdout?: (t: string) => void; stderr?: (t: string) => void }) => Promise<Mp>;

// Python preamble: install amy/amyboard as import-able modules backed by _bridge.
const PREAMBLE = `
import sys, json, _bridge
class _Amy:
    def send(self, **kwargs):
        _bridge.send(json.dumps(kwargs))
    def reset(self, *a, **k):
        _bridge.reset()
class _Board:
    def cv_in(self, channel=0):
        return _bridge.cv_in(channel)
    def cv_out(self, voltage=0, channel=0):
        _bridge.cv_out(channel, voltage)
sys.modules['amy'] = _Amy()
sys.modules['amyboard'] = _Board()
`;

let mp: Mp | null = null;
let cv: number[] = [0, 0];
let hasLoop = false;

/** Only plain identifiers may be assigned via 'set' (device knob write-back, P6-03). */
const PY_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data as { type: string; sketch?: string; cv?: number[]; name?: string; value?: number };
  const post = (m: unknown) => self.postMessage(m);

  if (msg.type === 'init') {
    try {
      const src = await (await fetch(GLUE_URL)).text();
      const blobUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const glue = (await import(/* @vite-ignore */ blobUrl)) as { loadMicroPython: LoadMicroPython };
      mp = await glue.loadMicroPython({
        url: WASM_URL,
        stdout: (text) => post({ type: 'stdout', text }),
        stderr: (text) => post({ type: 'stderr', text }),
      });
      mp.registerJsModule('_bridge', {
        send: (jsonStr: string) => post({ type: 'send', kwargs: jsonStr }),
        reset: () => post({ type: 'reset' }),
        cv_in: (channel: number) => cv[channel] ?? 0,
        cv_out: (channel: number, voltage: number) => post({ type: 'cv_out', channel, voltage }),
        set_has_loop: (v: unknown) => {
          hasLoop = Boolean(v);
        },
      });
      await mp.runPythonAsync(PREAMBLE + '\n' + (msg.sketch ?? ''));
      // Report whether the sketch defines a loop() (via the bridge, so we don't
      // depend on runPythonAsync's return-value marshalling).
      await mp.runPythonAsync("_bridge.set_has_loop(callable(globals().get('loop')))");
      post({ type: 'ready', hasLoop });
    } catch (err) {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  } else if (msg.type === 'loop') {
    if (!mp || !hasLoop) return;
    if (msg.cv) cv = msg.cv;
    try {
      await mp.runPythonAsync('loop()');
    } catch (err) {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  } else if (msg.type === 'set') {
    // Device knob write-back (P6-03): assign a numeric value to a top-level
    // sketch variable. Identifier + finite-number guards keep this a pure
    // assignment — never arbitrary code.
    if (!mp || typeof msg.name !== 'string' || !PY_IDENT_RE.test(msg.name)) return;
    if (typeof msg.value !== 'number' || !Number.isFinite(msg.value)) return;
    try {
      await mp.runPythonAsync(`${msg.name} = ${msg.value}`);
    } catch {
      /* a failed assignment must not kill the running sim */
    }
  }
};
