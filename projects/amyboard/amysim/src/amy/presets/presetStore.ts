import { create } from 'zustand';
import type { SynthState, Preset, OscillatorState } from '../../lib/types';

interface PresetStore {
  presets: Preset[];
  currentPatch: SynthState;
  loadPreset: (id: string) => void;
  savePreset: (name: string, description?: string) => void;
  deletePreset: (id: string) => void;
  updatePatch: (patch: Partial<SynthState>) => void;
  updateOsc: (oscIndex: number, osc: Partial<OscillatorState>) => void;
}

// Standard-Patch (Juno-artig)
function defaultSynthState(): SynthState {
  return {
    id: 0,
    patchNumber: 0,
    numVoices: 4,
    oscsPerVoice: 2,
    oscillators: [
      {
        wave: 0, // SINE
        freq: { const: 440 },
        amp: { const: 0.5, vel: 0.3 },
        duty: { const: 0.5 },
        pan: { const: 0.5 },
        phase: 0,
        filterType: -1, // NONE
        filterFreq: { const: 1 },
        resonance: 0.7,
        modSource: null,
        eg0: {
          breakpoints: [[0, 1], [50, 1], [200, 0.5], [300, 0]],
          type: 'normal',
        },
        eg1: {
          breakpoints: [[0, 1], [50, 0.8], [200, 0.3], [500, 0]],
          type: 'normal',
        },
      },
      {
        wave: 0,
        freq: { const: 440, note: 1 },
        amp: { const: 0.3, vel: 0.2 },
        duty: { const: 0.5 },
        pan: { const: 0.5 },
        phase: 0,
        filterType: -1,
        filterFreq: { const: 1 },
        resonance: 0.7,
        modSource: null,
        eg0: {
          breakpoints: [[0, 1], [50, 1], [200, 0.5], [300, 0]],
          type: 'normal',
        },
        eg1: {
          breakpoints: [[0, 1], [50, 0.8], [200, 0.3], [500, 0]],
          type: 'normal',
        },
      },
    ],
    lfos: [],
    portamento: 0,
    synthDelay: 0,
    synthFlags: 2, // POLY
    volume: 0.7,
  };
}

function loadFromStorage(): Preset[] {
  try {
    const data = localStorage.getItem('amysim-presets');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: loadFromStorage(),
  currentPatch: defaultSynthState(),

  loadPreset: (id: string) => {
    const presets = get().presets;
    const preset = presets.find(p => p.id === id);
    if (preset && preset.state.length > 0) {
      set({ currentPatch: { ...preset.state[0] } });
    }
  },

  savePreset: (name: string, description = '') => {
    const state = get().currentPatch;
    const preset: Preset = {
      id: crypto.randomUUID(),
      name,
      description,
      category: 'user',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: [state],
    };
    const presets = [...get().presets, preset];
    localStorage.setItem('amysim-presets', JSON.stringify(presets));
    set({ presets });
  },

  deletePreset: (id: string) => {
    const presets = get().presets.filter(p => p.id !== id);
    localStorage.setItem('amysim-presets', JSON.stringify(presets));
    set({ presets });
  },

  updatePatch: (patch: Partial<SynthState>) => {
    set(state => ({
      currentPatch: { ...state.currentPatch, ...patch },
    }));
  },

  updateOsc: (oscIndex: number, osc: Partial<OscillatorState>) => {
    set(state => {
      const oscillators = [...state.currentPatch.oscillators];
      oscillators[oscIndex] = { ...oscillators[oscIndex], ...osc };
      return {
        currentPatch: { ...state.currentPatch, oscillators },
      };
    });
  },
}));