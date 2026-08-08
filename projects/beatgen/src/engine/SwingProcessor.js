/**
 * SwingProcessor — Calculates timing offsets for swing feel
 *
 * Swing delays offbeat (even-numbered) steps to create a shuffle feel.
 * - Global Mode: one swing value for all tracks
 * - Track Mode: per-track swing values
 *
 * Formula: offset = swingAmount * stepDuration * 0.5
 * (swingAmount is 0-100, mapped to 0.0-1.0)
 */

/**
 * Calculate timing offsets for 16 steps given a swing amount
 * @param {number} swingAmount - 0 to 100
 * @param {number} stepDuration - ms per step (from BPM)
 * @returns {number[]} - Array of 16 timing offsets in ms
 */
export function calculateSwingOffsets(swingAmount, stepDuration) {
  const swingFactor = swingAmount / 100; // 0.0 to 1.0
  const maxOffset = stepDuration * 0.5; // Max delay = half a step

  const offsets = [];
  for (let i = 0; i < 16; i++) {
    // Offbeat steps (2nd, 4th of each beat group) get delayed
    // Step indices: 1, 3, 5, 7, 9, 11, 13, 15 are offbeat
    const isOffbeat = i % 2 === 1;
    const offset = isOffbeat ? swingFactor * maxOffset : 0;
    offsets.push(Math.round(offset * 10) / 10); // Round to 0.1ms
  }
  return offsets;
}

/**
 * Apply swing to a pattern in global mode
 * @param {Object} pattern - { drums, bass, synth } with steps
 * @param {number} swingAmount - 0-100
 * @param {number} bpm - Current BPM
 * @returns {Object} - Pattern with timing offsets applied
 */
export function applyGlobalSwing(pattern, swingAmount, bpm) {
  const stepDuration = 60000 / bpm / 4; // 16th note duration in ms
  const offsets = calculateSwingOffsets(swingAmount, stepDuration);

  return applyOffsetsToPattern(pattern, offsets);
}

/**
 * Apply swing to a pattern in track mode
 * @param {Object} pattern - { drums, bass, synth } with steps
 * @param {Object} trackSwing - { drums: 50, bass: 60, synth: 40 }
 * @param {number} bpm
 * @returns {Object} - Pattern with per-track timing offsets
 */
export function applyTrackSwing(pattern, trackSwing, bpm) {
  const stepDuration = 60000 / bpm / 4;

  const result = {};
  for (const track of ['drums', 'bass', 'synth']) {
    const swing = trackSwing[track] || 0;
    const offsets = calculateSwingOffsets(swing, stepDuration);
    result[track] = applyOffsetsToTrack(pattern[track], offsets);
  }
  return result;
}

/**
 * Apply timing offsets to all tracks in a pattern
 * @param {Object} pattern
 * @param {number[]} offsets - 16 timing offsets
 * @returns {Object}
 */
function applyOffsetsToPattern(pattern, offsets) {
  const result = {};
  for (const track of ['drums', 'bass', 'synth']) {
    result[track] = applyOffsetsToTrack(pattern[track], offsets);
  }
  return result;
}

/**
 * Apply timing offsets to a single track
 * @param {Object} track - Track object with steps array
 * @param {number[]} offsets - 16 timing offsets
 * @returns {Object} - Track with updated timing
 */
function applyOffsetsToTrack(track, offsets) {
  if (!track?.steps) return track;

  return {
    ...track,
    steps: track.steps.map((step, i) => ({
      ...step,
      timing: (step.timing || 0) + (offsets[i] || 0),
    })),
  };
}

export default {
  calculateSwingOffsets,
  applyGlobalSwing,
  applyTrackSwing,
};
