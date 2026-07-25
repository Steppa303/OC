/**
 * parseWireDump (docs/03 §4) — the inverse allocator. Turns a board `zD` state
 * dump (newline-separated wire messages) back into a PatchDoc by clustering
 * oscillators into modules: an osc that another osc modulates → LFO; per-osc
 * filter params → an attached VCF; breakpoint envelopes → ENV (+ a VCA amp
 * stage); preset synth loads → voice modules; global effects → FX modules.
 *
 * The reconstructed `allocation` pins each module to its original osc/synth
 * number, and compileToWire honors it — so compileToWire(parseWireDump(dump))
 * reproduces the dump byte-for-byte (round-trip guarantee #2, docs/03 §5).
 * Anything it can't model is preserved verbatim in `extras.unmappedWire`.
 */
import {
  COEF_ORDER,
  decodeMessage,
  FILTER_TYPE_NUM,
  splitWireDump,
  WAVE_NUM,
  type AmyEvent,
} from '@amy/protocol';
import { PATCHDOC_VERSION, patchDocSchema, type Cable, type ModuleInstance, type PatchDoc } from './schema';

const WAVE_TO_NAME = reverseFirst(WAVE_NUM, ['sine', 'saw', 'square', 'triangle', 'pulse', 'noise']);
const FILTER_TO_NAME = reverseFirst(FILTER_TYPE_NUM, ['none', 'lowpass', 'bandpass', 'highpass', 'lowpass24']);

const COEF_TARGETS = ['amp', 'freq', 'filter_freq', 'duty', 'pan'] as const;

