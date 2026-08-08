import { memo } from 'react'
import { motion } from 'framer-motion'

const DRUM_CONFIG = [
  { key: 'kickWeight',  label: 'Kick',  icon: '🦶', color: '#ef4444' },
  { key: 'snareWeight', label: 'Snare', icon: '🥁', color: '#f59e0b' },
  { key: 'hihatWeight', label: 'Hihat', icon: '💿', color: '#22c55e' },
  { key: 'clapWeight',  label: 'Clap',  icon: '👏', color: '#3b82f6' },
  { key: 'percWeight',  label: 'Perc',  icon: '🎵', color: '#ec4899' },
]

const DrumMixPanel = memo(({ params = {}, onChange, color }) => {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
        🎵 Drum Mix
      </div>
      {DRUM_CONFIG.map(({ key, label, icon, color: sliderColor }) => {
        const value = params[key] ?? 100

        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-sm w-5 text-center">{icon}</span>
            <span className="text-xs font-medium w-12 text-gray-300">{label}</span>

            {/* Slider track */}
            <div className="flex-1 relative">
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${Math.min(value, 200) / 2}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  style={{
                    background: `linear-gradient(90deg, ${sliderColor}80, ${sliderColor})`,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={1}
                value={value}
                onChange={(e) => onChange?.(key, Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                style={{ minHeight: 44 }}
              />
            </div>

            {/* Percent display */}
            <motion.span
              key={`${key}-${value}`}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold tabular-nums w-8 text-right"
              style={{ color: sliderColor }}
            >
              {value}%
            </motion.span>
          </div>
        )
      })}
    </div>
  )
})

DrumMixPanel.displayName = 'DrumMixPanel'

export default DrumMixPanel
