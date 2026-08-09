import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const DRUM_SECTIONS = [
  {
    label: '🦶 Kick & Snare',
    defaultOpen: true,
    instruments: [
      { key: 'kickWeight',  label: 'BD Kick',    icon: '🦶', color: '#ef4444' },
      { key: 'snareWeight', label: 'SD Snare',   icon: '🥁', color: '#f59e0b' },
    ],
  },
  {
    label: '🪘 Toms',
    defaultOpen: false,
    instruments: [
      { key: 'loTomWeight',  label: 'LT Low',     icon: '🪘', color: '#d97706' },
      { key: 'midTomWeight', label: 'MT Mid',     icon: '🪘', color: '#d97706' },
      { key: 'hiTomWeight',  label: 'HT Hi',      icon: '🪘', color: '#d97706' },
    ],
  },
  {
    label: '💿 Hihats & Cymbals',
    defaultOpen: false,
    instruments: [
      { key: 'chhWeight',  label: 'CH Closed',   icon: '💿', color: '#22c55e' },
      { key: 'ohhWeight',  label: 'OH Open',     icon: '💿', color: '#06b6d4' },
      { key: 'crashWeight', label: 'CR Crash',    icon: '💥', color: '#a855f7' },
      { key: 'rideWeight',  label: 'RC Ride',     icon: '🎵', color: '#3b82f6' },
    ],
  },
  {
    label: '👏 Percussion',
    defaultOpen: false,
    instruments: [
      { key: 'rimWeight',  label: 'RS Rim',       icon: '🎯', color: '#8b5cf6' },
      { key: 'clapWeight', label: 'HC Clap',      icon: '👏', color: '#ec4899' },
    ],
  },
]

const DrumSection = memo(({ section, params, onChange, initialOpen }) => {
  const [isOpen, setIsOpen] = useState(initialOpen)

  return (
    <div className="space-y-2">
      {/* Section header — tappable */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg
          bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/5
          transition-all cursor-pointer select-none"
        style={{ minHeight: 40 }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          {section.label}
        </span>
        <motion.span
          className="text-zinc-500 text-xs"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          ▼
        </motion.span>
      </motion.button>

      {/* Instruments */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
            className="space-y-2.5 overflow-hidden"
          >
            {section.instruments.map(({ key, label, icon, color: sliderColor }) => {
              const value = params[key] ?? 100

              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs w-5 text-center">{icon}</span>
                  <span className="text-[10px] font-medium w-16 text-gray-400">{label}</span>

                  {/* Slider track */}
                  <div className="flex-1 relative">
                    <div
                      className="w-full h-2.5 rounded-full overflow-hidden"
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
                      style={{ minHeight: 36 }}
                    />
                  </div>

                  {/* Percent display */}
                  <motion.span
                    key={`${key}-${value}`}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    className="text-[10px] font-bold tabular-nums w-9 text-right"
                    style={{ color: sliderColor }}
                  >
                    {value}%
                  </motion.span>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

DrumSection.displayName = 'DrumSection'

const DrumMixPanel = memo(({ params = {}, onChange, color }) => {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
        🎵 Drum Mix
      </div>
      {DRUM_SECTIONS.map((section) => (
        <DrumSection
          key={section.label}
          section={section}
          params={params}
          onChange={onChange}
          initialOpen={section.defaultOpen}
        />
      ))}
    </div>
  )
})

DrumMixPanel.displayName = 'DrumMixPanel'

export default DrumMixPanel