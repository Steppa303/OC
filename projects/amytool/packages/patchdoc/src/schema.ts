/**
 * PatchDoc v1 — the canonical patch model (docs/03 §1–2).
 * Everything else (canvas, sketch, wire messages) is a projection of this.
 */
import { z } from 'zod';

export const PATCHDOC_VERSION = 1;

export const jackKindSchema = z.enum(['audio', 'cv', 'gate', 'midi']);
export type JackKind = z.infer<typeof jackKindSchema>;

export const jackRefSchema = z.object({
  module: z.string().min(1),
  jack: z.string().min(1),
});
export type JackRef = z.infer<typeof jackRefSchema>;

export const cableSchema = z.object({
  id: z.string().min(1),
  from: jackRefSchema,
  to: jackRefSchema,
  kind: jackKindSchema,
});
export type Cable = z.infer<typeof cableSchema>;

export const moduleInstanceSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, 'module ids are lowercase identifiers'),
  type: z.string().regex(/^(core|group|user)\.[a-z0-9_.]+$/, 'manifest id like core.vco'),
  label: z.string().min(1),
  pos: z.object({ x: z.number(), y: z.number() }),
  params: z.record(z.union([z.string(), z.number(), z.boolean()])),
  advanced: z.boolean().default(false),
  state: z.record(z.unknown()).default({}),
  /** Optional user color tag (P7-02). A token name like 'accent' or a hex value;
   *  purely cosmetic, so old docs without it stay valid. */
  color: z.string().optional(),
});
export type ModuleInstance = z.infer<typeof moduleInstanceSchema>;

export const effectsSchema = z.object({
  reverb: z.object({ level: z.number(), liveness: z.number().optional(), damping: z.number().optional(), xover: z.number().optional() }).optional(),
  chorus: z.object({ level: z.number(), maxDelay: z.number().optional(), lfoFreq: z.number().optional(), depth: z.number().optional() }).optional(),
  echo: z.object({ level: z.number(), delayMs: z.number().optional(), maxDelayMs: z.number().optional(), feedback: z.number().optional(), filterCoef: z.number().optional() }).optional(),
  eq: z.object({ low: z.number(), mid: z.number(), high: z.number() }).optional(),
});

export const cvInModeSchema = z.enum(['1voct', 'linear', 'trigger']);

export const ioSchema = z.object({
  midiChannel: z.number().int().min(1).max(16).default(1),
  cvIn: z
    .array(z.object({ channel: z.union([z.literal(0), z.literal(1)]), mode: cvInModeSchema }))
    .max(2)
    .default([]),
  cvOut: z
    .array(
      z.object({
        channel: z.union([z.literal(0), z.literal(1)]),
        source: z.enum(['synthAudio', 'voltage']),
      }),
    )
    .max(2)
    .default([]),
});

export const allocationSchema = z.object({
  oscMap: z.record(z.array(z.number().int().nonnegative())).default({}),
  synthMap: z.record(z.number().int().min(0).max(31)).default({}),
});

export const metaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  modifiedAt: z.string().datetime(),
  origin: z.enum(['llm', 'manual', 'board-import', 'code-paste', 'group-template']),
  prompt: z.string().optional(),
});

export const patchDocSchema = z
  .object({
    version: z.literal(PATCHDOC_VERSION),
    meta: metaSchema,
    modules: z.array(moduleInstanceSchema),
    cables: z.array(cableSchema),
    globals: z
      .object({
        effects: effectsSchema.default({}),
        tempo: z.number().positive().default(108),
        volume: z.number().min(0).default(0.8),
      })
      .default({ effects: {}, tempo: 108, volume: 0.8 }),
    io: ioSchema.default({ midiChannel: 1, cvIn: [], cvOut: [] }),
    allocation: allocationSchema.default({ oscMap: {}, synthMap: {} }),
    extras: z
      .object({
        unmappedWire: z.array(z.string()).default([]),
        userLoopCode: z.string().nullable().default(null),
      })
      .default({ unmappedWire: [], userLoopCode: null }),
  })
  .superRefine((doc, ctx) => {
    // Structural invariants that don't need module manifests
    // (jack-level validation against manifests lands with the registry, P1-02).
    const ids = new Set<string>();
    doc.modules.forEach((m, i) => {
      if (ids.has(m.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['modules', i, 'id'],
          message: `duplicate module id '${m.id}'`,
        });
      }
      ids.add(m.id);
    });
    const cableIds = new Set<string>();
    const inputsSeen = new Set<string>();
    doc.cables.forEach((c, i) => {
      if (cableIds.has(c.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cables', i, 'id'],
          message: `duplicate cable id '${c.id}'`,
        });
      }
      cableIds.add(c.id);
      for (const end of ['from', 'to'] as const) {
        if (!ids.has(c[end].module)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['cables', i, end, 'module'],
            message: `cable '${c.id}' references unknown module '${c[end].module}'`,
          });
        }
      }
      // one cable per input jack, except midi inputs which merge (docs/03 §2)
      const inputKey = `${c.to.module}.${c.to.jack}`;
      if (c.kind !== 'midi' && inputsSeen.has(inputKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cables', i, 'to'],
          message: `input jack '${inputKey}' already has a cable`,
        });
      }
      inputsSeen.add(inputKey);
    });
  });

export type PatchDoc = z.infer<typeof patchDocSchema>;

export function createEmptyPatch(name = 'Untitled Patch'): PatchDoc {
  const now = new Date().toISOString();
  return patchDocSchema.parse({
    version: PATCHDOC_VERSION,
    meta: {
      id: crypto.randomUUID(),
      name,
      tags: [],
      createdAt: now,
      modifiedAt: now,
      origin: 'manual',
    },
    modules: [],
    cables: [],
  });
}
