import '@testing-library/jest-dom/vitest';
// jsdom has no IndexedDB; back it so components that persist (PatchBar) mount.
import 'fake-indexeddb/auto';

// jsdom has no PointerEvent; back it with MouseEvent so clientX/Y and pointerId survive
// fireEvent.pointer* in component tests.
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  // @ts-expect-error assigning polyfill onto window
  window.PointerEvent = PointerEventPolyfill;
}

// jsdom lacks ResizeObserver, which React Flow needs to mount.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
