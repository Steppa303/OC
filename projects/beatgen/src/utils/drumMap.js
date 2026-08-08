/**
 * General MIDI Drum Map (Channel 10)
 * Standard note assignments for drum instruments
 */

export const DRUM_MAP = {
  // Kick
  kick:           36,  // Bass Drum 1
  kickAlt:        35,  // Bass Drum (Acoustic)

  // Snare
  snare:          38,  // Acoustic Snare
  snareAlt:       40,  // Electric Snare
  sideStick:      37,  // Side Stick

  // Hi-Hat
  hihatClosed:    42,  // Closed Hi-Hat
  hihatOpen:      46,  // Open Hi-Hat
  hihatPedal:     44,  // Pedal Hi-Hat

  // Clap
  clap:           39,  // Hand Clap

  // Toms
  tomHi:          50,  // Hi Tom
  tomMid:         47,  // Mid Tom
  tomLow:         45,  // Low Tom
  tomFloorHi:     43,  // High Floor Tom
  tomFloorLo:     41,  // Low Floor Tom

  // Cymbals
  crash:          49,  // Crash Cymbal 1
  crash2:         57,  // Crash Cymbal 2
  ride:           51,  // Ride Cymbal 1
  rideBell:       53,  // Ride Bell
  splash:         55,  // Splash Cymbal
  china:          52,  // Chinese Cymbal

  // Percussion
  cowbell:        56,  // Cowbell
  tambourine:     54,  // Tambourine
  shaker:         70,  // Maracas (used as shaker)
  clave:          75,  // Claves
  rimshot:        37,  // Side Stick / Rimshot
  cabasa:         69,  // Cabasa
};

/**
 * Reverse lookup: MIDI note → instrument name
 */
export const NOTE_TO_DRUM = Object.fromEntries(
  Object.entries(DRUM_MAP).map(([name, note]) => [note, name])
);

/**
 * Get drum instrument name from MIDI note
 * @param {number} note - MIDI note number
 * @returns {string} - Instrument name or 'unknown'
 */
export function getDrumName(note) {
  return NOTE_TO_DRUM[note] || `note_${note}`;
}

/**
 * Template instrument keys used in genre definitions
 * These map to the DRUM_MAP entries
 */
/**
 * Template instrument keys — 11 instruments matching TR-8S standard kit.
 * Used in genre definitions and drum mix panel.
 */
export const TEMPLATE_KEYS = {
  kick:   DRUM_MAP.kick,        // BD Kick       → MIDI 36
  snare:  DRUM_MAP.snare,       // SD Snare      → MIDI 38
  loTom:  DRUM_MAP.tomLow,      // LT Low Tom    → MIDI 45
  midTom: DRUM_MAP.tomMid,      // MT Mid Tom    → MIDI 47
  hiTom:  DRUM_MAP.tomHi,       // HT Hi Tom     → MIDI 50
  rim:    DRUM_MAP.rimshot,     // RS Rim Shot   → MIDI 37
  clap:   DRUM_MAP.clap,        // HC Hand Clap  → MIDI 39
  chh:    DRUM_MAP.hihatClosed, // CH Closed HH  → MIDI 42
  ohh:    DRUM_MAP.hihatOpen,   // OH Open HH    → MIDI 46
  crash:  DRUM_MAP.crash,       // CR Crash      → MIDI 49
  ride:   DRUM_MAP.ride,        // RC Ride       → MIDI 51
};

/**
 * Ordered array of template keys for consistent iteration
 */
export const TEMPLATE_KEY_ORDER = ['kick', 'snare', 'loTom', 'midTom', 'hiTom', 'rim', 'clap', 'chh', 'ohh', 'crash', 'ride'];

/**
 * Human-readable labels for drum instruments
 */
export const DRUM_INSTRUMENT_LABELS = {
  kick: 'BD Kick',
  snare: 'SD Snare',
  loTom: 'LT Low Tom',
  midTom: 'MT Mid Tom',
  hiTom: 'HT Hi Tom',
  rim: 'RS Rim Shot',
  clap: 'HC Clap',
  chh: 'CH Closed HH',
  ohh: 'OH Open HH',
  crash: 'CR Crash',
  ride: 'RC Ride',
};
