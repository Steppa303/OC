import { memo } from 'react'
import { motion } from 'framer-motion'

const SLIDER_CONFIG = [
  { key: 'darkness',  label: 'Darkness 🌑', color: '#6366f1', min: 0, max: 100, step: 1 },
  { key: 'weirdness', label: 'Weirdness 🤪', color: '#a855f7', min: 0, max: 100, step: 1 },
  { key: 'octave',    label: 'Octave 🎵',    color: '#22c55e', min: -2, max: 2, step: 1 },
]

const TrackParamSliders = memo(({ track, params = {}, globalMood = {}, onChange, onReset, color }) => {
  return (
    <div className="space-y-2">
      {SLIDER_CONFIG.map(({ key, label, color: defaultColor, min, max, step }) => {
        const inherited = params[key] == null
        const fallbackValue = key === 'octave' ? 0 : (globalMood[key] ?? 50)
        const value = inherited ? fallbackValue : params[key]
        const range = max - min
        const percent = ((value - min) / range) * 100
        const displayColor = color || defaultColor
        const trackStyle = inherited ? { opacity: 0.35 } : undefined

        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs font-medium w-24 text-gray-300">{label}</span>

            {/* Slider track */}
            <div className="flex-1 relative">
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${percent}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  style={{
                    background: `linear-gradient(90deg, ${displayColor}80, ${displayColor})`,
                    ...trackStyle,
                  }}
                />
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange?.(key, Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                style={{ minHeight: 44 }}
                onDoubleClick={() => {
                  if (key === 'octave') return
                  onReset?.(key)
                }}
              />
            </div>

            {/* Value display */}
            <motion.span
              key={`${key}-${value}`}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold tabular-nums w-8 text-right"
              style={{ color: displayColor }}
            >
              {key === 'octave'
                ? (value > 0 ? `+${value}` : `${value}`)
                : inherited
                  ? 'auto'
                  : `${value}%`}
            </motion.span>
          </div>
        )
      })}
    </div>
  )
})

TrackParamSliders.displayName = 'TrackParamSliders'

export default TrackParamSliders
