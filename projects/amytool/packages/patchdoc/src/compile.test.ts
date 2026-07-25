import { describe, expect, it } from 'vitest';
import { createEmptyPatch, patchDocSchema, type Cable, type PatchDoc } from './schema';
import { compileToWire } from './compile';
import type { ModuleInfoProvider, RoutingModuleInfo } from './allocate';
import { decodeMessage } from '@amy/protocol';

// Minimal routing metadata mirroring the core manifests the compiler targets.
const INFO: Record<string, RoutingModuleInfo> = {
  'core.vco': {
    role: 'vco',
    jacks: [
      { id: 'pitch', kind: 'cv', dir: 'in', target: 'freq' },
      { id: 'fm', kind: 'cv', dir: 'in', target: 'freq' },
      { id: 'pan_cv', kind: 'cv', dir: 'in', target: 'pan' },
      { id: 'pwm', kind: 'cv', dir: 'in', target: 'duty' },
      { id: 'out', kind: 'audio', dir: 'out' },
    ],
  },
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
  'core.env': {
    role: 'env',
    jacks: [
      { id: 'gate', kind: 'gate', dir: 'in' },
      { id: 'out', kind: 'cv', dir: 'out' },
    ],
  },
  'core.cvin': {
    role: 'io',
    jacks: [{ id: 'out', kind: 'cv', dir: 'out' }],
  },
  'core.out': { role: 'io', jacks: [{ id: 'in', kind: 'audio', dir: 'in' }] },
  'core.junovoice': {
    role: 'voice',
    jacks: [
      { id: 'notes', kind: 'midi', dir: 'in' },
      { id: 'out', kind: 'audio', dir: 'out' },
    ],
  },
  'core.stepseq16': {
    role: 'seq',
    jacks: [{ id: 'notes', kind: 'midi', dir: 'out' }],
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
function build(modules: ReturnType<typeof mod>[], cables: Cable[] = []): PatchDoc {
  const doc = createEmptyPatch();
  doc.modules.push(...modules);
  doc.cables.push(...cables);
  return patchDocSchema.parse(doc);
}

describe('compileToWire', () => {
  it('always resets first and emits decodable messages', () => {
    const doc = build([mod('vco1', 'core.vco', { wave: 'saw' })]);
    const { messages } = compileToWire(doc, provider);
    expect(messages[0]).toBe('S8192Z');
    for (const m of messages) expect(() => decodeMessage(m)).not.toThrow();
  });

  it('compiles a bare saw VCO', () => {
    const doc = build([mod('vco1', 'core.vco', { wave: 'saw', coarse: 0, fine: 0 })]);
    expect(compileToWire(doc, provider).messages).toMatchInlineSnapshot(`
      [
        "S8192Z",
        "v0w2f440,1Z",
      ]
    `);
  });

  it('compiles a subtractive voice: VCO -> VCF -> VCA -> Out with an amp envelope', () => {
    const doc = build(
      [
        mod('vco1', 'core.vco', { wave: 'saw' }),
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
    const { messages } = compileToWire(doc, provider);
    expect(messages).toMatchInlineSnapshot(`
      [
        "S8192Z",
        "v0w2A5,1,100,0.7,200,0G1R0.7a,,,1f440,1F800Z",
      ]
    `);
    // osc 0 carries the filter, the amp envelope and eg0 coupling
    const osc0 = decodeMessage(messages[1]!);
    expect(osc0['filter_type']).toBe(1);
    expect(osc0['filter_freq']).toEqual([800]);
    expect(osc0['bp0']).toEqual([5, 1, 100, 0.7, 200, 0]);
  });

  it('transposes an oscillator by coarse + fine semitones', () => {
    const doc = build([mod('vco1', 'core.vco', { wave: 'sine', coarse: 12, fine: 0 })]);
    const osc0 = decodeMessage(compileToWire(doc, provider).messages[1]!);
    // +12 semitones doubles the base frequency
    expect((osc0['freq'] as number[])[0]).toBeCloseTo(880, 3);
  });

  it('routes an LFO to a target as a modulation source', () => {
    const doc = build(
      [mod('vco1', 'core.vco', { wave: 'saw' }), mod('lfo1', 'core.lfo', { wave: 'sine', rate: 5, depth: 0.4 })],
      [cable('m', 'lfo1.out', 'vco1.fm', 'cv')],
    );
    const { messages, allocation } = compileToWire(doc, provider);
    const vcoOsc = allocation.oscMap['vco1']![0]!;
    const oscMsg = messages.map(decodeMessage).find((e) => e['osc'] === vcoOsc)!;
    expect(oscMsg['mod_source']).toBe(allocation.oscMap['lfo1']![0]);
    // freq coef mod slot (index 5) weighted by depth
    expect((oscMsg['freq'] as (number | null)[])[5]).toBeCloseTo(0.4, 6);
  });

  it('emits a static pan coefficient only when moved off center (Stufe 4)', () => {
    // Default pan (0.5) stays out of the wire so existing patches are unchanged.
    const centered = compileToWire(build([mod('vco1', 'core.vco', { pan: 0.5 })]), provider);
    const osc0 = centered.messages.map(decodeMessage).find((e) => e['osc'] === 0)!;
    expect(osc0['pan']).toBeUndefined();
    // Moved pan → a const coefficient.
    const panned = compileToWire(build([mod('vco1', 'core.vco', { pan: 0.2 })]), provider);
    const p = panned.messages.map(decodeMessage).find((e) => e['osc'] === 0)!;
    expect((p['pan'] as (number | null)[])[0]).toBeCloseTo(0.2, 6);
  });

  it('routes an LFO to the pan coefficient (generalized native modulation, Stufe 4)', () => {
    const doc = build(
      [mod('vco1', 'core.vco', { wave: 'saw' }), mod('lfo1', 'core.lfo', { wave: 'sine', rate: 3, depth: 0.6 })],
      [cable('m', 'lfo1.out', 'vco1.pan_cv', 'cv')],
    );
    const { messages, allocation } = compileToWire(doc, provider);
    const oscMsg = messages.map(decodeMessage).find((e) => e['osc'] === allocation.oscMap['vco1']![0])!;
    expect(oscMsg['mod_source']).toBe(allocation.oscMap['lfo1']![0]);
    expect((oscMsg['pan'] as (number | null)[])[5]).toBeCloseTo(0.6, 6);
  });

  it('binds a 1V/oct CV input to the target osc freq via ext0/ext1 (channel)', () => {
    const doc = build(
      [mod('vco1', 'core.vco', { wave: 'saw' }), mod('cv1', 'core.cvin', { channel: 0, mode: '1voct' })],
      [cable('c', 'cv1.out', 'vco1.pitch', 'cv')],
    );
    const osc0 = decodeMessage(compileToWire(doc, provider).messages[1]!);
    // freq coef ext0 slot (index 7) is set, so pitch follows CV input 0
    expect((osc0['freq'] as (number | null)[])[7]).toBe(1);

    const docCh1 = build(
      [mod('vco1', 'core.vco', { wave: 'saw' }), mod('cv1', 'core.cvin', { channel: 1, mode: '1voct' })],
      [cable('c', 'cv1.out', 'vco1.pitch', 'cv')],
    );
    const osc = decodeMessage(compileToWire(docCh1, provider).messages[1]!);
    expect((osc['freq'] as (number | null)[])[8]).toBe(1); // ext1
  });

  it('maps a step sequencer pattern to AMY sequence slots + tempo', () => {
    const seq = {
      id: 'seq1',
      type: 'core.stepseq16',
      label: 'seq1',
      pos: { x: 0, y: 0 },
      params: {},
      advanced: false,
      state: { tracks: [{ note: 48, vel: 1, steps: [true, false, true, false] }] },
    };
    const doc = build(
      [mod('junovoice1', 'core.junovoice', { patch: 0 }), seq],
      [cable('n', 'seq1.notes', 'junovoice1.notes', 'midi')],
    );
    const { messages } = compileToWire(doc, provider);
    // tempo emitted once when a sequencer is present
    expect(messages.some((m) => decodeMessage(m)['tempo'] === 108)).toBe(true);
    // active steps 0 and 2 scheduled on the target synth, period = 4 steps × 12 ticks
    const seqMsgs = messages.map(decodeMessage).filter((e) => e['sequence'] !== undefined);
    expect(seqMsgs).toHaveLength(2);
    expect(seqMsgs[0]).toMatchObject({ sequence: [0, 48, 0], note: 48, synth: 1 });
    expect(seqMsgs[1]).toMatchObject({ sequence: [24, 48, 1], note: 48 });
  });

  it('loads preset voices and global effects', () => {
    const doc = build([
      mod('junovoice1', 'core.junovoice', { patch: 10, voices: 4 }),
      mod('reverb1', 'core.fx.reverb', { level: 0.4, liveness: 0.85, damping: 0.5 }),
    ]);
    const { messages } = compileToWire(doc, provider);
    expect(messages).toContain('i1iv4K10Z');
    expect(messages.some((m) => m.startsWith('h0.4,0.85,0.5'))).toBe(true);
  });

  it('is deterministic', () => {
    const doc = build(
      [mod('vco2', 'core.vco', { wave: 'saw' }), mod('vco1', 'core.vco', { wave: 'square' })],
    );
    expect(compileToWire(doc, provider).messages).toEqual(compileToWire(doc, provider).messages);
  });
});
