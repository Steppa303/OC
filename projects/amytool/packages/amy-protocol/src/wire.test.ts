import { PARAMS, PARAM_BY_NAME } from './params';
import { WAVES, FILTER_TYPES, COEF_ORDER, DRUM_KITS, PATCH_RANGES } from './constants';
import { decodeMessage, encodeMessage, splitWireDump, WireError } from './wire';

describe('param table', () => {
  it('is complete and unique', () => {
    const names = new Set<string>();
    const wires = new Set<string>();
    for (const p of PARAMS) {
      expect(p.name).toMatch(/^[a-z_0-9]+$/);
      expect(p.wire.length).toBeGreaterThanOrEqual(1);
      expect(p.wire.length).toBeLessThanOrEqual(2);
      expect(p.doc.length).toBeGreaterThan(10);
      expect(names.has(p.name), `duplicate name ${p.name}`).toBe(false);
      expect(wires.has(p.wire), `duplicate wire ${p.wire}`).toBe(false);
      names.add(p.name);
      wires.add(p.wire);
    }
    // Spot checks straight from api.md
    expect(PARAM_BY_NAME.get('vel')?.wire).toBe('l');
    expect(PARAM_BY_NAME.get('note')?.wire).toBe('n');
    expect(PARAM_BY_NAME.get('patch')?.wire).toBe('K');
    expect(PARAM_BY_NAME.get('bp0')?.wire).toBe('A');
    expect(PARAM_BY_NAME.get('filter_freq')?.wire).toBe('F');
    expect(PARAM_BY_NAME.get('sequencer_run')?.wire).toBe('zY');
  });

  it('constants match api.md', () => {
    expect(WAVES).toHaveLength(22);
    expect(WAVES[0]).toBe('SINE');
    expect(WAVES[8]).toBe('ALGO');
    expect(WAVES[21]).toBe('OFF');
    expect(FILTER_TYPES).toHaveLength(5);
    expect(COEF_ORDER).toEqual([
      'const',
      'note',
      'vel',
      'eg0',
      'eg1',
      'mod',
      'bend',
      'ext0',
      'ext1',
    ]);
    expect(DRUM_KITS[385]).toBe('TR-909');
    expect(PATCH_RANGES.dx7.start).toBe(128);
  });
});

describe('decodeMessage', () => {
  it('decodes the canonical README example', () => {
    expect(decodeMessage('v0n50l1K130r0Z')).toEqual({
      osc: 0,
      note: 50,
      vel: 1,
      patch: 130,
      voices: [0],
    });
  });

  it('decodes the api.md JS example', () => {
    expect(decodeMessage('v0w0f440Z')).toEqual({ osc: 0, wave: 0, freq: [440] });
  });

  it('decodes coef lists with empty slots', () => {
    expect(decodeMessage('v0F50,,,,1Z')).toEqual({ osc: 0, filter_freq: [50, null, null, null, 1] });
  });

  it('decodes two-letter codes and rest-of-message strings', () => {
    expect(decodeMessage('zY1Z')).toEqual({ sequencer_run: 1 });
    expect(decodeMessage('zPimport amyboard; amyboard.restart_sketch()Z')).toEqual({
      exec: 'import amyboard; amyboard.restart_sketch()',
    });
    // interior Z in string params is preserved (api.md zD note)
    expect(decodeMessage('zD/user/ZFILE.pyZ')).toEqual({ dump_sysex: '/user/ZFILE.py' });
  });

  it('rejects unknown codes', () => {
    expect(() => decodeMessage('v0q99Z')).toThrow(WireError);
  });
});

describe('encodeMessage', () => {
  it('encodes canonical golden strings', () => {
    expect(encodeMessage({ osc: 0, wave: 0, freq: 440 })).toBe('v0w0f440Z');
    // synth=1 (`i1`) + num_voices=6 (`iv6`) + patch=0 (`K0`)
    expect(encodeMessage({ patch: 0, synth: 1, num_voices: 6 })).toBe('i1iv6K0Z');
    expect(encodeMessage({ synth: 1, vel: 1, note: 60 })).toBe('i1n60l1Z');
    expect(encodeMessage({ osc: 0, filter_freq: { const: 50, eg1: 1 } })).toBe('v0F50,,,,1Z');
    expect(encodeMessage({ sequencer_run: 1 })).toBe('zY1Z');
  });

  it('round-trips every numeric/list param with random values', () => {
    for (const def of PARAMS) {
      if (def.kind === 'string') continue;
      for (let trial = 0; trial < 20; trial++) {
        const value = randomValue(def.kind, def.min, def.max);
        const event = def.section === 'osc' || def.section === 'coefs' ? { osc: 1, [def.name]: value } : { [def.name]: value };
        const decoded = decodeMessage(encodeMessage(event));
        const expected = normalize(def.kind, value);
        expect(decoded[def.name], `${def.name} trial ${trial}`).toEqual(expected);
      }
    }
  });

  it('rejects unknown params, empty events and trailing-Z strings', () => {
    expect(() => encodeMessage({ nope: 1 })).toThrow(WireError);
    expect(() => encodeMessage({})).toThrow(WireError);
    expect(() => encodeMessage({ exec: 'print("Z")Z' })).toThrow(WireError);
  });
});

describe('splitWireDump', () => {
  it('splits and trims dump lines', () => {
    expect(splitWireDump('v0w0Z\n\n  v1w2Z \r\n')).toEqual(['v0w0Z', 'v1w2Z']);
  });
});

function randomValue(kind: string, min?: number, max?: number): number | (number | null)[] {
  const lo = min ?? 0;
  const hi = max ?? 100;
  const randFloat = () => Math.round((lo + Math.random() * (hi - lo)) * 1e4) / 1e4;
  const randInt = () => Math.floor(lo + Math.random() * (hi - lo + 1));
  switch (kind) {
    case 'uint':
    case 'int':
      return randInt();
    case 'float':
      return randFloat();
    case 'intlist':
      return Array.from({ length: 1 + Math.floor(Math.random() * 4) }, randInt);
    case 'floatlist':
    case 'bplist':
    case 'coefs':
      return Array.from({ length: 1 + Math.floor(Math.random() * 5) }, () =>
        Math.random() < 0.2 ? null : randFloat(),
      );
    default:
      throw new Error(`unexpected kind ${kind}`);
  }
}

/** Encoder normalizes scalars to single-element lists for list kinds; mirror that. */
function normalize(kind: string, value: number | (number | null)[]): unknown {
  if (kind === 'uint' || kind === 'int' || kind === 'float') return value;
  const list = typeof value === 'number' ? [value] : [...value];
  // trailing nulls are preserved in wire text as trailing commas → decoded as nulls,
  // except a single trailing null which the join drops the comma for.
  return list;
}
