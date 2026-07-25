/**
 * MockTransport — an in-memory AMYboard for tests and the no-hardware code path
 * (CLAUDE.md rule 9). It replays a fixture "responder": given a host payload, it
 * returns the board payloads to emit back (each wrapped in a frame). The default
 * responder mimics real flow control — ACK everything, `OK` to a ping, nothing to
 * a reboot — so higher layers can be exercised without a device.
 */
import { decodeFrame, encodeFrame } from './sysex';
import { PING } from './commands';
import { BaseTransport, BoardDisconnectedError } from './transport';

/** Given the host payload (and the log so far), return board payloads to reply. */
export type BoardResponder = (payload: string, sent: readonly string[]) => string[];

export const ackAll: BoardResponder = (payload) => {
  if (payload === PING) return ['OK'];
  if (payload.startsWith('zB')) return []; // reboot: no ACK (docs/02)
  return ['AK'];
};

/**
 * Build a responder from a scripted transcript: a list of `[hostPayload,
 * boardReplies]` pairs consumed in order. Anything not matching the next scripted
 * host payload falls back to `ackAll`, so setup frames still flow.
 */
export function scriptedResponder(script: readonly (readonly [string, string[]])[]): BoardResponder {
  let i = 0;
  return (payload, sent) => {
    const step = script[i];
    if (step && step[0] === payload) {
      i++;
      return step[1];
    }
    return ackAll(payload, sent);
  };
}

export interface MockOptions {
  responder?: BoardResponder;
  /** Delay (ms) before board replies; 0 uses a microtask. */
  latencyMs?: number;
}

export class MockTransport extends BaseTransport {
  /** Every payload the host has sent, in order (for assertions). */
  readonly sent: string[] = [];
  #responder: BoardResponder;
  #latencyMs: number;
  #connected = false;

  constructor(options: MockOptions = {}) {
    super();
    this.#responder = options.responder ?? ackAll;
    this.#latencyMs = options.latencyMs ?? 0;
  }

  connect(): Promise<void> {
    this.setState('connecting');
    this.#connected = true;
    this.setState('connected');
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.#connected = false;
    this.failAll(new BoardDisconnectedError('board disconnected'));
    this.setState('disconnected');
    return Promise.resolve();
  }

  get connected(): boolean {
    return this.#connected;
  }

  protected sendRaw(bytes: Uint8Array): void {
    const payload = decodeFrame(bytes);
    this.sent.push(payload);
    const replies = this.#responder(payload, this.sent);
    const deliver = () => {
      if (!this.#connected) return;
      for (const reply of replies) this.receiveRaw(encodeFrame(reply));
    };
    if (this.#latencyMs > 0) setTimeout(deliver, this.#latencyMs);
    else queueMicrotask(deliver);
  }
}
