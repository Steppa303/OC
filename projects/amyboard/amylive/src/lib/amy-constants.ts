// ─── AMY Hardware Constants ──────────────────────────────────────────
// Based on AMY firmware specification (ESP32-S3 / Daisy Seed target).

export const AMY = {
  /** SysEx manufacturer ID – identifies an AMY board on the MIDI bus. */
  MANUFACTURER_ID: [0x00, 0x03, 0x45] as readonly number[],

  /** Acknowledgement reply bytes (ASCII "AK"). */
  ACK: [0x41, 0x4b] as readonly number[],

  /** Pong reply from ping (ASCII "OK"). */
  PONG: [0x4f, 0x4b] as readonly number[],

  /** SysEx tag byte for error messages. */
  ERROR_TAG: 0x58,

  /** SysEx tag byte for firmware version response. */
  VERSION_TAG: 0x56,

  /** Dump frame type: single-block. */
  DUMP_SINGLE: 0x30,

  /** Dump frame type: chunked block. */
  DUMP_CHUNK: 0x43,

  /** Dump frame type: end-of-dump marker. */
  DUMP_END: 0x45,

  /** Maximum payload size (bytes) per SysEx chunk. */
  CHUNK_SIZE: 188,

  /** Default ACK timeout in milliseconds. */
  ACK_TIMEOUT_MS: 5000,

  /** SysEx start-of-exclusive byte. */
  SYSEX_START: 0xf0,

  /** SysEx end-of-exclusive byte. */
  SYSEX_END: 0xf7,
} as const;

// ─── Wire-Code Lookup ─────────────────────────────────────────────────
// Single-character (or two-character) codes that map parameter keys to
// their wire-format prefix.
export const WIRE_CODES: Record<string, string> = {
  osc: 'v',
  wave: 'w',
  freq: 'f',
  amp: 'a',
  duty: 'd',
  pan: 'Q',
  filter_freq: 'F',
  filter_type: 'G',
  resonance: 'R',
  bp0: 'A',
  bp1: 'B',
  eg0_type: 'T',
  eg1_type: 'X',
  mod_source: 'L',
  feedback: 'b',
  synth: 'i',
  patch: 'K',
  patch_string: 'u',
  num_voices: 'iv',
  oscs_per_voice: 'in',
  voices: 'r',
  time: 't',
  sequence: 'q',
  note: 'n',
  vel: 'l',
  portamento: 'm',
  reset: 'S',
  bus: 'y',
  chained_osc: 'c',
  phase: 'P',
  algo_source: 'O',
  reverb: 'h',
  chorus: 'j',
  echo: 'k',
  volume: 'V',
} as const;

// ─── Reverse Wire-Code Lookup ─────────────────────────────────────────
// Built once at import time so parseWireLine can resolve a wire prefix
// back to its canonical parameter name.
export const REVERSE_WIRE_CODES: Record<string, string> = {};
for (const [key, code] of Object.entries(WIRE_CODES)) {
  REVERSE_WIRE_CODES[code] = key;
}

// ─── CtrlCoef Slot Names (in fixed wire order) ────────────────────────
export const CTRL_COEF_ORDER = [
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

// ─── Parameters that accept CtrlCoef objects ──────────────────────────
export const CTRL_COEF_PARAMS = new Set<string>([
  'freq',
  'amp',
  'duty',
  'pan',
  'filter_freq',
]);

// ─── Parameters whose wire format is a simple numeric value ───────────
// (not a CtrlCoef, not an envelope string).
export const SINGLE_CHAR_NUMERIC_PARAMS = new Set<string>([
  'wave',
  'filter_type',
  'resonance',
  'eg0_type',
  'eg1_type',
  'mod_source',
  'feedback',
  'bus',
  'chained_osc',
  'phase',
]);

// ─── Envelope parameters (BP0 / BP1 are full envelope strings) ───────
export const ENVELOPE_PARAMS = new Set<string>(['bp0', 'bp1']);

// ─── Special parameters that use two-char wire codes ──────────────────
export const TWO_CHAR_PARAMS = new Set<string>(['num_voices', 'oscs_per_voice']);

// ─── Patch categories ─────────────────────────────────────────────────
export const PATCH_CATEGORIES = ['juno', 'dx7', 'fm', 'pcm', 'user'] as const;

// ─── Module categories ────────────────────────────────────────────────
export const MODULE_CATEGORIES = [
  'source',
  'filter',
  'envelope',
  'modulation',
  'fx',
  'mixer',
  'sequencer',
] as const;

// ─── Reboot / sequencer / reset command bytes ─────────────────────────
export const CMD = {
  /** zB0 – warm reboot. */
  REBOOT_WARM: 0x30,
  /** zB1 – cold reboot. */
  REBOOT_COLD: 0x31,
  /** zB2 – factory reset. */
  REBOOT_FACTORY: 0x32,
  /** zY1 – start sequencer. */
  SEQ_START: 0x31,
  /** zY0 – stop sequencer. */
  SEQ_STOP: 0x30,
} as const;