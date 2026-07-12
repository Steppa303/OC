import { useCallback } from 'react'
import { AudioWaveform } from 'lucide-react'
import { ModuleWrapper } from '../components/ModuleWrapper'
import { Slider } from '../components/Slider'
import type { ModuleProps } from '../types/amy'
import { WAVE } from '../types/amy'

const WAVE_OPTIONS = [
  { value: WAVE.SINE, label: 'SINE' },
  { value: WAVE.PULSE, label: 'PULSE' },
  { value: WAVE.SAW_DOWN, label: 'SAW ▼' },
  { value: WAVE.SAW_UP, label: 'SAW ▲' },
  { value: WAVE.TRIANGLE, label: 'TRI' },
  { value: WAVE.NOISE, label: 'NOISE' },
  { value: WAVE.KS, label: 'KARPLUS' },
  { value: WAVE.PCM, label: 'PCM' },
  { value: WAVE.ALGO, label: 'FM' },
  { value: WAVE.WAVETABLE, label: 'WT' },
  { value: WAVE.CUSTOM, label: 'CUSTOM' },
]

export function OscillatorModule({ id, params, onParamChange, onSendWire }: ModuleProps) {
  const wave = params.wave ?? WAVE.SINE
  const freq = params.freq ?? 440
  const amp = params.amp ?? 0.8
  const pan = params.pan ?? 0.5
  const bus = params.bus ?? 0

  const handleChange = useCallback((key: string, value: any) => {
    onParamChange(key, value)
  }, [onParamChange])

  return (
    <ModuleWrapper
      id={id}
      title={`OSC ${params.osc ?? 0}`}
      icon={<AudioWaveform size={14} className="text-[var(--color-primary)]" />}
    >
      {/* Waveform Select */}
      <select
        value={wave}
        onChange={(e) => handleChange('wave', parseInt(e.target.value))}
        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border-active)]"
        aria-label="Waveform"
      >
        {WAVE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Sliders */}
      <Slider
        label="Frequency"
        value={freq}
        min={20}
        max={8000}
        step={1}
        unit="Hz"
        onChange={(v) => handleChange('freq', v)}
      />

      <Slider
        label="Amplitude"
        value={amp}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => handleChange('amp', v)}
      />

      <Slider
        label="Pan"
        value={pan}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => handleChange('pan', v)}
      />

      <Slider
        label="Detune"
        value={params.detune ?? 0}
        min={-50}
        max={50}
        step={0.1}
        unit="ct"
        onChange={(v) => handleChange('detune', v)}
      />

      <Slider
        label="Portamento"
        value={params.portamento ?? 0}
        min={0}
        max={500}
        step={10}
        unit="ms"
        onChange={(v) => handleChange('portamento', v)}
      />

      {/* Bus Select */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-dim)]">Bus</span>
        <select
          value={bus}
          onChange={(e) => handleChange('bus', parseInt(e.target.value))}
          className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs font-mono text-[var(--color-text)] focus:outline-none"
        >
          {[0, 1, 2, 3].map(b => (
            <option key={b} value={b}>Bus {b}</option>
          ))}
        </select>
      </div>
    </ModuleWrapper>
  )
}