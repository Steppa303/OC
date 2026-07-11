// ─── AMY WebMIDI Connection Manager ───────────────────────────────────
// Handles device discovery, SysEx transport, state dumps, ping/health
// checks, Python execution, sketch uploads, and reboot/sequencer control.
//
// Singleton exported as `amyConnection` at module level.

import { AMY } from './amy-constants';

// ─── Types ────────────────────────────────────────────────────────────
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface DumpFrame {
  tag: number;
  data: Uint8Array;
}

export type ConnectionCallback = (state: ConnectionState) => void;
export type ErrorCallback = (error: string) => void;
export type DumpCallback = (tag: number, data: Uint8Array) => void;

// ─── Helpers ──────────────────────────────────────────────────────────

/** Concatenate Uint8Array chunks into a single buffer. */
function concatUint8(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Convert a base64-encoded string to a Uint8Array. */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Convert a Uint8Array to a base64 string. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Encode a string payload as UTF-8 Uint8Array. */
function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Decode a Uint8Array as UTF-8. */
function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

// ─── Connection Class ─────────────────────────────────────────────────

export class AMYConnection {
  // ── State ───────────────────────────────────────────────────────────
  state: ConnectionState = 'disconnected';
  deviceName: string = '';
  firmwareVersion: string = '';

  private _midiAccess: MIDIAccess | null = null;
  private _input: MIDIInput | null = null;
  private _output: MIDIOutput | null = null;
  private _inputPorts: MIDIInput[] = [];
  private _outputPorts: MIDIOutput[] = [];

  // Pending promise resolvers.
  private _ackResolve: ((value: boolean) => void) | null = null;
  private _ackTimer: ReturnType<typeof setTimeout> | null = null;

  private _dumpResolve: ((data: Uint8Array) => void) | null = null;
  private _dumpChunks: Uint8Array[] = [];
  private _dumpTag: number = 0;
  private _dumpTimer: ReturnType<typeof setTimeout> | null = null;

  // Callback registrations.
  private _onError: ErrorCallback | null = null;
  private _onDump: DumpCallback | null = null;
  private _onStateChange: ConnectionCallback | null = null;

  // ── Callback Setters ────────────────────────────────────────────────
  set onError(cb: ErrorCallback | null) {
    this._onError = cb;
  }
  set onDump(cb: DumpCallback | null) {
    this._onDump = cb;
  }
  set onStateChange(cb: ConnectionCallback | null) {
    this._onStateChange = cb;
  }

  // ── Available Ports ─────────────────────────────────────────────────
  get availableInputs(): MIDIInput[] {
    return this._inputPorts;
  }
  get availableOutputs(): MIDIOutput[] {
    return this._outputPorts;
  }

  // ── Connect ─────────────────────────────────────────────────────────
  async connect(deviceNameFilter?: string): Promise<boolean> {
    if (this.state === 'connecting' || this.state === 'connected') {
      return this.state === 'connected';
    }

    this._setState('connecting');

    try {
      // Request MIDI access.
      this._midiAccess = await navigator.requestMIDIAccess({ sysex: true });

      // Collect available ports for later inspection.
      this._inputPorts = Array.from(this._midiAccess.inputs.values());
      this._outputPorts = Array.from(this._midiAccess.outputs.values());

      // Find an AMY-capable input port.
      const input = this._findAMYInput(deviceNameFilter);
      if (!input) {
        throw new Error(
          'Kein AMY-fähiges MIDI-Gerät gefunden. ' +
          (deviceNameFilter
            ? `Gesucht nach "${deviceNameFilter}". `
            : '') +
          `Verfügbare Eingänge: ${this._inputPorts.map((p) => p.name ?? '(unbenannt)').join(', ') || 'keine'}`
        );
      }

      // Find a matching output port.
      const output = this._findAMYOutput(input, deviceNameFilter);
      if (!output) {
        throw new Error(
          `Kein passender MIDI-Ausgang für "${input.name ?? 'unbekannt'}" gefunden.`
        );
      }

      this._input = input;
      this._output = output;
      this.deviceName = input.name ?? 'AMY Board';

      // Register message handler.
      this._input.onmidimessage = this._handleMIDIMessage.bind(this);

      // Ping test to verify the connection is alive.
      const alive = await this.ping(3000);
      if (!alive) {
        throw new Error('AMY Board antwortet nicht auf Ping.');
      }

      // Fetch firmware version.
      try {
        await this._requestVersion();
      } catch {
        // Non-fatal – version might still be unknown.
        this.firmwareVersion = 'unknown';
      }

      this._setState('connected');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._setState('error');
      this._emitError(msg);
      this._cleanupPorts();
      return false;
    }
  }

  // ── Disconnect ──────────────────────────────────────────────────────
  disconnect(): void {
    this._cleanupPorts();
    this.deviceName = '';
    this.firmwareVersion = '';
    this._setState('disconnected');
  }

  // ── Send SysEx ──────────────────────────────────────────────────────
  /** Wrap payload in F0 00 03 45 … F7 and send via MIDI output. */
  send(payload: Uint8Array): void {
    if (!this._output) {
      throw new Error('Nicht verbunden – kein MIDI-Ausgang verfügbar.');
    }

    const sysex = new Uint8Array(
      1 + AMY.MANUFACTURER_ID.length + payload.length + 1,
    );
    sysex[0] = AMY.SYSEX_START;
    sysex.set(AMY.MANUFACTURER_ID, 1);
    sysex.set(payload, 1 + AMY.MANUFACTURER_ID.length);
    sysex[sysex.length - 1] = AMY.SYSEX_END;

    this._output.send(sysex);
  }

  // ── Ping ────────────────────────────────────────────────────────────
  /** Send zI ping, wait for OK reply. Returns true on success. */
  async ping(timeout: number = 2000): Promise<boolean> {
    if (!this._output) return false;

    try {
      this.send(encodeUtf8('zI'));
      return await this._waitForReply('pong', timeout);
    } catch {
      return false;
    }
  }

  // ── Wait for ACK ────────────────────────────────────────────────────
  waitForAck(timeout: number = AMY.ACK_TIMEOUT_MS as number): Promise<boolean> {
    return this._waitForReply('ack', timeout);
  }

  // ── Run Python ──────────────────────────────────────────────────────
  /** Execute arbitrary Python code on the AMY board. */
  async runPython(code: string): Promise<boolean> {
    if (!this._output) throw new Error('Keine Verbindung.');

    const payload = encodeUtf8(`zP${code}Z`);
    this.send(payload);
    return this.waitForAck();
  }

  // ── Dump State ──────────────────────────────────────────────────────
  /** Request a full state dump from the board. Returns decoded bytes. */
  async dumpState(timeout: number = 15000): Promise<Uint8Array> {
    if (!this._output) throw new Error('Keine Verbindung.');

    this._dumpChunks = [];
    this._dumpTag = 0;

    return new Promise<Uint8Array>((resolve, reject) => {
      this._dumpResolve = resolve;

      this._dumpTimer = setTimeout(() => {
        this._dumpResolve = null;
        this._dumpTimer = null;
        this._dumpChunks = [];
        reject(new Error('State-Dump Timeout'));
      }, timeout);

      // Send dump request.
      this.send(encodeUtf8('zDZ'));
    });
  }

  // ── Reboot ──────────────────────────────────────────────────────────
  /**
   * mode: 0 = warm reboot, 1 = cold reboot (re-init hardware),
   *       2 = factory reset.
   */
  reboot(mode: 0 | 1 | 2 = 0): void {
    if (!this._output) throw new Error('Keine Verbindung.');

    const cmdByte = mode === 2 ? 0x32 : mode === 1 ? 0x31 : 0x30;
    const payload = new Uint8Array([0x7a, 0x42, cmdByte]); // "zB" + mode
    this.send(payload);
  }

  // ── Sequencer ───────────────────────────────────────────────────────
  /** Start (true) or stop (false) the onboard sequencer. */
  sequencer(start: boolean): void {
    if (!this._output) throw new Error('Keine Verbindung.');

    const cmdByte = start ? 0x31 : 0x30; // zY1 / zY0
    const payload = new Uint8Array([0x7a, 0x59, cmdByte]); // "zY" + mode
    this.send(payload);
  }

  // ── Upload Sketch ───────────────────────────────────────────────────
  /**
   * Upload a Python sketch to the board in base64-encoded chunks.
   * Each chunk is ≤ CHUNK_SIZE bytes.
   * After upload the board is restarted.
   */
  async uploadSketch(
    code: string,
    chunkSize: number = AMY.CHUNK_SIZE as number,
  ): Promise<boolean> {
    if (!this._output) throw new Error('Keine Verbindung.');

    const encoded = btoa(unescape(encodeURIComponent(code)));

    // Send header: zT<total_length>
    this.send(encodeUtf8(`zT${encoded.length}`));
    if (!(await this.waitForAck())) {
      throw new Error('Sketch-Header wurde nicht bestätigt.');
    }

    // Send chunks.
    const totalChunks = Math.ceil(encoded.length / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const chunk = encoded.slice(i * chunkSize, (i + 1) * chunkSize);
      this.send(encodeUtf8(chunk));
      if (!(await this.waitForAck())) {
        throw new Error(
          `Sketch-Chunk ${i + 1}/${totalChunks} wurde nicht bestätigt.`,
        );
      }
    }

    return true;
  }

  // ── Get Firmware Version ────────────────────────────────────────────
  async getFirmwareVersion(): Promise<string> {
    await this._requestVersion();
    return this.firmwareVersion;
  }

  // ── Private: MIDI Message Handler ───────────────────────────────────
  private _handleMIDIMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 2) return;

    // Must be a SysEx message from our manufacturer.
    if (data[0] !== AMY.SYSEX_START) return;
    if (
      data[1] !== AMY.MANUFACTURER_ID[0] ||
      data[2] !== AMY.MANUFACTURER_ID[1] ||
      data[3] !== AMY.MANUFACTURER_ID[2]
    ) {
      return;
    }

    // Payload is everything between manufacturer ID and F7.
    const payloadEnd = data.lastIndexOf(AMY.SYSEX_END);
    if (payloadEnd < 4) return;

    const payload = data.slice(4, payloadEnd);

    // Dispatch based on first byte / content.
    this._dispatchMIDIPayload(payload);
  }

  private _dispatchMIDIPayload(payload: Uint8Array): void {
    if (payload.length === 0) return;

    // ASCII "AK" → ACK.
    if (
      payload.length >= 2 &&
      payload[0] === AMY.ACK[0] &&
      payload[1] === AMY.ACK[1]
    ) {
      this._resolveAck(true);
      return;
    }

    // ASCII "OK" → Pong.
    if (
      payload.length >= 2 &&
      payload[0] === AMY.PONG[0] &&
      payload[1] === AMY.PONG[1]
    ) {
      this._resolveAck(true);
      return;
    }

    // Error tag (0x58 = 'X').
    if (payload[0] === AMY.ERROR_TAG) {
      const errText = decodeUtf8(payload.slice(1));
      this._resolveAck(false);
      this._emitError(`AMY Error: ${errText}`);
      return;
    }

    // Version tag (0x56 = 'V').
    if (payload[0] === AMY.VERSION_TAG) {
      this.firmwareVersion = decodeUtf8(payload.slice(1));
      return;
    }

    // Dump frames.
    if (payload[0] >= 0x30 && payload[0] <= 0x45) {
      const tag = payload[0];
      const frameData = payload.slice(1);

      if (tag === AMY.DUMP_END) {
        // End of dump – deliver accumulated data.
        if (this._dumpResolve) {
          const full = concatUint8(this._dumpChunks);
          this._dumpChunks = [];
          const resolve = this._dumpResolve;
          this._dumpResolve = null;
          if (this._dumpTimer) {
            clearTimeout(this._dumpTimer);
            this._dumpTimer = null;
          }
          resolve(full);
        }
        if (this._onDump) this._onDump(tag, frameData);
      } else {
        // C (chunked) or 0 (single): accumulate.
        if (tag === AMY.DUMP_CHUNK || tag === AMY.DUMP_SINGLE) {
          this._dumpChunks.push(frameData);
        }
        if (this._onDump) this._onDump(tag, frameData);
      }
      return;
    }

    // Unknown – ignore.
  }

  // ── Private: ACK / Reply Wait ───────────────────────────────────────
  private _waitForReply(
    kind: 'ack' | 'pong',
    timeout: number,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._ackResolve = (ok: boolean) => {
        if (this._ackTimer) {
          clearTimeout(this._ackTimer);
          this._ackTimer = null;
        }
        this._ackResolve = null;
        resolve(ok);
      };

      this._ackTimer = setTimeout(() => {
        if (this._ackResolve) {
          this._ackResolve = null;
          this._ackTimer = null;
          resolve(false);
        }
      }, timeout);
    });
  }

  private _resolveAck(ok: boolean): void {
    if (this._ackResolve) {
      this._ackResolve(ok);
    }
  }

  // ── Private: Request Version ────────────────────────────────────────
  private _requestVersion(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Version-Request Timeout'));
      }, 3000);

      const originalHandler = this._input?.onmidimessage ?? null;
      if (this._input) {
        this._input.onmidimessage = (event: MIDIMessageEvent) => {
          const data = event.data;
          if (
            data &&
            data[0] === AMY.SYSEX_START &&
            data[1] === AMY.MANUFACTURER_ID[0] &&
            data[2] === AMY.MANUFACTURER_ID[1] &&
            data[3] === AMY.MANUFACTURER_ID[2] &&
            data[4] === AMY.VERSION_TAG
          ) {
            clearTimeout(timeout);
            this.firmwareVersion = decodeUtf8(data.slice(5, data.lastIndexOf(AMY.SYSEX_END)));
            // Restore original handler.
            if (this._input && originalHandler) {
              this._input.onmidimessage = originalHandler;
            }
            resolve();
          } else if (originalHandler) {
            originalHandler.call(this._input!, event);
          }
        };
      }

      this.send(encodeUtf8('zVZ'));
    });
  }

  // ── Private: Port Discovery ─────────────────────────────────────────
  private _findAMYInput(nameFilter?: string): MIDIInput | null {
    for (const input of this._inputPorts) {
      const name = (input.name ?? '').toLowerCase();
      const manuf = (input.manufacturer ?? '').toLowerCase();

      if (nameFilter) {
        if (name.includes(nameFilter.toLowerCase())) return input;
        continue;
      }

      // Auto-detect: look for "amy" in name or manufacturer.
      if (
        name.includes('amy') ||
        name.includes('daisy') ||
        name.includes('esp32') ||
        manuf.includes('amy') ||
        manuf.includes('electro-smith') ||
        manuf.includes('daisy')
      ) {
        return input;
      }
    }

    // If no auto-detect worked but there's exactly one input, use it.
    if (this._inputPorts.length === 1) return this._inputPorts[0];

    return null;
  }

  private _findAMYOutput(
    input: MIDIInput,
    nameFilter?: string,
  ): MIDIOutput | null {
    // Prefer an output with a matching name.
    const inputName = (input.name ?? '').toLowerCase();

    for (const output of this._outputPorts) {
      const outName = (output.name ?? '').toLowerCase();

      if (nameFilter && outName.includes(nameFilter.toLowerCase())) {
        return output;
      }

      if (
        outName.includes('amy') ||
        outName.includes('daisy') ||
        outName === inputName ||
        outName.includes(inputName.slice(0, 8)) // Allow partial match.
      ) {
        return output;
      }
    }

    // Fallback: if there's exactly one output, use it.
    if (this._outputPorts.length === 1) return this._outputPorts[0];

    return null;
  }

  // ── Private: State Management ───────────────────────────────────────
  private _setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    if (this._onStateChange) {
      try {
        this._onStateChange(state);
      } catch {
        // Silently ignore callback errors.
      }
    }
  }

  private _emitError(message: string): void {
    if (this._onError) {
      try {
        this._onError(message);
      } catch {
        // Silently ignore callback errors.
      }
    }
  }

  private _cleanupPorts(): void {
    if (this._ackTimer) {
      clearTimeout(this._ackTimer);
      this._ackTimer = null;
    }
    this._ackResolve = null;

    if (this._dumpTimer) {
      clearTimeout(this._dumpTimer);
      this._dumpTimer = null;
    }
    this._dumpResolve = null;
    this._dumpChunks = [];

    if (this._input) {
      this._input.onmidimessage = null;
      this._input = null;
    }
    this._output = null;
    this._midiAccess = null;
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────
export const amyConnection = new AMYConnection();