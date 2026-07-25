import { useCallback, useRef, useState } from 'react';
import { generateModule, type ModuleGenerateResult, type TraceEntry } from '@amy/llm';
import { resolveChat } from '../llm/useGenerate';

export type ModuleGenStatus = 'idle' | 'running' | 'done' | 'error';

export interface ModuleGenController {
  status: ModuleGenStatus;
  trace: TraceEntry[];
  result: ModuleGenerateResult | null;
  error: string | null;
  run: (prompt: string) => Promise<void>;
  reset: () => void;
}

/** Drives the LLM module-generation pipeline from the library UI (P5-06). */
export function useGenerateModule(): ModuleGenController {
  const [status, setStatus] = useState<ModuleGenStatus>('idle');
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [result, setResult] = useState<ModuleGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const reset = useCallback(() => {
    setStatus('idle');
    setTrace([]);
    setResult(null);
    setError(null);
  }, []);

  const run = useCallback(async (prompt: string) => {
    if (running.current || prompt.trim() === '') return;
    running.current = true;
    setStatus('running');
    setTrace([]);
    setResult(null);
    setError(null);

    const chat = resolveChat();
    if (!chat) {
      setStatus('error');
      setError('Add an OpenRouter API key in Settings to generate modules.');
      running.current = false;
      return;
    }
    try {
      const res = await generateModule({ prompt, chat, onTrace: (e) => setTrace((prev) => [...prev, e]) });
      setResult(res);
      if (res.ok) setStatus('done');
      else {
        setError(res.error);
        setStatus('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    } finally {
      running.current = false;
    }
  }, []);

  return { status, trace, result, error, run, reset };
}
