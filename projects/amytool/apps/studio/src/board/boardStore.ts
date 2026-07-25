import { create } from 'zustand';
import {
  buildSketchUpload,
  DUMP_STATE,
  execPython,
  isWebMidiSupported,
  MockTransport,
  PING,
  reboot,
  SAVE_STATE,
  setSequencer,
  WebMidiTransport,
  type BoardResponder,
  type BoardTransport,
  type TransportState,
} from '@amy/board';
import { parseWireDump, wireToAmySend } from '@amy/patchdoc';
import { usePatchStore } from '../patch/patchStore';

export interface OutputTarget {
  sim: boolean;
  board: boolean;
}

/** Test seams: force the in-memory board and script its replies. */
declare global {
  interface Window {
    __amyUseMockBoard?: boolean;
    __amyBoardResponder?: BoardResponder;
    /** Test-only: exposes the mock transport's sent-frame log for E2E assertions. */
    __amyBoardMock?: { sent: readonly string[] };
  }
}

// The transport lives outside the store (it's not serializable state); the store
// mirrors its connection/upload/traceback state for the UI.
let transport: BoardTransport | null = null;

export interface UploadProgress {
  sent: number;
  total: number;
}

export interface BoardStoreState {
  supported: boolean;
  connection: TransportState;
  detail: string | null;
  upload: UploadProgress | null;
  traceback: string | null;
  /** Level-2 Python simulation traceback (P6-02). */
  simTraceback: string | null;
  setSimTraceback: (traceback: string | null) => void;
  ensure: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  uploadSketch: (source: string, path?: string) => Promise<void>;
  /** Collect a `zD` dump and load it onto the canvas via parseWireDump. */
  importFromBoard: () => Promise<void>;
  importing: boolean;
  clearTraceback: () => void;

  /** Realtime output routing (docs/07 P3-05): simulator and/or board. */
  target: OutputTarget;
  setTarget: (target: OutputTarget) => void;
  /** True when the board is an active, connected realtime target. */
  boardLive: () => boolean;
  /** Push raw wire messages to the board as `zP amy.send(...)` (knob deltas). */
  sendControl: (wire: string[]) => void;
  /** Run one Python statement on the board via `zP` (device knob write-back, P6-03). */
  sendExec: (line: string) => void;
  /** Play/stop notes on the board via `amy.send` on the given osc/synth targets. */
  sendNote: (targets: { osc?: number; synth?: number }[], note: number, vel: number) => void;
  /** Sequencer transport on the board (`zY1Z`/`zY0Z`). */
  sendSequencer: (run: boolean) => void;

  /** Board menu utilities (P3-06). */
  lastPong: number | null;
  saveToBoard: () => Promise<void>;
  pingBoard: () => void;
  rebootBoard: (toBootloader: boolean) => void;
}

