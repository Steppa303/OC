/**
 * CATALOG builder (docs/05 §3). Renders the live module library into a compact
 * text listing injected into the prompt, so the model only ever sees module
 * types + params + jacks that actually exist in this build. Regenerated at
 * prompt-build time from the registry.
 */
import { INTERNAL_MODULE_IDS, registry, type ModuleManifest, type ModuleParam, type ModuleJack } from '@amy/modules';

function paramSpec(p: ModuleParam): string {
  let range = '';
  if (p.options && p.options.length > 0) range = `[${p.options.join('|')}]`;
  else if (p.min !== undefined && p.max !== undefined) range = `(${p.min}..${p.max})`;
  return `${p.id}${range}=${JSON.stringify(p.default)}`;
}

function jackSpec(j: ModuleJack): string {
  return `${j.id}(${j.kind},${j.dir})`;
}

function moduleLine(m: ModuleManifest): string {
  const params = m.params.length > 0 ? ` params: ${m.params.map(paramSpec).join(' ')}` : '';
  const jacks = m.jacks.length > 0 ? ` jacks: ${m.jacks.map(jackSpec).join(' ')}` : '';
  return `- ${m.id} (${m.category}):${params}${jacks}`;
}

/** Modules the LLM is allowed to place. Excludes internal types (Custom Code residue, generated devices). */
export function catalogManifests(): ModuleManifest[] {
  return registry.list().filter((m) => !INTERNAL_MODULE_IDS.has(m.id));
}

/** The compact CATALOG text block for the prompt. */
export function buildCatalog(manifests: ModuleManifest[] = catalogManifests()): string {
  return manifests.map(moduleLine).join('\n');
}

/** The set of module ids the model may use — for fast domain validation. */
export function catalogIds(manifests: ModuleManifest[] = catalogManifests()): Set<string> {
  return new Set(manifests.map((m) => m.id));
}
