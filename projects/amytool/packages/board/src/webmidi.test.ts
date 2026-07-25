import { afterEach, describe, expect, it, vi } from 'vitest';
import { AMYBOARD_PORT, isWebMidiSupported, WebMidiTransport } from './webmidi';
import { BoardError, BoardUnsupportedError } from './transport';
import { decodeFrame, PING } from './index';

interface FakeInput {
  name: string;
  onmidimessage: ((e: { data: Uint8Array }) => void) | null;
}
interface FakeOutput {
  name: string;
  send: (data: Uint8Array) => void;
}

function fakeMidi(ports: { inputs: FakeInput[]; outputs: FakeOutput[] }) {
  return {
    requestMIDIAccess: vi.fn().mockResolvedValue({
      inputs: new Map(ports.inputs.map((p, i) => [String(i), p])),
      outputs: new Map(ports.outputs.map((p, i) => [String(i), p])),
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WebMidiTransport', () => {
  it('reports Web MIDI availability', () => {
    vi.stubGlobal('navigator', {});
    expect(isWebMidiSupported()).toBe(false);
    vi.stubGlobal('navigator', { requestMIDIAccess: () => Promise.resolve({}) });
    expect(isWebMidiSupported()).toBe(true);
  });

  it('discovers the AMYboard ports and connects', async () => {
    const input: FakeInput = { name: 'AMYboard MIDI 1', onmidimessage: null };
    const output: FakeOutput = { name: 'AMYboard MIDI 1', send: vi.fn() };
    vi.stubGlobal('navigator', fakeMidi({ inputs: [{ name: 'other', onmidimessage: null }, input], outputs: [output] }));

    const board = new WebMidiTransport();
    await board.connect();
    expect(board.state).toBe('connected');

    // sends go out through the discovered output port, wrapped in a frame
    void board.send(PING, { expectAck: false });
    await Promise.resolve();
    const sent = (output.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Uint8Array;
    expect(decodeFrame(sent)).toBe(PING);
    // and the board reply routes back through the input handler
    input.onmidimessage?.({ data: new Uint8Array([0xf0, 0x00, 0x03, 0x45, 0x4f, 0x4b, 0xf7]) });
  });

  it('errors when no AMYboard port is present', async () => {
    vi.stubGlobal('navigator', fakeMidi({ inputs: [{ name: 'Some Synth', onmidimessage: null }], outputs: [] }));
    const board = new WebMidiTransport();
    await expect(board.connect()).rejects.toBeInstanceOf(BoardError);
    expect(board.state).toBe('error');
  });

  it('errors (unsupported) when Web MIDI is missing', async () => {
    vi.stubGlobal('navigator', {});
    const board = new WebMidiTransport(AMYBOARD_PORT);
    await expect(board.connect()).rejects.toBeInstanceOf(BoardUnsupportedError);
  });
});
