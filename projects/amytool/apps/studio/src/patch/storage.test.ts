import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createEmptyPatch } from '@amy/patchdoc';
import { deletePatch, getLastOpened, listPatches, loadPatch, savePatch } from './storage';

async function clearAll() {
  for (const p of await listPatches()) await deletePatch(p.id);
  localStorage.clear();
}

beforeEach(clearAll);

describe('patch storage', () => {
  it('saves and reloads a patch', async () => {
    const doc = createEmptyPatch('My Patch');
    await savePatch(doc);
    const loaded = await loadPatch(doc.meta.id);
    expect(loaded?.meta.name).toBe('My Patch');
    expect(getLastOpened()).toBe(doc.meta.id);
  });

  it('lists patches newest-first by modifiedAt', async () => {
    const a = createEmptyPatch('A');
    a.meta.modifiedAt = '2026-01-01T00:00:00.000Z';
    const b = createEmptyPatch('B');
    b.meta.modifiedAt = '2026-07-01T00:00:00.000Z';
    await savePatch(a);
    await savePatch(b);
    expect((await listPatches()).map((p) => p.name)).toEqual(['B', 'A']);
  });

  it('deletes a patch and clears the last-opened pointer', async () => {
    const doc = createEmptyPatch('Gone');
    await savePatch(doc);
    await deletePatch(doc.meta.id);
    expect(await loadPatch(doc.meta.id)).toBeUndefined();
    expect(getLastOpened()).toBeNull();
  });

  it('overwrites an existing patch on re-save (keyed by meta.id)', async () => {
    const doc = createEmptyPatch('V1');
    await savePatch(doc);
    doc.meta.name = 'V2';
    await savePatch(doc);
    expect(await listPatches()).toHaveLength(1);
    expect((await loadPatch(doc.meta.id))?.meta.name).toBe('V2');
  });
});
