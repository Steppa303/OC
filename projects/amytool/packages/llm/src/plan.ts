/**
 * PatchPlan → PatchDoc lifting (docs/05 §2). Pure and deterministic: fills
 * manifest param defaults, derives cable kinds from jack manifests, assigns a
 * tidy left→right auto-layout by signal depth, and carries `loopCode` into
 * `extras.userLoopCode`. Validation lives in the pipeline; this just builds the
 * candidate doc.
 */
import {
  patchDocSchema,
  type Cable,
  type ModuleInfoProvider,
  type ModuleInstance,
  type PatchDoc,
  type Endpoint,
} from '@amy/patchdoc';
import { registry, type ModuleManifest } from '@amy/modules';
import { parseJackRef, type PatchPlan } from './contracts/patchplan';

/** ModuleInfoProvider backed by the shared module registry (allocator/compiler input). */
export const registryProvider: ModuleInfoProvider = (type) => {
  const manifest = registry.byId(type);
  if (!manifest) return undefined;
  return {
    role: manifest.role,
    jacks: manifest.jacks.map((j) => ({
      id: j.id,
      kind: j.kind,
      dir: j.dir,
      ...(j.target !== undefined ? { target: j.target } : {}),
    })),
    params: manifest.params.map((p) => ({
      id: p.id,
      ...(p.amyParam !== undefined ? { amyParam: p.amyParam } : {}),
    })),
  };
};

/** Capability Endpoint for a jack on a module type, or undefined if unknown. */
export function endpointFor(type: string, jackId: string): Endpoint | undefined {
  const manifest = registry.byId(type);
  const jack = manifest?.jacks.find((j) => j.id === jackId);
  if (!manifest || !jack) return undefined;
  return {
    role: manifest.role,
    kind: jack.kind,
    dir: jack.dir,
    ...(jack.target !== undefined ? { target: jack.target } : {}),
  };
}

function defaultsFor(manifest: ModuleManifest): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const p of manifest.params) params[p.id] = p.default;
  return params;
}

/** Longest incoming-cable path to each module → its layout column. */
function layoutColumns(plan: PatchPlan): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const c of plan.cables) {
    const to = parseJackRef(c.to).module;
    const from = parseJackRef(c.from).module;
    const list = incoming.get(to) ?? [];
    list.push(from);
    incoming.set(to, list);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const compute = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // defensive: broken cycle
    visiting.add(id);
    const sources = incoming.get(id) ?? [];
    const d = sources.length === 0 ? 0 : 1 + Math.max(...sources.map(compute));
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const m of plan.modules) compute(m.id);
  return depth;
}

const COL_HP = 12;
const ROW_HP = 8;

export interface PlanToDocOptions {
  prompt?: string;
  now?: string;
  /** When editing an existing patch, preserve its identity (docs/05 §3 "base"). */
  base?: PatchDoc;
}

export function planToDoc(plan: PatchPlan, options: PlanToDocOptions = {}): PatchDoc {
  const columns = layoutColumns(plan);
  const rowInColumn = new Map<number, number>();

  const modules: ModuleInstance[] = plan.modules.map((pm) => {
    const manifest = registry.byId(pm.type);
    const col = columns.get(pm.id) ?? 0;
    const row = rowInColumn.get(col) ?? 0;
    rowInColumn.set(col, row + 1);
    return {
      id: pm.id,
      type: pm.type,
      label: manifest?.name ?? pm.id,
      pos: { x: col * COL_HP, y: row * ROW_HP },
      params: manifest ? { ...defaultsFor(manifest), ...pm.params } : { ...pm.params },
      advanced: false,
      state: {},
    };
  });

  const typeById = new Map(plan.modules.map((m) => [m.id, m.type]));
  const cables: Cable[] = plan.cables.map((pc, i) => {
    const from = parseJackRef(pc.from);
    const to = parseJackRef(pc.to);
    const kind = endpointFor(typeById.get(from.module) ?? '', from.jack)?.kind ?? 'audio';
    return { id: `c${i + 1}`, from, to, kind };
  });

  const effects = plan.globals?.effects ?? {};
  const now = options.now ?? new Date().toISOString();
  const base = options.base;

  return patchDocSchema.parse({
    version: 1,
    meta: {
      id: base?.meta.id ?? crypto.randomUUID(),
      name: plan.name,
      tags: base?.meta.tags ?? [],
      createdAt: base?.meta.createdAt ?? now,
      modifiedAt: now,
      origin: 'llm',
      ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
    },
    modules,
    cables,
    globals: {
      effects,
      ...(plan.globals?.tempo !== undefined ? { tempo: plan.globals.tempo } : {}),
      ...(plan.globals?.volume !== undefined ? { volume: plan.globals.volume } : {}),
    },
    io: { midiChannel: plan.io?.midiChannel ?? 1, cvIn: [], cvOut: [] },
    extras: { unmappedWire: [], userLoopCode: plan.loopCode ?? null },
  });
}
