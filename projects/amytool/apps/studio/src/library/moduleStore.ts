import { create } from 'zustand';
import { parseManifest, registry, type ModuleManifest } from '@amy/modules';
import { deleteModule, listModules, saveModule } from '../patch/storage';

/**
 * User module library (P5-06). Registers LLM-generated / imported modules into the
 * shared registry (so the palette + library see them) and persists them to
 * IndexedDB. `version` bumps on any change so React views re-read the registry.
 */
export interface ModuleStoreState {
  version: number;
  init: () => Promise<void>;
  add: (manifest: ModuleManifest) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let initialized = false;

export const useModuleStore = create<ModuleStoreState>((set, get) => ({
  version: 0,

  init: async () => {
    if (initialized) return;
    initialized = true;
    const stored = await listModules();
    for (const raw of stored) {
      try {
        registry.register(parseManifest(raw));
      } catch {
        /* skip a corrupt stored manifest */
      }
    }
    set({ version: get().version + 1 });
  },

  add: async (manifest) => {
    registry.register(manifest);
    await saveModule(manifest.id, manifest);
    set({ version: get().version + 1 });
  },

  remove: async (id) => {
    await deleteModule(id);
    set({ version: get().version + 1 });
    // registry has no unregister; the module simply stops persisting and is gone on reload.
  },
}));
