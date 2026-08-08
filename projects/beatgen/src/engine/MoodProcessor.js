/**
 * MoodProcessor — Applies mood parameters to mixed patterns
 *
 * Mood parameters (all 0-100):
 *   density:    Note probability scaling
 *   complexity: Ghost notes, polyrhythms
 *   energy:     Velocity range adjustment
 *   darkness:   Minor/Major scale selection, low-end emphasis
 *   groove:     Micro-timing offsets
 *   weirdness:  Random mutations
 */

import { seededRandom } from '../utils/random.js';
import { SCALES, getScaleDegree, BASS_ROOTS, SYNTH_ROOTS, GENRE_SCALES } from '../utils/scales.js';
import { getDominantGenre } from './GenreMixer.js';

/**
 * Apply density scaling — thin out or fill in notes
 * @param {Object} patterns - { drums, bass, synth }
 * @param {number} density - 0-100
 * @param {function} rng
 * @returns {Object} - Modified patterns
 */
function applyDensity(patterns, density, rng) {
  const factor = density / 100; // 0.0 to 1.0

  // Drums: remove some hits if density is low, add ghost hits if high
  const drums = {};
  for (const [inst, steps] of Object.entries(patterns.drums)) {
    drums[inst] = steps.map((active, i) => {
      if (active === 0 && density > 70 && rng() < (density - 70) / 150) {
        return 1; // Ghost hit at high density
      }
      if (active === 1 && density < 30 && rng() > factor + 0.3) {
        return 0; // Thin out at low density
      }
      return active;
    });
  }

  // Bass & Synth: scale gate probability
  const applyMelodicDensity = (track) => ({
    notes: track.notes.map((n, i) => {
      if (n === 0 && density > 65 && rng() < (density - 65) / 100) {
        return track.notes[Math.max(0, i - 1)] || n; // Repeat nearby note
      }
      if (n > 0 && density < 25 && rng() > factor + 0.4) {
        return 0;
      }
      return n;
    }),
    gate: track.gate.map((g, i) => {
      if (g === 0 && density > 65 && rng() < (density - 65) / 100) return 1;
      if (g === 1 && density < 25 && rng() > factor + 0.4) return 0;
      return g;
    }),
  });

  return {
    drums,
    bass: applyMelodicDensity(patterns.bass),
    synth: applyMelodicDensity(patterns.synth),
  };
}

/**
 * Apply complexity — add ghost notes, polyrhythmic elements
 * @param {Object} patterns
 * @param {number} complexity - 0-100
 * @param {function} rng
 * @returns {Object}
 */
function applyComplexity(patterns, complexity, rng) {
  if (complexity < 20) return patterns;

  const intensity = (complexity - 20) / 80; // 0 to 1

  const drums = { ...patterns.drums };

  // Add ghost snares at medium-high complexity
  if (complexity > 40) {
    drums.snare = drums.snare.map((v, i) => {
      if (v === 0 && rng() < intensity * 0.25) return 1; // ghost snare
      return v;
    });
  }

  // Add offbeat kicks (polyrhythm feel) at high complexity
  if (complexity > 60) {
    drums.kick = drums.kick.map((v, i) => {
      if (v === 0 && i % 2 === 1 && rng() < intensity * 0.15) return 1;
      return v;
    });
  }

  // Add extra hihat variations
  if (complexity > 50) {
    drums.hihat = drums.hihat.map((v, i) => {
      if (v === 0 && rng() < intensity * 0.2) return 1;
      return v;
    });
  }

  // Melodic complexity: add passing tones
  const addPassingTones = (track) => {
    if (complexity < 45) return track;
    const notes = [...track.notes];
    const gate = [...track.gate];
    for (let i = 0; i < 16; i++) {
      if (gate[i] === 0 && rng() < intensity * 0.15) {
        // Find nearby active note and add a neighbor
        const nearby = notes[(i + 15) % 16] || notes[(i + 1) % 16] || 60;
        notes[i] = nearby + (rng() > 0.5 ? 1 : -1);
        gate[i] = 1;
      }
    }
    return { notes, gate };
  };

  return {
    drums,
    bass: addPassingTones(patterns.bass),
    synth: addPassingTones(patterns.synth),
  };
}

/**
 * Apply darkness — shift notes toward minor scale, emphasize low end
 * @param {Object} patterns
 * @param {number} darkness - 0-100
 * @param {Object} genreWeights
 * @param {function} rng
 * @returns {Object}
 */
