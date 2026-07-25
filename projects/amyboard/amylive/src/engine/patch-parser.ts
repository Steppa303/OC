// ─── Patch → Module Parser ────────────────────────────────────────────
// Converts raw AMY patch state (from a zDZ dump or amy-patches.ts state)
// into canvas module instances with signal chain links.

import type {
  PatchParseResult,
  CanvasModule,
  SignalChainLink,
  ParsedBreakpoints,
  AmyOscState,
} from '@/types/amy'

// ─── Helper: Parse Breakpoints ────────────────────────────────────────
/**
 * Parse AMY breakpoint string → ADSR values
 * Format: "time1,value1,time2,value2,..."
 * Time values are absolute from envelope start.
 * Simple parser: first pair = attack peak, subsequent pairs build the shape.
 */
export function parseBreakpoints(bp: string): ParsedBreakpoints {
  const parts = bp.split(',').map((s) => parseFloat(s.trim()))

  // Default ADSR values
  let attack = 100
  let decay = 200
  let sustain = 0.5
  let release = 300

  if (parts.length >= 6) {
    // t1,v1,t2,v2,t3,v3 → attack=100ms peak=1, decay→200ms sustain=0.5, release→300ms 0
    attack = Math.max(1, parts[0])
    decay = Math.max(1, parts[2] - parts[0])
    sustain = Math.max(0, Math.min(1, parts[3] ?? 0.5))
    release = Math.max(1, parts[4] - parts[2])
  } else if (parts.length >= 4) {
    attack = Math.max(1, parts[0])
    decay = Math.max(1, parts[2] - parts[0])
    sustain = Math.max(0, Math.min(1, parts[3] ?? 0.5))
  }

  return { attack, decay, sustain, release }
}

// ─── Helper: CtrlCoef → Slider Values ────────────────────────────────
export interface CoefSliders {
  noteTrack: number
  vel: number
  eg0Amount: number
  eg1Amount: number
  lfoAmount: number
}

export function coefToSliders(coef: Record<string, number>): CoefSliders {
  return {
    noteTrack: coef.note ?? 0,
    vel: coef.vel ?? 0,
    eg0Amount: coef.eg0 ?? 0,
    eg1Amount: coef.eg1 ?? 0,
    lfoAmount: coef.mod ?? 0,
  }
}

// ─── Helper: Extract primitive value from CtrlCoef or number ─────────
function extractValue(
  val: number | string | Record<string, number> | undefined,
  fallback: number,
): number {
  if (val === undefined || val === null) return fallback
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = Number(val)
    return Number.isNaN(n) ? fallback : n
  }
  // CtrlCoefValues object – extract the "const" slot
  return (val as Record<string, number>).const ?? fallback
}

