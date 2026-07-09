import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onSubmit?: () => void;
}

export default function SearchInput({ value, onChange, onKeyDown, onSubmit }: Props) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--tg-hint-color)' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Suchen nach Filmen, Serien..."
        className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm outline-none transition-all"
        style={{
          backgroundColor: 'var(--tg-secondary-bg-color)',
          color: 'var(--tg-text-color)',
        }}
        autoComplete="off"
      />
      {value.length >= 2 && (
        <button
          onClick={onSubmit}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-xs font-medium"
          style={{ backgroundColor: 'var(--tg-button-color)', color: 'var(--tg-button-text-color)' }}
        >
          Los
        </button>
      )}
    </div>
  );
}