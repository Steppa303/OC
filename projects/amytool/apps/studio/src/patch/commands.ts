/**
 * Command palette command model + fuzzy matching (P7-02). Pure so the matcher
 * is unit-testable without React.
 */
export interface Command {
  id: string;
  label: string;
  /** Group heading in the list. */
  group: string;
  run: () => void;
  /** Extra searchable keywords. */
  keywords?: string;
}

/** Subsequence match (chars of `query` appear in order in `text`). Case-insensitive. */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  const t = text.toLowerCase();
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return i === q.length;
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim();
  if (q === '') return commands;
  return commands.filter((c) => fuzzyMatch(q, `${c.label} ${c.keywords ?? ''}`));
}
