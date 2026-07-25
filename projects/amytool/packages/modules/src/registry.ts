/** Module registry — the app's read API over the library (docs/07 P1-02). */
import { CORE_MANIFESTS } from './core';
import { moduleManifestSchema, type ModuleCategory, type ModuleManifest } from './schema';

// Validate core manifests once at load; a malformed core manifest is a build bug
// and should fail loudly (parse also applies schema defaults).
const CORE: ReadonlyMap<string, ModuleManifest> = new Map(
  CORE_MANIFESTS.map((raw) => {
    const manifest = moduleManifestSchema.parse(raw);
    return [manifest.id, manifest];
  }),
);

export class ModuleRegistry {
  #modules: Map<string, ModuleManifest>;

  constructor(initial: Iterable<ModuleManifest> = CORE.values()) {
    this.#modules = new Map();
    for (const m of initial) this.#modules.set(m.id, m);
  }

  list(): ModuleManifest[] {
    return [...this.#modules.values()];
  }

  byId(id: string): ModuleManifest | undefined {
    return this.#modules.get(id);
  }

  byCategory(category: ModuleCategory): ModuleManifest[] {
    return this.list().filter((m) => m.category === category);
  }

  /** Group modules by category, in the canonical category order. */
  grouped(): { category: ModuleCategory; modules: ModuleManifest[] }[] {
    const order = new Map<ModuleCategory, ModuleManifest[]>();
    for (const m of this.list()) {
      const bucket = order.get(m.category) ?? [];
      bucket.push(m);
      order.set(m.category, bucket);
    }
    return [...order.entries()].map(([category, modules]) => ({ category, modules }));
  }

  /** Case-insensitive search over id, name and description. */
  search(query: string): ModuleManifest[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list();
    return this.list().filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q),
    );
  }

  /** Register a runtime module (LLM-generated / imported). Validated by caller. */
  register(manifest: ModuleManifest): void {
    this.#modules.set(manifest.id, manifest);
  }
}

/** Shared registry seeded with the core library. */
export const registry = new ModuleRegistry();
