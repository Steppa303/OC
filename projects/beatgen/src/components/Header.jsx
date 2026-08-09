import { memo } from 'react'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import midiEngine from '../midi/MidiEngine'

const Header = memo(() => {
  const isPlaying = useStore(s => s.isPlaying)
  const togglePlay = useStore(s => s.togglePlay)
  const toggleSettings = useStore(s => s.toggleSettings)
  const midiConnected = useStore(s => s.midiConnected)
  const midiInitFailed = useStore(s => s.midiInitFailed)
  const clockSource = useStore(s => s.clockSource)
  const externalTransportActive = useStore(s => s.externalTransportActive)
  const setMidiAccess = useStore(s => s.setMidiAccess)
  const setMidiDevices = useStore(s => s.setMidiDevices)
  const setMidiInitFailed = useStore(s => s.setMidiInitFailed)

  const webMidiSupported = typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess

  // Determine MIDI status
  let midiStatusColor = '#64748b'
  let midiStatusGlow = 'none'
  let midiLabel = 'MIDI'

  if (!webMidiSupported) {
    midiStatusColor = '#64748b'
    midiLabel = 'No MIDI'
  } else if (midiConnected) {
    midiStatusColor = '#22c55e'
    midiStatusGlow = '0 0 6px rgba(34,197,94,0.5)'
    midiLabel = 'MIDI ✓'
  } else if (midiInitFailed) {
    midiStatusColor = '#f59e0b'
    midiLabel = 'Connect MIDI'
  } else {
    midiStatusColor = '#ef4444'
    midiLabel = 'No Device'
  }

  // Re-init MIDI (user gesture fallback)
  const handleConnectMidi = async () => {
    const result = await midiEngine.init()
    if (result.success) {
      setMidiAccess(midiEngine.access)
      setMidiDevices(result.devices)
      setMidiInitFailed(false)
      midiEngine.onDevicesChange = (devices) => {
        setMidiDevices(devices)
      }
    }
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="flex items-center justify-between px-4 py-3 glass rounded-2xl mx-0 mt-3"
    >
      {/* Logo with gradient */}
      <div className="flex items-center gap-2.5">
        <motion.div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #ef4444, #a855f7, #3b82f6)',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </motion.div>
        <div className="flex flex-col">
          <span
            className="font-bold text-lg tracking-tight leading-none"
            style={{
              background: 'linear-gradient(135deg, #f8fafc, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            BeatGen
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted leading-none mt-0.5">
            MIDI Generator
          </span>
        </div>
      </div>

      {/* Right side: MIDI badge + Clock Badge + Play + Settings */}
      <div className="flex items-center gap-2">
        {/* Clock source mini badge */}
        <span
          className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          style={{
            background: (clockSource === 'midi' || externalTransportActive) ? 'rgba(168,85,247,0.15)' : 'rgba(100,116,139,0.15)',
            color: (clockSource === 'midi' || externalTransportActive) ? '#a855f7' : '#64748b',
            border: `1px solid ${(clockSource === 'midi' || externalTransportActive) ? 'rgba(168,85,247,0.25)' : 'rgba(100,116,139,0.2)'}`,
          }}
        >
          {(clockSource === 'midi' || externalTransportActive) ? 'EXT' : 'INT'}
        </span>

        {/* MIDI status badge */}
        {!midiConnected && (
          <button
            onClick={midiInitFailed && webMidiSupported ? handleConnectMidi : toggleSettings}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              background: !webMidiSupported ? 'rgba(100,116,139,0.15)' : midiInitFailed ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
              color: !webMidiSupported ? '#64748b' : midiInitFailed ? '#f59e0b' : '#ef4444',
              border: `1px solid ${!webMidiSupported ? 'rgba(100,116,139,0.2)' : midiInitFailed ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: midiStatusColor }}
            />
            {midiLabel}
          </button>
        )}

        {/* Play button */}
        <motion.button
          whileTap={externalTransportActive ? undefined : { scale: 0.9 }}
          onClick={externalTransportActive ? undefined : togglePlay}
          disabled={externalTransportActive}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            externalTransportActive
              ? 'bg-surface border border-white/10 cursor-not-allowed opacity-60'
              : isPlaying
                ? 'bg-active glow-active'
                : 'bg-surface-light hover:bg-surface border border-white/10'
          }`}
          aria-label={externalTransportActive ? 'External Transport Active' : isPlaying ? 'Stop' : 'Play'}
        >
          {externalTransportActive ? (
            <span className="text-[8px] font-semibold text-[#a855f7] uppercase">EXT</span>
          ) : isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <polygon points="7,4 21,12 7,20" />
            </svg>
          )}
        </motion.button>

        {/* Settings button with MIDI status LED */}
        <button
          onClick={toggleSettings}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors relative"
          aria-label="Settings"
        >
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          {/* MIDI status LED */}
          <span
            className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0f]"
            style={{
              background: midiStatusColor,
              boxShadow: midiStatusGlow,
            }}
          />
        </button>
      </div>
    </motion.header>
  )
})

Header.displayName = 'Header'

export default Header
