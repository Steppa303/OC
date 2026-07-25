import { useCallback, useRef, useState } from 'react';
import {
  attachDeviceModule,
  extractDeviceManifest,
  generatePatch,
  loadSettings,
  modelForFeature,
  openRouterChat,
  type ChatFn,
  type GenerateResult,
  type TraceEntry,
} from '@amy/llm';
import type { PatchDoc } from '@amy/patchdoc';
import { usePatchStore } from '../patch/patchStore';
import { recordGeneration } from './feedback';

/** Test seam: an E2E can install a mock chat so the flow runs without a key. */
declare global {
  interface Window {
    __amyChat?: ChatFn;
  }
}

export type GenerateStatus = 'idle' | 'running' | 'done' | 'error';

export interface GenerateController {
  status: GenerateStatus;
  trace: TraceEntry[];
  result: GenerateResult | null;
  /** id of the stored feedback entry for the last accepted result. */
  feedbackId: string | null;
  error: string | null;
  run: (prompt: string) => Promise<void>;
  /** Edit the current patch by instruction, applied as one undoable step. */
  edit: (instruction: string) => Promise<void>;
  reset: () => void;
}

/**
 * Drives the LLM pipeline from the UI (P2-06): resolves the model + key from
 * settings (or a test-injected chat), streams the trace live, and loads an
 * accepted PatchDoc into the store so the canvas and code views both update.
 */
export function resolveChat(): ChatFn | null {
  const settings = loadSettings();
  return (
    window.__amyChat ??
    (settings.apiKey
      ? openRouterChat({
          apiKey: settings.apiKey,
          model: modelForFeature(settings, 'patch'),
          referer: window.location.origin,
          title: 'AmyPatch Studio',
        })
      : null)
  );
}

export function useGenerate(): GenerateController {
  const loadDoc = usePatchStore((s) => s.loadDoc);
  const replaceDoc = usePatchStore((s) => s.replaceDoc);
  const [status, setStatus] = useState<GenerateStatus>('idle');
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const reset = useCallback(() => {
    setStatus('idle');
    setTrace([]);
    setResult(null);
    setFeedbackId(null);
    setError(null);
  }, []);

  const execute = useCallback(
    async (prompt: string, editBase?: PatchDoc) => {
      if (running.current || prompt.trim() === '') return;
      running.current = true;
      setStatus('running');
      setTrace([]);
      setResult(null);
      setFeedbackId(null);
      setError(null);

      const chat = resolveChat();
      if (!chat) {
        setStatus('error');
        setError('Add an OpenRouter API key in Settings to generate patches.');
        running.current = false;
        return;
      }

      try {
        const res = await generatePatch({
          prompt,
          chat,
          onTrace: (entry) => setTrace((prev) => [...prev, entry]),
          ...(editBase ? { editBase } : {}),
        });
        setResult(res);
        if (res.ok) {
          // Device Module follow-up (P6-03): when the plan carried loopCode, a
          // second call extracts a native panel; on failure the code lands in
          // the plain Custom Code box instead — never a hard error.
          let doc = res.doc;
          const loopCode = doc.extras.userLoopCode;
          if (loopCode !== null && loopCode.trim() !== '') {
            const extraction = await extractDeviceManifest({
              prompt,
              loopCode,
              chat,
              onTrace: (entry) => setTrace((prev) => [...prev, entry]),
            });
            doc = attachDeviceModule(doc, extraction.ok ? extraction.device : null);
          }
          // A new patch resets history; an edit is one undoable step.
          if (editBase) replaceDoc(doc);
          else loadDoc(doc);
          setFeedbackId(recordGeneration(prompt, res.doc.meta.name, res.notes));
          setStatus('done');
        } else {
          setError(res.error);
          setStatus('error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      } finally {
        running.current = false;
      }
    },
    [loadDoc, replaceDoc],
  );

  const run = useCallback((prompt: string) => execute(prompt), [execute]);

  const edit = useCallback(
    (instruction: string) => {
      const base = usePatchStore.getState().doc;
      if (base.modules.length === 0) {
        setStatus('error');
        setError('Add or generate a patch first, then describe an edit.');
        return Promise.resolve();
      }
      return execute(instruction, base);
    },
    [execute],
  );

  return { status, trace, result, feedbackId, error, run, edit, reset };
}
