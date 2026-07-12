// TypeScript AMY-Konstanten (aus amy.h)
export const AMY = {
  // Wellenformen
  SINE: 0,
  PULSE: 1,
  SAW_DOWN: 2,
  SAW_UP: 3,
  TRIANGLE: 4,
  NOISE: 5,
  MORPH: 6,
  WAVETABLE: 7,
  QUAD: 8,
  PULSE_SYNC: 9,
  SAW_PWM: 10,
  MORPH_PWM: 11,

  // Filter-Typen
  FILTER_NONE: -1,
  LPF: 0,
  BPF: 1,
  HPF: 2,
  NOTCH: 3,
  LPF12: 4,
  HPF12: 5,
  BPF12: 6,
  LPF24: 7,
  HPF24: 8,
  BPF24: 9,

  // Envelope-Typen
  EG_NORMAL: 0,
  EG_LINEAR: 1,
  EG_DX7: 2,
  EG_EXPONENTIAL: 3,

  // LFO-Wellenformen
  LFO_SINE: 0,
  LFO_TRIANGLE: 1,
  LFO_SAW_DOWN: 2,
  LFO_SAW_UP: 3,
  LFO_PULSE: 4,
  LFO_SAMPLE_AND_HOLD: 5,
  LFO_NOISE: 6,

  // Modulation Targets
  MOD_FREQ: 0,
  MOD_AMP: 1,
  MOD_FILTER_FREQ: 2,
  MOD_DUTY: 3,
  MOD_PAN: 4,

  // Synth-Flags
  FLAG_MONO: 1,
  FLAG_POLY: 2,
  FLAG_ARP: 4,
  FLAG_GLIDE: 8,
  FLAG_LEGATO: 16,

  // Max
  MAX_OSCS: 180,
  MAX_NOTES: 128,
};

export const WAVE_NAMES: Record<number, string> = {
  [AMY.SINE]: 'Sine',
  [AMY.PULSE]: 'Pulse',
  [AMY.SAW_DOWN]: 'Saw ↓',
  [AMY.SAW_UP]: 'Saw ↑',
  [AMY.TRIANGLE]: 'Tri',
  [AMY.NOISE]: 'Noise',
  [AMY.MORPH]: 'Morph',
  [AMY.WAVETABLE]: 'WT',
  [AMY.QUAD]: 'Quad',
  [AMY.PULSE_SYNC]: 'Sync',
  [AMY.SAW_PWM]: 'PWM',
  [AMY.MORPH_PWM]: 'MorphPWM',
};

export const FILTER_NAMES: Record<number, string> = {
  [AMY.FILTER_NONE]: 'Off',
  [AMY.LPF]: 'LPF 24',
  [AMY.BPF]: 'BPF 24',
  [AMY.HPF]: 'HPF 24',
  [AMY.LPF12]: 'LPF 12',
  [AMY.HPF12]: 'HPF 12',
  [AMY.BPF12]: 'BPF 12',
  [AMY.LPF24]: 'LPF 24',
  [AMY.HPF24]: 'HPF 24',
  [AMY.BPF24]: 'BPF 24',
  [AMY.NOTCH]: 'Notch',
};

export const WAVE_LIST = [AMY.SINE, AMY.PULSE, AMY.SAW_DOWN, AMY.SAW_UP, AMY.TRIANGLE, AMY.NOISE, AMY.MORPH, AMY.PULSE_SYNC, AMY.SAW_PWM];
export const FILTER_LIST = [AMY.FILTER_NONE, AMY.LPF, AMY.BPF, AMY.HPF, AMY.LPF12, AMY.HPF12, AMY.LPF24, AMY.HPF24];