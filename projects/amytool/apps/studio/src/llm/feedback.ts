/**
 * Local-only generation feedback log (docs/05 §6). Stores each accepted
 * generation's prompt + result summary and the user's 👍/👎 in localStorage, in
 * a shape the eval harness can later replay. Never leaves the client.
 */
export type Verdict = 'up' | 'down';

export interface FeedbackEntry {
  id: string;
  at: string;
  prompt: string;
  name: string;
  notes: string;
  verdict: Verdict | null;
}

const STORAGE_KEY = 'amypatch:llm:feedback';

export function loadFeedback(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: FeedbackEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-200)));
  } catch {
    /* no storage — ignore */
  }
}

/** Record a generation; returns its id so the verdict can be attached later. */
export function recordGeneration(prompt: string, name: string, notes: string): string {
  const id = crypto.randomUUID();
  const entries = loadFeedback();
  entries.push({ id, at: new Date().toISOString(), prompt, name, notes, verdict: null });
  save(entries);
  return id;
}

export function setVerdict(id: string, verdict: Verdict): void {
  const entries = loadFeedback();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  entry.verdict = verdict;
  save(entries);
}
