import { motion } from 'framer-motion';
import { Clock, Pause, Play, X, HardDrive } from 'lucide-react';
import { useQueue } from '../hooks/useQueue';

export default function QueuePage() {
  const { queue, loading, control } = useQueue();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 pt-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold" style={{ color: 'var(--tg-text-color)' }}>📋 Queue</h1>
        <span className="text-xs" style={{ color: 'var(--tg-hint-color)' }}>
          {loading ? '…' : `Alle ${(queue?.active.length || 0) + (queue?.paused.length || 0)}`}
        </span>
      </div>

      {/* Waiting Items (SABnzbd WAIT state) */}
      {queue && queue.active.filter(i => i.percentage === 0 && i.mb === 0).length > 0 && (
        <div className="space-y-3 mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--tg-hint-color)' }}>
           ⏳ Wartend ({queue.active.filter(i => i.percentage === 0 && i.mb === 0).length})
          </h2>
          {queue.active.filter(i => i.percentage === 0 && i.mb === 0).map((item) => (
            <div key={item.nzo_id} className="p-4 rounded-xl card-gradient" style={{ opacity: 0.7 }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--tg-text-color)' }}>
                    {item.filename}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--tg-hint-color)' }}>
                    ⏳ Wartet auf Download-Slot
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => control(item.nzo_id, 'cancel')}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--tg-secondary-bg-color)' }}
                  >
                    <X size={14} style={{ color: 'var(--tg-destructive-text-color)' }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Downloads */}
      {queue && queue.active.filter(i => i.percentage > 0 || i.mb > 0).length > 0 && (
        <div className="space-y-3 mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--tg-hint-color)' }}>
            Aktiv ({queue.active.filter(i => i.percentage > 0 || i.mb > 0).length})
          </h2>
          {queue.active.filter(i => i.percentage > 0 || i.mb > 0).map((item) => (
            <div key={item.nzo_id} className="p-4 rounded-xl card-gradient">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--tg-text-color)' }}>
                    {item.filename}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--tg-hint-color)' }}>
                    {item.speed} · {item.eta}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--tg-button-color)', color: 'var(--tg-button-text-color)' }}>
                  {item.percentage}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'var(--tg-secondary-bg-color)' }}>
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    width: `${Math.min(item.percentage, 100)}%`,
                    backgroundColor: 'var(--tg-accent-color)',
                  }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--tg-hint-color)' }}>
                  {((item.mb - item.mb_left) / 1024).toFixed(1)} / {(item.mb / 1024).toFixed(1)} GB
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => control(item.nzo_id, 'pause')}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--tg-secondary-bg-color)' }}
                  >
                    <Pause size={14} style={{ color: 'var(--tg-text-color)' }} />
                  </button>
                  <button
                    onClick={() => control(item.nzo_id, 'cancel')}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--tg-secondary-bg-color)' }}
                  >
                    <X size={14} style={{ color: 'var(--tg-destructive-text-color)' }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paused Downloads */}
      {queue && queue.paused.length > 0 && (
        <div className="space-y-3 mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--tg-hint-color)' }}>
            Pausiert ({queue.paused.length})
          </h2>
          {queue.paused.map((item) => (
            <div key={item.nzo_id} className="p-4 rounded-xl card-gradient" style={{ opacity: 0.7 }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--tg-text-color)' }}>
                    {item.filename}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--tg-hint-color)' }}>
                    ⏸️ Pausiert · {(item.mb / 1024).toFixed(1)} GB
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => control(item.nzo_id, 'resume')}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--tg-secondary-bg-color)' }}
                  >
                    <Play size={14} style={{ color: 'var(--tg-accent-color)' }} />
                  </button>
                  <button
                    onClick={() => control(item.nzo_id, 'cancel')}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--tg-secondary-bg-color)' }}
                  >
                    <X size={14} style={{ color: 'var(--tg-destructive-text-color)' }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && (!queue || (queue.active.length === 0 && queue.paused.length === 0)) && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--tg-text-color)' }}>Queue ist leer</p>
          <p className="text-xs" style={{ color: 'var(--tg-hint-color)' }}>
            Gestartete Downloads erscheinen hier
          </p>
        </div>
      )}

      {/* Stats Bar */}
      {queue && (queue.active.length > 0 || queue.paused.length > 0) && (
        <div className="p-4 rounded-xl card-gradient flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={16} style={{ color: 'var(--tg-hint-color)' }} />
            <span className="text-sm" style={{ color: 'var(--tg-text-color)' }}>
              {queue.total_size}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} style={{ color: 'var(--tg-hint-color)' }} />
            <span className="text-sm" style={{ color: 'var(--tg-text-color)' }}>
              {queue.eta}
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--tg-hint-color)' }}>
            {queue.speed}
          </span>
        </div>
      )}
    </motion.div>
  );
}