import { describe, it, expect } from 'vitest'
import { parsePatchState, parseBreakpoints, coefToSliders } from '../patch-parser'
import { JUNO_PATCHES, DX7_PATCHES } from '../../lib/amy-patches'
import type { AmyOscState, AmySynthState, AmyFxState } from '../../types/amy'

describe('parsePatchState()', () => {
  it('parses the first Juno patch into modules', () => {
    const firstJuno = JUNO_PATCHES[0]
    // Build a minimal patch state with one default oscillator and synth
    const result = parsePatchState({
      name: firstJuno.name,
      number: firstJuno.number,
      state: {
        oscillators: [
          {
            osc: 0,
            wave: 0,
            freq: { const: 440 },
            amp: { const: 0.8 },
            pan: { const: 0.5 },
            filter_freq: { const: 8000 },
            duty: { const: 0.5 },
            filter_type: 1, // LPF
            resonance: 0.7,
            bp0: '100,1,300,0.5,600,0',
            bp1: '',
            eg0_type: 0,
            eg1_type: 0,
            mod_source: -1,
            feedback: 0,
            bus: 0,
            chained_osc: 0,
            phase: 0,
          } as AmyOscState,
          {
            osc: 1,
            wave: 3,
            freq: { const: 880 },
            amp: { const: 0.6 },
            pan: { const: 0.3 },
            filter_freq: { const: 4000 },
            duty: { const: 0.5 },
            filter_type: 1,
            resonance: 0.5,
            bp0: '200,0.8,400,0.3,700,0',
            bp1: '',
            eg0_type: 0,
            eg1_type: 0,
            mod_source: -1,
            feedback: 0,
            bus: 0,
            chained_osc: 0,
            phase: 0,
          } as AmyOscState,
        ],
        synths: [
          {
            synth: 0,
            patch: firstJuno.number,
            num_voices: 6,
            oscs_per_voice: 1,
            midi_channel: 1,
            portamento: 0,
            synth_delay: 0,
          } as AmySynthState,
        ],
        effects: [],
      } as any,
    })

    expect(result.modules.length).toBeGreaterThan(0)
    // Should have at least an oscillator module
    expect(result.modules.some((m) => m.moduleType === 'oscillator')).toBe(true)
    // Should have filter modules since filter_type is 1
    expect(result.modules.some((m) => m.moduleType === 'filter')).toBe(true)
    // Should have envelope modules since bp0 is set
    expect(result.modules.some((m) => m.moduleType === 'envelope')).toBe(true)
    // Should have chain links
    expect(result.chainLinks.length).toBeGreaterThan(0)
  })

  it('parses a patch with LFO from mod_source', () => {
    const result = parsePatchState({
      name: 'LFO Test',
      number: 999,
      state: {
        oscillators: [
          {
            osc: 0,
            wave: 0,
            freq: { const: 220 },
            amp: { const: 0.8 },
            pan: { const: 0.5 },
            filter_freq: { const: 8000 },
            duty: { const: 0.5 },
            filter_type: 0,
            resonance: 0,
            bp0: '',
            bp1: '',
            eg0_type: 0,
            eg1_type: 0,
            mod_source: 1,
            feedback: 0,
            bus: 0,
            chained_osc: 0,
            phase: 0,
          } as AmyOscState,
        ],
        synths: [
          { synth: 0, patch: 999, num_voices: 6, oscs_per_voice: 1, midi_channel: 1, portamento: 0, synth_delay: 0 } as AmySynthState,
        ],
        effects: [],
      } as any,
    })

    expect(result.modules.some((m) => m.moduleType === 'lfo')).toBe(true)
  })
})

describe('parseBreakpoints()', () => {
  it('parses a standard envelope breakpoint string', () => {
    const bp = parseBreakpoints('50,1,200,0.5,300,0')
    expect(bp.attack).toBe(50)
    expect(bp.decay).toBe(150) // 200 - 50
    expect(bp.sustain).toBe(0.5)
    expect(bp.release).toBe(100) // 300 - 200
  })

  it('handles minimal breakpoint data', () => {
    const bp = parseBreakpoints('100,1,400,0')
    expect(bp.attack).toBe(100)
    expect(bp.sustain).toBe(0)
  })

  it('returns defaults for empty string', () => {
    const bp = parseBreakpoints('')
    expect(bp.attack).toBe(100)
    expect(bp.decay).toBe(200)
    expect(bp.sustain).toBe(0.5)
    expect(bp.release).toBe(300)
  })
})

describe('coefToSliders()', () => {
  it('converts coefs to slider values', () => {
    const sliders = coefToSliders({ const: 1, note: 0.5, eg0: 1 })
    expect(sliders.noteTrack).toBe(0.5)
    expect(sliders.eg0Amount).toBe(1)
    expect(sliders.lfoAmount).toBe(0) // default
  })

  it('handles empty coefs', () => {
    const sliders = coefToSliders({})
    expect(sliders.noteTrack).toBe(0)
    expect(sliders.vel).toBe(0)
    expect(sliders.eg0Amount).toBe(0)
  })
})
