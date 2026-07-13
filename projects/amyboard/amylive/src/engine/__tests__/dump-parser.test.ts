// ─── Dump Parser Tests ────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { parseDumpToPatch } from '../dump-parser'

describe('parseDumpToPatch()', () => {
  it('parses a simple oscillator dump', () => {
    const raw = new TextEncoder().encode(
      'v0w0f440a0.8Q0.5y0Z' +
      'v0G1F8000R0.7Z' +
      'v0A50,1,300,0.5,600,0T0Z' +
      'i0K0Z'
    )
    const patch = parseDumpToPatch(raw, 0)
    expect(patch.name).toBe('Patch #0')
    expect(patch.state.oscillators).toHaveLength(1)
    expect(patch.state.synths).toHaveLength(1)

    const osc = patch.state.oscillators[0]
    expect(osc.osc).toBe(0)
    expect(osc.wave).toBe(0)
    expect(osc.freq).toEqual({ const: 440 })
    expect(osc.amp).toEqual({ const: 0.8 })
    expect(osc.pan).toEqual({ const: 0.5 })
    expect(osc.bus).toBe(0)
    expect(osc.filter_type).toBe(1)
    expect(osc.filter_freq).toEqual({ const: 8000 })
    expect(osc.resonance).toBe(0.7)
    expect(osc.bp0).toBe('50,1,300,0.5,600,0')
    expect(osc.eg0_type).toBe(0)

    const synth = patch.state.synths[0]
    expect(synth.synth).toBe(0)
    expect(synth.patch).toBe(0)
    expect(synth.num_voices).toBe(6)
  })

  it('parses a multi-oscillator dump', () => {
    const raw = new TextEncoder().encode(
      'v0w0f440a0.8Q0.5y0Z' +
      'v1w3f880a0.6Q0.3y1Z'
    )
    const patch = parseDumpToPatch(raw)
    expect(patch.state.oscillators).toHaveLength(2)
    expect(patch.state.oscillators[0].osc).toBe(0)
    expect(patch.state.oscillators[0].freq).toEqual({ const: 440 })
    expect(patch.state.oscillators[1].osc).toBe(1)
    expect(patch.state.oscillators[1].freq).toEqual({ const: 880 })
    expect(patch.state.oscillators[1].wave).toBe(3)
    expect(patch.state.oscillators[1].bus).toBe(1)
  })

  it('handles CtrlCoef values', () => {
    const raw = new TextEncoder().encode(
      'v0f,60,0.8,0.5,0,0,0,0,0a,0,0.5,0,0,0,0,0,0Z' +
      'i0K42Z'
    )
    const patch = parseDumpToPatch(raw, 42)
    expect(patch.state.oscillators).toHaveLength(1)
    const osc = patch.state.oscillators[0]
    expect(osc.freq).toMatchObject({ note: 60, vel: 0.8, eg0: 0.5 })
    expect(osc.amp).toMatchObject({ vel: 0.5 })
    expect(patch.state.synths[0].patch).toBe(42)
  })

  it('creates a default oscillator when dump is empty', () => {
    const raw = new TextEncoder().encode('Z')
    const patch = parseDumpToPatch(raw)
    expect(patch.state.oscillators).toHaveLength(1)
    const osc = patch.state.oscillators[0]
    expect(osc.osc).toBe(0)
    expect(osc.wave).toBe(0)
    expect(osc.freq).toEqual({ const: 440 })
    expect(osc.amp).toEqual({ const: 0.8 })
  })

  it('handles newline-separated lines', () => {
    const raw = new TextEncoder().encode(
      'v0w0f440a0.8Q0.5y0\nv0G1F8000R0.7\ni0K0\n'
    )
    const patch = parseDumpToPatch(raw, 0)
    expect(patch.state.oscillators).toHaveLength(1)
    expect(patch.state.oscillators[0].osc).toBe(0)
    expect(patch.state.oscillators[0].wave).toBe(0)
    expect(patch.state.synths[0].synth).toBe(0)
    expect(patch.state.synths[0].patch).toBe(0)
  })

  it('ignores unknown lines gracefully', () => {
    const raw = new TextEncoder().encode(
      'v0w0f440Z' +
      'x1y2z3' +
      'i0K0Z'
    )
    const patch = parseDumpToPatch(raw, 0)
    expect(patch.state.oscillators).toHaveLength(1)
    expect(patch.state.oscillators[0].osc).toBe(0)
    expect(patch.state.oscillators[0].freq).toEqual({ const: 440 })
  })
})