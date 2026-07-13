import { useRef } from 'react'
import type { PointerEvent } from 'react'

const TYPE_COLORS: Record<string, string> = {
  source: 'var(--color-success)',
  processor: 'var(--color-primary)',
  modulator: 'var(--color-accent)',
  output: 'var(--color-warning)',
  controller: 'var(--color-text-muted)',
}

const TYPE_BG: Record<string, string> = {
  source: 'rgba(34, 197, 94, 0.12)',
  processor: 'rgba(129, 140, 248, 0.12)',
  modulator: 'rgba(244, 114, 182, 0.12)',
  output: 'rgba(234, 179, 8, 0.12)',
  controller: 'rgba(100, 116, 139, 0.12)',
}

interface PortDef {
  id: string
  label: string
}

interface ChainNodeProps {
  moduleId: string
  name: string
  type: string // 'source' | 'processor' | 'modulator' | 'output' | 'controller'
  isActive?: boolean
  inputPorts?: PortDef[]
  outputPorts?: PortDef[]
  onClick?: (moduleId: string) => void
  onDragStart?: (moduleId: string, output: string, x: number, y: number) => void
  onDrop?: (moduleId: string, input: string) => void
}

export function ChainNode({
  moduleId,
  name,
  type,
  isActive = false,
  inputPorts = [],
  outputPorts = [],
  onClick,
  onDragStart,
  onDrop,
}: ChainNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const color = TYPE_COLORS[type] ?? 'var(--color-text-muted)'
  const bg = TYPE_BG[type] ?? 'rgba(100,116,139,0.08)'

  const handleOutputPointerDown = (outputId: string, e: PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const node = nodeRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = rect.right
    const y = rect.top + rect.height / 2
    onDragStart?.(moduleId, outputId, x, y)
  }

  const handleInputPointerUp = (inputId: string, e: PointerEvent) => {
    e.stopPropagation()
    onDrop?.(moduleId, inputId)
  }

  return (
    <div
      ref={nodeRef}
      className={`relative flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
        isActive ? 'ring-2 ring-[var(--color-border-active)] shadow-lg' : ''
      }`}
      style={{
        backgroundColor: bg,
        border: `1px solid ${isActive ? 'var(--color-border-active)' : color}40`,
        color: isActive ? 'var(--color-text)' : 'var(--color-text-dim)',
      }}
      onClick={() => onClick?.(moduleId)}
    >
      {/* Input ports (left) */}
      {inputPorts.map((p) => (
        <div
          key={p.id}
          className="absolute -left-1.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-bg)]"
          style={{ backgroundColor: color, top: '50%', transform: 'translateY(-50%)' }}
          title={p.label}
          onPointerUp={(e) => handleInputPointerUp(p.id, e)}
        />
      ))}

      {/* Type dot */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Module name */}
      <span className="truncate max-w-[80px]">{name}</span>

      {/* Output ports (right) */}
      {outputPorts.map((p) => (
        <div
          key={p.id}
          className="absolute -right-1.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-bg)] cursor-grab active:cursor-grabbing"
          style={{ backgroundColor: color, top: '50%', transform: 'translateY(-50%)' }}
          title={p.label}
          onPointerDown={(e) => handleOutputPointerDown(p.id, e)}
        />
      ))}
    </div>
  )
}