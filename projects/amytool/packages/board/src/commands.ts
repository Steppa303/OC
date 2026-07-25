/**
 * Host→board command payload builders (docs/02 command table). These return the
 * *payload* strings; the transport wraps each in a SysEx frame and handles ACKs.
 */
import { bytesToBase64, MAX_CHUNK_BYTES, MAX_EXEC_BYTES, SysExError } from './sysex';

/** Begin a file write: `zT<path>,<size>Z`, followed by base64 chunks. */
export function beginFileWrite(path: string, size: number): string {
  return `zT${path},${size}Z`;
}

/** Dump the full synth state as newline-separated wire commands. */
export const DUMP_STATE = 'zD Z';

/** Read a file from the board filesystem: `zD<path>Z`. */
export function readFile(path: string): string {
  return `zD${path}Z`;
}

/** Persist the current state into the sketch (knob block). */
export const SAVE_STATE = 'zA Z';

/** Execute one Python line on the board (realtime control path, ≤255 bytes). */
export function execPython(line: string): string {
  if (byteLength(line) > MAX_EXEC_BYTES) {
    throw new SysExError(`python line exceeds ${MAX_EXEC_BYTES} bytes (${byteLength(line)})`);
  }
  return `zP${line}Z`;
}

/** Sequencer transport: start (`zY1Z`) / stop (`zY0Z`). */
export function setSequencer(run: boolean): string {
  return run ? 'zY1Z' : 'zY0Z';
}

/** Reboot: to bootloader (`zBZ`) or normal, running the sketch (`zB1Z`). */
export function reboot(toBootloader: boolean): string {
  return toBootloader ? 'zBZ' : 'zB1Z';
}

/** Ping the board (answers `OK`). */
export const PING = 'zIZ';

/** Called after the last upload chunk to finish the transfer (docs/02). */
export const ENV_TRANSFER_DONE = 'zPimport amyboard; amyboard.environment_transfer_done()Z';

/** Split raw bytes into ≤maxChunk-byte slices. */
export function chunkBytes(data: Uint8Array, maxChunk = MAX_CHUNK_BYTES): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += maxChunk) {
    chunks.push(data.slice(i, i + maxChunk));
  }
  return chunks;
}

export interface SketchUpload {
  /** `zT<path>,<size>Z` — sent first, ACKed. */
  begin: string;
  /** base64 payloads of ≤188 raw bytes each — sent in order, each ACKed. */
  chunks: string[];
  /** finishes the transfer. */
  done: string;
}

/** Build the full sketch-upload sequence (docs/02 "Sketch upload sequence"). */
export function buildSketchUpload(path: string, data: Uint8Array): SketchUpload {
  return {
    begin: beginFileWrite(path, data.length),
    chunks: chunkBytes(data).map(bytesToBase64),
    done: ENV_TRANSFER_DONE,
  };
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
