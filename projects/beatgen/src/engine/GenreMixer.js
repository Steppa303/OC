/**
 * GenreMixer — Weighted random mixing of genre templates
 *
 * For each step: calculate weighted probability across all genres,
 * then threshold (>0.5) to decide active/inactive.
 */

import GenreLibrary from './GenreLibrary.js';
import { seededRandom, hashParams } from '../utils/random.js';

const GENRE_KEYS = ['techno', 'house', 'acid', 'trance', 'dnb', 'hiphop'];

/**
 * Normalize genre weights so they sum to 1.0
 * @param {Object} weights - { techno: 40, house: 15, ... } (0-100 scale)
 * @returns {Object} - Normalized weights (sum = 1.0)
 */
export function normalizeWeights(weights) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) {
    // Equal distribution
    const equal = 1 / GENRE_KEYS.length;
    return Object.fromEntries(GENRE_KEYS.map(k => [k, equal]));
  }
  const normalized = {};
  for (const key of GENRE_KEYS) {
    normalized[key] = (weights[key] || 0) / sum;
  }
  return normalized;
}

/**
 * Get the dominant genre (highest weight)
 * @param {Object} weights - Raw or normalized weights
 * @returns {string} - Genre key
 */
export function getDominantGenre(weights) {
  let max = -1;
  let dominant = 'techno';
  for (const key of GENRE_KEYS) {
    if ((weights[key] || 0) > max) {
      max = weights[key] || 0;
      dominant = key;
    }
  }
  return dominant;
}

/**
 * Mix a single drum instrument across all genres for one step
 * @param {number} stepIndex - Step index (0-15)
 * @param {Object} normalizedWeights - Normalized genre weights (sum=1)
 * @param {string} instrument - 'kick', 'snare', 'hihat', 'clap', 'perc'
 * @param {function} rng - Seeded random function
 * @returns {number} - Probability (0-1)
 */
function mixDrumStep(stepIndex, normalizedWeights, instrument, rng) {
  let probability = 0;
  for (const genre of GENRE_KEYS) {
    const template = GenreLibrary[genre]?.drums?.[instrument];
    if (template) {
      probability += normalizedWeights[genre] * template[stepIndex];
    }
  }
  return probability;
}

/**
 * Mix a single bass/synth step (notes + gate)
 * @param {number} stepIndex
 * @param {Object} normalizedWeights
 * @param {string} trackType - 'bass' or 'synth'
 * @param {function} rng
 * @returns {{ note: number, gate: number }} - Mixed note and gate probability
 */
function mixMelodicStep(stepIndex, normalizedWeights, trackType, rng) {
  let gateProbability = 0;
  let weightedNote = 0;
  let totalWeight = 0;

  for (const genre of GENRE_KEYS) {
    const template = GenreLibrary[genre]?.[trackType];
    if (template) {
      const w = normalizedWeights[genre];
      gateProbability += w * (template.gate?.[stepIndex] || 0);
      if (template.notes?.[stepIndex] > 0) {
        weightedNote += w * template.notes[stepIndex];
        totalWeight += w;
      }
    }
  }

  // Average note across genres that have a note here
  const note = totalWeight > 0 ? Math.round(weightedNote / totalWeight) : 0;
  return { note, gate: gateProbability };
}

/**
 * Mix all 16 steps for a drum instrument
 * @param {Object} normalizedWeights
 * @param {string} instrument
 * @param {number} seed
 * @returns {number[]} - Array of 16 values: 1 (active) or 0 (inactive)
 */
export function mixDrumPattern(normalizedWeights, instrument, seed, drumWeights = {}) {
  const rng = seededRandom(seed + instrument.length);
  const weight = (drumWeights[instrument] ?? 100) / 100;
  const pattern = [];

  for (let i = 0; i < 16; i++) {
    const prob = mixDrumStep(i, normalizedWeights, instrument, rng);
    const threshold = 0.45 + rng() * 0.1;

    if (prob > threshold) {
      pattern.push(rng() < weight ? 1 : 0);
    } else if (weight > 1.0 && rng() < (weight - 1.0) * 0.3) {
      pattern.push(1);
    } else {
      pattern.push(0);
    }
  }

  return pattern;
}

/**
 * Mix all 16 steps for a melodic track (bass or synth)
 * @param {Object} normalizedWeights
 * @param {string} trackType - 'bass' or 'synth'
 * @param {number} seed
 * @returns {{ notes: number[], gate: number[] }}
 */
export function mixMelodicPattern(normalizedWeights, trackType, seed) {
  const rng = seededRandom(seed + trackType.length + 100);
  const notes = [];
  const gate = [];

  for (let i = 0; i < 16; i++) {
    const { note, gate: gateProb } = mixMelodicStep(i, normalizedWeights, trackType, rng);
    const threshold = 0.45 + rng() * 0.1;
    const active = gateProb > threshold ? 1 : 0;
    notes.push(active ? note : 0);
    gate.push(active ? 1 : 0);
  }

  return { notes, gate };
}

/**
 * Mix a single track (drums, bass, or synth) from genre weights
 * @param {Object} genreWeights - Raw weights { techno: 40, house: 15, ... }
 * @param {string} trackType - 'drums' | 'bass' | 'synth'
 * @param {number} seed - Base seed for determinism
 * @returns {Object} - Raw pattern for the track
 */
export function mixTrack(genreWeights, trackType, seed, drumWeights) {
  const nw = normalizeWeights(genreWeights);

  if (trackType === 'drums') {
    return {
      kick:   mixDrumPattern(nw, 'kick', seed, drumWeights),
      snare:  mixDrumPattern(nw, 'snare', seed, drumWeights),
      loTom:  mixDrumPattern(nw, 'loTom', seed, drumWeights),
      midTom: mixDrumPattern(nw, 'midTom', seed, drumWeights),
      hiTom:  mixDrumPattern(nw, 'hiTom', seed, drumWeights),
      rim:    mixDrumPattern(nw, 'rim', seed, drumWeights),
      clap:   mixDrumPattern(nw, 'clap', seed, drumWeights),
      chh:    mixDrumPattern(nw, 'chh', seed, drumWeights),
      ohh:    mixDrumPattern(nw, 'ohh', seed, drumWeights),
      crash:  mixDrumPattern(nw, 'crash', seed, drumWeights),
      ride:   mixDrumPattern(nw, 'ride', seed, drumWeights),
    };
  }

  return mixMelodicPattern(nw, trackType, seed);
}

/**
 * Full mix: produce raw (pre-mood) patterns for all three tracks
 * @param {Object} genreWeights - Raw weights { techno: 40, house: 15, ... }
 * @param {number} seed - Base seed for determinism
 * @returns {Object} - Raw patterns for drums, bass, synth
 */
export function mixAll(genreWeights, seed) {
  return {
    drums: mixTrack(genreWeights, 'drums', seed),
    bass: mixTrack(genreWeights, 'bass', seed),
    synth: mixTrack(genreWeights, 'synth', seed),
  };
}

export default {
  normalizeWeights,
  getDominantGenre,
  mixDrumPattern,
  mixMelodicPattern,
  mixTrack,
  mixAll,
};
