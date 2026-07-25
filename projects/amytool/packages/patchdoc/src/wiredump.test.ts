import { describe, expect, it } from 'vitest';
import { createEmptyPatch, patchDocSchema, type Cable, type PatchDoc } from './schema';
import { compileToWire } from './compile';
import { parseWireDump } from './wiredump';
import type { ModuleInfoProvider, RoutingModuleInfo } from './allocate';

const INFO: Record<string, RoutingModuleInfo> = {
  'core.vco': {
    role: 'vco',
    jacks: [
      { id: 'pitch', kind: 'cv', dir: 'in', target: 'freq' },
      { id: 'fm', kind: 'cv', dir: 'in', target: 'freq' },
      { id: 'pwm', kind: 'cv', dir: 'in', target: 'duty' },
      { id: 'out', kind: 'audio', dir: 'out' },
    ],
  },
  'core.noise': { role: 'vco', jacks: [{ id: 'out', kind: 'audio', dir: 'out' }] },
  'core.lfo': { role: 'lfo', jacks: [{ id: 'out', kind: 'cv', dir: 'out' }] },
  'core.vcf': {
    role: 'vcf',
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in' },
      { id: 'cutoff_cv', kind: 'cv', dir: 'in', target: 'filter_freq' },
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
  'core.mixer4': {
    role: 'vca',
    jacks: [
      { id: 'in1', kind: 'audio', dir: 'in' },
      { id: 'in2', kind: 'audio', dir: 'in' },
      { id: 'in3', kind: 'audio', dir: 'in' },
      { id: 'in4', kind: 'audio', dir: 'in' },
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
  'core.fx.reverb': { role: 'fx', jacks: [{ id: 'in', kind: 'audio', dir: 'in' }, { id: 'out', kind: 'audio', dir: 'out' }] },
  'core.fx.echo': { role: 'fx', jacks: [{ id: 'in', kind: 'audio', dir: 'in' }, { id: 'out', kind: 'audio', dir: 'out' }] },
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
function build(modules: ReturnType<typeof mod>[], cables: Cable[] = []): PatchDoc {
  const doc = createEmptyPatch();
  doc.modules.push(...modules);
  doc.cables.push(...cables);
  return patchDocSchema.parse(doc);
}

/** compileToWire → parseWireDump → compileToWire must reproduce the wire. */
function roundtrip(doc: PatchDoc): { before: string[]; after: string[]; imported: PatchDoc } {
  const before = compileToWire(doc, provider).messages;
  const imported = parseWireDump(before);
  const after = compileToWire(imported, provider).messages;
  return { before, after, imported };
}

describe('parseWireDump', () => {
  it('imports a subtractive voice and round-trips the wire exactly', () => {
    const doc = build(
      [
        mod('vco1', 'core.vco', { wave: 'saw', coarse: 0, fine: 0 }),
        mod('vcf1', 'core.vcf', { type: 'lowpass', cutoff: 800, resonance: 0.7 }),
        mod('vca1', 'core.vca', {}),
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
    const { before, after, imported } = roundtrip(doc);
    expect(after).toEqual(before);

    const roles = imported.modules.map((m) => m.type).sort();
    expect(roles).toContain('core.vco');
    expect(roles).toContain('core.vcf');
    expect(roles).toContain('core.env');
    // the reconstructed VCO carries the original waveform and filter
    const vco = imported.modules.find((m) => m.type === 'core.vco')!;
    expect(vco.params['wave']).toBe('saw');
    const vcf = imported.modules.find((m) => m.type === 'core.vcf')!;
    expect(vcf.params).toMatchObject({ type: 'lowpass', cutoff: 800 });
    expect(imported.meta.origin).toBe('board-import');
  });

  it('imports an LFO modulation and round-trips', () => {
    const doc = build(
      [mod('vco1', 'core.vco', { wave: 'saw' }), mod('lfo1', 'core.lfo', { wave: 'sine', rate: 5, depth: 0.4 })],
      [cable('m', 'lfo1.out', 'vco1.fm', 'cv')],
    );
    const { before, after, imported } = roundtrip(doc);
    expect(after).toEqual(before);
    expect(imported.modules.some((m) => m.type === 'core.lfo')).toBe(true);
    const lfo = imported.modules.find((m) => m.type === 'core.lfo')!;
    expect(lfo.params).toMatchObject({ rate: 5, depth: 0.4 });
  });

  it('imports a preset voice + global reverb and round-trips', () => {
    const doc = build([
      mod('junovoice1', 'core.junovoice', { patch: 10, voices: 4 }),
      mod('reverb1', 'core.fx.reverb', { level: 0.4, liveness: 0.85, damping: 0.5 }),
    ]);
    const { before, after, imported } = roundtrip(doc);
    expect(after).toEqual(before);
    const voice = imported.modules.find((m) => m.type === 'core.junovoice')!;
    expect(voice.params).toMatchObject({ patch: 10, voices: 4 });
    expect(imported.modules.some((m) => m.type === 'core.fx.reverb')).toBe(true);
  });

  it('transposes: a +12 semitone VCO round-trips to the same frequency', () => {
    const doc = build([mod('vco1', 'core.vco', { wave: 'sine', coarse: 12, fine: 0 })]);
    const { before, after, imported } = roundtrip(doc);
    expect(after).toEqual(before);
    expect(imported.modules.find((m) => m.type === 'core.vco')!.params['coarse']).toBe(12);
  });

  it('matches golden dump fixtures and re-imports them wire-equivalent', async () => {
    const fixtures: Record<string, PatchDoc> = {
      subtractive: build(
        [
          mod('vco1', 'core.vco', { wave: 'saw' }),
          mod('vcf1', 'core.vcf', { type: 'lowpass', cutoff: 800, resonance: 0.7 }),
          mod('vca1', 'core.vca', {}),
          mod('out1', 'core.out'),
          mod('env1', 'core.env', { attack: 5, decay: 100, sustain: 0.7, release: 200 }),
        ],
        [
          cable('a', 'vco1.out', 'vcf1.in', 'audio'),
          cable('b', 'vcf1.out', 'vca1.in', 'audio'),
          cable('c', 'vca1.out', 'out1.in', 'audio'),
          cable('e', 'env1.out', 'vca1.cv', 'cv'),
        ],
      ),
      'juno-reverb': build([
        mod('junovoice1', 'core.junovoice', { patch: 10, voices: 4 }),
        mod('reverb1', 'core.fx.reverb', { level: 0.4, liveness: 0.85, damping: 0.5 }),
      ]),
    };
    for (const [name, doc] of Object.entries(fixtures)) {
      const wire = compileToWire(doc, provider).messages;
      await expect(wire.join('\n') + '\n').toMatchFileSnapshot(`./__fixtures__/${name}.dump`);
      expect(compileToWire(parseWireDump(wire), provider).messages).toEqual(wire);
    }
  });

  it('accepts a dump as a newline-joined string and preserves unknown lines', () => {
    const dump = ['S8192Z', 'v0w2f440,1Z', 'ZZZbogus'].join('\n');
    const doc = parseWireDump(dump);
    expect(doc.modules.some((m) => m.type === 'core.vco')).toBe(true);
    expect(doc.extras.unmappedWire).toContain('ZZZbogus');
  });
});
