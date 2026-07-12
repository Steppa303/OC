// ─── Wave Type ────────────────────────────────────────────────────────
export type WaveType =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21;

export const WAVE = {
  SINE: 0,
  PULSE: 1,
  SAW_DOWN: 2,
  SAW_UP: 3,
  TRIANGLE: 4,
  NOISE: 5,
  KS: 6,
  PCM: 7,
  ALGO: 8,
  PARTIAL: 9,
  BYO_PARTIALS: 10,
  INTERP_PARTIALS: 11,
  AUDIO_IN0: 12,
  AUDIO_IN1: 13,
  AUDIO_EXT0: 14,
  AUDIO_EXT1: 15,
  AMY_MIDI: 16,
  PCM_LEFT: 17,
  PCM_RIGHT: 18,
  WAVETABLE: 19,
  CUSTOM: 20,
  OFF: 21,
} as const;

// ─── Filter Type ──────────────────────────────────────────────────────
export type FilterType = 0 | 1 | 2 | 3 | 4;

export const FILTER = {
  NONE: 0,
  LPF: 1,
  BPF: 2,
  HPF: 3,
  ORDER2_LPF: 4,
} as const;

// ─── Envelope Generator Type ──────────────────────────────────────────
export type EgType = 0 | 1 | 2 | 3;

export const EG = {
  NORMAL: 0,
  LINEAR: 1,
  DX7: 2,
  EXPONENTIAL: 3,
} as const;

// ─── CtrlCoef Value Specification ─────────────────────────────────────
// All fields are optional numbers; omit to keep slot empty.
export interface CtrlCoefValues {
  const?: number;
  note?: number;
  vel?: number;
  eg0?: number;
  eg1?: number;
  mod?: number;
  bend?: number;
  ext0?: number;
  ext1?: number;
}

// ─── AMY Parameter Payload ────────────────────────────────────────────
// Mirrors the wire-protocol parameter space. Numbers, strings, CtrlCoef
// objects and arrays are all valid depending on the key.
export interface AmyParams {
  osc?: number;
  wave?: WaveType;
  freq?: number | string | CtrlCoefValues;
  amp?: number | string | CtrlCoefValues;
  duty?: number | string | CtrlCoefValues;
  pan?: number | string | CtrlCoefValues;
  filter_freq?: number | string | CtrlCoefValues;
  filter_type?: number;
  resonance?: number;
  bp0?: string;
  bp1?: string;
  eg0_type?: number;
  eg1_type?: number;
  mod_source?: number;
  feedback?: number;
  synth?: number;
  patch?: number;
  patch_string?: string;
  num_voices?: number;
  oscs_per_voice?: number;
  voices?: number[];
  time?: number;
  sequence?: string;
  note?: number;
  vel?: number;
  portamento?: number;
  reset?: number;
  bus?: number;
  chained_osc?: number;
  phase?: number;
  algo_source?: string;
  reverb?: number | string;
  chorus?: number | string;
  echo?: number | string;
  eq?: number | string;
  load_sample?: number[];
  disk_sample?: [number, string, number];
}

// ─── Oscillator State (decoded from dump) ─────────────────────────────
export interface AmyOscState {
  osc: number;
  wave: WaveType;
  freq: CtrlCoefValues;
  amp: CtrlCoefValues;
  pan: CtrlCoefValues;
  filter_freq: CtrlCoefValues;
  duty: CtrlCoefValues;
  filter_type: FilterType;
  resonance: number;
  bp0: string;
  bp1: string;
  eg0_type: EgType;
  eg1_type: EgType;
  mod_source: number;
  feedback: number;
  bus: number;
  chained_osc: number;
  phase: number;
}

// ─── Synth State (decoded from dump) ──────────────────────────────────
export interface AmySynthState {
  synth: number;
  patch: number;
  num_voices: number;
  oscs_per_voice: number;
  midi_channel: number;
  portamento: number;
  synth_delay: number;
}

// ─── Effects State (decoded from dump) ────────────────────────────────
export interface AmyFxState {
  bus: number;
  reverb: { level: number; liveness: number; damping: number; xover_hz: number };
  chorus: { level: number; rate: number; depth: number };
  echo: { level: number; delay: number; feedback: number };
  volume: number;
}

// ─── Patch (preset bundle) ────────────────────────────────────────────
export interface AmyPatch {
  id: string;
  name: string;
  author: string;
  category: 'juno' | 'dx7' | 'fm' | 'pcm' | 'user';
  tags: string[];
  state: {
    oscillators: AmyOscState[];
    synths: AmySynthState[];
    effects: AmyFxState[];
  };
  wireCommands: string[];
  created: number;
  modified: number;
  boardSlot?: number;
}

// ─── Module Props (used by canvas panels) ─────────────────────────────
export interface ModuleProps {
  id: string;
  params: Record<string, any>;
  onParamChange: (key: string, value: any) => void;
  onSendWire: (wire: string) => void;
}

// ─── Module Descriptor ────────────────────────────────────────────────
export interface AmyModule {
  id: string;
  name: string;
  icon: string;
  category:
    | 'source'
    | 'filter'
    | 'envelope'
    | 'modulation'
    | 'fx'
    | 'mixer'
    | 'sequencer';
  minWidth: number;
  minHeight: number;
  defaults: Record<string, any>;
}

// ─── Canvas Module Instance ───────────────────────────────────────────
export interface CanvasModule {
  id: string;
  moduleType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  params: Record<string, any>;
  targetOsc?: number;
  targetSynth?: number;
  targetBus?: number;
}

// ─── Connection State ─────────────────────────────────────────────────
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';