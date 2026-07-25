/**
 * Behavior-script runtime (docs/04 §4). The user's JavaScript runs with a frozen
 * `api` surface and the dangerous globals shadowed to `undefined`, so it can only
 * affect the patch through `api.emit`. This module is what executes *inside* the
 * Worker (see behaviorWorker.ts); it's also imported directly by unit tests so the
 * sandbox logic is testable without spinning up a real Worker.
 */
export interface TickInfo {
  tick: number;
  timeMs: number;
}

export interface ScriptContext {
  params: Record<string, string | number | boolean>;
  state: Record<string, unknown>;
}

export interface ScriptHooks {
  emit: (jackId: string, event: unknown) => void;
  display: (id: string, data: unknown) => void;
  setState: (state: Record<string, unknown>) => void;
}

export interface ScriptInstance {
  tick: (info: TickInfo) => void;
  updateContext: (params: ScriptContext['params'], state: ScriptContext['state']) => void;
}

/** Globals a behavior script must not touch (docs/04 §4, docs/05 §4). */
export const FORBIDDEN_GLOBALS = [
  'fetch',
  'importScripts',
  'XMLHttpRequest',
  'WebSocket',
  'eval',
  'Function',
  'globalThis',
  'self',
  'window',
  'document',
  'require',
] as const;

// `eval` (and `arguments`) can't be bound as parameters in strict mode, so it's
// blocked by the static check rather than shadowed at call time.
const SHADOW_GLOBALS = FORBIDDEN_GLOBALS.filter((g) => g !== 'eval');

/** Static pre-check: reject scripts that name a forbidden global (defense in depth). */
export function checkScript(script: string): string[] {
  const errors: string[] = [];
  for (const name of FORBIDDEN_GLOBALS) {
    if (new RegExp(`\\b${name}\\b`).test(script)) errors.push(`use of '${name}' is not allowed`);
  }
  return errors;
}

export function runScript(script: string, ctx: ScriptContext, hooks: ScriptHooks): ScriptInstance {
  const context: ScriptContext = { params: { ...ctx.params }, state: { ...ctx.state } };
  let onTickCb: ((info: TickInfo) => void) | null = null;

  const api = Object.freeze({
    onTick(cb: (info: TickInfo) => void) {
      if (typeof cb === 'function') onTickCb = cb;
    },
    emit(jackId: string, event: unknown) {
      hooks.emit(String(jackId), event);
    },
    param(id: string) {
      return context.params[id];
    },
    state: Object.freeze({
      get() {
        return context.state;
      },
      set(next: Record<string, unknown>) {
        context.state = next;
        hooks.setState(next);
      },
    }),
    display(id: string, data: unknown) {
      hooks.display(String(id), data);
    },
  });

  // Run the script body with `api` in scope and the forbidden globals shadowed.
  const fn = new Function('api', ...SHADOW_GLOBALS, `"use strict";\n${script}`);
  fn(api, ...SHADOW_GLOBALS.map(() => undefined));

  return {
    tick(info) {
      onTickCb?.(info);
    },
    updateContext(params, state) {
      context.params = params;
      context.state = state;
    },
  };
}
