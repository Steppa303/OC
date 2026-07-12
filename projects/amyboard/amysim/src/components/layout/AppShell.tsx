import type { ReactNode } from 'react';
import type { NavTab } from '../../lib/types';
import BottomNav from './BottomNav';

interface AppShellProps {
  children: ReactNode;
  toolbar: ReactNode;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export default function AppShell({ children, toolbar, activeTab, onTabChange }: AppShellProps) {
  return (
    <div className="flex flex-col h-full w-full bg-[var(--color-bg)]">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-3 py-2 bg-[#0d0d0d] border-b border-[#222]"
              style={{ minHeight: 48 }}>
        {toolbar}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2 scroll-smooth">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}