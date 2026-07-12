// === Core AMY Types ===

export interface CtrlCoefs {
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

export interface EnvelopeState {
  breakpoints: [number, number][];
  type: EnvelopeType;
}

export type EnvelopeType = 'normal' | 'linear' | 'dx7' | 'exponential';

export interface LFOState {
  wave: number;
  freq: number;
  amplitude: number;
  target: 'freq' | 'amp' | 'filter_freq' | 'duty' | 'pan';
  targetOsc: number;
}

export interface OscillatorState {
  wave: number;
  freq: CtrlCoefs;
  amp: CtrlCoefs;
  duty: CtrlCoefs;
  pan: CtrlCoefs;
  phase: number;
  filterType: number;
  filterFreq: CtrlCoefs;
  resonance: number;
  modSource: number | null;
  eg0: EnvelopeState;
  eg1: EnvelopeState;
}

export interface SynthState {
  id: number;
  patchNumber: number;
  numVoices: number;
  oscsPerVoice: number;
  oscillators: OscillatorState[];
  lfos: LFOState[];
  portamento: number;
  synthDelay: number;
  synthFlags: number;
  volume: number;
}

export interface PresetEffects {
  reverb?: [number, number, number, number];
  chorus?: [number, number, number, number];
  echo?: [number, number, number, number];
  eq?: [number, number, number];
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  category: 'user' | 'juno' | 'dx7' | 'pcm';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  state: SynthState[];
  effects?: PresetEffects;
}

// === AMY Parameter (für amy_send) ===
export interface AMYParams {
  osc?: number;
  synth?: number;
  wave?: number;
  freq?: number;
  amp?: number;
  vel?: number;
  note?: number;
  patch?: number;
  num_voices?: number;
  duty?: number;
  pan?: number;
  phase?: number;
  portamento?: number;
  synth_delay?: number;
  bp0?: string;
  bp1?: string;
  lfo_wave?: number;
  lfo_freq?: number;
  lfo_amp?: number;
  mod_target?: number;
  mod_target_osc?: number;
  ext0?: number;
  ext1?: number;
  filter_type?: number;
  filter_freq?: number;
  resonance?: number;
  reverb?: string;
  chorus?: string;
  echo?: string;
  eq?: string;
  volume?: number;
  sequence?: string;
  [key: string]: unknown;
}

// === UI State ===
export type NavTab = 'synth' | 'keyboard' | 'sequencer' | 'cv' | 'monitor';
export type ParamCategory = 'osc' | 'filter' | 'env' | 'lfo' | 'effects';