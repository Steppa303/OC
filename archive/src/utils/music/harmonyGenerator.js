/**
 * Harmony & Chord Progression Generator
 * Extended functions for creating harmonically rich music
 */

import { SCALES, NOTE_FREQUENCIES, NOTES } from './melodyGenerator';

// ============================================================
// CHORD PROGRESSIONS
// ============================================================

// Common chord progressions (Roman numerals)
const CHORD_PROGRESSIONS = {
  '200s-Pop': ['I', 'V', 'vi', 'IV'], // I-V-vi-IV (crazy famous)
  'Blues-12-Bar': ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
  'Jazz-II-V-I': ['ii', 'V', 'I'],
  'Minor-Pop': ['vi', 'IV', 'I', 'V'],
  'Suspense': ['i', 'III', 'vi', 'VII'],
  'Pentatonic-Loop': ['I', 'IV', 'V', 'I']
};

// Chord quality mappings
const CHORD_QUALITIES = {
  'I': { quality: 'major', intervals: [0, 4, 7] },
  'ii': { quality: 'minor', intervals: [0, 3, 7] },
  'iii': { quality: 'minor', intervals: [0, 3, 7] },
  'IV': { quality: 'major', intervals: [0, 4, 7] },
  'V': { quality: 'major', intervals: [0, 4, 7] },
  'vi': { quality: 'minor', intervals: [0, 3, 7] },
  'vii°': { quality: 'diminished', intervals: [0, 3, 6] },
  'i': { quality: 'minor', intervals: [0, 3, 7] },
  'iii': { quality: 'diminished', intervals: [0, 3, 6] },
  'VI': { quality: 'major', intervals: [0, 4, 7] },
  'VII': { quality: 'major', intervals: [0, 4, 7] }
};

// ============================================================
// CHORD GENERATION
// ============================================================

/**
 * Get chord notes for a Roman numeral in a scale
 */
function generateChord(scaleName, romanNumeral, octave = 3) {
  const scale = SCALES[scaleName];
  if (!scale) {
    throw new Error(`Scale "${scaleName}" not found`);
  }

  const chordData = CHORD_QUALITIES[romanNumeral];
  if (!chordData) {
    throw new Error(`Chord "${romanNumeral}" not supported`);
  }

  // Find root note of chord in scale
  const scaleNotes = Object.keys(SCALES).map(k => SCALES[k].root).includes(scale.root) 
    ? NOTES.slice(NOTES.indexOf(scale.root)) 
    : NOTES;

  // Scale degrees (1-based)
  const degreeMap = {
    'I': 0, 'ii': 1, 'iii': 2, 'IV': 3, 'V': 4, 'vi': 5, 'vii°': 6,
    'i': 0, 'III': 2, 'VI': 5, 'VII': 6
  };

  const rootIndex = degreeMap[romanNumeral];
  const rootNote = scaleNotes[rootIndex % scaleNotes.length];
  const rootOctave = octave + Math.floor(rootIndex / scaleNotes.length);

  // Generate chord notes
  const chordNotes = chordData.intervals.map(interval => {
    const noteIndex = (NOTES.indexOf(rootNote) + interval) % NOTES.length;
    const octaveOffset = Math.floor((NOTES.indexOf(rootNote) + interval) / 12);
    const fullNoteName = NOTES[noteIndex] + (rootOctave + octaveOffset);
    
    return {
      note: fullNoteName,
      frequency: NOTE_FREQUENCIES[fullNoteName] || 0
    };
  });

  return {
    romanNumeral,
    scale: scaleName,
    rootNote: rootNote + rootOctave,
    quality: chordData.quality,
    notes: chordNotes
  };
}

/**
 * Generate a chord progression
 */
function generateChordProgression(scaleName, progressionName = '200s-Pop', octave = 3) {
  const progression = CHORD_PROGRESSIONS[progressionName];
  if (!progression) {
    throw new Error(`Progression "${progressionName}" not found`);
  }

  const chords = progression.map(romanNumeral => 
    generateChord(scaleName, romanNumeral, octave)
  );

  return {
    scale: scaleName,
    progressionName,
    chords
  };
}

// ============================================================
// HARMONY GENERATION
// ============================================================

/**
 * Generate harmony parts for a melody
 */
