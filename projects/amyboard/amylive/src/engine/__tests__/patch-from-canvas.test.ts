// ─── Canvas → Patch Tests ─────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { canvasToPatch } from '../patch-from-canvas'
import type { CanvasModule } from '@/types/amy'

function makeOsc(overrides: Partial<CanvasModule> = {}): CanvasModule {
  return {
    id: 'test-osc',
    moduleType: 'oscillator',
    x: 0, y: 0, width: 280, height: 280,
    params: { osc: 0, wave: 0, freq: 440, amp: 0.8, pan: 0.5, bus: 0 },
    targetOsc: 0, cardIndex: 0,
    ...overrides,
  }
}

function makeFilter(overrides: Partial<CanvasModule> = {}): CanvasModule {
  return {
    id: 'test-filter',
    moduleType: 'filter',
    x: 0, y: 0, width: 280, height: 260,
    params: { osc: 0, filter_type: 1, cutoff: 5000, resonance: 0.5 },
    targetOsc: 0, cardIndex: 1,
    ...overrides,
  }
}

function makeEnvelope(overrides: Partial<CanvasModule> = {}): CanvasModule {
  return {
    id: 'test-env',
    moduleType: 'envelope',
    x: 0, y: 0, width: 280, height: 280,
    params: { osc: 0, egId: 0, attack: 100, decay: 200, sustain: 0.5, release: 300, eg_type: 0 },
    targetOsc: 0, cardIndex: 2,
    ...overrides,
  }
}

function makeSynth(overrides: Partial<CanvasModule> = {}): CanvasModule {
  return {
    id: 'test-synth',
    moduleType: 'synth',
    x: 0, y: 0, width: 280, height: 320,
    params: { synth: 0, patch: 42, num_voices: 6, midiCh: 1, portamento: 0 },
    targetSynth: 0, cardIndex: 3,
    ...overrides,
  }
}

describe('canvasToPatch()', () => {
  it('converts a single oscillator module to patch', () => {
    const modules = [makeOsc()]
    const patch = canvasToPatch(modules)
    expect(patch.state.oscillators).toHaveLength(1)
    expect(patch.state.synths).toHaveLength(1)
    expect(patch.state.oscillators[0].osc).toBe(0)
    expect(patch.state.oscillators[0].freq).toEqual({ const: 440 })
    expect(patch.state.oscillators[0].amp).toEqual({ const: 0.8 })
    expect(patch.name).toBe('Canvas Patch')
    expect(patch.category).toBe('user')
    expect(patch.wireCommands.length).toBeGreaterThan(0)
  })

  it('converts oscillator + filter + envelope modules', () => {
    const modules = [makeOsc(), makeFilter(), makeEnvelope()]
    const patch = canvasToPatch(modules, 'My Test Patch')
    expect(patch.name).toBe('My Test Patch')
    expect(patch.state.oscillators).toHaveLength(1)
    const osc = patch.state.oscillators[0]
    expect(osc.filter_type).toBe(1)
    expect(osc.filter_freq).toEqual({ const: 5000 })
    expect(osc.resonance).toBe(0.5)
    expect(osc.bp0).toBe('100,1,300,0.5,600,0')
    expect(osc.eg0_type).toBe(0)
  })

  it('converts a synth module with patch number', () => {
    const modules = [makeOsc(), makeSynth({ params: { synth: 1, patch: 100, num_voices: 8, midiCh: 2, portamento: 0 } })]
    const patch = canvasToPatch(modules)
    expect(patch.state.synths).toHaveLength(1)
    const synth = patch.state.synths[0]
    expect(synth.synth).toBe(1)
    expect(synth.patch).toBe(100)
    expect(synth.num_voices).toBe(8)
    expect(synth.midi_channel).toBe(2)
  })

  it('handles multiple oscillators', () => {
    const modules = [
      makeOsc({ params: { osc: 0, wave: 0, freq: 440, amp: 0.8, pan: 0.5, bus: 0 } }),
      makeOsc({ id: 'test-osc2', params: { osc: 1, wave: 3, freq: 880, amp: 0.6, pan: 0.3, bus: 1 }, targetOsc: 1 }),
    ]
    const patch = canvasToPatch(modules)
    expect(patch.state.oscillators).toHaveLength(2)
    expect(patch.state.oscillators[0].freq).toEqual({ const: 440 })
    expect(patch.state.oscillators[1].freq).toEqual({ const: 880 })
    expect(patch.state.oscillators[1].wave).toBe(3)
    expect(patch.state.oscillators[1].bus).toBe(1)
  })

  it('handles envelope for EG1 (egId=1)', () => {
    const modules = [
      makeOsc(),
      makeEnvelope({
        id: 'test-env1',
        params: { osc: 0, egId: 1, attack: 50, decay: 100, sustain: 0.7, release: 200, eg_type: 1 },
        cardIndex: 2,
      }),
    ]
    const patch = canvasToPatch(modules)
    const osc = patch.state.oscillators[0]
    expect(osc.bp1).toBe('50,1,150,0.7,350,0')
    expect(osc.eg1_type).toBe(1)
  })

  it('returns default osc and synth for empty modules', () => {
    const patch = canvasToPatch([], 'Empty')
    expect(patch.state.oscillators).toHaveLength(1)
    expect(patch.state.synths).toHaveLength(1)
    expect(patch.state.oscillators[0].osc).toBe(0)
    expect(patch.state.synths[0].synth).toBe(0)
    expect(patch.state.synths[0].patch).toBe(0)
  })
})