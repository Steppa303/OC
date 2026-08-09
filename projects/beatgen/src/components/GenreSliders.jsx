import { motion } from 'framer-motion'

const GENRES = [
  { key: 'acid',   label: 'Acid',    color: '#00ff41' },
  { key: 'house',  label: 'House',   color: '#f7c948' },
  { key: 'techno', label: 'Techno',  color: '#ff6b35' },
  { key: 'trance', label: 'Trance',  color: '#00d4ff' },
  { key: 'dnb',    label: 'D&B',     color: '#ff3860' },
  { key: 'hiphop', label: 'Hip-Hop', color: '#9b59b6' },
]

/**
 * GenreSliders — reusable 6-genre slider component.
 *
 * Props:
 *   values      — { techno: 40, house: 15, ... }
 *   onChange    — (genre, value) => void
 *   syncMode    — true = "Synced" (show info text, hide sliders)
 *   onToggleSync — () => void
 *   onResetSync — () => void (reset to global)
 *   trackColor  — CSS color for the track's theme
 *   showSyncToggle — whether to show the sync/un-sync button (false for Global card)
 *   readOnly    — boolean
 *   compact     — boolean
 */
const GenreSliders = ({
  values = {},
  onChange,
  syncMode = false,
  onToggleSync,
  onResetSync,
  trackColor = '#8b5cf6',
  showSyncToggle = false,
  readOnly = false,
  compact = false,
}) => {
  return (
    <div className="space-y-3">
      {/* Sync toggle header */}
      {showSyncToggle && (
        <div className="flex items-center justify-between mb-1">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onToggleSync}
            className={`
              flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium
              transition-all border
              ${syncMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'
              }
            `}
            style={!syncMode ? { borderColor: `${trackColor}40` } : {}}
          >
            <span>{syncMode ? '🔗' : '🔓'}</span>
            <span>{syncMode ? 'Synced with Global' : 'Custom Mix'}</span>
          </motion.button>
        </div>
      )}

      {/* Synced state: info text only */}
      {syncMode ? (
        <motion.div
          key="synced-info"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-zinc-500 italic py-3 text-center"
        >
          Following Global Mix — toggle &quot;Custom Mix&quot; to set per-track genre weights
        </motion.div>
      ) : (
        <motion.div
          key="genre-sliders"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`space-y-${compact ? '2' : '3'}`}
        >
          {GENRES.map(({ key, label, color }) => {
            const value = values[key] ?? 0
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs font-medium w-16 text-gray-300">{label}</span>
                {/* Slider track */}
                <div className="flex-1 relative">
                  <div
                    className="w-full h-3 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: `${value}%` }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      style={{
                        background: `linear-gradient(90deg, ${color}80, ${color})`,
                        opacity: readOnly ? 0.4 : 1,
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={value}
                    onChange={(e) => onChange(key, parseInt(e.target.value))}
                    disabled={readOnly}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ minHeight: 44 }}
                  />
                </div>
                {/* Value display */}
                <motion.span
                  key={`${key}-${value}`}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="text-xs font-bold tabular-nums w-9 text-right"
                  style={{ color }}
                >
                  {value}%
                </motion.span>
              </div>
            )
          })}

          {/* Reset to Global button */}
          {onResetSync && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onResetSync}
              className="w-full mt-2 py-2 rounded-lg text-xs font-medium text-zinc-400 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              ↺ Reset to Global
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  )
}

export default GenreSliders