import { describe, expect, it } from 'vitest';
import { expandGroup, GROUP_MANIFESTS } from '@amy/modules';
import { compileToWire, createEmptyPatch, patchDocSchema } from '@amy/patchdoc';
import { moduleInfoProvider } from './routing';

/** Build a PatchDoc from an expanded group fragment. */
function docFromGroup(id: string) {
  const group = GROUP_MANIFESTS.find((g) => g.id === id)!;
  const { modules, cables } = expandGroup(group, { x: 0, y: 0 }, new Set(), new Set());
  const doc = createEmptyPatch(group.name);
  doc.modules.push(...modules);
  doc.cables.push(...cables);
  return patchDocSchema.parse(doc);
}

describe('group golden fixtures', () => {
  for (const group of GROUP_MANIFESTS) {
    it(`${group.id} compiles to wire`, async () => {
      const { messages, errors } = compileToWire(docFromGroup(group.id), moduleInfoProvider);
      expect(errors).toEqual([]);
      expect(messages[0]).toBe('S8192Z'); // always resets first
      await expect(messages.join('\n') + '\n').toMatchFileSnapshot(`./__fixtures__/${group.id}.wire`);
    });
  }
});
