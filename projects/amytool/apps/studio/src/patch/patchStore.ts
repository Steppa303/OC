import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import {
  createEmptyPatch,
  evaluateConnection,
  type Cable,
  type JackRef,
  type ModuleInstance,
  type PatchDoc,
} from '@amy/patchdoc';
import { expandGroup, groupById, moduleDefaultParams, registry } from '@amy/modules';
import { endpointForModule } from './routing';
import { pxToHp, type Vec2 } from './geometry';

export interface CableResult {
  ok: boolean;
  reason?: string;
}

export interface PatchState {
  doc: PatchDoc;
  /** Selected module ids (React Flow selection mirrored here). */
  selectedIds: string[];
  /** Selected cable ids. */
  selectedEdgeIds: string[];
  /** Ephemeral pixel positions during a drag gesture, not persisted. */
  dragPx: Record<string, Vec2>;
  /** Undo/redo snapshot stacks. */
  past: PatchDoc[];
  future: PatchDoc[];
  undo: () => void;
  redo: () => void;

  addModule: (type: string, pos: Vec2) => string | null;
  /** Expand a `group.*` fragment onto the canvas (one undoable step). */
  insertGroup: (groupId: string, pos: Vec2) => string[];
  setDragPx: (id: string, px: Vec2) => void;
  commitDrag: () => void;
  removeModules: (ids: string[]) => void;
  duplicateModules: (ids: string[]) => string[];
  setParam: (id: string, paramId: string, value: string | number | boolean) => void;
  /** Replace a module's private state (e.g. a sequencer pattern). */
  setModuleState: (id: string, state: Record<string, unknown>) => void;
  setSelected: (ids: string[]) => void;
  setSelectedEdges: (ids: string[]) => void;
  /** Validate against the capability matrix + fan-out rules, then add the cable. */
  addCable: (from: JackRef, to: JackRef) => CableResult;
  /** Non-committing check used for live legal-target highlighting. */
  canAddCable: (from: JackRef, to: JackRef) => CableResult;
  removeCables: (ids: string[]) => void;
  /** Remove every cable touching a jack (P7-02 jack context menu). */
  disconnectJack: (moduleId: string, jackId: string) => void;
  /** Select every cable touching a jack, to highlight it (P7-02). */
  highlightJackCables: (moduleId: string, jackId: string) => void;
  renameModule: (id: string, label: string) => void;
  /** Set (or clear, with undefined) a module's cosmetic color tag (P7-02). */
  setModuleColor: (id: string, color: string | undefined) => void;
  /** Swap a module's type in place, keeping position and any still-valid cables
   *  and matching param values (P7-02 replace-with-compatible). */
  replaceModule: (id: string, newType: string) => void;
  /** Copy a module's params into the clipboard (same-type paste, P7-02). */
  copyModuleParams: (id: string) => void;
  /** Paste clipboard params onto a same-type module. Returns false if no match. */
  pasteModuleParams: (id: string) => boolean;
  /** Clipboard contents for the paste-enabled check in menus. */
  paramClipboard: { type: string; params: Record<string, string | number | boolean> } | null;
  /** Cable auto-sag (droop) toggle; off draws tidy near-straight cables (P7-02). */
  cableTidy: boolean;
  setCableTidy: (tidy: boolean) => void;
  /** Toggle a module's advanced (expanded) view. */
  setAdvanced: (id: string, advanced: boolean) => void;
  setName: (name: string) => void;
  /** Replace the patch's tag list (P7-01 patch browser). */
  setTags: (tags: string[]) => void;
  setTempo: (bpm: number) => void;
  newPatch: () => void;
  loadDoc: (doc: PatchDoc) => void;
  /** Replace the whole doc as one undoable step (e.g. an LLM edit). */
  replaceDoc: (doc: PatchDoc) => void;
}

