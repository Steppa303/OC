// Transcribed from https://github.com/shorepine/amy/blob/main/docs/api.md
// and docs/synth.md §Control Coefficients. Do not invent values; extend only
// with a source link (CLAUDE.md rule 5).

/** Waveform ids, index = AMY wave number (api.md, wire code `w`, 0-21). */
export const WAVES = [
  'SINE',
  'PULSE',
  'SAW_DOWN',
  'SAW_UP',
  'TRIANGLE',
  'NOISE',
  'KS',
  'PCM',
  'ALGO',
  'PARTIAL',
  'BYO_PARTIALS',
  'INTERP_PARTIALS',
  'AUDIO_IN0',
  'AUDIO_IN1',
  'AUDIO_EXT0',
  'AUDIO_EXT1',
  'AMY_MIDI',
  'PCM_LEFT',
  'PCM_RIGHT',
  'WAVETABLE',
  'CUSTOM',
  'OFF',
] as const;
export type WaveName = (typeof WAVES)[number];

/** Filter types (api.md, wire code `G`, 0-4). */
export const FILTER_TYPES = ['none', 'lowpass', 'bandpass', 'highpass', 'lowpass24'] as const;
export type FilterTypeName = (typeof FILTER_TYPES)[number];

/** Envelope generator response types (api.md, wire codes `T`/`X`, 0-3). */
export const EG_TYPES = ['normal', 'linear', 'dx7', 'exponential'] as const;

/**
 * ControlCoefficients slot order (synth.md §Control Coefficients).
 * Applies to amp, freq, filter_freq, duty, pan.
 */
export const COEF_ORDER = [
  'const',
  'note',
  'vel',
  'eg0',
  'eg1',
  'mod',
  'bend',
  'ext0',
  'ext1',
] as const;
export type CoefName = (typeof COEF_ORDER)[number];

/** Built-in patch number ranges (api.md, wire code `K`). */
export const PATCH_RANGES = {
  juno: { start: 0, end: 127, label: 'Juno-6' },
  dx7: { start: 128, end: 255, label: 'DX7' },
  piano: { start: 256, end: 256, label: 'Piano' },
  legacyDrums: { start: 258, end: 258, label: 'Legacy GM drums' },
  drumKits: { start: 384, end: 390, label: 'GM drum kits' },
  user: { start: 1024, end: 1055, label: 'User patches (RAM)' },
} as const;

/** Gamma9001 GM drum kits, patch → kit (api.md §Drum kits). */
export const DRUM_KITS: Record<number, string> = {
  384: 'TR-808',
  385: 'TR-909',
  386: 'Linn 9000',
  387: 'Univox Micro Rythmer 12',
  388: 'Tokyo Synthetics',
  389: '80s Power Kit',
  390: 'Percussion',
};

/** Reset sentinels (constants.py) — values for the `S`/`reset` wire code. */
export const RESET = {
  SEQUENCER: 4096,
  ALL_OSCS: 8192,
  TIMEBASE: 16384,
  AMY: 32768,
  EVENTS: 65536,
  ALL_NOTES: 131072,
  SYNTHS: 262144,
  PATCH: 524288,
  QUEUE: 1048576,
} as const;

/** Filter type numbers (constants.py; wire code `G`/filter_type). */
export const FILTER_TYPE_NUM: Record<string, number> = {
  none: 0,
  lowpass: 1,
  bandpass: 2,
  highpass: 3,
  lowpass24: 4,
};

/** Friendly waveform name → AMY wave number (constants.py). `square` is a pulse
 *  at 50% duty. */
export const WAVE_NUM: Record<string, number> = {
  sine: 0,
  pulse: 1,
  square: 1,
  saw: 2,
  saw_down: 2,
  saw_up: 3,
  triangle: 4,
  noise: 5,
  pcm: 7,
  algo: 8,
};

/** Default sequencer tempo in BPM (api.md, wire code `j`). */
export const DEFAULT_TEMPO = 108.0;

export const MAX_SYNTH = 31;
export const MIDI_NOTE_MAX = 127;
