import { motion } from 'framer-motion'

export const TAB_CONFIG = [
  { key: 'global', icon: '🌍', label: 'Global', color: '#22c55e' },
  { key: 'drums',  icon: '🥁', label: 'Drums',  color: '#ef4444' },
  { key: 'bass',   icon: '🎸', label: 'Bass',   color: '#3b82f6' },
  { key: 'synth',  icon: '🎹', label: 'Synth',  color: '#a855f7' },
]

const TrackTabs = ({ activeTab, onTabChange, tracks, trackGenreOverrides }) => {
  return (
    <div className="flex gap-1.5 px-1 py-2 overflow-x-auto scrollbar-none justify-center">
      {TAB_CONFIG.map(({ key, icon, label, color }) => {
        const isActive = activeTab === key
        const track = tracks?.[key]
        const isMuted = track?.muted
        const isSolo = track?.solo
        const isUnsynced = trackGenreOverrides && key !== 'global' && trackGenreOverrides[key] !== null

        return (
          <motion.button
            key={key}
            onClick={() => onTabChange(key)}
            className={`
              relative flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium
              transition-colors duration-200 shrink-0
              ${isActive
                ? 'text-white'
                : 'text-zinc-400 bg-white/5 hover:bg-white/10 hover:text-zinc-200'
              }
            `}
            style={isActive ? {
              backgroundColor: `${color}18`,
              boxShadow: `0 0 12px ${color}40`,
              borderColor: `${color}60`,
              borderWidth: 1,
              borderStyle: 'solid',
            } : {}}
            whileTap={{ scale: 0.95 }}
          >
            {/* Mute indicator - small red dot */}
            {isMuted && (
              <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
            )}
            {/* Solo indicator - small yellow dot */}
            {isSolo && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
            )}
            {/* Unsynced indicator */}
            {isUnsynced && (
              <span className="absolute -bottom-1 -right-1 text-[10px] leading-none text-zinc-500">✕</span>
            )}
            <span className="text-base">{icon}</span>
            <span className="hidden sm:inline">{label}</span>
            {/* Active glow underline */}
            {isActive && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                style={{ backgroundColor: color }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}

export default TrackTabs