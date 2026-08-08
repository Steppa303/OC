import { create } from 'zustand'
import PresetStore from '../presets/PresetStore.js'

const useStore = create((set, get) => ({
  // Transport
  isPlaying: false,
  bpm: 120,
  currentStep: 0,

  // Genre Weights (0-100, independent — normalization only in engine)
  genres: {
    acid: 20,
    house: 15,
    techno: 40,
    trance: 5,
    dnb: 10,
    hiphop: 10,
  },

  // Active tab for card-based UI
  activeTab: 'global', // 'global' | 'drums' | 'bass' | 'synth'

  // Per-track genre overrides — null = synced to Global, otherwise object with same shape as genres
  trackGenreOverrides: {
    drums: null,
    bass: null,
    synth: null,
  },

  // Mood (0-100)
  mood: {
    darkness: 50,
    energy: 50,
    complexity: 50,
    density: 50,
    groove: 50,
    weirdness: 50,
  },

  // Swing
  swingMode: 'global', // 'global' | 'track'
  swingAmount: 50,
  trackSwing: { drums: 50, bass: 50, synth: 50 },

  // Tracks
  tracks: {
    drums: { channel: 10, muted: false, solo: false, volume: 100 },
    bass:  { channel: 8,  muted: false, solo: false, volume: 100 },
    synth: { channel: 3,  muted: false, solo: false, volume: 100 },
  },

  // MIDI
  midiAccess: null,
  midiOutput: null,
  midiDevices: [],
  midiConnected: false,
  midiInitFailed: false,

  // MIDI Clock Sync
  clockSource: 'internal',      // 'internal' | 'midi'
  midiInputDevices: [],
  selectedInputDevice: null,
  externalBpm: 0,
  isExternalRunning: false,
  externalTransportActive: false, // true when external device has started transport (always, regardless of clockSource)

  // Pattern dirty flag — set when params change mid-bar
  patternDirty: false,

  // Mutation & Next Pattern
  patternNonce: 0,
  mutationCount: { drums: 0, bass: 0, synth: 0 },

  // Per-track parameters
  trackParams: {
    drums: {
      density: null, complexity: null, groove: null,
      kickWeight: 100, snareWeight: 100, loTomWeight: 100, midTomWeight: 100, hiTomWeight: 100,
      rimWeight: 100, clapWeight: 100, chhWeight: 100, ohhWeight: 100, crashWeight: 100, rideWeight: 100,
    },
    bass: {
      density: null, complexity: null, groove: null,
      darkness: null, weirdness: null, octave: 0,
      rangeLow: 28, rangeHigh: 60, noteLength: 80,
    },
    synth: {
      density: null, complexity: null, groove: null,
      darkness: null, weirdness: null, octave: 0,
      rangeLow: 48, rangeHigh: 84, noteLength: 65,
      chordMode: 'off',
    },
  },

  // Presets
  presets: [],
  activePreset: null,
  showSettings: false,
  showPresets: false,

  // Actions — Transport
  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),
  play: () => set({ isPlaying: true }),
  stop: () => set({ isPlaying: false, currentStep: 0 }),
  setBpm: (bpm) => set({ bpm: Math.max(60, Math.min(200, bpm)) }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setPatternDirty: (dirty) => set({ patternDirty: dirty }),

  // Actions — Genres (clamping only, no normalization — engine handles it)
  setGenreWeight: (genre, value) => set(state => {
    // Reset mutation counts on genre change
    return {
      genres: { ...state.genres, [genre]: Math.max(0, Math.min(100, value)) },
      mutationCount: { drums: 0, bass: 0, synth: 0 },
      patternDirty: true,
    }
  }),

  // Actions — Active Tab
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Actions — Track Genre Sync & Overrides
  setTrackSync: (track, synced) => set(state => {
    if (synced) {
      // Re-sync: discard local overrides
      const overrides = { ...state.trackGenreOverrides, [track]: null }
      return { trackGenreOverrides: overrides, patternDirty: true }
    }
    // Un-sync: copy global values as starting point
    const overrides = { ...state.trackGenreOverrides, [track]: { ...state.genres } }
    return { trackGenreOverrides: overrides, mutationCount: { drums: 0, bass: 0, synth: 0 }, patternDirty: true }
  }),
  setTrackGenreOverride: (track, genre, value) => set(state => {
    const current = state.trackGenreOverrides[track] || { ...state.genres }
    const overrides = {
      ...state.trackGenreOverrides,
      [track]: { ...current, [genre]: Math.max(0, Math.min(100, value)) },
    }
    return { trackGenreOverrides: overrides, mutationCount: { drums: 0, bass: 0, synth: 0 }, patternDirty: true }
  }),

  // Actions — Mutate & Next Pattern
  mutateTrack: (track) => set(state => {
    const mutationCount = { ...state.mutationCount };
    mutationCount[track] = (mutationCount[track] || 0) + 1;
    return { mutationCount, patternDirty: true };
  }),
  nextPattern: () => set(state => ({
    patternNonce: (state.patternNonce || 0) + 1,
    patternDirty: true,
  })),
  resetMutationCounts: () => set({
    mutationCount: { drums: 0, bass: 0, synth: 0 },
  }),

  // Actions — Per-track parameters
  setTrackParam: (track, param, value) => set(state => ({
    trackParams: {
      ...state.trackParams,
      [track]: { ...state.trackParams[track], [param]: value },
    },
    patternDirty: true,
  })),
  resetTrackParam: (track, param) => set(state => ({
    trackParams: {
      ...state.trackParams,
      [track]: { ...state.trackParams[track], [param]: null },
    },
    patternDirty: true,
  })),

  // Actions — Mood (with dirty flag + mutation reset)
  setMood: (param, value) => set(state => ({
    mood: { ...state.mood, [param]: Math.max(0, Math.min(100, value)) },
    mutationCount: { drums: 0, bass: 0, synth: 0 },
    patternDirty: true,
  })),

  // Actions — Swing (with dirty flag + mutation reset)
  setSwingMode: (mode) => set({ swingMode: mode, mutationCount: { drums: 0, bass: 0, synth: 0 }, patternDirty: true }),
  setSwingAmount: (amount) => set({ swingAmount: Math.max(0, Math.min(100, amount)), mutationCount: { drums: 0, bass: 0, synth: 0 }, patternDirty: true }),
  setTrackSwing: (track, amount) => set(state => ({
    trackSwing: { ...state.trackSwing, [track]: Math.max(0, Math.min(100, amount)) },
    mutationCount: { drums: 0, bass: 0, synth: 0 },
    patternDirty: true,
  })),

  // Actions — Tracks
  toggleMute: (track) => set(state => ({
    tracks: {
      ...state.tracks,
      [track]: { ...state.tracks[track], muted: !state.tracks[track].muted }
    }
  })),
  toggleSolo: (track) => set(state => ({
    tracks: {
      ...state.tracks,
      [track]: { ...state.tracks[track], solo: !state.tracks[track].solo }
    }
  })),
  setTrackVolume: (track, volume) => set(state => ({
    tracks: {
      ...state.tracks,
      [track]: { ...state.tracks[track], volume: Math.max(0, Math.min(127, volume)) }
    }
  })),
  setTrackChannel: (track, channel) => set(state => ({
    tracks: {
      ...state.tracks,
      [track]: { ...state.tracks[track], channel: Math.max(1, Math.min(16, channel)) }
    }
  })),

  // Actions — MIDI
  setMidiAccess: (access) => set({ midiAccess: access }),
  setMidiOutput: (output) => set({ midiOutput: output, midiConnected: !!output }),
  setMidiDevices: (devices) => set({ midiDevices: devices }),
  setMidiInitFailed: (failed) => set({ midiInitFailed: failed }),

  // Actions — MIDI Clock Sync
  setClockSource: (source) => set({ clockSource: source }),
  setMidiInputDevices: (devices) => set({ midiInputDevices: devices }),
  setSelectedInputDevice: (device) => set({ selectedInputDevice: device }),
  setExternalBpm: (bpm) => set({ externalBpm: bpm }),
  setIsExternalRunning: (running) => set({ isExternalRunning: running }),
  setExternalTransportActive: (active) => set({ externalTransportActive: active }),

  // Actions — Presets (delegated to PresetStore)
  setPresets: (presets) => set({ presets }),
  setActivePreset: (id) => set({ activePreset: id }),
  savePreset: (name) => {
    const state = get()
    const preset = {
      id: Date.now().toString(36),
      name,
      timestamp: Date.now(),
      genres: { ...state.genres },
      trackGenreOverrides: state.trackGenreOverrides
        ? {
            drums: state.trackGenreOverrides.drums ? { ...state.trackGenreOverrides.drums } : null,
            bass: state.trackGenreOverrides.bass ? { ...state.trackGenreOverrides.bass } : null,
            synth: state.trackGenreOverrides.synth ? { ...state.trackGenreOverrides.synth } : null,
          }
        : { drums: null, bass: null, synth: null },
      mood: { ...state.mood },
      swingMode: state.swingMode,
      swingAmount: state.swingAmount,
      trackSwing: { ...state.trackSwing },
      tracks: JSON.parse(JSON.stringify(state.tracks)),
      bpm: state.bpm,
      patternNonce: state.patternNonce,
      mutationCount: { ...state.mutationCount },
      trackParams: JSON.parse(JSON.stringify(state.trackParams)),
    }
    const presets = [...state.presets, preset]
    const { saved } = PresetStore.save(presets)
    set({ presets: saved, activePreset: preset.id })
    return preset
  },
  loadPreset: (id) => {
    const state = get()
    const preset = state.presets.find(p => p.id === id)
    if (!preset) return
    const trackParams = (() => {
      if (!preset.trackParams) return get().trackParams
      const next = JSON.parse(JSON.stringify(preset.trackParams))
      const migrate = ['density', 'complexity', 'groove', 'darkness', 'weirdness']
      for (const track of ['drums', 'bass', 'synth']) {
        const tp = next[track]
        if (!tp) continue
        for (const param of migrate) {
          if (tp[param] === 50) tp[param] = null
        }
      }
      return next
    })()
    // Migrate trackGenreOverrides from old presets (no override = null = synced)
    let trackGenreOverrides = preset.trackGenreOverrides || null
    if (!trackGenreOverrides && preset.trackGenres) {
      // Legacy preset: migrate trackGenres → trackGenreOverrides (all unsynced)
      trackGenreOverrides = {
        drums: { ...preset.trackGenres.drums },
        bass: { ...preset.trackGenres.bass },
        synth: { ...preset.trackGenres.synth },
      }
    }
    if (!trackGenreOverrides) {
      trackGenreOverrides = { drums: null, bass: null, synth: null }
    }
    set({
      genres: { ...preset.genres },
      trackGenreOverrides,
      mood: { ...preset.mood },
      swingMode: preset.swingMode,
      swingAmount: preset.swingAmount,
      trackSwing: { ...preset.trackSwing },
      tracks: JSON.parse(JSON.stringify(preset.tracks)),
      bpm: preset.bpm,
      patternNonce: preset.patternNonce || 0,
      mutationCount: preset.mutationCount ? { ...preset.mutationCount } : { drums: 0, bass: 0, synth: 0 },
      trackParams,
      activePreset: id,
      patternDirty: true,
    })
  },
  deletePreset: (id) => {
    const state = get()
    const presets = state.presets.filter(p => p.id !== id)
    const { saved } = PresetStore.save(presets)
    set({ presets: saved, activePreset: state.activePreset === id ? null : state.activePreset })
  },

  // UI
  toggleSettings: () => set(state => ({ showSettings: !state.showSettings })),
  togglePresets: () => set(state => ({ showPresets: !state.showPresets })),
}))

// Load presets from localStorage on init; seed defaults if empty
try {
  const saved = PresetStore.load()
  if (saved.length > 0) {
    useStore.setState({ presets: saved })
  }
  // Defaults are always available via DEFAULT_PRESETS import in PresetManager
  // (not stored in localStorage to avoid clutter)
} catch (e) { /* */ }

export default useStore
