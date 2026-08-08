/**
 * MidiScheduler — Precise MIDI step sequencer
 *
 * Uses performance.now() + setTimeout for jitter-free MIDI timing.
 * Uses requestAnimationFrame ONLY for UI step updates.
 *
 * Architecture:
 *   - Lookahead: schedules MIDI events 100ms in advance
 *   - setTimeout fires MIDI events at precise times
 *   - requestAnimationFrame updates currentStep in UI
 *   - 16 steps = 1 bar; at bar end, callback triggers pattern regeneration
 *
 * Timing model:
 *   stepTime = startTime + (stepIndex * stepDuration) + swingOffset
 *   stepDuration = 60000 / bpm / 4  (16th notes)
 *
 * Dual Mode:
 *   - 'internal': Timer-based scheduling (standard)
 *   - 'midi': External clock-driven, events fired on clock pulse
 */

import MidiMapper from './MidiMapper.js';

class MidiScheduler {
  constructor(midiEngine) {
    this.midiEngine = midiEngine;
    this.mapper = new MidiMapper();

    // State
    this.isPlaying = false;
    this.bpm = 120;
    this.currentStep = 0;
    this.barCount = 0;

    // Pattern & tracks
    this.pattern = null;        // Current mapped pattern (16 arrays of events)
    this.tracks = null;         // Track config from store
    this.rawPattern = null;     // Raw pattern from PatternEngine (for re-generation)

    // Timing
    this.startTime = 0;         // performance.now() when play started
    this.stepDuration = 0;      // ms per 16th note
    this.lookahead = 100;       // ms to look ahead for scheduling
    this.scheduleAheadTime = 0.1; // seconds (for setTimeout precision)

    // Scheduling
    this.nextStepTime = 0;      // When the next step should fire
    this.nextStepIndex = 0;     // Which step fires next
    this.schedulerTimer = null; // Main scheduler loop timer
    this.uiRaf = null;          // requestAnimationFrame ID for UI

    // Active notes tracking: "channel:note" → { timeout, track }
    this.activeNotes = new Map();

    // Callbacks
    this.onStep = null;         // (stepIndex) => void — for UI updates
    this.onBarEnd = null;       // (barCount) => void — for pattern regeneration
    this.onPatternRequest = null; // () => pattern — to fetch fresh pattern at bar end

    // Dirty flag: set when parameters change mid-bar
    this.patternDirty = false;

    // External clock mode
    this.clockSource = 'internal'; // 'internal' | 'midi'
    this._isExternalClockRunning = false;
  }

  /**
   * Calculate step duration from BPM
   * @param {number} bpm
   * @returns {number} ms per 16th note
   */
  _calcStepDuration(bpm) {
    return 60000 / bpm / 4;
  }

  /**
   * Start the scheduler
   * @param {Object} pattern - Raw pattern from PatternEngine
   * @param {number} bpm
   * @param {Object} tracks - Track config { drums, bass, synth }
   * @param {string} clockSource - 'internal' | 'midi'
   */
  start(pattern, bpm, tracks, clockSource = 'internal') {
    if (this.isPlaying) this.stop();

    this.clockSource = clockSource;
    this.bpm = bpm;
    this.tracks = tracks;
    this.rawPattern = pattern;
    this.stepDuration = this._calcStepDuration(bpm);

    // Map pattern to MIDI events
    this.pattern = this.mapper.mapPattern(pattern, tracks, bpm);

    // Reset state
    this.currentStep = 0;
    this.nextStepIndex = 0;
    this.barCount = 0;
    this.patternDirty = false;

    if (clockSource === 'midi') {
      // External mode: no internal timer, wait for clock events
      this.isPlaying = true;
      this._isExternalClockRunning = false;
      this._startUILoop();
      return;
    }

    // Internal mode: timing anchor
    this.startTime = performance.now();
    this.nextStepTime = this.startTime;

    this.isPlaying = true;

    // Start scheduler loop
    this._scheduleSteps();

    // Start UI update loop
    this._startUILoop();
  }

  /**
   * Start in external clock mode (called when MIDI Start received)
   * @param {Object} pattern - Raw pattern
   * @param {Object} tracks - Track config
   */
  startExternal(pattern, tracks) {
    if (!this.isPlaying) return;
    this._isExternalClockRunning = true;
    this.tracks = tracks;
    this.rawPattern = pattern;
    this.pattern = this.mapper.mapPattern(pattern, tracks, this.bpm);
    this.currentStep = 0;
    this.nextStepIndex = 0;
    this.barCount = 0;
    this.patternDirty = false;
  }