function applyDarkness(patterns, darkness, genreWeights, rng) {
  const dominant = getDominantGenre(genreWeights);
  const darkFactor = darkness / 100;

  // Choose scale based on darkness
  const scaleOptions = GENRE_SCALES[dominant] || ['minor'];
  const scaleName = darkness > 60
    ? (darkness > 80 ? 'phrygian' : 'minor')
    : (darkness < 30 ? 'major' : scaleOptions[0]);

  const bassRoot = BASS_ROOTS[dominant] || 36;
  const synthRoot = SYNTH_ROOTS[dominant] || 48;

  // Remap melodic notes to chosen scale
  const remapToScale = (track, root, low, high) => {
    const scaleNotes = SCALES[scaleName] || SCALES.minor;
    const notes = track.notes.map((n) => {
      if (n === 0) return 0;
      // Find nearest scale note
      const semitone = n % 12;
      const octave = Math.floor(n / 12);
      let closest = scaleNotes[0];
      let minDist = 12;
      for (const interval of scaleNotes) {
        const dist = Math.abs(((semitone - interval + 12) % 12));
        const altDist = 12 - dist;
        const d = Math.min(dist, altDist);
        if (d < minDist) {
          minDist = d;
          closest = interval;
        }
      }
      let mapped = octave * 12 + closest;
      // Clamp to range
      while (mapped < low) mapped += 12;
      while (mapped > high) mapped -= 12;
      return mapped;
    });
    return { ...track, notes };
  };

  // Bass: emphasize lower octave at high darkness
  let bass = remapToScale(patterns.bass, bassRoot, 28, 48);
  if (darkness > 70) {
    bass.notes = bass.notes.map(n => n > 40 ? n - 12 : n);
  }

  // Synth: remap to scale
  const synth = remapToScale(patterns.synth, synthRoot, 48, 72);

  return { ...patterns, bass, synth };
}

/**
 * Apply energy — adjust velocity range and pattern density
 * @param {Object} patterns
 * @param {number} energy - 0-100
 * @param {function} rng
 * @returns {Object} - Also returns energy metadata for velocity curve
 */
function applyEnergy(patterns, energy, rng) {
  const factor = energy / 100;

  // At low energy: remove some percussive elements
  // At high energy: add more hits
  const drums = { ...patterns.drums };
  if (energy < 30) {
    drums.perc = drums.perc.map(v => rng() > 0.6 ? 0 : v);
  }
  if (energy > 80) {
    drums.hihat = drums.hihat.map((v, i) => v === 0 && rng() < 0.15 ? 1 : v);
  }

  return { ...patterns, drums, _energy: energy };
}

/**
 * Apply groove — compute micro-timing offsets per step
 * @param {Object} patterns
 * @param {number} groove - 0-100
 * @param {function} rng
 * @returns {Object} - Patterns with _timingOffsets added
 */
function applyGroove(patterns, groove, rng) {
  if (groove < 10) return { ...patterns, _timingOffsets: new Array(16).fill(0) };

  const intensity = groove / 100;
  const offsets = [];
  for (let i = 0; i < 16; i++) {
    // More offset on offbeats (odd steps)
    const isOffbeat = i % 2 === 1;
    const base = isOffbeat ? 1.0 : 0.3;
    const jitter = (rng() - 0.5) * 0.5;
    offsets.push(Math.round((base + jitter) * intensity * 15)); // ±15ms max
  }

  return { ...patterns, _timingOffsets: offsets };
}

/**
 * Apply weirdness — random mutations
 * @param {Object} patterns
 * @param {number} weirdness - 0-100
 * @param {function} rng
 * @returns {Object}
 */
function applyWeirdness(patterns, weirdness, rng) {
  if (weirdness < 15) return patterns;

  const factor = (weirdness - 15) / 85; // 0 to 1

  // Randomly flip drum hits
  const drums = {};
  for (const [inst, steps] of Object.entries(patterns.drums)) {
    drums[inst] = steps.map((v) => {
      if (rng() < factor * 0.12) return v === 1 ? 0 : 1;
      return v;
    });
  }

  // Random note mutations on melodic tracks
  const mutateMelodic = (track) => {
    const notes = track.notes.map((n) => {
      if (n > 0 && rng() < factor * 0.18) {
        const shift = Math.round((rng() - 0.5) * 7); // ±3 semitones
        return Math.max(24, Math.min(84, n + shift));
      }
      return n;
    });
    return { ...track, notes };
  };

  return {
    drums,
    bass: mutateMelodic(patterns.bass),
    synth: mutateMelodic(patterns.synth),
  };
}

/**
 * Apply all mood parameters to mixed patterns
 * @param {Object} moodParams - { darkness, energy, complexity, density, groove, weirdness }
 * @param {Object} patterns - Raw mixed patterns { drums, bass, synth }
 * @param {Object} genreWeights - For darkness scale selection
 * @param {number} seed - For deterministic mutations
 * @returns {Object} - Processed patterns
 */
export function applyMood(moodParams, patterns, genreWeights, seed) {
  const rng = seededRandom(seed + 999);

  let result = { ...patterns };
  result = applyDensity(result, moodParams.density, rng);
  result = applyComplexity(result, moodParams.complexity, rng);
  result = applyDarkness(result, moodParams.darkness, genreWeights, rng);
  result = applyEnergy(result, moodParams.energy, rng);
  result = applyGroove(result, moodParams.groove, rng);
  result = applyWeirdness(result, moodParams.weirdness, rng);

  return result;
}

export default { applyMood };
