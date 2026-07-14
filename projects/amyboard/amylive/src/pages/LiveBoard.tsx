// ─── AMYlive Live Board — Der Haupteditor ─────────────────────────────
// Vollbild-Patch-Editor mit Signal Chain, Keyboard Flyout, Multi-Synth.
// Board anschließen → Auto-Load → Bearbeiten → Auto-Save.

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Download, Upload, ChevronLeft,
  GripVertical, Music, Undo2, AlertCircle, Loader, Radio,
  WifiOff, RefreshCw,
} from 'lucide-react'
import { useCanvasStore } from '../stores/canvas-store'
import { useConnectionStore } from '../stores/connection-store'
import { usePatchStore } from '../stores/patch-store'
import { useChainStore } from '../stores/chain-store'
import { useLogStore } from '../stores/log-store'
import { moduleRegistry } from '../modules'
import { applyPatchToCanvas } from '../engine/patch-applier'
import { canvasToPatch } from '../engine/patch-from-canvas'
import { loadPatchFromBoard, factoryPatchFromNumber } from '../engine/patch-from-board'
import { getPatchName } from '../lib/amy-patches'
import { amyConnection } from '../lib/amy-connection'
import { KeyboardFlyout } from '../components/KeyboardFlyout'
import { AddModuleSheet } from '../components/AddModuleSheet'
import { PatchSelectorSheet } from '../components/PatchSelectorSheet'
import type { AmyPatch, CanvasModule } from '../types/amy'

// ─── Types ────────────────────────────────────────────────────────────
type ViewState = 'loading' | 'ready' | 'error' | 'empty'

// ─── AMY Wire → Python Bridge ────────────────────────────────────────
const WIRE_CODES: Record<string, string> = {
  v:'osc', w:'wave', f:'freq', a:'amp', d:'duty', Q:'pan', y:'bus',
  F:'filter_freq', G:'filter_type', R:'resonance', b:'feedback',
  A:'bp0', B:'bp1', T:'eg0_type', X:'eg1_type', L:'mod_source',
  i:'synth', K:'patch', n:'note', l:'vel', m:'portamento',
  c:'chained_osc', P:'phase', S:'reset',
  h:'reverb', j:'chorus', k:'echo', V:'volume',
}

function sendWireMessage(wire: string): void {
  if (amyConnection.state !== 'connected') return
  const log = useLogStore.getState()
  const clean = wire.replace(/Z$/, '').trim()
  const result: Record<string, string> = {}
  let i = 0
  while (i < clean.length) {
    const c = clean[i]
    if (!(c in WIRE_CODES)) { i++; continue }
    const pyKey = WIRE_CODES[c]
    i++
    const valStart = i
    while (i < clean.length) {
      const ch = clean[i]
      if (i > valStart && ch !== '.' && ch !== ',' && ch !== 'e' && ch !== 'E' && ch !== '-' && ch !== '+') {
        if (ch in WIRE_CODES) break
      }
      i++
    }
    const val = clean.slice(valStart, i)
    if (val) result[pyKey] = val
  }
  if (Object.keys(result).length === 0) { log.log('error', `Leeres Wire-Format: ${wire}`); return }
  if (result.synth && result.patch && !result.num_voices) result.num_voices = '6'
  const pyArgs = Object.entries(result).map(([k, v]) => {
    if (k === 'bp0' || k === 'bp1') return `${k}='${v}'`
    if (k === 'vel' && !v.includes('.') && !v.includes(',')) {
      const num = parseInt(v, 10)
      if (!isNaN(num) && num > 1) return `vel=${(num / 127).toFixed(3)}`
    }
    return `${k}=${v}`
  }).join(', ')
  const py = `amy.send(${pyArgs})`
  log.log('wire', py, wire)
  amyConnection.runPython(py)
}