  /**
   * Advance one step (called by external clock pulse, every 6 clocks)
   * Events are sent immediately — the master clock provides the timing.
   */
  _onExternalStep() {
    if (!this.isPlaying || !this._isExternalClockRunning) return;
    if (!this.pattern) return;

    const stepIdx = this.nextStepIndex % 16;
    this.currentStep = stepIdx;

    // Fire pattern events immediately
    this._fireStepEvents(stepIdx);

    this.nextStepIndex++;

    // Bar end (16 steps)
    if (this.nextStepIndex >= 16) {
      this.nextStepIndex = 0;
      this.barCount++;

      // Handle pattern regeneration at bar end
      if (this.patternDirty && this.onPatternRequest) {
        const newPattern = this.onPatternRequest();
        if (newPattern) {
          this.rawPattern = newPattern;
          this.pattern = this.mapper.mapPattern(newPattern, this.tracks, this.bpm);
          this.patternDirty = false;
        }
      }

      this.onBarEnd?.(this.barCount);
    }
  }

  /**
   * Fire all MIDI events for a step immediately (no setTimeout)
   * @param {number} stepIdx
   */
  _fireStepEvents(stepIdx) {
    if (!this.pattern?.[stepIdx]) return;

    const events = this.pattern[stepIdx];
    for (const event of events) {
      if (event.type === 'noteOn') {
        const key = `${event.channel}:${event.note}`;
        // Cancel previous note on same key
        this._cancelNote(key);
        // Send immediately
        this.midiEngine.noteOn(event.channel, event.note, event.velocity);

        // Schedule note off based on sustain
        const sustainDuration = (event.sustainSteps || 1) * this.stepDuration;
        const offTimeout = setTimeout(() => {
          this.midiEngine.noteOff(event.channel, event.note);
          this.activeNotes.delete(key);
        }, sustainDuration);

        this.activeNotes.set(key, {
          onTimeout: null,
          offTimeout,
          channel: event.channel,
          note: event.note,
          track: event.track,
        });
      }
    }
  }

  /**
   * Switch clock source
   * @param {string} source - 'internal' | 'midi'
   */
  setClockSource(source) {
    if (source === this.clockSource) return;
    // Stop current mode cleanly
    this.stop();
    this.clockSource = source;
  }

  /**
   * Stop all playback, silence notes
   */
  stop() {
    this.isPlaying = false;
    this._isExternalClockRunning = false;

    // Clear scheduler
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    // Clear UI loop
    if (this.uiRaf) {
      cancelAnimationFrame(this.uiRaf);
      this.uiRaf = null;
    }

    // Silence all active notes
    this._silenceAll();

    this.currentStep = 0;
  }

  /**
   * Update BPM without restarting
   * @param {number} newBpm
   */
  updateBpm(newBpm) {
    if (newBpm < 60 || newBpm > 200) return;

    const oldDuration = this.stepDuration;
    this.bpm = newBpm;
    this.stepDuration = this._calcStepDuration(newBpm);

    // Adjust next step time proportionally
    if (this.isPlaying && oldDuration > 0) {
      const ratio = this.stepDuration / oldDuration;
      const elapsed = this.nextStepTime - performance.now();
      this.nextStepTime = performance.now() + (elapsed * ratio);
    }
  }

  /**
   * Mark pattern as dirty (parameter changed mid-bar)
   * Will regenerate at bar end
   */
  markDirty() {
    this.patternDirty = true;
  }

  /**
   * Load a new pattern (called externally or at bar end)
   * @param {Object} pattern - Raw pattern from PatternEngine
   */
  loadPattern(pattern) {
    this.rawPattern = pattern;
    this.pattern = this.mapper.mapPattern(pattern, this.tracks);
    this.patternDirty = false;
  }

  /**
   * Load new pattern immediately at next step boundary (not bar end).
   * Smoother than bar-end: pattern switches within 1 step.
   * Only active when isPlaying is true.
   * @param {Object} pattern - Raw pattern from PatternEngine
   * @param {Object} tracks - Track config from store
   */
  loadPatternLive(pattern, tracks) {
    if (!this.isPlaying) return;
    this.rawPattern = pattern;
    this.tracks = tracks;
    // Map immediately — will be picked up by _scheduleSteps lookahead
    this.pattern = this.mapper.mapPattern(pattern, tracks, this.bpm);
    this.patternDirty = false;
  }