// ─── Helper: Generate unique instance ID ─────────────────────────────
function genId(): string {
  return `pm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Patch Parser ─────────────────────────────────────────────────────
export function parsePatchState(patch: {
  name: string
  number: number
  state: {
    oscillators: AmyOscState[]
    synths: { synth: number; patch: number; num_voices: number; oscs_per_voice: number; midi_channel: number; portamento: number }[]
  }
}): PatchParseResult {
  const modules: CanvasModule[] = []
  const chainLinks: SignalChainLink[] = []
  const errors: string[] = []

  // Track created module IDs by OSC number for linking
  const oscModuleIds = new Map<number, string>()
  const filterModuleIds = new Map<number, string>()

  let cardIndex = 0

  console.log('[parsePatchState] Starting with', patch.state.oscillators.length, 'oscillators,', patch.state.synths?.length, 'synths')

  // Phase 1: Create modules for each oscillator
  for (const osc of patch.state.oscillators) {
    try {
    const oscId = genId()
    const oscNum = osc.osc

    // Extract freq/amp/pan coefs
    const freqCoefs = (typeof osc.freq === 'object' && osc.freq !== null
      ? osc.freq
      : {}) as Record<string, number>
    const ampCoefs = (typeof osc.amp === 'object' && osc.amp !== null
      ? osc.amp
      : {}) as Record<string, number>

    // Base values
    const freq = extractValue(osc.freq as number | string | Record<string, number>, 440)
    const amp = extractValue(osc.amp as number | string | Record<string, number>, 0.8)
    const pan = extractValue(osc.pan as number | string | Record<string, number>, 0.5)
    const filterFreq = extractValue(
      osc.filter_freq as number | string | Record<string, number>,
      8000,
    )

    // Create OSC card
    modules.push({
      id: oscId,
      moduleType: 'oscillator',
      x: 0,
      y: cardIndex * 220,
      width: 280,
      height: 280,
      params: {
        osc: oscNum,
        wave: osc.wave ?? 0,
        freq,
        amp,
        pan,
        bus: osc.bus ?? 0,
        detune: 0,
        portamento: 0,
        freqCoefs: coefToSliders(freqCoefs),
        ampCoefs: coefToSliders(ampCoefs),
      },
      targetOsc: oscNum,
      targetSynth: patch.state.synths?.[0]?.synth ?? 0,
      cardIndex: cardIndex++,
      derivedFromPatch: true,
    })

    oscModuleIds.set(oscNum, oscId)

    // Create filter card if filter_type !== 0
    if (osc.filter_type !== undefined && osc.filter_type !== 0) {
      const filterId = genId()

      modules.push({
        id: filterId,
        moduleType: 'filter',
        x: 0,
        y: cardIndex * 220,
        width: 280,
        height: 260,
        params: {
          osc: oscNum,
          filter_type: osc.filter_type,
          cutoff: filterFreq,
          resonance: osc.resonance ?? 0.7,
          modEg1: 0,
          modLfo: 0,
          modKey: 0,
        },
        targetOsc: oscNum,
      targetSynth: patch.state.synths?.[0]?.synth ?? 0,
        cardIndex: cardIndex++,
        derivedFromPatch: true,
      })

      filterModuleIds.set(oscNum, filterId)

      // Chain link: oscillator → filter
      chainLinks.push({
        id: genId(),
        from: { moduleId: oscId, output: 'audio' },
        to: { moduleId: filterId, input: 'audio' },
      })
    }

    // Create EG0 envelope from bp0
    if (osc.bp0 && osc.bp0.length > 0 && osc.bp0 !== '0') {
      const egId = genId()
      const bp = parseBreakpoints(osc.bp0)

      modules.push({
        id: egId,
        moduleType: 'envelope',
        x: 0,
        y: cardIndex * 220,
        width: 280,
        height: 280,
        params: {
          osc: oscNum,
          egId: 0,
          eg_type: osc.eg0_type ?? 0,
          attack: bp.attack,
          decay: bp.decay,
          sustain: bp.sustain,
          release: bp.release,
        },
        targetOsc: oscNum,
      targetSynth: patch.state.synths?.[0]?.synth ?? 0,
        cardIndex: cardIndex++,
        derivedFromPatch: true,
      })

      // Chain link: envelope → oscillator (EG0 → amp)
      chainLinks.push({
        id: genId(),
        from: { moduleId: egId, output: 'envelope' },
        to: { moduleId: oscId, input: 'amp_mod' },
      })
    }

    // Create EG1 envelope from bp1
    if (osc.bp1 && osc.bp1.length > 0 && osc.bp1 !== '0') {
      const egId = genId()
      const bp = parseBreakpoints(osc.bp1)

      modules.push({
        id: egId,
        moduleType: 'envelope',
        x: 0,
        y: cardIndex * 220,
        width: 280,
        height: 280,
        params: {
          osc: oscNum,
          egId: 1,
          eg_type: osc.eg1_type ?? 0,
          attack: bp.attack,
          decay: bp.decay,
          sustain: bp.sustain,
          release: bp.release,
        },
        targetOsc: oscNum,
      targetSynth: patch.state.synths?.[0]?.synth ?? 0,
        cardIndex: cardIndex++,
        derivedFromPatch: true,
      })

      // Chain link: envelope → oscillator (EG1 → filter_freq)
      chainLinks.push({
        id: genId(),
        from: { moduleId: egId, output: 'envelope' },
        to: {
          moduleId: filterModuleIds.get(oscNum) ?? oscId,
          input: 'filter_mod',
        },
      })
    }

    // Detect LFO from mod_source
    if (osc.mod_source !== undefined && osc.mod_source >= 0 && osc.mod_source !== oscNum) {
      const lfoId = genId()

      modules.push({
        id: lfoId,
        moduleType: 'lfo',
        x: 0,
        y: cardIndex * 220,
        width: 280,
        height: 260,
        params: {
          lfoId: osc.mod_source,
          osc: oscNum,
          wave: 4, // Default triangle for LFO
          freq: 1.0,
          amp: 0.5,
          targetPitch: 1,
          targetFilter: 0,
          targetAmp: 0,
          targetPwm: 0,
          targetPan: 0,
        },
        targetOsc: oscNum,
      targetSynth: patch.state.synths?.[0]?.synth ?? 0,
        cardIndex: cardIndex++,
        derivedFromPatch: true,
      })

      // Chain link: LFO → oscillator
      chainLinks.push({
        id: genId(),
        from: { moduleId: lfoId, output: 'modulation' },
        to: { moduleId: oscId, input: 'mod_input' },
      })
    }
    } catch (err) {
      console.error('[parsePatchState] Error processing osc', osc.osc, ':', err)
      errors.push(`OSC ${osc.osc}: ${err}`)
    }
  }

  // Phase 2: Create synth module for each synth in patch state
  if (patch.state.synths && patch.state.synths.length > 0) {
    for (const synth of patch.state.synths) {
      const synthId = genId()
      const patchNum = synth.patch
      const foundPatch = patch.state.oscillators.length > 0
        ? patch.state.synths[0]
        : null

      modules.push({
        id: synthId,
        moduleType: 'synth',
        x: 0,
        y: cardIndex * 220,
        width: 280,
        height: 200,
        params: {
          synth: synth.synth,
          patch: synth.patch,
          num_voices: synth.num_voices ?? 6,
          midiCh: synth.midi_channel ?? 1,
          portamento: synth.portamento ?? 0,
        },
        targetSynth: synth.synth,
        cardIndex: cardIndex++,
        derivedFromPatch: true,
      })
    }
  } else {
    // Fallback: create a default synth module if no synths in dump
    const synthId = genId()
    modules.push({
      id: synthId,
      moduleType: 'synth',
      x: 0,
      y: cardIndex * 220,
      width: 280,
      height: 200,
      params: {
        synth: 0,
        patch: patch.number,
        num_voices: 6,
        midiCh: 1,
        portamento: 0,
      },
      targetSynth: 0,
      cardIndex: cardIndex++,
      derivedFromPatch: true,
    })
  }

  if (errors.length > 0) {
    console.warn('[parsePatchState] Completed with', errors.length, 'errors:', errors)
  }

  console.log('[parsePatchState] Result:', modules.length, 'modules,', chainLinks.length, 'chainLinks')

  return {
    modules,
    chainLinks,
    patchName: patch.name,
    patchNumber: patch.number,
  }
}