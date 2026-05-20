/**
 * Melody Generator - Music Note Generation Logic
 * Modulare Funktionen zur Generierung von Melodien mit verschiedenen Scales, Rhythmen und Chaos-Level
 */

// ============================================================
// NOTES & SCALES DATA
// ============================================================

const NOTES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

// Equal temperament calculations for frequencies
const NOTE_FREQUENCIES = {};
const A4_FREQ = 440;

// Generate frequencies for notes C0 to C8
for (let octave = 0; octave <= 8; octave++) {
  for (let i = 0; i < NOTES.length; i++) {
    const noteName = NOTES[i];
    const noteIndex = NOTES.indexOf(noteName);
    // MIDI note number: C4 = 60, A4 = 69
    const midiNote = octave * 12 + i;
    const frequency = A4_FREQ * Math.pow(2, (midiNote - 69) / 12);
    const fullNoteName = `${noteName}${octave}`;
    NOTE_FREQUENCIES[fullNoteName] = frequency;
  }
}

// Pre-defined scales (interval patterns in semitones)
const SCALES = {
  'C-Dur': {
    root: 'C',
    intervals: [0, 2, 4, 5, 7, 9, 11, 12], // Major scale
    baseOctave: 4
  },
  'A-Moll': {
    root: 'A',
    intervals: [0, 2, 3, 5, 7, 8, 10, 12], // Natural minor scale
    baseOctave: 4
  },
  'C-Dur-Pentatonik': {
    root: 'C',
    intervals: [0, 2, 4, 7, 9, 12], // Major pentatonic
    baseOctave: 4
  },
  'A-Moll-Pentatonik': {
    root: 'A',
    intervals: [0, 3, 5, 7, 10, 12], // Minor pentatonic
    baseOctave: 4
  },
  'D-Dur': {
    root: 'D',
    intervals: [0, 2, 4, 5, 7, 9, 11, 12],
    baseOctave: 4
  },
  'E-Moll': {
    root: 'E',
    intervals: [0, 2, 3, 5, 7, 8, 10, 12],
    baseOctave: 4
  },
  'Blues-Skala': {
    root: 'C',
    intervals: [0, 3, 5, 6, 7, 10, 12], // Blues scale
    baseOctave: 4
  }
};

