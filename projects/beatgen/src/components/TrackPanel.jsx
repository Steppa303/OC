import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import VolumeSlider from './VolumeSlider'
import TrackParamKnobs from './TrackParamKnobs'
import TrackParamSliders from './TrackParamSliders'
import DrumMixPanel from './DrumMixPanel'
import NoteRangePanel from './NoteRangePanel'

const TRACK_CONFIG = {
  drums: { label: 'Drums', icon: '🥁', color: '#ef4444' },
  bass:  { label: 'Bass',  icon: '🎸', color: '#3b82f6' },
  synth: { label: 'Synth', icon: '🎹', color: '#a855f7' },
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

const trackVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
}

const TrackPanel = ({ onMutateTrack, onNextPattern }) => {
  const tracks = useStore(s => s.tracks)
  const currentStep = useStore(s => s.currentStep)
  const isPlaying = useStore(s => s.isPlaying)
  const trackParams = useStore(s => s.trackParams)
  const setTrackParam = useStore(s => s.setTrackParam)
  const resetTrackParam = useStore(s => s.resetTrackParam)
  const mood = useStore(s => s.mood)
  const toggleMute = useStore(s => s.toggleMute)
  const toggleSolo = useStore(s => s.toggleSolo)
  const setTrackVolume = useStore(s => s.setTrackVolume)
  const setTrackChannel = useStore(s => s.setTrackChannel)

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="glass rounded-2xl p-4 space-y-3"
    >
      <motion.h2
        variants={trackVariants}
        className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2"
      >
        <span>🎚️</span> Tracks
      </motion.h2>

      {Object.entries(TRACK_CONFIG).map(([trackKey, config]) => (
        <TrackItem
          key={trackKey}
          trackKey={trackKey}
          config={config}
          track={tracks[trackKey]}
          currentStep={currentStep}
          isPlaying={isPlaying}
          trackParams={trackParams[trackKey] || {}}
          setTrackParam={setTrackParam}
          resetTrackParam={resetTrackParam}
          mood={mood}
          toggleMute={toggleMute}
          toggleSolo={toggleSolo}
          setTrackVolume={setTrackVolume}
          setTrackChannel={setTrackChannel}
          onMutateTrack={onMutateTrack}
          onNextPattern={onNextPattern}
        />
      ))}
    </motion.section>
  )
}

const TrackItem = ({
  trackKey,
  config,
  track,
  currentStep,
  isPlaying,
  trackParams,
  setTrackParam,
  resetTrackParam,
  mood,
  toggleMute,
  toggleSolo,
  setTrackVolume,
  setTrackChannel,
  onMutateTrack,
  onNextPattern,
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const isMuted = track.muted
  const isSolo = track.solo

  const handleParamChange = (param, value) => {
    setTrackParam(trackKey, param, value)
  }

  const handleParamReset = (param) => {
    resetTrackParam(trackKey, param)
  }

  return (
    <motion.div
      variants={trackVariants}
      layout
      className="rounded-xl overflow-hidden"
      style={{
        background: `${config.color}08`,
        border: `1px solid ${config.color}15`,
      }}
    >
      {/* Track header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{config.icon}</span>
          <span className="text-sm font-semibold" style={{ color: config.color }}>
            {config.label}
          </span>

          {/* Styled channel select */}
          <div className="relative">
            <select
              value={track.channel}
              onChange={(e) => setTrackChannel(trackKey, Number(e.target.value))}
              className="appearance-none bg-black/30 text-[10px] text-muted rounded-md pl-2 pr-5 py-1 border border-white/10 outline-none focus:border-accent/50 transition-colors cursor-pointer"
            >
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Ch{i + 1}</option>
              ))}
            </select>
            <svg
              className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
              width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mute button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => toggleMute(trackKey)}
            className={`w-8 h-8 rounded-md text-[10px] font-bold transition-all flex items-center justify-center ${
              isMuted
                ? 'text-white'
                : 'bg-black/30 text-muted hover:text-white border border-white/5'
            }`}
            style={isMuted ? {
              background: '#ef4444',
              boxShadow: '0 0 10px rgba(239,68,68,0.4)',
            } : {}}
            aria-label={`Mute ${config.label}`}
          >
            M
          </motion.button>

          {/* Solo button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => toggleSolo(trackKey)}
            className={`w-8 h-8 rounded-md text-[10px] font-bold transition-all flex items-center justify-center ${
              isSolo
                ? 'text-white'
                : 'bg-black/30 text-muted hover:text-white border border-white/5'
            }`}
            style={isSolo ? {
              background: '#eab308',
              boxShadow: '0 0 10px rgba(234,179,8,0.4)',
            } : {}}
            aria-label={`Solo ${config.label}`}
          >
            S
          </motion.button>

          {/* Mutate Button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => onMutateTrack?.(trackKey)}
            className="w-8 h-8 rounded-md bg-black/30 text-muted hover:text-white flex items-center justify-center border border-white/5 transition-colors hover:border-current"
            aria-label={`Mutate ${config.label} pattern`}
          >
            <span className="text-sm">🎲</span>
          </motion.button>

          {/* Next Pattern Button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onNextPattern}
            className="w-8 h-8 rounded-md bg-black/30 text-muted hover:text-white flex items-center justify-center border border-white/5 transition-colors hover:border-current"
            aria-label="Next pattern (all tracks)"
          >
            <span className="text-sm">🔄</span>
          </motion.button>

          {/* Collapse toggle */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 rounded-md bg-black/30 text-muted hover:text-white flex items-center justify-center border border-white/5 transition-colors"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            <motion.svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              animate={{ rotate: collapsed ? -90 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </motion.svg>
          </motion.button>
        </div>
      </div>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 max-h-[400px] overflow-y-auto">
              {/* Volume */}
              <VolumeSlider
                value={track.volume}
                onChange={(v) => setTrackVolume(trackKey, v)}
                color={config.color}
              />

              {/* Per-track knobs */}
              <TrackParamKnobs
                track={trackKey}
                params={trackParams}
                globalMood={mood}
                onChange={handleParamChange}
                onReset={handleParamReset}
                color={config.color}
              />

              {/* Track-specific panels */}
              {trackKey === 'drums' && (
                <DrumMixPanel
                  params={trackParams}
                  onChange={handleParamChange}
                  color={config.color}
                />
              )}

              {trackKey === 'bass' && (
                <>
                  <TrackParamSliders
                    track={trackKey}
                    params={trackParams}
                    globalMood={mood}
                    onChange={handleParamChange}
                    onReset={handleParamReset}
                    color={config.color}
                  />
                  <NoteRangePanel
                    track={trackKey}
                    params={trackParams}
                    onChange={handleParamChange}
                    color={config.color}
                  />
                </>
              )}

              {trackKey === 'synth' && (
                <>
                  <TrackParamSliders
                    track={trackKey}
                    params={trackParams}
                    globalMood={mood}
                    onChange={handleParamChange}
                    onReset={handleParamReset}
                    color={config.color}
                  />
                  <NoteRangePanel
                    track={trackKey}
                    params={trackParams}
                    onChange={handleParamChange}
                    onChordModeChange={(mode) => handleParamChange('chordMode', mode)}
                    color={config.color}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default TrackPanel
