/**
 * compileToWire (docs/03 §4) — projects a PatchDoc onto ordered AMY wire
 * messages. Deterministic order: reset, voice/synth loads, oscillator params
 * (wave, freq, filter, envelopes, modulation), then global effects. Emits SETUP
 * only; note/gate events are sent at play time (P1-06).
 *
 * Dependency-free: module metadata comes from the injected provider (same one
 * the allocator uses, now carrying param→amyParam mappings).
 *
 * Scope note: this covers the Phase-1 core graph (oscillator chains, per-osc
 * filter + 2 envelopes, LFO modulation, preset voices, global FX). Polyphonic
 * synth wrapping for MIDI-driven chains is layered on in P1-06/P3; a single
 * oscillator chain is played by sending a note to its osc.
 */
import {
  encodeMessage,
  FILTER_TYPE_NUM,
  RESET,
  WAVE_NUM,
  type AmyEvent,
} from '@amy/protocol';
import type { PatchDoc } from './schema';
import { allocate, type Allocation, type AllocationError, type ModuleInfoProvider } from './allocate';
import { COEF_ORDER } from '@amy/protocol';

export interface CompiledPatch {
  messages: string[];
  allocation: Allocation;
  errors: AllocationError[];
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * AMY sequencer ticks per step. 16 steps = 1 bar; calibrate against hardware in
 * the P3-06 QA pass (docs/HARDWARE_QA.md) if the feel is off.
 */
export const TICKS_PER_STEP = 12;

export interface SequencerTrack {
  note: number;
  vel: number;
  steps: boolean[];
  /** Optional per-step pitch (pitch sequencer); falls back to `note`. */
  notes?: number[];
}

/**
 * Read a sequencer module's pattern from `state` (P5-02 contract). Supports a
 * multi-track grid (`state.tracks: {note, vel?, steps}[]`) or a single lane
 * (`state.steps: boolean[]` + `state.note`). Tolerant of missing/partial data.
 */
export function readSequencerTracks(state: Record<string, unknown>): SequencerTrack[] {
  const rawTracks = state['tracks'];
  if (Array.isArray(rawTracks)) {
    return rawTracks
      .map((t): SequencerTrack | null => {
        const track = t as Record<string, unknown>;
        const steps = Array.isArray(track['steps']) ? track['steps'].map(Boolean) : [];
        if (steps.length === 0) return null;
        const notes = Array.isArray(track['notes']) ? track['notes'].map((n) => num(n, 60)) : undefined;
        return { note: num(track['note'], 60), vel: num(track['vel'], 1), steps, ...(notes ? { notes } : {}) };
      })
      .filter((t): t is SequencerTrack => t !== null);
  }
  const steps = state['steps'];
  if (Array.isArray(steps)) {
    return [{ note: num(state['note'], 60), vel: num(state['vel'], 1), steps: steps.map(Boolean) }];
  }
  return [];
}

/** Index of a control-coefficient slot in the wire list. */
const COEF_INDEX = (name: (typeof COEF_ORDER)[number]) => COEF_ORDER.indexOf(name);

/** Build a coef list of the needed length with values at given slots. */
function coefs(entries: Partial<Record<(typeof COEF_ORDER)[number], number>>): (number | null)[] {
  let maxIdx = -1;
  for (const k of Object.keys(entries) as (typeof COEF_ORDER)[number][]) {
    maxIdx = Math.max(maxIdx, COEF_INDEX(k));
  }
  const list: (number | null)[] = new Array(maxIdx + 1).fill(null);
  for (const [k, v] of Object.entries(entries)) {
    list[COEF_INDEX(k as (typeof COEF_ORDER)[number])] = v as number;
  }
  return list;
}

/** ADSR params → AMY breakpoint string (attack→1, decay→sustain, release→0). */
function adsrBreakpoints(params: Record<string, unknown>): string {
  const a = Math.round(num(params['attack'], 5));
  const d = Math.round(num(params['decay'], 100));
  const s = num(params['sustain'], 0.7);
  const r = Math.round(num(params['release'], 200));
  return `${a},1,${d},${s},${r},0`;
}

interface OscBuild {
  event: AmyEvent;
  /** which eg slots are used (so a 2nd env picks the free one) */
  usedEg: Set<0 | 1>;
}

export function compileToWire(doc: PatchDoc, provider: ModuleInfoProvider): CompiledPatch {
  // A persisted allocation (e.g. from a board dump import) is honored so the
  // recompile reuses the same osc/synth numbers — round-trip wire-equivalence.
  const seeded =
    Object.keys(doc.allocation.oscMap).length > 0 || Object.keys(doc.allocation.synthMap).length > 0
      ? doc.allocation
      : undefined;
  const { allocation, errors } = allocate(doc, provider, seeded);
  const { oscMap, synthMap } = allocation;
  const messages: string[] = [];

  const moduleById = new Map(doc.modules.map((m) => [m.id, m]));
  const roleOf = (id: string) => provider(moduleById.get(id)?.type ?? '')?.role;
  const jackTarget = (moduleId: string, jackId: string) =>
    provider(moduleById.get(moduleId)?.type ?? '')?.jacks.find((j) => j.id === jackId)?.target;

  // 1. reset
  messages.push(encodeMessage({ reset: RESET.ALL_OSCS }));

  // 2. preset voices
  for (const m of doc.modules
    .filter((x) => roleOf(x.id) === 'voice')
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const synth = synthMap[m.id];
    if (synth === undefined) continue;
    const patch = num(m.params['patch'] ?? m.params['kit'], 0);
    const voices = Math.max(1, Math.round(num(m.params['voices'], 4)));
    messages.push(encodeMessage({ synth, num_voices: voices, patch }));
  }

  // 3. oscillators (vco/lfo/noise). Build one event per osc, then encode.
  const builds = new Map<number, OscBuild>();
  const oscModuleByOsc = new Map<number, string>();
  for (const [moduleId, oscs] of Object.entries(oscMap)) {
    for (const osc of oscs) oscModuleByOsc.set(osc, moduleId);
  }

  for (const [moduleId, oscs] of Object.entries(oscMap)) {
    const m = moduleById.get(moduleId);
    if (!m) continue;
    const role = roleOf(moduleId);
    for (const osc of oscs) {
      const event: AmyEvent = { osc };
      const waveName = String(m.params['wave'] ?? (role === 'lfo' ? 'sine' : 'saw'));
      event['wave'] = WAVE_NUM[waveName] ?? 0;
      if (waveName === 'pulse' || waveName === 'square') {
        event['duty'] = coefs({ const: num(m.params['duty'], 0.5) });
      }
      if (role === 'lfo') {
        // silent modulation source: constant frequency, no note tracking
        event['freq'] = coefs({ const: num(m.params['rate'], 2) });
        event['amp'] = coefs({ const: 1 });
      } else {
        // note-tracking oscillator, transposed by coarse+fine semitones
        const semis = num(m.params['coarse']) + num(m.params['fine']);
        event['freq'] = coefs({ const: 440 * Math.pow(2, semis / 12), note: 1 });
        // Static pan coefficient — only when moved off center, so default patches
        // keep their existing wire (mods to pan merge in below regardless).
        const pan = num(m.params['pan'], 0.5);
        if (pan !== 0.5) event['pan'] = coefs({ const: pan });
      }
      builds.set(osc, { event, usedEg: new Set() });
    }
  }

  // 3a. attach filters (audio cable osc.out -> vcf.in)
  for (const cable of doc.cables) {
    if (cable.kind !== 'audio') continue;
    if (roleOf(cable.to.module) !== 'vcf') continue;
    const vcf = moduleById.get(cable.to.module);
    const sourceOscs = oscMap[cable.from.module];
    if (!vcf || !sourceOscs) continue;
    for (const osc of sourceOscs) {
      const build = builds.get(osc);
      if (!build) continue;
      build.event['filter_type'] = FILTER_TYPE_NUM[String(vcf.params['type'] ?? 'lowpass')] ?? 1;
      build.event['filter_freq'] = coefs({ const: num(vcf.params['cutoff'], 800) });
      build.event['resonance'] = num(vcf.params['resonance'], 0.7);
    }
  }

  // 3b. envelopes and LFO modulation (cv cables from env/lfo)
  const affectedOscs = (moduleId: string, seen = new Set<string>()): number[] => {
    if (seen.has(moduleId)) return [];
    seen.add(moduleId);
    const role = roleOf(moduleId);
    if (oscMap[moduleId]) return oscMap[moduleId];
    if (role === 'vcf' || role === 'vca') {
      const out: number[] = [];
      for (const c of doc.cables) {
        if (c.to.module === moduleId && c.kind === 'audio') out.push(...affectedOscs(c.from.module, seen));
      }
      return out;
    }
    return [];
  };

  // deterministic cable order
  const modCables = doc.cables
    .filter((c) => c.kind === 'cv')
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const cable of modCables) {
    const srcRole = roleOf(cable.from.module);
    const srcModule = moduleById.get(cable.from.module);
    if (!srcModule) continue;

    // core.cvin → bind the target param to ext0/ext1 CtrlCoefs by channel, so the
    // engine/board makes the param follow the CV input (1V/oct pitch etc.).
    if (srcRole === 'io' && srcModule.type === 'core.cvin') {
      const target = jackTarget(cable.to.module, cable.to.jack) ?? 'freq';
      const slot = num(srcModule.params['channel'], 0) === 1 ? 'ext1' : 'ext0';
      for (const osc of affectedOscs(cable.to.module)) {
        const build = builds.get(osc);
        if (build) mergeCoef(build.event, target, { [slot]: 1 });
      }
      continue;
    }

    if (srcRole !== 'env' && srcRole !== 'lfo') continue;
    const target = jackTarget(cable.to.module, cable.to.jack) ?? 'amp';
    const oscs = affectedOscs(cable.to.module);

    for (const osc of oscs) {
      const build = builds.get(osc);
      if (!build) continue;

      if (srcRole === 'env') {
        const eg: 0 | 1 = build.usedEg.has(0) ? 1 : 0;
        build.usedEg.add(eg);
        const bp = adsrBreakpoints(srcModule.params);
        build.event[eg === 0 ? 'bp0' : 'bp1'] = bp.split(',').map(Number);
        // couple the target param to this eg slot
        const slot = eg === 0 ? 'eg0' : 'eg1';
        mergeCoef(build.event, target, { [slot]: 1 });
      } else {
        // LFO: use the source osc as mod_source, weight target coef by depth
        const lfoOsc = oscMap[cable.from.module]?.[0];
        if (lfoOsc !== undefined) build.event['mod_source'] = lfoOsc;
        mergeCoef(build.event, target, { mod: num(srcModule.params['depth'], 0.5) });
      }
    }
  }

