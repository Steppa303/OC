import { useRef, useState } from 'react';
import { AmyWasmEngine } from '@amy/engine';
import { encodeMessage } from '@amy/protocol';
import {
  generatePatch,
  PATCHPLAN_CONTRACT,
  type ChatFn,
  type GenerateResult,
} from '@amy/llm';

/** A fixed "LLM" response so the pipeline runs deterministically without a key. */
const MOCK_PLAN = JSON.stringify({
  contract: PATCHPLAN_CONTRACT,
  name: 'Mock Saw Lead',
  modules: [
    { id: 'vco1', type: 'core.vco', params: { wave: 'saw' } },
    { id: 'vcf1', type: 'core.vcf', params: { cutoff: 1400, resonance: 2 } },
    { id: 'vca1', type: 'core.vca', params: {} },
    { id: 'out1', type: 'core.out', params: {} },
    { id: 'env1', type: 'core.env', params: { attack: 5, decay: 200, sustain: 0.8, release: 300 } },
  ],
  cables: [
    { from: 'vco1.out', to: 'vcf1.in' },
    { from: 'vcf1.out', to: 'vca1.in' },
    { from: 'vca1.out', to: 'out1.in' },
    { from: 'env1.out', to: 'vca1.cv' },
  ],
  notes: 'A bright mock saw lead for the pipeline smoke test.',
});

const mockChat: ChatFn = () => Promise.resolve(MOCK_PLAN);

/**
 * P2-05 dev harness: runs the real verify→repair pipeline with a mocked model,
 * then plays the accepted patch through the live AMY engine as the render smoke
 * test — proving generate → validate → compile → audible works end-to-end.
 */
export function LlmTest() {
  const engineRef = useRef<AmyWasmEngine | null>(null);
  if (engineRef.current === null) engineRef.current = new AmyWasmEngine();
  const engine = engineRef.current;

  const [result, setResult] = useState<GenerateResult | null>(null);
  const [rms, setRms] = useState(0);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setRms(0);
    await engine.init();
    await engine.start();

    const smoke = async (wire: string[]): Promise<void> => {
      for (const msg of wire) engine.sendWire(msg);
      engine.sendWire(encodeMessage({ osc: 0, note: 55, vel: 1 }));
      await new Promise((r) => setTimeout(r, 700));
      const block = engine.getLastOutputBlock();
      engine.sendWire(encodeMessage({ osc: 0, note: 55, vel: 0 }));
      if (!block) throw new Error('engine produced no audio');
      let sum = 0;
      for (const s of block) sum += s * s;
      const measured = Math.sqrt(sum / block.length) / 32768;
      setRms(measured);
      if (measured < 0.0005) throw new Error(`output too quiet (rms ${measured.toFixed(5)})`);
    };

    const res = await generatePatch({ prompt: 'a bright saw lead', chat: mockChat, renderSmokeTest: smoke });
    setResult(res);
    setRunning(false);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <h2 style={{ margin: 0 }}>LLM Pipeline Test</h2>
      <button data-testid="run-pipeline" onClick={() => void run()} disabled={running}>
        Generate (mock) + render
      </button>
      <div data-testid="result-status">
        {result ? (result.ok ? `accepted in ${result.attempts} attempt(s)` : `failed: ${result.error}`) : 'idle'}
      </div>
      <div data-testid="rms" data-rms={rms.toFixed(5)}>
        render RMS: {rms.toFixed(5)}
      </div>
      {result?.ok && <div data-testid="notes">notes: {result.notes}</div>}
      <ol data-testid="trace" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {result?.trace.map((t, i) => (
          <li key={i}>
            #{t.attempt} {t.stage} {t.ok ? 'ok' : `fail — ${t.detail ?? ''}`}
          </li>
        ))}
      </ol>
    </div>
  );
}
