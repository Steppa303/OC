import { useState } from 'react'
import { motion } from 'framer-motion'

const VolumeSlider = ({ value = 100, onChange, color = '#8b5cf6' }) => {
  const [isDragging, setIsDragging] = useState(false)
  const percent = (value / 127) * 100

  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* Volume icon */}
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="text-muted flex-shrink-0"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {percent > 50 && <path d="M15.54 8.46a5 5 0 010 7.07" />}
        {percent > 0 && percent <= 50 && <path d="M15.54 8.46a5 5 0 010 7.07" style={{ opacity: 0.5 }} />}
      </svg>

      {/* Slider track */}
      <div className="relative flex-1 min-w-0">
        <div
          className="w-full h-3 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${percent}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              background: `linear-gradient(90deg, ${color}80, ${color})`,
              boxShadow: isDragging ? `0 0 8px ${color}60` : 'none',
            }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={127}
          step={1}
          value={value}
          onChange={(e) => onChange?.(Number(e.target.value))}
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={() => setIsDragging(false)}
          onPointerCancel={() => setIsDragging(false)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ minHeight: 44 }}
        />
      </div>

      {/* Percent display */}
      <span className="text-[10px] tabular-nums text-muted w-7 text-right flex-shrink-0">
        {Math.round(percent)}%
      </span>
    </div>
  )
}

export default VolumeSlider
