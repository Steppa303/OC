import { memo } from 'react'
import { motion } from 'framer-motion'
import { DRUM_INSTRUMENT_LABELS } from '../utils/drumMap.js'

const DRUM_GROUPS = [
  {
    label: '🦶 Kick & Snare',
    instruments: [
      { key: 'kickWeight',  icon: '🦶', color: '#ef4444' },
      { key: 'snareWeight', icon: '🥁', color: '#f59e0b' },
    ],
  },
  {
    label: '🪘 Toms',
    instruments: [
      { key: 'loTomWeight',  icon: '⬇️', color: '#a855f7' },
      { key: 'midTomWeight', icon: '🔶', color: '#8b5cf6' },
      { key: 'hiTomWeight',  icon: '⬆️', color: '#7c3aed' },
    ],
  },
  {
    label: '💿 Hihats & Cymbals',
    instruments: [
      { key: 'chhWeight',  icon: '💿', color: '#22c55e' },
      { key: 'ohhWeight',  icon: '🔓', color: '#10b981' },
      { key: 'crashWeight', icon: '💥', color: '#06b6d4' },
      { key: 'rideWeight',  icon: '🔔', color: '#0891b2' },
    ],
  },
  {
    label: '👏 Percussion',
    instruments: [
      { key: 'rimWeight', icon: '🥢', color: '#3b82f6' },
      { key: 'clapWeight', icon: '👏', color: '#ec4899' },
    ],
  },
]

const DrumSlider = memo(({ key_, label, icon, color: sliderColor, value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-sm w-5 text-center shrink-0">{icon}</span>
    <span className="text-[11px] font-medium w-20 shrink-0 text-zinc-400">{label}</span>
    <div className="flex-1 relative">
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${Math.min(value, 200) / 2}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ background: `linear-gradient(90deg, ${sliderColor}80, ${sliderColor})` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={200}
        step={1}
        value={value}
        onChange={(e) => onChange?.(key_, Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ minHeight: 36 }}
      />
    </div>
    <motion.span
      key={`${key_}-${value}`}
      initial={{ scale: 1.1 }}
      animate={{ scale: 1 }}
      className="text-[10px] font-bold tabular-nums w-9 text-right shrink-0"
      style={{ color: sliderColor }}
    >
      {value}%
    </motion.span>
  </div>
))
DrumSlider.displayName = 'DrumSlider'

const DrumMixPanel = memo(({ params = {}, onChange, color }) => {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
        🎵 Drum Mix
      </div>
      {DRUM_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 pl-1">
            {group.label}
          </div>
          {group.instruments.map(({ key, icon, color: sliderColor }) => {
            const value = params[key] ?? 100
            const label = DRUM_INSTRUMENT_LABELS[key.replace('Weight', '')] || key
            return (
              <DrumSlider
                key={key}
                key_={key}
                label={label}
                icon={icon}
                color={sliderColor}
                value={value}
                onChange={onChange}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
})

DrumMixPanel.displayName = 'DrumMixPanel'

export default DrumMixPanel