export const useBoardStore = create<BoardStoreState>((set, get) => ({
  supported: true,
  connection: 'disconnected',
  detail: null,
  upload: null,
  traceback: null,
  simTraceback: null,
  setSimTraceback: (simTraceback) => set({ simTraceback }),
  importing: false,

  ensure: () => {
    if (transport !== null) return;
    if (typeof window !== 'undefined' && window.__amyUseMockBoard) {
      const mock = new MockTransport(window.__amyBoardResponder ? { responder: window.__amyBoardResponder } : {});
      window.__amyBoardMock = mock;
      transport = mock;
    } else if (isWebMidiSupported()) {
      transport = new WebMidiTransport();
    } else {
      set({ supported: false, detail: 'Web MIDI is not available in this browser — hardware features are disabled.' });
      return;
    }
    transport.onStateChange((connection) => set({ connection }));
    transport.onMessage((message) => {
      if (message.tag === 'traceback' && message.data) set({ traceback: message.data });
      else if (message.tag === 'pong') set({ lastPong: Date.now() });
    });
  },

  connect: async () => {
    get().ensure();
    if (!transport) return;
    set({ detail: null });
    try {
      await transport.connect();
    } catch (err) {
      set({ detail: err instanceof Error ? err.message : String(err) });
    }
  },

  disconnect: async () => {
    await transport?.disconnect();
  },

  uploadSketch: async (source, path = '/user/current/sketch.py') => {
    get().ensure();
    if (!transport || get().connection !== 'connected') {
      set({ detail: 'Connect to a board first.' });
      return;
    }
    const data = new TextEncoder().encode(source);
    const { begin, chunks, done } = buildSketchUpload(path, data);
    const total = chunks.length + 2; // begin + chunks + done
    set({ traceback: null, detail: null, upload: { sent: 0, total } });
    try {
      await transport.send(begin);
      set({ upload: { sent: 1, total } });
      for (const chunk of chunks) {
        await transport.send(chunk);
        set((s) => ({ upload: { sent: (s.upload?.sent ?? 0) + 1, total } }));
      }
      await transport.send(done);
      set({ upload: { sent: total, total } });
    } catch (err) {
      set({ detail: err instanceof Error ? err.message : String(err), upload: null });
      return;
    }
    // Leave the completed bar up briefly, then clear.
    setTimeout(() => set((s) => (s.upload && s.upload.sent >= s.upload.total ? { upload: null } : {})), 800);
  },

  importFromBoard: async () => {
    get().ensure();
    if (!transport || get().connection !== 'connected') {
      set({ detail: 'Connect to a board first.' });
      return;
    }
    const active = transport;
    const chunks: string[] = [];
    let off = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const complete = new Promise<void>((resolve) => {
      off = active.onMessage((m) => {
        if (m.tag === 'dump' && m.data !== undefined) {
          chunks.push(m.data);
          if (m.dumpKind === 'single' || m.dumpKind === 'final') resolve();
        }
      });
      timer = setTimeout(resolve, 5000); // safety: don't hang if E never arrives
    });

    set({ detail: null, importing: true });
    try {
      await active.send(DUMP_STATE);
      await complete;
    } catch (err) {
      set({ detail: err instanceof Error ? err.message : String(err), importing: false });
      off();
      if (timer) clearTimeout(timer);
      return;
    }
    off();
    if (timer) clearTimeout(timer);
    set({ importing: false });

    const text = chunks.join('');
    if (text.trim() === '') {
      set({ detail: 'The board returned an empty dump.' });
      return;
    }
    usePatchStore.getState().loadDoc(parseWireDump(text));
  },

  clearTraceback: () => set({ traceback: null }),

  target: { sim: true, board: false },
  setTarget: (target) => set({ target }),

  boardLive: () => get().target.board && get().connection === 'connected' && transport !== null,

  sendControl: (wire) => {
    if (!get().boardLive() || !transport) return;
    for (const message of wire) {
      try {
        void transport.send(execPython(wireToAmySend(message))).catch(() => {});
      } catch {
        /* skip messages that can't be expressed as a single exec line */
      }
    }
  },

  sendExec: (line) => {
    if (!get().boardLive() || !transport) return;
    void transport.send(execPython(line)).catch(() => {});
  },

  sendNote: (targets, note, vel) => {
    if (!get().boardLive() || !transport) return;
    for (const t of targets) {
      const args =
        t.osc !== undefined ? `osc=${t.osc}, note=${note}, vel=${vel}` : `synth=${t.synth}, note=${note}, vel=${vel}`;
      void transport.send(execPython(`amy.send(${args})`)).catch(() => {});
    }
  },

  sendSequencer: (run) => {
    if (!get().boardLive() || !transport) return;
    void transport.send(setSequencer(run)).catch(() => {});
  },

  lastPong: null,

  saveToBoard: async () => {
    if (!transport || get().connection !== 'connected') {
      set({ detail: 'Connect to a board first.' });
      return;
    }
    set({ detail: null });
    try {
      await transport.send(SAVE_STATE);
    } catch (err) {
      set({ detail: err instanceof Error ? err.message : String(err) });
    }
  },

  pingBoard: () => {
    if (!transport || get().connection !== 'connected') return;
    // Ping is not ACKed; the board answers with `OK` (pong), tracked via onMessage.
    void transport.send(PING, { expectAck: false }).catch(() => {});
  },

  rebootBoard: (toBootloader) => {
    if (!transport || get().connection !== 'connected') return;
    void transport.send(reboot(toBootloader), { expectAck: false }).catch(() => {});
  },
}));
