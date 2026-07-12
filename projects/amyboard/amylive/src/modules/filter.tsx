import { useCallback } from 'react'
import { Filter as FilterIcon } from 'lucide-react'
import { ModuleWrapper } from '../components/ModuleWrapper'
import { Slider } from '../components/Slider'
import type { ModuleProps } from '../types/amy'
import { FILTER } from '../types/amy'

const FILTER_OPTIONS = [
  { value: FILTER.NONE, label: 'NONE' },
  { value: FILTER.LPF, label: 'LPF' },
  { value: FILTER.BPF, label: 'BPF' },
  { value: FILTER.HPF, label: 'HPF' },
  { value: FILTER.ORDER2_LPF, label: '2-POLE LPF' },
]

export function FilterModule({ id, params, onParamChange }: ModuleProps) {
  const filterType = params.filter_type ?? FILTER.LPF
  const cutoff = params.cutoff ?? 8000
  const resonance = params.resonance ?? 0.7

  return (
    <ModuleWrapper
      id={id}
      title={`Filter ${params.osc ?? 0}`}
      icon={<FilterIcon size={14} className="text-[var(--color-accent)]" />}
    >
      {/* Filter Type Buttons */}
      <div className="flex gap-1">
        {FILTER_OPTIONS.map(ft => (
          <button
            key={ft.value}
            onClick={() => onParamChange('filter_type', ft.value)}
            className={`flex-1 py-1.5 text-[10px] font-mono rounded-lg transition-colors ${
              filterType === ft.value
                ? 'bg-[var(--color-accent-dim)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            {ft.label}
          </button>
        ))}
      </div>

      <Slider
        label="Cutoff"
        value={cutoff}
        min={20}
        max={16000}
        step={1}
        unit="Hz"
        onChange={(v) => onParamChange('cutoff', v)}
      />

      <Slider
        label="Resonance"
        value={resonance}
        min={0.1}
        max={16}
        step={0.1}
        onChange={(v) => onParamChange('resonance', v)}
      />

      {/* Modulation Sources */}
      <div className="pt-2 border-t border-[var(--color-border)]">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Modulation</span>
        
        <Slider
          label="EG1 → Freq"
          value={params.modEg1 ?? 0}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onParamChange('modEg1', v)}
        />
        <Slider
          label="LFO → Freq"
          value={params.modLfo ?? 0}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onParamChange('modLfo', v)}
        />
        <Slider
          label="Key → Freq"
          value={params.modKey ?? 0}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onParamChange('modKey', v)}
        />
      </div>
    </ModuleWrapper>
  )
}