export function parseWireDump(input: string | string[]): PatchDoc {
  const lines = Array.isArray(input) ? input : splitWireDump(input);

  const oscEvents = new Map<number, AmyEvent>();
  const synthEvents: AmyEvent[] = [];
  const fxEvents: AmyEvent[] = [];
  const unmapped: string[] = [];

  for (const line of lines) {
    let event: AmyEvent;
    try {
      event = decodeMessage(line);
    } catch {
      unmapped.push(line);
      continue;
    }
    if (event['reset'] !== undefined) continue;
    if (event['osc'] !== undefined) oscEvents.set(Number(event['osc']), event);
    else if (['reverb', 'chorus', 'echo', 'eq'].some((k) => event[k] !== undefined)) fxEvents.push(event);
    else if (['synth', 'patch', 'num_voices'].some((k) => event[k] !== undefined)) synthEvents.push(event);
    else unmapped.push(line);
  }

  // Oscillators used as a modulation source are LFO modules, not audio VCOs.
  const modSources = new Set<number>();
  for (const e of oscEvents.values()) {
    if (typeof e['mod_source'] === 'number') modSources.add(e['mod_source']);
  }

  const modules: ModuleInstance[] = [];
  const cables: Cable[] = [];
  const oscMap: Record<string, number[]> = {};
  const synthMap: Record<string, number> = {};
  const oscToModule = new Map<number, string>(); // osc → its source module id
  const oscToStages = new Map<number, { vcf?: string; vca?: string }>();
  let cableN = 0;
  const ids: Record<string, number> = {};
  const nextId = (base: string) => `${base}${(ids[base] = (ids[base] ?? 0) + 1)}`;
  const addCable = (from: string, fj: string, to: string, tj: string, kind: Cable['kind']) =>
    cables.push({ id: `c${++cableN}`, from: { module: from, jack: fj }, to: { module: to, jack: tj }, kind });

  // --- preset voices ---
  for (const e of synthEvents.sort((a, b) => Number(a['synth'] ?? 0) - Number(b['synth'] ?? 0))) {
    const patch = Number(e['patch'] ?? 0);
    const type = patch >= 384 ? 'core.drumvoice' : patch >= 128 ? 'core.dx7voice' : 'core.junovoice';
    const id = nextId('voice');
    const params =
      type === 'core.drumvoice'
        ? { kit: String(patch) }
        : { patch, voices: Number(e['num_voices'] ?? 4) };
    modules.push(instance(id, type, params));
    synthMap[id] = Number(e['synth'] ?? 1);
  }

  // --- audio oscillator chains (skip LFOs) ---
  const audioTerminals: { module: string; jack: string }[] = [];
  for (const [osc, e] of [...oscEvents].sort((a, b) => a[0] - b[0])) {
    if (modSources.has(osc)) continue;

    const waveNum = Number(e['wave'] ?? 0);
    let sourceId: string;
    if (waveNum === 5) {
      sourceId = nextId('noise');
      modules.push(instance(sourceId, 'core.noise', {}));
    } else {
      const freq = coefConst(e['freq']);
      const semis = freq > 0 ? 12 * Math.log2(freq / 440) : 0;
      const coarse = Math.round(semis);
      const params: Record<string, string | number | boolean> = {
        wave: WAVE_TO_NAME[waveNum] ?? 'saw',
        coarse,
        fine: round(semis - coarse, 4),
      };
      if (e['duty'] !== undefined) params['duty'] = coefConst(e['duty']);
      sourceId = nextId('vco');
      modules.push(instance(sourceId, 'core.vco', params));
    }
    oscMap[sourceId] = [osc];
    oscToModule.set(osc, sourceId);
    const stages: { vcf?: string; vca?: string } = {};
    oscToStages.set(osc, stages);

    let terminal = { module: sourceId, jack: 'out' };

    // attached filter
    if (e['filter_type'] !== undefined && Number(e['filter_type']) !== 0) {
      const vcfId = nextId('vcf');
      modules.push(
        instance(vcfId, 'core.vcf', {
          type: FILTER_TO_NAME[Number(e['filter_type'])] ?? 'lowpass',
          cutoff: coefConst(e['filter_freq']),
          resonance: round(Number(e['resonance'] ?? 0.7), 4),
        }),
      );
      addCable(terminal.module, terminal.jack, vcfId, 'in', 'audio');
      terminal = { module: vcfId, jack: 'out' };
      stages.vcf = vcfId;
    }

    // envelopes (bp0/bp1). Each is coupled to a target coef via its eg slot.
    const envelopes = collectEnvelopes(e);
    if (envelopes.length > 0) {
      const vcaId = nextId('vca');
      modules.push(instance(vcaId, 'core.vca', {}));
      addCable(terminal.module, terminal.jack, vcaId, 'in', 'audio');
      terminal = { module: vcaId, jack: 'out' };
      stages.vca = vcaId;
      for (const env of envelopes) {
        const envId = nextId('env');
        modules.push(instance(envId, 'core.env', adsrFromBreakpoints(env.bp)));
        const dest = envTargetJack(env.target, stages);
        if (dest) addCable(envId, 'out', dest.module, dest.jack, 'cv');
      }
    }

    audioTerminals.push(terminal);
  }

  // --- LFO modules (a source osc modulating another) ---
  for (const [osc, e] of [...oscEvents].sort((a, b) => a[0] - b[0])) {
    if (!modSources.has(osc)) continue;
    // find the target osc + param this LFO drives
    let depth = 0.5;
    let target: (typeof COEF_TARGETS)[number] = 'freq';
    let targetOsc: number | null = null;
    for (const [tOsc, te] of oscEvents) {
      if (te['mod_source'] === osc) {
        const found = findModTarget(te);
        if (found) {
          depth = round(found.weight, 4);
          target = found.param;
          targetOsc = tOsc;
        }
      }
    }
    const lfoId = nextId('lfo');
    modules.push(
      instance(lfoId, 'core.lfo', {
        wave: WAVE_TO_NAME[Number(e['wave'] ?? 0)] ?? 'sine',
        rate: coefConst(e['freq']),
        depth,
      }),
    );
    oscMap[lfoId] = [osc];
    if (targetOsc !== null) {
      const dest = modTargetJack(target, targetOsc, oscToModule, oscToStages);
      if (dest) addCable(lfoId, 'out', dest.module, dest.jack, 'cv');
    }
  }

  // --- output / mixing (audio-only, no wire impact) ---
  if (audioTerminals.length === 1) {
    const t = audioTerminals[0];
    if (t) {
      const outId = nextId('out');
      modules.push(instance(outId, 'core.out', {}));
      addCable(t.module, t.jack, outId, 'in', 'audio');
    }
  } else if (audioTerminals.length > 1) {
    const mixId = nextId('mixer');
    modules.push(instance(mixId, 'core.mixer4', {}));
    audioTerminals.slice(0, 4).forEach((t, i) => addCable(t.module, t.jack, mixId, `in${i + 1}`, 'audio'));
    const outId = nextId('out');
    modules.push(instance(outId, 'core.out', {}));
    addCable(mixId, 'out', outId, 'in', 'audio');
  }

  // --- global effects ---
  for (const e of fxEvents) {
    if (e['reverb'] !== undefined) {
      const [level, liveness, damping] = asList(e['reverb']);
      modules.push(instance(nextId('reverb'), 'core.fx.reverb', num3('level', level, 'liveness', liveness, 'damping', damping)));
    } else if (e['chorus'] !== undefined) {
      const [level, , rate, depth] = asList(e['chorus']);
      modules.push(instance(nextId('chorus'), 'core.fx.chorus', num3('level', level, 'rate', rate, 'depth', depth)));
    } else if (e['echo'] !== undefined) {
      const [level, time, , feedback] = asList(e['echo']);
      modules.push(instance(nextId('echo'), 'core.fx.echo', num3('level', level, 'time', time, 'feedback', feedback)));
    } else if (e['eq'] !== undefined) {
      const [low, mid, high] = asList(e['eq']);
      modules.push(instance(nextId('eq'), 'core.fx.eq', num3('low', low, 'mid', mid, 'high', high)));
    }
  }

  layout(modules, cables);

  const now = new Date().toISOString();
  return patchDocSchema.parse({
    version: PATCHDOC_VERSION,
    meta: {
      id: crypto.randomUUID(),
      name: 'Board Import',
      tags: [],
      createdAt: now,
      modifiedAt: now,
      origin: 'board-import',
    },
    modules,
    cables,
    allocation: { oscMap, synthMap },
    extras: { unmappedWire: unmapped, userLoopCode: null },
  });
}

