interface Props {
  language: string | null;
  onLanguageChange: (val: string | null) => void;
  source: string | null;
  onSourceChange: (val: string | null) => void;
}

export default function FilterBar({ language, onLanguageChange, source, onSourceChange }: Props) {
  return (
    <div className="p-4 rounded-xl mb-3" style={{ backgroundColor: 'var(--tg-secondary-bg-color)' }}>
      <div className="mb-3">
        <span className="text-xs font-semibold mb-2 block" style={{ color: 'var(--tg-hint-color)' }}>
          Sprache
        </span>
        <div className="flex gap-1.5">
          {[
            { key: null as string | null, label: '🌐 Alle' },
            { key: 'de', label: '🇩🇪 Deutsch' },
            { key: 'en', label: '🇬🇧 Englisch' },
          ].map((opt) => (
            <button
              key={String(opt.key)}
              onClick={() => onLanguageChange(opt.key)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                backgroundColor: language === opt.key ? 'var(--tg-button-color)' : 'rgba(255,255,255,0.05)',
                color: language === opt.key ? 'var(--tg-button-text-color)' : 'var(--tg-text-color)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-semibold mb-2 block" style={{ color: 'var(--tg-hint-color)' }}>
          Quelle
        </span>
        <div className="flex gap-1.5">
          {[
            { key: null as string | null, label: '🔀 Beide' },
            { key: 'geek', label: '🌐 NZBGeek' },
            { key: 'hydra', label: '🔧 NZBHydra2' },
          ].map((opt) => (
            <button
              key={String(opt.key)}
              onClick={() => onSourceChange(opt.key)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                backgroundColor: source === opt.key ? 'var(--tg-button-color)' : 'rgba(255,255,255,0.05)',
                color: source === opt.key ? 'var(--tg-button-text-color)' : 'var(--tg-text-color)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}