import { useEffect, useRef, useState } from 'react';
import { AmyWasmEngine, type EngineState } from '@amy/engine';
import { encodeMessage } from '@amy/protocol';
import {
  compileToWire,
  createEmptyPatch,
  patchDocSchema,
  type Cable,
  type ModuleInstance,
} from '@amy/patchdoc';
import { Display } from '@amy/ui';
import { moduleInfoProvider } from '../patch/routing';

/** Build a compiled subtractive patch (VCO→VCF→VCA→Out, amp envelope) and play
 *  osc 0 — the P1-05 end-to-end audio path. */
function playCompiledSubtractive(engine: AmyWasmEngine) {
  const m = (id: string, type: string, params: Record<string, string | number | boolean> = {}): ModuleInstance => ({
    id,
    type,
    label: id,
    pos: { x: 0, y: 0 },
    params,
    advanced: false,
    state: {},
  });
  const c = (id: string, from: string, to: string, kind: Cable['kind']): Cable => {
    const [fm, fj] = from.split('.') as [string, string];
    const [tm, tj] = to.split('.') as [string, string];
    return { id, from: { module: fm, jack: fj }, to: { module: tm, jack: tj }, kind };
  };
  const doc = createEmptyPatch('Subtractive');
  doc.modules.push(
    m('vco1', 'core.vco', { wave: 'saw' }),
    m('vcf1', 'core.vcf', { type: 'lowpass', cutoff: 1200, resonance: 2 }),
    m('vca1', 'core.vca', { gain: 1 }),
    m('out1', 'core.out'),
    m('env1', 'core.env', { attack: 5, decay: 200, sustain: 0.8, release: 300 }),
  );
  doc.cables.push(
    c('a', 'vco1.out', 'vcf1.in', 'audio'),
    c('b', 'vcf1.out', 'vca1.in', 'audio'),
    c('c', 'vca1.out', 'out1.in', 'audio'),
    c('e', 'env1.out', 'vca1.cv', 'cv'),
  );
  const { messages } = compileToWire(patchDocSchema.parse(doc), moduleInfoProvider);
  for (const msg of messages) engine.sendWire(msg);
  engine.sendWire(encodeMessage({ osc: 0, note: 55, vel: 1 }));
  setTimeout(() => engine.sendWire(encodeMessage({ osc: 0, note: 55, vel: 0 })), 900);
}

declare global {
  interface Window {
    __amyEngine?: AmyWasmEngine;
  }
}

/** Milestone M0 test page: prove AMY-WASM makes sound in the browser (P0-05). */
export function AudioTest() {
  const engineRef = useRef<AmyWasmEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new AmyWasmEngine();
    window.__amyEngine = engineRef.current;
  }
  const engine = engineRef.current;

  const [state, setState] = useState<EngineState>(engine.state);
  const [detail, setDetail] = useState('');
  const [rms, setRms] = useState(0);
  const [samples, setSamples] = useState<number[]>([]);

  useEffect(() => engine.onStateChange((s, d) => {
    setState(s);
    setDetail(d ?? '');
  }), [engine]);

  useEffect(() => {
    if (state !== 'running') return;
    const timer = setInterval(() => {
      const block = engine.getLastOutputBlock();
      if (!block) return;
      let sum = 0;
      for (const s of block) sum += s * s;
      setRms(Math.sqrt(sum / block.length) / 32768);
      const mono: number[] = [];
      for (let i = 0; i < block.length; i += 2) mono.push((block[i] ?? 0) / 32768);
      setSamples(mono);
    }, 100);
    return () => clearInterval(timer);
  }, [engine, state]);

  const startAudio = async () => {
    try {
      await engine.init();
      await engine.start();
    } catch {
      // state/detail update via onStateChange
    }
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
      <h2 style={{ margin: 0 }}>AMY Engine Test</h2>
      <div data-testid="engine-state">
        state: {state}
        {detail && ` — ${detail}`}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => void startAudio()} disabled={state === 'running'}>
          Start audio
        </button>
        <button
          data-testid="play-note"
          onClick={() => {
            engine.noteOn(60, 1);
            setTimeout(() => engine.noteOff(60), 800);
          }}
          disabled={state !== 'running'}
        >
          Play note (Juno patch 0)
        </button>
        <button
          onClick={() => engine.sendWire(encodeMessage({ synth: 10, note: 36, vel: 1 }))}
          disabled={state !== 'running'}
        >
          Kick (GM drums)
        </button>
        <button
          data-testid="play-subtractive"
          onClick={() => playCompiledSubtractive(engine)}
          disabled={state !== 'running'}
        >
          Play compiled subtractive
        </button>
      </div>
      <div data-testid="rms" data-rms={rms.toFixed(5)}>
        RMS: {rms.toFixed(5)}
      </div>
      <Display kind="scope" samples={samples} width={240} height={64} />
    </div>
  );
}
