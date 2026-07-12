import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import { ModuleWrapper } from '../components/ModuleWrapper'
import { Slider } from '../components/Slider'
import type { ModuleProps } from '../types/amy'
import { EG } from '../types/amy'

const EG_OPTIONS = [
  { value: EG.NORMAL, label: 'RC' },
  { value: EG.LINEAR, label: 'LIN' },
  { value: EG.DX7, label: 'DX7' },
  { value: EG.EXPONENTIAL, label: 'EXP' },
]

interface EnvelopeSVGProps {
  attack: number
  decay: number
  sustain: number
  release: number
  egType: number
}

function EnvelopeSVG({ attack, decay, sustain, release, egType }: EnvelopeSVGProps) {
  const points = useMemo(() => {
    const w = 220; const h = 80
    const aEnd = Math.max(5, (attack / 2000) * w * 0.25)
    const dEnd = aEnd + Math.max(5, (decay / 2000) * w * 0.25)
    const rStart = Math.max(dEnd + 20, w * 0.6)
    const rEnd = rStart + Math.max(10, (release / 2000) * (w - rStart))

    let aCurve = ''
    if (egType === EG.EXPONENTIAL) {
      aCurve = `Q ${aEnd * 0.7} 10, ${aEnd} 30`
    } else if (egType === EG.LINEAR) {
      aCurve = `L ${aEnd} 30`
    } else {
      aCurve = `Q ${aEnd * 0.5} 5, ${aEnd} 30`
    }

    const sustY = 80 - sustain * 70

    return `M 5,75 L 5,75 ${aCurve} L ${dEnd},${sustY} L ${rStart},${sustY} Q ${rStart + (rEnd - rStart) * 0.5} ${sustY + 20}, ${rEnd} 75 L ${w - 5},75`
  }, [attack, decay, sustain, release, egType])

  return (
    <svg viewBox="0 0 220 80" className="envelope-svg" preserveAspectRatio="none">
      <path d={points} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="5" y="12" fill="var(--color-text-muted)" fontSize="8" fontFamily="monospace">1.0</text>
      <text x="5" y="76" fill="var(--color-text-muted)" fontSize="8" fontFamily="monospace">0.0</text>
    </svg>
  )
}

export function EnvelopeModule({ id, params, onParamChange }: ModuleProps) {
  const egId = params.egId ?? 0
  const attack = params.attack ?? 100
  const decay = params.decay ?? 200
  const sustain = params.sustain ?? 0.5
  const release = params.release ?? 300
  const egType = params.eg_type ?? EG.NORMAL

  return (
    <ModuleWrapper
      id={id}
      title={`EG ${egId}`}
      icon={<Activity size={14} className="text-[var(--color-warning)]" />}
    >
      {/* Envelope Type */}
      <div className="flex gap-1">
        {EG_OPTIONS.map(eg => (
          <button
            key={eg.value}
            onClick={() => onParamChange('eg_type', eg.value)}
            className={`flex-1 py-1 text-[10px] font-mono rounded-lg transition-colors ${
              egType === eg.value
                ? 'bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/30'
                : 'bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            {eg.label}
          </button>
        ))}
      </div>

      {/* Envelope SVG */}
      <EnvelopeSVG attack={attack} decay={decay} sustain={sustain} release={release} egType={egType} />

      {/* ADSR Sliders */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <Slider label="Attack" value={attack} min={1} max={2000} step={1} unit="ms" onChange={(v) => onParamChange('attack', v)} />
        <Slider label="Decay" value={decay} min={1} max={2000} step={1} unit="ms" onChange={(v) => onParamChange('decay', v)} />
        <Slider label="Sustain" value={sustain} min={0} max={1} step={0.01} onChange={(v) => onParamChange('sustain', v)} />
        <Slider label="Release" value={release} min={1} max={5000} step={10} unit="ms" onChange={(v) => onParamChange('release', v)} />
      </div>
    </ModuleWrapper>
  )
}