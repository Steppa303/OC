import { createContext, useContext, useCallback, useRef, useState, useEffect, type ReactNode } from 'react';
import { amySend } from './wireMessage';
import type { AMYParams } from '../lib/types';

interface AMYContextType {
  ready: boolean;
  error: string | null;
  start: () => Promise<void>;
  send: (params: AMYParams) => void;
  reset: () => void;
  activeNotes: Set<number>;
}

const AMYContext = createContext<AMYContextType | null>(null);

export function AMYProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const activeNotes = useRef(new Set<number>());

  // AudioContext suspend/resume handling
  useEffect(() => {
    const handleTouch = () => {
      const ctx = (window as any).__amy_audio_context as AudioContext | undefined;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };
    document.addEventListener('touchstart', handleTouch);
    document.addEventListener('click', handleTouch);
    return () => {
      document.removeEventListener('touchstart', handleTouch);
      document.removeEventListener('click', handleTouch);
    };
  }, []);

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setError(null);

    try {
      const w = window as any;

      // Warten bis amy_js_start verfügbar ist (max 5s)
      let waited = 0;
      while (typeof w.amy_js_start !== 'function' && waited < 50) {
        await new Promise(r => setTimeout(r, 100));
        waited++;
      }
      if (typeof w.amy_js_start !== 'function') {
        throw new Error('AMY Scripts nicht geladen (amy.js fehlt)');
      }

      // AMY starten: Initialisiert AudioContext + WASM AudioWorklet
      await w.amy_js_start();

      setReady(true);
    } catch (e: any) {
      console.error('AMY Init failed:', e);
      setError(e.message || 'AMY Initialisierung fehlgeschlagen');
      startedRef.current = false;
    }
  }, []);

  const send = useCallback((params: AMYParams) => {
    if (!ready) return;
    amySend(params);
  }, [ready]);

  const reset = useCallback(() => {
    const w = window as any;
    if (typeof w.amy_js_reset === 'function') {
      w.amy_js_reset();
    }
    activeNotes.current.clear();
  }, []);

  const value: AMYContextType = {
    ready,
    error,
    start,
    send,
    reset,
    activeNotes: activeNotes.current,
  };

  return (
    <AMYContext.Provider value={value}>
      {children}
    </AMYContext.Provider>
  );
}

export function useAMY(): AMYContextType {
  const ctx = useContext(AMYContext);
  if (!ctx) throw new Error('useAMY must be used within AMYProvider');
  return ctx;
}