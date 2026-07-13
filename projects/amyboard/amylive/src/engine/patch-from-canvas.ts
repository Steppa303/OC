// ─── Canvas → Patch Converter ─────────────────────────────────────────
// Builds an AmyPatch from the current canvas module state. Iterates
// over all modules and groups them by type (oscillator, filter, envelope,
// synth, lfo) to reconstruct the structured patch state.

import type { AmyPatch, AmyOscState, AmySynthState, CanvasModule, WaveType, FilterType } from '@/types/amy';

// ─── Generate unique ID ───────────────────────────────────────────────
function genId(): string {
  return `canvas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Module → Patch ───────────────────────────────────────────────────
export function canvasToPatch(
  modules: CanvasModule[],
  name?: string,
): AmyPatch {
  // Group modules by targetOsc
  const oscModules = modules.filter((m) => m.moduleType === 'oscillator');
  const filterModules = modules.filter((m) => m.moduleType === 'filter');
  const envelopeModules = modules.filter((m) => m.moduleType === 'envelope');
  const lfoModules = modules.filter((m) => m.moduleType === 'lfo');
  const synthModules = modules.filter((m) => m.moduleType === 'synth');

  // Build oscillators
  const oscillators: AmyOscState[] = [];

  // Collect unique osc numbers
  const oscNums = new Set<number>();
  for (const m of oscModules) oscNums.add(m.params.osc ?? 0);
  for (const m of filterModules) oscNums.add(m.params.osc ?? 0);
  for (const m of envelopeModules) oscNums.add(m.params.osc ?? 0);
  for (const m of lfoModules) oscNums.add(m.params.osc ?? 0);

  if (oscNums.size === 0) {
    // Default single oscillator
    oscillators.push(createDefaultOsc(0));
  } else {
    for (const oscNum of Array.from(oscNums).sort()) {
      const oscMod = oscModules.find((m) => (m.params.osc ?? 0) === oscNum);
      const filterMod = filterModules.find((m) => (m.params.osc ?? 0) === oscNum);
      const envMods = envelopeModules.filter((m) => (m.params.osc ?? 0) === oscNum);
      const lfoMod = lfoModules.find((m) => (m.params.osc ?? 0) === oscNum);

      const osc: AmyOscState = createDefaultOsc(oscNum);

      // Apply oscillator module params
      if (oscMod) {
        const p = oscMod.params;
        osc.wave = (p.wave ?? 0) as WaveType;
        osc.freq = { const: p.freq ?? 440 };
        osc.amp = { const: p.amp ?? 0.8 };
        osc.pan = { const: p.pan ?? 0.5 };
        osc.bus = p.bus ?? 0;

        // Merge freqCoefs (note tracking, vel, etc.)
        if (p.freqCoefs) {
          const coef = osc.freq as Record<string, number>;
          if (typeof coef === 'object') {
            if (p.freqCoefs.note) coef.note = p.freqCoefs.note;
            if (p.freqCoefs.vel) coef.vel = p.freqCoefs.vel;
            if (p.freqCoefs.eg0) coef.eg0 = p.freqCoefs.eg0;
            if (p.freqCoefs.eg1) coef.eg1 = p.freqCoefs.eg1;
            if (p.freqCoefs.mod) coef.mod = p.freqCoefs.mod;
          }
        }
        // Same for ampCoefs
        if (p.ampCoefs) {
          const ampCoef = osc.amp as Record<string, number>;
          if (typeof ampCoef === 'object') {
            if (p.ampCoefs.note) ampCoef.note = p.ampCoefs.note;
            if (p.ampCoefs.vel) ampCoef.vel = p.ampCoefs.vel;
            if (p.ampCoefs.eg0) ampCoef.eg0 = p.ampCoefs.eg0;
            if (p.ampCoefs.eg1) ampCoef.eg1 = p.ampCoefs.eg1;
            if (p.ampCoefs.mod) ampCoef.mod = p.ampCoefs.mod;
          }
        }
      }

      // Apply filter module params
      if (filterMod) {
        const p = filterMod.params;
        osc.filter_type = (p.filter_type ?? 1) as FilterType;
        osc.filter_freq = { const: p.cutoff ?? 8000 };
        osc.resonance = p.resonance ?? 0.7;
      }

      // Apply envelope module params
      for (const envMod of envMods) {
        const p = envMod.params;
        const egId = p.egId ?? 0;
        // Build breakpoint string from ADSR
        const totalA = p.attack ?? 100;
        const decay = p.decay ?? 200;
        const sustain = p.sustain ?? 0.5;
        const release = p.release ?? 300;
        const totalAD = totalA + decay;
        const totalADR = totalAD + release;
        const bpStr = `${totalA},1,${totalAD},${sustain},${totalADR},0`;

        if (egId === 0) {
          osc.bp0 = bpStr;
          osc.eg0_type = p.eg_type ?? 0;
        } else {
          osc.bp1 = bpStr;
          osc.eg1_type = p.eg_type ?? 0;
        }
      }

      // Apply LFO (mod_source)
      if (lfoMod) {
        osc.mod_source = lfoMod.params.lfoId ?? 1;
      }

      oscillators.push(osc);
    }
  }

  // Build synths
  const synths: AmySynthState[] = synthModules.length > 0
    ? synthModules.map((m) => ({
        synth: m.params.synth ?? 0,
        patch: m.params.patch ?? 0,
        num_voices: m.params.num_voices ?? 6,
        oscs_per_voice: 1,
        midi_channel: m.params.midiCh ?? 1,
        portamento: m.params.portamento ?? 0,
        synth_delay: 0,
      }))
    : [{
        synth: 0,
        patch: 0,
        num_voices: 6,
        oscs_per_voice: 1,
        midi_channel: 1,
        portamento: 0,
        synth_delay: 0,
      }];

  // Build wire commands from module params
  const wireCommands: string[] = [];
  for (const synth of synths) {
    wireCommands.push(`i${synth.synth}K${synth.patch}Z`);
  }
  for (const osc of oscillators) {
    let cmd = `v${osc.osc}`;
    cmd += `w${osc.wave}f${(osc.freq as Record<string, number>)?.const ?? 440}`;
    cmd += `a${(osc.amp as Record<string, number>)?.const ?? 0.8}`;
    cmd += `Q${(osc.pan as Record<string, number>)?.const ?? 0.5}`;
    cmd += `y${osc.bus}`;
    if (osc.filter_type !== 0) {
      cmd += `G${osc.filter_type}F${(osc.filter_freq as Record<string, number>)?.const ?? 8000}R${osc.resonance}`;
    }
    if (osc.bp0) cmd += `A${osc.bp0}`;
    if (osc.bp1) cmd += `B${osc.bp1}`;
    cmd += 'Z';
    wireCommands.push(cmd);
  }

  // Use display name from synth module if one exists on canvas
  const displayName = synthModules.length > 0 && synthModules[0].params.patch !== undefined
    ? `Patch #${synthModules[0].params.patch}`
    : 'Canvas Patch';

  const now = Date.now();
  const patch: AmyPatch = {
    id: genId(),
    name: name ?? displayName,
    author: 'User',
    category: 'user',
    tags: ['canvas-save'],
    state: {
      oscillators,
      synths,
      effects: [],
    },
    wireCommands,
    created: now,
    modified: now,
    boardSlot: synthModules.length > 0 ? synthModules[0].params.patch : undefined,
  };

  return patch;
}

// ─── Default Oscillator Helper ─────────────────────────────────────────
function createDefaultOsc(oscNum: number): AmyOscState {
  return {
    osc: oscNum,
    wave: 0 as WaveType,
    freq: { const: 440 },
    amp: { const: 0.8 },
    pan: { const: 0.5 },
    filter_freq: { const: 8000 },
    duty: { const: 0.5 },
    filter_type: 0 as FilterType,
    resonance: 0.7,
    bp0: '',
    bp1: '',
    eg0_type: 0,
    eg1_type: 0,
    mod_source: -1,
    feedback: 0,
    bus: 0,
    chained_osc: 0,
    phase: 0,
  };
}