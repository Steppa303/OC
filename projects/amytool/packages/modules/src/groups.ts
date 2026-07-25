/**
 * Module groups (docs/07 P5-04) — a `group.*` is a reusable sub-graph fragment:
 * a set of core modules with relative positions and pre-wired cables. Inserting a
 * group expands it into concrete module instances with fresh unique ids (internal
 * cable refs remapped) at an offset from the drop point.
 */
import { z } from 'zod';
import { registry } from './registry';

const groupModuleSchema = z.object({
  localId: z.string().min(1),
  type: z.string().regex(/^core\.[a-z0-9_.]+$/),
  params: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  state: z.record(z.unknown()).default({}),
  pos: z.object({ x: z.number(), y: z.number() }),
});

const groupCableSchema = z.object({
  from: z.object({ module: z.string(), jack: z.string() }),
  to: z.object({ module: z.string(), jack: z.string() }),
});

export const groupManifestSchema = z.object({
  manifestVersion: z.literal(1),
  id: z.string().regex(/^group\.[a-z0-9_.]+$/, 'id like group.subtractive'),
  name: z.string().min(1),
  description: z.string().default(''),
  modules: z.array(groupModuleSchema).min(1),
  cables: z.array(groupCableSchema).default([]),
});

export type GroupManifest = z.infer<typeof groupManifestSchema>;

/** A concrete module produced by expanding a group. */
export interface ExpandedModule {
  id: string;
  type: string;
  label: string;
  pos: { x: number; y: number };
  params: Record<string, string | number | boolean>;
  advanced: boolean;
  state: Record<string, unknown>;
}

export interface ExpandedCable {
  id: string;
  from: { module: string; jack: string };
  to: { module: string; jack: string };
  kind: 'audio' | 'cv' | 'gate' | 'midi';
}

export interface ExpandedGroup {
  modules: ExpandedModule[];
  cables: ExpandedCable[];
}

