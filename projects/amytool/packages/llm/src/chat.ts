/**
 * OpenRouter chat-completions client (docs/05 §1). Kept behind a `ChatFn` type so
 * the pipeline can be driven with mocked responses in tests. Generation tasks use
 * a low fixed temperature and request a JSON object where the model supports it.
 */
import { OPENROUTER_BASE } from './openrouter';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** A function that takes chat messages and returns the model's raw text reply. */
export type ChatFn = (messages: ChatMessage[]) => Promise<string>;

export interface ChatOptions {
  apiKey: string;
  model: string;
  temperature?: number;
  /** App identity headers OpenRouter recommends. */
  referer?: string;
  title?: string;
  signal?: AbortSignal;
}

const chatResponseShape = (json: unknown): string | null => {
  const choices = (json as { choices?: { message?: { content?: unknown } }[] }).choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : null;
};

/** One-shot completion returning the assistant message text. */
export async function chatCompletion(messages: ChatMessage[], options: ChatOptions): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${options.apiKey}`,
  };
  if (options.referer) headers['HTTP-Referer'] = options.referer;
  if (options.title) headers['X-Title'] = options.title;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers,
    ...(options.signal ? { signal: options.signal } : {}),
    body: JSON.stringify({
      model: options.model,
      temperature: options.temperature ?? 0.2,
      response_format: { type: 'json_object' },
      messages,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter returned ${res.status} ${res.statusText}`);
  const json: unknown = await res.json();
  const content = chatResponseShape(json);
  if (content == null) throw new Error('OpenRouter response had no message content');
  return content;
}

/** Build a `ChatFn` bound to concrete OpenRouter options. */
export function openRouterChat(options: ChatOptions): ChatFn {
  return (messages) => chatCompletion(messages, options);
}

/**
 * Strip Markdown code fences and surrounding prose so a JSON object can be parsed
 * even from models that ignore "no markdown". Returns the substring from the first
 * `{` to its matching `}` when fences aren't present.
 */
export function stripFences(text: string): string {
  const trimmed = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const body = (fence ? fence[1] ?? '' : trimmed).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body;
}
