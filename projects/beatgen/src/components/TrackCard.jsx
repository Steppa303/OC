import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import VolumeSlider from './VolumeSlider'
import TrackParamKnobs from './TrackParamKnobs'
import TrackParamSliders from './TrackParamSliders'
import DrumMixPanel from './DrumMixPanel'
import NoteRangePanel from './NoteRangePanel'
import GenreSliders from './GenreSliders'

const TRACK_CONFIG = {
  drums: { label: 'Drums', icon: '🥁', color: '#f43f5e' },
  bass:  { label: 'Bass',  icon: '🎸', color: '#3b82f6' },
  synth: { label: 'Synth', icon: '🎹', color: '#a855f7' },
}

const TrackCard = ({ track, onMutateTrack, onNextPattern }) => {
  const config = TRACK_CONFIG[track] || { label: track, icon: '🎵', color: '#8b5cf6' }
  const trackState = useStore(s => s.tracks[track]) || { channel: 1, muted: false, solo: false, volume: 100 }
  const trackParams = useStore(s => s.trackParams[track]) || {}
  const mood = useStore(s => s.mood)
  const genres = useStore(s => s.genres)
  const trackGenreOverrides = useStore(s => s.trackGenreOverrides)
  const setTrackParam = useStore(s => s.setTrackParam)
  const resetTrackParam = useStore(s => s.resetTrackParam)
  const toggleMute = useStore(s => s.toggleMute)
  const toggleSolo = useStore(s => s.toggleSolo)
  const setTrackVolume = useStore(s => s.setTrackVolume)
  const setTrackChannel = useStore(s => s.setTrackChannel)
  const setTrackSync = useStore(s => s.setTrackSync)
  const setTrackGenreOverride = useStore(s => s.setTrackGenreOverride)

  const isSynced = trackGenreOverrides[track] === null
  const overrideValues = trackGenreOverrides[track]

  const handleParamChange = (param, value) => {
    setTrackParam(track, param, value)
  }

  const handleParamReset = (param) => {
    resetTrackParam(track, param)
  }

  return (
    <motion.div
      key={`track-card-${track}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="space-y-4"
    >
      {/* Card: Track Controls (Mute/Solo/Volume/Channel/Mutate/Next) */}
      <div
        className="rounded-2xl p-4 backdrop-blur-sm space-y-3"
        style={{
          background: `${config.color}08`,
          border: `1px solid ${config.color}20`,
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            <span className="text-sm font-semibold" style={{ color: config.color }}>
              {config.label}
            </span>
            {/* Channel select */}
            <div className="relative">
              <select
                value={trackState.channel}
                onChange={(e) => setTrackChannel(track, Number(e.target.value))}
                className="appearance-none bg-black/30 text-[10px] text-zinc-400 rounded-md pl-2 pr-5 py-1 border border-white/10 outline-none focus:border-accent/50 transition-colors cursor-pointer"
              >
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Ch{i + 1}</option>
                ))}
              </select>
              <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mute */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => toggleMute(track)}
              className={`w-7 h-7 rounded-md text-[10px] font-bold transition-all flex items-center justify-center ${
                trackState.muted
                  ? 'text-white bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                  : 'bg-black/30 text-zinc-500 hover:text-white border border-white/5'
              }`}
            >M</motion.button>

            {/* Solo */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => toggleSolo(track)}
              className={`w-7 h-7 rounded-md text-[10px] font-bold transition-all flex items-center justify-center ${
                trackState.solo
                  ? 'text-white bg-amber-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]'
                  : 'bg-black/30 text-zinc-500 hover:text-white border border-white/5'
              }`}
            >S</motion.button>

            {/* 🎲 Mutate */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => onMutateTrack?.(track)}
              className="w-7 h-7 rounded-md bg-black/30 text-zinc-500 hover:text-white flex items-center justify-center border border-white/5 transition-colors"
              title={`Mutate ${config.label}`}
            >🎲</motion.button>

            {/* 🔄 Next Pattern */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onNextPattern}
              className="w-7 h-7 rounded-md bg-black/30 text-zinc-500 hover:text-white flex items-center justify-center border border-white/5 transition-colors"
              title="Next pattern (all tracks)"
            >🔄</motion.button>
          </div>
        </div>

        {/* Volume */}
        <VolumeSlider
          value={trackState.volume}
          onChange={(v) => setTrackVolume(track, v)}
          color={config.color}
        />
      </div>

      {/* Card: Genre Sync */}
      <div
        className="rounded-2xl p-4 backdrop-blur-sm space-y-3"
        style={{
          background: `${config.color}06`,
          border: `1px solid ${config.color}15`,
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <span>🎭</span> Genre Mix
          </h2>
          {/* Sync Toggle */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setTrackSync(track, !isSynced)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all border
              ${isSynced
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'
              }
            `}
          >
            <span>{isSynced ? '🔗' : '🔓'}</span>
            <span>{isSynced ? 'Synced' : 'Custom'}</span>
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {isSynced ? (
            <motion.div
              key="synced-info"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-zinc-500 italic py-2"
            >
              Following Global Mix — toggle &quot;Custom&quot; to set per-track genre weights
            </motion.div>
          ) : (
            <motion.div
              key="unsynced-sliders"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <GenreSliders
                values={overrideValues || genres}
                onChange={(genre, value) => setTrackGenreOverride(track, genre, value)}
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setTrackSync(track, true)}
                className="w-full py-2 rounded-lg text-xs font-medium text-zinc-400 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                ↺ Reset to Global
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Card: Track Parameters */}
      <div
        className="rounded-2xl p-4 backdrop-blur-sm space-y-3"
        style={{
          background: `${config.color}06`,
          border: `1px solid ${config.color}15`,
        }}
      >
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <span>🎛️</span> Parameters
        </h2>

        {/* Knobs: Density, Complexity, Groove (all tracks) */}
        <TrackParamKnobs
          track={track}
          params={trackParams}
          globalMood={mood}
          onChange={handleParamChange}
          onReset={handleParamReset}
          color={config.color}
        />

        {/* Drum-specific: Drum Mix Panel */}
        {track === 'drums' && (
          <DrumMixPanel
            params={trackParams}
            onChange={handleParamChange}
            color={config.color}
          />
        )}

        {/* Bass & Synth: Extra sliders + Note Range */}
        {(track === 'bass' || track === 'synth') && (
          <>
            <TrackParamSliders
              track={track}
              params={trackParams}
              globalMood={mood}
              onChange={handleParamChange}
              onReset={handleParamReset}
              color={config.color}
            />
            <NoteRangePanel
              track={track}
              params={trackParams}
              onChange={handleParamChange}
              onChordModeChange={track === 'synth' ? (mode) => handleParamChange('chordMode', mode) : undefined}
              color={config.color}
            />
          </>
        )}
      </div>
    </motion.div>
  )
}

export default TrackCard