import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';
import SearchInput from '../components/search/SearchInput';
import FilterBar from '../components/search/FilterBar';
import ResultGrid from '../components/search/ResultGrid';
import ErrorBoundary from '../components/shared/ErrorBoundary';

const CAT_MAP: Record<string, string | null> = {
  film: '2000',
  serie: '5000',
  audio: '3000',
  buch: '7000',
  game: '1000,4000',
  all: null,
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>('2000');
  const [showFilters, setShowFilters] = useState(false);
  const [activeMedia, setActiveMedia] = useState('film');

  const doSearch = useCallback(async () => {
    if (!query || query.length < 2) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const params = new URLSearchParams({ q: query, page: '0', limit: '20' });
      if (cat) params.set('cat', cat);
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults(data.results || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      console.error('[search]', e);
      setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, cat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };

  const handleMediaChange = (key: string) => {
    setActiveMedia(key);
    setCat(CAT_MAP[key] || null);
  };

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Search + Filter button */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <SearchInput
            value={query}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
            onSubmit={doSearch}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="p-2.5 rounded-xl transition-colors"
          style={{
            backgroundColor: showFilters ? 'var(--tg-button-color)' : 'var(--tg-secondary-bg-color)',
            color: showFilters ? 'var(--tg-button-text-color)' : 'var(--tg-text-color)',
          }}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Media Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {[
          { key: 'film', label: '🎬 Film' },
          { key: 'serie', label: '📺 Serie' },
          { key: 'audio', label: '🎵 Audio' },
          { key: 'buch', label: '📚 Buch' },
          { key: 'game', label: '🎮 Game' },
          { key: 'all', label: '📦 Alles' },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleMediaChange(opt.key)}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
            style={{
              backgroundColor: activeMedia === opt.key ? 'var(--tg-button-color)' : 'var(--tg-secondary-bg-color)',
              color: activeMedia === opt.key ? 'var(--tg-button-text-color)' : 'var(--tg-text-color)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="mb-4">
          <FilterBar
            language={null}
            onLanguageChange={() => {}}
            source={null}
            onSourceChange={() => {}}
          />
        </div>
      )}

      {/* Results */}
      <ErrorBoundary>
        {loading && (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--tg-accent-color)', borderTopColor: 'transparent' }} />
            <span className="text-sm" style={{ color: 'var(--tg-hint-color)' }}>Suche läuft...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--tg-destructive-text-color)' }}>❌ {error}</p>
          </div>
        )}

        {results && results.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm" style={{ color: 'var(--tg-hint-color)' }}>Keine Ergebnisse für "{query}"</p>
          </div>
        )}

        {results && results.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--tg-hint-color)' }}>
                {total} Ergebnisse
              </span>
            </div>
            <ResultGrid results={results} />
          </>
        )}

        {!loading && !results && !error && query.length < 2 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🦞</div>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--tg-text-color)' }}>EntertainBernd</h2>
            <p className="text-sm" style={{ color: 'var(--tg-hint-color)' }}>
              Such nach Filmen, Serien, Musik & mehr<br/>auf Usenet
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--tg-hint-color)' }}>
              Suchbegriff eingeben und ↵ drücken
            </p>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}