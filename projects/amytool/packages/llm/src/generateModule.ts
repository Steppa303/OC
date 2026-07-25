/**
 * generateModule pipeline (docs/05 §5) — verify→repair loop targeting a
 * ModuleManifestV1. Validates against the module schema, enforces the `user.*`
 * id namespace, and statically screens any `behavior.script` for forbidden APIs.
 */
import { moduleManifestSchema, type ModuleManifest } from '@amy/modules';
import { buildGenerateModuleMessages, buildModuleRepairMessages } from './prompts/module';
import { stripFences, type ChatFn, type ChatMessage } from './chat';
import type { GenerationTrace, TraceEntry } from './pipeline';

/** Script APIs a generated behavior.script must not reference (mirrors the sandbox). */
const SCRIPT_FORBIDDEN = ['fetch', 'importScripts', 'XMLHttpRequest', 'WebSocket', 'eval', 'Function', 'require', 'document', 'window'];

export type ModuleGenerateResult =
  | { ok: true; manifest: ModuleManifest; attempts: number; trace: GenerationTrace }
  | { ok: false; error: string; errors: string[]; attempts: number; trace: GenerationTrace };

export interface GenerateModuleOptions {
  prompt: string;
  chat: ChatFn;
  maxAttempts?: number;
  onTrace?: (entry: TraceEntry) => void;
}

export async function generateModule(options: GenerateModuleOptions): Promise<ModuleGenerateResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const trace: GenerationTrace = [];
  const emit = (entry: TraceEntry) => {
    trace.push(entry);
    options.onTrace?.(entry);
  };
  let messages: ChatMessage[] = buildGenerateModuleMessages(options.prompt);
  let lastErrors: string[] = ['generation did not run'];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    emit({ attempt, stage: 'request', ok: true });
    const raw = await options.chat(messages);

    let json: unknown;
    try {
      json = JSON.parse(stripFences(raw));
      emit({ attempt, stage: 'parse', ok: true });
    } catch (err) {
      lastErrors = [`output was not valid JSON: ${err instanceof Error ? err.message : String(err)}`];
      emit({ attempt, stage: 'parse', ok: false, detail: lastErrors.join('; ') });
      messages = buildModuleRepairMessages(messages, raw, lastErrors);
      continue;
    }

    const result = validateModule(json);
    if (!result.ok || !result.manifest) {
      lastErrors = result.errors;
      emit({ attempt, stage: 'domain', ok: false, detail: lastErrors.join('; ') });
      messages = buildModuleRepairMessages(messages, raw, lastErrors);
      continue;
    }
    emit({ attempt, stage: 'domain', ok: true });
    emit({ attempt, stage: 'accept', ok: true });
    return { ok: true, manifest: result.manifest, attempts: attempt, trace };
  }

  return {
    ok: false,
    error: `Couldn't generate a valid module after ${maxAttempts} attempts. Try rephrasing or a different model.`,
    errors: lastErrors,
    attempts: maxAttempts,
    trace,
  };
}

export function validateModule(json: unknown): { ok: boolean; manifest?: ModuleManifest; errors: string[] } {
  const parsed = moduleManifestSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  }
  const manifest = parsed.data;
  const errors: string[] = [];
  if (!manifest.id.startsWith('user.')) errors.push(`module id must start with "user." (got "${manifest.id}")`);
  if (manifest.behavior) {
    for (const name of SCRIPT_FORBIDDEN) {
      if (new RegExp(`\\b${name}\\b`).test(manifest.behavior.script)) {
        errors.push(`behavior.script uses forbidden api '${name}'`);
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest, errors: [] };
}
