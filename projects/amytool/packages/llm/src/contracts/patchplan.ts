/**
 * PatchPlan contract (docs/05 §2) — the constrained JSON the LLM targets instead
 * of free-form Python. It is deliberately smaller than a PatchDoc: no positions
 * (auto-layout assigns them), no allocation, no meta bookkeeping. `planToDoc`
 * (see ../plan.ts) lifts a validated plan into a full PatchDoc.
 */
import { z } from 'zod';

export const PATCHPLAN_CONTRACT = 'patchplan.v1';

const planModuleSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, 'module ids are lowercase identifiers'),
  type: z.string().regex(/^(core|group|user)\.[a-z0-9_.]+$/, 'a catalog module id like core.vco'),
  params: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

/** `"vco1.out"` — a `module.jack` reference. */
const jackRefString = z
  .string()
  .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, 'a "module.jack" reference like vco1.out');

const planCableSchema = z.object({
  from: jackRefString,
  to: jackRefString,
});

const planEffectsSchema = z
  .object({
    reverb: z.object({ level: z.number() }).passthrough().optional(),
    chorus: z.object({ level: z.number() }).passthrough().optional(),
    echo: z.object({ level: z.number() }).passthrough().optional(),
    eq: z.object({ low: z.number(), mid: z.number(), high: z.number() }).optional(),
  })
  .optional();

export const patchPlanSchema = z.object({
  contract: z.literal(PATCHPLAN_CONTRACT),
  name: z.string().min(1).default('Generated Patch'),
  modules: z.array(planModuleSchema).min(1, 'a patch needs at least one module'),
  cables: z.array(planCableSchema).default([]),
  globals: z
    .object({
      effects: planEffectsSchema,
      tempo: z.number().positive().optional(),
      volume: z.number().min(0).optional(),
    })
    .optional(),
  io: z.object({ midiChannel: z.number().int().min(1).max(16).optional() }).optional(),
  /** Escape hatch for behavior beyond PatchDoc semantics (docs/05 §2). */
  loopCode: z.string().optional(),
  notes: z.string().default(''),
});

export type PatchPlan = z.infer<typeof patchPlanSchema>;
export type PatchPlanModule = z.infer<typeof planModuleSchema>;
export type PatchPlanCable = z.infer<typeof planCableSchema>;

/** Parse a `module.jack` reference into its parts. */
export function parseJackRef(ref: string): { module: string; jack: string } {
  const dot = ref.indexOf('.');
  return { module: ref.slice(0, dot), jack: ref.slice(dot + 1) };
}
