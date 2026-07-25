/** Typed view of the globals that vendor/amy.js (emscripten build + shorepine's
 *  amy_connector.js glue) installs on the page. See BUILD.md for provenance. */

export interface AmyEmscriptenModule {
  _amy_get_output_buffer(ptr: number): number;
  _malloc(bytes: number): number;
  _free(ptr: number): void;
  HEAP16?: Int16Array;
  wasmMemory?: WebAssembly.Memory;
}

export interface AmyGlobals {
  /** cwrapped after amyModule() resolves; null until then. */
  amy_add_message: ((message: string) => void) | null;
  amy_live_start_web: (() => Promise<void>) | null;
  amy_live_stop: (() => Promise<void>) | null;
  amy_sysclock: (() => number) | null;
  amy_module: AmyEmscriptenModule | null;
  AMY?: Record<string, number>;
}

/** The connector uses plain `var` declarations, so they land on globalThis. */
export function amyGlobals(): AmyGlobals {
  return globalThis as unknown as AmyGlobals;
}

export const AMY_BLOCK_SIZE = 256; // frames per block (AMY.AMY_BLOCK_SIZE)
export const AMY_NCHANS = 2;
export const AMY_SAMPLE_RATE = 44100;
