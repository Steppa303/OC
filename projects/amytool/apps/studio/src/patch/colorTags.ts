/**
 * Module color tags (P7-02). A small fixed palette keyed by a stable name; the
 * key is what lands in `ModuleInstance.color`, and the CSS value comes from a
 * design token so the accent stays theme-consistent (no hard-coded colors).
 */
export interface ColorTag {
  key: string;
  label: string;
  css: string;
}

export const COLOR_TAGS: readonly ColorTag[] = [
  { key: 'blue', label: 'Blue', css: 'var(--accent)' },
  { key: 'green', label: 'Green', css: 'var(--ok)' },
  { key: 'amber', label: 'Amber', css: 'var(--warn)' },
  { key: 'red', label: 'Red', css: 'var(--danger)' },
  { key: 'violet', label: 'Violet', css: 'var(--jack-midi)' },
];

/** Resolve a stored color key to its CSS token value, or undefined if unknown. */
export function colorCss(key: string | undefined): string | undefined {
  if (key === undefined) return undefined;
  return COLOR_TAGS.find((c) => c.key === key)?.css;
}
