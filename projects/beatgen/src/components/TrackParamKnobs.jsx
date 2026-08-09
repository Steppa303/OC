import { memo } from 'react'
import { motion } from 'framer-motion'
import Knob from './Knob'

const KNOB_CONFIG = [
  { key: 'density',    label: 'Density', color: '#22c55e', icon: '📊' },
  { key: 'complexity', label: 'Complex', color: '#f59e0b', icon: '🧩' },
  { key: 'groove',     label: 'Groove',  color: '#ec4899', icon: '💃' },
]

const knobVariants = {
  hidden: { opacity: 0, scale: 0.6, y: 10 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
}

const TrackParamKnobs = memo(({ track, params = {}, globalMood = {}, onChange, onReset, color }) => {
  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-2">
      {KNOB_CONFIG.map(({ key, label, color: defaultColor, icon }) => (
        <motion.div
          key={key}
          variants={knobVariants}
          className="flex flex-col items-center gap-0.5"
        >
          <span className="text-sm mb-0.5">{icon}</span>
          <Knob
            label={label}
            value={params[key] ?? globalMood[key] ?? 50}
            inherited={params[key] == null}
            inheritedValue={globalMood[key]}
            onReset={() => onReset?.(key)}
            onChange={(v) => onChange?.(key, v)}
            color={color || defaultColor}
            size={64}
          />
        </motion.div>
      ))}
    </div>
  )
})

TrackParamKnobs.displayName = 'TrackParamKnobs'

export default TrackParamKnobs
