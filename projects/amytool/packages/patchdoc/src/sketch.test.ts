import { describe, expect, it } from 'vitest';
import { patchDocSchema, type Cable, type PatchDoc } from './schema';
import { compileToSketch, parseSketch, readEmbeddedPatchDoc, SketchError, CUSTOM_CODE_TYPE } from './sketch';
import type { ModuleInfoProvider, RoutingModuleInfo } from './allocate';

// Routing metadata mirroring the core manifests (same set the wire compiler targets).
const INFO: Record<string, RoutingModuleInfo> = {
  'core.vco': {
    role: 'vco',
    jacks: [
      { id: 'pitch', kind: 'cv', dir: 'in', target: 'freq' },
      { id: 'fm', kind: 'cv', dir: 'in', target: 'freq' },
      { id: 'out', kind: 'audio', dir: 'out' },
    ],
  },
  'core.lfo': { role: 'lfo', jacks: [{ id: 'out', kind: 'cv', dir: 'out' }] },
  'core.vcf': {
    role: 'vcf',
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in' },
      { id: 'out', kind: 'audio', dir: 'out' },
    ],
  },
  'core.vca': {
    role: 'vca',
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in' },
      { id: 'cv', kind: 'cv', dir: 'in', target: 'amp' },
      { id: 'out', kind: 'audio', dir: 'out' },
    ],
  },
  'core.env': {
    role: 'env',
    jacks: [
      { id: 'gate', kind: 'gate', dir: 'in' },
      { id: 'out', kind: 'cv', dir: 'out' },
    ],
  },
  'core.out': { role: 'io', jacks: [{ id: 'in', kind: 'audio', dir: 'in' }] },
  'core.junovoice': {
    role: 'voice',
    jacks: [
      { id: 'notes', kind: 'midi', dir: 'in' },
      { id: 'out', kind: 'audio', dir: 'out' },
    ],
  },
  'core.fx.reverb': {
    role: 'fx',
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in' },
      { id: 'out', kind: 'audio', dir: 'out' },
    ],
  },
};
const provider: ModuleInfoProvider = (type) => INFO[type];

function mod(id: string, type: string, params: Record<string, string | number | boolean> = {}) {
  return { id, type, label: id, pos: { x: 0, y: 0 }, params, advanced: false, state: {} };
}
function cable(id: string, from: string, to: string, kind: Cable['kind']): Cable {
  const [fm, fj] = from.split('.') as [string, string];
  const [tm, tj] = to.split('.') as [string, string];
  return { id, from: { module: fm, jack: fj }, to: { module: tm, jack: tj }, kind };
}

/** Deterministic doc: fixed meta so the embedded base64 (and fixtures) are stable. */
function fixtureDoc(
  name: string,
  modules: ReturnType<typeof mod>[],
  cables: Cable[] = [],
  extra: Partial<PatchDoc> = {},
): PatchDoc {
  return patchDocSchema.parse({
    version: 1,
    meta: {
      id: '00000000-0000-4000-8000-000000000000',
      name,
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      modifiedAt: '2026-01-01T00:00:00.000Z',
      origin: 'manual',
    },
    modules,
    cables,
    ...extra,
  });
}

const subtractive = () =>
  fixtureDoc(
    'Subtractive Lead',
    [
      mod('vco1', 'core.vco', { wave: 'saw', coarse: 0, fine: 0 }),
      mod('vcf1', 'core.vcf', { type: 'lowpass', cutoff: 800, resonance: 0.7 }),
      mod('vca1', 'core.vca', { gain: 1 }),
      mod('out1', 'core.out'),
      mod('env1', 'core.env', { attack: 5, decay: 100, sustain: 0.7, release: 200 }),
    ],
    [
      cable('a', 'vco1.out', 'vcf1.in', 'audio'),
      cable('b', 'vcf1.out', 'vca1.in', 'audio'),
      cable('c', 'vca1.out', 'out1.in', 'audio'),
      cable('e', 'env1.out', 'vca1.cv', 'cv'),
    ],
  );

