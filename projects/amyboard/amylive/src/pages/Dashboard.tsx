// ─── Dashboard — Connect & Go ────────────────────────────────────────
// Radikal entschlackt: Nur Connect-Status, Recent Patches, Start Button.
// Alles andere → Live Board.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plug, Music, ChevronRight, Clock, Loader } from 'lucide-react'
import { useConnectionStore } from '../stores/connection-store'
import { usePatchStore } from '../stores/patch-store'
import { useLogStore } from '../stores/log-store'
import { LogPanel } from '../components/LogPanel'
import { MidiUnavailableBanner } from '../components/Sidebar'

export function Dashboard() {
  const navigate = useNavigate()
  const { state, deviceName, connect, disconnect } = useConnectionStore()
  const { patches } = usePatchStore()
  const log = useLogStore.getState()
  const connected = state === 'connected'

  // Recent Patches (last 5)
  const recentPatches = [...patches].reverse().slice(0, 5)

  // No auto-navigate anymore — user stays on Dashboard to see Log, etc.
  // User navigates to /live manually via "Start Live Session" button.

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Title */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--color-primary-dim)]/20 flex items-center justify-center">
            <Music size={32} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="text-xl font-bold">AMYlive</h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            AMYboard Live Control
          </p>
        </div>

        {/* Connect Card */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 space-y-4">
          {state === 'connecting' ? (
            <div className="text-center space-y-3">
              <Loader size={20} className="mx-auto text-[var(--color-primary)] animate-spin" />
              <p className="text-sm text-[var(--color-text-muted)]">Connecting to AMYboard…</p>
            </div>
          ) : connected ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500 connected-glow" />
                <span className="text-sm font-semibold text-green-500">Connected</span>
              </div>
              <div className="bg-[var(--color-surface-hover)] rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-dim)]">Device</span>
                  <span className="font-mono">{deviceName}</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/live')}
                className="w-full py-3 px-4 rounded-xl bg-[var(--color-primary-dim)] hover:bg-[var(--color-primary)] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                Start Live Session
                <ChevronRight size={16} />
              </button>
              <button
                onClick={disconnect}
                className="w-full py-2 px-4 rounded-xl bg-[var(--color-surface-hover)] hover:bg-red-500/20 text-[var(--color-text-dim)] hover:text-[var(--color-error)] text-xs transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)]">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-sm">Not connected</span>
              </div>
              <button
                onClick={() => {
                  log.log('connection', 'Connecting to AMYboard…')
                  connect()
                }}
                className="w-full py-3 px-4 rounded-xl bg-[var(--color-primary-dim)] hover:bg-[var(--color-primary)] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plug size={16} />
                Connect AMYboard
              </button>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                USB-C verbinden und Chrome/Edge nutzen
              </p>
            </div>
          )}
        </div>

        {/* Recent Patches */}
        {recentPatches.length > 0 && (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Clock size={12} />
              <span className="font-semibold">Recent Patches</span>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
              {recentPatches.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate('/patches')}
                  className="shrink-0 px-3 py-2 rounded-xl bg-[var(--color-surface-hover)] hover:bg-[var(--color-primary-dim)]/20 border border-[var(--color-border)] transition-colors text-left min-w-[100px]"
                >
                  <div className="text-[11px] font-medium truncate max-w-[100px]">{p.name}</div>
                  <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{p.category}</div>
                </button>
              ))}
              <button
                onClick={() => navigate('/patches')}
                className="shrink-0 px-3 py-2 rounded-xl bg-[var(--color-surface-hover)] hover:bg-[var(--color-primary-dim)]/20 border border-[var(--color-border)] border-dashed transition-colors flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]"
              >
                View all
                <ChevronRight size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => navigate('/patches')}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-hover)] text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Patch Library
          </button>
          <button
            onClick={() => navigate('/live')}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-hover)] text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Live Editor
          </button>
        </div>

        {/* Log (minimiert) */}
        <div className="opacity-50 hover:opacity-100 transition-opacity">
          <LogPanel />
        </div>
      </div>
    </div>
  )
}