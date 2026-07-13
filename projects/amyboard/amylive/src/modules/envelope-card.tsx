import { useCallback, useMemo } from 'react'
import { Activity } from 'lucide-react'
import { TouchSlider } from '@/components/touch/TouchSlider'
import { Pills } from '@/components/touch/Pills'
import { CardHeader } from '@/components/touch/CardHeader'
import type { CardProps } from '@/types/amy'
import { EG } from '@/types/amy'

const EG_OPTIONS = [
  { value: EG.NORMAL, label: 'RC' },
  { value: EG.LINEAR, label: 'LIN' },
  { value: EG.DX7, label: 'DX7' },
  { value: EG.EXPONENTIAL, label: 'EXP' },
]

interface EnvelopeSVGLargeProps {
  attack: number
  decay: number
  sustain: number
  release: number
  egType: number
}

/**
 * Large SVG envelope visualization.
 * ViewBox "0 0 400 160", stroke="var(--color-primary)"
 * ADSR curve: attack rises to 1.0, decay falls to sustain, release falls to 0
 */
function EnvelopeSVGLarge({ attack, decay, sustain, release, egType }: EnvelopeSVGLargeProps) {
  const points = useMemo(() => {
    const w = 400
    const h = 160
    const margin = 8

    const aEnd = Math.max(12, (attack / 2000) * w * 0.25)
    const dEnd = aEnd + Math.max(12, (decay / 2000) * w * 0.25)
    const rStart = Math.max(dEnd + 30, w * 0.55)
    const rEnd = rStart + Math.max(12, (release / 5000) * (w - rStart))

    const peakY = margin + 8
    const baseY = h - margin
    const sustY = baseY - sustain * (baseY - peakY)

    let aCurve = ''
    if (egType === EG.EXPONENTIAL) {
      aCurve = `Q ${aEnd * 0.7} ${peakY + 20}, ${aEnd} ${peakY}`
    } else if (egType === EG.LINEAR) {
      aCurve = `L ${aEnd} ${peakY}`
    } else {
      aCurve = `Q ${aEnd * 0.5} ${peakY - 5}, ${aEnd} ${peakY}`
    }

    return `M ${margin},${baseY} L ${margin},${baseY} ${aCurve} L ${dEnd},${sustY} L ${rStart},${sustY} Q ${rStart + (rEnd - rStart) * 0.5} ${sustY + 30}, ${rEnd} ${baseY} L ${w - margin},${baseY}`
  }, [attack, decay, sustain, release, egType])

  return (
    <svg viewBox="0 0 400 160" className="w-full h-auto" preserveAspectRatio="none" style={{ maxHeight: '100px' }}>
      {/* Background */}
      <rect x="0" y="0" width="400" height="160" fill="var(--color-bg)" rx="8" />
      {/* Grid lines */}
      <line x1="0" y1="40" x2="400" y2="40" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4,4" />
      <line x1="0" y1="80" x2="400" y2="80" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4,4" />
      <line x1="0" y1="120" x2="400" y2="120" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4,4" />
      {/* ADSR Curve */}
      <path
        d={points}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Labels */}
      <text x="5" y="18" fill="var(--color-text-muted)" fontSize="10" fontFamily="monospace">1.0</text>
      <text x="5" y="154" fill="var(--color-text-muted)" fontSize="10" fontFamily="monospace">0.0</text>
      <text x="30" y="148" fill="var(--color-text-muted)" fontSize="8" fontFamily="monospace">A</text>
      <text x="70" y="148" fill="var(--color-text-muted)" fontSize="8" fontFamily="monospace">D</text>
      <text x="190" y="148" fill="var(--color-text-muted)" fontSize="8" fontFamily="monospace">S</text>
      <text x="310" y="148" fill="var(--color-text-muted)" fontSize="8" fontFamily="monospace">R</text>
    </svg>
  )
}

export function EnvelopeCard({ id, params, onParamChange, onSendWire, cardIndex, totalCards, chainInfo }: CardProps) {
  const egId = params.egId ?? 0
  const attack = params.attack ?? 100
  const decay = params.decay ?? 200
  const sustain = params.sustain ?? 0.5
  const release = params.release ?? 300
  const egType = params.eg_type ?? EG.NORMAL

  const handleChange = useCallback(
    (key: string, value: any) => {
      onParamChange(key, value)
    },
    [onParamChange],
  )

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <CardHeader
        title={`EG ${egId}`}
        icon={<Activity size={16} />}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* EG Type */}
        <div>
          <span className="text-xs text-[var(--color-text-dim)] font-medium mb-1.5 block">Type</span>
          <Pills
            options={EG_OPTIONS}
            value={egType}
            onChange={(v) => handleChange('eg_type', v)}
          />
        </div>

        {/* Large Envelope Visualization */}
        <EnvelopeSVGLarge
          attack={attack}
          decay={decay}
          sustain={sustain}
          release={release}
          egType={egType}
        />

        {/* ADSR Sliders */}
        <TouchSlider
          label="Attack"
          value={attack}
          min={1}
          max={2000}
          step={1}
          unit="ms"
          logScale
          showMinMax
          onChange={(v) => handleChange('attack', v)}
        />
        <TouchSlider
          label="Decay"
          value={decay}
          min={1}
          max={2000}
          step={1}
          unit="ms"
          logScale
          showMinMax
          onChange={(v) => handleChange('decay', v)}
        />
        <TouchSlider
          label="Sustain"
          value={sustain}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => handleChange('sustain', v)}
        />
        <TouchSlider
          label="Release"
          value={release}
          min={1}
          max={5000}
          step={1}
          unit="ms"
          logScale
          showMinMax
          onChange={(v) => handleChange('release', v)}
        />

        {/* Routing Info */}
        <div className="pt-2 text-xs text-[var(--color-text-muted)] text-center border-t border-[var(--color-border)]">
          Routed to OSC {params.osc ?? 0}
        </div>
      </div>
    </div>
  )
}