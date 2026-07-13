import { useCallback } from 'react'
import { GitBranch, Plus } from 'lucide-react'
import { CardHeader } from '@/components/touch/CardHeader'
import { ChainMap } from '@/components/chain/ChainMap'
import { useChainStore } from '@/stores/chain-store'
import { useCanvasStore } from '@/stores/canvas-store'
import type { CardProps } from '@/types/amy'

/**
 * Chain View Card — dedicated card showing the full signal chain.
 * No params, no wire sending — purely visual navigation.
 * Click on any module navigates to that card.
 */
export function ChainViewCard({ id, params, onParamChange, onSendWire, cardIndex, totalCards, chainInfo }: CardProps) {
  const { links } = useChainStore()
  const { modules } = useCanvasStore()

  // Map canvas modules to chain format with proper types
  const chainModules = modules.map((m) => {
    let type = 'processor'
    switch (m.moduleType) {
      case 'oscillator':
        type = 'source'
        break
      case 'filter':
        type = 'processor'
        break
      case 'envelope':
        type = 'modulator'
        break
      case 'lfo':
        type = 'modulator'
        break
      case 'synth':
        type = 'controller'
        break
      default:
        type = 'processor'
    }
    let name = m.moduleType.charAt(0).toUpperCase() + m.moduleType.slice(1)
    if (m.params.osc !== undefined) name += ` ${m.params.osc}`
    else if (m.params.egId !== undefined) name += ` ${m.params.egId}`
    else if (m.params.lfoId !== undefined) name += ` ${m.params.lfoId}`

    return { id: m.id, name, type }
  })

  const handleModuleClick = useCallback(
    (moduleId: string) => {
      // Navigate to the clicked module's card via chainInfo
      chainInfo?.onNavigateToModule?.(moduleId)
    },
    [chainInfo],
  )

  const handleAddModule = useCallback(() => {
    const synthModule = modules.find((m) => m.moduleType === 'synth')
    if (!synthModule) {
      // Default: add an oscillator
      useCanvasStore.getState().addModule('oscillator', 0, 0, 280, 200, { osc: modules.length, wave: 0, freq: 440, amp: 0.8, pan: 0.5, bus: 0 }, undefined, undefined, undefined, modules.length)
      return
    }
    // Add a filter chained to the last osc
    useCanvasStore.getState().addModule('filter', 0, 0, 280, 200, { osc: synthModule.params.synth ?? 0, filter_type: 1, cutoff: 8000, resonance: 0.7 }, undefined, undefined, undefined, modules.length)
  }, [modules])

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <CardHeader
        title="Signal Chain"
        icon={<GitBranch size={16} />}
      />

      <div className="flex-1 overflow-y-auto p-3">
        <ChainMap
          modules={chainModules}
          links={links}
          onModuleClick={handleModuleClick}
        />
      </div>

      {/* Add Module Button */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <button
          onClick={handleAddModule}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-[var(--color-primary-dim)] hover:bg-[var(--color-primary)] text-white text-xs font-medium transition-colors cursor-pointer"
        >
          <Plus size={14} />
          Add Module
        </button>
      </div>
    </div>
  )
}