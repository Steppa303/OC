import type { NavTab } from '../../lib/types';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const tabs: { id: NavTab; label: string; icon: string }[] = [
  { id: 'synth', label: 'Synth', icon: '🔊' },
  { id: 'keyboard', label: 'Keys', icon: '🎹' },
  { id: 'cv', label: 'CV', icon: '⚡' },
  { id: 'sequencer', label: 'Seq', icon: '🎛' },
  { id: 'monitor', label: 'Mon', icon: '📡' },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="flex items-center justify-around bg-[#0d0d0d] border-t border-[#222] safe-area-bottom"
         style={{ minHeight: 56, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors touch-target ${
            activeTab === tab.id
              ? 'text-[var(--color-accent-cyan)]'
              : 'text-[var(--color-text-dim)]'
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span className="text-[10px] font-medium tracking-wider uppercase">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}