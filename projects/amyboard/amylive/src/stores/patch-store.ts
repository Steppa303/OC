// ─── Patch Library Store (Zustand) ────────────────────────────────────
// Manages the user's patch collection with localStorage persistence
// under the key 'amylive-patches'. Supports CRUD, search, filter by
// category, and import/export (JSON) workflows.

import { create } from 'zustand';
import type { AmyPatch } from '@/types/amy';

// ─── Storage Key ──────────────────────────────────────────────────────
const STORAGE_KEY = 'amylive-patches';

// ─── Helpers ──────────────────────────────────────────────────────────

function loadPatches(): AmyPatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AmyPatch[];
  } catch {
    return [];
  }
}

function savePatches(patches: AmyPatch[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patches));
  } catch (err) {
    console.error('[PatchStore] Failed to persist patches:', err);
  }
}

function generatePatchId(): string {
  return `patch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankPatch(overrides: Partial<AmyPatch> = {}): AmyPatch {
  const now = Date.now();
  return {
    id: generatePatchId(),
    name: 'Unbenannter Patch',
    author: 'User',
    category: 'user',
    tags: [],
    state: {
      oscillators: [],
      synths: [],
      effects: [],
    },
    wireCommands: [],
    created: now,
    modified: now,
    boardSlot: undefined,
    ...overrides,
  };
}

// ─── Store ────────────────────────────────────────────────────────────

export interface PatchStore {
  // ── Readable State ──────────────────────────────────────────────────
  patches: AmyPatch[];
  selectedId: string | null;

  // ── Actions ─────────────────────────────────────────────────────────

  /** Select a patch by id (null = deselect). */
  selectPatch: (id: string | null) => void;

  /** Get currently selected patch object (or undefined). */
  selectedPatch: () => AmyPatch | undefined;

  /** Add a new patch. Returns its id. */
  addPatch: (patch?: Partial<AmyPatch>) => string;

  /** Update fields of an existing patch. */
  updatePatch: (id: string, updates: Partial<AmyPatch>) => void;

  /** Delete a patch by id. */
  deletePatch: (id: string) => void;

  /** Duplicate an existing patch with a new id. */
  duplicatePatch: (id: string) => string | undefined;

  /** Return all patches in a given category. */
  getByCategory: (category: AmyPatch['category']) => AmyPatch[];

  /** Full-text search across name, author, and tags. */
  search: (query: string) => AmyPatch[];

  /**
   * Export a single patch as a JSON string (ready for file download or
   * clipboard). Returns null if the patch was not found.
   */
  exportPatch: (id: string) => string | null;

  /**
   * Import a patch from a parsed JSON object.
   * @returns The id of the imported patch, or null if invalid.
   */
  importPatch: (json: unknown) => string | null;

  /** Reload patches from localStorage. */
  loadFromStorage: () => void;

  /** Persist current state to localStorage. */
  saveToStorage: () => void;

  /** Assign a board storage slot to a patch. */
  setBoardSlot: (id: string, slot: number | undefined) => void;
}

export const usePatchStore = create<PatchStore>((set, get) => ({
  patches: loadPatches(),
  selectedId: null,

  selectPatch: (id) => set({ selectedId: id }),

  selectedPatch: () => {
    const { patches, selectedId } = get();
    return patches.find((p) => p.id === selectedId);
  },

  addPatch: (patchOverrides = {}) => {
    const patch = blankPatch(patchOverrides);
    set((state) => {
      const updated = [...state.patches, patch];
      savePatches(updated);
      return { patches: updated, selectedId: patch.id };
    });
    return patch.id;
  },

  updatePatch: (id, updates) => {
    set((state) => {
      const updated = state.patches.map((p) =>
        p.id === id
          ? { ...p, ...updates, modified: Date.now() }
          : p,
      );
      savePatches(updated);
      return { patches: updated };
    });
  },

  deletePatch: (id) => {
    set((state) => {
      const updated = state.patches.filter((p) => p.id !== id);
      savePatches(updated);
      return {
        patches: updated,
        selectedId: state.selectedId === id ? null : state.selectedId,
      };
    });
  },

  duplicatePatch: (id) => {
    const { patches } = get();
    const source = patches.find((p) => p.id === id);
    if (!source) return undefined;

    const now = Date.now();
    const duplicate: AmyPatch = {
      ...source,
      id: generatePatchId(),
      name: `${source.name} (Kopie)`,
      created: now,
      modified: now,
      boardSlot: undefined,
    };

    set((state) => {
      const updated = [...state.patches, duplicate];
      savePatches(updated);
      return { patches: updated, selectedId: duplicate.id };
    });

    return duplicate.id;
  },

  getByCategory: (category) => {
    return get().patches.filter((p) => p.category === category);
  },

  search: (query) => {
    const q = query.toLowerCase().trim();
    if (!q) return get().patches;

    return get().patches.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q),
    );
  },

  exportPatch: (id) => {
    const patch = get().patches.find((p) => p.id === id);
    if (!patch) return null;

    try {
      const exportData = {
        format: 'amylive-patch',
        version: 1,
        exportedAt: Date.now(),
        patch,
      };
      return JSON.stringify(exportData, null, 2);
    } catch (err) {
      console.error('[PatchStore] Export failed:', err);
      return null;
    }
  },

  importPatch: (json) => {
    try {
      // Accept both wrapped and raw patch formats.
      let patch: AmyPatch;

      if (
        typeof json === 'object' &&
        json !== null &&
        'format' in json &&
        (json as any).format === 'amylive-patch' &&
        'patch' in json
      ) {
        patch = (json as any).patch as AmyPatch;
      } else if (
        typeof json === 'object' &&
        json !== null &&
        'id' in json &&
        'name' in json &&
        'state' in json
      ) {
        patch = json as AmyPatch;
      } else {
        console.error('[PatchStore] Invalid patch format.');
        return null;
      }

      // Assign a new id to prevent collisions and mark as imported.
      const now = Date.now();
      const imported: AmyPatch = {
        ...patch,
        id: generatePatchId(),
        name: patch.name || 'Importierter Patch',
        created: now,
        modified: now,
        boardSlot: undefined,
      };

      set((state) => {
        const updated = [...state.patches, imported];
        savePatches(updated);
        return { patches: updated, selectedId: imported.id };
      });

      return imported.id;
    } catch (err) {
      console.error('[PatchStore] Import failed:', err);
      return null;
    }
  },

  loadFromStorage: () => {
    const patches = loadPatches();
    set({ patches, selectedId: null });
  },

  saveToStorage: () => {
    savePatches(get().patches);
  },

  setBoardSlot: (id, slot) => {
    set((state) => {
      const updated = state.patches.map((p) =>
        p.id === id ? { ...p, boardSlot: slot, modified: Date.now() } : p,
      );
      savePatches(updated);
      return { patches: updated };
    });
  },
}));