/** OpenRouter model catalog client (docs/05 §1). */
import { z } from 'zod';

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const modelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  context_length: z.number().nullish(),
  pricing: z
    .object({ prompt: z.string().nullish(), completion: z.string().nullish() })
    .nullish(),
});

const modelsResponseSchema = z.object({ data: z.array(modelSchema) });

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number | null;
  /** USD per token, as reported by OpenRouter (may be "0"). */
  promptPrice: number | null;
  completionPrice: number | null;
}

export class OpenRouterError extends Error {}

/** Fetch the available models. The catalog is public; the key is sent when
 *  present so private/enabled models appear. */
export async function fetchModels(apiKey?: string): Promise<OpenRouterModel[]> {
  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE}/models`, { headers });
  } catch (err) {
    throw new OpenRouterError(`network error contacting OpenRouter: ${String(err)}`);
  }
  if (!res.ok) throw new OpenRouterError(`OpenRouter returned ${res.status} ${res.statusText}`);

  const json: unknown = await res.json();
  const parsed = modelsResponseSchema.safeParse(json);
  if (!parsed.success) throw new OpenRouterError('unexpected model list shape from OpenRouter');

  return parsed.data.data
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length ?? null,
      promptPrice: m.pricing?.prompt != null ? Number(m.pricing.prompt) : null,
      completionPrice: m.pricing?.completion != null ? Number(m.pricing.completion) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Human-readable price per million prompt tokens, or 'free'/'—'. */
export function formatPrice(perToken: number | null): string {
  if (perToken == null) return '—';
  if (perToken === 0) return 'free';
  return `$${(perToken * 1_000_000).toFixed(2)}/M`;
}
