import { useEffect, useRef, useState } from 'react';
import { Display } from '@amy/ui';
import { useEngine } from './engine';

/**
 * Live oscilloscope (P4-04, Milestone M4). Taps the engine output at ~30 fps,
 * downsamples one channel to a waveform, and pauses when scrolled offscreen
 * (IntersectionObserver) to save CPU.
 */
export function ScopeDisplay() {
  const { outputBlock, state } = useEngine();
  const [samples, setSamples] = useState<number[]>([]);
  const [peak, setPeak] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      visibleRef.current = entries[0]?.isIntersecting ?? true;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const FRAME_MS = 33; // ~30 fps cap
    const timer = setInterval(() => {
      if (!visibleRef.current || state !== 'running') return;
      const block = outputBlock();
      if (!block) return;
      const mono: number[] = [];
      let max = 0;
      for (let i = 0; i < block.length; i += 2) {
        const v = (block[i] ?? 0) / 32768;
        mono.push(v);
        if (Math.abs(v) > max) max = Math.abs(v);
      }
      setSamples(mono);
      setPeak(max);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [outputBlock, state]);

  return (
    <div ref={wrapRef} className="nodrag scope-display" data-testid="scope" data-peak={peak.toFixed(4)}>
      <Display kind="scope" samples={samples} width={180} height={64} />
    </div>
  );
}
