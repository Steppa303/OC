import { useRef, useCallback, useEffect, useState } from 'react'

interface TouchSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  logScale?: boolean
  showMinMax?: boolean
  onChange: (value: number) => void
  className?: string
}

/**
 * Touch-optimized Slider with Pointer Events.
 * Track height: 36px, Thumb: 24×24px white circle with shadow.
 * Supports log scale for frequency-like ranges.
 */
export function TouchSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  logScale = false,
  showMinMax = false,
  onChange,
  className = '',
}: TouchSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  // Convert value → percentage (0–100)
  const valueToPct = useCallback(
    (v: number): number => {
      if (logScale) {
        if (min <= 0 || max <= 0) return 0
        const logMin = Math.log2(min)
        const logMax = Math.log2(max)
        return ((Math.log2(Math.max(v, min)) - logMin) / (logMax - logMin)) * 100
      }
      return ((v - min) / (max - min)) * 100
    },
    [logScale, min, max],
  )

  // Convert percentage → value
  const pctToValue = useCallback(
    (pct: number): number => {
      const clamped = Math.max(0, Math.min(100, pct))
      let raw: number
      if (logScale) {
        const logMin = Math.log2(min)
        const logMax = Math.log2(max)
        raw = Math.pow(2, logMin + (logMax - logMin) * (clamped / 100))
      } else {
        raw = min + (max - min) * (clamped / 100)
      }
      // Round to step
      return Math.round(raw / step) * step
    },
    [logScale, min, max, step],
  )

  const computeValueFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return value
      const rect = track.getBoundingClientRect()
      const pct = ((clientX - rect.left) / rect.width) * 100
      return pctToValue(pct)
    },
    [value, pctToValue],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      setDragging(true)
      const newVal = computeValueFromPointer(e.clientX)
      onChange(newVal)
    },
    [computeValueFromPointer, onChange],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return
      const newVal = computeValueFromPointer(e.clientX)
      onChange(newVal)
    },
    [dragging, computeValueFromPointer, onChange],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      setDragging(false)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [],
  )

  const pct = valueToPct(value)

  // Format display value
  const displayVal = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value * 100) / 100)

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-[var(--color-text-dim)] font-medium">{label}</span>
        <span className="text-xs font-mono text-[var(--color-primary)] tabular-nums">
          {displayVal}{unit && <span className="text-[var(--color-text-muted)] ml-0.5">{unit}</span>}
        </span>
      </div>
      <div
        ref={trackRef}
        className={`relative h-[36px] bg-[var(--color-surface)] rounded-lg overflow-hidden touch-none cursor-pointer ${
          dragging ? 'ring-2 ring-[var(--color-primary)]/40' : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Active track fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-lg pointer-events-none"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--color-primary-dim), var(--color-primary))',
          }}
        />
        {/* Thumb */}
        <div
          className="absolute w-[24px] h-[24px] bg-white rounded-full shadow-lg pointer-events-none"
          style={{
            left: `${pct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}
        />
      </div>
      {showMinMax && (
        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
          <span>{logScale ? min : min}</span>
          <span>{logScale ? max : max}</span>
        </div>
      )}
    </div>
  )
}