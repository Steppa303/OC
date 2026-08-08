import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import Header from './components/Header'
import MoodKnobs from './components/MoodKnobs'
import SwingControl from './components/SwingControl'
import TrackTabs from './components/TrackTabs'
import GlobalCard from './components/GlobalCard'
import TrackCard from './components/TrackCard'
import TransportBar from './components/TransportBar'
import SettingsPanel from './components/SettingsPanel'
import PresetManager from './components/PresetManager'
import useStore from './store/useStore'
import PatternEngine from './engine/PatternEngine'
import MidiScheduler from './midi/MidiScheduler'
import midiEngine from './midi/MidiEngine'
import MidiClockParser from './midi/MidiClockParser'

// Singleton instances
const patternEngine = new PatternEngine()

// Fallback pattern: simple 4-on-the-floor
function generateFallbackPattern() {
  return {
    drums: {
      steps: Array.from({ length: 16 }, (_, i) => ({
        active: i % 4 === 0,
        note: i % 4 === 0 ? 36 : 0,
        velocity: i % 4 === 0 ? 100 : 0,
        timing: 0,
      })),
    },
    bass: {
      steps: Array.from({ length: 16 }, (_, i) => ({
        active: i % 8 === 0,
        note: i % 8 === 0 ? 36 : 0,
        velocity: i % 8 === 0 ? 90 : 0,
        timing: 0,
      })),
    },
    synth: {
      steps: Array.from({ length: 16 }, () => ({
        active: false, note: 0, velocity: 0, timing: 0,
      })),
    },
  }
}

// Section stagger animation variants
const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  show: (delay) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay,
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  }),
}

/**
 * Resolve per-track genre weights: override if unsynced, otherwise fallback to global
 */
function resolveTrackGenres(state) {
  const { genres, trackGenreOverrides } = state
  return {
    drums: trackGenreOverrides.drums ?? genres,
    bass: trackGenreOverrides.bass ?? genres,
    synth: trackGenreOverrides.synth ?? genres,
  }
}

