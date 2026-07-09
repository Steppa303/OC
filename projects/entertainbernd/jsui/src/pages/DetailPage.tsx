import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Heart, Share2 } from 'lucide-react';
import { useDownload } from '../hooks/useSearch';
import { safeHapticFeedback, safeBackButton } from '../hooks/telegram';
import type { SearchResult } from '../types';

const GENRE_COLORS: Record<string, string> = {
  movie: '#f38ba8',
  tv: '#89b4fa',
  audio: '#a6e3a1',
  book: '#f9e2af',
  game: '#cba6f7',
  other: '#6c7086',
};

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as { result?: SearchResult })?.result;
  const { download, loading: dlLoading } = useDownload();
  const [dlStatus, setDlStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const haptic = safeHapticFeedback();
  const backBtn = safeBackButton();

  // Back button
  useState(() => {
    if (backBtn) {
      backBtn.show();
      const cleanup = backBtn.onClick(() => navigate(-1));
      return () => cleanup?.();
    }
  });

  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'var(--tg-hint-color)' }}>Keine Details verfügbar</p>
      </div>
    );
  }

  const handleDownload = async () => {
    setDlStatus('sending');
    haptic?.impactOccurred('medium');
    try {
      const res = await download({ link: result.link, title: result.title, size: result.size, category: result.category });
      if (res.success) {
        setDlStatus('done');
        haptic?.notificationOccurred('success');
      } else {
        setDlStatus('error');
        haptic?.notificationOccurred('error');
      }
    } catch {
      setDlStatus('error');
      haptic?.notificationOccurred('error');
    }
  };

  const mediaType = result.media_type || 'other';
  const color = GENRE_COLORS[mediaType] || GENRE_COLORS.other;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="px-4 pt-4"
    >
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 mb-4 text-sm"
        style={{ color: 'var(--tg-accent-color)' }}
      >
        <ArrowLeft size={16} />
        Zurück
      </button>

      {/* Poster */}
      <div
        className="w-full aspect-[2/3] rounded-2xl mb-4 overflow-hidden relative card-gradient flex items-center justify-center"
      >
        {result.poster_url ? (
          <img src={result.poster_url} alt={result.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-6xl opacity-30">🎬</div>
        )}
        <div
          className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: color, color: '#1e1e2e' }}
        >
          {result.media_type === 'movie' ? '🎬 Film' : result.media_type === 'tv' ? '📺 Serie' : '📦'}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--tg-text-color)' }}>
        {result.title}
      </h1>

      {/* Meta Row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--tg-secondary-bg-color)', color: 'var(--tg-hint-color)' }}>
          {result.size_formatted}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--tg-secondary-bg-color)', color: 'var(--tg-hint-color)' }}>
          {result.language === 'de' ? '🇩🇪 Deutsch' : result.language === 'en' ? '🇬🇧 Englisch' : '🌐'}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--tg-secondary-bg-color)', color: 'var(--tg-hint-color)' }}>
          {result.source === 'Geek' ? '🌐 NZBGeek' : '🔧 Hydra'}
        </span>
        {result.grabs > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--tg-secondary-bg-color)', color: 'var(--tg-hint-color)' }}>
            ⬇️ {result.grabs} Downloads
          </span>
        )}
      </div>

      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={dlLoading || dlStatus === 'done'}
        className="w-full py-3.5 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2"
        style={{
          backgroundColor: dlStatus === 'done' ? '#a6e3a1' : 'var(--tg-button-color)',
          color: dlStatus === 'done' ? '#1e1e2e' : 'var(--tg-button-text-color)',
          opacity: dlLoading ? 0.6 : 1,
        }}
      >
        {dlLoading ? (
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} />
        ) : dlStatus === 'done' ? (
          '✅ Download gestartet!'
        ) : dlStatus === 'error' ? (
          '❌ Fehlgeschlagen'
        ) : (
          <>
            <Download size={18} />
            Download starten
          </>
        )}
      </button>

      {/* Secondary Actions */}
      <div className="flex gap-2 mt-3">
        <button
          className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all"
          style={{ backgroundColor: 'var(--tg-secondary-bg-color)', color: 'var(--tg-text-color)' }}
          onClick={() => haptic?.impactOccurred('light')}
        >
          <Heart size={16} />
          Merken
        </button>
        <button
          className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all"
          style={{ backgroundColor: 'var(--tg-secondary-bg-color)', color: 'var(--tg-text-color)' }}
          onClick={() => {
            haptic?.impactOccurred('light');
            navigator.clipboard?.writeText(result.title);
          }}
        >
          <Share2 size={16} />
          Teilen
        </button>
      </div>

      {/* Details */}
      <div className="mt-6 p-4 rounded-xl card-gradient">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--tg-text-color)' }}>Details</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span style={{ color: 'var(--tg-hint-color)' }}>Quelle</span>
            <span style={{ color: 'var(--tg-text-color)' }}>{result.source}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--tg-hint-color)' }}>Größe</span>
            <span style={{ color: 'var(--tg-text-color)' }}>{result.size_formatted}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--tg-hint-color)' }}>Sprache</span>
            <span style={{ color: 'var(--tg-text-color)' }}>{result.language === 'de' ? 'Deutsch' : result.language === 'en' ? 'Englisch' : 'Unbekannt'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--tg-hint-color)' }}>Veröffentlicht</span>
            <span style={{ color: 'var(--tg-text-color)' }}>{result.pub_date || 'Unbekannt'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}