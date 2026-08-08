/**
 * Default presets — loaded when localStorage has no saved presets.
 * Format matches store's savePreset output for compatibility.
 */

const DEFAULT_PRESETS = [
  {
    id: 'default-techno',
    name: 'Techno Heavy',
    timestamp: 0,
    genres: { acid: 10, house: 5, techno: 70, trance: 0, dnb: 10, hiphop: 5 },
    mood: { darkness: 70, energy: 85, complexity: 40, density: 80, groove: 45, weirdness: 30 },
    bpm: 130,
    swingMode: 'global',
    swingAmount: 20,
    trackSwing: { drums: 20, bass: 20, synth: 20 },
    tracks: {
      drums: { channel: 10, muted: false, solo: false, volume: 100 },
      bass:  { channel: 8,  muted: false, solo: false, volume: 100 },
      synth: { channel: 3,  muted: false, solo: false, volume: 100 },
    },
  },
  {
    id: 'default-chill',
    name: 'Chill House',
    timestamp: 0,
    genres: { acid: 5, house: 60, techno: 5, trance: 10, dnb: 0, hiphop: 20 },
    mood: { darkness: 30, energy: 40, complexity: 35, density: 45, groove: 75, weirdness: 20 },
    bpm: 118,
    swingMode: 'global',
    swingAmount: 65,
    trackSwing: { drums: 65, bass: 65, synth: 65 },
    tracks: {
      drums: { channel: 10, muted: false, solo: false, volume: 100 },
      bass:  { channel: 8,  muted: false, solo: false, volume: 100 },
      synth: { channel: 3,  muted: false, solo: false, volume: 100 },
    },
  },
  {
    id: 'default-acid',
    name: 'Acid Madness',
    timestamp: 0,
    genres: { acid: 50, house: 5, techno: 30, trance: 5, dnb: 10, hiphop: 0 },
    mood: { darkness: 60, energy: 90, complexity: 70, density: 75, groove: 55, weirdness: 85 },
    bpm: 135,
    swingMode: 'global',
    swingAmount: 40,
    trackSwing: { drums: 40, bass: 40, synth: 40 },
    tracks: {
      drums: { channel: 10, muted: false, solo: false, volume: 100 },
      bass:  { channel: 8,  muted: false, solo: false, volume: 100 },
      synth: { channel: 3,  muted: false, solo: false, volume: 100 },
    },
  },
]

export default DEFAULT_PRESETS
