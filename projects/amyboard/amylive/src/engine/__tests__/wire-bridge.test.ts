import { describe, it, expect } from 'vitest'
import { cardParamsToWire } from '../wire-bridge'

describe('cardParamsToWire()', () => {
  it('generates oscillator wire message', () => {
    // cardParamsToWire includes all defaults: pan=0.5, bus=0
    const wire = cardParamsToWire('oscillator', { osc: 0, wave: 0, freq: 440, amp: 0.8 })
    expect(wire).toBe('v0w0f440a0.8Q0.5y0')
  })

  it('generates oscillator with explicit pan and bus', () => {
    const wire = cardParamsToWire('oscillator', { osc: 0, wave: 0, freq: 440, amp: 0.8, pan: 0.25, bus: 1 })
    expect(wire).toBe('v0w0f440a0.8Q0.25y1')
  })

  it('generates filter wire message', () => {
    const wire = cardParamsToWire('filter', { osc: 0, filter_type: 1, cutoff: 5000, resonance: 0.7 })
    expect(wire).toBe('v0G1F5000R0.7')
  })

  it('generates filter with 2-pole type', () => {
    const wire = cardParamsToWire('filter', { osc: 1, filter_type: 4, cutoff: 3000, resonance: 1.5 })
    expect(wire).toBe('v1G4F3000R1.5')
  })

  it('generates envelope wire message with breakpoints', () => {
    const wire = cardParamsToWire('envelope', { osc: 0, attack: 100, decay: 200, sustain: 0.5, release: 300, eg_type: 0, egId: 0 })
    // attack=100 → totalA=100, decay=200 → totalAD=300, release=300 → totalADR=600
    // bp: 100,1,300,0.5,600,0
    expect(wire).toContain('A') // should have breakpoints
    expect(wire).toContain('100,1')
    expect(wire).toContain('0.5')
    expect(wire).toContain('T0')
  })

  it('generates envelope with EG1 (bp1 instead of bp0)', () => {
    const wire = cardParamsToWire('envelope', { osc: 1, attack: 50, decay: 100, sustain: 0.7, release: 200, eg_type: 1, egId: 1 })
    // EG1 uses 'B' prefix
    expect(wire).toContain('B')
    expect(wire).toContain('T1')
  })

  it('generates LFO wire message', () => {
    const wire = cardParamsToWire('lfo', { osc: 0, lfoId: 1 })
    expect(wire).toBe('v0L1')
  })

  it('returns empty string for unknown module type', () => {
    const wire = cardParamsToWire('unknown', {})
    expect(wire).toBe('')
  })
})