/**
 * Musical scales, chords, and note utilities
 */

// Note names for MIDI note numbers (0-127)
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert MIDI note number to name (e.g. 60 → "C4")
 * @param {number} midi - MIDI note number (0-127)
 * @returns {string} - Note name with octave
 */
export function midiToName(midi) {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

/**
 * Convert note name to MIDI number (e.g. "C4" → 60)
 * @param {string} name - Note name (e.g. "C4", "F#3")
 * @returns {number} - MIDI note number
 */
export function nameToMidi(name) {
  const match = name.match(/^([A-G]#?)(-?\d)$/);
  if (!match) return 60;
  const noteIndex = NOTE_NAMES.indexOf(match[1]);
  const octave = parseInt(match[2], 10);
  return (octave + 1) * 12 + noteIndex;
}

// Scale definitions as semitone intervals from root
export const SCALES = {
  // Major & Minor
  major:        [0, 2, 4, 5, 7, 9, 11],
  minor:        [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor:[0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],

  // Pentatonic
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],

  // Blues & Modes
  blues:     [0, 3, 5, 6, 7, 10],
  dorian:    [0, 2, 3, 5, 7, 9, 10],
  phrygian:  [0, 1, 3, 5, 7, 8, 10],
  mixolydian:[0, 2, 4, 5, 7, 9, 10],
  lydian:    [0, 2, 4, 6, 7, 9, 11],
  locrian:   [0, 1, 3, 5, 6, 8, 10],

  // Electronic / Exotic
  wholeTone:   [0, 2, 4, 6, 8, 10],
  chromatic:   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  diminished:  [0, 2, 3, 5, 6, 8, 9, 11],
  arabian:     [0, 2, 4, 5, 6, 8, 10],
  japanese:    [0, 1, 5, 7, 8],
};

/**
 * Get all notes in a scale within a MIDI range
 * @param {string} scaleName - Scale name from SCALES
 * @param {number} root - Root MIDI note (e.g. 48 for C3)
 * @param {number} low - Lowest MIDI note
 * @param {number} high - Highest MIDI note
 * @returns {number[]} - Array of MIDI note numbers
 */
export function getScaleNotes(scaleName, root, low, high) {
  const intervals = SCALES[scaleName] || SCALES.minor;
  const notes = [];
  for (let octave = -2; octave <= 8; octave++) {
    for (const interval of intervals) {
      const note = root + octave * 12 + interval;
      if (note >= low && note <= high) {
        notes.push(note);
      }
    }
  }
  return notes.sort((a, b) => a - b);
}

/**
 * Get a note from a scale by degree
 * @param {string} scaleName
 * @param {number} root - Root MIDI note
 * @param {number} degree - Scale degree (0-based, can be negative)
 * @returns {number} - MIDI note number
 */
export function getScaleDegree(scaleName, root, degree) {
  const intervals = SCALES[scaleName] || SCALES.minor;
  const len = intervals.length;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return root + octave * 12 + intervals[idx];
}

// Common chord progressions (as scale degrees, 0-indexed)
export const CHORD_PROGRESSIONS = {
  // Pop / Standard
  popMajor:    [0, 3, 4, 0],      // I - IV - V - I
  popMinor:    [0, 3, 4, 0],      // i - iv - v - i
  canon:       [0, 5, 3, 4],      // I - vi - IV - V

  // Electronic
  techno:      [0, 0, 5, 0],      // i - i - vi - i (drone-based)
  trance:      [0, 3, 4, 0],      // i - iv - v - i
  house:       [0, 5, 3, 4],      // I - vi - IV - V
  acid:        [0, 0, 0, 7],      // i - i - i - v (root-heavy)

  // Dark / Minor
  dark:        [0, 6, 3, 4],      // i - VII - iv - v
  epic:        [0, 3, 4, 5],      // i - iv - v - VI
};

/**
 * Build chord tones from a root and chord type
 * @param {number} root - Root MIDI note
 * @param {string} type - 'major', 'minor', 'dim', 'aug', '7', 'm7'
 * @returns {number[]} - MIDI note numbers
 */
export function buildChord(root, type = 'minor') {
  const chords = {
    major:  [0, 4, 7],
    minor:  [0, 3, 7],
    dim:    [0, 3, 6],
    aug:    [0, 4, 8],
    '7':    [0, 4, 7, 10],
    m7:     [0, 3, 7, 10],
    maj7:   [0, 4, 7, 11],
    sus2:   [0, 2, 7],
    sus4:   [0, 5, 7],
  };
  const intervals = chords[type] || chords.minor;
  return intervals.map(i => root + i);
}

// Default bass root notes per genre (MIDI note numbers)
export const BASS_ROOTS = {
  techno:  36, // C2
  house:   36, // C2
  acid:    36, // C2
  trance:  33, // A1
  dnb:     31, // G1
  hiphop:  36, // C2
};

// Default synth root notes per genre
export const SYNTH_ROOTS = {
  techno:  48, // C3
  house:   48, // C3
  acid:    48, // C3
  trance:  48, // C3
  dnb:     45, // A2
  hiphop:  48, // C3
};

// Genre → preferred scale mapping
export const GENRE_SCALES = {
  techno:  ['minor', 'phrygian', 'dorian'],
  house:   ['minor', 'dorian', 'mixolydian'],
  acid:    ['minor', 'phrygian', 'chromatic'],
  trance:  ['minor', 'harmonicMinor', 'lydian'],
  dnb:      ['minor', 'pentatonicMinor', 'phrygian'],
  hiphop:  ['pentatonicMinor', 'minor', 'dorian'],
};
