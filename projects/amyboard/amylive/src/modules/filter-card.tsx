import { useCallback } from 'react'
import { Filter as FilterIcon } from 'lucide-react'
import { TouchSlider } from '@/components/touch/TouchSlider'
import { Pills } from '@/components/touch/Pills'
import { CardHeader } from '@/components/touch/CardHeader'
import type { CardProps } from '@/types/amy'
import { FILTER } from '@/types/amy'

const FILTER_OPTIONS = [
  { value: FILTER.LPF, label: 'LPF' },
  { value: FILTER.BPF, label: 'BPF' },
  { value: FILTER.HPF, label: 'HPF' },
  { value: FILTER.ORDER2_LPF, label: '2-POLE' },
]

export function FilterCard({ id, params, onParamChange, onSendWire, cardIndex, totalCards, chainInfo }: CardProps) {
  const filterType = params.filter_type ?? FILTER.LPF
  const cutoff = params.cutoff ?? 8000
  const resonance = params.resonance ?? 0.7
  const modEg1 = params.modEg1 ?? 0
  const modLfo = params.modLfo ?? 0
  const modKey = params.modKey ?? 0

  const handleChange = useCallback(
    (key: string, value: any) => {
      onParamChange(key, value)
    },
    [onParamChange],
  )

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <CardHeader
        title={`Filter ${params.osc ?? 0}`}
        icon={<FilterIcon size={16} />}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Filter Type */}
        <div>
          <span className="text-xs text-[var(--color-text-dim)] font-medium mb-1.5 block">Type</span>
          <Pills
            options={FILTER_OPTIONS}
            value={filterType}
            onChange={(v) => handleChange('filter_type', v)}
          />
        </div>

        {/* Cutoff — Extra prominent */}
        <TouchSlider
          label="Cutoff"
          value={cutoff}
          min={20}
          max={16000}
          step={1}
          unit="Hz"
          logScale
          showMinMax
          onChange={(v) => handleChange('cutoff', v)}
        />

        {/* Resonance */}
        <TouchSlider
          label="Resonance"
          value={resonance}
          min={0.1}
          max={16}
          step={0.1}
          onChange={(v) => handleChange('resonance', v)}
        />

        {/* Modulation Section */}
        <div className="border-t border-[var(--color-border)] pt-3">
          <span className="text-xs text-[var(--color-text-dim)] font-medium mb-3 block">Modulation</span>
          <div className="space-y-3">
            <TouchSlider
              label="EG1 → Freq"
              value={modEg1}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => handleChange('modEg1', v)}
            />
            <TouchSlider
              label="LFO → Freq"
              value={modLfo}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => handleChange('modLfo', v)}
            />
            <TouchSlider
              label="Key → Freq"
              value={modKey}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => handleChange('modKey', v)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}