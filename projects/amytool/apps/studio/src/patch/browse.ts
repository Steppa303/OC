/**
 * Patch-browser filtering (P7-01) — pure helpers over PatchSummary lists:
 * text search (name + tags), tag filter, and sort order.
 */
import type { PatchSummary } from './storage';

export type PatchSort = 'modified' | 'name' | 'created';

export interface BrowseOptions {
  query: string;
  tag: string | null;
  sort: PatchSort;
}

export const DEFAULT_BROWSE: BrowseOptions = { query: '', tag: null, sort: 'modified' };

/** Every tag in use across the saved patches, alphabetical. */
export function allTags(patches: PatchSummary[]): string[] {
  const tags = new Set<string>();
  for (const p of patches) for (const t of p.tags) tags.add(t);
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function browsePatches(patches: PatchSummary[], options: BrowseOptions): PatchSummary[] {
  const q = options.query.trim().toLowerCase();
  let list = patches.filter(
    (p) =>
      (q === '' || p.name.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))) &&
      (options.tag === null || p.tags.includes(options.tag)),
  );
  list = [...list];
  switch (options.sort) {
    case 'name':
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'created':
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'modified':
      list.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
      break;
  }
  return list;
}

/** Normalize a user-typed tag: trimmed, lowercase, inner spaces collapsed to '-'. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}
