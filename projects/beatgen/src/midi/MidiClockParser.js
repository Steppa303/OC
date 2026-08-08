/**
 * MidiClockParser — MIDI System Realtime message parser
 *
 * Parses MIDI Clock (0xF8), Start (0xFA), Continue (0xFB), Stop (0xFC)
 * and calculates BPM from clock pulse intervals.
 *
 * 24 PPQN = 24 clock pulses per quarter note.
 * Every 6 clocks = 1 sixteenth note (step).
 */

class MidiClockParser {
  constructor() {
    this.bpm = 0
    this.isRunning = false
    this.clockCount = 0           // Counts 0-23 (24 PPQN)
    this.lastClockTime = 0        // performance.now() of last clock pulse
    this.clockIntervals = []      // Last 24 intervals for BPM averaging

    // Callbacks
    this.onClock = null           // () => void — fired every 6 clocks (= 1 step)
    this.onStart = null           // () => void
    this.onStop = null            // () => void
    this.onContinue = null        // () => void
    this.onBpmChange = null       // (newBpm) => void
  }

  /**
   * Process a MIDI status byte (System Realtime)
   * Called by MidiEngine.onClockMessage
   * @param {number} statusByte
   */
  handleMessage(statusByte) {
    switch (statusByte) {
      case 0xF8: // Timing Clock
        this._handleClock()
        break
      case 0xFA: // Start
        this.isRunning = true
        this.clockCount = 0
        this.clockIntervals = []
        this.lastClockTime = 0
        this.onStart?.()
        break
      case 0xFB: // Continue
        this.isRunning = true
        this.onContinue?.()
        break
      case 0xFC: // Stop
        this.isRunning = false
        this.clockCount = 0
        this.onStop?.()
        break
    }
  }

  /**
   * Handle a single clock pulse (0xF8)
   */
  _handleClock() {
    const now = performance.now()
    this.clockCount++

    // BPM from clock intervals
    if (this.lastClockTime > 0) {
      const interval = now - this.lastClockTime
      this.clockIntervals.push(interval)
      if (this.clockIntervals.length > 24) {
        this.clockIntervals.shift()
      }
      // Need at least 6 intervals for a stable reading
      if (this.clockIntervals.length >= 6) {
        const avgInterval = this.clockIntervals.reduce((a, b) => a + b, 0) / this.clockIntervals.length
        const newBpm = Math.round(60000 / (avgInterval * 24))
        // Hysteresis: only report change if >1 BPM difference
        if (Math.abs(newBpm - this.bpm) > 1) {
          this.bpm = newBpm
          this.onBpmChange?.(newBpm)
        }
      }
    }
    this.lastClockTime = now

    // Every 6 clocks = 1 sixteenth note step
    if (this.clockCount >= 6) {
      this.clockCount = 0
      this.onClock?.()
    }
  }

  /**
   * Reset parser state
   */
  reset() {
    this.bpm = 0
    this.isRunning = false
    this.clockCount = 0
    this.clockIntervals = []
    this.lastClockTime = 0
  }

  /**
   * Clean up all callbacks
   */
  destroy() {
    this.onClock = null
    this.onStart = null
    this.onStop = null
    this.onContinue = null
    this.onBpmChange = null
  }
}

export default MidiClockParser
