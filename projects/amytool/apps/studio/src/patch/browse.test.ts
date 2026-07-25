import { describe, expect, it } from 'vitest';
import { allTags, browsePatches, normalizeTag } from './browse';
import type { PatchSummary } from './storage';

const THUMB = { w: 10, h: 10, modules: [], cables: [] };

const PATCHES: PatchSummary[] = [
  { id: 'a', name: 'Alpha Bass', tags: ['bass'], createdAt: '2026-07-01T00:00:00Z', modifiedAt: '2026-07-10T00:00:00Z', thumb: THUMB },
  { id: 'b', name: 'Zeta Lead', tags: ['lead', 'bright'], createdAt: '2026-07-05T00:00:00Z', modifiedAt: '2026-07-08T00:00:00Z', thumb: THUMB },
  { id: 'c', name: 'Mid Pad', tags: [], createdAt: '2026-07-03T00:00:00Z', modifiedAt: '2026-07-09T00:00:00Z', thumb: THUMB },
];

describe('browsePatches', () => {
  it('sorts by modified (default), name, and created', () => {
    expect(browsePatches(PATCHES, { query: '', tag: null, sort: 'modified' }).map((p) => p.id)).toEqual(['a', 'c', 'b']);
    expect(browsePatches(PATCHES, { query: '', tag: null, sort: 'name' }).map((p) => p.id)).toEqual(['a', 'c', 'b'].sort((x, y) => (PATCHES.find((p) => p.id === x)?.name ?? '').localeCompare(PATCHES.find((p) => p.id === y)?.name ?? '')));
    expect(browsePatches(PATCHES, { query: '', tag: null, sort: 'created' }).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('searches name and tags, case-insensitive', () => {
    expect(browsePatches(PATCHES, { query: 'alpha', tag: null, sort: 'modified' }).map((p) => p.id)).toEqual(['a']);
    expect(browsePatches(PATCHES, { query: 'BRIGHT', tag: null, sort: 'modified' }).map((p) => p.id)).toEqual(['b']);
    expect(browsePatches(PATCHES, { query: 'nope', tag: null, sort: 'modified' })).toEqual([]);
  });

  it('filters by tag, combined with search', () => {
    expect(browsePatches(PATCHES, { query: '', tag: 'lead', sort: 'modified' }).map((p) => p.id)).toEqual(['b']);
    expect(browsePatches(PATCHES, { query: 'zeta', tag: 'bass', sort: 'modified' })).toEqual([]);
  });

  it('does not mutate the input order', () => {
    const before = PATCHES.map((p) => p.id);
    browsePatches(PATCHES, { query: '', tag: null, sort: 'name' });
    expect(PATCHES.map((p) => p.id)).toEqual(before);
  });
});

describe('allTags', () => {
  it('collects unique tags alphabetically', () => {
    expect(allTags(PATCHES)).toEqual(['bass', 'bright', 'lead']);
  });
});

describe('normalizeTag', () => {
  it('lowercases, trims and dashes inner whitespace', () => {
    expect(normalizeTag('  Warm  Pad ')).toBe('warm-pad');
    expect(normalizeTag('BASS')).toBe('bass');
    expect(normalizeTag('   ')).toBe('');
  });
});
