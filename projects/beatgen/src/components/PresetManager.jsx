import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import DEFAULT_PRESETS from '../presets/defaults.js'
import PresetStore from '../presets/PresetStore.js'

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } },
}

const PresetManager = () => {
  const showPresets = useStore(s => s.showPresets)
  const togglePresets = useStore(s => s.togglePresets)
  const presets = useStore(s => s.presets)
  const activePreset = useStore(s => s.activePreset)
  const savePreset = useStore(s => s.savePreset)
  const loadPreset = useStore(s => s.loadPreset)
  const deletePreset = useStore(s => s.deletePreset)

  const [showSaveInput, setShowSaveInput] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [importStatus, setImportStatus] = useState(null)
  const [exportStatus, setExportStatus] = useState(null)
  const fileInputRef = useRef(null)

  const allPresets = [...DEFAULT_PRESETS, ...presets]

  const handleSave = useCallback(() => {
    const name = presetName.trim()
    if (!name) return

    // Check for duplicate name
    if (PresetStore.nameExists(name)) {
      setImportStatus({ type: 'error', message: 'A preset with this name already exists' })
      setTimeout(() => setImportStatus(null), 3000)
      return
    }

    // Check max limit
    if (presets.length >= 20) {
      setImportStatus({ type: 'error', message: 'Max 20 presets reached. Delete one first.' })
      setTimeout(() => setImportStatus(null), 3000)
      return
    }

    savePreset(name)
    setPresetName('')
    setShowSaveInput(false)
  }, [presetName, presets.length, savePreset])

  const handleLoad = useCallback((preset) => {
    if (preset.id.startsWith('default-')) {
      useStore.setState({
        genres: { ...preset.genres },
        mood: { ...preset.mood },
        bpm: preset.bpm,
        swingMode: preset.swingMode || 'global',
        swingAmount: preset.swingAmount ?? 50,
        trackSwing: preset.trackSwing ? { ...preset.trackSwing } : { drums: 50, bass: 50, synth: 50 },
        tracks: preset.tracks ? JSON.parse(JSON.stringify(preset.tracks)) : useStore.getState().tracks,
        activePreset: preset.id,
        patternDirty: true,
      })
    } else {
      loadPreset(preset.id)
    }
  }, [loadPreset])

  const handleExport = useCallback(() => {
    const result = PresetStore.exportToFile()
    if (result.success) {
      setExportStatus({ type: 'success', message: `Exported ${result.count} presets` })
    } else {
      setExportStatus({ type: 'error', message: result.error })
    }
    setTimeout(() => setExportStatus(null), 3000)
  }, [])

  const handleImport = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportStatus({ type: 'loading', message: 'Importing...' })
    const result = await PresetStore.importFromFile(file)

    if (result.success) {
      // Reload presets from localStorage into store
      const updated = PresetStore.load()
      useStore.setState({ presets: updated })
      setImportStatus({ type: 'success', message: `Imported ${result.imported} presets` })
    } else {
      setImportStatus({ type: 'error', message: result.errors[0] || 'Import failed' })
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
    setTimeout(() => setImportStatus(null), 4000)
  }, [])

  const getGenreSummary = (genres) => {
    const sorted = Object.entries(genres).sort((a, b) => b[1] - a[1])
    return sorted
      .filter(([, v]) => v > 0)
      .slice(0, 3)
      .map(([k, v]) => `${v}% ${k.charAt(0).toUpperCase() + k.slice(1)}`)
      .join(' · ')
  }

  return (
    <AnimatePresence>
      {showPresets && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={togglePresets}
          />

          {/* Bottom-sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="bg-surface rounded-t-3xl p-6 max-w-lg mx-auto">
              {/* Drag handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span>🔖</span> Presets
                </h2>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSaveInput(!showSaveInput)}
                  className="px-4 py-2.5 rounded-lg bg-accent/20 border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/30 transition-colors"
                >
                  {showSaveInput ? '✕ Cancel' : '+ Save Current'}
                </motion.button>
              </div>

              {/* Import/Export buttons */}
              <div className="flex gap-2 mb-4">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black/20 border border-white/8 text-xs font-medium text-gray-300 hover:bg-black/30 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export JSON
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black/20 border border-white/8 text-xs font-medium text-gray-300 hover:bg-black/30 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Import JSON
                </motion.button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>

              {/* Status messages */}
              <AnimatePresence>
                {(importStatus || exportStatus) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-3"
                  >
                    <div className={`text-xs px-3 py-2 rounded-lg ${
                      (importStatus || exportStatus).type === 'success'
                        ? 'bg-active/10 text-active border border-active/20'
                        : (importStatus || exportStatus).type === 'loading'
                          ? 'bg-accent/10 text-accent border border-accent/20'
                          : 'bg-drums/10 text-drums border border-drums/20'
                    }`}>
                      {(importStatus || exportStatus).message}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Save Input */}
              <AnimatePresence>
                {showSaveInput && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        placeholder="Preset name..."
                        maxLength={50}
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-accent/50 transition-colors"
                        autoFocus
                      />
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSave}
                        className="px-4 py-3 rounded-xl bg-active text-white text-sm font-semibold"
                      >
                        Save
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Preset List */}
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="show"
                className="space-y-2 mb-5"
              >
                {allPresets.map((preset) => {
                  const isActive = activePreset === preset.id
                  const isDefault = preset.id.startsWith('default-')
                  return (
                    <motion.div
                      key={preset.id}
                      variants={itemVariants}
                      layout
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-accent/10 border border-accent/25'
                          : 'bg-black/20 border border-transparent hover:bg-black/30'
                      }`}
                      onClick={() => handleLoad(preset)}
                    >
                      {/* Active indicator */}
                      <div className="flex-shrink-0">
                        {isActive ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-3 h-3 rounded-full bg-active"
                            style={{ boxShadow: '0 0 8px rgba(34,197,94,0.5)' }}
                          />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-white/15" />
                        )}
                      </div>

                      {/* Preset info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{preset.name}</span>
                          {isDefault && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium flex-shrink-0">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5 truncate">
                          {preset.bpm} BPM · {getGenreSummary(preset.genres)}
                        </div>
                      </div>

                      {/* Delete button (user presets only) */}
                      {!isDefault && (
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePreset(preset.id)
                          }}
                          className="w-10 h-10 flex items-center justify-center text-muted hover:text-drums transition-colors rounded-lg hover:bg-drums/10 flex-shrink-0"
                          aria-label="Delete preset"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </motion.button>
                      )}
                    </motion.div>
                  )
                })}

                {allPresets.length === 0 && (
                  <p className="text-sm text-muted text-center py-6">No presets yet</p>
                )}
              </motion.div>

              {/* Close */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={togglePresets}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors border border-white/5"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default PresetManager
