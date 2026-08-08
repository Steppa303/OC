import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import Knob from './Knob'

const MOOD_CONFIG = [
  { key: 'darkness',   label: 'Dark',    color: '#6366f1', icon: '🌑' },
  { key: 'energy',     label: 'Energy',  color: '#ef4444', icon: '⚡' },
  { key: 'complexity', label: 'Complex', color: '#f59e0b', icon: '🧩' },
  { key: 'density',    label: 'Density', color: '#22c55e', icon: '📊' },
  { key: 'groove',     label: 'Groove',  color: '#ec4899', icon: '💃' },
  { key: 'weirdness',  label: 'Weird',   color: '#a855f7', icon: '🤪' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const knobVariants = {
  hidden: { opacity: 0, scale: 0.6, y: 10 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
}

const MoodKnobs = () => {
  const mood = useStore(s => s.mood)
  const setMood = useStore(s => s.setMood)

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="glass rounded-2xl p-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
        <span>🎛️</span> Global Mood (Master)
      </h2>

      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
        {MOOD_CONFIG.map(({ key, label, color, icon }) => (
          <motion.div
            key={key}
            variants={knobVariants}
            className="flex flex-col items-center gap-0.5"
          >
            <span className="text-sm mb-0.5">{icon}</span>
            <Knob
              label={label}
              value={mood[key]}
              onChange={(v) => setMood(key, v)}
              color={color}
              size={64}
            />
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

export default MoodKnobs
