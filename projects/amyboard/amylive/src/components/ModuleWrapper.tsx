import { X, GripVertical } from 'lucide-react'
import { type ReactNode } from 'react'
import { useCanvasStore } from '../stores/canvas-store'

interface ModuleWrapperProps {
  id: string
  title: string
  icon?: ReactNode
  children: ReactNode
  selected?: boolean
  onRemove?: () => void
}

export function ModuleWrapper({ id, title, icon, children, selected, onRemove }: ModuleWrapperProps) {
  const { selectModule } = useCanvasStore()

  return (
    <div
      className={`bg-[var(--color-surface)] rounded-xl border transition-all duration-150 ${
        selected
          ? 'border-[var(--color-border-active)] shadow-lg shadow-[var(--color-primary-dim)]/10 module-selected'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-active)]/50'
      }`}
      onClick={() => selectModule(id)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GripVertical size={14} className="text-[var(--color-text-muted)] cursor-grab" />
          {icon}
          {title}
        </div>
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors p-1 rounded hover:bg-red-500/10"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {children}
      </div>
    </div>
  )
}

interface ModuleGridProps {
  children: ReactNode
  className?: string
}

export function ModuleGrid({ children, className = '' }: ModuleGridProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}>
      {children}
    </div>
  )
}