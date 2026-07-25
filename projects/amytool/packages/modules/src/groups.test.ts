import { describe, expect, it } from 'vitest';
import { expandGroup, GROUP_MANIFESTS, groupById, listGroups } from './groups';
import { registry } from './registry';

describe('group manifests', () => {
  it('all authored groups validate and reference real core modules', () => {
    expect(listGroups().length).toBeGreaterThanOrEqual(3);
    for (const g of GROUP_MANIFESTS) {
      for (const m of g.modules) expect(registry.byId(m.type), `${g.id} → ${m.type}`).toBeDefined();
      const local = new Set(g.modules.map((m) => m.localId));
      for (const c of g.cables) {
        expect(local.has(c.from.module)).toBe(true);
        expect(local.has(c.to.module)).toBe(true);
      }
    }
  });
});

describe('expandGroup', () => {
  it('expands subtractive with unique ids, offset layout and derived cable kinds', () => {
    const taken = new Set<string>();
    const cableIds = new Set<string>();
    const { modules, cables } = expandGroup(groupById('group.subtractive')!, { x: 5, y: 3 }, taken, cableIds);

    expect(modules).toHaveLength(5);
    expect(new Set(modules.map((m) => m.id)).size).toBe(5);
    // relative layout is offset by the drop point
    expect(modules.find((m) => m.type === 'core.vco')!.pos).toEqual({ x: 5, y: 3 });
    expect(modules.find((m) => m.type === 'core.env')!.pos).toEqual({ x: 13, y: 11 });

    expect(cables).toHaveLength(4);
    // internal refs point at the freshly-minted ids, not the local ids
    const ids = new Set(modules.map((m) => m.id));
    for (const c of cables) {
      expect(ids.has(c.from.module)).toBe(true);
      expect(ids.has(c.to.module)).toBe(true);
    }
    // cable kinds derived from the source jack manifest
    const envCable = cables.find((c) => modules.find((m) => m.id === c.from.module)?.type === 'core.env');
    expect(envCable!.kind).toBe('cv');
    expect(cables.filter((c) => c.kind === 'audio')).toHaveLength(3);
  });

  it('avoids id collisions with existing canvas modules', () => {
    const taken = new Set(['vco1', 'vcf1']);
    const { modules } = expandGroup(groupById('group.subtractive')!, { x: 0, y: 0 }, taken, new Set());
    const vco = modules.find((m) => m.type === 'core.vco')!;
    expect(vco.id).not.toBe('vco1');
    expect(taken.has(vco.id)).toBe(true);
  });

  it('pre-wires the drum machine grid → voice → mixer → out', () => {
    const { modules, cables } = expandGroup(groupById('group.drummachine')!, { x: 0, y: 0 }, new Set(), new Set());
    expect(modules.map((m) => m.type).sort()).toEqual(['core.drumgrid', 'core.drumvoice', 'core.mixer4', 'core.out']);
    const gridToVoice = cables.find((c) => c.kind === 'midi');
    expect(gridToVoice).toBeDefined();
    expect(cables.filter((c) => c.kind === 'audio')).toHaveLength(2);
  });
});