describe('compileToSketch', () => {
  it('emits import + amy.send setup mirroring the wire, then a snapshot block', () => {
    const { source } = compileToSketch(fixtureDoc('Bare Saw', [mod('vco1', 'core.vco', { wave: 'saw' })]), provider);
    expect(source).toContain('import amy\n');
    expect(source).toContain('amy.send(reset=8192)');
    expect(source).toContain("amy.send(osc=0, wave=2, freq='440,1')");
    expect(source).toMatch(/# amypatch:v1:[0-9a-f]+:[A-Za-z0-9+/=]+\n$/);
  });

  it('imports amyboard only when the patch uses CV I/O', () => {
    const plain = compileToSketch(fixtureDoc('Plain', [mod('vco1', 'core.vco')]), provider).source;
    expect(plain).toContain('import amy\n');
    expect(plain).not.toContain('amyboard');

    const withCv = compileToSketch(
      fixtureDoc('With CV', [mod('vco1', 'core.vco')], [], { io: { midiChannel: 1, cvIn: [{ channel: 0, mode: '1voct' }], cvOut: [] } }),
      provider,
    ).source;
    expect(withCv).toContain('import amy, amyboard\n');
  });

  it('appends preserved custom code verbatim above the snapshot', () => {
    const doc = fixtureDoc('Custom', [mod('vco1', 'core.vco')], [], {
      extras: { unmappedWire: [], userLoopCode: 'def loop():\n    pass' },
    });
    const { source } = compileToSketch(doc, provider);
    expect(source).toContain('# --- custom code (preserved verbatim) ---');
    expect(source).toContain('def loop():\n    pass');
  });

  it('is deterministic', () => {
    const doc = subtractive();
    expect(compileToSketch(doc, provider).source).toEqual(compileToSketch(doc, provider).source);
  });

  it('matches the golden subtractive sketch fixture', async () => {
    const { source } = compileToSketch(subtractive(), provider);
    await expect(source).toMatchFileSnapshot('./__fixtures__/subtractive.sketch.py');
  });

  it('matches the golden preset-voice + FX sketch fixture', async () => {
    const doc = fixtureDoc('Juno + Reverb', [
      mod('junovoice1', 'core.junovoice', { patch: 10, voices: 4 }),
      mod('reverb1', 'core.fx.reverb', { level: 0.4, liveness: 0.85, damping: 0.5 }),
    ]);
    await expect(compileToSketch(doc, provider).source).toMatchFileSnapshot('./__fixtures__/juno-reverb.sketch.py');
  });
});

describe('readEmbeddedPatchDoc — Level A round-trip (docs/03 §5.1)', () => {
  it('reads the embedded doc back unchanged with a valid hash', () => {
    const doc = subtractive();
    const { source } = compileToSketch(doc, provider);
    const read = readEmbeddedPatchDoc(source);
    expect(read).not.toBeNull();
    expect(read!.hashValid).toBe(true);
    expect(read!.doc).toEqual(doc);
  });

  it('round-trips a patch carrying custom code and CV I/O', () => {
    const doc = fixtureDoc(
      'Full',
      [mod('vco1', 'core.vco', { wave: 'square', duty: 0.5, coarse: 12 })],
      [],
      {
        io: { midiChannel: 3, cvIn: [{ channel: 1, mode: 'linear' }], cvOut: [{ channel: 0, source: 'synthAudio' }] },
        extras: { unmappedWire: [], userLoopCode: 'v = amyboard.cv_in(channel=1)' },
      },
    );
    const read = readEmbeddedPatchDoc(compileToSketch(doc, provider).source);
    expect(read!.doc).toEqual(doc);
    expect(read!.hashValid).toBe(true);
  });

  it('reports hashValid=false when the code above the snapshot was edited', () => {
    const doc = subtractive();
    const { source } = compileToSketch(doc, provider);
    const tampered = source.replace('amy.send(reset=8192)', 'amy.send(reset=8192)\namy.send(osc=5, wave=0)');
    const read = readEmbeddedPatchDoc(tampered);
    expect(read!.hashValid).toBe(false);
    // doc is still recoverable — the snapshot itself was untouched
    expect(read!.doc).toEqual(doc);
  });

  it('returns null for foreign code with no snapshot block', () => {
    expect(readEmbeddedPatchDoc('import amy\namy.send(osc=0, wave=2)\n')).toBeNull();
  });

  it('throws SketchError on a corrupt snapshot payload', () => {
    // "Zm9v" decodes to "foo", which is not valid PatchDoc JSON.
    expect(() => readEmbeddedPatchDoc('# amypatch:v1:deadbeef:Zm9v\n')).toThrow(SketchError);
  });
});

describe('parseSketch — Level A', () => {
  it('round-trips a generated sketch with no warnings (§5.1)', () => {
    const doc = subtractive();
    const result = parseSketch(compileToSketch(doc, provider).source);
    expect(result.doc).toEqual(doc);
    expect(result.warnings).toEqual([]);
    expect(result.lossy).toBe(false);
  });

  it('falls back to Level B and warns when the code was edited (§5.3)', () => {
    const { source } = compileToSketch(subtractive(), provider);
    const tampered = source.replace('amy.send(reset=8192)', 'amy.send(reset=8192)\namy.send(osc=7, wave=0)');
    const result = parseSketch(tampered);
    expect(result.warnings.some((w) => w.includes('edited after generation'))).toBe(true);
    expect(result.lossy).toBe(true);
    // the recognized setup sends were lifted to raw wire, layout was not trusted
    expect(result.doc.extras.unmappedWire.length).toBeGreaterThan(0);
  });
});

describe('parseSketch — Level B (foreign code, no execution)', () => {
  it('imports the docs example sketch: setup → wire, loop → custom code', () => {
    const src = [
      'import amy, amyboard',
      'amy.send(synth=1, patch=0, num_voices=6)',
      '',
      'def loop():',
      '    v = amyboard.cv_in(channel=0)',
      '    amy.send(osc=0, freq=440 * 2 ** v)',
      '',
    ].join('\n');

    const { doc, warnings, lossy } = parseSketch(src);
    expect(lossy).toBe(true);
    expect(doc.meta.origin).toBe('code-paste');
    // recognized top-level setup send → canonical wire
    expect(doc.extras.unmappedWire).toEqual(['i1iv6K0Z']);
    // known amyboard.cv_in → io lane
    expect(doc.io.cvIn).toEqual([{ channel: 0, mode: '1voct' }]);
    // the loop body (with its indented, dynamic amy.send) is preserved verbatim
    expect(doc.extras.userLoopCode).toContain('def loop():');
    expect(doc.extras.userLoopCode).toContain('amyboard.cv_in(channel=0)');
    // and surfaced as a read-only Custom Code module
    expect(doc.modules).toHaveLength(1);
    expect(doc.modules[0]!.type).toBe(CUSTOM_CODE_TYPE);
    expect(doc.modules[0]!.state['code']).toBe(doc.extras.userLoopCode);
    expect(warnings.some((w) => w.includes('cv_in'))).toBe(true);
  });

  it('leaves an unknown-param send in the residue with a warning', () => {
    const { doc, warnings, lossy } = parseSketch('amy.send(bogus=5)\n');
    expect(lossy).toBe(true);
    expect(doc.extras.unmappedWire).toEqual([]);
    expect(doc.extras.userLoopCode).toBe('amy.send(bogus=5)');
    expect(warnings.some((w) => w.includes("unknown AMY param 'bogus'"))).toBe(true);
  });

  it('preserves arbitrary foreign Python as custom code', () => {
    const { doc, lossy } = parseSketch("import random\nprint('hello')\nfor i in range(3):\n    print(i)\n");
    expect(lossy).toBe(true);
    expect(doc.modules[0]!.type).toBe(CUSTOM_CODE_TYPE);
    expect(doc.extras.userLoopCode).toContain("print('hello')");
    expect(doc.extras.userLoopCode).toContain('for i in range(3):');
  });

  it('recovers the patch name from a generated header comment', () => {
    const src = '# AmyPatch Studio sketch — My Bass\nimport amy\namy.send(osc=0, wave=2)\n';
    expect(parseSketch(src).doc.meta.name).toBe('My Bass');
  });

  it('returns an empty, non-lossy doc for a blank sketch', () => {
    const { doc, warnings, lossy } = parseSketch('\n   \n');
    expect(doc.modules).toEqual([]);
    expect(doc.extras.userLoopCode).toBeNull();
    expect(warnings).toEqual([]);
    expect(lossy).toBe(false);
  });

  it('never throws on a corrupt embedded block — degrades to Level B', () => {
    const src = 'amy.send(osc=0, wave=2)\n# amypatch:v1:deadbeef:Zm9v\n';
    const { doc, warnings } = parseSketch(src);
    expect(warnings.some((w) => w.includes('snapshot ignored'))).toBe(true);
    expect(doc.extras.unmappedWire).toEqual(['v0w2Z']);
  });
});
