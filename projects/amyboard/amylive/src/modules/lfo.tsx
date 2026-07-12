import { Waves } from 'lucide-react'
import { ModuleWrapper } from '../components/ModuleWrapper'
import { Slider } from '../components/Slider'
import type { ModuleProps, WaveType } from '../types/amy'
import { WAVE } from '../types/amy'

const LFO_WAVE_OPTIONS = [
  { value: WAVE.SINE, label: 'SIN' },
  { value: WAVE.TRIANGLE, label: 'TRI' },
  { value: WAVE.SAW_DOWN, label: 'SAW▼' },
  { value: WAVE.SAW_UP, label: 'SAW▲' },
  { value: WAVE.PULSE, label: 'PUL' },
  { value: WAVE.NOISE, label: 'NSE' },
  { value: WAVE.SINE, label: 'RND' },
]

const TARGETS = [
  { key: 'targetPitch', label: 'Pitch' },
  { key: 'targetFilter', label: 'Filter' },
  { key: 'targetAmp', label: 'Amp' },
  { key: 'targetPwm', label: 'PWM' },
  { key: 'targetPan', label: 'Pan' },
]

export function LFOModule({ id, params, onParamChange }: ModuleProps) {
  const wave = params.wave ?? WAVE.TRIANGLE
  const freq = params.freq ?? 1.0
  const amp = params.amp ?? 0.5

  return (
    <ModuleWrapper
      id={id}
      title={`LFO ${params.lfoId ?? 1}`}
      icon={<Waves size={14} className="text-[var(--color-accent)]" />}
    >
      {/* LFO Wave */}
      <div className="flex gap-1">
        {LFO_WAVE_OPTIONS.map((wo, i) => (
          <button
            key={i}
            onClick={() => onParamChange('wave', wo.value)}
            className={`flex-1 py-1.5 text-[10px] font-mono rounded-lg transition-colors ${
              wave === wo.value
                ? 'bg-[var(--color-accent-dim)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            {wo.label}
          </button>
        ))}
      </div>

      <Slider
        label="Rate"
        value={freq}
        min={0.01}
        max={50}
        step={0.01}
        unit="Hz"
        onChange={(v) => onParamChange('freq', v)}
      />

      <Slider
        label="Depth"
        value={amp}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onParamChange('amp', v)}
      />

      {/* Modulation Targets */}
      <div className="pt-2 border-t border-[var(--color-border)]">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Targets</span>
        {TARGETS.map(t => (
          <label key={t.key} className="flex items-center justify-between py-1 text-xs">
            <span className="text-[var(--color-text-dim)]">{t.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={params[t.key] ?? 0}
                onChange={(e) => onParamChange(t.key, parseFloat(e.target.value))}
                className="w-16"
              />
              <span className="w-8 text-right font-mono text-[var(--color-primary)] text-[10px]">
                {Math.round((params[t.key] ?? 0) * 100)}%
              </span>
            </div>
          </label>
        ))}
      </div>
    </ModuleWrapper>
  )
}