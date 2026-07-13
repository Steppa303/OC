interface PillsProps {
  options: { value: string | number; label: string }[]
  value: string | number
  onChange?: (value: any) => void
  className?: string
}

/**
 * Touch-friendly pill selector.
 * Each pill: rounded-full, min-h-[36px], text-sm
 * Selected: primary bg, Unselected: surface bg with border
 */
export function Pills({ options, value, onChange, className = '' }: PillsProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange?.(opt.value)}
          className={`min-h-[36px] px-3 py-1.5 text-sm font-mono rounded-full transition-colors cursor-pointer ${
            value === opt.value
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-primary)]/50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}