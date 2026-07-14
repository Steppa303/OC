// ─── Patch Selector Sheet ────────────────────────────────────────────
// Bottom Sheet zum Auswählen von Factory Patches (Fallback wenn kein Board).

import { useState } from 'react'
import { X, Search, Music, Keyboard, Drum } from 'lucide-react'
import { ALL_PATCHES, JUNO_PATCHES, DX7_PATCHES, DRUM_PATCHES, PIANO_PATCH, type PatchEntry } from '../lib/amy-patches'
import { factoryPatchFromNumber } from '../engine/patch-from-board'
import type { AmyPatch } from '../types/amy'

const CAT_ICONS: Record<string, typeof Music> = {
  all: Music, juno: Music, dx7: Keyboard, drums: Drum, piano: Music,
}

export function PatchSelectorSheet({
  onSelect,
  onClose,
}: {
  onSelect: (patch: AmyPatch) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const filteredPatches = (() => {
    let list: PatchEntry[]
    switch (category) {
      case 'juno': list = JUNO_PATCHES; break
      case 'dx7': list = DX7_PATCHES; break
      case 'drums': list = DRUM_PATCHES; break
      case 'piano': list = [PIANO_PATCH]; break
      default: list = ALL_PATCHES; break
    }
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(p => p.name.toLowerCase().includes(q) || p.number.toString().includes(q))
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl border border-[var(--color-border)] border-b-0 shadow-2xl max-h-[75vh] flex flex-col animate-slide-up">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full bg-[var(--color-text-muted)]/30" />
        </div>

        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-sm font-semibold">Select Factory Patch</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patches…"
              className="w-full text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg pl-8 pr-3 py-2 outline-none focus:border-[var(--color-primary)]"
              autoFocus
            />
          </div>
        </div>

        <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
          {['all', 'juno', 'dx7', 'drums', 'piano'].map((cat) => {
            const Icon = CAT_ICONS[cat] ?? Music
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                  category === cat ? 'bg-[var(--color-primary-dim)] text-white' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Icon size={11} />
                {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-0.5">
            {filteredPatches.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">No patches found</p>
            ) : (
              filteredPatches.map((p) => (
                <button
                  key={p.number}
                  onClick={() => onSelect(factoryPatchFromNumber(p.number))}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors text-left hover:bg-[var(--color-surface-hover)]"
                >
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)] w-10 shrink-0">#{p.number}</span>
                  <span className="truncate flex-1 text-[var(--color-text)]">{p.name}</span>
                  <span className="text-[9px] uppercase text-[var(--color-text-dim)]">{p.category}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}