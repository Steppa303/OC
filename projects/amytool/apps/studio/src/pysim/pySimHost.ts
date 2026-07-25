/**
 * PySimHost (P6-02) — drives the Level-2 simulation worker: loads a sketch, runs
 * its top-level setup, then calls `loop()` on a ~60 ms scheduler, forwarding
 * `amy.send` kwargs to `onSend` (→ engine wire) and pushing CV values in. Python
 * tracebacks surface via `onError`.
 */
export interface PySimHostConfig {
  sketch: string;
  onSend: (kwargs: Record<string, unknown>) => void;
  onReset?: () => void;
  getCv?: () => number[];
  onError?: (traceback: string) => void;
  onStdout?: (text: string) => void;
  loopMs?: number;
  createWorker?: () => Worker;
  /** Variable values applied once setup finished (device knob state, P6-03). */
  initialVars?: Record<string, number>;
}

const DEFAULT_LOOP_MS = 60;

function defaultWorker(): Worker {
  return new Worker(new URL('./pySimWorker.ts', import.meta.url), { type: 'module' });
}

export class PySimHost {
  #worker: Worker;
  #cfg: PySimHostConfig;
  #timer: ReturnType<typeof setInterval> | null = null;
  #stderr = '';
  #disposed = false;
  #ready = false;
  /** setVar calls made before the sketch finished setup, applied on ready. */
  #pendingVars: [string, number][] = [];

  constructor(cfg: PySimHostConfig) {
    this.#cfg = cfg;
    this.#worker = (cfg.createWorker ?? defaultWorker)();
    this.#worker.onmessage = (e: MessageEvent) => this.#onMessage(e.data);
    this.#worker.postMessage({ type: 'init', sketch: cfg.sketch });
  }

  #onMessage(m: { type: string; kwargs?: string; text?: string; hasLoop?: boolean; message?: string }): void {
    if (this.#disposed) return;
    switch (m.type) {
      case 'send':
        try {
          this.#cfg.onSend(JSON.parse(m.kwargs ?? '{}') as Record<string, unknown>);
        } catch {
          /* ignore a send we can't parse */
        }
        break;
      case 'reset':
        this.#cfg.onReset?.();
        break;
      case 'stdout':
        this.#cfg.onStdout?.(m.text ?? '');
        break;
      case 'stderr':
        this.#stderr += m.text ?? '';
        break;
      case 'ready':
        this.#ready = true;
        for (const [name, value] of Object.entries(this.#cfg.initialVars ?? {})) {
          this.#worker.postMessage({ type: 'set', name, value });
        }
        for (const [name, value] of this.#pendingVars) {
          this.#worker.postMessage({ type: 'set', name, value });
        }
        this.#pendingVars = [];
        if (m.hasLoop) this.#startLoop();
        break;
      case 'error':
        this.#cfg.onError?.([this.#stderr, m.message ?? ''].filter(Boolean).join('\n'));
        this.dispose();
        break;
    }
  }

  #startLoop(): void {
    const loopMs = this.#cfg.loopMs ?? DEFAULT_LOOP_MS;
    this.#timer = setInterval(() => {
      this.#worker.postMessage({ type: 'loop', cv: this.#cfg.getCv?.() ?? [0, 0] });
    }, loopMs);
  }

  /** Assign a numeric value to a top-level sketch variable (device knob, P6-03).
   *  Queued until the sketch's setup finished so it never races the init. */
  setVar(name: string, value: number): void {
    if (this.#disposed || !Number.isFinite(value)) return;
    if (!this.#ready) {
      this.#pendingVars.push([name, value]);
      return;
    }
    this.#worker.postMessage({ type: 'set', name, value });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#worker.terminate();
  }
}
