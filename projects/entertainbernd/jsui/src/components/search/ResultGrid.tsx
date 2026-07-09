import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '../../types';

interface Props {
  results: SearchResult[];
}

export default function ResultGrid({ results }: Props) {
  const navigate = useNavigate();

  if (!results || results.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {results.map((result, i) => (
        <ResultCard
          key={result.id || i}
          result={result}
          onClick={() => navigate(`/detail/${result.id}`, { state: { result } })}
        />
      ))}
    </div>
  );
}

function ResultCard({ result, onClick }: { result: SearchResult; onClick: () => void }) {
  const src = (result.source || '').toLowerCase();
  const srcIcon = src === 'nzbgeek' ? '🌐' : '🔧';
  const srcColor = src === 'nzbgeek' ? '#89b4fa' : '#cba6f7';
  const lang = (result.language || '').toLowerCase();
  const langFlag = lang.startsWith('d') ? '🇩🇪' : lang.startsWith('e') ? '🇬🇧' : '🌐';

  return (
    <div
      onClick={onClick}
      className="rounded-xl overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
    >
      {/* Poster */}
      <div
        className="aspect-[2/3] relative flex items-center justify-center"
        style={{ backgroundColor: 'var(--tg-secondary-bg-color)' }}
      >
        {result.poster_url ? (
          <img src={result.poster_url} alt={result.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl opacity-20">🎬</span>
        )}
        {/* Source badge */}
        <div
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
          style={{ backgroundColor: srcColor, color: '#1e1e2e' }}
        >
          {srcIcon}
        </div>
        {/* Lang badge */}
        <div
          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}
        >
          {langFlag}
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 card-gradient rounded-b-xl">
        <p
          className="text-xs font-medium leading-tight line-clamp-2 mb-1.5 min-h-[2em]"
          style={{ color: 'var(--tg-text-color)' }}
        >
          {result.title || 'Unbekannt'}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--tg-hint-color)' }}>
            {result.size_formatted || '?'}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--tg-hint-color)' }}>
            ⬇️ {result.grabs || 0}
          </span>
        </div>
      </div>
    </div>
  );
}