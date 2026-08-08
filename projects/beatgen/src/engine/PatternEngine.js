/**
 * PatternEngine — Core pattern generation orchestrator
 *
 * Pipeline:
 *   1. GenreMixer.mix() → raw mixed patterns for drums, bass, synth
 *   2. MoodProcessor.apply() → modify based on mood parameters
 *   3. SwingProcessor.apply() → add swing timing
 *   4. VelocityCurves.apply() → set velocities per step
 *   → final Pattern object
 *
 * Output format (per track):
 *   { steps: [ { active, note, velocity, timing }, ... ] }  // 16 steps
 */

import { mixAll, mixTrack, normalizeWeights, getDominantGenre } from './GenreMixer.js';
import { applyMood } from './MoodProcessor.js';
import { applyGlobalSwing, applyTrackSwing } from './SwingProcessor.js';
import { blendVelocityCurves, applyMoodToVelocityCurve, applyVelocityCurveToTrack } from './VelocityCurves.js';
import { hashParams } from '../utils/random.js';
import { TEMPLATE_KEYS } from '../utils/drumMap.js';
import GenreLibrary from './GenreLibrary.js';

/**
 * Convert raw drum patterns (kick/snare/hihat/clap/perc arrays)
 * into unified drum steps with GM MIDI note numbers
 * @param {Object} rawDrums - { kick: [], snare: [], hihat: [], clap: [], perc: [] }
 * @returns {{ steps: Object[] }} - 16 steps with { active, note, velocity, timing }
 */
function buildDrumSteps(rawDrums) {
  const steps = [];
  // Priority order: kick > snare > clap > rim > chh > ohh > loTom > midTom > hiTom > crash > ride
  const priority = ['kick', 'snare', 'clap', 'rim', 'chh', 'ohh', 'loTom', 'midTom', 'hiTom', 'crash', 'ride'];

  for (let i = 0; i < 16; i++) {
    let note = 0;
    let active = false;

    for (const key of priority) {
      if (rawDrums[key]?.[i]) {
        note = TEMPLATE_KEYS[key];
        active = true;
        break;
      }
    }

    steps.push({
      active,
      note: active ? note : 0,
      velocity: 0,
      timing: 0,
      chordNotes: [],
    });
  }
  return { steps };
}

/**
 * Convert raw melodic pattern (notes/gate arrays) into unified steps
 * @param {{ notes: number[], gate: number[] }} raw
 * @returns {{ steps: Object[] }}
 */
function buildMelodicSteps(raw) {
  const steps = [];
  for (let i = 0; i < 16; i++) {
    const active = (raw.gate?.[i] || 0) === 1;
    steps.push({
      active,
      note: active ? (raw.notes?.[i] || 0) : 0,
      velocity: 0,
      timing: 0,
    });
  }
  return { steps };
}

/**
 * Merge micro-timing offsets from MoodProcessor into pattern
 * @param {Object} pattern
 * @param {number[]} timingOffsets - From mood groove parameter
 * @returns {Object}
 */
function applyMoodTiming(pattern, timingOffsets) {
  if (!timingOffsets || timingOffsets.length === 0) return pattern;

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
        timing: (step.timing || 0) + (timingOffsets[i] || 0),
      })),
    };
  }
  return result;
}

/**
 * Main PatternEngine class
 */
