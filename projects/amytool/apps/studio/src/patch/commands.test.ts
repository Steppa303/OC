import { describe, expect, it, vi } from 'vitest';
import { filterCommands, fuzzyMatch, type Command } from './commands';

describe('fuzzyMatch', () => {
  it('matches subsequences case-insensitively', () => {
    expect(fuzzyMatch('vco', 'Add VCO')).toBe(true);
    expect(fuzzyMatch('gtp', 'Go to Patch')).toBe(true);
    expect(fuzzyMatch('', 'anything')).toBe(true);
  });

  it('rejects when characters are missing or out of order', () => {
    expect(fuzzyMatch('xyz', 'Add VCO')).toBe(false);
    expect(fuzzyMatch('ocv', 'VCO')).toBe(false);
  });
});

describe('filterCommands', () => {
  const cmds: Command[] = [
    { id: 'a', label: 'Add VCO', group: 'Modules', keywords: 'source', run: vi.fn() },
    { id: 'b', label: 'Go to Code', group: 'Workspace', keywords: 'navigate', run: vi.fn() },
  ];

  it('returns all on empty query', () => {
    expect(filterCommands(cmds, '')).toHaveLength(2);
  });

  it('filters by label and keywords', () => {
    expect(filterCommands(cmds, 'vco').map((c) => c.id)).toEqual(['a']);
    expect(filterCommands(cmds, 'navigate').map((c) => c.id)).toEqual(['b']);
    expect(filterCommands(cmds, 'zzz')).toEqual([]);
  });
});
