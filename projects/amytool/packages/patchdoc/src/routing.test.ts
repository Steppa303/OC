import { describe, expect, it } from 'vitest';
import { createEmptyPatch, patchDocSchema, type Cable, type PatchDoc } from './schema';
import { evaluateConnection, type Endpoint } from './capabilities';
import { allocate, resolveAffectedOscs, type ModuleInfoProvider, type RoutingModuleInfo } from './allocate';

// --- capability matrix ---

const ep = (role: Endpoint['role'], kind: Endpoint['kind'], dir: Endpoint['dir'], target?: string): Endpoint =>
  target === undefined ? { role, kind, dir } : { role, kind, dir, target };

describe('evaluateConnection', () => {
  it('routes audio by target role', () => {
    expect(evaluateConnection(ep('vco', 'audio', 'out'), ep('vcf', 'audio', 'in'))).toEqual({ ok: true, mechanism: 'filter-attach' });
    expect(evaluateConnection(ep('vcf', 'audio', 'out'), ep('io', 'audio', 'in'))).toEqual({ ok: true, mechanism: 'audio-chain' });
    expect(evaluateConnection(ep('vco', 'audio', 'out'), ep('fx', 'audio', 'in'))).toEqual({ ok: true, mechanism: 'fx-send' });
  });

  it('routes cv by source role when target is a coef param', () => {
    expect(evaluateConnection(ep('env', 'cv', 'out'), ep('vcf', 'cv', 'in', 'filter_freq'))).toEqual({ ok: true, mechanism: 'envelope' });
    expect(evaluateConnection(ep('lfo', 'cv', 'out'), ep('vco', 'cv', 'in', 'freq'))).toEqual({ ok: true, mechanism: 'mod-source' });
    expect(evaluateConnection(ep('io', 'cv', 'out'), ep('vco', 'cv', 'in', 'freq'))).toEqual({ ok: true, mechanism: 'ctrl-coef' });
  });

  it('routes cv into a non-coef target as scripted modulation (Stufe 5)', () => {
    // A named-but-non-coef target (e.g. an effect feedback param) is realized by a
    // generated control loop rather than native coefs.
    expect(evaluateConnection(ep('io', 'cv', 'out'), ep('fx', 'cv', 'in', 'feedback'))).toEqual({
      ok: true,
      mechanism: 'scripted',
    });
  });

  it('rejects cv into an input with no modulation target', () => {
    const r = evaluateConnection(ep('env', 'cv', 'out'), ep('vcf', 'cv', 'in'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no modulation target/);
  });

  it('rejects kind mismatches and wrong directions', () => {
    expect(evaluateConnection(ep('vco', 'audio', 'out'), ep('vco', 'cv', 'in', 'freq'))).toMatchObject({ ok: false });
    expect(evaluateConnection(ep('vco', 'audio', 'in'), ep('io', 'audio', 'in'))).toMatchObject({ ok: false });
  });

  it('passes gate and midi through', () => {
    expect(evaluateConnection(ep('env', 'gate', 'out'), ep('env', 'gate', 'in'))).toEqual({ ok: true, mechanism: 'cv-trigger' });
    expect(evaluateConnection(ep('io', 'midi', 'out'), ep('voice', 'midi', 'in'))).toEqual({ ok: true, mechanism: 'midi-route' });
  });
});

// --- allocator ---

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
  'core.lfo': { role: 'lfo', jacks: [{ id: 'out', kind: 'cv', dir: 'out' }] },
  'core.vcf': {
    role: 'vcf',
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in' },
      { id: 'cutoff_cv', kind: 'cv', dir: 'in', target: 'filter_freq' },
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
};

const provider: ModuleInfoProvider = (type) => INFO[type];

function mod(id: string, type: string) {
  return { id, type, label: id, pos: { x: 0, y: 0 }, params: {}, advanced: false, state: {} };
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

describe('allocate', () => {
  it('assigns osc numbers deterministically by id', () => {
    const doc = build([mod('vco2', 'core.vco'), mod('vco1', 'core.vco'), mod('lfo1', 'core.lfo')]);
    const a = allocate(doc, provider);
    const b = allocate(doc, provider);
    expect(a.allocation.oscMap).toEqual({ lfo1: [0], vco1: [1], vco2: [2] });
    expect(a.allocation.oscMap).toEqual(b.allocation.oscMap);
    expect(a.errors).toEqual([]);
  });

  it('reuses the previous allocation so numbers stay stable across edits', () => {
    const first = allocate(build([mod('vco1', 'core.vco'), mod('vco2', 'core.vco'), mod('vco3', 'core.vco')]), provider);
    expect(first.allocation.oscMap).toEqual({ vco1: [0], vco2: [1], vco3: [2] });
    // remove vco1; without reuse vco2/vco3 would shift down to 0/1
    const after = allocate(build([mod('vco2', 'core.vco'), mod('vco3', 'core.vco')]), provider, first.allocation);
    expect(after.allocation.oscMap).toEqual({ vco2: [1], vco3: [2] });
  });

  it('assigns synth numbers to voice modules', () => {
    const doc = build([mod('junovoice1', 'core.junovoice'), mod('junovoice2', 'core.junovoice')]);
    const { allocation } = allocate(doc, provider);
    expect(allocation.synthMap).toEqual({ junovoice1: 1, junovoice2: 2 });
  });

  it('resolves modulation targets through the audio chain', () => {
    const doc = build(
      [mod('vco1', 'core.vco'), mod('vcf1', 'core.vcf'), mod('out1', 'core.out')],
      [cable('c1', 'vco1.out', 'vcf1.in', 'audio'), cable('c2', 'vcf1.out', 'out1.in', 'audio')],
    );
    const { allocation } = allocate(doc, provider);
    // an envelope into vcf1.cutoff_cv should land on vco1's osc
    expect(resolveAffectedOscs('vcf1', doc, provider, allocation.oscMap)).toEqual(allocation.oscMap['vco1']);
  });

  it('rejects a third envelope on the same oscillator', () => {
    const doc = build(
      [
        mod('vco1', 'core.vco'),
        mod('vcf1', 'core.vcf'),
        mod('env1', 'core.env'),
        mod('env2', 'core.env'),
        mod('env3', 'core.env'),
      ],
      [
        cable('a', 'vco1.out', 'vcf1.in', 'audio'),
        cable('e1', 'env1.out', 'vcf1.cutoff_cv', 'cv'), // filter cutoff of vco1's osc
        cable('e2', 'env2.out', 'vco1.fm', 'cv'), // freq of vco1's osc
        cable('e3', 'env3.out', 'vco1.pwm', 'cv'), // duty of vco1's osc
      ],
    );
    const { errors } = allocate(doc, provider);
    expect(errors.some((e) => /2 envelopes per oscillator/.test(e.message))).toBe(true);
  });

  it('accepts two envelopes on one oscillator', () => {
    const doc = build(
      [mod('vco1', 'core.vco'), mod('env1', 'core.env'), mod('env2', 'core.env')],
      [cable('e1', 'env1.out', 'vco1.fm', 'cv'), cable('e2', 'env2.out', 'vco1.pwm', 'cv')],
    );
    expect(allocate(doc, provider).errors).toEqual([]);
  });

  it('rejects two modulation sources on the same oscillator', () => {
    const doc = build(
      [mod('vco1', 'core.vco'), mod('lfo1', 'core.lfo'), mod('lfo2', 'core.lfo')],
      [cable('m1', 'lfo1.out', 'vco1.fm', 'cv'), cable('m2', 'lfo2.out', 'vco1.pwm', 'cv')],
    );
    const { errors } = allocate(doc, provider);
    expect(errors.some((e) => /one modulation source/.test(e.message))).toBe(true);
  });
});