class PatternEngine {
  /**
   * Generate a complete pattern from parameters
   * @param {Object} genreWeights - { techno: 40, house: 15, acid: 20, trance: 5, dnb: 10, hiphop: 10 }
   * @param {Object} moodParams - { darkness: 50, energy: 50, complexity: 50, density: 50, groove: 50, weirdness: 50 }
   * @param {Object} swingConfig - { mode: 'global'|'track', amount: 50, trackSwing: { drums, bass, synth } }
   * @param {number} bpm - Current BPM
   * @param {Object} [trackGenreWeights] - Per-track genre weights { drums: {...}, bass: {...}, synth: {...} }
   * @param {Object} [mutationCount] - Per-track mutation counts { drums: 0, bass: 0, synth: 0 }
   * @param {number} [patternNonce] - Global pattern nonce for Next Pattern
   * @param {Object} [trackParams] - Per-track params { drums: {...}, bass: {...}, synth: {...} }
   * @returns {Object} - { drums: { steps }, bass: { steps }, synth: { steps } }
   */
  generate(genreWeights, moodParams, swingConfig, bpm = 120, trackGenreWeights, mutationCount, patternNonce, trackParams) {
    // Create deterministic seed from current parameters
    const baseSeed = hashParams(genreWeights, moodParams, swingConfig.mode, swingConfig.amount);
    const nonce = patternNonce || 0;

      // 1. Mix genre templates — per track with per-track seed
      const raw = {};
      for (const track of ['drums', 'bass', 'synth']) {
        const mc = mutationCount?.[track] || 0;
        const trackSeed = baseSeed + (nonce * 104729) + (mc * 7919);
        const drumWeights = track === 'drums'
          ? {
              kick: (trackParams?.drums?.kickWeight ?? 100),
              snare: (trackParams?.drums?.snareWeight ?? 100),
              loTom: (trackParams?.drums?.loTomWeight ?? 100),
              midTom: (trackParams?.drums?.midTomWeight ?? 100),
              hiTom: (trackParams?.drums?.hiTomWeight ?? 100),
              rim: (trackParams?.drums?.rimWeight ?? 100),
              clap: (trackParams?.drums?.clapWeight ?? 100),
              chh: (trackParams?.drums?.chhWeight ?? 100),
              ohh: (trackParams?.drums?.ohhWeight ?? 100),
              crash: (trackParams?.drums?.crashWeight ?? 100),
              ride: (trackParams?.drums?.rideWeight ?? 100),
            }
          : undefined;
        raw[track] = mixTrack(trackGenreWeights?.[track] || genreWeights, track, trackSeed, drumWeights);
      }

    // 2. Apply mood modifications — merge global mood with per-track overrides
    const seed = baseSeed;
    const result = {};
    const effectiveMoods = {};
    for (const track of ['drums', 'bass', 'synth']) {
      const tp = trackParams?.[track] || {};
      const effectiveMood = { ...moodParams };
      if (tp.density != null) effectiveMood.density = tp.density;
      if (tp.complexity != null) effectiveMood.complexity = tp.complexity;
      if (tp.groove != null) effectiveMood.groove = tp.groove;
      if (tp.darkness != null) effectiveMood.darkness = tp.darkness;
      if (tp.weirdness != null) effectiveMood.weirdness = tp.weirdness;
      effectiveMoods[track] = { ...effectiveMood };

      // applyMood expects ALL three tracks — build safe 3-track object
      // with empty defaults for non-current tracks to avoid "undefined.notes.map()" crashes
      const a16 = (n) => new Array(16).fill(n);
      const emptyDrums = {
        kick: a16(0), snare: a16(0), loTom: a16(0), midTom: a16(0), hiTom: a16(0),
        rim: a16(0), clap: a16(0), chh: a16(0), ohh: a16(0), crash: a16(0), ride: a16(0)
      };
      const emptyMelodic = { notes: a16(0), gate: a16(0) };
      const safePattern = {
        drums: track === 'drums' ? (raw[track] || emptyDrums) : emptyDrums,
        bass:  track === 'bass'  ? (raw[track] || emptyMelodic) : emptyMelodic,
        synth: track === 'synth' ? (raw[track] || emptyMelodic) : emptyMelodic,
      };
      const mooded = applyMood(effectiveMood, safePattern, genreWeights, seed);

      // Build steps
      let trackPattern;
      if (track === 'drums') {
        trackPattern = buildDrumSteps(mooded.drums);
      } else {
        trackPattern = buildMelodicSteps(mooded[track]);
        // Apply melodic params (octave, range, note length, chord mode)
        trackPattern = this._applyMelodicParams(trackPattern, tp, track, bpm);
      }

      // Apply groove micro-timing from mood
      if (mooded._timingOffsets) {
        trackPattern = {
          ...trackPattern,
          steps: trackPattern.steps.map((step, i) => ({
            ...step,
            timing: (step.timing || 0) + (mooded._timingOffsets[i] || 0),
          })),
        };
      }

      result[track] = trackPattern;
    }

    // 3. Apply swing timing
    let pattern = result;
    if (swingConfig.mode === 'track') {
      pattern = applyTrackSwing(pattern, swingConfig.trackSwing || {}, bpm);
    } else {
      pattern = applyGlobalSwing(pattern, swingConfig.amount || 0, bpm);
    }

    // 4. Build and apply per-track velocity curves
    const normalizedWeights = normalizeWeights(genreWeights);
    const baseCurve = blendVelocityCurves(normalizedWeights);
    const nextPattern = {};
    for (const track of ['drums', 'bass', 'synth']) {
      const trackVelocityCurve = applyMoodToVelocityCurve(baseCurve, effectiveMoods[track] || moodParams, seed + track.length * 100);
      nextPattern[track] = applyVelocityCurveToTrack(pattern[track], trackVelocityCurve);
    }
    pattern = nextPattern;

    return pattern;
  }