/** Shared validation for addCable/canAddCable. Pure over the given doc. */
function checkCable(doc: PatchDoc, from: JackRef, to: JackRef): CableResult {
  if (from.module === to.module) return { ok: false, reason: "can't patch a module to itself" };
  const fromMod = doc.modules.find((m) => m.id === from.module);
  const toMod = doc.modules.find((m) => m.id === to.module);
  if (!fromMod || !toMod) return { ok: false, reason: 'unknown module' };
  const fromEp = endpointForModule(fromMod, from.jack);
  const toEp = endpointForModule(toMod, to.jack);
  if (!fromEp || !toEp) return { ok: false, reason: 'unknown jack' };
  const res = evaluateConnection(fromEp, toEp);
  if (!res.ok) return { ok: false, reason: res.reason };
  if (
    toEp.kind !== 'midi' &&
    doc.cables.some((c) => c.to.module === to.module && c.to.jack === to.jack)
  ) {
    return { ok: false, reason: 'that input already has a cable' };
  }
  if (doc.cables.some((c) => c.from.module === from.module && c.from.jack === from.jack && c.to.module === to.module && c.to.jack === to.jack)) {
    return { ok: false, reason: 'already connected' };
  }
  return { ok: true };
}

/** Derive a unique, schema-valid (`^[a-z][a-z0-9_]*$`) id from a module type. */
function uniqueId(type: string, taken: Set<string>): string {
  const base = (type.split('.').pop() ?? 'mod').replace(/[^a-z0-9_]/g, '') || 'mod';
  const stem = /^[a-z]/.test(base) ? base : `m${base}`;
  for (let n = 1; ; n++) {
    const id = `${stem}${n}`;
    if (!taken.has(id)) return id;
  }
}

function touch(doc: PatchDoc): void {
  doc.meta.modifiedAt = new Date().toISOString();
}

const HISTORY_LIMIT = 100;
const COALESCE_MS = 400;
let lastCoalesceKey: string | null = null;
let lastCoalesceTime = 0;

const CABLE_TIDY_KEY = 'amypatch:cableTidy';

