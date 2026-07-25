/** Favorite modules, persisted in localStorage (P5-01). */
const KEY = 'amypatch:favorites';

export function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites(favorites: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...favorites]));
  } catch {
    /* no storage — ignore */
  }
}
