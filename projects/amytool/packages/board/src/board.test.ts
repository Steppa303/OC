import { describe, expect, it, vi } from 'vitest';
import {
  ACK_FRAME,
  bytesToBase64,
  base64ToBytes,
  decodeFrame,
  encodeFrame,
  parseBoardMessage,
  splitFrames,
  SysExError,
  SYSEX_END,
  SYSEX_START,
  type BoardMessage,
} from './sysex';
import {
  buildSketchUpload,
  chunkBytes,
  DUMP_STATE,
  execPython,
  PING,
  reboot,
  setSequencer,
} from './commands';
import { MockTransport, ackAll, scriptedResponder, type BoardResponder } from './mock';
import { BoardDisconnectedError, BoardTimeoutError } from './transport';

describe('SysEx framing', () => {
  it('wraps and unwraps a payload in the F0 00 03 45 … F7 envelope', () => {
    const frame = encodeFrame('zIZ');
    expect([...frame]).toEqual([SYSEX_START, 0x00, 0x03, 0x45, 0x7a, 0x49, 0x5a, SYSEX_END]);
    expect(decodeFrame(frame)).toBe('zIZ');
  });

  it('the ACK frame is F0 00 03 45 "A" "K" F7', () => {
    expect([...ACK_FRAME]).toEqual([0xf0, 0x00, 0x03, 0x45, 0x41, 0x4b, 0xf7]);
  });

  it('rejects non-ASCII payloads and malformed frames', () => {
    expect(() => encodeFrame('é')).toThrow(SysExError);
    expect(() => decodeFrame(new Uint8Array([0xf0, 0x01, 0xf7]))).toThrow(SysExError);
    expect(() => decodeFrame(new Uint8Array([0x00, 0x03, 0x45]))).toThrow(SysExError);
  });

  it('splits several concatenated frames and ignores an incomplete tail', () => {
    const stream = new Uint8Array([...encodeFrame('AK'), ...encodeFrame('OK'), SYSEX_START, 0x00]);
    const frames = splitFrames(stream);
    expect(frames.map(decodeFrame)).toEqual(['AK', 'OK']);
  });
});

describe('board message parsing', () => {
  it('classifies each board→host tag', () => {
    expect(parseBoardMessage('AK').tag).toBe('ack');
    expect(parseBoardMessage('OK').tag).toBe('pong');
    expect(parseBoardMessage('V1.2.3')).toMatchObject({ tag: 'version', data: '1.2.3' });
    expect(parseBoardMessage('0v0w2Z')).toMatchObject({ tag: 'dump', dumpKind: 'single', data: 'v0w2Z' });
    expect(parseBoardMessage('Ci1K0Z')).toMatchObject({ tag: 'dump', dumpKind: 'continuation' });
    expect(parseBoardMessage('Eh0.4Z')).toMatchObject({ tag: 'dump', dumpKind: 'final' });
    expect(parseBoardMessage('?')).toMatchObject({ tag: 'unknown' });
  });

  it('base64-decodes a traceback payload', () => {
    const tb = 'Traceback: NameError';
    const payload = 'X' + bytesToBase64(new TextEncoder().encode(tb));
    expect(parseBoardMessage(payload)).toMatchObject({ tag: 'traceback', data: tb });
  });
});

describe('base64 chunking', () => {
  it('splits raw bytes into ≤188-byte chunks', () => {
    const data = new Uint8Array(400).map((_, i) => i % 256);
    const chunks = chunkBytes(data);
    expect(chunks.map((c) => c.length)).toEqual([188, 188, 24]);
    // concatenation round-trips
    const joined = new Uint8Array(400);
    let o = 0;
    for (const c of chunks) {
      joined.set(c, o);
      o += c.length;
    }
    expect([...joined]).toEqual([...data]);
  });

  it('builds a sketch-upload sequence (begin → base64 chunks → done)', () => {
    const data = new TextEncoder().encode('import amy\n'.repeat(30)); // > 188 bytes
    const upload = buildSketchUpload('/user/current/sketch.py', data);
    expect(upload.begin).toBe(`zT/user/current/sketch.py,${data.length}Z`);
    expect(upload.chunks.length).toBe(Math.ceil(data.length / 188));
    expect(upload.done).toContain('environment_transfer_done');
    // chunks decode back to the original bytes
    const rejoined = upload.chunks.map(base64ToBytes).reduce<number[]>((a, c) => a.concat([...c]), []);
    expect(rejoined).toEqual([...data]);
  });

  it('command builders match the docs/02 payloads', () => {
    expect(DUMP_STATE).toBe('zD Z');
    expect(PING).toBe('zIZ');
    expect(setSequencer(true)).toBe('zY1Z');
    expect(setSequencer(false)).toBe('zY0Z');
    expect(reboot(true)).toBe('zBZ');
    expect(reboot(false)).toBe('zB1Z');
    expect(execPython('amy.send(osc=0)')).toBe('zPamy.send(osc=0)Z');
    expect(() => execPython('x'.repeat(256))).toThrow(SysExError);
  });
});

