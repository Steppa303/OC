import { useState, useRef, useEffect } from 'react'
import type { SignalChainLink } from '@/types/amy'

interface ChainModule {
  id: string
  name: string
  type: string
}

interface ChainMiniMapProps {
  currentModuleId: string
  modules: ChainModule[]
  links: SignalChainLink[]
  onNavigateToModule?: (id: string) => void
}

const TYPE_COLORS: Record<string, string> = {
  source: '#22c55e',
  processor: '#818cf8',
  modulator: '#f472b6',
  output: '#eab308',
  controller: '#64748b',
}

/**
 * Mini horizontal chain bar shown on each card header.
 * ~40px height, compact. Shows max 5-6 modules, truncated if more.
 * Current module highlighted, tappable to navigate.
 */
export function ChainMiniMap({
  currentModuleId,
  modules,
  links,
  onNavigateToModule,
}: ChainMiniMapProps) {
  const [startIdx, setStartIdx] = useState(0)
  const MAX_VISIBLE = 6

  // Scroll to keep current module visible
  useEffect(() => {
    const idx = modules.findIndex((m) => m.id === currentModuleId)
    if (idx >= 0 && (idx < startIdx || idx >= startIdx + MAX_VISIBLE)) {
      setStartIdx(Math.max(0, Math.min(idx - 2, modules.length - MAX_VISIBLE)))
    }
  }, [currentModuleId, modules, startIdx])

  // Get unique module IDs that are connected to current module
  const connectedIds = new Set<string>()
  for (const link of links) {
    if (link.from.moduleId === currentModuleId) connectedIds.add(link.to.moduleId)
    if (link.to.moduleId === currentModuleId) connectedIds.add(link.from.moduleId)
  }

  const visibleModules = modules.slice(startIdx, startIdx + MAX_VISIBLE)

  if (modules.length <= 1) return null

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto scrollbar-none border-t border-[var(--color-border)]">
      {/* Scroll left */}
      {startIdx > 0 && (
        <button
          onClick={() => setStartIdx(Math.max(0, startIdx - 1))}
          className="shrink-0 w-4 h-4 flex items-center justify-center text-[8px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
        >
          ‹
        </button>
      )}

      {visibleModules.map((m, i) => {
        const isCurrent = m.id === currentModuleId
        const color = TYPE_COLORS[m.type] ?? '#64748b'
        const isConnected = connectedIds.has(m.id)

        return (
          <div key={m.id} className="flex items-center gap-0">
            <button
              onClick={() => onNavigateToModule?.(m.id)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                isCurrent
                  ? 'text-[var(--color-text)] ring-1 ring-[var(--color-primary)]'
                  : isConnected
                    ? 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
                    : 'text-[var(--color-text-muted)] opacity-60 hover:opacity-100'
              }`}
              style={{
                backgroundColor: isCurrent ? `${color}18` : 'transparent',
              }}
            >
              <span
                className="w-1 h-1 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              {m.name.length > 8 ? m.name.slice(0, 7) + '…' : m.name}
            </button>

            {/* Arrow to next */}
            {i < visibleModules.length - 1 && (
              <span className="text-[8px] text-[var(--color-text-muted)] mx-0.5">→</span>
            )}
          </div>
        )
      })}

      {/* Scroll right */}
      {startIdx + MAX_VISIBLE < modules.length && (
        <button
          onClick={() => setStartIdx(Math.min(modules.length - MAX_VISIBLE, startIdx + 1))}
          className="shrink-0 w-4 h-4 flex items-center justify-center text-[8px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
        >
          ›
        </button>
      )}

      {/* Count if truncated */}
      {modules.length > MAX_VISIBLE && (
        <span className="text-[8px] text-[var(--color-text-muted)] ml-1">
          {modules.length}
        </span>
      )}
    </div>
  )
}