/**
 * ModuleManifestV1 — the contract for library modules (docs/04 §3). Both our
 * core modules and LLM-generated modules validate against this. The zod schema
 * enforces the rules the design system + LLM prompt promise: amyParam must exist
 * in the protocol table, controls carry the fields their kind needs, ids are
 * unique, hp is in range.
 */
import { z } from 'zod';
import { PARAM_BY_NAME } from '@amy/protocol';

export const MODULE_CATEGORIES = [
  'source',
  'filter',
  'envelope',
  'modulation',
  'mixer',
  'fx',
  'io',
  'sequencer',
  'display',
  'voice',
] as const;
export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export const MODULE_ROLES = [
  'vco',
  'vcf',
  'env',
  'lfo',
  'vca',
  'fx',
  'io',
  'seq',
  'voice',
  'custom',
] as const;
export type ModuleRole = (typeof MODULE_ROLES)[number];

export const jackKindSchema = z.enum(['audio', 'cv', 'gate', 'midi']);
export const paramControlSchema = z.enum(['knob', 'select', 'toggle', 'slider']);
export const displayKindSchema = z.enum(['scope', 'value', 'text']);

export const HP_MIN = 4;
export const HP_MAX = 24;

const manifestParamSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'param id must be a lowercase identifier'),
    label: z.string().min(1),
    control: paramControlSchema,
    default: z.union([z.string(), z.number(), z.boolean()]),
    options: z.array(z.string()).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    scale: z.enum(['lin', 'log']).optional(),
    unit: z.string().optional(),
    /** Corresponding AMY param name — must exist in @amy/protocol if present. */
    amyParam: z.string().optional(),
    advanced: z.boolean().default(false),
  })
  .superRefine((p, ctx) => {
    if (p.amyParam !== undefined && !PARAM_BY_NAME.has(p.amyParam)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amyParam'],
        message: `unknown AMY param '${p.amyParam}' (not in @amy/protocol params table)`,
      });
    }
    if (p.control === 'select' && (!p.options || p.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: `select control '${p.id}' needs options`,
      });
    }
    if ((p.control === 'knob' || p.control === 'slider') && (p.min === undefined || p.max === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['min'],
        message: `${p.control} control '${p.id}' needs min and max`,
      });
    }
    if (p.scale === 'log' && p.min !== undefined && p.min <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['min'],
        message: `log-scale param '${p.id}' needs min > 0`,
      });
    }
  });

const manifestJackSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, 'jack id must be a lowercase identifier'),
  kind: jackKindSchema,
  dir: z.enum(['in', 'out']),
  /** Display label; falls back to the id when omitted. */
  label: z.string().optional(),
  /** For cv/gate inputs: which target param the cable modulates. */
  target: z.string().optional(),
  /** Node-layout hint (Stufe 2): render this jack's pin on the given param's
   *  row instead of as a standalone jack row (Blender-style per-control pin). */
  param: z.string().optional(),
  advanced: z.boolean().default(false),
});

const manifestDisplaySchema = z.object({
  id: z.string().min(1),
  kind: displayKindSchema,
  /** Jack or param id the display reads from. */
  source: z.string(),
});

export const moduleManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    id: z.string().regex(/^(core|group|user)\.[a-z0-9_.]+$/, 'id like core.vco'),
    name: z.string().min(1),
    category: z.enum(MODULE_CATEGORIES),
    hp: z.number().int().min(HP_MIN).max(HP_MAX),
    advancedHp: z.number().int().min(HP_MIN).max(HP_MAX).optional(),
    description: z.string().default(''),
    params: z.array(manifestParamSchema).default([]),
    jacks: z.array(manifestJackSchema).default([]),
    displays: z.array(manifestDisplaySchema).default([]),
    role: z.enum(MODULE_ROLES),
    voice: z.object({ patchRange: z.tuple([z.number(), z.number()]) }).optional(),
    sequencer: z
      .object({
        tracks: z.number().int().positive(),
        steps: z.number().int().positive(),
        trackDefaults: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
      })
      .optional(),
    behavior: z.object({ script: z.string() }).nullable().default(null),
  })
  .superRefine((m, ctx) => {
    const paramIds = new Set<string>();
    m.params.forEach((p, i) => {
      if (paramIds.has(p.id))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['params', i, 'id'], message: `duplicate param id '${p.id}'` });
      paramIds.add(p.id);
    });
    const jackIds = new Set<string>();
    m.jacks.forEach((j, i) => {
      if (jackIds.has(j.id))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['jacks', i, 'id'], message: `duplicate jack id '${j.id}'` });
      jackIds.add(j.id);
    });
    if (m.advancedHp !== undefined && m.advancedHp < m.hp) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['advancedHp'], message: 'advancedHp must be >= hp' });
    }
  });

export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export type ModuleParam = ModuleManifest['params'][number];
export type ModuleJack = ModuleManifest['jacks'][number];

/** Jack label, falling back to the uppercased id. */
export function jackLabel(jack: ModuleJack): string {
  return jack.label ?? jack.id.toUpperCase();
}

/** Default param values for a fresh instance of this module. */
export function moduleDefaultParams(
  manifest: ModuleManifest,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const p of manifest.params) params[p.id] = p.default;
  return params;
}

/** Validate a manifest, throwing a readable error on failure. */
export function parseManifest(raw: unknown): ModuleManifest {
  return moduleManifestSchema.parse(raw);
}
