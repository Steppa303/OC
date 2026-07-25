import { describe, expect, it, vi } from 'vitest';
import { ScriptHost, type HostMessage, type WorkerLike } from './scriptHost';
import { runScript, type ScriptInstance } from './scriptRuntime';

/** A WorkerLike that runs the real runtime in-process (well-behaved script). */
class LocalWorker implements WorkerLike {
  onmessage: ((e: { data: HostMessage }) => void) | null = null;
  #instance: ScriptInstance | null = null;
  terminated = false;

  postMessage(message: unknown): void {
    const msg = message as { type: string; script?: string; id?: number; info?: { tick: number; timeMs: number }; params?: Record<string, string | number | boolean>; state?: Record<string, unknown> };
    if (msg.type === 'init') {
      this.#instance = runScript(msg.script ?? '', { params: msg.params ?? {}, state: msg.state ?? {} }, {
        emit: (jackId, event) => this.onmessage?.({ data: { type: 'emit', jackId, event } }),
        display: (id, data) => this.onmessage?.({ data: { type: 'display', id, data } }),
        setState: (state) => this.onmessage?.({ data: { type: 'state', state } }),
      });
    } else if (msg.type === 'tick') {
      this.#instance?.updateContext(msg.params ?? {}, msg.state ?? {});
      this.#instance?.tick(msg.info ?? { tick: 0, timeMs: 0 });
      this.onmessage?.({ data: { type: 'ack', id: msg.id ?? 0 } });
    }
  }
  terminate(): void {
    this.terminated = true;
  }
}

/** A WorkerLike that never answers a tick (a stuck script). */
class HungWorker implements WorkerLike {
  onmessage: ((e: { data: HostMessage }) => void) | null = null;
  terminated = false;
  postMessage(): void {
    /* never acks */
  }
  terminate(): void {
    this.terminated = true;
  }
}

describe('ScriptHost', () => {
  it('relays a sample script’s emits and acks each tick', () => {
    const emits: [string, unknown][] = [];
    const host = new ScriptHost({
      script: "api.onTick((t) => api.emit('gate', { note: 60, tick: t.tick }))",
      getParams: () => ({}),
      getState: () => ({}),
      onEmit: (j, e) => emits.push([j, e]),
      createWorker: () => new LocalWorker(),
    });
    host.tick({ tick: 1, timeMs: 10 });
    host.tick({ tick: 2, timeMs: 20 });
    expect(emits).toEqual([
      ['gate', { note: 60, tick: 1 }],
      ['gate', { note: 60, tick: 2 }],
    ]);
    expect(host.alive).toBe(true);
  });

  it('kills a stuck script and badges "script error" on budget overrun', async () => {
    const worker = new HungWorker();
    let error: string | null = null;
    const host = new ScriptHost({
      script: 'api.onTick(() => { while (true) {} })',
      getParams: () => ({}),
      getState: () => ({}),
      budgetMs: 20,
      onError: (m) => (error = m),
      createWorker: () => worker,
    });
    host.tick({ tick: 0, timeMs: 0 });
    await new Promise((r) => setTimeout(r, 50));
    expect(worker.terminated).toBe(true);
    expect(host.alive).toBe(false);
    expect(error).toMatch(/budget exceeded/i);
  });

  it('rejects an unsafe script before starting a worker', () => {
    const createWorker = vi.fn();
    let error: string | null = null;
    const host = new ScriptHost({
      script: "api.onTick(() => fetch('http://evil'))",
      getParams: () => ({}),
      getState: () => ({}),
      onError: (m) => (error = m),
      createWorker,
    });
    expect(createWorker).not.toHaveBeenCalled();
    expect(host.alive).toBe(false);
    expect(error).toMatch(/fetch/);
  });

  it('surfaces a worker error and stops', () => {
    let error: string | null = null;
    const worker: WorkerLike = {
      onmessage: null,
      postMessage(msg) {
        if ((msg as { type: string }).type === 'init') this.onmessage?.({ data: { type: 'error', message: 'boom' } });
      },
      terminate: vi.fn(),
    };
    const host = new ScriptHost({
      script: 'api.onTick(() => {})',
      getParams: () => ({}),
      getState: () => ({}),
      onError: (m) => (error = m),
      createWorker: () => worker,
    });
    expect(error).toBe('boom');
    expect(host.alive).toBe(false);
  });
});
