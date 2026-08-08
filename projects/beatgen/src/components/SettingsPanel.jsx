import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import midiEngine from '../midi/MidiEngine'

const TRACK_COLORS = { drums: '#ef4444', bass: '#3b82f6', synth: '#a855f7' }
const TRACK_ICONS = { drums: '🥁', bass: '🎸', synth: '🎹' }

const SettingsPanel = () => {
  const showSettings = useStore(s => s.showSettings)
  const toggleSettings = useStore(s => s.toggleSettings)
  const midiDevices = useStore(s => s.midiDevices)
  const midiOutput = useStore(s => s.midiOutput)
  const midiConnected = useStore(s => s.midiConnected)
  const setMidiOutput = useStore(s => s.setMidiOutput)
  const setMidiDevices = useStore(s => s.setMidiDevices)
  const tracks = useStore(s => s.tracks)
  const setTrackChannel = useStore(s => s.setTrackChannel)

  // Clock sync state
  const clockSource = useStore(s => s.clockSource)
  const setClockSource = useStore(s => s.setClockSource)
  const midiInputDevices = useStore(s => s.midiInputDevices)
  const setMidiInputDevices = useStore(s => s.setMidiInputDevices)
  const selectedInputDevice = useStore(s => s.selectedInputDevice)
  const setSelectedInputDevice = useStore(s => s.setSelectedInputDevice)
  const externalBpm = useStore(s => s.externalBpm)
  const isExternalRunning = useStore(s => s.isExternalRunning)

  const [midiStatus, setMidiStatus] = useState('ready')
  const [testResult, setTestResult] = useState(null)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)

  const webMidiSupported = typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess

  // Auto-reconnect on device state change
  useEffect(() => {
    if (!midiEngine.access) return

    midiEngine.onStateChange = () => {
      setMidiDevices([...midiEngine.devices])
      setMidiInputDevices([...midiEngine.inputDevices])

      // If the selected device disconnected, try to reconnect
      const currentOutput = midiEngine.output
      if (currentOutput) {
        const device = midiEngine.access.outputs.get(currentOutput.id)
        if (!device || device.state === 'disconnected') {
          setReconnectAttempt(prev => prev + 1)
          setTimeout(() => {
            const reconnected = midiEngine.access.outputs.get(currentOutput.id)
            if (reconnected && reconnected.state === 'connected') {
              midiEngine.selectDevice(currentOutput.id)
              setMidiOutput(midiEngine.getSelectedDevice())
              setReconnectAttempt(0)
            } else {
              setMidiOutput(null)
            }
          }, 1500)
        }
      }
    }

    return () => {
      if (midiEngine.onStateChange) midiEngine.onStateChange = null
    }
  }, [setMidiDevices, setMidiOutput, setMidiInputDevices])

  const handleDeviceSelect = (deviceId) => {
    const success = midiEngine.selectDevice(deviceId)
    if (success) {
      setMidiOutput(midiEngine.getSelectedDevice())
    }
  }

  const handleInputDeviceSelect = (deviceId) => {
    const success = midiEngine.selectInputDevice(deviceId)
    if (success) {
      setSelectedInputDevice(deviceId)
    }
  }

  const handleClockSourceChange = (source) => {
    setClockSource(source)
    // Safety: if switching to midi while internal is playing, scheduler will handle it
  }

  const handleTestNote = () => {
    if (!midiEngine.isConnected()) {
      setTestResult('no-device')
      setTimeout(() => setTestResult(null), 2000)
      return
    }
    midiEngine.testNote(1, 60, 100, 500)
    setTestResult('sent')
    setTimeout(() => setTestResult(null), 2000)
  }

  return (
    <AnimatePresence>
      {showSettings && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={toggleSettings}
          />

          {/* Bottom-sheet panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="bg-surface rounded-t-3xl p-6 max-w-lg mx-auto">
              {/* Drag handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

              <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                <span>⚙️</span> Settings
              </h2>

              {/* Web MIDI Support Check */}
              {!webMidiSupported && (
                <div className="mb-5 p-4 rounded-xl bg-drums/10 border border-drums/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">⚠️</span>
                    <span className="text-sm font-semibold text-drums">Web MIDI Not Supported</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed mb-2">
                    Your browser doesn&apos;t support Web MIDI. Use Chrome or Edge for MIDI output.
                    You can still use the app to generate and preview patterns.
                  </p>
                  <p className="text-[10px] text-muted">
                    Tip: On iOS, Safari 15+ supports Web MIDI with a connected MIDI interface.
                  </p>
                </div>
              )}

              {/* Clock Source Toggle */}
              <div className="space-y-3 mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
                  <span>🕐</span> Clock Source
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleClockSourceChange('internal')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      clockSource === 'internal'
                        ? 'bg-accent/20 border border-accent/40 text-accent'
                        : 'bg-black/20 border border-white/5 text-muted hover:bg-white/5'
                    }`}
                  >
                    Internal
                  </button>
                  <button
                    onClick={() => handleClockSourceChange('midi')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      clockSource === 'midi'
                        ? 'bg-synth/20 border border-synth/40 text-synth'
                        : 'bg-black/20 border border-white/5 text-muted hover:bg-white/5'
                    }`}
                  >
                    MIDI (External)
                  </button>
                </div>
              </div>

              {/* MIDI Input (always visible for Transport + Clock) */}
              <div className="space-y-3 mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{
                    background: isExternalRunning ? '#22c55e' : '#64748b',
                  }} />
                  MIDI Input (Clock + Transport)
                </h3>

                {clockSource === 'midi' && midiInputDevices.length > 0 ? (
                  <div>
                    <label className="text-xs text-muted block mb-1.5">Input Device</label>
                    <div className="relative">
                      <select
                        value={selectedInputDevice || ''}
                        onChange={(e) => handleInputDeviceSelect(e.target.value)}
                        className="w-full appearance-none bg-black/30 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm outline-none focus:border-accent/50 transition-colors cursor-pointer"
                      >
                        <option value="">Select input...</option>
                        {midiInputDevices.map(device => (
                          <option key={device.id} value={device.id}>
                            {device.name} {device.manufacturer ? `(${device.manufacturer})` : ''}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                ) : clockSource === 'internal' && midiInputDevices.length > 0 && (
                  <div>
                    <label className="text-xs text-muted block mb-1.5">Input Device (Transport)</label>
                    <div className="relative">
                      <select
                        value={selectedInputDevice || ''}
                        onChange={(e) => handleInputDeviceSelect(e.target.value)}
                        className="w-full appearance-none bg-black/30 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm outline-none focus:border-accent/50 transition-colors cursor-pointer"
                      >
                        <option value="">Select input...</option>
                        {midiInputDevices.map(device => (
                          <option key={device.id} value={device.id}>
                            {device.name} {device.manufacturer ? `(${device.manufacturer})` : ''}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                )}

                {midiInputDevices.length === 0 && (
                  <p className="text-xs text-muted bg-black/20 rounded-xl p-3 border border-white/5">
                    No MIDI input devices found. Connect a MIDI interface.
                  </p>
                )}

                {/* Link button: use same device for input as output */}
                {midiOutput && selectedInputDevice !== midiOutput?.id && midiInputDevices.length > 0 && (() => {
                  const matched = midiEngine.matchInputForOutput(midiOutput.id)
                  return matched ? (
                    <button
                      onClick={() => {
                        midiEngine.selectInputDevice(matched.id)
                        setSelectedInputDevice(matched.id)
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all bg-bass/10 border border-bass/20 hover:bg-bass/20 text-bass flex items-center justify-center gap-1.5"
                    >
                      <span>🔗</span>
                      <span>Use &ldquo;{matched.name.length > 30 ? matched.name.slice(0, 30) + '…' : matched.name}&rdquo; for input</span>
                    </button>
                  ) : null
                })()}

                {/* Status for external clock mode */}
                {clockSource === 'midi' && (
                  <div className="flex items-center justify-between text-xs bg-black/20 rounded-xl p-3 border border-white/5">
                    <span className="text-muted">
                      {isExternalRunning ? 'Receiving clock...' : 'Waiting for MIDI clock...'}
                    </span>
                    <span className="font-bold tabular-nums text-synth">
                      {externalBpm > 0 ? `${externalBpm} BPM` : '--'}
                    </span>
                  </div>
                )}
              </div>

              {/* MIDI Output Section */}
              <div className="space-y-4 mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{
                    background: midiConnected ? '#22c55e' : '#64748b',
                  }} />
                  MIDI Output
                  {reconnectAttempt > 0 && (
                    <span className="text-[9px] text-accent animate-pulse">Reconnecting...</span>
                  )}
                </h3>

                {/* Device Select */}
                {midiDevices.length > 0 ? (
                  <div>
                    <label className="text-xs text-muted block mb-1.5">Output Device</label>
                    <div className="relative">
                      <select
                        value={midiOutput?.id || ''}
                        onChange={(e) => handleDeviceSelect(e.target.value)}
                        className="w-full appearance-none bg-black/30 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm outline-none focus:border-accent/50 transition-colors cursor-pointer"
                      >
                        <option value="">Select device...</option>
                        {midiDevices.map(device => (
                          <option key={device.id} value={device.id}>
                            {device.name} {device.manufacturer ? `(${device.manufacturer})` : ''}
                            {device.state === 'disconnected' ? ' — disconnected' : ''}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted bg-black/20 rounded-xl p-3 border border-white/5">
                    No MIDI output devices found. Connect a MIDI interface or virtual MIDI port.
                  </p>
                )}

                {/* Test Button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleTestNote}
                  disabled={!midiConnected}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                    midiConnected
                      ? 'bg-accent/20 border border-accent/40 hover:bg-accent/30 text-accent'
                      : 'bg-black/20 border border-white/5 text-muted cursor-not-allowed'
                  }`}
                >
                  {testResult === 'sent' ? '✓ Note Sent!' :
                   testResult === 'no-device' ? '⚠ No device selected' :
                   '🎹 Test MIDI Note'}
                </motion.button>
              </div>

              {/* Channel Config */}
              <div className="space-y-3 mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Channel Mapping</h3>
                {Object.entries(tracks).map(([track, config]) => (
                  <div key={track} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{TRACK_ICONS[track]}</span>
                      <span className="text-sm font-medium capitalize" style={{ color: TRACK_COLORS[track] }}>
                        {track}
                      </span>
                    </div>
                    <div className="relative">
                      <select
                        value={config.channel}
                        onChange={(e) => setTrackChannel(track, Number(e.target.value))}
                        className="appearance-none bg-black/30 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:border-accent/50 transition-colors cursor-pointer"
                      >
                        {Array.from({ length: 16 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Channel {i + 1}</option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>

              {/* Close */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={toggleSettings}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors border border-white/5"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default SettingsPanel
