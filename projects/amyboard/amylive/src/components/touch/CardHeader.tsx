import { X } from 'lucide-react'
import { type ReactNode } from 'react'

interface CardHeaderProps {
  title: string
  icon?: ReactNode
  onClose?: () => void
  rightAction?: ReactNode
  chainMiniMap?: ReactNode
}

/**
 * Compact header bar for touch cards.
 * Icon + title left, close/action right, border-b divider.
 * Optional chainMiniMap renders below the header.
 */
export function CardHeader({ title, icon, onClose, rightAction, chainMiniMap }: CardHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon && <span className="text-[var(--color-primary)]">{icon}</span>}
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {rightAction}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      {chainMiniMap}
    </>
  )
}