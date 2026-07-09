import { motion } from 'framer-motion';
import { useConfig } from '../hooks/useSearch';
import { safeHapticFeedback } from '../hooks/telegram';

const MEDIA_OPTIONS = [
  { key: 'film', label: '🎬 Film' },
  { key: 'serie', label: '📺 Serie' },
  { key: 'audio', label: '🎵 Audio' },
  { key: 'buch', label: '📚 Buch' },
  { key: 'game', label: '🎮 Game' },
  { key: 'all', label: '📦 Alles' },
];

const LANG_OPTIONS = [
  { key: null as string | null, label: '🌐 Alle' },
  { key: 'de', label: '🇩🇪 Deutsch' },
  { key: 'en', label: '🇬🇧 Englisch' },
];

const SOURCE_OPTIONS = [
  { key: null as string | null, label: '🔀 Beide' },
  { key: 'geek', label: '🌐 NZBGeek' },
  { key: 'hydra', label: '🔧 NZBHydra2' },
];

export default function SettingsPage() {
  const { mediaType, setMediaType, language, setLanguage, source, setSource } = useConfig();
  const haptic = safeHapticFeedback();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 pt-4"
    >
      <h1 className="text-lg font-bold mb-6" style={{ color: 'var(--tg-text-color)' }}>⚙️ Einstellungen</h1>

      <PillSection title="Medientyp (Standard)">
        {MEDIA_OPTIONS.map((opt) => (
          <PillButton
            key={opt.key}
            active={mediaType === opt.key}
            onClick={() => { haptic?.impactOccurred('light'); setMediaType(opt.key); }}
          >
            {opt.label}
          </PillButton>
        ))}
      </PillSection>

      <PillSection title="Sprache (Standard)">
        {LANG_OPTIONS.map((opt) => (
          <PillButton
            key={String(opt.key)}
            active={language === opt.key}
            onClick={() => { haptic?.impactOccurred('light'); setLanguage(opt.key); }}
          >
            {opt.label}
          </PillButton>
        ))}
      </PillSection>

      <PillSection title="Quelle (Standard)">
        {SOURCE_OPTIONS.map((opt) => (
          <PillButton
            key={String(opt.key)}
            active={source === opt.key}
            onClick={() => { haptic?.impactOccurred('light'); setSource(opt.key); }}
          >
            {opt.label}
          </PillButton>
        ))}
      </PillSection>

      <div className="mt-8 p-4 rounded-xl card-gradient">
        <p className="text-xs" style={{ color: 'var(--tg-hint-color)' }}>
          🤖 EntertainBernd v2.0 · Powered by Usenet
        </p>
      </div>
    </motion.div>
  );
}

function PillSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint-color)' }}>
        {title}
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {children}
      </div>
    </div>
  );
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{
        backgroundColor: active ? 'var(--tg-button-color)' : 'var(--tg-secondary-bg-color)',
        color: active ? 'var(--tg-button-text-color)' : 'var(--tg-text-color)',
      }}
    >
      {children}
    </button>
  );
}