describe('MockTransport flow control', () => {
  it('sends a frame and resolves on ACK', async () => {
    const board = new MockTransport();
    await board.connect();
    await board.send(DUMP_STATE, { expectAck: true });
    expect(board.sent).toEqual([DUMP_STATE]);
  });

  it('serializes sends: each awaits its own ACK before the next', async () => {
    const order: string[] = [];
    const responder: BoardResponder = (payload, sent) => {
      order.push(`recv:${sent.length}`);
      return ackAll(payload, sent);
    };
    const board = new MockTransport({ responder });
    await board.connect();
    await Promise.all([board.send('a1Z'), board.send('b2Z'), board.send('c3Z')]);
    // frames left the host strictly in order, one at a time
    expect(board.sent).toEqual(['a1Z', 'b2Z', 'c3Z']);
    expect(order).toEqual(['recv:1', 'recv:2', 'recv:3']);
  });

  it('rejects with a timeout when no ACK arrives', async () => {
    const silent: BoardResponder = () => [];
    const board = new MockTransport({ responder: silent });
    await board.connect();
    await expect(board.send('v0w2Z', { timeoutMs: 20 })).rejects.toBeInstanceOf(BoardTimeoutError);
  });

  it('does not await an ACK for ping/reboot', async () => {
    const messages: BoardMessage[] = [];
    const board = new MockTransport();
    board.onMessage((m) => messages.push(m));
    await board.connect();
    await board.send(PING, { expectAck: false });
    await board.send(reboot(false), { expectAck: false });
    await new Promise((r) => setTimeout(r, 5));
    expect(messages.map((m) => m.tag)).toContain('pong');
  });

  it('replays a scripted dump transcript to onMessage', async () => {
    const dump: BoardMessage[] = [];
    const responder = scriptedResponder([[DUMP_STATE, ['AK', '0v0w2Z', 'Ci1K0Z', 'Eh0.4Z']]]);
    const board = new MockTransport({ responder });
    board.onMessage((m) => {
      if (m.tag === 'dump') dump.push(m);
    });
    await board.connect();
    await board.send(DUMP_STATE);
    await new Promise((r) => setTimeout(r, 5));
    expect(dump.map((d) => d.dumpKind)).toEqual(['single', 'continuation', 'final']);
    expect(dump.map((d) => d.data)).toEqual(['v0w2Z', 'i1K0Z', 'h0.4Z']);
  });

  it('surfaces a traceback frame', async () => {
    const tb = 'Traceback (most recent call last): ZeroDivisionError';
    const responder: BoardResponder = (payload, sent) => {
      if (payload.startsWith('zP')) return ['AK', 'X' + bytesToBase64(new TextEncoder().encode(tb))];
      return ackAll(payload, sent);
    };
    const board = new MockTransport({ responder });
    const seen: string[] = [];
    board.onMessage((m) => {
      if (m.tag === 'traceback' && m.data) seen.push(m.data);
    });
    await board.connect();
    await board.send(execPython('1/0'));
    await new Promise((r) => setTimeout(r, 5));
    expect(seen).toEqual([tb]);
  });

  it('fails in-flight sends on disconnect', async () => {
    const silent: BoardResponder = () => [];
    const board = new MockTransport({ responder: silent });
    await board.connect();
    const pending = board.send('v0w2Z', { timeoutMs: 1000 });
    await board.disconnect();
    await expect(pending).rejects.toBeInstanceOf(BoardDisconnectedError);
  });

  it('drives the full sketch-upload sequence, ACKing every frame', async () => {
    const board = new MockTransport();
    await board.connect();
    const data = new TextEncoder().encode('import amy\n'.repeat(40));
    const upload = buildSketchUpload('/user/current/sketch.py', data);
    await board.send(upload.begin);
    for (const chunk of upload.chunks) await board.send(chunk);
    await board.send(upload.done);
    expect(board.sent[0]).toBe(upload.begin);
    expect(board.sent.at(-1)).toBe(upload.done);
    expect(board.sent.length).toBe(2 + upload.chunks.length);
  });
});

// A tiny sanity check that fake timers aren't needed for the mock path.
it('mock replies arrive on a microtask by default', async () => {
  const board = new MockTransport();
  await board.connect();
  const spy = vi.fn();
  const p = board.send(DUMP_STATE).then(spy);
  expect(spy).not.toHaveBeenCalled();
  await p;
  expect(spy).toHaveBeenCalledOnce();
});