  // encode oscillator events in osc-number order
  for (const osc of [...builds.keys()].sort((a, b) => a - b)) {
    const build = builds.get(osc);
    if (build) messages.push(encodeMessage(build.event));
  }

  // 4. global effects (bus 0)
  for (const m of doc.modules
    .filter((x) => roleOf(x.id) === 'fx')
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const type = m.type;
    if (type === 'core.fx.reverb') {
      messages.push(
        encodeMessage({ reverb: [num(m.params['level'], 0.4), num(m.params['liveness'], 0.85), num(m.params['damping'], 0.5)] }),
      );
    } else if (type === 'core.fx.chorus') {
      messages.push(encodeMessage({ chorus: [num(m.params['level'], 0.5), 320, num(m.params['rate'], 0.5), num(m.params['depth'], 0.5)] }));
    } else if (type === 'core.fx.echo') {
      messages.push(
        encodeMessage({ echo: [num(m.params['level'], 0.4), num(m.params['time'], 300), 2000, num(m.params['feedback'], 0.3), 0] }),
      );
    } else if (type === 'core.fx.eq') {
      messages.push(encodeMessage({ eq: [num(m.params['low']), num(m.params['mid']), num(m.params['high'])] }));
    }
  }

  // 5. sequencer patterns → AMY sequence slots (docs/07 P5-02)
  const seqModules = doc.modules
    .filter((m) => roleOf(m.id) === 'seq')
    .sort((a, b) => a.id.localeCompare(b.id));
  if (seqModules.length > 0) {
    // Sequencing needs a tempo; emit it once (only when a sequencer is present, so
    // non-sequenced patches keep their existing wire).
    messages.push(encodeMessage({ tempo: doc.globals.tempo }));
    let tag = 0;
    for (const m of seqModules) {
      // Resolve the note sink this sequencer drives (a voice synth or an osc).
      const outCable = doc.cables.find((c) => c.from.module === m.id);
      const targetId = outCable?.to.module;
      const synth = targetId ? synthMap[targetId] : undefined;
      const osc = targetId ? oscMap[targetId]?.[0] : undefined;
      const noteTarget: Record<string, number> =
        synth !== undefined ? { synth } : osc !== undefined ? { osc } : {};

      for (const track of readSequencerTracks(m.state)) {
        const period = track.steps.length * TICKS_PER_STEP;
        track.steps.forEach((on, i) => {
          if (!on) return;
          messages.push(
            encodeMessage({
              sequence: [i * TICKS_PER_STEP, period, tag++],
              ...noteTarget,
              note: track.notes?.[i] ?? track.note,
              vel: track.vel,
            }),
          );
        });
      }
    }
  }

  return { messages, allocation, errors };
}

/** Merge coefficient weights into an existing coef param on the event. */
function mergeCoef(
  event: AmyEvent,
  param: string,
  add: Partial<Record<(typeof COEF_ORDER)[number], number>>,
): void {
  const existing = event[param];
  const base: (number | null)[] = Array.isArray(existing) ? [...(existing as (number | null)[])] : [];
  for (const [k, v] of Object.entries(add)) {
    const idx = COEF_INDEX(k as (typeof COEF_ORDER)[number]);
    while (base.length <= idx) base.push(null);
    base[idx] = v as number;
  }
  event[param] = base;
}
