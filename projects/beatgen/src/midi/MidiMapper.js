/**
 * MidiMapper — Converts Pattern-Engine output into MIDI events
 *
 * Input:  Pattern object { drums: { steps }, bass: { steps }, synth: { steps } }
 *         Each step: { active, note, velocity, timing }
 *
 * Output: Per step index, an array of MIDI events:
 *         { type: 'noteOn'|'noteOff', channel, note, velocity, timing }
 *
 * Track-channel mapping comes from the store's `tracks` config.
 */

class MidiMapper {
  /**
   * Map a full pattern to MIDI events for all 16 steps
   * @param {Object} pattern - { drums: { steps }, bass: { steps }, synth: { steps } }
   * @param {Object} tracks - { drums: { channel, muted, solo, volume }, bass: {...}, synth: {...} }
   * @returns {Array<Array>} - 16-element array, each element is an array of MIDI events
   */
  mapPattern(pattern, tracks, bpm = 120) {
    const allSteps = [];
    const hasSolo = Object.values(tracks).some(t => t.solo);
    const stepDuration = 60000 / (bpm || 120) / 4;

    for (let stepIdx = 0; stepIdx < 16; stepIdx++) {
      const events = [];

      for (const trackName of ['drums', 'bass', 'synth']) {
        const track = tracks[trackName];
        const trackData = pattern[trackName];

        // Skip muted tracks (respect solo: if any track is soloed, only play soloed tracks)
        if (hasSolo && !track.solo) continue;
        if (track.muted) continue;
        if (!trackData?.steps?.[stepIdx]) continue;

        const step = trackData.steps[stepIdx];
        if (!step.active || !step.note) continue;

        // Scale velocity by track volume (0-127)
        const scaleVelocity = (velocity) => Math.max(1, Math.min(127, Math.round(
          (velocity / 127) * (track.volume / 127) * 127
        )));

        const notes = [
          {
            note: step.note,
            velocity: scaleVelocity(step.velocity || 0),
            gateMs: trackName === 'drums' ? stepDuration : step.gateTime,
          },
          ...(step.chordNotes || []).map((chord) => ({
            note: chord.note,
            velocity: scaleVelocity(chord.velocity || 0),
            gateMs: trackName === 'drums' ? stepDuration : step.gateTime,
          })),
        ];

        for (const entry of notes) {
          events.push({
            type: 'noteOn',
            channel: track.channel,
            note: entry.note,
            velocity: entry.velocity,
            timing: step.timing || 0,
            track: trackName,
          });

          const sustainSteps = trackName === 'drums' ? 1 : Math.max(1, Math.round((entry.gateMs ?? stepDuration) / stepDuration));
          events.push({
            type: 'noteOff',
            channel: track.channel,
            note: entry.note,
            velocity: 0,
            timing: step.timing || 0,
            sustainSteps,
            track: trackName,
          });
        }
      }

      allSteps.push(events);
    }

    return allSteps;
  }

  /**
   * Extract just the noteOn events for a single step (for immediate scheduling)
   * @param {Array} stepEvents - Events for one step from mapPattern()
   * @returns {Array} - Only noteOn events
   */
  getNoteOns(stepEvents) {
    return stepEvents.filter(e => e.type === 'noteOn');
  }

  /**
   * Extract noteOff events that should fire at a given step
   * @param {Array} stepEvents - Events for one step
   * @returns {Array} - Only noteOff events
   */
  getNoteOffs(stepEvents) {
    return stepEvents.filter(e => e.type === 'noteOff');
  }
}

export default MidiMapper;
