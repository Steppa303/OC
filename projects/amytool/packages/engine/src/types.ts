/** Engine abstraction (docs/01). The app talks to this interface only; the
 *  AMY-WASM implementation and any future backends hide behind it. */

export type EngineState = 'idle' | 'loading' | 'ready' | 'running' | 'error';

export interface AudioEngine {
  readonly state: EngineState;
  /** Load code/wasm. Safe to call early; no sound yet. */
  init(): Promise<void>;
  /** Start live audio. MUST be called from a user gesture (browser policy). */
  start(): Promise<void>;
  /** Stop live audio (engine stays ready). */
  stop(): Promise<void>;
  /** Send a raw AMY wire message (e.g. from @amy/protocol encodeMessage). */
  sendWire(message: string): void;
  /** Convenience note events (synth 1 = default Juno per amy_start_web). */
  noteOn(note: number, vel?: number, synth?: number): void;
  noteOff(note: number, synth?: number): void;
  /** Copy of the most recently rendered output block (interleaved stereo int16),
   *  or null before audio ran. Powers scopes, meters and smoke tests. */
  getLastOutputBlock(): Int16Array | null;
  /** AMY clock in ms (samples-based), or null before ready. */
  now(): number | null;
  onStateChange(cb: (state: EngineState, detail?: string) => void): () => void;
}
