/**
 * VelocityCurves — Genre-specific velocity profiles with mood modifications
 *
 * Each genre has a base 16-step velocity curve (0-127).
 * Mood parameters modify the curve:
 *   energy:     Scale velocity range (compress at low, expand at high)
 *   complexity: Increase velocity variation
 *   darkness:   Emphasize lower velocities (darker = softer on average)
 */

import GenreLibrary from './GenreLibrary.js';
import { getDominantGenre } from './GenreMixer.js';
import { seededRandom } from '../utils/random.js';

/**
 * Get the base velocity curve from the dominant genre
 * @param {Object} genreWeights - Raw genre weights
 * @returns {number[]} - 16 velocity values (0-127)
 */
export function getBaseVelocityCurve(genreWeights) {
  const dominant = getDominantGenre(genreWeights);
  return GenreLibrary[dominant]?.velocityCurve ||
    [100, 0, 80, 0, 100, 0, 80, 0, 100, 0, 80, 0, 100, 0, 80, 0];
}

/**
 * Blend velocity curves from all genres based on weights
 * @param {Object} genreWeights - Normalized weights (sum=1)
 * @returns {number[]} - Blended 16-step velocity curve
 */
export function blendVelocityCurves(genreWeights) {
  const genres = ['techno', 'house', 'acid', 'trance', 'dnb', 'hiphop'];
  const sum = Object.values(genreWeights).reduce((a, b) => a + b, 0);
  if (sum === 0) return getBaseVelocityCurve(genreWeights);

  const curve = new Array(16).fill(0);
  for (const genre of genres) {
    const w = (genreWeights[genre] || 0) / sum;
    const gc = GenreLibrary[genre]?.velocityCurve;
    if (gc) {
      for (let i = 0; i < 16; i++) {
        curve[i] += w * gc[i];
      }
    }
  }
  return curve.map(v => Math.round(v));
}

/**
 * Modify velocity curve based on mood parameters
 * @param {number[]} baseCurve - 16-step base velocities
 * @param {Object} mood - { energy, complexity, darkness }
 * @param {number} seed
 * @returns {number[]} - Modified velocity curve
 */
export function applyMoodToVelocityCurve(baseCurve, mood, seed) {
  const rng = seededRandom(seed + 42);
  const energy = mood.energy / 100;
  const complexity = mood.complexity / 100;
  const darkness = mood.darkness / 100;

  return baseCurve.map((v, i) => {
    if (v === 0) return 0; // Don't modify inactive steps

    let vel = v;

    // Energy: scale range (low energy = compressed, high = expanded)
    const midpoint = 80;
    const energyScale = 0.5 + energy * 0.8; // 0.5 to 1.3
    vel = Math.round(midpoint + (vel - midpoint) * energyScale);

    // Darkness: push toward lower velocities
    vel = Math.round(vel * (1 - darkness * 0.3));

    // Complexity: add velocity variation
    const jitter = Math.round((rng() - 0.5) * complexity * 40);
    vel += jitter;

    return Math.max(20, Math.min(127, vel));
  });
}

/**
 * Apply velocity curve to pattern steps
 * @param {Object} pattern - { drums, bass, synth } with steps
 * @param {number[]} velocityCurve - 16 velocity values
 * @returns {Object} - Pattern with velocities applied
 */
export function applyVelocityCurve(pattern, velocityCurve) {
  const result = {};
  for (const track of ['drums', 'bass', 'synth']) {
    if (!pattern[track]?.steps) {
      result[track] = pattern[track];
      continue;
    }
    result[track] = {
      ...pattern[track],
      steps: pattern[track].steps.map((step, i) => ({
        ...step,
        velocity: step.active ? (velocityCurve[i] || 80) : 0,
      })),
    };
  }
  return result;
}

export function applyVelocityCurveToTrack(trackPattern, velocityCurve) {
  if (!trackPattern?.steps) return trackPattern;

  return {
    ...trackPattern,
    steps: trackPattern.steps.map((step, i) => ({
      ...step,
      velocity: step.active ? (velocityCurve[i] || 80) : 0,
      chordNotes: (step.chordNotes || []).map((chord) => ({
        ...chord,
        velocity: step.active ? Math.round((velocityCurve[i] || 80) * 0.7) : 0,
      })),
    })),
  };
}

export default {
  getBaseVelocityCurve,
  blendVelocityCurves,
  applyMoodToVelocityCurve,
  applyVelocityCurve,
  applyVelocityCurveToTrack,
};
