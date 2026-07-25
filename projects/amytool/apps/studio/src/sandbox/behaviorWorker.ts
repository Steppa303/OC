/// <reference lib="webworker" />
/**
 * The Worker entry that hosts a single behavior script (docs/04 §4). It wires the
 * frozen runtime's hooks to postMessage and answers each `tick` with an `ack` so
 * the host can detect a stuck script and enforce the CPU budget.
 */
import { runScript, type ScriptInstance } from './scriptRuntime';

let instance: ScriptInstance | null = null;

self.onmessage = (event: MessageEvent) => {
  const msg = event.data as {
    type: string;
    script?: string;
    id?: number;
    info?: { tick: number; timeMs: number };
    params?: Record<string, string | number | boolean>;
    state?: Record<string, unknown>;
  };

  if (msg.type === 'init') {
    try {
      instance = runScript(
        msg.script ?? '',
        { params: msg.params ?? {}, state: msg.state ?? {} },
        {
          emit: (jackId, e) => self.postMessage({ type: 'emit', jackId, event: e }),
          display: (id, data) => self.postMessage({ type: 'display', id, data }),
          setState: (state) => self.postMessage({ type: 'state', state }),
        },
      );
    } catch (err) {
      self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  } else if (msg.type === 'tick') {
    try {
      instance?.updateContext(msg.params ?? {}, msg.state ?? {});
      instance?.tick(msg.info ?? { tick: 0, timeMs: 0 });
      self.postMessage({ type: 'ack', id: msg.id });
    } catch (err) {
      self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }
};
