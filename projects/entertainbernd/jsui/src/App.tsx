import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Search, List, Heart, Settings } from 'lucide-react';
import SearchPage from './pages/SearchPage';
import DetailPage from './pages/DetailPage';
import QueuePage from './pages/QueuePage';
import SettingsPage from './pages/SettingsPage';
import HistoryPage from './pages/HistoryPage';
import WatchlistPage from './pages/WatchlistPage';
import { AuthProvider, useAuth } from './hooks/useTelegram';

const TABS = [
  { path: '/', icon: Search, label: 'Search' },
  { path: '/queue', icon: List, label: 'Queue' },
  { path: '/watchlist', icon: Heart, label: 'Watch' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<{ hasTG: boolean; hasInitData: boolean; version: string } | null>(null);

  useEffect(() => {
    const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    setDebugInfo({
      hasTG: !!tg,
      hasInitData: !!tg?.initData,
      version: tg?.version || '-',
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--tg-bg-color)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--tg-accent-color)', borderTopColor: 'transparent' }} />
          <span className="text-sm" style={{ color: 'var(--tg-hint-color)' }}>Lade...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8" style={{ backgroundColor: 'var(--tg-bg-color)' }}>
        <div className="text-center">
          <div className="text-4xl mb-4">🦞</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--tg-text-color)' }}>EntertainBernd</h1>
          <p className="text-sm" style={{ color: 'var(--tg-hint-color)' }}>Diese App läuft innerhalb von Telegram.</p>
          {debugInfo && (
            <div className="mt-4 text-xs opacity-50" style={{ color: 'var(--tg-hint-color)' }}>
              <p>Telegram: {debugInfo.hasTG ? '✅' : '❌'}</p>
              <p>initData: {debugInfo.hasInitData ? '✅' : '❌'}</p>
              <p>Version: {debugInfo.version}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--tg-bg-color)' }}>
      <main className="flex-1 overflow-y-auto pb-16 safe-top">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<SearchPage />} />
            <Route path="/detail/:id" element={<DetailPage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
        style={{ backgroundColor: 'var(--tg-bottom-bar-bg-color, var(--tg-secondary-bg-color))' }}
      >
        <div className="flex items-center justify-around h-14">
          {TABS.map((tab) => {
            const isActive = location.pathname === tab.path;
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors"
                style={{ color: isActive ? 'var(--tg-accent-color)' : 'var(--tg-hint-color)' }}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}