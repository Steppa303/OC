/** Bridges the module registry into @amy/patchdoc's routing/allocator inputs. */
import { DEVICE_MODULE_TYPE, deviceFromState, INTERNAL_MODULE_IDS, registry, type ModuleManifest } from '@amy/modules';
import type { Endpoint, ModuleInfoProvider, ModuleInstance } from '@amy/patchdoc';

/** Library modules a given type can be swapped for (P7-02 replace-with-compatible):
 *  same role, not itself, not an internal type. Empty for unknown/internal types. */
export function compatibleModules(type: string): ModuleManifest[] {
  const manifest = registry.byId(type);
  if (!manifest || INTERNAL_MODULE_IDS.has(type)) return [];
  return registry
    .list()
    .filter((m) => m.role === manifest.role && m.id !== type && !INTERNAL_MODULE_IDS.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const moduleInfoProvider: ModuleInfoProvider = (type) => {
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
  };
};

/** Endpoint for a jack on a module *instance* — devices (P6-03) carry their
 *  jacks in the DeviceManifest embedded in state, not in the type manifest. */
export function endpointForModule(mod: ModuleInstance, jackId: string): Endpoint | undefined {
  if (mod.type === DEVICE_MODULE_TYPE) {
    const jack = deviceFromState(mod.state)?.jacks.find((j) => j.id === jackId);
    if (jack) return { role: 'custom', kind: jack.kind, dir: jack.dir };
  }
  return endpointForType(mod.type, jackId);
}

/** Build a capability Endpoint for a specific jack on a module type. */
export function endpointForType(type: string, jackId: string): Endpoint | undefined {
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