function uniqueId(type: string, taken: Set<string>): string {
  const base = (type.split('.').pop() ?? 'mod').replace(/[^a-z0-9_]/g, '') || 'mod';
  const stem = /^[a-z]/.test(base) ? base : `m${base}`;
  for (let n = 1; ; n++) {
    const id = `${stem}${n}`;
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
}

/**
 * Expand a group into concrete modules + cables. `taken` is the set of module ids
 * already on the canvas (mutated with the new ids). `offset` shifts the fragment.
 */
export function expandGroup(
  group: GroupManifest,
  offset: { x: number; y: number },
  taken: Set<string>,
  cableIds: Set<string>,
): ExpandedGroup {
  const idMap = new Map<string, string>();
  const modules: ExpandedModule[] = group.modules.map((gm) => {
    const id = uniqueId(gm.type, taken);
    idMap.set(gm.localId, id);
    const manifest = registry.byId(gm.type);
    const defaults: Record<string, string | number | boolean> = {};
    for (const p of manifest?.params ?? []) defaults[p.id] = p.default;
    return {
      id,
      type: gm.type,
      label: manifest?.name ?? gm.type,
      pos: { x: gm.pos.x + offset.x, y: gm.pos.y + offset.y },
      params: { ...defaults, ...gm.params },
      advanced: false,
      state: gm.state,
    };
  });

  let n = 1;
  const nextCableId = () => {
    while (cableIds.has(`c${n}`)) n++;
    const id = `c${n}`;
    cableIds.add(id);
    return id;
  };

  const cables: ExpandedCable[] = group.cables.map((gc) => {
    const fromModule = idMap.get(gc.from.module) ?? gc.from.module;
    const jackKind = registry.byId(group.modules.find((m) => m.localId === gc.from.module)?.type ?? '')
      ?.jacks.find((j) => j.id === gc.from.jack)?.kind;
    return {
      id: nextCableId(),
      from: { module: fromModule, jack: gc.from.jack },
      to: { module: idMap.get(gc.to.module) ?? gc.to.module, jack: gc.to.jack },
      kind: jackKind ?? 'audio',
    };
  });

  return { modules, cables };
}

const RAW_GROUPS: GroupManifest[] = [
  {
    manifestVersion: 1,
    id: 'group.subtractive',
    name: 'Subtractive Voice',
    description: 'Classic VCO → VCF → VCA chain with an amplitude envelope.',
    modules: [
      { localId: 'vco', type: 'core.vco', params: { wave: 'saw' }, state: {}, pos: { x: 0, y: 0 } },
      { localId: 'vcf', type: 'core.vcf', params: { cutoff: 1200 }, state: {}, pos: { x: 8, y: 0 } },
      { localId: 'vca', type: 'core.vca', params: {}, state: {}, pos: { x: 14, y: 0 } },
      { localId: 'out', type: 'core.out', params: {}, state: {}, pos: { x: 20, y: 0 } },
      { localId: 'env', type: 'core.env', params: {}, state: {}, pos: { x: 8, y: 8 } },
    ],
    cables: [
      { from: { module: 'vco', jack: 'out' }, to: { module: 'vcf', jack: 'in' } },
      { from: { module: 'vcf', jack: 'out' }, to: { module: 'vca', jack: 'in' } },
      { from: { module: 'vca', jack: 'out' }, to: { module: 'out', jack: 'in' } },
      { from: { module: 'env', jack: 'out' }, to: { module: 'vca', jack: 'cv' } },
    ],
  },
  {
    manifestVersion: 1,
    id: 'group.fm2op',
    name: 'FM 2-Op',
    description: 'A carrier oscillator modulated by a second operator, with an envelope.',
    modules: [
      { localId: 'car', type: 'core.vco', params: { wave: 'sine' }, state: {}, pos: { x: 0, y: 0 } },
      { localId: 'mod', type: 'core.lfo', params: { wave: 'sine', rate: 20, depth: 0.6 }, state: {}, pos: { x: 0, y: 8 } },
      { localId: 'vca', type: 'core.vca', params: {}, state: {}, pos: { x: 8, y: 0 } },
      { localId: 'out', type: 'core.out', params: {}, state: {}, pos: { x: 14, y: 0 } },
      { localId: 'env', type: 'core.env', params: {}, state: {}, pos: { x: 8, y: 8 } },
    ],
    cables: [
      { from: { module: 'mod', jack: 'out' }, to: { module: 'car', jack: 'fm' } },
      { from: { module: 'car', jack: 'out' }, to: { module: 'vca', jack: 'in' } },
      { from: { module: 'vca', jack: 'out' }, to: { module: 'out', jack: 'in' } },
      { from: { module: 'env', jack: 'out' }, to: { module: 'vca', jack: 'cv' } },
    ],
  },
  {
    manifestVersion: 1,
    id: 'group.drummachine',
    name: 'Drum Machine',
    description: 'A drum grid pre-cabled to a drum-kit voice through a mixer.',
    modules: [
      { localId: 'grid', type: 'core.drumgrid', params: {}, state: {}, pos: { x: 0, y: 0 } },
      { localId: 'voice', type: 'core.drumvoice', params: { kit: '384' }, state: {}, pos: { x: 0, y: 12 } },
      { localId: 'mix', type: 'core.mixer4', params: {}, state: {}, pos: { x: 10, y: 6 } },
      { localId: 'out', type: 'core.out', params: {}, state: {}, pos: { x: 18, y: 6 } },
    ],
    cables: [
      { from: { module: 'grid', jack: 'notes' }, to: { module: 'voice', jack: 'notes' } },
      { from: { module: 'voice', jack: 'out' }, to: { module: 'mix', jack: 'in1' } },
      { from: { module: 'mix', jack: 'out' }, to: { module: 'out', jack: 'in' } },
    ],
  },
];

// Validate group authoring at load (a bad fragment is a build bug).
const GROUPS: ReadonlyMap<string, GroupManifest> = new Map(
  RAW_GROUPS.map((g) => {
    const parsed = groupManifestSchema.parse(g);
    return [parsed.id, parsed];
  }),
);

export const GROUP_MANIFESTS: readonly GroupManifest[] = [...GROUPS.values()];

export function listGroups(): GroupManifest[] {
  return [...GROUPS.values()];
}

export function groupById(id: string): GroupManifest | undefined {
  return GROUPS.get(id);
}
