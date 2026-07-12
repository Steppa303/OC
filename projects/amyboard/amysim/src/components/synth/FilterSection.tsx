import { usePresetStore } from '../../amy/presets/presetStore';
import { useAMY } from '../../amy/AMYProvider';
import { FILTER_LIST, FILTER_NAMES } from '../../amy/amyConstants';
import { amySend } from '../../amy/wireMessage';

function SliderControl({ label, value, min, max, step, unit, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  unit?: string; color?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-[var(--color-text-dim)] font-medium uppercase tracking-wider">{label}</span>
        <span className="text-sm font-mono" style={{ color: color || 'var(--color-accent-cyan)' }}>
          {step < 0.01 ? value.toFixed(3) : step < 1 ? value.toFixed(2) : Math.round(value)}{unit || ''}
        </span>
      </div>
      <input type="range" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))} className="w-full"
        style={{ accentColor: color || 'var(--color-accent-cyan)' }} />
    </div>
  );
}

export default function FilterSection() {
  const oscIndex = 0;
  const osc = usePresetStore((s: any) => s.currentPatch.oscillators[oscIndex]);
  const updateOsc = usePresetStore((s: any) => s.updateOsc);
  const ready = useAMY().ready;

  if (!osc) return null;

  const setFilter = (field: string, value: any) => {
    updateOsc(oscIndex, { [field]: value } as any);
    if (ready) {
      amySend({ osc: oscIndex, [field]: value });
    }
  };

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {FILTER_LIST.map(f => (
          <button key={f}
            onClick={() => setFilter('filterType', f)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all touch-target ${
              osc.filterType === f
                ? 'bg-[var(--color-accent-amber)] text-black shadow-[0_0_8px_var(--color-accent-amber)]'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)] border border-[#333]'
            }`}
            style={{ minHeight: 36 }}
          >
            {FILTER_NAMES[f] || `Filter ${f}`}
          </button>
        ))}
      </div>

      {osc.filterType >= 0 && (
        <>
          <SliderControl label="Cutoff" value={osc.filterFreq.const || 0.5} min={0} max={1} step={0.001}
            color="var(--color-accent-amber)" unit=""
            onChange={v => setFilter('filterFreq', { ...osc.filterFreq, const: v })} />
          <SliderControl label="Resonance" value={osc.resonance} min={0.5} max={16} step={0.1}
            color="var(--color-accent-orange)" unit=""
            onChange={v => setFilter('resonance', v)} />
        </>
      )}
    </div>
  );
}