// ─── Canvas State Store (Zustand) ─────────────────────────────────────
// Manages the visual placement and runtime parameters of every module
// instance on the AMY Live canvas. Modules are the draggable, resizable
// panels that represent oscillators, filters, envelopes, etc.

import { create } from 'zustand';
import type { CanvasModule } from '@/types/amy';

export interface CanvasStore {
  // ── State ───────────────────────────────────────────────────────────
  modules: CanvasModule[];
  selectedId: string | null;

  // ── Actions ─────────────────────────────────────────────────────────

  /** Add a new module instance at the given position. */
  addModule: (
    moduleType: string,
    x: number,
    y: number,
    width?: number,
    height?: number,
    params?: Record<string, any>,
    targetOsc?: number,
    targetSynth?: number,
    targetBus?: number,
  ) => string;

  /** Remove a module by its canvas id. */
  removeModule: (id: string) => void;

  /** Update a module's non-param properties (position, size, targets). */
  updateModule: (id: string, updates: Partial<Omit<CanvasModule, 'id'>>) => void;

  /** Merge new parameter values into a module's params object. */
  updateParams: (id: string, params: Record<string, any>) => void;

  /** Move a module to new x, y coordinates. */
  moveModule: (id: string, x: number, y: number) => void;

  /** Resize a module. */
  resizeModule: (id: string, width: number, height: number) => void;

  /** Set the currently selected module id (null = deselect). */
  selectModule: (id: string | null) => void;

  /** Remove all modules from the canvas. */
  clear: () => void;

  /** Get the currently selected module object. */
  selectedModule: () => CanvasModule | undefined;

  /** Import a full module array (e.g. from a saved patch / layout). */
  importModules: (modules: CanvasModule[]) => void;
}

/** Generate a short random id for canvas instances. */
function generateId(): string {
  return `cm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  modules: [],
  selectedId: null,

  addModule: (
    moduleType,
    x,
    y,
    width = 280,
    height = 200,
    params = {},
    targetOsc,
    targetSynth,
    targetBus,
  ) => {
    const id = generateId();
    const mod: CanvasModule = {
      id,
      moduleType,
      x,
      y,
      width,
      height,
      params,
      targetOsc,
      targetSynth,
      targetBus,
    };

    set((state) => ({
      modules: [...state.modules, mod],
      selectedId: id,
    }));

    return id;
  },

  removeModule: (id) => {
    set((state) => ({
      modules: state.modules.filter((m) => m.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },

  updateModule: (id, updates) => {
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    }));
  },

  updateParams: (id, params) => {
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id ? { ...m, params: { ...m.params, ...params } } : m,
      ),
    }));
  },

  moveModule: (id, x, y) => {
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id ? { ...m, x, y } : m,
      ),
    }));
  },

  resizeModule: (id, width, height) => {
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id ? { ...m, width, height } : m,
      ),
    }));
  },

  selectModule: (id) => set({ selectedId: id }),

  clear: () => set({ modules: [], selectedId: null }),

  selectedModule: () => {
    const { modules, selectedId } = get();
    return modules.find((m) => m.id === selectedId);
  },

  importModules: (modules) => {
    set({ modules, selectedId: null });
  },
}));