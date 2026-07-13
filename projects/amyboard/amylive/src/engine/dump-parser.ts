// ─── AMY zDZ State Dump Parser ───────────────────────────────────────
// Parses raw Uint8Array dump (from amyConnection.dumpState()) into an
// AmyPatch object. The dump contains wire-format lines like:
//   v0w0f440a0.8Q0.5y0Z
//   v0G1F8000R0.7Z
//   v0A100,1,300,0.5,600,0T0Z
//   i0K42Z
//
// Each line is terminated by 'Z'. Lines starting with v{osc} describe
// oscillator parameters; lines starting with i{synth} describe synths.

import type { AmyPatch, AmyOscState, AmySynthState, WaveType, FilterType } from '@/types/amy';

// ─── Default Oscillator State ─────────────────────────────────────────
function defaultOscState(osc: number): AmyOscState {
  return {
    osc,
    wave: 0 as WaveType,
    freq: { const: 440 },
    amp: { const: 0.8 },
    pan: { const: 0.5 },
    filter_freq: { const: 8000 },
    duty: { const: 0.5 },
    filter_type: 0 as FilterType,
    resonance: 0.7,
    bp0: '',
    bp1: '',
    eg0_type: 0,
    eg1_type: 0,
    mod_source: -1,
    feedback: 0,
    bus: 0,
    chained_osc: 0,
    phase: 0,
  };
}

// ─── Wire Code → Param Name Lookup (subset for dump parsing) ──────────
const DUMP_WIRE_CODES: Record<string, string> = {
  v: 'osc',
  w: 'wave',
  f: 'freq',
  a: 'amp',
  d: 'duty',
  Q: 'pan',
  F: 'filter_freq',
  G: 'filter_type',
  R: 'resonance',
  A: 'bp0',
  B: 'bp1',
  T: 'eg0_type',
  X: 'eg1_type',
  L: 'mod_source',
  b: 'feedback',
  i: 'synth',
  K: 'patch',
  n: 'note',
  l: 'vel',
  m: 'portamento',
  y: 'bus',
  c: 'chained_osc',
  P: 'phase',
  S: 'reset',
  iv: 'num_voices',
  in: 'oscs_per_voice',
  h: 'reverb',
  j: 'chorus',
  k: 'echo',
  V: 'volume',
};

// Two-character codes
const TWO_CHAR_SET = new Set(['iv', 'in']);

