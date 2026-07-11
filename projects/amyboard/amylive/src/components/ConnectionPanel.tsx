import { Plug, PlugZap, Loader } from 'lucide-react'
import { useConnectionStore } from '../stores/connection-store'

export function ConnectionPanel() {
  const { state, deviceName, firmwareVersion, error, connect, disconnect } = useConnectionStore()

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Plug size={16} className="text-[var(--color-text-muted)]" />
          AMYboard
        </h3>
        {state === 'connected' && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--color-success)] connected-glow" />
            <span className="text-xs text-[var(--color-success)]">Connected</span>
          </div>
        )}
      </div>

      {state === 'error' && error && (
        <div className="text-xs text-[var(--color-error)] mb-2 p-2 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      {state === 'connected' ? (
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-dim)]">Device</span>
            <span className="font-mono">{deviceName}</span>
          </div>
          {firmwareVersion && (
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-dim)]">Firmware</span>
              <span className="font-mono text-[var(--color-primary)]">{firmwareVersion}</span>
            </div>
          )}
        </div>
      ) : null}

      {state === 'connecting' ? (
        <button disabled className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-dim)] text-sm flex items-center justify-center gap-2 cursor-not-allowed">
          <Loader size={14} className="animate-spin" />
          Verbinde...
        </button>
      ) : state === 'connected' ? (
        <button
          onClick={disconnect}
          className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] hover:bg-red-500/20 text-[var(--color-text-dim)] hover:text-[var(--color-error)] text-sm transition-colors flex items-center justify-center gap-2"
        >
          <PlugZap size={14} />
          Disconnect
        </button>
      ) : (
        <button
          onClick={() => connect()}
          className="w-full py-2 px-4 rounded-lg bg-[var(--color-primary-dim)] hover:bg-[var(--color-primary)] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Plug size={14} />
          Connect AMYboard
        </button>
      )}

      {state === 'disconnected' && (
        <p className="text-[10px] text-[var(--color-text-muted)] mt-2 text-center">
          AMYboard via USB-C verbinden und Chrome/Edge nutzen
        </p>
      )}
    </div>
  )
}