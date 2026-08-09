import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import GenreSliders from './GenreSliders'
import Knob from './Knob'

const MOOD_CONFIG = [
  { key: 'darkness',   label: 'Dark',    color: '#6366f1', icon: '🌑' },
  { key: 'energy',     label: 'Energy',  color: '#ef4444', icon: '⚡' },
  { key: 'complexity', label: 'Complex', color: '#f59e0b', icon: '🧩' },
  { key: 'density',    label: 'Density', color: '#22c55e', icon: '📊' },
  { key: 'groove',     label: 'Groove',  color: '#ec4899', icon: '💃' },
  { key: 'weirdness',  label: 'Weird',   color: '#a855f7', icon: '🤪' },
]

const GlobalCard = () => {
  const genres = useStore(s => s.genres)
  const mood = useStore(s => s.mood)
  const swingMode = useStore(s => s.swingMode)
  const swingAmount = useStore(s => s.swingAmount)
  const trackSwing = useStore(s => s.trackSwing)
  const setGenreWeight = useStore(s => s.setGenreWeight)
  const setMood = useStore(s => s.setMood)
  const setSwingMode = useStore(s => s.setSwingMode)
  const setSwingAmount = useStore(s => s.setSwingAmount)
  const setTrackSwing = useStore(s => s.setTrackSwing)

  return (
    <motion.div
      key="global-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="space-y-3"
    >
      {/* Genre Mix */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
          <span>🌍</span> Global Mix
        </h2>
        <GenreSliders
          values={genres}
          onChange={setGenreWeight}
          syncMode={false}
        />
      </div>

      {/* Mood Knobs */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
          <span>🎛️</span> Global Mood (Master)
        </h2>
        <div className="grid grid-cols-3 gap-x-5 gap-y-4">
          {MOOD_CONFIG.map(({ key, label, color, icon }) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-0.5"
            >
              <span className="text-sm mb-0.5">{icon}</span>
              <Knob
                label={label}
                value={mood[key]}
                onChange={(v) => setMood(key, v)}
                color={color}
                size={72}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Swing Control */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
            <span>🔄</span> Swing
          </h2>

          {/* Mode toggle */}
          <div className="relative flex bg-black/40 rounded-full p-0.5 border border-white/5">
            <motion.div
              className="absolute top-0.5 bottom-0.5 rounded-full bg-accent/25 border border-accent/40"
              animate={{
                left: swingMode === 'global' ? 2 : '50%',
                right: swingMode === 'global' ? '50%' : 2,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            {['global', 'track'].map(mode => (
              <button
                key={mode}
                onClick={() => setSwingMode(mode)}
                className={`relative z-10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-colors min-w-[60px] ${
                  swingMode === mode ? 'text-white' : 'text-muted hover:text-gray-300'
                }`}
              >
                {mode === 'global' ? '🌍 Global' : '🎚️ Track'}
              </button>
            ))}
          </div>
        </div>

        {swingMode === 'global' ? (
          <SwingSlider value={swingAmount} onChange={setSwingAmount} color="#8b5cf6" label="Amount" icon="🎵" />
        ) : (
          <div className="space-y-3">
            <SwingSlider value={trackSwing.drums} onChange={(v) => setTrackSwing('drums', v)} color="#ef4444" label="Drums" icon="🥁" />
            <SwingSlider value={trackSwing.bass} onChange={(v) => setTrackSwing('bass', v)} color="#3b82f6" label="Bass" icon="🎸" />
            <SwingSlider value={trackSwing.synth} onChange={(v) => setTrackSwing('synth', v)} color="#a855f7" label="Synth" icon="🎹" />
          </div>
        )}
      </div>
    </motion.div>
  )
}

const SwingSlider = ({ value, onChange, color, label, icon }) => (
  <div className="flex items-center gap-3">
    <span className="text-sm w-5 text-center">{icon}</span>
    <span className="text-xs font-medium w-14 text-gray-300">{label}</span>
    <div className="flex-1 relative">
      <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${value}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
        />
      </div>
      <input
        type="range" min={0} max={100} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ minHeight: 44 }}
      />
    </div>
    <motion.span key={value} initial={{ scale: 1.1 }} animate={{ scale: 1 }}
      className="text-xs font-bold tabular-nums w-8 text-right" style={{ color }}>
      {value}%
    </motion.span>
  </div>
)

export default GlobalCard