// --- helpers ---------------------------------------------------------------

function instance(id: string, type: string, params: Record<string, string | number | boolean>): ModuleInstance {
  return { id, type, label: id, pos: { x: 0, y: 0 }, params, advanced: false, state: {} };
}

function coefConst(value: unknown): number {
  if (Array.isArray(value)) return typeof value[0] === 'number' ? value[0] : 0;
  return typeof value === 'number' ? value : 0;
}

function coefSlot(value: unknown, slot: string): number | null {
  if (!Array.isArray(value)) return null;
  const v = value[COEF_ORDER.indexOf(slot as (typeof COEF_ORDER)[number])];
  return typeof v === 'number' ? v : null;
}

interface EnvSpec {
  bp: number[];
  target: (typeof COEF_TARGETS)[number];
}

function collectEnvelopes(e: AmyEvent): EnvSpec[] {
  const out: EnvSpec[] = [];
  for (const [egName, key] of [
    ['eg0', 'bp0'],
    ['eg1', 'bp1'],
  ] as const) {
    const bp = e[key];
    if (!Array.isArray(bp)) continue;
    out.push({ bp: bp.map((n) => (typeof n === 'number' ? n : 0)), target: findEgTarget(e, egName) ?? 'amp' });
  }
  return out;
}

function findEgTarget(e: AmyEvent, egName: string): (typeof COEF_TARGETS)[number] | null {
  for (const param of COEF_TARGETS) {
    const w = coefSlot(e[param], egName);
    if (w !== null && w !== 0) return param;
  }
  return null;
}

function findModTarget(e: AmyEvent): { param: (typeof COEF_TARGETS)[number]; weight: number } | null {
  for (const param of COEF_TARGETS) {
    const w = coefSlot(e[param], 'mod');
    if (w !== null) return { param, weight: w };
  }
  return null;
}

/** ADSR params from an AMY breakpoint list `a,1,d,s,r,0`. */
function adsrFromBreakpoints(bp: number[]): Record<string, number> {
  return {
    attack: bp[0] ?? 5,
    decay: bp[2] ?? 100,
    sustain: bp[3] ?? 0.7,
    release: bp[4] ?? 200,
  };
}

function envTargetJack(target: string, stages: { vcf?: string; vca?: string }): { module: string; jack: string } | null {
  if (target === 'filter_freq' && stages.vcf) return { module: stages.vcf, jack: 'cutoff_cv' };
  if (stages.vca) return { module: stages.vca, jack: 'cv' };
  return null;
}

function modTargetJack(
  target: string,
  targetOsc: number,
  oscToModule: Map<number, string>,
  oscToStages: Map<number, { vcf?: string; vca?: string }>,
): { module: string; jack: string } | null {
  const stages = oscToStages.get(targetOsc);
  if (target === 'filter_freq' && stages?.vcf) return { module: stages.vcf, jack: 'cutoff_cv' };
  if (target === 'amp' && stages?.vca) return { module: stages.vca, jack: 'cv' };
  const src = oscToModule.get(targetOsc);
  return src ? { module: src, jack: 'fm' } : null; // freq / default → VCO fm input
}

function asList(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((n) => (typeof n === 'number' ? n : 0));
  return typeof value === 'number' ? [value] : [];
}

function num3(ka: string, a: number | undefined, kb: string, b: number | undefined, kc: string, c: number | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (a !== undefined) out[ka] = round(a, 4);
  if (b !== undefined) out[kb] = round(b, 4);
  if (c !== undefined) out[kc] = round(c, 4);
  return out;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Reverse a name→number map, keeping the first preferred name per number. */
function reverseFirst(map: Record<string, number>, prefer: string[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const name of prefer) {
    const n = map[name];
    if (n !== undefined && out[n] === undefined) out[n] = name;
  }
  for (const [name, n] of Object.entries(map)) if (out[n] === undefined) out[n] = name;
  return out;
}

/** Auto-layout modules left→right by longest incoming-cable depth (docs/03 §4). */
function layout(modules: ModuleInstance[], cables: Cable[]): void {
  const incoming = new Map<string, string[]>();
  for (const c of cables) {
    const list = incoming.get(c.to.module) ?? [];
    list.push(c.from.module);
    incoming.set(c.to.module, list);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const compute = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const sources = incoming.get(id) ?? [];
    const d = sources.length === 0 ? 0 : 1 + Math.max(...sources.map(compute));
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  const rowInColumn = new Map<number, number>();
  for (const m of modules) {
    const col = compute(m.id);
    const row = rowInColumn.get(col) ?? 0;
    rowInColumn.set(col, row + 1);
    m.pos = { x: col * 12, y: row * 8 };
  }
}
