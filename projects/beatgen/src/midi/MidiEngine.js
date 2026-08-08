/**
 * MidiEngine — Web MIDI API wrapper
 * Handles MIDI access, device enumeration, and output.
 */

class MidiEngine {
  constructor() {
    this.access = null
    this.output = null
    this.input = null
    this.devices = []
    this.inputDevices = []
    this.onDevicesChange = null
    this.onStateChange = null
    this.onMessage = null         // Callback for all MIDI messages
    this.onClockMessage = null    // Callback for System Realtime (0xF8+)
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported in this browser')
      return { success: false, error: 'Web MIDI not supported' }
    }

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false })
      this._refreshDevices()

      this.access.onstatechange = () => {
        this._refreshDevices()
        this.onStateChange?.()
      }

      return { success: true, devices: this.devices }
    } catch (err) {
      console.error('MIDI access denied:', err)
      return { success: false, error: err.message }
    }
  }

  _refreshDevices() {
    if (!this.access) return
    // Outputs
    this.devices = []
    this.access.outputs.forEach((output, id) => {
      this.devices.push({
        id,
        name: output.name || `MIDI Output ${id}`,
        manufacturer: output.manufacturer || '',
        state: output.state,
        connection: output.connection,
      })
    })
    // Inputs (NEU)
    this.inputDevices = []
    this.access.inputs.forEach((input, id) => {
      this.inputDevices.push({
        id,
        name: input.name || `MIDI Input ${id}`,
        manufacturer: input.manufacturer || '',
        state: input.state,
        connection: input.connection,
      })
    })
    this.onDevicesChange?.(this.devices)
  }

  selectDevice(deviceId) {
    if (!this.access) return false
    const output = this.access.outputs.get(deviceId)
    if (!output) return false
    this.output = output
    return true
  }

  /**
   * Select a MIDI input device and register message listener
   * System Realtime (>=0xF8) is routed to onClockMessage
   * @param {string} deviceId
   * @returns {boolean}
   */
  selectInputDevice(deviceId) {
    if (!this.access) return false
    const input = this.access.inputs.get(deviceId)
    if (!input) return false
    // Remove listener from previous input
    if (this.input && this._boundHandleMidiMessage) {
      this.input.onmidimessage = null
    }
    this.input = input
    this._boundHandleMidiMessage = this._handleMidiMessage.bind(this)
    this.input.onmidimessage = this._boundHandleMidiMessage
    return true
  }

  /**
   * Handle incoming MIDI message event
   * Routes System Realtime to onClockMessage
   */
  _handleMidiMessage(event) {
    const data = event.data
    if (data[0] >= 0xF8) {
      this.onClockMessage?.(data[0])
    }
    this.onMessage?.(event)
  }

  /**
   * Find matching input device for a given output device ID.
   * Matches by device name (case-insensitive substring, min 3 chars).
   * @param {string} outputDeviceId
   * @returns {{ id: string, name: string } | null}
   */
  matchInputForOutput(outputDeviceId) {
    const output = this.access?.outputs.get(outputDeviceId)
    if (!output) return null
    const outName = (output.name || '').toLowerCase().trim()
    if (outName.length < 3) return null

    // Try exact match first, then substring match
    for (const [id, input] of this.access.inputs) {
      const inName = (input.name || '').toLowerCase().trim()
      if (inName === outName) return { id, name: input.name }
    }
    for (const [id, input] of this.access.inputs) {
      const inName = (input.name || '').toLowerCase().trim()
      if (inName.includes(outName) || outName.includes(inName)) {
        return { id, name: input.name }
      }
    }
    return null
  }

  /**
   * Get available input devices
   * @returns {Array}
   */
  getInputDevices() {
    return this.inputDevices
  }

  getSelectedDevice() {
    if (!this.output) return null
    return {
      id: this.output.id,
      name: this.output.name,
      manufacturer: this.output.manufacturer,
    }
  }

  // Send Note On
  noteOn(channel, note, velocity = 100) {
    if (!this.output) return
    const status = 0x90 | ((channel - 1) & 0x0F)
    this.output.send([status, note & 0x7F, velocity & 0x7F])
  }

  // Send Note Off
  noteOff(channel, note) {
    if (!this.output) return
    const status = 0x80 | ((channel - 1) & 0x0F)
    this.output.send([status, note & 0x7F, 0])
  }

  // Send CC
  sendCC(channel, cc, value) {
    if (!this.output) return
    const status = 0xB0 | ((channel - 1) & 0x0F)
    this.output.send([status, cc & 0x7F, value & 0x7F])
  }

  // Test: play a short note
  testNote(channel = 1, note = 60, velocity = 100, duration = 300) {
    this.noteOn(channel, note, velocity)
    setTimeout(() => this.noteOff(channel, note), duration)
  }

  // All notes off on a channel
  allNotesOff(channel) {
    if (!this.output) return
    for (let note = 0; note < 128; note++) {
      this.noteOff(channel, note)
    }
  }

  // All notes off on all channels
  silenceAll() {
    for (let ch = 1; ch <= 16; ch++) {
      this.allNotesOff(ch)
    }
  }

  isConnected() {
    return !!this.output
  }

  destroy() {
    this.silenceAll()
    if (this.input && this._boundHandleMidiMessage) {
      this.input.onmidimessage = null
    }
    this.output = null
    this.input = null
    this.access = null
    this.devices = []
    this.inputDevices = []
    this.onClockMessage = null
    this.onMessage = null
  }
}

// Singleton
const midiEngine = new MidiEngine()
export default midiEngine
