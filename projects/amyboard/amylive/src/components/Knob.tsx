import { useRef, useCallback, type PointerEvent } from 'react'

interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  size?: number
}

export function Knob({ label, value, min, max, step = 1, unit, onChange, size = 48 }: KnobProps) {
  const knobRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastY = useRef(0)
  const currentVal = useRef(value)

  const angle = ((value - min) / (max - min)) * 270 - 135

  const handlePointerDown = useCallback((e: PointerEvent) => {
    dragging.current = true
    lastY.current = e.clientY
    currentVal.current = value
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [value])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return
    const delta = (lastY.current - e.clientY) * 0.5
    lastY.current = e.clientY

    const range = max - min
    let newVal = currentVal.current + (delta / 100) * range
    newVal = Math.max(min, Math.min(max, newVal))
    newVal = Math.round(newVal / step) * step
    currentVal.current = newVal
    onChange(newVal)
  }, [min, max, step, onChange])

  const handlePointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const displayVal = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value * 100) / 100)

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={knobRef}
        className="knob cursor-grab active:cursor-grabbing"
        style={{
          width: size,
          height: size,
          ['--knob-angle' as string]: `${angle}deg`,
          ['--knob-rotation' as string]: `${angle}deg`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <span className="text-[10px] font-mono text-[var(--color-primary)]">
        {displayVal}{unit && <span className="text-[var(--color-text-muted)]">{unit}</span>}
      </span>
      <span className="knob-label">{label}</span>
    </div>
  )
}