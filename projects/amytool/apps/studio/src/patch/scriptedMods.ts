/**
 * Scripted modulation (Stufe 5). AMY natively modulates only the per-oscillator
 * coef targets (amp/freq/filter_freq/duty/pan). Anything else — effect params
 * like delay feedback, filter resonance, … — is modulated at control rate by a
 * generated sketch `loop()`: each scripted cable gets a Python variable the loop
 * writes into the target via `amy.send(...)`, and the app pushes the current
 * source value into that variable every tick (reusing the P6-03 var-writeback
 * path, so it works in the simulator and on the board).
 *
 * This module is the single source of truth for that derivation, shared by the
 * loop generator and the engine's value pusher, so both agree on variable names.
 */
import { COEF_TARGETS, type ModuleInfoProvider, type PatchDoc } from '@amy/patchdoc';

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export interface ScriptedMod {
  cableId: string;
  /** Deterministic Python variable name, e.g. `mod1`. */
  varName: string;
  source: { module: string; jack: string };
  target: { module: string; type: string; param: string };
}

/** Every cv cable that drives a non-coef target — realized by the mod loop. */
export function scriptedMods(doc: PatchDoc, provider: ModuleInfoProvider): ScriptedMod[] {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  const typeById = new Map(doc.modules.map((m) => [m.id, m.type]));
  const mods: ScriptedMod[] = [];
  let n = 0;
  for (const c of [...doc.cables].sort(byId)) {
    if (c.kind !== 'cv') continue;
    const targetType = typeById.get(c.to.module);
    if (!targetType) continue;
    const jack = provider(targetType)?.jacks.find((j) => j.id === c.to.jack);
    const param = jack?.target;
    if (!param || COEF_TARGETS.includes(param)) continue; // native, not scripted
    n += 1;
    mods.push({
      cableId: c.id,
      varName: `mod${n}`,
      source: { module: c.from.module, jack: c.from.jack },
      target: { module: c.to.module, type: targetType, param },
    });
  }
  return mods;
}

/** One `amy.send(...)` line that writes a scripted target from its variable. */
function targetSend(doc: PatchDoc, mod: ScriptedMod): string | null {
  const t = doc.modules.find((m) => m.id === mod.target.module);
  if (!t) return null;
  if (t.type === 'core.fx.echo' && mod.target.param === 'feedback') {
    return `    amy.send(echo=[${num(t.params['level'], 0.4)}, ${num(t.params['time'], 300)}, 2000, ${mod.varName}, 0])`;
  }
  // Extensible: other fx params / per-osc scalar params land here.
  return null;
}

export interface ModLoop {
  code: string;
  mods: ScriptedMod[];
}

/**
 * Build the control loop for a patch's scripted mods, or null when there are
 * none we can realize. The declared variables are pushed each tick by the engine.
 */
export function buildModLoop(doc: PatchDoc, provider: ModuleInfoProvider): ModLoop | null {
  const all = scriptedMods(doc, provider);
  const realized = all.filter((m) => targetSend(doc, m) !== null);
  if (realized.length === 0) return null;
  const decls = realized.map((m) => `${m.varName} = 0.0`).join('\n');
  const sends = realized.map((m) => targetSend(doc, m)).join('\n');
  const code = `import amy\n${decls}\n\ndef loop():\n${sends}\n`;
  return { code, mods: realized };
}

/** Current value (0..1-ish) of a scripted mod's source, for pushing into its var. */
export function modSourceValue(doc: PatchDoc, mod: ScriptedMod): number {
  const src = doc.modules.find((m) => m.id === mod.source.module);
  if (!src) return 0;
  // Keyboard aftertouch / pressure macro (sim source).
  if (src.type === 'core.keyboard' && mod.source.jack === 'aftertouch') {
    return num(src.params['pressure'], 0);
  }
  // Extensible: core.cvin (via cvsim), LFO value, … land here.
  return 0;
}

/** A signature that changes whenever the mod loop or its pushed values must be
 *  rebuilt (structure or target params), so the engine can react. */
export function modLoopSignature(doc: PatchDoc, provider: ModuleInfoProvider): string {
  const mods = scriptedMods(doc, provider);
  return mods
    .map((m) => {
      const t = doc.modules.find((x) => x.id === m.target.module);
      return `${m.varName}:${m.source.module}.${m.source.jack}->${m.target.module}.${m.target.param}:${
        t ? JSON.stringify(t.params) : ''
      }`;
    })
    .join('|');
}