function generateHarmony(melody, scaleName, harmonyType = 'thirds') {
  const scale = SCALES[scaleName];
  if (!scale) {
    throw new Error(`Scale "${scaleName}" not found`);
  }

  // Get scale notes with frequencies
  const scaleNotes = Object.keys(NOTE_FREQUENCIES)
    .filter(note => note.startsWith(scale.root) || NOTES.includes(note.slice(0, -1)))
    .map(note => ({
      note,
      frequency: NOTE_FREQUENCIES[note]
    }));

  const harmonyParts = [];
  
  melody.forEach((note, index) => {
    const noteName = note.note.slice(0, -1);
    const octave = parseInt(note.note.slice(-1));
    const noteIndex = NOTES.indexOf(noteName);

    let harmonyNote;
    
    switch (harmonyType) {
      case 'thirds':
        harmonyNote = NOTES[(noteIndex + 4) % NOTES.length] + octave;
        break;
      case 'fourths':
        harmonyNote = NOTES[(noteIndex + 5) % NOTES.length] + octave;
        break;
      case 'fifths':
        harmonyNote = NOTES[(noteIndex + 7) % NOTES.length] + octave;
        break;
      case 'octaves':
        harmonyNote = noteName + (octave + 1);
        break;
      case 'roots':
        harmonyNote = noteName + (octave - 1);
        break;
      default:
        harmonyNote = note.note;
    }

    harmonyParts.push({
      ...note,
      note: harmonyNote,
      frequency: NOTE_FREQUENCIES[harmonyNote] || note.frequency,
      part: harmonyType
    });
  });

  return harmonyParts;
}

/**
 * Generate background pads based on chord progression
 */
function generatePads(chordProgression, durationPerChord = 2) {
  const pads = [];
  
  chordProgression.chords.forEach((chord, chordIndex) => {
    chord.notes.forEach((note) => {
      if (note.frequency > 0) {
        pads.push({
          note: note.note,
          frequency: note.frequency,
          duration: durationPerChord,
          startTime: chordIndex * durationPerChord,
          part: 'pad',
          type: 'sine',
          volume: 0.3
        });
      }
    });
  });

  return pads;
}

// ============================================================
// SCALE UTILITIES
// ============================================================

/**
 * Get all notes in a scale with frequencies
 */
function getScaleNotesWithFrequencies(scaleName, minOctave = 3, maxOctave = 5) {
  const scale = SCALES[scaleName];
  if (!scale) {
    throw new Error(`Scale "${scaleName}" not found`);
  }

  const notes = [];
  
  for (let octave = minOctave; octave <= maxOctave; octave++) {
    scale.intervals.forEach(interval => {
      const noteIndex = (NOTES.indexOf(scale.root) + interval) % NOTES.length;
      const octaveOffset = Math.floor((NOTES.indexOf(scale.root) + interval) / 12);
      const fullNoteName = NOTES[noteIndex] + (octave + octaveOffset);
      
      if (NOTE_FREQUENCIES[fullNoteName]) {
        notes.push({
          note: fullNoteName,
          frequency: NOTE_FREQUENCIES[fullNoteName],
          octave: octave + octaveOffset,
         _scaleDegree: scale.intervals.indexOf(interval) + 1
        });
      }
    });
  }

  return notes;
}

/**
 * Find the closest note in scale to a given frequency
 */
function findClosestNoteInScale(frequency, scaleName) {
  const scaleNotes = getScaleNotesWithFrequencies(scaleName);
  
  let closestNote = scaleNotes[0];
  let minDiff = Math.abs(frequency - closestNote.frequency);
  
  scaleNotes.forEach(note => {
    const diff = Math.abs(frequency - note.frequency);
    if (diff < minDiff) {
      minDiff = diff;
      closestNote = note;
    }
  });

  return closestNote;
}

// ============================================================
// EXPORTS
// ============================================================

export {
  // Progressions
  CHORD_PROGRESSIONS,
  generateChord,
  generateChordProgression,
  
  // Harmony
  generateHarmony,
  generatePads,
  
  // Scale utilities
  getScaleNotesWithFrequencies,
  findClosestNoteInScale,
  
  // Types
  /**
   * @typedef {Object} Chord
   * @property {string} romanNumeral - Roman numeral (e.g., 'I', 'IV')
   * @property {string} scale - Scale name
   * @property {string} rootNote - Root note name
   * @property {string} quality - Chord quality (major, minor, diminished)
   * @property {Array} notes - Array of notes in chord
   */
  
  /**
   * @typedef {Object} ChordProgression
   * @property {string} scale - Scale name
   * @property {string} progressionName - Progression name
   * @property {Array} chords - Array of chords
   */
};