  /**
   * Apply melodic params (octave, range, note length, chord mode) to melodic steps
   * @param {Object} melodicPattern - { steps: [...] }
   * @param {Object} tp - Track params
   * @param {string} track - 'bass' or 'synth'
   * @returns {Object}
   */
  _applyMelodicParams(melodicPattern, tp, track, bpm = 120) {
    const octave = tp.octave || 0;
    const rangeLow = tp.rangeLow ?? (track === 'synth' ? 48 : 28);
    const rangeHigh = tp.rangeHigh ?? (track === 'synth' ? 84 : 60);
    const noteLength = tp.noteLength ?? 65;
    const chordMode = track === 'synth' ? (tp.chordMode || 'off') : 'off';

    const stepDurationMs = this.getStepDuration(bpm || 120);
    const gateFraction = Math.max(0.1, Math.min(1.0, 0.1 + (noteLength / 100) * 0.9));
    const gateTime = Math.round(stepDurationMs * gateFraction);

    const clampNote = (value) => {
      let note = value;
      while (note < rangeLow && note > 0) note += 12;
      while (note > rangeHigh && note < 128) note -= 12;
      return Math.max(0, Math.min(127, note));
    };

    const intervals = chordMode === '2note' ? [7] : chordMode === '3note' ? [4, 7] : [];

    let steps = melodicPattern.steps.map(step => {
      if (!step.active || step.note === 0) {
        return { ...step, chordNotes: [] };
      }

      const note = clampNote(step.note + (octave * 12));
      const chordNotes = [];
      for (const semitones of intervals) {
        chordNotes.push({
          note: clampNote(note + semitones),
          velocity: Math.round((step.velocity || 0) * 0.7),
        });
      }

      return {
        ...step,
        note,
        velocity: step.velocity,
        gateTime,
        chordNotes,
      };
    });

    return { steps };
  }

  /**
   * Calculate step duration from BPM
   * @param {number} bpm
   * @returns {number} - ms per 16th note
   */
  getStepDuration(bpm) {
    return 60000 / bpm / 4;
  }

  /**
   * Get recommended BPM range from genre weights
   * @param {Object} genreWeights
   * @returns {{ min: number, max: number, default: number }}
   */
  getBpmRange(genreWeights) {
    const dominant = getDominantGenre(genreWeights);
    return GenreLibrary[dominant]?.bpm || { min: 60, max: 200, default: 120 };
  }
}

export default PatternEngine;
