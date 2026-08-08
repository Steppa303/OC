/**
 * PresetStore — localStorage CRUD abstraction for BeatGen presets.
 *
 * Features:
 *   - Load/Save/Delete presets in localStorage
 *   - Export presets as JSON file download
 *   - Import presets from JSON file upload (with validation)
 *   - Dedup logic (no duplicate names)
 *   - Max 20 user presets
 *   - Merge defaults when localStorage is empty
 */

import DEFAULT_PRESETS from './defaults.js'

const STORAGE_KEY = 'beatgen-presets'
const MAX_PRESETS = 20

/**
 * Validate a single preset object shape
 * @param {any} preset
 * @returns {boolean}
 */
function isValidPreset(preset) {
  if (!preset || typeof preset !== 'object') return false
  if (typeof preset.name !== 'string' || preset.name.trim().length === 0) return false

  // Validate genres
  const genreKeys = ['acid', 'house', 'techno', 'trance', 'dnb', 'hiphop']
  if (!preset.genres || typeof preset.genres !== 'object') return false
  for (const key of genreKeys) {
    if (typeof preset.genres[key] !== 'number') return false
  }

  // Validate mood
  const moodKeys = ['darkness', 'energy', 'complexity', 'density', 'groove', 'weirdness']
  if (!preset.mood || typeof preset.mood !== 'object') return false
  for (const key of moodKeys) {
    if (typeof preset.mood[key] !== 'number') return false
  }

  // Validate bpm
  if (typeof preset.bpm !== 'number' || preset.bpm < 60 || preset.bpm > 200) return false

  return true
}

/**
 * Sanitize a preset: clamp values, ensure required fields
 * @param {Object} preset
 * @returns {Object}
 */
function sanitizePreset(preset) {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

  return {
    id: preset.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(preset.name).trim().slice(0, 50),
    timestamp: preset.timestamp || Date.now(),
    genres: {
      acid: clamp(Math.round(preset.genres.acid), 0, 100),
      house: clamp(Math.round(preset.genres.house), 0, 100),
      techno: clamp(Math.round(preset.genres.techno), 0, 100),
      trance: clamp(Math.round(preset.genres.trance), 0, 100),
      dnb: clamp(Math.round(preset.genres.dnb), 0, 100),
      hiphop: clamp(Math.round(preset.genres.hiphop), 0, 100),
    },
    mood: {
      darkness: clamp(Math.round(preset.mood.darkness), 0, 100),
      energy: clamp(Math.round(preset.mood.energy), 0, 100),
      complexity: clamp(Math.round(preset.mood.complexity), 0, 100),
      density: clamp(Math.round(preset.mood.density), 0, 100),
      groove: clamp(Math.round(preset.mood.groove), 0, 100),
      weirdness: clamp(Math.round(preset.mood.weirdness), 0, 100),
    },
    bpm: clamp(Math.round(preset.bpm), 60, 200),
    swingMode: preset.swingMode === 'track' ? 'track' : 'global',
    swingAmount: clamp(Math.round(preset.swingAmount ?? 50), 0, 100),
    trackSwing: {
      drums: clamp(Math.round(preset.trackSwing?.drums ?? 50), 0, 100),
      bass: clamp(Math.round(preset.trackSwing?.bass ?? 50), 0, 100),
      synth: clamp(Math.round(preset.trackSwing?.synth ?? 50), 0, 100),
    },
    tracks: preset.tracks || {
      drums: { channel: 10, muted: false, solo: false, volume: 100 },
      bass:  { channel: 8,  muted: false, solo: false, volume: 100 },
      synth: { channel: 3,  muted: false, solo: false, volume: 100 },
    },
  }
}

