/**
 * AMYboard SysEx codec (docs/02 "Board control protocol"). Frame envelope:
 *   F0 00 03 45 <7-bit ASCII payload> F7      (binary payloads base64-encoded)
 * The board ACKs every host frame with `F0 00 03 45 'A' 'K' F7`.
 */
export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;
/** shorepine manufacturer id used by AMYboard. */
export const MANUFACTURER_ID = [0x00, 0x03, 0x45] as const;

/** Flow-control + payload limits (docs/02). */
export const ACK_TIMEOUT_MS = 5000;
export const MAX_CHUNK_BYTES = 188;
export const MAX_EXEC_BYTES = 255;

export class SysExError extends Error {}

/** Wrap an ASCII payload in a SysEx frame. */
export function encodeFrame(payload: string): Uint8Array {
  const body = new Uint8Array(payload.length);
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    if (c > 0x7f) throw new SysExError(`non-ASCII byte 0x${c.toString(16)} in payload at index ${i}`);
    body[i] = c;
  }
  const out = new Uint8Array(4 + body.length + 1);
  out[0] = SYSEX_START;
  out[1] = MANUFACTURER_ID[0];
  out[2] = MANUFACTURER_ID[1];
  out[3] = MANUFACTURER_ID[2];
  out.set(body, 4);
  out[out.length - 1] = SYSEX_END;
  return out;
}

/** Strip the envelope and return the ASCII payload. Throws on a malformed frame. */
export function decodeFrame(bytes: Uint8Array): string {
  if (bytes.length < 5 || bytes[0] !== SYSEX_START || bytes[bytes.length - 1] !== SYSEX_END) {
    throw new SysExError('not a SysEx frame (missing F0…F7 envelope)');
  }
  if (bytes[1] !== MANUFACTURER_ID[0] || bytes[2] !== MANUFACTURER_ID[1] || bytes[3] !== MANUFACTURER_ID[2]) {
    throw new SysExError('unknown manufacturer id (not an AMYboard frame)');
  }
  let s = '';
  for (let i = 4; i < bytes.length - 1; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return s;
}

/** Split a byte stream that may hold several concatenated frames. */
export function splitFrames(bytes: Uint8Array): Uint8Array[] {
  const frames: Uint8Array[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] !== SYSEX_START) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < bytes.length && bytes[j] !== SYSEX_END) j++;
    if (j >= bytes.length) break; // incomplete trailing frame
    frames.push(bytes.slice(i, j + 1));
    i = j + 1;
  }
  return frames;
}

export const ACK_FRAME = encodeFrame('AK');

// --- board → host message parsing ------------------------------------------

export type BoardMessageTag = 'ack' | 'pong' | 'traceback' | 'version' | 'dump' | 'unknown';
export type DumpKind = 'single' | 'continuation' | 'final';

export interface BoardMessage {
  tag: BoardMessageTag;
  /** The raw payload (without the SysEx envelope). */
  payload: string;
  /** Decoded content: traceback text, version string, or a dump line. */
  data?: string;
  /** For dump frames: 0=single, C=continuation, E=final (docs/02). */
  dumpKind?: DumpKind;
}

/** Classify a board→host payload (docs/02 "Board→host tags"). */
export function parseBoardMessage(payload: string): BoardMessage {
  if (payload === 'AK') return { tag: 'ack', payload };
  if (payload === 'OK') return { tag: 'pong', payload };
  const kind = payload[0] ?? '';
  const rest = payload.slice(1);
  switch (kind) {
    case 'X':
      return { tag: 'traceback', payload, data: decodeBase64Text(rest) };
    case 'V':
      return { tag: 'version', payload, data: rest };
    case '0':
      return { tag: 'dump', payload, dumpKind: 'single', data: rest };
    case 'C':
      return { tag: 'dump', payload, dumpKind: 'continuation', data: rest };
    case 'E':
      return { tag: 'dump', payload, dumpKind: 'final', data: rest };
    default:
      return { tag: 'unknown', payload };
  }
}

// --- base64 helpers (raw bytes ↔ ASCII, UTF-8 safe for text) ---------------

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Decode a base64 blob to text, falling back to the raw string if it isn't base64. */
function decodeBase64Text(b64: string): string {
  try {
    return new TextDecoder().decode(base64ToBytes(b64));
  } catch {
    return b64;
  }
}
