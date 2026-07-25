import { describe, expect, it } from 'vitest';
import { createEmptyPatch, patchDocSchema } from '@amy/patchdoc';
import { thumbnailData } from './thumbnail';

function docWith(modules: { id: string; type: string; x: number; y: number }[], cables: { from: string; to: string }[] = []) {
  const doc = createEmptyPatch('Thumb Test');
  return patchDocSchema.parse({
    ...doc,
    modules: modules.map((m) => ({
      id: m.id,
      type: m.type,
      label: m.id,
      pos: { x: m.x, y: m.y },
      params: {},
      advanced: false,
      state: {},
    })),
    cables: cables.map((c, i) => ({
      id: `c${i + 1}`,
      from: { module: c.from, jack: 'out' },
      to: { module: c.to, jack: 'in' },
      kind: 'audio' as const,
    })),
  });
}

describe('thumbnailData (P7-01)', () => {
  it('produces one rect per module with manifest width', () => {
    const data = thumbnailData(docWith([{ id: 'vco1', type: 'core.vco', x: 0, y: 0 }]));
    expect(data.modules).toHaveLength(1);
    expect(data.modules[0]?.w).toBeGreaterThanOrEqual(4); // hp from the manifest
    expect(data.w).toBeGreaterThan(data.modules[0]!.w);
  });

  it('connects cable endpoints at module centers', () => {
    const data = thumbnailData(
      docWith(
        [
          { id: 'vco1', type: 'core.vco', x: 0, y: 0 },
          { id: 'vcf1', type: 'core.vcf', x: 12, y: 0 },
        ],
        [{ from: 'vco1', to: 'vcf1' }],
      ),
    );
    expect(data.cables).toHaveLength(1);
    const [rect1, rect2] = data.modules;
    expect(data.cables[0]?.x1).toBeCloseTo(rect1!.x + rect1!.w / 2);
    expect(data.cables[0]?.x2).toBeCloseTo(rect2!.x + rect2!.w / 2);
    expect(data.cables[0]?.kind).toBe('audio');
  });

  it('normalizes negative positions into the padded viewBox', () => {
    const data = thumbnailData(docWith([{ id: 'vco1', type: 'core.vco', x: -20, y: -8 }]));
    expect(data.modules[0]?.x).toBeGreaterThanOrEqual(0);
    expect(data.modules[0]?.y).toBeGreaterThanOrEqual(0);
  });

  it('handles an empty patch without NaN dimensions', () => {
    const data = thumbnailData(createEmptyPatch('Empty'));
    expect(data.modules).toEqual([]);
    expect(Number.isFinite(data.w)).toBe(true);
    expect(Number.isFinite(data.h)).toBe(true);
    expect(data.w).toBeGreaterThan(0);
  });
});
