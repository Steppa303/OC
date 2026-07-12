import type { OscillatorState } from '../../lib/types';
import { usePresetStore } from '../../amy/presets/presetStore';
import { useAMY } from '../../amy/AMYProvider';
import { WAVE_LIST, WAVE_NAMES, AMY } from '../../amy/amyConstants';
import { amySend } from '../../amy/wireMessage';

function SliderControl({ label, value, min, max, step, unit, color, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  color?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-[var(--color-text-dim)] font-medium uppercase tracking-wider">{label}</span>
        <span className="text-sm font-mono" style={{ color: color || 'var(--color-accent-cyan)' }}>
          {step < 1 ? value.toFixed(2) : Math.round(value)}{unit || ''}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full"
        style={{
          accentColor: color || 'var(--color-accent-cyan)',
        }}
      />
    </div>
  );
}

function WaveformSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap mb-3">
      {WAVE_LIST.map(w => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-all touch-target ${
            value === w
              ? 'bg-[var(--color-accent-cyan)] text-black shadow-[0_0_8px_var(--color-accent-cyan)]'
              : 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)] border border-[#333]'
          }`}
          style={{ minHeight: 36 }}
        >
          {WAVE_NAMES[w]}
        </button>
      ))}
    </div>
  );
}

export default function OscillatorSection() {
  const oscIndex = 0;
  const osc = usePresetStore((s: any) => s.currentPatch.oscillators[oscIndex]);
  const updateOsc = usePresetStore((s: any) => s.updateOsc);
  const ready = useAMY().ready;

  const handleChange = (field: keyof OscillatorState, value: any) => {
    updateOsc(oscIndex, { [field]: value });
    if (ready) {
      amySend({ osc: oscIndex, [field]: value });
      // Bei wave Änderung auch den Sound resetten
      if (field === 'wave') {
        amySend({ osc: oscIndex, wave: value, freq: osc.freq.const || 440, amp: osc.amp.const || 0.5 });
      }
    }
  };

  const handleCtrlCoef = (field: 'freq' | 'amp' | 'duty' | 'pan', coef: keyof typeof osc.freq, val: number) => {
    const updated = { ...osc[field], [coef]: val };
    updateOsc(oscIndex, { [field]: updated });
    if (ready) {
      const msg: any = { osc: oscIndex };
      msg[field] = updated;
      amySend(msg);
    }
  };

  if (!osc) return null;

  return (
    <div className="space-y-3">
      {/* Waveform */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-[var(--color-text-dim)] font-medium uppercase tracking-wider">Waveform</span>
        </div>
        <WaveformSelect value={osc.wave} onChange={v => handleChange('wave', v)} />
      </div>

      {/* Frequency */}
      <SliderControl label="Frequency" value={osc.freq.const || 440} min={20} max={8000} step={1} unit="Hz"
        color="var(--color-accent-cyan)"
        onChange={v => handleCtrlCoef('freq', 'const', v)} />

      {/* Amplitude */}
      <SliderControl label="Amplitude" value={osc.amp.const || 0.5} min={0} max={1} step={0.01}
        color="var(--color-accent-green)"
        onChange={v => handleCtrlCoef('amp', 'const', v)} />

      {/* Duty (falls relevant) */}
      {osc.wave === AMY.PULSE && (
        <SliderControl label="Duty" value={osc.duty.const || 0.5} min={0.01} max={0.99} step={0.01}
          color="var(--color-accent-amber)"
          onChange={v => handleCtrlCoef('duty', 'const', v)} />
      )}

      {/* Pan */}
      <SliderControl label="Pan" value={osc.pan.const || 0.5} min={0} max={1} step={0.01}
        color="var(--color-accent-purple)"
        onChange={v => handleCtrlCoef('pan', 'const', v)} />

      {/* Velocity Amount */}
      <SliderControl label="Vel → Amp" value={osc.amp.vel || 0} min={0} max={1} step={0.01}
        color="var(--color-accent-orange)"
        onChange={v => handleCtrlCoef('amp', 'vel', v)} />
    </div>
  );
}