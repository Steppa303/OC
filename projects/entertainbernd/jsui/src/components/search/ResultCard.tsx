import { motion } from 'framer-motion';
import { Download, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safeHapticFeedback } from '../../hooks/telegram';
import type { SearchResult } from '../../types';

interface Props {
  results: SearchResult[];
}

export default function ResultGrid({ results }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {results.map((result, i) => (
        <ResultCard key={result.id} result={result} index={i} />
      ))}
    </div>
  );
}

function ResultCard({ result, index }: { result: SearchResult; index: number }) {
  const navigate = useNavigate();
  const haptic = safeHapticFeedback();

  const handleClick = () => {
    haptic?.impactOccurred('light');
    navigate(`/detail/${result.id}`, { state: { result } });
  };

  const handleQuickDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic?.impactOccurred('medium');
    fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: result.link, title: result.title }),
    }).catch(() => {});
  };

  const handleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic?.impactOccurred('light');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={handleClick}
      className="rounded-xl overflow-hidden cursor-pointer card-gradient glass-hover active:scale-[0.97] transition-transform"
    >
      {/* Poster Area */}
      <div className="aspect-[2/3] relative flex items-center justify-center" style={{ backgroundColor: 'var(--tg-secondary-bg-color)' }}>
        {result.poster_url ? (
          <img src={result.poster_url} alt={result.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl opacity-20">
            {result.media_type === 'movie' ? '🎬' : result.media_type?.includes('tv') || result.media_type === 'serie' ? '📺' : '📦'}
          </span>
        )}
        <div
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
          style={{
            backgroundColor: result.source === 'Geek' ? '#89b4fa' : '#cba6f7',
            color: '#1e1e2e',
          }}
        >
          {result.source === 'Geek' ? '🌐' : '🔧'}
        </div>
        <div
          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}
        >
          {result.language === 'de' ? '🇩🇪' : result.language === 'en' ? '🇬🇧' : '🌐'}
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-xs font-medium leading-tight line-clamp-2 mb-1.5" style={{ color: 'var(--tg-text-color)' }}>
          {result.title}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--tg-hint-color)' }}>
            {result.size_formatted}
          </span>
          <div className="flex gap-1">
            <button
              onClick={handleQuickDownload}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--tg-accent-color)' }}
            >
              <Download size={12} />
            </button>
            <button
              onClick={handleWatchlist}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--tg-hint-color)' }}
            >
              <Heart size={12} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}