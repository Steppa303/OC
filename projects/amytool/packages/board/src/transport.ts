/**
 * BoardTransport — the app's interface to an AMYboard, and a base class that owns
 * the ACK flow-control state machine (docs/02): send one frame, await its ACK
 * (5 s timeout), then the next. Concrete transports (MockTransport here,
 * WebMidiTransport in P3-02) only implement the raw byte link.
 */
import {
  ACK_TIMEOUT_MS,
  decodeFrame,
  encodeFrame,
  parseBoardMessage,
  splitFrames,
  type BoardMessage,
} from './sysex';

export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SendOptions {
  /** Await the board ACK before resolving. Default true; false for ping/reboot. */
  expectAck?: boolean;
  /** ACK timeout override (ms). */
  timeoutMs?: number;
}

export interface BoardTransport {
  readonly state: TransportState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Send a payload frame; resolves when ACKed (or immediately if expectAck=false). */
  send(payload: string, options?: SendOptions): Promise<void>;
  onMessage(cb: (message: BoardMessage) => void): () => void;
  onStateChange(cb: (state: TransportState) => void): () => void;
}

export class BoardError extends Error {}
export class BoardTimeoutError extends BoardError {}
export class BoardDisconnectedError extends BoardError {}
export class BoardUnsupportedError extends BoardError {}

interface QueueItem {
  payload: string;
  expectAck: boolean;
  timeoutMs: number;
  resolve: () => void;
  reject: (err: Error) => void;
}

interface Pending {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export abstract class BaseTransport implements BoardTransport {
  #state: TransportState = 'disconnected';
  #messageCbs = new Set<(m: BoardMessage) => void>();
  #stateCbs = new Set<(s: TransportState) => void>();
  #queue: QueueItem[] = [];
  #busy = false;
  #pending: Pending | null = null;

  get state(): TransportState {
    return this.#state;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  /** Subclass hook: put bytes on the wire. */
  protected abstract sendRaw(bytes: Uint8Array): void;

  protected setState(state: TransportState): void {
    if (this.#state === state) return;
    this.#state = state;
    for (const cb of this.#stateCbs) cb(state);
  }

  onMessage(cb: (m: BoardMessage) => void): () => void {
    this.#messageCbs.add(cb);
    return () => this.#messageCbs.delete(cb);
  }

  onStateChange(cb: (s: TransportState) => void): () => void {
    this.#stateCbs.add(cb);
    return () => this.#stateCbs.delete(cb);
  }

  send(payload: string, options: SendOptions = {}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.#queue.push({
        payload,
        expectAck: options.expectAck ?? true,
        timeoutMs: options.timeoutMs ?? ACK_TIMEOUT_MS,
        resolve,
        reject,
      });
      this.#drain();
    });
  }

  /** Subclass hook: feed received bytes into the parser. */
  protected receiveRaw(bytes: Uint8Array): void {
    for (const frame of splitFrames(bytes)) {
      let message: BoardMessage;
      try {
        message = parseBoardMessage(decodeFrame(frame));
      } catch {
        continue; // ignore malformed frames
      }
      if (message.tag === 'ack') {
        this.#resolvePending();
        continue;
      }
      for (const cb of this.#messageCbs) cb(message);
    }
  }

  /** Fail any in-flight + queued sends (e.g. on disconnect). */
  protected failAll(err: Error): void {
    if (this.#pending) {
      clearTimeout(this.#pending.timer);
      const reject = this.#pending.reject;
      this.#pending = null;
      this.#busy = false;
      reject(err);
    }
    const queued = this.#queue;
    this.#queue = [];
    for (const item of queued) item.reject(err);
  }

  #drain(): void {
    if (this.#busy) return;
    const item = this.#queue.shift();
    if (!item) return;
    this.#busy = true;
    this.#run(item);
  }

  #run(item: QueueItem): void {
    let frame: Uint8Array;
    try {
      frame = encodeFrame(item.payload);
    } catch (err) {
      this.#busy = false;
      item.reject(err instanceof Error ? err : new Error(String(err)));
      this.#drain();
      return;
    }

    if (!item.expectAck) {
      this.sendRaw(frame);
      this.#finish(item.resolve);
      return;
    }

    const timer = setTimeout(() => {
      this.#pending = null;
      this.#busy = false;
      item.reject(new BoardTimeoutError(`no ACK for '${item.payload}' within ${item.timeoutMs}ms`));
      this.#drain();
    }, item.timeoutMs);
    this.#pending = { resolve: item.resolve, reject: item.reject, timer };
    this.sendRaw(frame);
  }

  #resolvePending(): void {
    const pending = this.#pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending = null;
    this.#finish(pending.resolve);
  }

  #finish(resolve: () => void): void {
    this.#busy = false;
    resolve();
    this.#drain();
  }
}