const App = () => {
  const schedulerRef = useRef(null)
  const debounceRef = useRef(null)

  // Selective store subscriptions
  const isPlaying = useStore(s => s.isPlaying)
  const bpm = useStore(s => s.bpm)
  const genres = useStore(s => s.genres)
  const mood = useStore(s => s.mood)
  const swingMode = useStore(s => s.swingMode)
  const swingAmount = useStore(s => s.swingAmount)
  const trackSwing = useStore(s => s.trackSwing)
  const tracks = useStore(s => s.tracks)
  const patternDirty = useStore(s => s.patternDirty)
  const trackGenreOverrides = useStore(s => s.trackGenreOverrides)
  const mutationCount = useStore(s => s.mutationCount)
  const patternNonce = useStore(s => s.patternNonce)
  const trackParams = useStore(s => s.trackParams)
  const activeTab = useStore(s => s.activeTab)
  const setCurrentStep = useStore(s => s.setCurrentStep)
  const setActiveTab = useStore(s => s.setActiveTab)

  /**
   * Generate a pattern from current store state (with error fallback)
   */
  const generatePattern = useCallback(() => {
    try {
      const state = useStore.getState()
      const resolvedGenres = resolveTrackGenres(state)
      const swingConfig = {
        mode: swingMode,
        amount: swingAmount,
        trackSwing,
      }
      return patternEngine.generate(genres, mood, swingConfig, bpm, resolvedGenres, mutationCount, patternNonce, trackParams)
    } catch (e) {
      console.warn('PatternEngine error, using fallback:', e)
      return generateFallbackPattern()
    }
  }, [genres, mood, swingMode, swingAmount, trackSwing, bpm, mutationCount, patternNonce, trackParams])

  /**
   * Initialize scheduler (once)
   */
  useEffect(() => {
    const scheduler = new MidiScheduler(midiEngine)

    scheduler.onStep = (stepIdx) => {
      setCurrentStep(stepIdx)
    }

    scheduler.onBarEnd = () => {}

    scheduler.onPatternRequest = () => {
      const state = useStore.getState()
      if (state.patternDirty) {
        try {
          const resolvedGenres = resolveTrackGenres(state)
          const swingConfig = {
            mode: state.swingMode,
            amount: state.swingAmount,
            trackSwing: state.trackSwing,
          }
          return patternEngine.generate(
            state.genres,
            state.mood,
            swingConfig,
            state.bpm,
            resolvedGenres,
            state.mutationCount,
            state.patternNonce,
            state.trackParams
          )
        } catch (e) {
          console.warn('Pattern regeneration error:', e)
          return generateFallbackPattern()
        }
      }
      return null
    }

    schedulerRef.current = scheduler

    return () => {
      scheduler.destroy()
      schedulerRef.current = null
    }
  }, [setCurrentStep])

  /**
   * MIDI Init on mount + Clock Parser wiring
   */
  useEffect(() => {
    const clockParser = new MidiClockParser()

    const initMidi = async () => {
      const result = await midiEngine.init()
      if (result.success) {
        useStore.getState().setMidiAccess(midiEngine.access)
        useStore.getState().setMidiDevices(result.devices)
        useStore.getState().setMidiInputDevices(midiEngine.inputDevices)
        midiEngine.onDevicesChange = (devices) => {
          useStore.getState().setMidiDevices(devices)
        }
      } else {
        useStore.getState().setMidiInitFailed(true)
      }
    }
    initMidi()

    midiEngine.onClockMessage = (statusByte) => {
      clockParser.handleMessage(statusByte)
    }

    clockParser.onBpmChange = (newBpm) => {
      useStore.getState().setExternalBpm(newBpm)
    }

    clockParser.onStart = () => {
      useStore.getState().setIsExternalRunning(true)
      useStore.getState().setExternalTransportActive(true)
      const state = useStore.getState()
      const scheduler = schedulerRef.current
      if (!scheduler) return

      const resolvedGenres = resolveTrackGenres(state)
      const swingConfig = {
        mode: state.swingMode,
        amount: state.swingAmount,
        trackSwing: state.trackSwing,
      }
      let pattern;
      try {
        pattern = patternEngine.generate(
          state.genres, state.mood, swingConfig, state.bpm,
          resolvedGenres, state.mutationCount, state.patternNonce, state.trackParams
        )
      } catch (e) {
        console.warn('External clock pattern error (onStart):', e)
        pattern = generateFallbackPattern()
      }

      if (state.clockSource === 'midi') {
        scheduler.start(pattern, state.bpm, state.tracks, 'midi')
        scheduler.startExternal(pattern, state.tracks)
      } else {
        scheduler.start(pattern, state.bpm, state.tracks, 'internal')
        useStore.getState().play()
      }
    }

    clockParser.onStop = () => {
      useStore.getState().setIsExternalRunning(false)
      useStore.getState().setExternalTransportActive(false)
      schedulerRef.current?.stop()
      useStore.getState().stop()
    }

    clockParser.onContinue = () => {
      useStore.getState().setIsExternalRunning(true)
      useStore.getState().setExternalTransportActive(true)
      const state = useStore.getState()
      const scheduler = schedulerRef.current
      if (!scheduler) return

      const resolvedGenres = resolveTrackGenres(state)
      const swingConfig = {
        mode: state.swingMode,
        amount: state.swingAmount,
        trackSwing: state.trackSwing,
      }
      let pattern;
      try {
        pattern = patternEngine.generate(
          state.genres, state.mood, swingConfig, state.bpm,
          resolvedGenres, state.mutationCount, state.patternNonce, state.trackParams
        )
      } catch (e) {
        console.warn('External clock pattern error (onContinue):', e)
        pattern = generateFallbackPattern()
      }

      if (state.clockSource === 'midi') {
        scheduler.start(pattern, state.bpm, state.tracks, 'midi')
        scheduler.startExternal(pattern, state.tracks)
      } else {
        scheduler.start(pattern, state.bpm, state.tracks, 'internal')
        useStore.getState().play()
      }
    }

    clockParser.onClock = () => {
      const state = useStore.getState()
      if (state.clockSource === 'midi') {
        schedulerRef.current?._onExternalStep()
      }
    }

    return () => {
      midiEngine.onClockMessage = null
      midiEngine.onDevicesChange = null
      clockParser.destroy()
    }
  }, [])

  /**
   * Handle Play/Stop (internal mode only)
   */
  useEffect(() => {
    const scheduler = schedulerRef.current
    if (!scheduler) return

    const clockSource = useStore.getState().clockSource
    if (clockSource === 'midi') return

    if (isPlaying) {
      const pattern = generatePattern()
      scheduler.start(pattern, bpm, tracks)
    } else {
      scheduler.stop()
    }
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handle BPM changes (live update, no restart)
   */
  useEffect(() => {
    const scheduler = schedulerRef.current
    if (!scheduler?.isPlaying) return
    scheduler.updateBpm(bpm)
  }, [bpm])

  /**
   * Forward patternDirty to scheduler
   */
  useEffect(() => {
    const scheduler = schedulerRef.current
    if (!scheduler) return
    if (patternDirty) {
      scheduler.markDirty()
    }
  }, [patternDirty])

  /**
   * Real-time pattern update on parameter change
   */
  useEffect(() => {
    const scheduler = schedulerRef.current
    if (!scheduler?.isPlaying) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const currentState = useStore.getState()
      if (!schedulerRef.current?.isPlaying) return

      try {
        const resolvedGenres = resolveTrackGenres(currentState)
        const swingConfig = {
          mode: currentState.swingMode,
          amount: currentState.swingAmount,
          trackSwing: currentState.trackSwing,
        }
        const pattern = patternEngine.generate(
          currentState.genres,
          currentState.mood,
          swingConfig,
          currentState.bpm,
          resolvedGenres,
          currentState.mutationCount,
          currentState.patternNonce,
          currentState.trackParams
        )
        schedulerRef.current.loadPatternLive(pattern, currentState.tracks)
      } catch (e) {
        console.warn('Live pattern update error:', e)
      }
    }, 50)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [genres, mood, swingMode, swingAmount, trackSwing, tracks, trackGenreOverrides, mutationCount, patternNonce, trackParams])

  /**
   * Mutate a single track
   */
  const handleMutateTrack = useCallback((track) => {
    useStore.getState().mutateTrack(track)

    if (schedulerRef.current?.isPlaying) {
      const state = useStore.getState()
      const resolvedGenres = resolveTrackGenres(state)
      const swingConfig = {
        mode: state.swingMode,
        amount: state.swingAmount,
        trackSwing: state.trackSwing,
      }
      try {
        const pattern = patternEngine.generate(
          state.genres, state.mood, swingConfig, state.bpm,
          resolvedGenres, state.mutationCount, state.patternNonce, state.trackParams
        )
        schedulerRef.current.loadPatternLive(pattern, state.tracks)
      } catch (e) {
        console.warn('Mutate track error:', e)
      }
    }
  }, [])

  /**
   * Next Pattern
   */
  const handleNextPattern = useCallback(() => {
    useStore.getState().nextPattern()

    if (schedulerRef.current?.isPlaying) {
      const state = useStore.getState()
      const resolvedGenres = resolveTrackGenres(state)
      const swingConfig = {
        mode: state.swingMode,
        amount: state.swingAmount,
        trackSwing: state.trackSwing,
      }
      try {
        const pattern = patternEngine.generate(
          state.genres, state.mood, swingConfig, state.bpm,
          resolvedGenres, state.mutationCount, state.patternNonce, state.trackParams
        )
        schedulerRef.current.loadPatternLive(pattern, state.tracks)
      } catch (e) {
        console.warn('Next pattern error:', e)
      }
    }
  }, [])

  const renderActiveCard = () => {
    switch (activeTab) {
      case 'global':
        return <GlobalCard />
      case 'drums':
      case 'bass':
      case 'synth':
        return (
          <TrackCard
            track={activeTab}
            onMutateTrack={handleMutateTrack}
            onNextPattern={handleNextPattern}
          />
        )
      default:
        return <GlobalCard />
    }
  }

  return (
    <div className="min-h-screen bg-bg-deep text-text pb-24 safe-top">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-drums/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-bass/3 rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-2xl mx-auto space-y-2 pb-4 px-3">
        {/* Header */}
        <Header />

        {/* Track Tabs */}
        <TrackTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tracks={tracks}
          trackGenreOverrides={trackGenreOverrides}
        />

        {/* Active Card (switches per tab) */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {renderActiveCard()}
        </motion.div>
      </div>

      {/* Fixed Transport Bar */}
      <TransportBar />

      {/* Overlays */}
      <SettingsPanel />
      <PresetManager />
    </div>
  )
}

export default App