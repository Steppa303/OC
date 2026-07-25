/// <reference lib="webworker" />
export {}; // ensure module scope
/**
 * P6-01 spike: run a Python sketch in a Worker via micropython-wasm, with stubbed
 * `amy` / `amyboard` modules that forward every call back to the host. This proves
 * out the sketch-level simulation runtime the full shim (P6-02) will build on.
 */
// The Emscripten glue doesn't survive Vite's ES-module worker transform, so we
// load it (and its wasm) as unbundled static assets from public/ at runtime.
const WASM_URL = '/micropython.wasm';
const GLUE_URL = '/micropython.mjs';

interface Mp {
  runPythonAsync(code: string): Promise<unknown>;
  registerJsModule(name: string, mod: Record<string, unknown>): void;
}
type LoadMicroPython = (opts: { url?: string; stdout?: (t: string) => void; stderr?: (t: string) => void }) => Promise<Mp>;

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data as { sketch?: string };
  const post = (m: unknown) => self.postMessage(m);
  try {
    // Import the glue via a Blob URL so Vite's dev server doesn't transform it.
    const src = await (await fetch(GLUE_URL)).text();
    const blobUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const glue = (await import(/* @vite-ignore */ blobUrl)) as { loadMicroPython: LoadMicroPython };
    const mp = await glue.loadMicroPython({
      url: WASM_URL,
      stdout: (text) => post({ type: 'stdout', text }),
      stderr: (text) => post({ type: 'stderr', text }),
    });

    // Stubbed board APIs — calls are captured and forwarded to the host.
    mp.registerJsModule('amy', {
      send: (...args: unknown[]) => post({ type: 'call', module: 'amy', method: 'send', args }),
      reset: (...args: unknown[]) => post({ type: 'call', module: 'amy', method: 'reset', args }),
    });
    mp.registerJsModule('amyboard', {
      cv_in: (...args: unknown[]) => post({ type: 'call', module: 'amyboard', method: 'cv_in', args }),
      cv_out: (...args: unknown[]) => post({ type: 'call', module: 'amyboard', method: 'cv_out', args }),
    });

    await mp.runPythonAsync(msg.sketch ?? '');
    post({ type: 'done' });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
