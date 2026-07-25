/**
 * Allocator (docs/03 §3) — maps the module graph onto AMY's fixed-function
 * model: assigns oscillator numbers to oscillator-bearing modules, synth numbers
 * to voice groups, and validates the constraints AMY imposes (≤2 envelopes per
 * osc, ≤1 modulation source per osc). Output is stable: an unchanged graph
 * yields identical numbers, and passing the previous allocation minimizes churn
 * so realtime deltas and board state stay consistent.
 *
 * No dependency on @amy/modules: routing metadata is supplied via a provider.
 */
import type { PatchDoc } from './schema';
import type { RoutingRole } from './capabilities';

export interface RoutingJack {
  id: string;
  kind: 'audio' | 'cv' | 'gate' | 'midi';
  dir: 'in' | 'out';
  target?: string;
}

export interface RoutingParam {
  id: string;
  /** AMY param name this control maps to (from the manifest), if any. */
  amyParam?: string;
}

export interface RoutingModuleInfo {
  role: RoutingRole;
  jacks: RoutingJack[];
  /** Optional — only the compiler needs param↔amyParam mappings. */
  params?: RoutingParam[];
}

export type ModuleInfoProvider = (type: string) => RoutingModuleInfo | undefined;

export interface Allocation {
  oscMap: Record<string, number[]>;
  synthMap: Record<string, number>;
}

export interface AllocationError {
  module: string;
  message: string;
}

export interface AllocationResult {
  allocation: Allocation;
  errors: AllocationError[];
  warnings: string[];
}

/** Roles that consume a raw AMY oscillator slot. */
const OSC_ROLES: ReadonlySet<RoutingRole> = new Set<RoutingRole>(['vco', 'lfo']);
/** Roles that are a "view" onto the oscillator(s) feeding their audio input. */
const PROCESSOR_ROLES: ReadonlySet<RoutingRole> = new Set<RoutingRole>(['vcf', 'vca']);

function lowestFree(used: ReadonlySet<number>): number {
  let n = 0;
  while (used.has(n)) n++;
  return n;
}

/**
 * Resolve which oscillator numbers a modulation cable ultimately lands on.
 * A cv/gate cable into a source osc targets that osc; into a processor (filter,
 * amp) it traces the audio chain back to the feeding oscillators.
 */
export function resolveAffectedOscs(
  moduleId: string,
  doc: PatchDoc,
  provider: ModuleInfoProvider,
  oscMap: Record<string, number[]>,
  visited: Set<string> = new Set(),
): number[] {
  if (visited.has(moduleId)) return [];
  visited.add(moduleId);
  const module = doc.modules.find((m) => m.id === moduleId);
  if (!module) return [];
  const info = provider(module.type);
  if (!info) return [];

  if (OSC_ROLES.has(info.role) || info.role === 'voice') {
    return oscMap[moduleId] ?? [];
  }
  if (PROCESSOR_ROLES.has(info.role)) {
    const oscs: number[] = [];
    for (const cable of doc.cables) {
      if (cable.to.module === moduleId && cable.kind === 'audio') {
        oscs.push(...resolveAffectedOscs(cable.from.module, doc, provider, oscMap, visited));
      }
    }
    return oscs;
  }
  return [];
}

export function allocate(
  doc: PatchDoc,
  provider: ModuleInfoProvider,
  previous?: Allocation,
): AllocationResult {
  const errors: AllocationError[] = [];
  const warnings: string[] = [];

  // --- oscillator allocation (stable: reuse previous, else lowest free) ---
  const oscModules = doc.modules
    .filter((m) => {
      const role = provider(m.type)?.role;
      return role !== undefined && OSC_ROLES.has(role);
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const oscMap: Record<string, number[]> = {};
  const usedOscs = new Set<number>();
  if (previous) {
    for (const m of oscModules) {
      const prev = previous.oscMap[m.id];
      if (prev && prev.every((n) => !usedOscs.has(n))) {
        oscMap[m.id] = [...prev];
        prev.forEach((n) => usedOscs.add(n));
      }
    }
  }
  for (const m of oscModules) {
    if (oscMap[m.id]) continue;
    const n = lowestFree(usedOscs);
    oscMap[m.id] = [n];
    usedOscs.add(n);
  }

  // --- synth allocation for preset voices ---
  const voiceModules = doc.modules
    .filter((m) => provider(m.type)?.role === 'voice')
    .sort((a, b) => a.id.localeCompare(b.id));
  const synthMap: Record<string, number> = {};
  const usedSynths = new Set<number>();
  let nextSynth = 1;
  for (const m of voiceModules) {
    const prev = previous?.synthMap[m.id];
    if (prev !== undefined && !usedSynths.has(prev)) {
      synthMap[m.id] = prev;
      usedSynths.add(prev);
    }
  }
  for (const m of voiceModules) {
    if (synthMap[m.id] !== undefined) continue;
    while (usedSynths.has(nextSynth) && nextSynth < 32) nextSynth++;
    synthMap[m.id] = nextSynth;
    usedSynths.add(nextSynth);
  }

  // --- constraint validation: envelope & modulation slots per osc ---
  const envCount = new Map<number, string[]>(); // osc -> env module ids
  const modCount = new Map<number, string[]>(); // osc -> lfo module ids

  for (const cable of doc.cables) {
    if (cable.kind !== 'cv') continue;
    const sourceRole = provider(
      doc.modules.find((m) => m.id === cable.from.module)?.type ?? '',
    )?.role;
    if (sourceRole !== 'env' && sourceRole !== 'lfo') continue;
    const oscs = resolveAffectedOscs(cable.to.module, doc, provider, oscMap);
    const bucket = sourceRole === 'env' ? envCount : modCount;
    for (const osc of oscs) {
      const list = bucket.get(osc) ?? [];
      if (!list.includes(cable.from.module)) list.push(cable.from.module);
      bucket.set(osc, list);
    }
  }

  for (const [osc, envs] of envCount) {
    if (envs.length > 2) {
      errors.push({
        module: envs[2] ?? envs[0] ?? '',
        message: `AMY supports 2 envelopes per oscillator; oscillator ${osc} has ${envs.length}`,
      });
    }
  }
  for (const [osc, lfos] of modCount) {
    if (lfos.length > 1) {
      errors.push({
        module: lfos[1] ?? lfos[0] ?? '',
        message: `an oscillator can have only one modulation source; oscillator ${osc} has ${lfos.length}`,
      });
    }
  }

  return { allocation: { oscMap, synthMap }, errors, warnings };
}
