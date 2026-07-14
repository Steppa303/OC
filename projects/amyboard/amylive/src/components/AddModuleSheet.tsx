// ─── Add Module Bottom Sheet ─────────────────────────────────────────
// Slide-up panel mit Kategorien zum Hinzufügen neuer Module.
// Mobile-optimiert mit Search + Favorites.

import { useState, useMemo } from 'react'
import { X, Search, Music, AudioWaveform, Filter, Activity, Waves, Radio, GitBranch } from 'lucide-react'
import { moduleRegistry } from '../modules'

const CAT_ICONS: Record<string, React.ReactNode> = {
  source: <AudioWaveform size={14} />,
  filter: <Filter size={14} />,
  envelope: <Activity size={14} />,
  modulation: <Waves size={14} />,
  mixer: <GitBranch size={14} />,
}

const CAT_LABELS: Record<string, string> = {
  source: 'Oscillators',
  filter: 'Filters',
  envelope: 'Envelopes',
  modulation: 'LFOs',
  mixer: 'Mixers & Routing',
}

export function AddModuleSheet({
  onSelect,
  onClose,
}: {
  onSelect: (moduleType: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const modules = moduleRegistry.list()

  const filtered = useMemo(() => {
    let list = modules
    if (category) list = list.filter(m => m.category === category)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
    }
    return list
  }, [modules, category, search])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl border border-[var(--color-border)] border-b-0 shadow-2xl max-h-[70vh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full bg-[var(--color-text-muted)]/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-sm font-semibold">Add Module</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules…"
              className="w-full text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg pl-8 pr-3 py-2 outline-none focus:border-[var(--color-primary)]"
              autoFocus
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setCategory(null)}
            className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              !category ? 'bg-[var(--color-primary-dim)] text-white' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Music size={11} />
            All
          </button>
          {Object.entries(CAT_LABELS).map(([cat, label]) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? null : cat)}
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                category === cat ? 'bg-[var(--color-primary-dim)] text-white' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {CAT_ICONS[cat]}
              {label}
            </button>
          ))}
        </div>

        {/* Module List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">No modules found</p>
            ) : (
              filtered.map(mod => {
                const Icon = moduleRegistry.getIcon(mod.id)
                return (
                  <button
                    key={mod.id}
                    onClick={() => onSelect(mod.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors text-left hover:bg-[var(--color-surface-hover)]"
                  >
                    <Icon size={16} className="text-[var(--color-primary)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-[var(--color-text)]">{mod.name}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-2 uppercase">{mod.category}</span>
                    </div>
                    <span className="text-[10px] text-[var(--color-text-dim)]">+</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}