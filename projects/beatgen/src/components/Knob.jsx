import { useRef, useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

/**
 * SVG-based rotary knob.
 * Drag up/down to change value. Long-press resets to default.
 * Touch-optimized: 44px min hit target.
 */
const Knob = ({
  label,
  value = 50,
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 50,
  onChange,
  color = '#8b5cf6',
  size = 72,
  inherited = false,
  inheritedValue,
  onReset,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [showGlow, setShowGlow] = useState(false)
  const dragRef = useRef({ startY: 0, startValue: 0 })
  const longPressRef = useRef(null)
  const containerRef = useRef(null)

  const displayValue = inherited ? (inheritedValue ?? value) : value
  const percent = (displayValue - min) / (max - min)
  const angle = -135 + percent * 270 // -135° to +135°

  // SVG arc calculation
  const radius = (size - 12) / 2
  const cx = size / 2
  const cy = size / 2
  const startAngle = -225 // degrees (bottom-left)
  const endAngle = startAngle + percent * 270

  const polarToCartesian = (cx, cy, r, angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const describeArc = (cx, cy, r, startAng, endAng) => {
    const start = polarToCartesian(cx, cy, r, endAng)
    const end = polarToCartesian(cx, cy, r, startAng)
    const largeArc = endAng - startAng > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
  }

  const handleDoubleClick = useCallback(() => {
    if (inherited) return
    onReset?.()
    if (navigator.vibrate) navigator.vibrate(20)
  }, [inherited, onReset])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
    setShowGlow(true)
    dragRef.current = { startY: e.clientY, startValue: displayValue }

    // Long press timer for reset
    longPressRef.current = setTimeout(() => {
      onChange?.(defaultValue)
      // Haptic feedback on supported devices
      if (navigator.vibrate) navigator.vibrate(30)
    }, 600)

    let lastVibrate = 0
    const handlePointerMove = (e) => {
      const delta = (dragRef.current.startY - e.clientY) * ((max - min) / 200)
      const raw = dragRef.current.startValue + delta
      const stepped = Math.round(raw / step) * step
      const clamped = Math.max(min, Math.min(max, stepped))
      onChange?.(clamped)

      // Haptic feedback on drag (throttled)
      const now = Date.now()
      if (navigator.vibrate && now - lastVibrate > 80) {
        navigator.vibrate(10)
        lastVibrate = now
      }

      // Cancel long press if moved
      if (Math.abs(dragRef.current.startY - e.clientY) > 5 && longPressRef.current) {
        clearTimeout(longPressRef.current)
        longPressRef.current = null
      }
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      setShowGlow(false)
      if (longPressRef.current) {
        clearTimeout(longPressRef.current)
        longPressRef.current = null
      }
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }, [displayValue, min, max, step, defaultValue, onChange, inherited, onReset])

  useEffect(() => {
    return () => {
      if (longPressRef.current) clearTimeout(longPressRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-1 select-none">
        <motion.div
          ref={containerRef}
          whileTap={{ scale: 1.05 }}
          animate={{ scale: isDragging ? 1.08 : 1, opacity: inherited ? 0.6 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="relative cursor-pointer touch-none"
          style={{ width: size, height: size }}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
        >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="drop-shadow-lg"
          style={{
            filter: showGlow ? `drop-shadow(0 0 8px ${color}80)` : 'none',
            transition: 'filter 0.2s ease',
          }}
        >
          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={4}
            strokeLinecap="round"
          />

          {/* Value arc */}
          {percent > 0.01 && (
            <path
              d={describeArc(cx, cy, radius, startAngle, endAngle)}
              fill="none"
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              style={{
                filter: showGlow ? `drop-shadow(0 0 4px ${color})` : 'none',
              }}
            />
          )}

          {/* Indicator line */}
          {(() => {
            const indicatorAngle = angle * (Math.PI / 180)
            const innerR = radius * 0.55
            const outerR = radius * 0.85
            return (
              <line
                x1={cx + innerR * Math.cos(indicatorAngle)}
                y1={cy + innerR * Math.sin(indicatorAngle)}
                x2={cx + outerR * Math.cos(indicatorAngle)}
                y2={cy + outerR * Math.sin(indicatorAngle)}
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            )
          })()}

          {/* Center dot */}
          <circle cx={cx} cy={cy} r={2} fill={color} opacity={0.6} />
        </svg>

        {/* Value overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="text-sm font-bold tabular-nums"
            style={{
              color,
              textShadow: showGlow ? `0 0 8px ${color}80` : 'none',
            }}
          >
            {inherited ? 'auto' : value}
          </span>
        </div>
      </motion.div>

      {/* Label */}
      <span className="text-[10px] uppercase tracking-wider text-muted whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

export default Knob