// Rhythm types (note lengths in beats)
const RHYTHMS = {
  viertel: 1,      // Quarter note
  achtel: 0.5,     // Eighth note
  sechzehntel: 0.25, // Sixteenth note
  halbe: 2,        // Half note
  ganze: 4         // Whole note
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate notes for a specific octave in a scale
 */
function generateNotesForOctave(scale, octave) {
  const notes = [];
  const rootIndex = NOTES.indexOf(scale.root);
  
  scale.intervals.forEach(interval => {
    const noteIndex = (rootIndex + interval) % NOTES.length;
    const octaveOffset = Math.floor((rootIndex + interval) / 12);
    const finalOctave = octave + octaveOffset;
    const noteName = NOTES[noteIndex] + finalOctave;
    
    if (NOTE_FREQUENCIES[noteName]) {
      notes.push({
        note: noteName,
        frequency: NOTE_FREQUENCIES[noteName]
      });
    }
  });
  
  return notes;
}

/**
 * Get all available notes for a scale across multiple octaves
 */
function getAllScaleNotes(scale, octaves = [4]) {
  const allNotes = [];
  octaves.forEach(octave => {
    allNotes.push(...generateNotesForOctave(scale, octave));
  });
  return allNotes;
}

/**
 * Select notes from scale that are within a specific range
 */
function getNotesInRange(scale, minOctave = 3, maxOctave = 5) {
  let allNotes = [];
  for (let oct = minOctave; oct <= maxOctave; oct++) {
    allNotes = allNotes.concat(generateNotesForOctave(scale, oct));
  }
  return allNotes;
}

// ============================================================
// MELODY GENERATION FUNCTIONS
// ============================================================

/**
 * Generate a melody based on scale, length, and chaos level
 * @param {Object} options - Generation options
 * @param {string} options.scaleName - Name of the scale (e.g., 'C-Dur', 'A-Moll')
 * @param {number} options.length - Number of notes in the melody
 * @param {number} options.chaosLevel - Chaos level (0-1, where 0 = structured, 1 = random)
 * @param {number} options.octaves - Range of octaves to use (default: [3, 4, 5])
 * @returns {Array} Array of note objects with frequency and duration
 */
function generateMelody(options = {}) {
  const {
    scaleName = 'C-Dur',
    length = 16,
    chaosLevel = 0.3,
    octaves = [3, 4, 5]
  } = options;
  
  // Validate scale
  if (!SCALES[scaleName]) {
    throw new Error(`Scale "${scaleName}" not found. Available: ${Object.keys(SCALES).join(', ')}`);
  }
  
  const scale = SCALES[scaleName];
  const availableNotes = getNotesInRange(scale, Math.min(...octaves), Math.max(...octaves));
  
  // Ensure we have notes to work with
  if (availableNotes.length === 0) {
    throw new Error(`No notes available for scale ${scaleName}`);
  }
  
  const melody = [];
  let currentTime = 0;
  
  for (let i = 0; i < length; i++) {
    // Note selection with chaos influence
    let noteIndex;
    
    if (chaosLevel < 0.3) {
      // Structure: prefer steps over jumps
      noteIndex = Math.floor(Math.random() * availableNotes.length);
      // Bias towards center of scale for more melodic lines
      const centerBias = Math.floor(availableNotes.length / 2);
      if (Math.random() > 0.7) {
        noteIndex = Math.max(0, Math.min(availableNotes.length - 1, centerBias + Math.floor((Math.random() - 0.5) * 2)));
      }
    } else if (chaosLevel < 0.7) {
      // Moderate chaos: mix of structured and random
      if (Math.random() > 0.6) {
        noteIndex = Math.floor(Math.random() * availableNotes.length);
      } else {
        noteIndex = Math.floor(Math.random() * availableNotes.length);
      }
    } else {
      // High chaos: truly random
      noteIndex = Math.floor(Math.random() * availableNotes.length);
    }
    
    // Ensure we don't pick the same note too many times in a row (unless high chaos)
    if (i > 2 && chaosLevel < 0.8) {
      const previousNotes = melody.slice(-3).map(n => n.note);
      if (previousNotes.includes(availableNotes[noteIndex].note) && Math.random() > 0.8) {
        noteIndex = (noteIndex + 1) % availableNotes.length;
      }
    }
    
    const selectedNote = availableNotes[noteIndex];
    
    // Duration calculation with chaos influence
    let duration;
    if (chaosLevel < 0.3) {
      // Structured: mostly quarter and eighth notes
      duration = Math.random() > 0.7 ? RHYTHMS.viertel : RHYTHMS.achtel;
    } else if (chaosLevel < 0.6) {
      // Moderate: mix of rhythms
      const durationTypes = [RHYTHMS.viertel, RHYTHMS.achtel, RHYTHMS.sechzehntel];
      duration = durationTypes[Math.floor(Math.random() * durationTypes.length)];
    } else {
      // Chaotic: more varied and faster rhythms
      const durationTypes = [RHYTHMS.achtel, RHYTHMS.sechzehntel, RHYTHMS.viertel];
      duration = durationTypes[Math.floor(Math.random() * durationTypes.length)];
      
      // Add occasional doubled notes
      if (Math.random() > 0.85) {
        duration *= 2; // Longer notes sometimes
      }
    }
    
    // Apply chaos to frequency (pitch bending effect)
    let frequency = selectedNote.frequency;
    if (chaosLevel > 0.4) {
      const bendAmount = (Math.random() - 0.5) * chaosLevel * 20; // Max ±10Hz bend at max chaos
      frequency += bendAmount;
    }
    
    melody.push({
      note: selectedNote.note,
      frequency: frequency,
      duration: duration,
      startTime: currentTime
    });
    
    currentTime += duration;
  }
  
  return melody;
}

/**
 * Generate a rhythmic pattern
 * @param {Object} options - Rhythm generation options
 * @param {number} options.length - Number of rhythm events
 * @param {string} options.rhythmType - Basic rhythm type ('viertel', 'achtel', 'sechzehntel')
 * @param {number} options.chaosLevel - Chaos level for rhythm variation
 * @returns {Array} Array of rhythm events
 */
function generateRhythm(options = {}) {
  const {
    length = 16,
    rhythmType = 'achtel',
    chaosLevel = 0.3
  } = options;
  
  const baseDuration = RHYTHMS[rhythmType] || RHYTHMS.achtel;
  const rhythmEvents = [];
  let currentTime = 0;
  
  for (let i = 0; i < length; i++) {
    let duration = baseDuration;
    
    // Apply chaos to rhythm
    if (chaosLevel > 0.2) {
      const chaosMultiplier = Math.random() > 0.5 ? 1 : 0.5;
      if (chaosMultiplier === 0.5 && baseDuration > 0.25) {
        duration = baseDuration / 2; // Split longer notes
      } else if (chaosMultiplier === 1 && Math.random() > 0.8) {
        duration = baseDuration * 2; // Extend some notes
      }
    }
    
    // Add occasional rests
    if (chaosLevel > 0.5 && Math.random() > 0.7) {
      duration *= 1.5; // Make some beats longer (effectively rests)
    }
    
    rhythmEvents.push({
      startTime: currentTime,
      duration: duration,
      note: rhythmType // Label for debugging
    });
    
    currentTime += duration;
  }
  
  return rhythmEvents;
}

/**
 * Combine melody with rhythm
 * @param {Array} melody - Array of note objects
 * @param {Array} rhythm - Array of rhythm events
 * @returns {Array} Combined melody with rhythm applied
 */
function combineMelodyWithRhythm(melody, rhythm) {
  if (rhythm.length === 0) return melody;
  
  const combined = [];
  const minLen = Math.min(melody.length, rhythm.length);
  
  for (let i = 0; i < minLen; i++) {
    combined.push({
      ...melody[i],
      duration: rhythm[i].duration
    });
  }
  
  return combined;
}

// ============================================================
// EXPORTS
// ============================================================

export {
  // Data exports
  NOTES,
  NOTE_FREQUENCIES,
  SCALES,
  RHYTHMS,
  
  // Helper functions
  generateNotesForOctave,
  getAllScaleNotes,
  getNotesInRange,
  
  // Main generation functions
  generateMelody,
  generateRhythm,
  combineMelodyWithRhythm,
  
  // Types for documentation
  /**
   * @typedef {Object} Note
   * @property {string} note - Note name (e.g., 'C4')
   * @property {number} frequency - Frequency in Hz
   * @property {number} duration - Duration in beats
   * @property {number} startTime - Start time in beats
   */
  
  /**
   * @typedef {Object} RhythmEvent
   * @property {number} startTime - Start time in beats
   * @property {number} duration - Duration in beats
   * @property {string} note - Rhythm type label
   */
};
