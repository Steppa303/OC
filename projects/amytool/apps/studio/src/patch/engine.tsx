import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AmyWasmEngine, type EngineState } from '@amy/engine';
import { allocate, compileToWire } from '@amy/patchdoc';
import { encodeMessage, RESET, type AmyEvent } from '@amy/protocol';
import { DEVICE_MODULE_TYPE, deviceBindingValues, deviceFromState } from '@amy/modules';
import type { PatchDoc } from '@amy/patchdoc';
import { usePatchStore } from './patchStore';
import { moduleInfoProvider } from './routing';
import { useBoardStore } from '../board/boardStore';
import { cvToFreq, cvVoltage } from './cvsim';
import { PySimHost } from '../pysim/pySimHost';
import { noteSinkModules } from './noteRouting';
import { buildModLoop, modLoopSignature, modSourceValue } from './scriptedMods';

/** binding → value across every Device Module in the patch (P6-03). */
function deviceVars(doc: PatchDoc): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const mod of doc.modules) {
    if (mod.type !== DEVICE_MODULE_TYPE) continue;
    const device = deviceFromState(mod.state);
    if (device) Object.assign(vars, deviceBindingValues(device, mod.params));
  }
  return vars;
}

interface EngineApi {
  state: EngineState;
  enabled: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  playNote: (note: number, velocity: number, on: boolean) => void;
  /** Start/stop the AMY sequencer on the simulator (docs/07 P5-02). */
  runSequencer: (run: boolean) => void;
  /** Last rendered output block (interleaved stereo int16) for scopes/meters. */
  outputBlock: () => Int16Array | null;
}

const EngineContext = createContext<EngineApi | null>(null);

export function useEngine(): EngineApi {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used within <EngineProvider>');
  return ctx;
}

/** Signature of the graph structure — a change means a full (reset) recompile;
 *  otherwise only knob values changed and we push a reset-free param update. */
function structuralKey(modules: { id: string; type: string; advanced: boolean }[], cables: unknown[]) {
  return JSON.stringify([modules.map((m) => [m.id, m.type, m.advanced]), cables]);
}

