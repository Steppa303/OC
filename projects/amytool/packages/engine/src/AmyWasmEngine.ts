import { encodeMessage } from '@amy/protocol';
import type { AudioEngine, EngineState } from './types';
import { amyGlobals, AMY_BLOCK_SIZE, AMY_NCHANS } from './amyGlobals';

export interface AmyWasmEngineOptions {
  /** URL prefix where amy.js/amy.wasm are served (see @amy/engine/vite plugin). */
  baseUrl?: string;
  /** ms to wait for the module to come up before failing init. */
  initTimeoutMs?: number;
}

const DEFAULT_BASE = '/amy/';

export class AmyWasmEngine implements AudioEngine {
  #state: EngineState = 'idle';
  #listeners = new Set<(state: EngineState, detail?: string) => void>();
  #baseUrl: string;
  #initTimeoutMs: number;
  #outPtr: number | null = null;

  constructor(options: AmyWasmEngineOptions = {}) {
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE;
    this.#initTimeoutMs = options.initTimeoutMs ?? 15000;
  }

  get state(): EngineState {
    return this.#state;
  }

  #setState(state: EngineState, detail?: string): void {
    this.#state = state;
    for (const cb of this.#listeners) cb(state, detail);
  }

  onStateChange(cb: (state: EngineState, detail?: string) => void): () => void {
    this.#listeners.add(cb);
    return () => this.#listeners.delete(cb);
  }

  async init(): Promise<void> {
    if (this.#state !== 'idle' && this.#state !== 'error') return;
    this.#setState('loading');
    try {
      if (!crossOriginIsolated) {
        // SharedArrayBuffer needs COOP/COEP (BUILD.md §Hosting requirements).
        throw new Error(
          'page is not cross-origin isolated — AMY audio worklet needs COOP/COEP headers',
        );
      }
      await this.#loadScript(this.#baseUrl + 'amy.js');
      await this.#waitFor(
        () => amyGlobals().amy_add_message !== null && amyGlobals().amy_module !== null,
        'AMY module initialization',
      );
      this.#setState('ready');
    } catch (err) {
      this.#setState('error', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async start(): Promise<void> {
    if (this.#state === 'running') return;
    if (this.#state !== 'ready') throw new Error(`cannot start audio in state '${this.#state}'`);
    const g = amyGlobals();
    if (!g.amy_live_start_web) throw new Error('amy_live_start_web missing');
    await g.amy_live_start_web();
    this.#setState('running');
  }

  async stop(): Promise<void> {
    if (this.#state !== 'running') return;
    const g = amyGlobals();
    if (g.amy_live_stop) await g.amy_live_stop();
    this.#setState('ready');
  }

  sendWire(message: string): void {
    const send = amyGlobals().amy_add_message;
    if (!send) throw new Error('engine not initialized');
    send(message.endsWith('Z') ? message : message + 'Z');
  }

  noteOn(note: number, vel = 1, synth = 1): void {
    this.sendWire(encodeMessage({ synth, note, vel }));
  }

  noteOff(note: number, synth = 1): void {
    this.sendWire(encodeMessage({ synth, note, vel: 0 }));
  }

  getLastOutputBlock(): Int16Array | null {
    const mod = amyGlobals().amy_module;
    if (!mod) return null;
    const samples = AMY_BLOCK_SIZE * AMY_NCHANS;
    this.#outPtr ??= mod._malloc(samples * 2);
    const written = mod._amy_get_output_buffer(this.#outPtr);
    if (written === 0) return null;
    const memory = mod.wasmMemory;
    if (!memory) return null;
    // Views into growable shared memory must be recreated per read.
    const heap = new Int16Array(memory.buffer, this.#outPtr, samples);
    return new Int16Array(heap);
  }

  now(): number | null {
    const clock = amyGlobals().amy_sysclock;
    return clock ? clock() : null;
  }

  #loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async #waitFor(cond: () => boolean, what: string): Promise<void> {
    const deadline = Date.now() + this.#initTimeoutMs;
    while (!cond()) {
      if (Date.now() > deadline) throw new Error(`timeout waiting for ${what}`);
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}
