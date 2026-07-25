import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, WheelEvent } from 'react';

export interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Value restored on double-click. Defaults to min. */
  defaultValue?: number;
  scale?: 'lin' | 'log';
  size?: 'sm' | 'lg';
  unit?: string;
  /** Formats the tooltip value. Defaults to 3 significant digits + unit. */
  format?: (value: number) => string;
}

const DRAG_NORM_PER_PX = 0.005;
const FINE_FACTOR = 0.1;
const WHEEL_NORM_PER_LINE = 0.02;

/** Log scale needs a positive lower bound; min <= 0 would put NaN into the SVG needle. */
function logMin(min: number, max: number): number {
  return min > 0 ? min : Math.abs(max) / 1000 || 1e-3;
}

function toNorm(value: number, min: number, max: number, scale: 'lin' | 'log'): number {
  if (scale === 'log') {
    const lo = logMin(min, max);
    const v = Math.min(max, Math.max(lo, value));
    return (Math.log(v) - Math.log(lo)) / (Math.log(max) - Math.log(lo));
  }
  return (value - min) / (max - min);
}

function fromNorm(norm: number, min: number, max: number, scale: 'lin' | 'log'): number {
  const n = Math.min(1, Math.max(0, norm));
  if (scale === 'log') {
    const lo = logMin(min, max);
    return Math.exp(Math.log(lo) + n * (Math.log(max) - Math.log(lo)));
  }
  return min + n * (max - min);
}

export function Knob({
  label,
  value,
  min,
  max,
  onChange,
  defaultValue,
  scale = 'lin',
  size = 'sm',
  unit,
  format,
}: KnobProps) {
  const [active, setActive] = useState(false);
  const drag = useRef<{ startY: number; startNorm: number } | null>(null);

  const px = size === 'lg' ? 44 : 32;
  const norm = toNorm(value, min, max, scale);

  const fmt =
    format ??
    ((v: number) => {
      const text = Math.abs(v) >= 100 ? v.toFixed(0) : v.toPrecision(3);
      return unit ? `${text} ${unit}` : text;
    });

  const commitNorm = useCallback(
    (n: number) => onChange(fromNorm(n, min, max, scale)),
    [onChange, min, max, scale],
  );

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startNorm: norm };
    setActive(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const factor = e.shiftKey ? FINE_FACTOR : 1;
    const delta = (drag.current.startY - e.clientY) * DRAG_NORM_PER_PX * factor;
    commitNorm(drag.current.startNorm + delta);
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
    setActive(false);
  };

  const onWheel = (e: WheelEvent<HTMLButtonElement>) => {
    const factor = e.shiftKey ? FINE_FACTOR : 1;
    const step = e.deltaY < 0 ? WHEEL_NORM_PER_LINE : -WHEEL_NORM_PER_LINE;
    commitNorm(norm + step * factor);
  };

  const onDoubleClick = () => onChange(defaultValue ?? min);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const factor = e.shiftKey ? FINE_FACTOR : 1;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      commitNorm(norm + WHEEL_NORM_PER_LINE * factor);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      commitNorm(norm - WHEEL_NORM_PER_LINE * factor);
    }
  };

  // Indicator arc: 270° sweep starting at 135° (7 o'clock), like hardware knobs.
  const startAngle = 135;
  const angle = startAngle + norm * 270;
  const r = px / 2 - 3;
  const cx = px / 2;
  const cy = px / 2;
  const rad = (angle * Math.PI) / 180;
  const tipX = cx + r * 0.7 * Math.cos(rad);
  const tipY = cy + r * 0.7 * Math.sin(rad);

  return (
    <button
      type="button"
      className="ui-knob"
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={fmt(value)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => {
        if (!drag.current) setActive(false);
      }}
    >
      {active && <span className="ui-knob-tooltip">{fmt(value)}</span>}
      <svg width={px} height={px} aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="var(--bg-panel-raised)" stroke="var(--border-panel)" />
        <line
          x1={cx}
          y1={cy}
          x2={tipX}
          y2={tipY}
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="ui-knob-label">{label}</span>
    </button>
  );
}