const PresetStore = {
  /**
   * Load all user presets from localStorage.
   * Returns empty array if nothing saved or parse fails.
   * @returns {Object[]}
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(isValidPreset).map(sanitizePreset)
    } catch {
      return []
    }
  },

  /**
   * Save all user presets to localStorage.
   * Enforces max limit and dedup by name.
   * @param {Object[]} presets
   * @returns {{ saved: Object[], warnings: string[] }}
   */
  save(presets) {
    const warnings = []

    // Dedup by name (case-insensitive): keep last occurrence
    const seen = new Map()
    for (const p of presets) {
      const key = p.name.toLowerCase().trim()
      if (seen.has(key)) {
        warnings.push(`Duplicate name "${p.name}" — kept latest version`)
      }
      seen.set(key, p)
    }

    let deduped = [...seen.values()]

    // Enforce max limit (keep most recent)
    if (deduped.length > MAX_PRESETS) {
      const removed = deduped.length - MAX_PRESETS
      warnings.push(`Max ${MAX_PRESETS} presets — removed ${removed} oldest`)
      deduped = deduped
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, MAX_PRESETS)
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped))
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        warnings.push('localStorage quota exceeded — try deleting some presets')
      } else {
        warnings.push('Failed to save presets to localStorage')
      }
    }

    return { saved: deduped, warnings }
  },

  /**
   * Export all user presets as a JSON file download.
   * Creates a Blob and triggers download via temporary anchor.
   */
  exportToFile() {
    const presets = this.load()
    if (presets.length === 0) return { success: false, error: 'No presets to export' }

    const data = {
      version: 1,
      app: 'beatgen',
      exportedAt: new Date().toISOString(),
      presets,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `beatgen-presets-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    return { success: true, count: presets.length }
  },

  /**
   * Import presets from a JSON file.
   * Validates, sanitizes, deduplicates against existing presets.
   * @param {File} file - JSON file from file input
   * @returns {Promise<{ success: boolean, imported: number, errors: string[] }>}
   */
  async importFromFile(file) {
    const errors = []

    if (!file || !file.name.endsWith('.json')) {
      return { success: false, imported: 0, errors: ['Please select a .json file'] }
    }

    let text
    try {
      text = await file.text()
    } catch {
      return { success: false, imported: 0, errors: ['Could not read file'] }
    }

    let data
    try {
      data = JSON.parse(text)
    } catch {
      return { success: false, imported: 0, errors: ['Invalid JSON format'] }
    }

    // Accept both wrapped format { presets: [...] } and raw array
    const rawPresets = Array.isArray(data) ? data : data.presets
    if (!Array.isArray(rawPresets)) {
      return { success: false, imported: 0, errors: ['No presets found in file'] }
    }

    // Validate and sanitize each preset
    const validPresets = []
    for (let i = 0; i < rawPresets.length; i++) {
      if (isValidPreset(rawPresets[i])) {
        validPresets.push(sanitizePreset({
          ...rawPresets[i],
          id: Date.now().toString(36) + i + Math.random().toString(36).slice(2, 4),
          timestamp: Date.now(),
        }))
      } else {
        errors.push(`Preset #${i + 1}: invalid format, skipped`)
      }
    }

    if (validPresets.length === 0) {
      return { success: false, imported: 0, errors: [...errors, 'No valid presets found'] }
    }

    // Merge with existing (dedup by name)
    const existing = this.load()
    const existingNames = new Set(existing.map(p => p.name.toLowerCase().trim()))
    const newPresets = validPresets.filter(p => !existingNames.has(p.name.toLowerCase().trim()))

    if (newPresets.length === 0) {
      return { success: false, imported: 0, errors: [...errors, 'All imported presets already exist'] }
    }

    const merged = [...existing, ...newPresets]
    const result = this.save(merged)

    return {
      success: true,
      imported: newPresets.length,
      errors: [...errors, ...result.warnings],
    }
  },

  /**
   * Get the count of user presets
   * @returns {number}
   */
  count() {
    return this.load().length
  },

  /**
   * Check if a preset name already exists (case-insensitive)
   * @param {string} name
   * @returns {boolean}
   */
  nameExists(name) {
    const presets = this.load()
    return presets.some(p => p.name.toLowerCase().trim() === name.toLowerCase().trim())
  },
}

export default PresetStore
