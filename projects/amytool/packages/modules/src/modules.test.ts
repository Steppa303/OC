import { describe, expect, it } from 'vitest';
import { PARAM_BY_NAME } from '@amy/protocol';
import { CORE_MANIFESTS } from './core';
import { ModuleRegistry, registry } from './registry';
import { moduleManifestSchema, moduleDefaultParams, jackLabel, parseManifest } from './schema';

describe('core manifests', () => {
  it('all validate against the schema', () => {
    for (const raw of CORE_MANIFESTS) {
      const res = moduleManifestSchema.safeParse(raw);
      expect(res.success, `${(raw as { id: string }).id}: ${res.success ? '' : JSON.stringify(res.error.issues)}`).toBe(true);
    }
  });

  it('every declared amyParam exists in the protocol table', () => {
    for (const m of CORE_MANIFESTS) {
      for (const p of m.params) {
        if (p.amyParam) expect(PARAM_BY_NAME.has(p.amyParam), `${m.id}.${p.id} -> ${p.amyParam}`).toBe(true);
      }
    }
  });

  it('has unique module ids and expected coverage', () => {
    const ids = CORE_MANIFESTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const required of ['core.vco', 'core.vcf', 'core.env', 'core.out', 'core.midiin', 'core.junovoice']) {
      expect(ids).toContain(required);
    }
  });

  it('voice modules declare a patch range', () => {
    for (const m of CORE_MANIFESTS.filter((x) => x.role === 'voice')) {
      expect(m.voice?.patchRange).toBeDefined();
    }
  });
});

describe('schema helpers', () => {
  it('moduleDefaultParams collects control defaults', () => {
    const vco = parseManifest(CORE_MANIFESTS.find((m) => m.id === 'core.vco'));
    expect(moduleDefaultParams(vco)).toMatchObject({ wave: 'saw', coarse: 0, fine: 0, duty: 0.5 });
  });

  it('jackLabel falls back to uppercased id', () => {
    expect(jackLabel({ id: 'out', kind: 'audio', dir: 'out', advanced: false })).toBe('OUT');
    expect(jackLabel({ id: 'out', kind: 'audio', dir: 'out', label: 'sum', advanced: false })).toBe('sum');
  });

  it('rejects unknown amyParam', () => {
    const bad = { ...(CORE_MANIFESTS.find((m) => m.id === 'core.vcf') as object) };
    const res = moduleManifestSchema.safeParse({
      manifestVersion: 1,
      id: 'user.bad',
      name: 'Bad',
      category: 'filter',
      hp: 8,
      role: 'vcf',
      params: [{ id: 'x', label: 'X', control: 'knob', default: 0, min: 0, max: 1, amyParam: 'not_a_param' }],
      jacks: [],
    });
    void bad;
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues.some((i) => i.message.includes('unknown AMY param'))).toBe(true);
  });

  it('rejects select without options and knob without range', () => {
    const noOptions = moduleManifestSchema.safeParse({
      manifestVersion: 1, id: 'user.a', name: 'A', category: 'source', hp: 4, role: 'vco',
      params: [{ id: 'w', label: 'W', control: 'select', default: 'x' }], jacks: [],
    });
    expect(noOptions.success).toBe(false);
    const noRange = moduleManifestSchema.safeParse({
      manifestVersion: 1, id: 'user.b', name: 'B', category: 'source', hp: 4, role: 'vco',
      params: [{ id: 'k', label: 'K', control: 'knob', default: 0 }], jacks: [],
    });
    expect(noRange.success).toBe(false);
  });

  it('rejects log-scale knob with min <= 0', () => {
    const logZeroMin = moduleManifestSchema.safeParse({
      manifestVersion: 1, id: 'user.e', name: 'E', category: 'envelope', hp: 4, role: 'env',
      params: [{ id: 'a', label: 'A', control: 'knob', default: 5, min: 0, max: 5000, scale: 'log' }], jacks: [],
    });
    expect(logZeroMin.success).toBe(false);
    if (!logZeroMin.success) {
      expect(logZeroMin.error.issues.some((i) => i.message.includes('needs min > 0'))).toBe(true);
    }
  });

  it('no core module declares a log-scale param with min <= 0', () => {
    for (const m of CORE_MANIFESTS) {
      for (const p of m.params) {
        if (p.scale === 'log') expect(p.min, `${m.id}.${p.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('rejects hp out of range and advancedHp < hp', () => {
    expect(moduleManifestSchema.safeParse({ manifestVersion: 1, id: 'user.c', name: 'C', category: 'source', hp: 2, role: 'vco' }).success).toBe(false);
    expect(moduleManifestSchema.safeParse({ manifestVersion: 1, id: 'user.d', name: 'D', category: 'source', hp: 8, advancedHp: 6, role: 'vco' }).success).toBe(false);
  });
});

describe('ModuleRegistry', () => {
  it('lists, finds and groups core modules', () => {
    expect(registry.byId('core.vco')?.name).toBe('VCO');
    expect(registry.byId('nope.nope')).toBeUndefined();
    expect(registry.byCategory('fx').length).toBeGreaterThanOrEqual(4);
    const grouped = registry.grouped();
    expect(grouped.some((g) => g.category === 'voice')).toBe(true);
  });

  it('search matches id/name/description', () => {
    expect(registry.search('vco').map((m) => m.id)).toContain('core.vco');
    expect(registry.search('reverb').map((m) => m.id)).toContain('core.fx.reverb');
    expect(registry.search('').length).toBe(registry.list().length);
  });

  it('register adds runtime modules to a fresh registry', () => {
    const r = new ModuleRegistry();
    const before = r.list().length;
    r.register(parseManifest({
      manifestVersion: 1, id: 'user.test', name: 'Test', category: 'source', hp: 4, role: 'vco',
      params: [], jacks: [{ id: 'out', kind: 'audio', dir: 'out' }],
    }));
    expect(r.list().length).toBe(before + 1);
    expect(r.byId('user.test')?.name).toBe('Test');
  });
});
