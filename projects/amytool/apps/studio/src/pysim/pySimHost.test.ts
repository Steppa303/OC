import { describe, expect, it, vi } from 'vitest';
import { PySimHost } from './pySimHost';

/** Minimal fake Worker capturing postMessage and letting tests emit messages. */
class FakeWorker {
  posted: unknown[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(m: unknown): void {
    this.posted.push(m);
  }
  terminate(): void {}
  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

function makeHost(initialVars?: Record<string, number>) {
  const worker = new FakeWorker();
  const host = new PySimHost({
    sketch: 'feedback = 0.5',
    onSend: vi.fn(),
    createWorker: () => worker as unknown as Worker,
    ...(initialVars ? { initialVars } : {}),
  });
  return { host, worker };
}

describe('PySimHost.setVar (P6-03)', () => {
  it('queues setVar until the sketch is ready, then flushes in order', () => {
    const { host, worker } = makeHost();
    host.setVar('feedback', 0.8);
    expect(worker.posted.filter((m) => (m as { type: string }).type === 'set')).toHaveLength(0);

    worker.emit({ type: 'ready', hasLoop: false });
    expect(worker.posted).toContainEqual({ type: 'set', name: 'feedback', value: 0.8 });
  });

  it('sends setVar immediately once ready', () => {
    const { host, worker } = makeHost();
    worker.emit({ type: 'ready', hasLoop: false });
    host.setVar('tone', 0.25);
    expect(worker.posted).toContainEqual({ type: 'set', name: 'tone', value: 0.25 });
  });

  it('applies initialVars on ready before queued vars', () => {
    const { host, worker } = makeHost({ feedback: 0.9 });
    host.setVar('feedback', 0.1);
    worker.emit({ type: 'ready', hasLoop: false });
    const sets = worker.posted.filter((m) => (m as { type: string }).type === 'set');
    expect(sets).toEqual([
      { type: 'set', name: 'feedback', value: 0.9 },
      { type: 'set', name: 'feedback', value: 0.1 },
    ]);
  });

  it('drops non-finite values and calls after dispose', () => {
    const { host, worker } = makeHost();
    worker.emit({ type: 'ready', hasLoop: false });
    host.setVar('a', Number.NaN);
    host.dispose();
    host.setVar('a', 1);
    expect(worker.posted.filter((m) => (m as { type: string }).type === 'set')).toHaveLength(0);
  });
});
