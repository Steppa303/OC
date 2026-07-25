/**
 * Verify → repair loop (docs/05 §4):
 *   raw text → strip fences → JSON.parse → zod contract → domain validation
 *   (catalog + manifest params + capability matrix + allocator dry-run) →
 *   compileToWire → optional headless render smoke test → accept.
 *
 * On any failure the exact machine errors are fed back to the same model as a
 * repair turn (max 3 attempts). Every stage is recorded in a trace for the UI.
 * The render smoke test is injected so unit tests run without the WASM engine
 * (it runs for real in the browser E2E, per the P0-05 no-Node-render decision).
 */
import { z } from 'zod';
import { allocate, compileToWire, evaluateConnection, type PatchDoc } from '@amy/patchdoc';
import { registry, type ModuleManifest } from '@amy/modules';
import { patchPlanSchema, parseJackRef, type PatchPlan } from './contracts/patchplan';
import { planToDoc, registryProvider, endpointFor } from './plan';
import { buildCatalog, catalogIds } from './catalog';
import { buildEditPatchMessages, buildGeneratePatchMessages, buildRepairMessages } from './prompts/patch';
import { stripFences, type ChatFn, type ChatMessage } from './chat';
import { checkPython } from './checks/python';

export type TraceStage =
  | 'request'
  | 'parse'
  | 'contract'
  | 'domain'
  | 'compile'
  | 'render'
  | 'accept';

export interface TraceEntry {
  attempt: number;
  stage: TraceStage;
  ok: boolean;
  detail?: string;
}
export type GenerationTrace = TraceEntry[];

export type GenerateResult =
  | {
      ok: true;
      doc: PatchDoc;
      plan: PatchPlan;
      notes: string;
      wire: string[];
      attempts: number;
      trace: GenerationTrace;
    }
  | { ok: false; error: string; errors: string[]; attempts: number; trace: GenerationTrace };

export interface RenderSmokeTest {
  (wire: string[], doc: PatchDoc): Promise<void>;
}

export interface GenerateOptions {
  prompt: string;
  chat: ChatFn;
  maxAttempts?: number;
  catalog?: string;
  manifests?: ModuleManifest[];
  /** Headless render check; throws on silence / NaN / engine error. Optional. */
  renderSmokeTest?: RenderSmokeTest;
  /** Called as each stage completes, for a live "generation trace" panel. */
  onTrace?: (entry: TraceEntry) => void;
  /** When set, the prompt is an *edit instruction* against this patch (docs/05 §3). */
  editBase?: PatchDoc;
}

interface PlanValidation {
  ok: boolean;
  doc?: PatchDoc;
  wire?: string[];
  errors: string[];
}

export async function generatePatch(options: GenerateOptions): Promise<GenerateResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const manifests = options.manifests ?? undefined;
  const catalog = options.catalog ?? buildCatalog(manifests);
  const ids = catalogIds(manifests);
  const trace: GenerationTrace = [];
  const emit = (entry: TraceEntry): void => {
    trace.push(entry);
    options.onTrace?.(entry);
  };

  let messages: ChatMessage[] = options.editBase
    ? buildEditPatchMessages(options.editBase, options.prompt, catalog)
    : buildGeneratePatchMessages(options.prompt, catalog);
  let lastErrors: string[] = ['generation did not run'];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    emit({ attempt, stage: 'request', ok: true });
    const raw = await options.chat(messages);

    // 1. parse JSON
    let json: unknown;
    try {
      json = JSON.parse(stripFences(raw));
      emit({ attempt, stage: 'parse', ok: true });
    } catch (err) {
      lastErrors = [`output was not valid JSON: ${errMsg(err)}`];
      emit({ attempt, stage: 'parse', ok: false, detail: lastErrors.join('; ') });
      messages = buildRepairMessages(messages, raw, lastErrors);
      continue;
    }

    // 2. contract (zod)
    const parsed = patchPlanSchema.safeParse(json);
    if (!parsed.success) {
      lastErrors = formatIssues(parsed.error);
      emit({ attempt, stage: 'contract', ok: false, detail: lastErrors.join('; ') });
      messages = buildRepairMessages(messages, raw, lastErrors);
      continue;
    }
    emit({ attempt, stage: 'contract', ok: true });
    const plan = parsed.data;

    // 3. domain validation + 4. compile
    const validation = validatePlan(plan, ids, options.prompt, options.editBase);
    if (!validation.ok || !validation.doc || !validation.wire) {
      lastErrors = validation.errors;
      emit({ attempt, stage: 'domain', ok: false, detail: lastErrors.join('; ') });
      messages = buildRepairMessages(messages, raw, lastErrors);
      continue;
    }
    emit({ attempt, stage: 'domain', ok: true });
    emit({ attempt, stage: 'compile', ok: true, detail: `${validation.wire.length} messages` });

    // 5. render smoke test (optional)
    if (options.renderSmokeTest) {
      try {
        await options.renderSmokeTest(validation.wire, validation.doc);
        emit({ attempt, stage: 'render', ok: true });
      } catch (err) {
        lastErrors = [`render check failed: ${errMsg(err)}`];
        emit({ attempt, stage: 'render', ok: false, detail: lastErrors.join('; ') });
        messages = buildRepairMessages(messages, raw, lastErrors);
        continue;
      }
    }

    emit({ attempt, stage: 'accept', ok: true });
    return {
      ok: true,
      doc: validation.doc,
      plan,
      notes: plan.notes,
      wire: validation.wire,
      attempts: attempt,
      trace,
    };
  }

  return {
    ok: false,
    error: `Couldn't generate a valid patch after ${maxAttempts} attempts. Try rephrasing or a different model.`,
    errors: lastErrors,
    attempts: maxAttempts,
    trace,
  };
}

