import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { CodeWorkspace } from './workspaces/CodeWorkspace';
import { PatchWorkspace } from './workspaces/PatchWorkspace';
import { LibraryWorkspace } from './workspaces/LibraryWorkspace';
import { SettingsPage } from './workspaces/SettingsPage';
import { UiShowcase } from './dev/UiShowcase';
import { AudioTest } from './dev/AudioTest';
import { LlmTest } from './dev/LlmTest';
import { PySimTest } from './dev/PySimTest';
import { BoardStatus } from './board/BoardStatus';
import { TracebackPanel } from './board/TracebackPanel';
import { Toaster } from './patch/Toaster';
import { usePatchPersistence } from './patch/persistence';

const tabs = [
  { to: '/patch', label: 'Patch' },
  { to: '/code', label: 'Code' },
  { to: '/library', label: 'Library' },
  { to: '/settings', label: 'Settings' },
];

export function App() {
  usePatchPersistence();
  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">AmyPatch Studio</span>
        <nav className="tabs">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <BoardStatus />
          <label className="master-volume">
            <span aria-hidden="true">Vol</span>
            <input
              type="range"
              aria-label="Master volume"
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.8}
            />
          </label>
        </div>
      </header>
      <main className="workspace">
        <TracebackPanel />
        <Toaster />
        <Routes>
          <Route path="/" element={<Navigate to="/patch" replace />} />
          <Route path="/patch" element={<PatchWorkspace />} />
          <Route path="/code" element={<CodeWorkspace />} />
          <Route path="/library" element={<LibraryWorkspace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dev/ui" element={<UiShowcase />} />
          <Route path="/dev/audio" element={<AudioTest />} />
          <Route path="/dev/llm" element={<LlmTest />} />
          <Route path="/dev/pysim" element={<PySimTest />} />
        </Routes>
      </main>
    </div>
  );
}
