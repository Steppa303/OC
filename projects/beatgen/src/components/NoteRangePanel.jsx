import { memo } from 'react'
import { motion } from 'framer-motion'

// MIDI note to name helper
function midiToName(note) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(note / 12) - 1
  return `${names[note % 12]}${octave}`
}

const CHORD_MODES = [
  { key: 'off',    label: 'Off' },
  { key: '2note',  label: '2-Note' },
  { key: '3note',  label: '3-Note' },
]

const NoteRangePanel = memo(({ track, params = {}, onChange, onChordModeChange, color }) => {
  const rangeLow = params.rangeLow ?? (track === 'synth' ? 48 : 28)
  const rangeHigh = params.rangeHigh ?? (track === 'synth' ? 84 : 60)
  const noteLength = params.noteLength ?? 65
  const chordMode = params.chordMode ?? 'off'

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
        🎵 Note Range
      </div>

      {/* Range Low */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium w-20 text-gray-300">Range Low</span>
        <div className="flex-1 relative">
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${((rangeLow - 24) / (72 - 24)) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                background: `linear-gradient(90deg, ${color || '#3b82f6'}80, ${color || '#3b82f6'})`,
              }}
            />
          </div>
          <input
            type="range"
            min={24}
            max={72}
            step={1}
            value={rangeLow}
            onChange={(e) => onChange?.('rangeLow', Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ minHeight: 44 }}
          />
        </div>
        <motion.span
          key={`low-${rangeLow}`}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className="text-xs font-bold tabular-nums w-14 text-right"
          style={{ color: color || '#3b82f6' }}
        >
          {midiToName(rangeLow)} ({rangeLow})
        </motion.span>
      </div>

      {/* Range High */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium w-20 text-gray-300">Range High</span>
        <div className="flex-1 relative">
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${((rangeHigh - 36) / (96 - 36)) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                background: `linear-gradient(90deg, ${color || '#3b82f6'}80, ${color || '#3b82f6'})`,
              }}
            />
          </div>
          <input
            type="range"
            min={36}
            max={96}
            step={1}
            value={rangeHigh}
            onChange={(e) => onChange?.('rangeHigh', Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ minHeight: 44 }}
          />
        </div>
        <motion.span
          key={`high-${rangeHigh}`}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className="text-xs font-bold tabular-nums w-14 text-right"
          style={{ color: color || '#3b82f6' }}
        >
          {midiToName(rangeHigh)} ({rangeHigh})
        </motion.span>
      </div>

      {/* Note Length */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium w-20 text-gray-300">Gate Time</span>
        <div className="flex-1 relative">
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${noteLength}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                background: `linear-gradient(90deg, ${color || '#22c55e'}80, ${color || '#22c55e'})`,
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={noteLength}
            onChange={(e) => onChange?.('noteLength', Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ minHeight: 44 }}
          />
        </div>
        <motion.span
          key={`len-${noteLength}`}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className="text-xs font-bold tabular-nums w-8 text-right"
          style={{ color: color || '#22c55e' }}
        >
          {noteLength}%
        </motion.span>
      </div>

      {/* Chord Mode (synth only) */}
      {track === 'synth' && (
        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs font-medium w-20 text-gray-300">Chord Mode</span>
          <div className="flex gap-1">
            {CHORD_MODES.map(({ key, label }) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.95 }}
                onClick={() => onChordModeChange?.(key)}
                className="px-3 py-1.5 text-[10px] font-semibold rounded-full transition-all"
                style={chordMode === key ? {
                  background: `${color || '#a855f7'}30`,
                  border: `1px solid ${color || '#a855f7'}60`,
                  boxShadow: `0 0 8px ${color || '#a855f7'}40`,
                  color: 'white',
                } : {
                  border: '1px solid transparent',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'rgba(156,163,175,1)',
                }}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

NoteRangePanel.displayName = 'NoteRangePanel'

export default NoteRangePanel