  // ─── Internal: Scheduling ──────────────────────────────────────────

  /**
   * Main scheduler loop — runs via setTimeout for precise MIDI timing
   * Looks ahead 100ms and schedules events
   */
  _scheduleSteps() {
    if (!this.isPlaying) return;

    const now = performance.now();

    // Schedule all steps within the lookahead window
    while (this.nextStepTime < now + this.lookahead) {
      this._scheduleStep(this.nextStepIndex, this.nextStepTime);

      // Advance to next step
      this.nextStepIndex++;
      this.nextStepTime += this.stepDuration;

      // Bar end (16 steps)
      if (this.nextStepIndex >= 16) {
        this.nextStepIndex = 0;
        this.barCount++;

        // Handle pattern regeneration at bar end
        if (this.patternDirty && this.onPatternRequest) {
          const newPattern = this.onPatternRequest();
          if (newPattern) {
            this.rawPattern = newPattern;
          this.pattern = this.mapper.mapPattern(newPattern, this.tracks, this.bpm);
            this.patternDirty = false;
          }
        }

        this.onBarEnd?.(this.barCount);
      }
    }

    // Schedule next check — half the lookahead for smooth scheduling
    const nextCheckMs = Math.max(1, this.lookahead / 2);
    this.schedulerTimer = setTimeout(() => this._scheduleSteps(), nextCheckMs);
  }

  /**
   * Schedule MIDI events for a single step at a precise time
   * @param {number} stepIdx - Step index (0-15)
   * @param {number} time - Absolute time in ms (performance.now() based)
   */
  _scheduleStep(stepIdx, time) {
    if (!this.pattern?.[stepIdx]) return;

    const events = this.pattern[stepIdx];
    const now = performance.now();
    const delay = Math.max(0, time - now);

    for (const event of events) {
      if (event.type === 'noteOn') {
        // Schedule note off for the old note first (if still active)
        const key = `${event.channel}:${event.note}`;
        this._cancelNote(key);

        // Schedule note on
        const onTimeout = setTimeout(() => {
          this.midiEngine.noteOn(event.channel, event.note, event.velocity);
        }, delay);

        // Track active note
        // Schedule note off based on sustain
        const sustainDuration = (event.sustainSteps || 1) * this.stepDuration;
        const offDelay = delay + sustainDuration;
        const offTimeout = setTimeout(() => {
          this.midiEngine.noteOff(event.channel, event.note);
          this.activeNotes.delete(key);
        }, offDelay);

        this.activeNotes.set(key, {
          onTimeout,
          offTimeout,
          channel: event.channel,
          note: event.note,
          track: event.track,
        });
      }
    }

    // Update current step for UI (via callback, actual UI update in RAF loop)
    this.currentStep = stepIdx;
  }

  /**
   * Cancel a scheduled note (send note off, clear timeouts)
   * @param {string} key - "channel:note"
   */
  _cancelNote(key) {
    const active = this.activeNotes.get(key);
    if (!active) return;

    clearTimeout(active.onTimeout);
    clearTimeout(active.offTimeout);

    // Send immediate note off
    this.midiEngine.noteOff(active.channel, active.note);
    this.activeNotes.delete(key);
  }

  /**
   * Silence ALL active notes (used on stop)
   */
  _silenceAll() {
    for (const [key, active] of this.activeNotes) {
      clearTimeout(active.onTimeout);
      clearTimeout(active.offTimeout);
      this.midiEngine.noteOff(active.channel, active.note);
    }
    this.activeNotes.clear();

    // Belt and suspenders: send all-notes-off on used channels
    if (this.tracks) {
      for (const trackName of ['drums', 'bass', 'synth']) {
        const ch = this.tracks[trackName]?.channel;
        if (ch) this.midiEngine.allNotesOff(ch);
      }
    }
  }

  // ─── Internal: UI Updates ──────────────────────────────────────────

  /**
   * requestAnimationFrame loop for UI step updates
   * Only updates currentStep callback — no MIDI logic here
   */
  _startUILoop() {
    const update = () => {
      if (!this.isPlaying) return;
      this.onStep?.(this.currentStep);
      this.uiRaf = requestAnimationFrame(update);
    };
    this.uiRaf = requestAnimationFrame(update);
  }

  /**
   * Clean up all resources
   */
  destroy() {
    this.stop();
    this.onStep = null;
    this.onBarEnd = null;
    this.onPatternRequest = null;
  }
}

export default MidiScheduler;
