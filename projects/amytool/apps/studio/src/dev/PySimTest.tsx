import { useRef, useState } from 'react';
import { AmyWasmEngine } from '@amy/engine';
import { encodeMessage, type AmyEvent } from '@amy/protocol';
import { PySimHost } from '../pysim/pySimHost';

const TRIVIAL_SKETCH = `import amy, amyboard
amy.reset(0)
for i in range(3):
    amy.send(i)
print("sketch ran")
`;

// A loop() arpeggiator: each ~60 ms tick retriggers osc 0 on the next note.
const ARP_SKETCH = `import amy
_step = 0
_notes = [60, 64, 67, 72]
def loop():
    global _step
    amy.send(osc=0, wave=0, note=_notes[_step % 4], vel=1)
    _step += 1
`;

interface Call {
  module: string;
  method: string;
  args: unknown[];
}

/** P6-01 spike harness: load micropython-wasm in a Worker, run a sketch, and show
 *  the captured amy/amyboard shim calls. */
export function PySimTest() {
  const workerRef = useRef<Worker | null>(null);
  const engineRef = useRef<AmyWasmEngine | null>(null);
  const hostRef = useRef<PySimHost | null>(null);
  const [status, setStatus] = useState('idle');
  const [calls, setCalls] = useState<Call[]>([]);
  const [stdout, setStdout] = useState('');
  const [rms, setRms] = useState(0);

  const runArp = async () => {
    setStatus('arp: starting audio');
    setRms(0);
    const engine = engineRef.current ?? new AmyWasmEngine();
    engineRef.current = engine;
    await engine.init();
    await engine.start();
    hostRef.current?.dispose();
    hostRef.current = new PySimHost({
      sketch: ARP_SKETCH,
      onSend: (kwargs) => {
        try {
          engine.sendWire(encodeMessage(kwargs as AmyEvent));
        } catch {
          /* skip */
        }
      },
      onError: (tb) => setStatus(`arp error: ${tb}`),
    });
    setStatus('arp: running');
    const meter = setInterval(() => {
      const block = engine.getLastOutputBlock();
      if (!block) return;
      let sum = 0;
      for (const s of block) sum += s * s;
      setRms(Math.sqrt(sum / block.length) / 32768);
    }, 100);
    setTimeout(() => clearInterval(meter), 4000);
  };

  const run = () => {
    setStatus('loading');
    setCalls([]);
    setStdout('');
    const worker = new Worker(new URL('../pysim/pyWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; module?: string; method?: string; args?: unknown[]; text?: string; message?: string };
      if (m.type === 'call') setCalls((c) => [...c, { module: m.module ?? '', method: m.method ?? '', args: m.args ?? [] }]);
      else if (m.type === 'stdout') setStdout((s) => s + m.text);
      else if (m.type === 'done') setStatus('done');
      else if (m.type === 'error') setStatus(`error: ${m.message ?? ''}`);
    };
    worker.onerror = (e) => setStatus(`worker error: ${e.message}`);
    worker.postMessage({ sketch: TRIVIAL_SKETCH });
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <h2 style={{ margin: 0 }}>Python Sim Spike (micropython-wasm)</h2>
      <button data-testid="pysim-run" onClick={run} disabled={status === 'loading'}>
        Run trivial sketch
      </button>
      <button data-testid="pysim-arp" onClick={() => void runArp()}>
        Run arpeggiator (audible)
      </button>
      <div data-testid="pysim-rms" data-rms={rms.toFixed(5)}>
        arp RMS: {rms.toFixed(5)}
      </div>
      <div data-testid="pysim-status">status: {status}</div>
      <div data-testid="pysim-stdout">stdout: {stdout}</div>
      <div data-testid="pysim-calls" data-count={calls.length}>
        captured calls: {calls.map((c) => `${c.module}.${c.method}(${c.args.join(',')})`).join('  ')}
      </div>
    </div>
  );
}
