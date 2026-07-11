import { useConnectionStore } from '../stores/connection-store'
import { ConnectionPanel } from './ConnectionPanel'

export function MidiUnavailableBanner() {
  const midiAvailable = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator

  if (midiAvailable) return null

  return (
    <div className="midi-unavailable">
      ⚠️ WebMIDI in diesem Browser nicht verfügbar. Bitte <strong>Chrome</strong> oder <strong>Edge</strong> verwenden.
    </div>
  )
}

export function Sidebar() {
  const { state } = useConnectionStore()

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-4">
      <ConnectionPanel />

      {state === 'connected' && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Quick Actions</h3>
          <button className="w-full py-2 px-3 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-primary-dim)]/20 text-sm text-left transition-colors flex items-center gap-2">
            <span>📥</span> Load from Board
          </button>
          <button className="w-full py-2 px-3 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-primary-dim)]/20 text-sm text-left transition-colors flex items-center gap-2">
            <span>📤</span> Save to Board
          </button>
          <button className="w-full py-2 px-3 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-primary-dim)]/20 text-sm text-left transition-colors flex items-center gap-2">
            <span>🔄</span> Reboot Board
          </button>
          <button className="w-full py-2 px-3 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-primary-dim)]/20 text-sm text-left transition-colors flex items-center gap-2">
            <span>📋</span> Dump State
          </button>
        </div>
      )}
    </aside>
  )
}