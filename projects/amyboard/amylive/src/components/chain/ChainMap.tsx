import { useRef, useEffect, useState, useCallback } from 'react'
import { ChainNode } from './ChainNode'
import { ChainLink } from './ChainLink'
import type { SignalChainLink } from '@/types/amy'

interface ChainModule {
  id: string
  name: string
  type: string
}

interface ChainMapProps {
  modules: ChainModule[]
  links: SignalChainLink[]
  activeModuleId?: string | null
  onModuleClick?: (moduleId: string) => void
  onLinkDrag?: (from: { moduleId: string; output: string }, to: { moduleId: string; input: string }) => void
  className?: string
}

interface NodePosition {
  moduleId: string
  x: number
  y: number
}

/**
 * Full chain overview — renders all modules and their connections as an
 * interactive graph. Auto-layout: sources on left, processors middle,
 * output on right, modulators above/below. Uses SVG overlay for links.
 */
export function ChainMap({
  modules,
  links,
  activeModuleId,
  onModuleClick,
  onLinkDrag,
  className = '',
}: ChainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([])

  // Re-measure node positions whenever modules change
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const positions: NodePosition[] = []
      for (const m of modules) {
        const el = container.querySelector<HTMLElement>(`[data-chain-node-id="${m.id}"]`)
        if (el) {
          const rect = el.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          positions.push({
            moduleId: m.id,
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2,
          })
        }
      }
      setNodePositions(positions)
    }

    // Measure after layout settles
    requestAnimationFrame(measure)
    // Also on resize
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    return () => ro.disconnect()
  }, [modules])

  const getNodeCenter = useCallback(
    (moduleId: string): { x: number; y: number } | null => {
      const pos = nodePositions.find((p) => p.moduleId === moduleId)
      return pos ?? null
    },
    [nodePositions],
  )

  // Layout columns by type
  const columns = (() => {
    const sources: ChainModule[] = []
    const processors: ChainModule[] = []
    const modulators: ChainModule[] = []
    const outputs: ChainModule[] = []
    const controllers: ChainModule[] = []

    for (const m of modules) {
      switch (m.type) {
        case 'source': sources.push(m); break
        case 'processor': processors.push(m); break
        case 'modulator': modulators.push(m); break
        case 'output': outputs.push(m); break
        default: controllers.push(m); break
      }
    }

    return { sources, processors, modulators, outputs, controllers }
  })()

  const renderNode = (m: ChainModule) => (
    <div key={m.id} data-chain-node-id={m.id}>
      <ChainNode
        moduleId={m.id}
        name={m.name}
        type={m.type}
        isActive={activeModuleId === m.id}
        onClick={onModuleClick}
        outputPorts={m.type === 'source' || m.type === 'modulator' ? [{ id: 'audio', label: 'Out' }] : m.type === 'processor' ? [{ id: 'audio', label: 'Out' }] : undefined}
        inputPorts={m.type === 'processor' || m.type === 'output' ? [{ id: 'audio', label: 'In' }] : undefined}
      />
    </div>
  )

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ minHeight: '200px' }}
    >
      {/* SVG overlay for links — behind nodes */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%', zIndex: 0 }}
      >
        {links.map((link) => {
          const fromPos = getNodeCenter(link.from.moduleId)
          const toPos = getNodeCenter(link.to.moduleId)
          if (!fromPos || !toPos) return null

          return (
            <ChainLink
              key={link.id}
              from={{ x: fromPos.x, y: fromPos.y }}
              to={{ x: toPos.x, y: toPos.y }}
              animated
            />
          )
        })}
      </svg>

      {/* Desktop: column layout */}
      <div className="hidden sm:flex gap-4 p-3 relative z-10">
        {/* Left column: sources */}
        {columns.sources.length > 0 && (
          <div className="flex flex-col gap-3 justify-center">
            {columns.sources.map(renderNode)}
          </div>
        )}

        {/* Middle columns: processors + controllers */}
        {(columns.processors.length > 0 || columns.controllers.length > 0) && (
          <div className="flex flex-col gap-3 justify-center">
            {columns.processors.map(renderNode)}
            {columns.controllers.map(renderNode)}
          </div>
        )}

        {/* Right column: outputs */}
        {columns.outputs.length > 0 && (
          <div className="flex flex-col gap-3 justify-center">
            {columns.outputs.map(renderNode)}
          </div>
        )}
      </div>

      {/* Modulators row */}
      {columns.modulators.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-3 justify-center mt-2 p-2 border-t border-[var(--color-border)] relative z-10">
          {columns.modulators.map(renderNode)}
        </div>
      )}

      {/* Mobile simplified: vertical list */}
      <div className="flex sm:hidden flex-col gap-2 p-3 relative z-10">
        {modules.map(renderNode)}
      </div>

      {/* Empty state */}
      {modules.length === 0 && (
        <div className="flex items-center justify-center h-24 text-xs text-[var(--color-text-muted)]">
          No modules in chain
        </div>
      )}
    </div>
  )
}