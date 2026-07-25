/**
 * Behavior-script host (docs/04 §4). Owns the Worker running a module's script,
 * relays its `emit`/`display`/`state`, and enforces the per-tick CPU budget: a
 * tick that doesn't ACK within the budget means the script is stuck, so the
 * worker is terminated and the module is badged "script error".
 */
import { checkScript } from './scriptRuntime';

export type HostMessage =
  | { type: 'ack'; id: number }
  | { type: 'emit'; jackId: string; event: unknown }
  | { type: 'display'; id: string; data: unknown }
  | { type: 'state'; state: Record<string, unknown> }
  | { type: 'error'; message: string };

/** The subset of Worker this host uses (so tests can inject a fake). */
export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: HostMessage }) => void) | null;
  onerror?: ((event: unknown) => void) | null;
}

export interface ScriptHostConfig {
  script: string;
  getParams: () => Record<string, string | number | boolean>;
  getState: () => Record<string, unknown>;
  budgetMs?: number;
  onEmit?: (jackId: string, event: unknown) => void;
  onDisplay?: (id: string, data: unknown) => void;
  onState?: (state: Record<string, unknown>) => void;
  /** Called with a reason when the script is killed → module badge "script error". */
  onError?: (message: string) => void;
  /** Worker factory (defaults to the bundled behaviorWorker). */
  createWorker?: () => WorkerLike;
}

const DEFAULT_BUDGET_MS = 5;

function defaultWorker(): WorkerLike {
  return new Worker(new URL('./behaviorWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
}

export class ScriptHost {
  #worker: WorkerLike | null = null;
  #cfg: ScriptHostConfig;
  #budget: number;
  #tickId = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #dead = false;

  constructor(cfg: ScriptHostConfig) {
    this.#cfg = cfg;
    this.#budget = cfg.budgetMs ?? DEFAULT_BUDGET_MS;

    // Reject obviously-unsafe scripts before ever starting a worker.
    const staticErrors = checkScript(cfg.script);
    if (staticErrors.length > 0) {
      this.#dead = true;
      cfg.onError?.(staticErrors.join('; '));
      return;
    }

    this.#worker = (cfg.createWorker ?? defaultWorker)();
    this.#worker.onmessage = (e) => this.#onMessage(e.data);
    if ('onerror' in this.#worker) this.#worker.onerror = () => this.#kill('worker crashed');
    this.#worker.postMessage({ type: 'init', script: cfg.script, params: cfg.getParams(), state: cfg.getState() });
  }

  get alive(): boolean {
    return !this.#dead;
  }

  /** Advance the script one tick, enforcing the CPU budget. */
  tick(info: { tick: number; timeMs: number }): void {
    if (this.#dead || !this.#worker) return;
    const id = ++this.#tickId;
    this.#timer = setTimeout(() => this.#kill(`CPU budget exceeded (${this.#budget}ms/tick)`), this.#budget);
    this.#worker.postMessage({
      type: 'tick',
      id,
      info,
      params: this.#cfg.getParams(),
      state: this.#cfg.getState(),
    });
  }

  dispose(): void {
    this.#clearTimer();
    this.#worker?.terminate();
    this.#worker = null;
    this.#dead = true;
  }

  #onMessage(msg: HostMessage): void {
    switch (msg.type) {
      case 'ack':
        this.#clearTimer();
        break;
      case 'emit':
        this.#cfg.onEmit?.(msg.jackId, msg.event);
        break;
      case 'display':
        this.#cfg.onDisplay?.(msg.id, msg.data);
        break;
      case 'state':
        this.#cfg.onState?.(msg.state);
        break;
      case 'error':
        this.#kill(msg.message);
        break;
    }
  }

  #kill(message: string): void {
    if (this.#dead) return;
    this.#dead = true;
    this.#clearTimer();
    this.#worker?.terminate();
    this.#worker = null;
    this.#cfg.onError?.(message);
  }

  #clearTimer(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}
