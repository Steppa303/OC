/**
 * Device Module pipeline (docs/07 P6-03). After codegen accepted a patch whose
 * `extras.userLoopCode` carries custom Python, a follow-up LLM call extracts a
 * DeviceManifest (verify→repair, max 3 attempts, same contract discipline as
 * docs/05). On success the doc gets a native `core.device` panel; on failure it
 * falls back to the plain Custom Code box — never a hard error.
 */
import {
  DEVICE_MODULE_TYPE,
  deviceManifestSchema,
  validateDeviceBindings,
  type DeviceManifest,
} from '@amy/modules';
import { CUSTOM_CODE_TYPE, patchDocSchema, type ModuleInstance, type PatchDoc } from '@amy/patchdoc';
import { buildDeviceRepairMessages, buildExtractDeviceMessages } from './prompts/device';
import { stripFences, type ChatFn, type ChatMessage } from './chat';
import type { GenerationTrace, TraceEntry } from './pipeline';

export type DeviceExtractResult =
  | { ok: true; device: DeviceManifest; attempts: number; trace: GenerationTrace }
  | { ok: false; error: string; errors: string[]; attempts: number; trace: GenerationTrace };

export interface ExtractDeviceOptions {
  /** The user's original request, for naming/range context. */
  prompt: string;
  /** The accepted patch's `extras.userLoopCode`. */
  loopCode: string;
  chat: ChatFn;
  maxAttempts?: number;
  onTrace?: (entry: TraceEntry) => void;
}

export async function extractDeviceManifest(options: ExtractDeviceOptions): Promise<DeviceExtractResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const trace: GenerationTrace = [];
  const emit = (entry: TraceEntry) => {
    trace.push(entry);
    options.onTrace?.(entry);
  };
  let messages: ChatMessage[] = buildExtractDeviceMessages(options.prompt, options.loopCode);
  let lastErrors: string[] = ['extraction did not run'];

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
      messages = buildDeviceRepairMessages(messages, raw, lastErrors);
      continue;
    }

    const result = validateDevice(json, options.loopCode);
    if (!result.ok || !result.device) {
      lastErrors = result.errors;
      emit({ attempt, stage: 'domain', ok: false, detail: lastErrors.join('; ') });
      messages = buildDeviceRepairMessages(messages, raw, lastErrors);
      continue;
    }
    emit({ attempt, stage: 'domain', ok: true });
    emit({ attempt, stage: 'accept', ok: true });
    return { ok: true, device: result.device, attempts: attempt, trace };
  }

  return {
    ok: false,
    error: `Couldn't extract a device panel after ${maxAttempts} attempts — keeping the Custom Code box.`,
    errors: lastErrors,
    attempts: maxAttempts,
    trace,
  };
}

export function validateDevice(
  json: unknown,
  loopCode: string,
): { ok: boolean; device?: DeviceManifest; errors: string[] } {
  const parsed = deviceManifestSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const bindingErrors = validateDeviceBindings(parsed.data, loopCode);
  if (bindingErrors.length > 0) return { ok: false, errors: bindingErrors };
  return { ok: true, device: parsed.data, errors: [] };
}

/** Column step used by the plan auto-layout (plan.ts) — devices join at the right edge. */
const COL_HP = 12;

/**
 * Append a canvas module for the doc's loop code: a native `core.device` panel
 * when a manifest was extracted, else the plain Custom Code fallback. Returns
 * the doc unchanged when it has no loop code. Pure; result re-validated.
 */
export function attachDeviceModule(doc: PatchDoc, device: DeviceManifest | null): PatchDoc {
  const loopCode = doc.extras.userLoopCode;
  if (loopCode === null || loopCode.trim() === '') return doc;

  const taken = new Set(doc.modules.map((m) => m.id));
  const uniqueId = (stem: string): string => {
    for (let n = 1; ; n++) {
      const id = `${stem}${n}`;
      if (!taken.has(id)) return id;
    }
  };
  const x = doc.modules.reduce((max, m) => Math.max(max, m.pos.x), -COL_HP) + COL_HP;

  const instance: ModuleInstance = device
    ? {
        id: uniqueId('device'),
        type: DEVICE_MODULE_TYPE,
        label: device.name,
        pos: { x, y: 0 },
        params: Object.fromEntries(device.params.map((p) => [p.id, p.default])),
        advanced: false,
        state: { device, code: loopCode },
      }
    : {
        id: uniqueId('code'),
        type: CUSTOM_CODE_TYPE,
        label: 'Custom Code',
        pos: { x, y: 0 },
        params: {},
        advanced: false,
        state: { code: loopCode },
      };

  return patchDocSchema.parse({ ...doc, modules: [...doc.modules, instance] });
}
