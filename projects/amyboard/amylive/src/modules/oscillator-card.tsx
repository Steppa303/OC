import { useCallback, useState } from 'react'
import { AudioWaveform, ChevronDown, ChevronUp } from 'lucide-react'
import { TouchSlider } from '@/components/touch/TouchSlider'
import { Pills } from '@/components/touch/Pills'
import { CardHeader } from '@/components/touch/CardHeader'
import type { CardProps } from '@/types/amy'
import { WAVE } from '@/types/amy'

const WAVE_OPTIONS = [
  { value: WAVE.SINE, label: 'SINE' },
  { value: WAVE.PULSE, label: 'PULSE' },
  { value: WAVE.SAW_DOWN, label: 'SAW▼' },
  { value: WAVE.SAW_UP, label: 'SAW▲' },
  { value: WAVE.TRIANGLE, label: 'TRI' },
  { value: WAVE.NOISE, label: 'NOISE' },
  { value: WAVE.KS, label: 'KS' },
  { value: WAVE.ALGO, label: 'FM' },
]

const BUS_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
]

export function OscillatorCard({ id, params, onParamChange, onSendWire, cardIndex, totalCards, chainInfo }: CardProps) {
  const [showMod, setShowMod] = useState(false)

  const wave = params.wave ?? WAVE.SINE
  const freq = params.freq ?? 440
  const amp = params.amp ?? 0.8
  const pan = params.pan ?? 0.5
  const bus = params.bus ?? 0
  const detune = params.detune ?? 0
  const portamento = params.portamento ?? 0

  const handleChange = useCallback(
    (key: string, value: any) => {
      onParamChange(key, value)
    },
    [onParamChange],
  )

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <CardHeader
        title={`OSC ${params.osc ?? 0}`}
        icon={<AudioWaveform size={16} />}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Waveform */}
        <div>
          <span className="text-xs text-[var(--color-text-dim)] font-medium mb-1.5 block">Waveform</span>
          <Pills
            options={WAVE_OPTIONS}
            value={wave}
            onChange={(v) => handleChange('wave', v)}
          />
        </div>

        {/* Frequency — Hero Slider */}
        <TouchSlider
          label="Frequency"
          value={freq}
          min={20}
          max={8000}
          step={1}
          unit="Hz"
          logScale
          showMinMax
          onChange={(v) => handleChange('freq', v)}
        />

        {/* Amplitude */}
        <TouchSlider
          label="Amplitude"
          value={amp}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => handleChange('amp', v)}
        />

        {/* Pan + Detune 2-column */}
        <div className="grid grid-cols-2 gap-3">
          <TouchSlider
            label="Pan"
            value={pan}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => handleChange('pan', v)}
          />
          <TouchSlider
            label="Detune"
            value={detune}
            min={-50}
            max={50}
            step={0.1}
            unit="ct"
            onChange={(v) => handleChange('detune', v)}
          />
        </div>

        {/* Portamento */}
        <TouchSlider
          label="Portamento"
          value={portamento}
          min={0}
          max={500}
          step={1}
          unit="ms"
          onChange={(v) => handleChange('portamento', v)}
        />

        {/* Bus */}
        <div>
          <span className="text-xs text-[var(--color-text-dim)] font-medium mb-1.5 block">Bus</span>
          <Pills
            options={BUS_OPTIONS}
            value={bus}
            onChange={(v) => handleChange('bus', v)}
          />
        </div>

        {/* Collapsible Modulation Section */}
        <div className="border-t border-[var(--color-border)] pt-3">
          <button
            onClick={() => setShowMod(!showMod)}
            className="flex items-center gap-1 text-xs text-[var(--color-text-dim)] font-medium hover:text-[var(--color-text)] transition-colors cursor-pointer"
          >
            {showMod ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Modulation
          </button>

          {showMod && (
            <div className="mt-3 space-y-3">
              <TouchSlider
                label="Note Track"
                value={params.freqCoefs?.note ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => handleChange('freqCoefs', { ...(params.freqCoefs || {}), note: v })}
              />
              <TouchSlider
                label="Velocity"
                value={params.freqCoefs?.vel ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => handleChange('freqCoefs', { ...(params.freqCoefs || {}), vel: v })}
              />
              <TouchSlider
                label="EG0 Amount"
                value={params.freqCoefs?.eg0 ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => handleChange('freqCoefs', { ...(params.freqCoefs || {}), eg0: v })}
              />
              <TouchSlider
                label="EG1 Amount"
                value={params.freqCoefs?.eg1 ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => handleChange('freqCoefs', { ...(params.freqCoefs || {}), eg1: v })}
              />
              <TouchSlider
                label="LFO Amount"
                value={params.freqCoefs?.mod ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => handleChange('freqCoefs', { ...(params.freqCoefs || {}), mod: v })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}