// ─── Signal Chain Arrow ──────────────────────────────────────────────
function ChainArrow() {
  return (
    <div className="flex items-center shrink-0 px-1">
      <svg width="24" height="24" viewBox="0 0 24 24" className="text-[var(--color-primary)]/40">
        <path d="M3 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ─── Compact Module Card ─────────────────────────────────────────────
function CompactModuleCard({
  mod, expandedId, onToggleExpand, onRemove, onDragStart,
}: {
  mod: CanvasModule
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onRemove: (id: string) => void
  onDragStart: (e: React.DragEvent, id: string) => void
}) {
  const isExpanded = expandedId === mod.id
  const modDef = moduleRegistry.get(mod.moduleType)
  const Icon = modDef ? moduleRegistry.getIcon(mod.id) : Music
  const label = mod.moduleType === 'oscillator' ? `OSC ${mod.params.osc ?? 0}`
    : mod.moduleType === 'filter' ? `FLTR ${mod.params.osc ?? 0}`
    : mod.moduleType === 'envelope' ? `ENV ${mod.params.egId ?? 0}`
    : mod.moduleType === 'lfo' ? `LFO ${mod.params.lfoId ?? 0}`
    : mod.moduleType === 'synth' ? `SYNTH ${mod.params.synth ?? 0}`
    : `${mod.moduleType.charAt(0).toUpperCase() + mod.moduleType.slice(1)}`

  const summary = mod.moduleType === 'oscillator'
    ? `${['SIN','PLS','SAW▼','SAW▲','TRI','NOI','KS','FM'][mod.params.wave ?? 0] ?? '?'} · ${Math.round(mod.params.freq ?? 440)}Hz`
    : mod.moduleType === 'filter'
    ? `${['—','LPF','BPF','HPF','2PL'][mod.params.filter_type ?? 1]} · ${Math.round((mod.params.cutoff ?? 8000) / 1000)}kHz`
    : mod.moduleType === 'envelope'
    ? `A:${mod.params.attack ?? 100} D:${mod.params.decay ?? 200} S:${(mod.params.sustain ?? 0.5).toFixed(2)} R:${mod.params.release ?? 300}`
    : mod.moduleType === 'lfo'
    ? `${(mod.params.freq ?? 1).toFixed(1)}Hz`
    : mod.moduleType === 'synth'
    ? `#${mod.params.patch ?? 0} · ${mod.params.num_voices ?? 6} voices`
    : ''

  const colorClass = mod.moduleType === 'oscillator' ? 'border-blue-500/30 bg-blue-500/5'
    : mod.moduleType === 'filter' ? 'border-purple-500/30 bg-purple-500/5'
    : mod.moduleType === 'envelope' ? 'border-green-500/30 bg-green-500/5'
    : mod.moduleType === 'lfo' ? 'border-amber-500/30 bg-amber-500/5'
    : mod.moduleType === 'synth' ? 'border-rose-500/30 bg-rose-500/5'
    : 'border-[var(--color-border)] bg-[var(--color-surface)]'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      className={`
        relative shrink-0 rounded-xl border transition-all cursor-pointer select-none
        ${isExpanded ? 'w-[320px] sm:w-[400px] min-h-[300px] z-10 shadow-xl' : 'w-[160px] min-h-[100px] hover:shadow-md'}
        ${colorClass}
      `}
      onClick={() => !isExpanded && onToggleExpand(mod.id)}
    >
      {/* Drag Handle */}
      <div
        className="absolute top-1 left-1 text-[var(--color-text-muted)] opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, mod.id)}
      >
        <GripVertical size={12} />
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(mod.id) }}
        className="absolute top-1 right-1 p-0.5 rounded text-[var(--color-text-muted)] opacity-0 hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
      >
        <X size={12} />
      </button>

      {isExpanded ? (
        <div className="h-full overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <Icon size={14} className="text-[var(--color-primary)]" />
            <span className="text-xs font-semibold">{label}</span>
            <button
              onClick={() => onToggleExpand(mod.id)}
              className="ml-auto text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 py-0.5 rounded bg-[var(--color-surface-hover)]"
            >
              Collapse
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {(() => {
              const CardComponent = moduleRegistry.getCard(mod.moduleType)
              if (!CardComponent) {
                const ModComponent = modDef?.component
                if (!ModComponent) return <div className="p-3 text-xs text-red-400">Unknown module</div>
                return (
                  <ModComponent
                    id={mod.id}
                    params={mod.params}
                    onParamChange={(key, value) => {
                      useLogStore.getState().log('wire', `Param ${key} = ${value}`, `${mod.moduleType}#${mod.id}`)
                      useCanvasStore.getState().updateParams(mod.id, { [key]: value })
                    }}
                    onSendWire={(wire) => {
                      useLogStore.getState().log('wire', wire, mod.moduleType + '#' + mod.id)
                      sendWireMessage(wire)
                    }}
                  />
                )
              }
              const moduleIndex = useCanvasStore.getState().modules.findIndex(m => m.id === mod.id)
              const totalCards = useCanvasStore.getState().modules.length
              return (
                <CardComponent
                  id={mod.id}
                  params={mod.params}
                  cardIndex={moduleIndex}
                  totalCards={totalCards}
                  onParamChange={(key, value) => {
                    useLogStore.getState().log('wire', `Param ${key} = ${value}`, `${mod.moduleType}#${mod.id}`)
                    useCanvasStore.getState().updateParams(mod.id, { [key]: value })
                  }}
                  onSendWire={(wire) => {
                    useLogStore.getState().log('wire', wire, mod.moduleType + '#' + mod.id)
                    sendWireMessage(wire)
                  }}
                  chainInfo={{
                    inputs: useChainStore.getState().getLinksForModule(mod.id).inputs.map(l => ({
                      moduleId: l.from.moduleId,
                      output: l.from.output,
                    })),
                    outputs: useChainStore.getState().getLinksForModule(mod.id).outputs.map(l => ({
                      moduleId: l.to.moduleId,
                      input: l.to.input,
                    })),
                  }}
                />
              )
            })()}
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full p-2.5 pt-5">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon size={12} className="text-[var(--color-primary)]" />
            <span className="text-[11px] font-semibold truncate">{label}</span>
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
            {summary}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Synth Tabs ───────────────────────────────────────────────────────
function SynthTabs({ synths, activeSynth, onSelect, onAdd, onRemove }: {
  synths: number[]; activeSynth: number; onSelect: (s: number) => void; onAdd: () => void; onRemove: (s: number) => void
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
      {synths.map(s => (
        <div key={s} className="relative group">
          <button
            onClick={() => onSelect(s)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors
              ${activeSynth === s ? 'bg-[var(--color-primary-dim)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'}
            `}
          >
            <Radio size={12} />
            Synth {s}
          </button>
          {synths.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(s) }}
              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
            >
              <X size={8} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <Plus size={12} />
        Add
      </button>
    </div>
  )
}

// ─── Undo Toast ───────────────────────────────────────────────────────
function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl text-xs"
    >
      <span className="text-[var(--color-text)]">{message}</span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-primary-dim)] text-white font-medium hover:bg-[var(--color-primary)] transition-colors"
      >
        <Undo2 size={12} />
        Undo
      </button>
    </motion.div>
  )
}

// ─── Live Board Component ─────────────────────────────────────────────
export function LiveBoard() {
  const navigate = useNavigate()
  const { modules, addModule, removeModule, clear } = useCanvasStore()
  const { state: connState, deviceName, connect } = useConnectionStore()
  const connected = connState === 'connected'
  const log = useLogStore.getState()

  const [viewState, setViewState] = useState<ViewState>(connected ? 'loading' : 'empty')
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showPatchSelector, setShowPatchSelector] = useState(false)
  const [synthModules, setSynthModules] = useState<number[]>([0])
  const [activeSynth, setActiveSynth] = useState(0)
  const [undoState, setUndoState] = useState<{ message: string; module: CanvasModule | null } | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [showDisconnected, setShowDisconnected] = useState(false)
  const chainRef = useRef<HTMLDivElement>(null)

  // ── Auto-Load on Connect ────────────────────────────────────────────
  useEffect(() => {
    if (connState === 'connected' && viewState === 'empty') {
      handleLoadFromBoard()
    }
  }, [connState])

  const handleLoadFromBoard = useCallback(async () => {
    setViewState('loading')
    try {
      const patch = await loadPatchFromBoard()
      if (patch) {
        log.log('dump', `Loaded state dump from board (${patch.state.oscillators.length} oscs, ${patch.state.synths.length} synths)`)
        const sendWire = (wire: string) => { if (amyConnection.state === 'connected') sendWireMessage(wire) }
        applyPatchToCanvas(patch, sendWire)
        usePatchStore.getState().addPatch(patch)
        setStatusMsg(`Patch loaded: ${patch.name}`)
        setTimeout(() => setStatusMsg(null), 2000)
        setViewState('ready')
      } else {
        setViewState('empty')
      }
    } catch (err) {
      log.log('error', `Failed to load from board: ${err}`)
      setViewState('empty')
    }
  }, [])

  // ── Auto-Save (debounced) ───────────────────────────────────────────
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!connected || modules.length === 0) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => {
      setStatusMsg('Saved ✓')
      setTimeout(() => setStatusMsg(null), 1500)
    }, 500)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [modules, connected])

  // ── Save to Board ───────────────────────────────────────────────────
  const handleSaveToBoard = useCallback(async () => {
    if (!connected) return
    setStatusMsg('Saving to board…')
    log.log('user', 'Saving patch to board…')
    try {
      const patch = canvasToPatch(modules)
      const sketchCode = `# AMYlive Patch\n# ${patch.name}\n${patch.wireCommands.map(w => `amy.send(${JSON.stringify(w)})`).join('\n')}`
      await amyConnection.uploadSketch(sketchCode)
      log.log('user', 'Patch saved to board successfully')
      setStatusMsg('Saved to board ✓')
      setTimeout(() => setStatusMsg(null), 2000)
    } catch (err) {
      log.log('error', `Save to board failed: ${err}`)
      setStatusMsg('Save failed')
      setTimeout(() => setStatusMsg(null), 2000)
    }
  }, [modules, connected, log])

  // ── Disconnect Handler ──────────────────────────────────────────────
  useEffect(() => {
    if ((connState === 'error' || connState === 'disconnected') && viewState === 'ready') {
      setShowDisconnected(true)
      log.log('error', 'Board disconnected during edit')
    } else {
      setShowDisconnected(false)
    }
  }, [connState, viewState])

  const handleReconnect = useCallback(async () => {
    setShowDisconnected(false)
    log.log('connection', 'Reconnecting…')
    await connect()
  }, [connect, log])

  // ── Add Module ──────────────────────────────────────────────────────
  const handleAddModule = useCallback((moduleType: string) => {
    const defaults = moduleRegistry.getDefaults(moduleType)
    const idx = modules.length
    addModule(moduleType, 0, 0, 280, 200, { ...defaults, osc: idx, synth: activeSynth }, undefined, activeSynth, undefined, idx)
    setShowAddSheet(false)
    log.log('user', `Added module: ${moduleType} (synth ${activeSynth})`)
    setTimeout(() => { if (chainRef.current) chainRef.current.scrollLeft = chainRef.current.scrollWidth }, 50)
  }, [modules.length, activeSynth, addModule, log])

  // ── Remove Module with Undo ─────────────────────────────────────────
  const handleRemoveModule = useCallback((id: string) => {
    const mod = modules.find(m => m.id === id)
    if (!mod) return
    removeModule(id)
    setUndoState({ message: `🗑️ ${mod.moduleType} removed`, module: mod })
  }, [modules, removeModule])

  const handleUndoRemove = useCallback(() => {
    if (!undoState?.module) return
    const mod = undoState.module
    addModule(mod.moduleType, mod.x, mod.y, mod.width, mod.height, mod.params, mod.targetOsc, mod.targetSynth, mod.targetBus, mod.cardIndex)
    setUndoState(null)
  }, [undoState, addModule])

  // ── Drag & Drop Reorder ─────────────────────────────────────────────
  const dragIdRef = useRef<string | null>(null)
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = dragIdRef.current
    if (!sourceId || sourceId === targetId) return
    const { modules: currentModules } = useCanvasStore.getState()
    const sourceIdx = currentModules.findIndex(m => m.id === sourceId)
    const targetIdx = currentModules.findIndex(m => m.id === targetId)
    if (sourceIdx < 0 || targetIdx < 0) return
    const reordered = [...currentModules]
    const [moved] = reordered.splice(sourceIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    useCanvasStore.getState().importModules(reordered)
    dragIdRef.current = null
  }, [])

  // ── Synth Management ────────────────────────────────────────────────
  const handleAddSynth = useCallback(() => {
    const newSynth = synthModules.length
    setSynthModules(prev => [...prev, newSynth])
    setActiveSynth(newSynth)
  }, [synthModules])

  const handleRemoveSynth = useCallback((s: number) => {
    setSynthModules(prev => prev.filter(x => x !== s))
    if (activeSynth === s) setActiveSynth(synthModules.find(x => x !== s) ?? 0)
    const { modules: currentModules, importModules } = useCanvasStore.getState()
    importModules(currentModules.filter(m => m.targetSynth !== s && m.params?.synth !== s))
  }, [activeSynth, synthModules])

  const synthModules_list = modules.filter(m =>
    m.targetSynth === activeSynth || m.params?.synth === activeSynth || m.moduleType === 'chain-view'
  )

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate('/')} className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 connected-glow' : 'bg-gray-500'}`} />
            <span className="text-xs font-medium truncate">{connected ? deviceName : 'Not connected'}</span>
          </div>
          {(() => {
            const synthModule = modules.find(m => m.moduleType === 'synth')
            const patchNum = synthModule?.params?.patch
            return patchNum !== undefined ? (
              <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:inline">· {getPatchName(patchNum)} (#{patchNum})</span>
            ) : null
          })()}
        </div>
        <div className="flex items-center gap-2">
          {statusMsg && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-[var(--color-success)]">{statusMsg}</motion.span>}
          <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-2 py-0.5 rounded-full">{modules.length} mod</span>
          {connected && (
            <button onClick={handleSaveToBoard} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" title="Save to Board">
              <Upload size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {viewState === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader size={24} className="mx-auto text-[var(--color-primary)] animate-spin" />
            <p className="text-sm text-[var(--color-text-muted)]">Loading patch from board…</p>
            <div className="flex gap-2 justify-center">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-24 h-20 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {viewState === 'empty' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm mx-auto px-4">
            <Music size={40} className="mx-auto text-[var(--color-text-muted)]" />
            <h2 className="text-base font-semibold">No patch loaded</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {connected
                ? 'Board is connected. Load the current state or browse the patch library.'
                : 'Connect your AMYboard to start editing.'}
            </p>
            <div className="flex gap-2 justify-center">
              {connected ? (
                <button onClick={handleLoadFromBoard} className="px-4 py-2 rounded-lg bg-[var(--color-primary-dim)] text-white text-xs font-medium hover:bg-[var(--color-primary)] transition-colors">
                  <Download size={14} className="inline mr-1" /> Load from Board
                </button>
              ) : (
                <button onClick={() => connect()} className="px-4 py-2 rounded-lg bg-[var(--color-primary-dim)] text-white text-xs font-medium hover:bg-[var(--color-primary)] transition-colors">
                  Connect AMYboard
                </button>
              )}
              <button onClick={() => setShowPatchSelector(true)} className="px-4 py-2 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors">
                Browse Patches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {viewState === 'error' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <AlertCircle size={32} className="mx-auto text-red-400" />
            <p className="text-sm text-[var(--color-text)]">Failed to load patch</p>
            <p className="text-xs text-[var(--color-text-muted)]">Board did not respond in time.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={handleLoadFromBoard} className="px-4 py-2 rounded-lg bg-[var(--color-primary-dim)] text-white text-xs font-medium hover:bg-[var(--color-primary)] transition-colors">Retry</button>
              <button onClick={() => setViewState('empty')} className="px-4 py-2 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors">Load Factory</button>
            </div>
          </div>
        </div>
      )}

      {/* Ready State: Editor */}
      {viewState === 'ready' && (
        <motion.div className="flex flex-col flex-1 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          {/* Synth Tabs */}
          {synthModules.length > 0 && (
            <div className="px-3 pt-2 pb-1 border-b border-[var(--color-border)] shrink-0">
              <SynthTabs synths={synthModules} activeSynth={activeSynth} onSelect={setActiveSynth} onAdd={handleAddSynth} onRemove={handleRemoveSynth} />
            </div>
          )}

          {/* Signal Chain */}
          <div className="flex-1 overflow-hidden relative">
            {synthModules_list.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-2">
                  <p className="text-xs text-[var(--color-text-muted)]">No modules in this synth</p>
                  <button onClick={() => setShowAddSheet(true)} className="px-3 py-1.5 rounded-lg bg-[var(--color-primary-dim)] text-white text-xs font-medium hover:bg-[var(--color-primary)] transition-colors">
                    <Plus size={14} className="inline mr-1" /> Add Module
                  </button>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <motion.div
                  ref={chainRef}
                  className="h-full overflow-x-auto overflow-y-hidden flex items-start gap-1 p-4 pb-8 scrollbar-thin"
                  onDragOver={handleDragOver}
                  layout
                >
                  {synthModules_list.map((mod, idx) => (
                    <motion.div key={mod.id} className="flex items-center" layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                      {idx > 0 && <ChainArrow />}
                      <div onDrop={(e) => handleDrop(e, mod.id)} onDragOver={handleDragOver}>
                        <CompactModuleCard
                          mod={mod}
                          expandedId={expandedModuleId}
                          onToggleExpand={(id) => setExpandedModuleId(expandedModuleId === id ? null : id)}
                          onRemove={handleRemoveModule}
                          onDragStart={handleDragStart}
                        />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Desktop: Keyboard Sidebar */}
            <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[280px] border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)]">🎹 Keyboard</div>
                <div className="flex-1 overflow-hidden"><KeyboardFlyout /></div>
              </div>
            </div>
          </div>

          {/* Mobile: Keyboard Flyout */}
          <div className="lg:hidden"><KeyboardFlyout /></div>

          {/* FAB: Add Module */}
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddSheet(true)}
            className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-40 w-12 h-12 rounded-full bg-[var(--color-primary-dim)] hover:bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary-dim)]/30 flex items-center justify-center transition-colors"
          >
            <Plus size={20} />
          </motion.button>
        </motion.div>
      )}

      {/* Add Module Sheet */}
      <AnimatePresence>
        {showAddSheet && (
          <motion.div key="add-sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AddModuleSheet onSelect={handleAddModule} onClose={() => setShowAddSheet(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo Toast */}
      <AnimatePresence>
        {undoState && (
          <UndoToast message={undoState.message} onUndo={handleUndoRemove} onDismiss={() => setUndoState(null)} />
        )}
      </AnimatePresence>

      {/* Patch Selector */}
      <AnimatePresence>
        {showPatchSelector && (
          <motion.div key="patch-selector" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PatchSelectorSheet
              onSelect={(patch) => {
                setShowPatchSelector(false)
                const sendWire = (wire: string) => { if (amyConnection.state === 'connected') sendWireMessage(wire) }
                applyPatchToCanvas(patch, sendWire)
                usePatchStore.getState().addPatch(patch)
                log.log('user', `Loaded factory patch: ${patch.name}`)
                setViewState('ready')
                setStatusMsg(`Patch loaded: ${patch.name}`)
                setTimeout(() => setStatusMsg(null), 2000)
              }}
              onClose={() => setShowPatchSelector(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disconnected Overlay */}
      <AnimatePresence>
        {showDisconnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 mx-4 max-w-sm w-full text-center space-y-4 shadow-2xl"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                <WifiOff size={24} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">Board disconnected</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  The connection to your AMYboard was lost. Changes are saved locally.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleReconnect}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary-dim)] text-white text-xs font-medium hover:bg-[var(--color-primary)] transition-colors"
                >
                  <RefreshCw size={14} />
                  Reconnect
                </button>
                <button
                  onClick={() => setShowDisconnected(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--color-surface-hover)] text-[var(--color-text)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors"
                >
                  Continue offline
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