export function EngineProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<AmyWasmEngine | null>(null);
  if (engineRef.current === null) engineRef.current = new AmyWasmEngine();
  const engine = engineRef.current;

  const [state, setState] = useState<EngineState>(engine.state);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => engine.onStateChange(setState), [engine]);
  // Expose the engine for dev/E2E output inspection (RMS polling).
  useEffect(() => {
    (window as unknown as Record<string, unknown>)['__amyEngine'] = engine;
  }, [engine]);

  const doc = usePatchStore((s) => s.doc);
  const lastStructural = useRef<string | null>(null);

  // Keep the running engine in sync with the patch. Structural changes send the
  // full compile (with the leading reset); knob-only changes send a reset-free
  // update so a note keeps playing while you tweak (docs/01 realtime path).
  useEffect(() => {
    const key = structuralKey(doc.modules, doc.cables);
    const { messages } = compileToWire(doc, moduleInfoProvider);
    const structural = key !== lastStructural.current;
    lastStructural.current = key;
    const toSend = structural ? messages : messages.slice(1);
    const target = useBoardStore.getState().target;
    if (target.sim && enabled && engine.state === 'running') {
      for (const m of toSend) engine.sendWire(m);
    }
    if (target.board) useBoardStore.getState().sendControl(toSend);
  }, [doc, enabled, engine]);

  // CV simulation (P4-02): while audio runs, drive each osc that a sim core.cvin
  // is cabled to from the simulated CV voltage (1V/oct pitch etc.).
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (engine.state !== 'running' || !useBoardStore.getState().target.sim) return;
      const current = usePatchStore.getState().doc;
      const cvCables = current.cables.filter((c) => c.kind === 'cv');
      if (cvCables.length === 0) return;
      const { allocation } = allocate(current, moduleInfoProvider);
      const t = (engine.now() ?? performance.now()) / 1000;
      for (const cable of cvCables) {
        const src = current.modules.find((m) => m.id === cable.from.module);
        if (src?.type !== 'core.cvin') continue;
        const targetMod = current.modules.find((m) => m.id === cable.to.module);
        const oscs = targetMod ? allocation.oscMap[targetMod.id] : undefined;
        if (!targetMod || !oscs) continue;
        const semis = Number(targetMod.params['coarse'] ?? 0) + Number(targetMod.params['fine'] ?? 0);
        const base = 440 * Math.pow(2, semis / 12);
        const volts = cvVoltage(src.params, t);
        const freq = cvToFreq(String(src.params['mode'] ?? '1voct'), volts, base);
        for (const osc of oscs) engine.sendWire(encodeMessage({ osc, freq: [freq, 1] }));
      }
    }, 40);
    return () => clearInterval(timer);
  }, [enabled, engine]);

  // Level-2 Python simulation (P6-02): when a patch carries userLoopCode, run it in
  // micropython-wasm and route its amy.send calls into the engine so it's audible.
  const pysimRef = useRef<PySimHost | null>(null);
  useEffect(() => {
    const loopCode = doc.extras.userLoopCode;
    if (!enabled || engine.state !== 'running' || !useBoardStore.getState().target.sim || !loopCode) return;
    const host = new PySimHost({
      sketch: loopCode,
      // Device knob state survives a restart: current values overwrite the
      // sketch's own defaults once setup finished (P6-03).
      initialVars: deviceVars(usePatchStore.getState().doc),
      onSend: (kwargs) => {
        try {
          engine.sendWire(encodeMessage(kwargs as AmyEvent));
        } catch {
          /* skip a send we can't encode (e.g. unknown param) */
        }
      },
      onReset: () => engine.sendWire(encodeMessage({ reset: RESET.ALL_OSCS })),
      onError: (tb) => useBoardStore.getState().setSimTraceback(tb),
    });
    pysimRef.current = host;
    return () => {
      pysimRef.current = null;
      host.dispose();
    };
  }, [enabled, engine, doc.extras.userLoopCode]);

  // Scripted modulation (Stufe 5): non-coef mod cables (e.g. keyboard aftertouch →
  // echo feedback) run as a generated control loop; the source value is pushed
  // into its variable every tick (sim path — the board path reuses the same
  // var-push once the mod loop is uploaded with the sketch).
  const modSig = modLoopSignature(doc, moduleInfoProvider);
  useEffect(() => {
    if (!enabled || engine.state !== 'running' || !useBoardStore.getState().target.sim) return;
    const built = buildModLoop(usePatchStore.getState().doc, moduleInfoProvider);
    if (!built) return;
    const host = new PySimHost({
      sketch: built.code,
      onSend: (kwargs) => {
        try {
          engine.sendWire(encodeMessage(kwargs as AmyEvent));
        } catch {
          /* skip a send we can't encode */
        }
      },
      onError: (tb) => useBoardStore.getState().setSimTraceback(tb),
    });
    const push = () => {
      const cur = usePatchStore.getState().doc;
      for (const m of built.mods) host.setVar(m.varName, modSourceValue(cur, m));
    };
    push();
    const timer = setInterval(push, 60);
    return () => {
      clearInterval(timer);
      host.dispose();
    };
    // modSig rebuilds the loop on structural/target-param change; live source
    // values (e.g. pressure) are read fresh each push, not via deps.
  }, [enabled, engine, modSig]);

  // Device Module knob write-back (P6-03): a changed binding value goes into the
  // running sketch — sim via the shim variable update, board via a `zP` assignment.
  useEffect(() => {
    let prev = deviceVars(usePatchStore.getState().doc);
    return usePatchStore.subscribe((s) => {
      const next = deviceVars(s.doc);
      for (const [name, value] of Object.entries(next)) {
        if (prev[name] === value) continue;
        pysimRef.current?.setVar(name, value);
        const board = useBoardStore.getState();
        if (board.target.board) board.sendExec(`${name} = ${value}`);
      }
      prev = next;
    });
  }, []);

  const start = useCallback(async () => {
    await engine.init();
    await engine.start();
    lastStructural.current = null; // force a full recompile on next sync
    setEnabled(true);
  }, [engine]);

  const stop = useCallback(async () => {
    await engine.stop();
    setEnabled(false);
  }, [engine]);

  const playNote = useCallback(
    (note: number, velocity: number, on: boolean) => {
      const current = usePatchStore.getState().doc;
      const { allocation } = allocate(current, moduleInfoProvider);
      const vel = on ? velocity : 0;
      const target = useBoardStore.getState().target;
      const boardTargets: { osc?: number; synth?: number }[] = [];

      // Note routing (Stufe 3): if a keyboard/MIDI-in is cabled to specific
      // oscillators/voices, play only those; otherwise play everything.
      const sinks = noteSinkModules(current, moduleInfoProvider);
      const plays = (moduleId: string) => sinks === null || sinks.has(moduleId);

      // Play every oscillator-based voice root and every preset voice.
      for (const [moduleId, oscs] of Object.entries(allocation.oscMap)) {
        const role = moduleInfoProvider(current.modules.find((m) => m.id === moduleId)?.type ?? '')?.role;
        if (role !== 'vco' || !plays(moduleId)) continue;
        for (const osc of oscs) {
          if (target.sim && engine.state === 'running') engine.sendWire(encodeMessage({ osc, note, vel }));
          boardTargets.push({ osc });
        }
      }
      for (const [moduleId, synth] of Object.entries(allocation.synthMap)) {
        if (!plays(moduleId)) continue;
        if (target.sim && engine.state === 'running') engine.sendWire(encodeMessage({ synth, note, vel }));
        boardTargets.push({ synth });
      }
      if (target.board) useBoardStore.getState().sendNote(boardTargets, note, vel);
    },
    [engine],
  );

  const outputBlock = useCallback(() => engine.getLastOutputBlock(), [engine]);

  const runSequencer = useCallback(
    (run: boolean) => {
      if (engine.state === 'running' && useBoardStore.getState().target.sim) {
        engine.sendWire(encodeMessage({ sequencer_run: run ? 1 : 0 }));
      }
    },
    [engine],
  );

  return (
    <EngineContext.Provider value={{ state, enabled, start, stop, playNote, runSequencer, outputBlock }}>
      {children}
    </EngineContext.Provider>
  );
}
