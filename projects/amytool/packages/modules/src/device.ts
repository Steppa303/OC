/**
 * DeviceManifest (docs/07 P6-03, docs/03 §5.4) — the contract a follow-up LLM
 * call targets to turn `extras.userLoopCode` into a native Device Module panel:
 * tweakable numeric parameters bound to top-level Python variables in the sketch,
 * plus jacks for the panel. Validated like any manifest; the canvas renders a
 * `core.device` instance from the manifest embedded in its `state.device`, and
 * knob changes write the bound variable back into the running sketch.
 */
import { z } from 'zod';
import {
  HP_MAX,
  jackKindSchema,
  moduleManifestSchema,
  type ModuleManifest,
} from './schema';

/** Module instance type carrying an embedded DeviceManifest in `state.device`. */
export const DEVICE_MODULE_TYPE = 'core.device';

/** Names a param binding may never shadow (sketch API / entry points). */
const RESERVED_BINDINGS = new Set(['amy', 'amyboard', 'loop', 'json', 'sys', 'math', 'random', 'time']);

const PY_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const deviceParamSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*$/, 'param id must be a lowercase identifier'),
    label: z.string().min(1),
    min: z.number(),
    max: z.number(),
    default: z.number(),
    /** Top-level Python variable in the loop code this knob writes to. */
    binding: z.string().regex(PY_IDENT_RE, 'binding must be a Python identifier'),
    unit: z.string().optional(),
    scale: z.enum(['lin', 'log']).optional(),
  })
  .superRefine((p, ctx) => {
    if (!(p.min < p.max)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['max'], message: `param '${p.id}' needs min < max` });
    }
    if (p.default < p.min || p.default > p.max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['default'], message: `param '${p.id}' default must be within min..max` });
    }
    if (RESERVED_BINDINGS.has(p.binding)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['binding'], message: `binding '${p.binding}' is a reserved name` });
    }
  });

export const deviceJackSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, 'jack id must be a lowercase identifier'),
  kind: jackKindSchema,
  dir: z.enum(['in', 'out']),
  label: z.string().optional(),
});

export const deviceManifestSchema = z
  .object({
    contract: z.literal('devicemanifest.v1'),
    name: z.string().min(1),
    description: z.string().default(''),
    params: z.array(deviceParamSchema).min(1).max(8),
    jacks: z.array(deviceJackSchema).max(6).default([]),
  })
  .superRefine((d, ctx) => {
    const paramIds = new Set<string>();
    const bindings = new Set<string>();
    d.params.forEach((p, i) => {
      if (paramIds.has(p.id))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['params', i, 'id'], message: `duplicate param id '${p.id}'` });
      paramIds.add(p.id);
      if (bindings.has(p.binding))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['params', i, 'binding'], message: `duplicate binding '${p.binding}'` });
      bindings.add(p.binding);
    });
    const jackIds = new Set<string>();
    d.jacks.forEach((j, i) => {
      if (jackIds.has(j.id))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['jacks', i, 'id'], message: `duplicate jack id '${j.id}'` });
      jackIds.add(j.id);
    });
  });

export type DeviceManifest = z.infer<typeof deviceManifestSchema>;
export type DeviceParam = DeviceManifest['params'][number];

/**
 * Check every param binding is actually assigned at the top level of the loop
 * code (`name = …` at column 0) — the write-back path depends on the variable
 * existing in the sketch's globals. Returns human-readable errors.
 */
export function validateDeviceBindings(device: DeviceManifest, loopCode: string): string[] {
  const errors: string[] = [];
  for (const p of device.params) {
    const assigned = new RegExp(`^${p.binding}\\s*=[^=]`, 'm').test(loopCode);
    if (!assigned) {
      errors.push(`param '${p.id}': binding '${p.binding}' is not assigned at the top level of the code`);
    }
  }
  return errors;
}

/** Panel width for a device: grows with its control/jack count. */
export function deviceHp(device: DeviceManifest): number {
  return Math.min(HP_MAX, Math.max(8, 4 + device.params.length * 3 + device.jacks.length));
}

/**
 * Project a DeviceManifest onto a render-ready ModuleManifest (all params are
 * knobs). Passed through the module schema so a device panel obeys exactly the
 * same rules as any library module.
 */
export function deviceToManifest(device: DeviceManifest): ModuleManifest {
  return moduleManifestSchema.parse({
    manifestVersion: 1,
    id: DEVICE_MODULE_TYPE,
    name: device.name,
    category: 'fx',
    hp: deviceHp(device),
    description: device.description,
    role: 'custom',
    params: device.params.map((p) => ({
      id: p.id,
      label: p.label,
      control: 'knob',
      default: p.default,
      min: p.min,
      max: p.max,
      ...(p.unit !== undefined ? { unit: p.unit } : {}),
      ...(p.scale !== undefined ? { scale: p.scale } : {}),
      advanced: false,
    })),
    jacks: device.jacks.map((j) => ({
      id: j.id,
      kind: j.kind,
      dir: j.dir,
      ...(j.label !== undefined ? { label: j.label } : {}),
      advanced: false,
    })),
    displays: [],
    behavior: null,
  });
}

/** Read the DeviceManifest embedded in a module instance's state, if valid. */
export function deviceFromState(state: Record<string, unknown>): DeviceManifest | null {
  const parsed = deviceManifestSchema.safeParse(state['device']);
  return parsed.success ? parsed.data : null;
}

/** binding → current value map for a device instance's params. */
export function deviceBindingValues(
  device: DeviceManifest,
  params: Record<string, string | number | boolean>,
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const p of device.params) {
    const raw = params[p.id];
    values[p.binding] = typeof raw === 'number' && Number.isFinite(raw) ? raw : p.default;
  }
  return values;
}
