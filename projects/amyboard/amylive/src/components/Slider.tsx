import { useRef, useCallback, type ChangeEvent } from 'react'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  className?: string
}

export function Slider({ label, value, min, max, step = 1, unit, onChange, className = '' }: SliderProps) {
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value))
  }, [onChange])

  const pct = ((value - min) / (max - min)) * 100
  const displayVal = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value * 100) / 100)

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-[var(--color-text-dim)] font-medium">{label}</span>
        <span className="text-xs font-mono text-[var(--color-primary)]">
          {displayVal}{unit && <span className="text-[var(--color-text-muted)] ml-0.5">{unit}</span>}
        </span>
      </div>
      <div className="relative">
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] rounded-full pointer-events-none"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--color-primary-dim), var(--color-primary))',
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="w-full relative z-10"
          aria-label={label}
        />
      </div>
    </div>
  )
}

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

export function SliderRow({ label, value, min, max, step = 1, unit, onChange }: SliderRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--color-text-dim)] w-16 shrink-0">{label}</span>
      <div className="flex-1">
        <Slider label="" value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} />
      </div>
    </div>
  )
}