/** Domain validation: catalog membership, manifest params, capability matrix,
 *  allocator dry-run, and deterministic compile. Never throws. */
export function validatePlan(
  plan: PatchPlan,
  ids: Set<string>,
  prompt?: string,
  base?: PatchDoc,
): PlanValidation {
  const errors: string[] = [];

  for (const m of plan.modules) {
    if (!ids.has(m.type)) {
      errors.push(`unknown module type '${m.type}' (id '${m.id}') — not in the catalog`);
      continue;
    }
    const manifest = registry.byId(m.type) as ModuleManifest;
    for (const [key, value] of Object.entries(m.params)) {
      const param = manifest.params.find((p) => p.id === key);
      if (!param) {
        errors.push(`module '${m.id}' (${m.type}) has no param '${key}'`);
        continue;
      }
      if (param.control === 'select' && !(param.options ?? []).includes(String(value))) {
        errors.push(`param '${m.id}.${key}' must be one of ${(param.options ?? []).join('|')}`);
      }
    }
  }

  const typeById = new Map(plan.modules.map((m) => [m.id, m.type]));
  const moduleIds = new Set(plan.modules.map((m) => m.id));
  for (const c of plan.cables) {
    const from = parseJackRef(c.from);
    const to = parseJackRef(c.to);
    if (!moduleIds.has(from.module)) errors.push(`cable from unknown module '${from.module}'`);
    if (!moduleIds.has(to.module)) errors.push(`cable to unknown module '${to.module}'`);
    const fromEp = moduleIds.has(from.module)
      ? endpointFor(typeById.get(from.module) ?? '', from.jack)
      : undefined;
    const toEp = moduleIds.has(to.module)
      ? endpointFor(typeById.get(to.module) ?? '', to.jack)
      : undefined;
    if (moduleIds.has(from.module) && !fromEp)
      errors.push(`module '${from.module}' has no jack '${from.jack}'`);
    if (moduleIds.has(to.module) && !toEp)
      errors.push(`module '${to.module}' has no jack '${to.jack}'`);
    if (fromEp && toEp) {
      const res = evaluateConnection(fromEp, toEp);
      if (!res.ok) errors.push(`cable ${c.from}→${c.to}: ${res.reason}`);
    }
  }

  // The escape-hatch loopCode is static-checked (no execution) before it's accepted.
  if (plan.loopCode !== undefined) {
    const py = checkPython(plan.loopCode);
    if (!py.ok) for (const e of py.errors) errors.push(`loopCode: ${e}`);
  }

  if (errors.length > 0) return { ok: false, errors };

  let doc: PatchDoc;
  try {
    doc = planToDoc(plan, {
      ...(prompt !== undefined ? { prompt } : {}),
      ...(base !== undefined ? { base } : {}),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, errors: formatIssues(err) };
    return { ok: false, errors: [errMsg(err)] };
  }

  const alloc = allocate(doc, registryProvider);
  if (alloc.errors.length > 0) {
    return { ok: false, errors: alloc.errors.map((e) => `${e.module}: ${e.message}`) };
  }

  const compiled = compileToWire(doc, registryProvider);
  if (compiled.errors.length > 0) {
    return { ok: false, errors: compiled.errors.map((e) => `${e.module}: ${e.message}`) };
  }

  return { ok: true, doc, wire: compiled.messages, errors: [] };
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
