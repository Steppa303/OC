import { type ComponentType } from 'react'
import { AudioWaveform, Filter, Activity, Waves, Radio, Disc3, ChartNoAxesColumn, Piano, ChartGantt } from 'lucide-react'
import { OscillatorModule } from './oscillator'
import { FilterModule } from './filter'
import { EnvelopeModule } from './envelope'
import { LFOModule } from './lfo'
import { SynthModule } from './synth'
import type { AmyModule, ModuleProps } from '../types/amy'

interface RegisteredModule extends AmyModule {
  component: ComponentType<ModuleProps>
}

const moduleList: RegisteredModule[] = [
  {
    id: 'oscillator', name: 'Oszillator', icon: 'AudioWaveform',
    category: 'source', minWidth: 2, minHeight: 3,
    defaults: { osc: 0, wave: 0, freq: 440, amp: 0.8, pan: 0.5, bus: 0, detune: 0, portamento: 0 },
    component: OscillatorModule,
  },
  {
    id: 'filter', name: 'Filter', icon: 'Filter',
    category: 'filter', minWidth: 2, minHeight: 3,
    defaults: { osc: 0, filter_type: 1, cutoff: 8000, resonance: 0.7, modEg1: 0, modLfo: 0, modKey: 0 },
    component: FilterModule,
  },
  {
    id: 'envelope', name: 'Envelope', icon: 'Activity',
    category: 'envelope', minWidth: 2, minHeight: 3,
    defaults: { egId: 0, attack: 100, decay: 200, sustain: 0.5, release: 300, eg_type: 0 },
    component: EnvelopeModule,
  },
  {
    id: 'lfo', name: 'LFO', icon: 'Waves',
    category: 'modulation', minWidth: 2, minHeight: 3,
    defaults: { lfoId: 1, wave: 4, freq: 1.0, amp: 0.5, targetPitch: 0, targetFilter: 0, targetAmp: 0, targetPwm: 0, targetPan: 0 },
    component: LFOModule,
  },
  {
    id: 'synth', name: 'Synth Manager', icon: 'Radio',
    category: 'mixer', minWidth: 2, minHeight: 3,
    defaults: { synth: 0, num_voices: 6, patch: 0, midiCh: 1, portamento: 0 },
    component: SynthModule,
  },
]

const iconMap: Record<string, typeof AudioWaveform> = {
  AudioWaveform, Filter, Activity, Waves, Radio, Disc3, ChartNoAxesColumn, Piano, ChartGantt,
}

class ModuleRegistry {
  private modules = new Map<string, RegisteredModule>()

  register(mod: RegisteredModule) {
    this.modules.set(mod.id, mod)
  }

  registerAll(mods: RegisteredModule[]) {
    mods.forEach(m => this.register(m))
  }

  get(id: string): RegisteredModule | undefined {
    return this.modules.get(id)
  }

  list(): RegisteredModule[] {
    return Array.from(this.modules.values())
  }

  getByCategory(cat: string): RegisteredModule[] {
    return this.list().filter(m => m.category === cat)
  }

  getDefaults(id: string): Record<string, any> {
    return { ...this.get(id)?.defaults }
  }

  getIcon(id: string): ComponentType<{ size?: number; className?: string }> {
    const mod = this.get(id)
    if (!mod) return AudioWaveform
    return iconMap[mod.icon] ?? AudioWaveform
  }
}

export const moduleRegistry = new ModuleRegistry()
moduleRegistry.registerAll(moduleList)

export { OscillatorModule, FilterModule, EnvelopeModule, LFOModule, SynthModule }