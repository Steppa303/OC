import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'

const TRACK_COLORS = {
  drums: '#ef4444',
  bass: '#3b82f6',
  synth: '#a855f7',
}

const TRACK_ICONS = {
  drums: '🥁',
  bass: '🎸',
  synth: '🎹',
}

const SwingControl = () => {
  const swingMode = useStore(s => s.swingMode)
  const swingAmount = useStore(s => s.swingAmount)
  const trackSwing = useStore(s => s.trackSwing)
  const setSwingMode = useStore(s => s.setSwingMode)
  const setSwingAmount = useStore(s => s.setSwingAmount)
  const setTrackSwing = useStore(s => s.setTrackSwing)

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 25 }}
      className="glass rounded-2xl p-4"
    >
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
          <span>🔄</span> Swing
        </h2>

        {/* Visual toggle switch */}
        <div className="relative flex bg-black/40 rounded-full p-0.5 border border-white/5">
          {/* Animated background pill */}
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

      {/* Slider area with AnimatePresence */}
      <AnimatePresence mode="wait">
        {swingMode === 'global' ? (
          <motion.div
            key="global"
            initial={{ opacity: 0, x: -15, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 15, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <SwingSlider
              value={swingAmount}
              onChange={setSwingAmount}
              color="#8b5cf6"
              label="Amount"
              icon="🎵"
            />
          </motion.div>
        ) : (
          <motion.div
            key="track"
            initial={{ opacity: 0, x: 15, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: -15, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="space-y-2"
          >
            {Object.entries(trackSwing).map(([track, amount]) => (
              <SwingSlider
                key={track}
                value={amount}
                onChange={(v) => setTrackSwing(track, v)}
                color={TRACK_COLORS[track]}
                label={track.charAt(0).toUpperCase() + track.slice(1)}
                icon={TRACK_ICONS[track]}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

const SwingSlider = ({ value, onChange, color, label, icon }) => (
  <div className="flex items-center gap-3">
    <span className="text-sm w-5 text-center">{icon}</span>
    <span className="text-xs font-medium w-14 text-gray-300">{label}</span>
    <div className="flex-1 relative">
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${value}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ minHeight: 44 }}
      />
    </div>
    <motion.span
      key={value}
      initial={{ scale: 1.1 }}
      animate={{ scale: 1 }}
      className="text-xs font-bold tabular-nums w-8 text-right"
      style={{ color }}
    >
      {value}%
    </motion.span>
  </div>
)

export default SwingControl