function loadCableTidy(): boolean {
  try {
    return localStorage.getItem(CABLE_TIDY_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCableTidy(tidy: boolean): void {
  try {
    localStorage.setItem(CABLE_TIDY_KEY, tidy ? '1' : '0');
  } catch {
    /* no storage — ignore */
  }
}

/** Snapshot the current doc onto the undo stack before a mutation. Consecutive
 *  calls with the same coalesceKey within COALESCE_MS collapse into one entry,
 *  so a knob drag (many setParam calls) becomes a single undo step. */
function record(state: { doc: PatchDoc; past: PatchDoc[]; future: PatchDoc[] }, coalesceKey?: string): void {
  const now = Date.now();
  if (coalesceKey && coalesceKey === lastCoalesceKey && now - lastCoalesceTime < COALESCE_MS) {
    lastCoalesceTime = now;
    return;
  }
  lastCoalesceKey = coalesceKey ?? null;
  lastCoalesceTime = now;
  state.past.push(current(state.doc) as PatchDoc);
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = [];
}

/**
 * Pack a new module of width `hp` onto row `pos.y`, starting at `pos.x` but
 * pushed right past any module it would overlap — so freshly added modules line
 * up tidily instead of stacking on the same spot.
 */
function freeSlotX(modules: readonly ModuleInstance[], pos: Vec2, hp: number): number {
  let x = pos.x;
  let moved = true;
  while (moved) {
    moved = false;
    for (const m of modules) {
      if (m.pos.y !== pos.y) continue;
      const mhp = registry.byId(m.type)?.hp ?? 2;
      if (x < m.pos.x + mhp && m.pos.x < x + hp) {
        x = m.pos.x + mhp;
        moved = true;
      }
    }
  }
  return x;
}

export const usePatchStore = create<PatchState>()(
  immer((set, get) => ({
    doc: createEmptyPatch(),
    selectedIds: [],
    selectedEdgeIds: [],
    dragPx: {},
    past: [],
    future: [],
    paramClipboard: null,
    cableTidy: loadCableTidy(),

    undo: () =>
      set((state) => {
        const prev = state.past.pop();
        if (!prev) return;
        state.future.unshift(current(state.doc) as PatchDoc);
        state.doc = prev;
        state.selectedIds = [];
        state.selectedEdgeIds = [];
        state.dragPx = {};
        lastCoalesceKey = null;
      }),

    redo: () =>
      set((state) => {
        const next = state.future.shift();
        if (!next) return;
        state.past.push(current(state.doc) as PatchDoc);
        state.doc = next;
        state.selectedIds = [];
        state.selectedEdgeIds = [];
        state.dragPx = {};
        lastCoalesceKey = null;
      }),

    addModule: (type, pos) => {
      const manifest = registry.byId(type);
      if (!manifest) return null;
      let newId = '';
      set((state) => {
        record(state);
        const taken = new Set(state.doc.modules.map((m) => m.id));
        newId = uniqueId(type, taken);
        const instance: ModuleInstance = {
          id: newId,
          type,
          label: manifest.name,
          pos: { x: freeSlotX(state.doc.modules, pos, manifest.hp), y: pos.y },
          params: moduleDefaultParams(manifest),
          advanced: false,
          state: {},
        };
        state.doc.modules.push(instance);
        // Select the fresh module so it's highlighted (Stufe 1), like insertGroup/duplicate.
        state.selectedIds = [newId];
        state.selectedEdgeIds = [];
        touch(state.doc);
      });
      return newId;
    },

    insertGroup: (groupId, pos) => {
      const group = groupById(groupId);
      if (!group) return [];
      const created: string[] = [];
      set((state) => {
        record(state);
        const taken = new Set(state.doc.modules.map((m) => m.id));
        const cableIds = new Set(state.doc.cables.map((c) => c.id));
        const { modules, cables } = expandGroup(group, pos, taken, cableIds);
        for (const m of modules) {
          state.doc.modules.push(m);
          created.push(m.id);
        }
        for (const c of cables) state.doc.cables.push(c);
        state.selectedIds = created;
        touch(state.doc);
      });
      return created;
    },

    setDragPx: (id, px) => {
      set((state) => {
        state.dragPx[id] = px;
      });
    },

    commitDrag: () => {
      set((state) => {
        if (Object.keys(state.dragPx).length > 0) record(state);
        let changed = false;
        for (const [id, px] of Object.entries(state.dragPx)) {
          const module = state.doc.modules.find((m) => m.id === id);
          if (module) {
            module.pos = pxToHp(px);
            changed = true;
          }
        }
        state.dragPx = {};
        if (changed) touch(state.doc);
      });
    },

    removeModules: (ids) => {
      const remove = new Set(ids);
      set((state) => {
        record(state);
        state.doc.modules = state.doc.modules.filter((m) => !remove.has(m.id));
        state.doc.cables = state.doc.cables.filter(
          (c) => !remove.has(c.from.module) && !remove.has(c.to.module),
        );
        state.selectedIds = state.selectedIds.filter((id) => !remove.has(id));
        state.dragPx = Object.fromEntries(
          Object.entries(state.dragPx).filter(([id]) => !remove.has(id)),
        );
        touch(state.doc);
      });
    },

    duplicateModules: (ids) => {
      const created: string[] = [];
      set((state) => {
        record(state);
        const taken = new Set(state.doc.modules.map((m) => m.id));
        for (const id of ids) {
          const src = state.doc.modules.find((m) => m.id === id);
          if (!src) continue;
          const manifest = registry.byId(src.type);
          const newId = uniqueId(src.type, taken);
          taken.add(newId);
          created.push(newId);
          state.doc.modules.push({
            id: newId,
            type: src.type,
            label: src.label,
            pos: { x: src.pos.x + (manifest?.hp ?? 2), y: src.pos.y },
            params: { ...src.params },
            advanced: src.advanced,
            // JSON clone: state is serializable and src is an immer draft proxy
            // (structuredClone rejects proxies).
            state: JSON.parse(JSON.stringify(src.state)) as Record<string, unknown>,
          });
        }
        if (created.length > 0) {
          state.selectedIds = created;
          touch(state.doc);
        }
      });
      return created;
    },

    setParam: (id, paramId, value) => {
      set((state) => {
        const module = state.doc.modules.find((m) => m.id === id);
        if (module) {
          record(state, `param:${id}:${paramId}`);
          module.params[paramId] = value;
          touch(state.doc);
        }
      });
    },

    setModuleState: (id, next) => {
      set((state) => {
        const module = state.doc.modules.find((m) => m.id === id);
        if (module) {
          record(state, `state:${id}`);
          module.state = next;
          touch(state.doc);
        }
      });
    },

    setSelected: (ids) => {
      set((state) => {
        state.selectedIds = ids;
      });
    },

    setSelectedEdges: (ids) => {
      set((state) => {
        state.selectedEdgeIds = ids;
      });
    },

    canAddCable: (from, to) => checkCable(get().doc, from, to),

    addCable: (from, to) => {
      const result = checkCable(get().doc, from, to);
      if (!result.ok) return result;
      set((state) => {
        record(state);
        const toMod = state.doc.modules.find((m) => m.id === to.module);
        const toEp = toMod ? endpointForModule(current(toMod) as ModuleInstance, to.jack) : undefined;
        const taken = new Set(state.doc.cables.map((c) => c.id));
        let n = 1;
        while (taken.has(`c${n}`)) n++;
        const cable: Cable = { id: `c${n}`, from, to, kind: toEp?.kind ?? 'audio' };
        state.doc.cables.push(cable);
        touch(state.doc);
      });
      return result;
    },

    removeCables: (ids) => {
      const remove = new Set(ids);
      set((state) => {
        record(state);
        state.doc.cables = state.doc.cables.filter((c) => !remove.has(c.id));
        state.selectedEdgeIds = state.selectedEdgeIds.filter((id) => !remove.has(id));
        touch(state.doc);
      });
    },

    disconnectJack: (moduleId, jackId) => {
      set((state) => {
        const touchesJack = (c: Cable) =>
          (c.from.module === moduleId && c.from.jack === jackId) ||
          (c.to.module === moduleId && c.to.jack === jackId);
        if (!state.doc.cables.some(touchesJack)) return;
        record(state);
        const removed = new Set(state.doc.cables.filter(touchesJack).map((c) => c.id));
        state.doc.cables = state.doc.cables.filter((c) => !touchesJack(c));
        state.selectedEdgeIds = state.selectedEdgeIds.filter((cid) => !removed.has(cid));
        touch(state.doc);
      });
    },

    highlightJackCables: (moduleId, jackId) => {
      set((state) => {
        state.selectedEdgeIds = state.doc.cables
          .filter(
            (c) =>
              (c.from.module === moduleId && c.from.jack === jackId) ||
              (c.to.module === moduleId && c.to.jack === jackId),
          )
          .map((c) => c.id);
        state.selectedIds = [];
      });
    },

    renameModule: (id, label) => {
      set((state) => {
        const module = state.doc.modules.find((m) => m.id === id);
        if (module && label.trim()) {
          record(state, `rename:${id}`);
          module.label = label.trim();
          touch(state.doc);
        }
      });
    },

    setModuleColor: (id, color) => {
      set((state) => {
        const module = state.doc.modules.find((m) => m.id === id);
        if (!module || module.color === color) return;
        // Discrete pick — no coalescing, so set then clear are two undo steps.
        record(state);
        if (color === undefined) delete module.color;
        else module.color = color;
        touch(state.doc);
      });
    },

    replaceModule: (id, newType) => {
      const manifest = registry.byId(newType);
      if (!manifest) return;
      set((state) => {
        const module = state.doc.modules.find((m) => m.id === id);
        if (!module || module.type === newType) return;
        record(state);
        const defaults = moduleDefaultParams(manifest);
        // Carry over any param whose id survives into the new manifest.
        const carried: Record<string, string | number | boolean> = { ...defaults };
        for (const key of Object.keys(defaults)) {
          if (key in module.params) carried[key] = module.params[key] as string | number | boolean;
        }
        module.type = newType;
        module.label = manifest.name;
        module.params = carried;
        module.advanced = false;
        module.state = {};
        // Drop cables whose jack no longer exists on the new module.
        const jackIds = new Set(manifest.jacks.map((j) => j.id));
        state.doc.cables = state.doc.cables.filter((c) => {
          if (c.from.module === id && !jackIds.has(c.from.jack)) return false;
          if (c.to.module === id && !jackIds.has(c.to.jack)) return false;
          return true;
        });
        touch(state.doc);
      });
    },

    copyModuleParams: (id) => {
      const module = get().doc.modules.find((m) => m.id === id);
      if (!module) return;
      set((state) => {
        state.paramClipboard = { type: module.type, params: { ...module.params } };
      });
    },

    pasteModuleParams: (id) => {
      const clip = get().paramClipboard;
      const module = get().doc.modules.find((m) => m.id === id);
      if (!clip || !module || module.type !== clip.type) return false;
      set((state) => {
        const target = state.doc.modules.find((m) => m.id === id);
        if (!target) return;
        record(state, `paste:${id}`);
        target.params = { ...target.params, ...clip.params };
        touch(state.doc);
      });
      return true;
    },

    setCableTidy: (tidy) => {
      saveCableTidy(tidy);
      set((state) => {
        state.cableTidy = tidy;
      });
    },

    setAdvanced: (id, advanced) => {
      set((state) => {
        const module = state.doc.modules.find((m) => m.id === id);
        if (module && module.advanced !== advanced) {
          record(state, `advanced:${id}`);
          module.advanced = advanced;
          touch(state.doc);
        }
      });
    },

    setName: (name) => {
      set((state) => {
        if (name.trim() && name.trim() !== state.doc.meta.name) {
          record(state, 'name');
          state.doc.meta.name = name.trim();
          touch(state.doc);
        }
      });
    },

    setTags: (tags) => {
      set((state) => {
        const next = [...new Set(tags.map((t) => t.trim()).filter((t) => t !== ''))];
        if (JSON.stringify(next) === JSON.stringify(state.doc.meta.tags)) return;
        record(state, 'tags');
        state.doc.meta.tags = next;
        touch(state.doc);
      });
    },

    setTempo: (bpm) => {
      set((state) => {
        const clamped = Math.max(20, Math.min(300, Math.round(bpm)));
        if (clamped === state.doc.globals.tempo) return;
        record(state, 'tempo');
        state.doc.globals.tempo = clamped;
        touch(state.doc);
      });
    },

    newPatch: () => {
      set((state) => {
        state.doc = createEmptyPatch();
        state.selectedIds = [];
        state.selectedEdgeIds = [];
        state.dragPx = {};
        state.past = [];
        state.future = [];
        lastCoalesceKey = null;
      });
    },

    loadDoc: (doc) => {
      set((state) => {
        state.doc = doc;
        state.selectedIds = [];
        state.selectedEdgeIds = [];
        state.dragPx = {};
        state.past = [];
        state.future = [];
        lastCoalesceKey = null;
      });
    },

    replaceDoc: (doc) => {
      set((state) => {
        record(state);
        state.doc = doc;
        state.selectedIds = [];
        state.selectedEdgeIds = [];
        state.dragPx = {};
      });
    },
  })),
);
