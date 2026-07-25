import { describe, expect, it } from 'vitest';
import { allocate, compileToWire, patchDocSchema } from '@amy/patchdoc';
import { STARTER_TEMPLATES } from './templates';
import { thumbnailData } from './thumbnail';
import { moduleInfoProvider } from './routing';

describe('starter templates (P7-01)', () => {
  it.each(STARTER_TEMPLATES.map((t) => [t.name, t] as const))('%s builds a valid, compilable patch', (_name, template) => {
    const doc = template.build();
    expect(() => patchDocSchema.parse(doc)).not.toThrow();
    expect(doc.modules.length).toBeGreaterThan(0);
    expect(doc.meta.origin).toBe('group-template');
    expect(doc.meta.tags).toContain('starter');

    const alloc = allocate(doc, moduleInfoProvider);
    expect(alloc.errors).toEqual([]);
    const compiled = compileToWire(doc, moduleInfoProvider);
    expect(compiled.errors).toEqual([]);
    expect(compiled.messages.length).toBeGreaterThan(0);
  });

  it('every build yields a fresh patch id', () => {
    const t = STARTER_TEMPLATES[0]!;
    expect(t.build().meta.id).not.toBe(t.build().meta.id);
  });

  it('keyboard templates include the on-screen keyboard', () => {
    const subtractive = STARTER_TEMPLATES.find((t) => t.id === 'starter.subtractive')!.build();
    expect(subtractive.modules.some((m) => m.type === 'core.keyboard')).toBe(true);
    const drums = STARTER_TEMPLATES.find((t) => t.id === 'starter.drums')!.build();
    expect(drums.modules.some((m) => m.type === 'core.drumgrid')).toBe(true);
  });

  it('templates produce a non-empty thumbnail', () => {
    for (const t of STARTER_TEMPLATES) {
      const thumb = thumbnailData(t.build());
      expect(thumb.modules.length).toBeGreaterThan(0);
      expect(thumb.cables.length).toBeGreaterThan(0);
      expect(thumb.w).toBeGreaterThan(0);
    }
  });
});
