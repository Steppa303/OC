import { useId } from 'react';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Optional unit suffix shown after the value (e.g. "Hz", "ms"). */
  unit?: string;
  /** Custom value formatter (defaults to a compact numeric format). */
  format?: (v: number) => string;
}

function defaultFormat(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toPrecision(3);
}

export function Slider({ label, value, min, max, step = 0.01, onChange, unit, format }: SliderProps) {
  const id = useId();
  const shown = (format ?? defaultFormat)(value);
  return (
    <div className="ui-slider">
      <label htmlFor={id} className="ui-slider-label">
        {label}
      </label>
      {/* The value is overlaid on the track (Blender-style) so it costs no
          horizontal space — the track stays full-width and draggable even in
          narrow modules. */}
      <span className="ui-slider-track">
        <input
          id={id}
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="ui-slider-value" aria-hidden="true">
          {shown}
          {unit ? ` ${unit}` : ''}
        </span>
      </span>
    </div>
  );
}
