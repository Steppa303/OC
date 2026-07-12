import { useState } from 'react';
import { usePresetStore } from './amy/presets/presetStore';
import { useAMY } from './amy/AMYProvider';
import { amySend } from './amy/wireMessage';
import AppShell from './components/layout/AppShell';
import OscillatorSection from './components/synth/OscillatorSection';
import FilterSection from './components/synth/FilterSection';
import MiniKeyboard from './components/keyboard/MiniKeyboard';
import type { NavTab, ParamCategory } from './lib/types';

function ParamCategoryTabs({ active, onChange }: { active: ParamCategory; onChange: (c: ParamCategory) => void }) {
  const cats: { id: ParamCategory; label: string }[] = [
    { id: 'osc', label: 'Osc' },
    { id: 'filter', label: 'Filter' },
    { id: 'env', label: 'Env' },
    { id: 'lfo', label: 'LFO' },
    { id: 'effects', label: 'FX' },
  ];
  return (
    <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-none">
      {cats.map(c => (
        <button key={c.id}
          onClick={() => onChange(c.id)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all touch-target ${
            active === c.id
              ? 'bg-[var(--color-accent-cyan)] text-black'
              : 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)] border border-[#333]'
          }`}
          style={{ minHeight: 36 }}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

function SynthPanel({ activeCat }: { activeCat: ParamCategory }) {
  const volume = usePresetStore((s: any) => s.currentPatch.volume);
  const updatePatch = usePresetStore((s: any) => s.updatePatch);
  const ready = useAMY().ready;

  const handleVolume = (v: number) => {
    updatePatch({ volume: v });
    if (ready) amySend({ volume: v });
  };

  return (
    <div className="space-y-4">
      {/* Volume */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-[var(--color-text-dim)] font-medium uppercase tracking-wider">Volume</span>
          <span className="text-sm font-mono text-[var(--color-accent-green)]">
            {Math.round(volume * 100)}%
          </span>
        </div>
        <input type="range" value={volume} min={0} max={1} step={0.01}
          onChange={e => handleVolume(parseFloat(e.target.value))}
          className="w-full" style={{ accentColor: 'var(--color-accent-green)' }} />
      </div>

      {activeCat === 'osc' && <OscillatorSection />}
      {activeCat === 'filter' && <FilterSection />}
      {activeCat === 'env' && (
        <div className="text-[var(--color-text-dim)] text-sm text-center py-8">
          Envelope Editor coming soon™
        </div>
      )}
      {activeCat === 'lfo' && (
        <div className="text-[var(--color-text-dim)] text-sm text-center py-8">
          LFO coming soon™
        </div>
      )}
      {activeCat === 'effects' && (
        <div className="text-[var(--color-text-dim)] text-sm text-center py-8">
          Effects coming soon™
        </div>
      )}
    </div>
  );
}

function PresetDropdown() {
  const presets = usePresetStore((s: any) => s.presets);
  const loadPreset = usePresetStore((s: any) => s.loadPreset);

  return (
    <select
      onChange={e => {
        if (e.target.value) loadPreset(e.target.value);
      }}
      className="bg-[var(--color-surface-2)] text-xs text-[var(--color-text)] border border-[#333] rounded px-2 py-1 max-w-[140px] touch-target"
    >
      <option value="">Default</option>
      {presets.map((p: any) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

export default function App() {
  const { ready, error, start } = useAMY();
  const [activeTab, setActiveTab] = useState<NavTab>('synth');
  const [activeCat, setActiveCat] = useState<ParamCategory>('osc');
  const savePreset = usePresetStore((s: any) => s.savePreset);
  const [presetName, setPresetName] = useState('');

  // Play Test Note
  const playTestNote = () => {
    if (!ready) return;
    const note = 60; // Middle C
    amySend({ osc: 0, note, vel: 0.8 });
    setTimeout(() => amySend({ osc: 0, note, vel: 0 }), 500);
  };

  // --- NOT READY → Start-Overlay ---
  if (!ready && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--color-bg)] px-6 text-center">
        <div className="text-6xl mb-6">🎹</div>
        <h1 className="text-2xl font-bold mb-2 text-white">amysim</h1>
        <p className="text-sm text-[var(--color-text-dim)] mb-8">
          AMYboard Patch-Simulator
        </p>
        <button onClick={start}
          className="px-8 py-4 rounded-xl bg-[var(--color-accent-cyan)] text-black font-bold text-lg
                     shadow-[0_0_20px_var(--color-accent-cyan)] active:scale-95 transition-transform touch-target">
          🎵 Click to Start
        </button>
        <p className="text-xs text-[var(--color-text-dim)] mt-4">
          Initialisiert Audio + AMY Synthesizer
        </p>
      </div>
    );
  }

  // --- ERROR ---
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--color-bg)] px-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-[var(--color-accent-red)] mb-2">Init Failed</h2>
        <p className="text-sm text-[var(--color-text-dim)] mb-4">{error}</p>
        <button onClick={start}
          className="px-6 py-3 rounded-lg bg-[var(--color-surface-2)] text-white border border-[#333] touch-target">
          Retry
        </button>
      </div>
    );
  }

  // --- Toolbar ---
  const toolbar = (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white">amysim</span>
        <PresetDropdown />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={playTestNote}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-accent-cyan)] text-black text-xs font-bold
                     shadow-[0_0_10px_var(--color-accent-cyan)] active:scale-95 transition-transform touch-target"
          style={{ minHeight: 36 }}>
          🔊 Play
        </button>
        <button onClick={() => {
          const name = presetName || `Patch ${Date.now()}`;
          savePreset(name);
          setPresetName('');
        }}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-xs text-[var(--color-text-dim)]
                     border border-[#333] touch-target"
          style={{ minHeight: 36 }}>
          💾
        </button>
      </div>
    </>
  );

  // --- Main Content per Tab ---
  const renderContent = () => {
    switch (activeTab) {
      case 'synth':
        return (
          <>
            <ParamCategoryTabs active={activeCat} onChange={setActiveCat} />
            <SynthPanel activeCat={activeCat} />
          </>
        );
      case 'keyboard':
        return (
          <div className="pt-4">
            <MiniKeyboard />
          </div>
        );
      case 'cv':
        return (
          <div className="flex items-center justify-center h-full text-[var(--color-text-dim)] text-sm">
            CV Simulation coming soon™
          </div>
        );
      case 'sequencer':
        return (
          <div className="flex items-center justify-center h-full text-[var(--color-text-dim)] text-sm">
            Step Sequencer coming soon™
          </div>
        );
      case 'monitor':
        return (
          <div className="flex items-center justify-center h-full text-[var(--color-text-dim)] text-sm">
            Wire Message Monitor coming soon™
          </div>
        );
    }
  };

  return (
    <AppShell
      toolbar={toolbar}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {renderContent()}
    </AppShell>
  );
}