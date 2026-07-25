import { AmyWasmEngine } from './AmyWasmEngine';
import type { AmyGlobals } from './amyGlobals';

const g = globalThis as unknown as AmyGlobals & { crossOriginIsolated?: boolean };

function installAmyGlobals(overrides: Partial<AmyGlobals> = {}) {
  const sent: string[] = [];
  g.amy_add_message = (msg: string) => {
    sent.push(msg);
  };
  g.amy_live_start_web = () => Promise.resolve();
  g.amy_live_stop = () => Promise.resolve();
  g.amy_sysclock = () => 1234;
  g.amy_module = {
    _malloc: () => 16,
    _free: () => undefined,
    _amy_get_output_buffer: () => 0,
  };
  Object.assign(g, overrides);
  return sent;
}

function clearAmyGlobals() {
  g.amy_add_message = null;
  g.amy_live_start_web = null;
  g.amy_live_stop = null;
  g.amy_sysclock = null;
  g.amy_module = null;
}

beforeEach(() => {
  clearAmyGlobals();
  Object.defineProperty(globalThis, 'crossOriginIsolated', { value: true, configurable: true });
});

describe('AmyWasmEngine', () => {
  it('init loads the script and waits for the connector globals', async () => {
    const engine = new AmyWasmEngine({ initTimeoutMs: 2000 });
    const states: string[] = [];
    engine.onStateChange((s) => states.push(s));
    // simulate script load side effect: globals appear shortly after
    const origAppend = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      setTimeout(() => {
        installAmyGlobals();
        script.onload?.(new Event('load'));
      }, 10);
      return origAppend(node);
    });
    await engine.init();
    expect(engine.state).toBe('ready');
    expect(states).toEqual(['loading', 'ready']);
  });

  it('fails init with a clear message without cross-origin isolation', async () => {
    Object.defineProperty(globalThis, 'crossOriginIsolated', { value: false, configurable: true });
    const engine = new AmyWasmEngine();
    await expect(engine.init()).rejects.toThrow(/cross-origin isolated/);
    expect(engine.state).toBe('error');
  });

  it('sendWire appends Z when missing and requires init', () => {
    const engine = new AmyWasmEngine();
    expect(() => engine.sendWire('v0w0f440')).toThrow(/not initialized/);
    const sent = installAmyGlobals();
    engine.sendWire('v0w0f440');
    engine.sendWire('zY1Z');
    expect(sent).toEqual(['v0w0f440Z', 'zY1Z']);
  });

  it('noteOn/noteOff produce synth note messages', () => {
    const sent = installAmyGlobals();
    const engine = new AmyWasmEngine();
    engine.noteOn(60, 1);
    engine.noteOff(60);
    expect(sent).toEqual(['i1n60l1Z', 'i1n60l0Z']);
  });

  it('start requires ready state; stop is a no-op when not running', async () => {
    const engine = new AmyWasmEngine();
    await expect(engine.start()).rejects.toThrow(/cannot start audio/);
    await engine.stop();
    expect(engine.state).toBe('idle');
  });

  it('now() reflects amy_sysclock when available', () => {
    const engine = new AmyWasmEngine();
    expect(engine.now()).toBeNull();
    installAmyGlobals();
    expect(engine.now()).toBe(1234);
  });
});
