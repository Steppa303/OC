import { Plus, Layout, Save, Download, Radio } from 'lucide-react'
import { useCanvasStore } from '../stores/canvas-store'
import { useConnectionStore } from '../stores/connection-store'
import { useLogStore } from '../stores/log-store'
import { Sidebar } from '../components/Sidebar'
import { LogPanel } from '../components/LogPanel'
import { moduleRegistry } from '../modules'
import { getPatchName } from '../lib/amy-patches'

export function Dashboard() {
  const { modules, selectedId, addModule, removeModule, selectModule, clear } = useCanvasStore()
  const { state } = useConnectionStore()
  const connected = state === 'connected'

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 min-h-screen">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Canvas */}
      <div className="flex-1 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">Amylive</h1>
            <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-0.5 rounded-full">
              {modules.length} module{modules.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Add Module Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 py-2 px-3 rounded-lg bg-[var(--color-primary-dim)] hover:bg-[var(--color-primary)] text-white text-xs font-medium transition-colors">
                <Plus size={14} />
                Modul
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-1">
                  {moduleRegistry.list().map(mod => {
                    const Icon = moduleRegistry.getIcon(mod.id)
                    return (
                      <button
                        key={mod.id}
                        onClick={() => {
                          const log = useLogStore.getState()
                          log.log('user', `Added module: ${mod.name}`)
                          addModule(mod.id, 0, 0, 280, 200, mod.defaults)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-left"
                      >
                        <Icon size={14} className="text-[var(--color-primary)]" />
                        <span>{mod.name}</span>
                        <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">{mod.category}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                useLogStore.getState().log('user', `Cleared ${modules.length} modules`)
                clear()
              }}
              className="py-2 px-3 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-dim)] border border-[var(--color-border)] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Module Grid */}
        {modules.length === 0 ? (
          <div className="module-canvas rounded-xl border border-dashed border-[var(--color-border)] flex items-center justify-center" style={{ minHeight: '40vh' }}>
            <div className="text-center space-y-2">
              <Layout size={32} className="mx-auto text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-dim)]">Noch keine Module</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                Klick auf <strong>+ Modul</strong> um einen Oszillator, Filter oder Envelope hinzuzufügen
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {modules.map(m => {
              const modDef = moduleRegistry.get(m.moduleType)
              if (!modDef) return null
              const ModuleComponent = modDef.component

              return (
                <div
                  key={m.id}
                  className={selectedId === m.id ? 'module-selected' : ''}
                  onClick={() => selectModule(m.id)}
                >
                  <ModuleComponent
                    id={m.id}
                    params={m.params}
                    onParamChange={(key, value) => {
                      useLogStore.getState().log('wire', `Param ${key} = ${value}`, `${m.moduleType}#${m.id}`)
                      useCanvasStore.getState().updateParams(m.id, { [key]: value })
                    }}
                    onSendWire={(wire) => {
                      useLogStore.getState().log('wire', wire, m.moduleType + '#' + m.id)
                      console.log('Wire:', wire)
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3">
          <div className="flex items-center gap-3">
            <span>
              {connected ? '🟢 AMYboard connected' : '🔴 disconnected'}
            </span>
            <span className="text-[var(--color-text-dim)]">|</span>
            {(() => {
              const synthModule = modules.find(m => m.moduleType === 'synth')
              const patchNum = synthModule?.params?.patch
              if (patchNum !== undefined) {
                // Import directly for cleaner code, but for the status bar we keep inline
                const name = getPatchName(patchNum)
                return (
                  <span className="flex items-center gap-1">
                    <Radio size={10} className="text-[var(--color-primary)]" />
                    {name}
                    <span className="text-[8px] font-mono">(#{patchNum})</span>
                  </span>
                )
              }
              return null
            })()}
          </div>
          <div className="flex items-center gap-3">
            <button className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1">
              <Save size={12} /> Save Patch
            </button>
            <button className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1">
              <Download size={12} /> Load from Board
            </button>
          </div>
        </div>

        {/* Event Log */}
        <LogPanel />
      </div>
    </div>
  )
}