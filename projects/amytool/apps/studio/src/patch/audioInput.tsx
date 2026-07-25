import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Audio input (P4-03): getUserMedia → Web Audio analyser → live level meter.
 * Feature-detected with a permission-driven enable button. (Routing mic audio
 * *through* the AMY engine needs engine-side external-audio plumbing the stock
 * build doesn't expose, so we capture + meter here; see DECISIONS.)
 */
function useAudioInputInternal() {
  const [supported] = useState(
    () => typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function',
  );
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setActive(false);
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const loop = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const s of buf) sum += s * s;
        setLevel(Math.sqrt(sum / buf.length));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      setActive(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      stop();
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { supported, active, level, error, start, stop };
}

/** The `core.audioin` panel body: enable/disable mic + a live level meter. */
export function AudioMeter() {
  const { supported, active, level, error, start, stop } = useAudioInputInternal();

  if (!supported) {
    return <div className="nodrag audio-meter-note">Mic input not supported</div>;
  }

  return (
    <div className="nodrag audio-meter">
      <button
        type="button"
        className="audio-mic-btn"
        data-testid="audio-mic-toggle"
        onClick={() => (active ? stop() : void start())}
      >
        {active ? 'Stop mic' : 'Enable mic'}
      </button>
      <div className="audio-meter-bar">
        <div
          className="audio-meter-fill"
          data-testid="audio-level"
          data-level={level.toFixed(4)}
          data-active={active ? 'true' : 'false'}
          style={{ width: `${Math.min(100, level * 300)}%` }}
        />
      </div>
      {error && <span className="audio-meter-err">{error}</span>}
    </div>
  );
}
