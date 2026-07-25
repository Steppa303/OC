/**
 * WebMidiTransport (docs/02, P3-02). Talks to a real AMYboard over the Web MIDI
 * API with SysEx enabled. Feature-detected and graceful: if Web MIDI is missing
 * or no `AMYboard` port is present, connect() fails with a typed error the UI
 * turns into a status chip / notice (CLAUDE.md rule 9).
 *
 * Web MIDI isn't in the DOM lib, so the minimal surface we use is declared here
 * rather than pulling in @types/webmidi.
 */
import { BaseTransport, BoardDisconnectedError, BoardError, BoardUnsupportedError } from './transport';

export const AMYBOARD_PORT = 'AMYboard';

interface MidiMessageEvent {
  data: Uint8Array;
}
interface MidiInput {
  name: string | null;
  onmidimessage: ((event: MidiMessageEvent) => void) | null;
}
interface MidiOutput {
  name: string | null;
  send(data: Uint8Array | number[]): void;
}
interface MidiAccess {
  inputs: Map<string, MidiInput>;
  outputs: Map<string, MidiOutput>;
}
type RequestMidiAccess = (options?: { sysex?: boolean }) => Promise<MidiAccess>;

function getRequestMidiAccess(): RequestMidiAccess | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { requestMIDIAccess?: RequestMidiAccess };
  return typeof nav.requestMIDIAccess === 'function' ? nav.requestMIDIAccess.bind(nav) : null;
}

/** Is the Web MIDI API available at all? */
export function isWebMidiSupported(): boolean {
  return getRequestMidiAccess() !== null;
}

function findPort<T extends { name: string | null }>(ports: Iterable<T>, needle: string): T | null {
  const lower = needle.toLowerCase();
  for (const port of ports) {
    if ((port.name ?? '').toLowerCase().includes(lower)) return port;
  }
  return null;
}

export class WebMidiTransport extends BaseTransport {
  #input: MidiInput | null = null;
  #output: MidiOutput | null = null;
  readonly #portName: string;

  constructor(portName = AMYBOARD_PORT) {
    super();
    this.#portName = portName;
  }

  async connect(): Promise<void> {
    this.setState('connecting');
    const request = getRequestMidiAccess();
    if (!request) {
      this.setState('error');
      throw new BoardUnsupportedError('Web MIDI is not available in this browser');
    }

    let access: MidiAccess;
    try {
      access = await request({ sysex: true });
    } catch (err) {
      this.setState('error');
      throw new BoardError(`MIDI access was denied: ${err instanceof Error ? err.message : String(err)}`);
    }

    const input = findPort(access.inputs.values(), this.#portName);
    const output = findPort(access.outputs.values(), this.#portName);
    if (!input || !output) {
      this.setState('error');
      throw new BoardError(`no "${this.#portName}" MIDI port found — is the board connected?`);
    }

    this.#input = input;
    this.#output = output;
    input.onmidimessage = (event) => {
      const data = event.data instanceof Uint8Array ? event.data : new Uint8Array(event.data);
      this.receiveRaw(data);
    };
    this.setState('connected');
  }

  disconnect(): Promise<void> {
    if (this.#input) this.#input.onmidimessage = null;
    this.#input = null;
    this.#output = null;
    this.failAll(new BoardDisconnectedError('board disconnected'));
    this.setState('disconnected');
    return Promise.resolve();
  }

  protected sendRaw(bytes: Uint8Array): void {
    if (!this.#output) throw new BoardDisconnectedError('board is not connected');
    this.#output.send(bytes);
  }
}
