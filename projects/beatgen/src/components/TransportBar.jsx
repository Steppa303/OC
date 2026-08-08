import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'

const TransportBar = () => {
  const isPlaying = useStore(s => s.isPlaying)
  const bpm = useStore(s => s.bpm)
  const currentStep = useStore(s => s.currentStep)
  const swingAmount = useStore(s => s.swingAmount)
  const togglePlay = useStore(s => s.togglePlay)
  const setBpm = useStore(s => s.setBpm)
  const togglePresets = useStore(s => s.togglePresets)

  // Clock sync
  const clockSource = useStore(s => s.clockSource)
  const externalBpm = useStore(s => s.externalBpm)
  const isExternalRunning = useStore(s => s.isExternalRunning)
  const externalTransportActive = useStore(s => s.externalTransportActive)

  const [editingBpm, setEditingBpm] = useState(false)
  const [bpmInput, setBpmInput] = useState(String(bpm))
  const bpmInputRef = useRef(null)

  const isExternalMode = clockSource === 'midi'
  const transportLocked = externalTransportActive  // Disable play button when external transport is active
  const displayBpm = isExternalMode ? externalBpm : bpm

  useEffect(() => {
    if (editingBpm && bpmInputRef.current) {
      bpmInputRef.current.focus()
      bpmInputRef.current.select()
    }
  }, [editingBpm])

  const commitBpm = () => {
    const val = parseInt(bpmInput, 10)
    if (!isNaN(val) && val >= 60 && val <= 200) {
      setBpm(val)
    }
    setEditingBpm(false)
  }

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      <div
        className="glass border-t border-white/5 px-3 py-2 max-w-lg mx-auto"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Step LED strip */}
        <div className="flex gap-[3px] mb-2 px-1">
          {Array.from({ length: 16 }, (_, i) => {
            const isCurrent = i === currentStep && isPlaying
            const isBeat = i % 4 === 0
            return (
              <div
                key={i}
                className="flex-1 h-[5px] rounded-full transition-all duration-75"
                style={{
                  background: isCurrent
                    ? '#22c55e'
                    : isBeat
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(255,255,255,0.04)',
                  boxShadow: isCurrent ? '0 0 6px #22c55e80' : 'none',
                }}
              />
            )
          })}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-2">
          {/* Swing indicator */}
          <div className="flex flex-col items-center min-w-[40px]">
            <span className="text-[8px] uppercase tracking-wider text-muted">Swing</span>
            <span className="text-[11px] font-bold tabular-nums text-accent">{swingAmount}%</span>
          </div>

          {/* BPM with inline edit */}
          <div className="flex flex-col items-center min-w-[52px]">
            <span className="text-[8px] uppercase tracking-wider text-muted">
              {isExternalMode ? (
                <span className="flex items-center gap-1">
                  BPM
                  <span
                    className="text-[7px] font-bold px-1 rounded"
                    style={{
                      background: 'rgba(168,85,247,0.2)',
                      color: '#a855f7',
                    }}
                  >
                    EXT
                  </span>
                </span>
              ) : externalTransportActive ? (
                <span className="flex items-center gap-1">
                  BPM
                  <span
                    className="text-[7px] font-bold px-1 rounded"
                    style={{
                      background: 'rgba(245,158,11,0.2)',
                      color: '#f59e0b',
                    }}
                  >
                    EXT
                  </span>
                </span>
              ) : 'BPM'}
            </span>
            {isExternalMode ? (
              <span className="text-sm font-bold tabular-nums text-synth">
                {externalBpm > 0 ? externalBpm : '--'}
              </span>
            ) : externalTransportActive ? (
              <span className="text-sm font-bold tabular-nums text-white">
                {bpm}
              </span>
            ) : editingBpm ? (
              <input
                ref={bpmInputRef}
                type="number"
                min={60}
                max={200}
                value={bpmInput}
                onChange={(e) => setBpmInput(e.target.value)}
                onBlur={commitBpm}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitBpm()
                  if (e.key === 'Escape') setEditingBpm(false)
                }}
                className="w-12 bg-black/40 border border-accent/50 rounded px-1 py-0.5 text-sm font-bold tabular-nums text-center text-white outline-none"
              />
            ) : (
              <button
                onClick={() => {
                  setBpmInput(String(bpm))
                  setEditingBpm(true)
                }}
                className="text-sm font-bold tabular-nums hover:text-accent transition-colors px-1"
              >
                {bpm}
              </button>
            )}
          </div>

          {/* Play/Stop — centered, large */}
          <motion.button
            whileTap={transportLocked ? undefined : { scale: 0.85 }}
            onClick={transportLocked ? undefined : togglePlay}
            disabled={transportLocked}
            className={`w-14 h-14 -mt-4 rounded-full flex items-center justify-center shadow-lg transition-all ${
              transportLocked
                ? 'bg-surface border border-white/10 cursor-not-allowed opacity-60'
                : isPlaying
                  ? 'bg-active glow-active'
                  : 'bg-gradient-to-br from-accent to-synth hover:brightness-110'
            }`}
            aria-label={transportLocked ? (isExternalMode ? 'Waiting for Clock' : 'External Transport Active') : isPlaying ? 'Stop' : 'Play'}
          >
            {transportLocked ? (
              <span className="text-[8px] font-semibold uppercase leading-tight text-center" style={{ color: clockSource === 'midi' ? '#a855f7' : '#f59e0b' }}>
                {isExternalMode ? (isExternalRunning ? 'EXT' : 'Wait') : 'EXT'}
              </span>
            ) : isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <polygon points="8,5 20,12 8,19" />
              </svg>
            )}
          </motion.button>

          {/* BPM +/- quick adjust */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setBpm(bpm + 1)}
              disabled={isExternalMode || externalTransportActive}
              className={`w-9 h-6 flex items-center justify-center text-xs transition-colors rounded ${
                (isExternalMode || externalTransportActive) ? 'text-white/20 cursor-not-allowed' : 'text-muted hover:text-white'
              }`}
              aria-label="BPM up"
            >
              ▲
            </button>
            <button
              onClick={() => setBpm(bpm - 1)}
              disabled={isExternalMode || externalTransportActive}
              className={`w-9 h-6 flex items-center justify-center text-xs transition-colors rounded ${
                (isExternalMode || externalTransportActive) ? 'text-white/20 cursor-not-allowed' : 'text-muted hover:text-white'
              }`}
              aria-label="BPM down"
            >
              ▼
            </button>
          </div>

          {/* Presets button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={togglePresets}
            className="flex flex-col items-center min-w-[40px] gap-0.5"
            aria-label="Presets"
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-muted"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            <span className="text-[8px] uppercase tracking-wider text-muted">Presets</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

export default TransportBar
