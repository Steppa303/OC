import { describe, expect, it, vi } from 'vitest';
import { checkScript, runScript, type ScriptHooks } from './scriptRuntime';

function hooks(): ScriptHooks & { emits: [string, unknown][]; states: unknown[] } {
  const emits: [string, unknown][] = [];
  const states: unknown[] = [];
  return {
    emits,
    states,
    emit: (j, e) => emits.push([j, e]),
    display: vi.fn(),
    setState: (s) => states.push(s),
  };
}

describe('behavior-script runtime', () => {
  it('runs a sample script that emits on tick', () => {
    const h = hooks();
    const inst = runScript("api.onTick((t) => api.emit('gate', { note: 60, on: true, tick: t.tick }))", { params: {}, state: {} }, h);
    inst.tick({ tick: 3, timeMs: 30 });
    expect(h.emits).toEqual([['gate', { note: 60, on: true, tick: 3 }]]);
  });

  it('exposes params and persistent state', () => {
    const h = hooks();
    const inst = runScript(
      "api.onTick(() => { const n = (api.state.get().n || 0) + api.param('step'); api.state.set({ n }); api.emit('out', n); })",
      { params: { step: 2 }, state: {} },
      h,
    );
    inst.tick({ tick: 0, timeMs: 0 });
    inst.tick({ tick: 1, timeMs: 10 });
    expect(h.emits.map(([, e]) => e)).toEqual([2, 4]);
    expect(h.states.at(-1)).toEqual({ n: 4 });
  });

  it('picks up updated params/state between ticks', () => {
    const h = hooks();
    const inst = runScript("api.onTick(() => api.emit('out', api.param('x')))", { params: { x: 1 }, state: {} }, h);
    inst.tick({ tick: 0, timeMs: 0 });
    inst.updateContext({ x: 9 }, {});
    inst.tick({ tick: 1, timeMs: 0 });
    expect(h.emits.map(([, e]) => e)).toEqual([1, 9]);
  });

  it('shadows forbidden globals (no network/DOM)', () => {
    const h = hooks();
    const inst = runScript(
      "api.onTick(() => { if (typeof fetch === 'undefined' && typeof importScripts === 'undefined') api.emit('safe', true); })",
      { params: {}, state: {} },
      h,
    );
    inst.tick({ tick: 0, timeMs: 0 });
    expect(h.emits).toEqual([['safe', true]]);
  });

  it('checkScript rejects scripts that name forbidden globals', () => {
    expect(checkScript("api.onTick(() => fetch('http://x'))")).toContain("use of 'fetch' is not allowed");
    expect(checkScript('api.onTick(() => {})')).toEqual([]);
  });
});
