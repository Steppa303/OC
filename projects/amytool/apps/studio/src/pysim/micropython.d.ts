declare module '@micropython/micropython-webassembly-pyscript/micropython.mjs' {
  export interface MicroPythonInstance {
    runPython(code: string): unknown;
    runPythonAsync(code: string): Promise<unknown>;
    registerJsModule(name: string, module: Record<string, unknown>): void;
    globals: { get(name: string): unknown; set(name: string, value: unknown): void };
  }
  export interface LoadOptions {
    url?: string;
    heapsize?: number;
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
  }
  export function loadMicroPython(options?: LoadOptions): Promise<MicroPythonInstance>;
}

declare module '*micropython.wasm?url' {
  const url: string;
  export default url;
}
