import { Search, Star, Download, Upload, Trash2, Music } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePatchStore } from '../stores/patch-store'
import type { AmyPatch } from '../types/amy'

const CATEGORIES = ['all', 'juno', 'dx7', 'fm', 'pcm', 'user'] as const

export function Patches() {
  const { patches, selectedId, selectPatch, deletePatch, loadFromStorage } = usePatchStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')

  useEffect(() => {
    loadFromStorage()
  }, [])

  const filtered = patches.filter(p => {
    if (category !== 'all' && p.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q))
    }
    return true
  })

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Patch Library</h1>
          <p className="text-xs text-[var(--color-text-muted)]">{patches.length} Patches</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 py-2 px-3 rounded-lg bg-[var(--color-primary-dim)] hover:bg-[var(--color-primary)] text-white text-xs font-medium transition-colors">
            <Upload size={14} /> Import
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patches..."
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-active)]"
          />
        </div>
        <div className="flex gap-1">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                category === c
                  ? 'bg-[var(--color-primary-dim)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
              }`}
            >
              {c === 'all' ? 'All' : c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Patch List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Music size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
          <p className="text-sm text-[var(--color-text-dim)]">Keine Patches gefunden</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            Erstelle einen Patch im Dashboard oder importiere einen
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(patch => (
            <div
              key={patch.id}
              onClick={() => selectPatch(patch.id)}
              className={`bg-[var(--color-surface)] rounded-xl border p-4 cursor-pointer transition-all hover:border-[var(--color-border-active)]/50 ${
                selectedId === patch.id ? 'border-[var(--color-border-active)] module-selected' : 'border-[var(--color-border)]'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-medium">{patch.name}</h3>
                  {patch.author && (
                    <p className="text-[10px] text-[var(--color-text-muted)]">{patch.author}</p>
                  )}
                </div>
                <Star
                  size={14}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-warning)] cursor-pointer"
                />
              </div>

              <div className="flex gap-1 mb-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text-dim)] font-mono">
                  {patch.category}
                </span>
                {patch.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                <span>{patch.state.oscillators.length} osc</span>
                <span>·</span>
                <span>{patch.state.synths.length} synth</span>
                <span>·</span>
                <span>{patch.wireCommands.length} cmds</span>
              </div>

              <div className="flex gap-1 mt-2 pt-2 border-t border-[var(--color-border)]">
                <button className="flex-1 py-1.5 rounded-lg bg-[var(--color-primary-dim)]/10 hover:bg-[var(--color-primary-dim)]/20 text-[10px] text-[var(--color-primary)] font-medium transition-colors">
                  Load
                </button>
                <button className="flex-1 py-1.5 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface)] text-[10px] text-[var(--color-text-dim)] transition-colors">
                  <Download size={12} className="inline" /> Export
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePatch(patch.id) }}
                  className="py-1.5 px-2 rounded-lg bg-[var(--color-surface-hover)] hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}