// ─── Parse a single dump line into key-value pairs ────────────────────
function parseDumpLine(line: string): Record<string, string> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const result: Record<string, string> = {};
  let pos = 0;

  while (pos < trimmed.length) {
    // Check two-char codes first
    const two = pos + 1 < trimmed.length ? trimmed.slice(pos, pos + 2) : null;
    let code: string;
    let paramName: string | undefined;

    if (two && TWO_CHAR_SET.has(two) && DUMP_WIRE_CODES[two]) {
      code = two;
      paramName = DUMP_WIRE_CODES[two];
    } else if (DUMP_WIRE_CODES[trimmed[pos]]) {
      code = trimmed[pos];
      paramName = DUMP_WIRE_CODES[code];
    } else {
      // Unknown prefix – skip one char
      pos++;
      continue;
    }

    pos += code.length;

    // Extract value until next known code or end
    const valueStart = pos;
    while (pos < trimmed.length) {
      const c = trimmed[pos];
      // Stop at next known single-char wire code (but not 'e' which is part of numbers like "1e5")
      if (pos > valueStart && c !== '.' && c !== 'e' && c !== '-' && c !== '+' && c !== ',') {
        const nextTwo = pos + 1 < trimmed.length ? trimmed.slice(pos, pos + 2) : null;
        if (nextTwo && TWO_CHAR_SET.has(nextTwo) && DUMP_WIRE_CODES[nextTwo]) break;
        if (DUMP_WIRE_CODES[c]) break;
      }
      pos++;
    }

    const value = trimmed.slice(valueStart, pos);
    if (value) {
      result[paramName] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ─── Number / CtrlCoef Parser ─────────────────────────────────────────
function parseValue(raw: string): number | Record<string, number> {
  // If it contains commas, it's a CtrlCoef string
  if (raw.includes(',')) {
    const parts = raw.split(',');
    const coef: Record<string, number> = {};
    const keys = ['const', 'note', 'vel', 'eg0', 'eg1', 'mod', 'bend', 'ext0', 'ext1'];
    for (let i = 0; i < parts.length && i < keys.length; i++) {
      const v = parts[i].trim();
      if (v !== '') {
        const n = Number(v);
        if (!isNaN(n)) coef[keys[i]] = n;
      }
    }
    return coef;
  }
  // Simple number
  const n = Number(raw);
  return isNaN(n) ? { const: 0 } : n;
}

// ─── Main Parser ──────────────────────────────────────────────────────
export function parseDumpToPatch(
  rawDump: Uint8Array,
  patchNumber?: number,
): AmyPatch {
  const text = new TextDecoder().decode(rawDump);

  // Split by 'Z' terminator (the wire-line end marker)
  // Normalize: replace newlines with Z (the wire terminator), then split by Z
  const normalized = text.replace(/\n/g, 'Z');
  const rawLines = normalized
    .split('Z')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Group parsed params by OSC number
  const oscParams = new Map<number, Record<string, any>>();
  const synthLines: Record<string, any>[] = [];

  for (const line of rawLines) {
    const parsed = parseDumpLine(line);
    if (!parsed) continue;

    if (parsed.synth !== undefined) {
      synthLines.push(parsed);
      continue;
    }

    if (parsed.osc !== undefined) {
      const oscNum = parseInt(parsed.osc, 10);
      if (isNaN(oscNum)) continue;

      if (!oscParams.has(oscNum)) {
        oscParams.set(oscNum, { osc: oscNum });
      }
      const existing = oscParams.get(oscNum)!;

      // Merge all params
      for (const [key, rawVal] of Object.entries(parsed)) {
        if (key === 'osc') continue;

        // Parse numeric / CtrlCoef values
        if (
          ['freq', 'amp', 'pan', 'filter_freq', 'duty'].includes(key)
        ) {
          existing[key] = parseValue(rawVal);
        } else if (key === 'wave') {
          existing.wave = parseInt(rawVal, 10);
        } else if (key === 'filter_type') {
          existing.filter_type = parseInt(rawVal, 10);
        } else if (key === 'resonance') {
          existing.resonance = parseFloat(rawVal);
        } else if (key === 'eg0_type' || key === 'eg1_type') {
          existing[key] = parseInt(rawVal, 10);
        } else if (key === 'mod_source') {
          existing.mod_source = parseInt(rawVal, 10);
        } else if (key === 'feedback') {
          existing.feedback = parseFloat(rawVal);
        } else if (key === 'bus') {
          existing.bus = parseInt(rawVal, 10);
        } else if (key === 'chained_osc') {
          existing.chained_osc = parseInt(rawVal, 10);
        } else if (key === 'phase') {
          existing.phase = parseFloat(rawVal);
        } else if (key === 'bp0' || key === 'bp1') {
          // Keep breakpoint strings as-is
          existing[key] = rawVal;
        } else if (key === 'portamento') {
          existing.portamento = parseFloat(rawVal);
        } else if (key === 'num_voices') {
          existing.num_voices = parseInt(rawVal, 10);
        } else if (key === 'oscs_per_voice') {
          existing.oscs_per_voice = parseInt(rawVal, 10);
        } else if (key === 'synth') {
          existing.synth = parseInt(rawVal, 10);
        } else if (key === 'patch') {
          existing.patch = parseInt(rawVal, 10);
        } else {
          // Generic fallback
          const n = Number(rawVal);
          existing[key] = isNaN(n) ? rawVal : n;
        }
      }
    }
  }

  // Build AmyOscState[]
  const oscillators: AmyOscState[] = [];

  if (oscParams.size === 0) {
    // No oscillators found – create a default
    oscillators.push(defaultOscState(0));
  } else {
    for (const [, params] of oscParams) {
      const osc = defaultOscState(params.osc);
      if (params.wave !== undefined) osc.wave = params.wave as WaveType;
      if (params.freq !== undefined) {
        osc.freq = typeof params.freq === 'object' ? params.freq : { const: params.freq as number };
      }
      if (params.amp !== undefined) {
        osc.amp = typeof params.amp === 'object' ? params.amp : { const: params.amp as number };
      }
      if (params.pan !== undefined) {
        osc.pan = typeof params.pan === 'object' ? params.pan : { const: params.pan as number };
      }
      if (params.filter_freq !== undefined) {
        osc.filter_freq = typeof params.filter_freq === 'object'
          ? params.filter_freq
          : { const: params.filter_freq as number };
      }
      if (params.duty !== undefined) {
        osc.duty = typeof params.duty === 'object' ? params.duty : { const: params.duty as number };
      }
      if (params.filter_type !== undefined) osc.filter_type = params.filter_type as FilterType;
      if (params.resonance !== undefined) osc.resonance = params.resonance;
      if (params.bp0 !== undefined) osc.bp0 = String(params.bp0);
      if (params.bp1 !== undefined) osc.bp1 = String(params.bp1);
      if (params.eg0_type !== undefined) osc.eg0_type = params.eg0_type;
      if (params.eg1_type !== undefined) osc.eg1_type = params.eg1_type;
      if (params.mod_source !== undefined) osc.mod_source = params.mod_source;
      if (params.feedback !== undefined) osc.feedback = params.feedback;
      if (params.bus !== undefined) osc.bus = params.bus;
      if (params.chained_osc !== undefined) osc.chained_osc = params.chained_osc;
      if (params.phase !== undefined) osc.phase = params.phase;
      oscillators.push(osc);
    }
  }

  // Build AmySynthState[]
  const synths: AmySynthState[] = synthLines.length > 0
    ? synthLines.map((p, i) => ({
        synth: p.synth !== undefined ? parseInt(String(p.synth), 10) : i,
        patch: p.patch !== undefined ? parseInt(String(p.patch), 10) : (patchNumber ?? 0),
        num_voices: p.num_voices !== undefined ? parseInt(String(p.num_voices), 10) : 6,
        oscs_per_voice: p.oscs_per_voice !== undefined ? parseInt(String(p.oscs_per_voice), 10) : 1,
        midi_channel: 1,
        portamento: p.portamento !== undefined ? parseFloat(String(p.portamento)) : 0,
        synth_delay: 0,
      }))
    : [{
        synth: 0,
        patch: patchNumber ?? 0,
        num_voices: 6,
        oscs_per_voice: 1,
        midi_channel: 1,
        portamento: 0,
        synth_delay: 0,
      }];

  const patch: AmyPatch = {
    id: `dump-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: patchNumber !== undefined ? `Patch #${patchNumber}` : 'Board Dump',
    author: 'Board',
    category: 'user',
    tags: ['from-board'],
    state: {
      oscillators,
      synths,
      effects: [],
    },
    wireCommands: rawLines.map((l) => l + 'Z'),
    created: Date.now(),
    modified: Date.now(),
    boardSlot: patchNumber,
  };

  return patch;
}