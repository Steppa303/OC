import { useId } from 'react';

export interface SelectOption {
  value: string;
  label?: string;
}

export interface SelectProps {
  label: string;
  value: string;
  options: readonly (SelectOption | string)[];
  onChange: (value: string) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  const id = useId();
  return (
    <div className="ui-select">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => {
          const o = typeof opt === 'string' ? { value: opt } : opt;
          return (
            <option key={o.value} value={o.value}>
              {o.label ?? o.value}
            </option>
          );
        })}
      </select>
    </div>
  );
}
