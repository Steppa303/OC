import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import GenreSliders from './GenreSliders'
import MoodKnobs from './MoodKnobs'
import SwingControl from './SwingControl'

const GlobalCard = () => {
  const genres = useStore(s => s.genres)
  const bpm = useStore(s => s.bpm)
  const setGenreWeight = useStore(s => s.setGenreWeight)

  return (
    <motion.div
      key="global-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="space-y-4"
    >
      {/* Card: Global Genre Mix */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <span>🌍</span> Global Mix
          </h2>
          <span className="text-xs text-zinc-500 tabular-nums bg-white/5 px-2 py-0.5 rounded-full">
            {bpm} BPM
          </span>
        </div>
        <GenreSliders values={genres} onChange={setGenreWeight} />
      </div>

      {/* Card: Mood Knobs */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <span>🎛️</span> Global Mood (Master)
        </h2>
        <MoodKnobs />
      </div>

      {/* Card: Swing */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <span>🔄</span> Swing
        </h2>
        <SwingControl />
      </div>
    </motion.div>
  )
}

export default GlobalCard