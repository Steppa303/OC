import { motion } from 'framer-motion'

const GENRES = [
  { key: 'acid',    label: 'Acid',    color: '#84cc16' },
  { key: 'house',   label: 'House',   color: '#f59e0b' },
  { key: 'techno',  label: 'Techno',  color: '#ef4444' },
  { key: 'trance',  label: 'Trance',  color: '#06b6d4' },
  { key: 'dnb',     label: 'D&B',     color: '#8b5cf6' },
  { key: 'hiphop',  label: 'Hip-Hop', color: '#ec4899' },
]

const GenreSliders = ({ values, onChange, readOnly = false, compact = false }) => {
  return (
    <div className={`space-y-${compact ? '1.5' : '2.5'}`}>
      {GENRES.map(({ key, label, color }) => {
        const value = values[key] ?? 0
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-medium">{label}</span>
              <span className="text-zinc-500 tabular-nums">{value}%</span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => onChange(key, parseInt(e.target.value))}
                disabled={readOnly}
                className={`
                  w-full h-2 rounded-full appearance-none cursor-pointer
                  bg-white/10
                  ${readOnly ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                style={{
                  background: `linear-gradient(to right, ${color}40 ${value}%, rgb(255 255 255 / 0.1) ${value}%)`,
                  accentColor: color,
                }}
              />
              {/* Custom thumb via pseudo-element styling not possible on range inputs;
                  accentColor handles it in Chromium, fallback in Firefox */}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default GenreSliders