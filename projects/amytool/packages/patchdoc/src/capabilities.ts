/**
 * Capability matrix (docs/03 §3) — the one place that encodes "what AMY can
 * actually route". Given a would-be cable (two jack endpoints described by kind,
 * direction, the module's routing role, and — for modulation inputs — the target
 * AMY param), it says whether AMY can realize the connection and by which
 * mechanism. The canvas queries this while dragging to highlight legal targets;
 * the allocator/compiler use the mechanism to emit the right wire messages.
 *
 * This module has no dependency on @amy/modules (dependency direction: modules →
 * patchdoc). Callers pass the routing metadata in.
 */
import type { JackKind } from './schema';

export const ROUTING_ROLES = [
  'vco',
  'vcf',
  'env',
  'lfo',
  'vca',
  'fx',
  'io',
  'seq',
  'voice',
  'custom',
] as const;
export type RoutingRole = (typeof ROUTING_ROLES)[number];

export type Mechanism =
  | 'audio-chain'
  | 'filter-attach'
  | 'fx-send'
  | 'envelope'
  | 'mod-source'
  | 'ctrl-coef'
  | 'cv-trigger'
  | 'midi-route'
  /** Control-rate modulation of a non-coef param (incl. effects) via a generated
   *  sketch loop (Stufe 5) — runs in the simulator and on the board. */
  | 'scripted';

export interface Endpoint {
  role: RoutingRole;
  kind: JackKind;
  dir: 'in' | 'out';
  /** For cv/gate inputs: the AMY param this jack modulates. */
  target?: string;
}

export type CapabilityResult =
  | { ok: true; mechanism: Mechanism }
  | { ok: false; reason: string };

/** AMY params that accept ControlCoefficients (synth.md §Control Coefficients). */
export const COEF_TARGETS: readonly string[] = ['amp', 'freq', 'filter_freq', 'duty', 'pan'];

/** Evaluate whether a cable from `from` (an output) to `to` (an input) is realizable. */
export function evaluateConnection(from: Endpoint, to: Endpoint): CapabilityResult {
  if (from.dir !== 'out' || to.dir !== 'in') {
    return { ok: false, reason: 'connect an output jack to an input jack' };
  }
  if (from.kind !== to.kind) {
    return { ok: false, reason: `can't connect a ${from.kind} output to a ${to.kind} input` };
  }

  switch (to.kind) {
    case 'audio':
      if (to.role === 'vcf') return { ok: true, mechanism: 'filter-attach' };
      if (to.role === 'fx') return { ok: true, mechanism: 'fx-send' };
      return { ok: true, mechanism: 'audio-chain' };

    case 'cv': {
      const target = to.target;
      // A cv input must declare what it modulates.
      if (!target) return { ok: false, reason: 'this input has no modulation target' };
      // Native, per-oscillator control coefficients (real-time, hardware-native).
      if (COEF_TARGETS.includes(target)) {
        if (from.role === 'env') return { ok: true, mechanism: 'envelope' };
        if (from.role === 'lfo') return { ok: true, mechanism: 'mod-source' };
        return { ok: true, mechanism: 'ctrl-coef' };
      }
      // Anything else (effect params, resonance, …) → scripted control loop (Stufe 5).
      return { ok: true, mechanism: 'scripted' };
    }

    case 'gate':
      return { ok: true, mechanism: 'cv-trigger' };

    case 'midi':
      return { ok: true, mechanism: 'midi-route' };
  }
}
