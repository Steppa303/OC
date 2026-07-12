// ─── AMY Live Event Log Store ─────────────────────────────────────────
// Captures every notable event (MIDI, errors, state changes, SysEx, pings)
// in a ring buffer + localStorage for persistence. The backend endpoint
// receives batches for server-side analysis.

import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────
export interface LogEntry {
  id: string;
  ts: number;         // unix ms
  kind: LogKind;
  message: string;
  detail?: string;     // optional raw payload / JSON / hex dump
}

export type LogKind =
  | 'connection'       // connect / disconnect / connecting
  | 'error'            // errors, warnings
  | 'midi'             // raw MIDI messages
  | 'sysex'            // SysEx payloads
  | 'wire'             // AMY wire commands (human-readable)
  | 'ping'             // ping / pong
  | 'dump'             // state dump events
  | 'debug'            // debug info
  | 'user';            // UI actions (save, load, reboot, etc.)

// ─── Config ───────────────────────────────────────────────────────────
const MAX_MEMORY_LOG = 500;       // Ring buffer size in memory
const STORAGE_KEY = 'amylive-log';
const STORAGE_MAX = 200;          // How many entries survive in localStorage
const BACKEND_URL = '/api/amy/log'; // proxied via Caddy → localhost:3011
const BACKEND_FLUSH_INTERVAL_MS = 10_000; // Send to backend every 10s
const BACKEND_MAX_BATCH = 50;     // Max entries per POST

// ─── Helpers ──────────────────────────────────────────────────────────
let idCounter = 0;
function nextId(): string {
  return `log-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function getStored(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LogEntry[];
  } catch {
    return [];
  }
}

function setStored(entries: LogEntry[]): void {
  try {
    // Keep only the latest STORAGE_MAX entries.
    const trimmed = entries.slice(-STORAGE_MAX);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or disabled – silently drop.
  }
}

// ─── Store ────────────────────────────────────────────────────────────
export interface LogStore {
  entries: LogEntry[];
  filter: LogKind | 'all';
  searchQuery: string;
  paused: boolean;

  // ── Actions ─────────────────────────────────────────────────────────
  log: (kind: LogKind, message: string, detail?: string) => void;
  clear: () => void;
  setFilter: (filter: LogKind | 'all') => void;
  setSearch: (query: string) => void;
  setPaused: (paused: boolean) => void;

  // ── Backend sync ────────────────────────────────────────────────────
  flushToBackend: () => Promise<void>;
}

export const useLogStore = create<LogStore>((set, get) => {
  // Load persisted entries on init.
  const initial = getStored();

  // Periodically flush to backend.
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  // Start flush interval (only on first creation).
  if (typeof window !== 'undefined') {
    flushTimer = setInterval(() => {
      get().flushToBackend();
    }, BACKEND_FLUSH_INTERVAL_MS);

    // Cleanup on tab close.
    window.addEventListener('beforeunload', () => {
      get().flushToBackend();
      if (flushTimer) clearInterval(flushTimer);
    });
  }

  return {
    entries: initial,
    filter: 'all',
    searchQuery: '',
    paused: false,

    log: (kind, message, detail?) => {
      const entry: LogEntry = {
        id: nextId(),
        ts: Date.now(),
        kind,
        message,
        detail,
      };

      set((state) => {
        const entries = [...state.entries, entry].slice(-MAX_MEMORY_LOG);
        // Persist to localStorage.
        setStored(entries);
        return { entries };
      });
    },

    clear: () => {
      localStorage.removeItem(STORAGE_KEY);
      set({ entries: [] });
    },

    setFilter: (filter) => set({ filter }),
    setSearch: (query) => set({ searchQuery: query }),
    setPaused: (paused) => set({ paused }),

    flushToBackend: async () => {
      const { entries } = get();
      if (entries.length === 0) return;

      // Take the oldest unflushed entries (up to BACKEND_MAX_BATCH).
      // We estimate "unflushed" as entries stored in memory that
      // haven't been sent yet. For simplicity we send all entries
      // every time and let the backend dedupe.
      try {
        await fetch(BACKEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device: 'amyboard',
            entries: entries.slice(-BACKEND_MAX_BATCH),
          }),
        });
      } catch {
        // Backend might not be reachable – that's fine, logs survive
        // in localStorage until the next flush.
      }
    },
  };
});