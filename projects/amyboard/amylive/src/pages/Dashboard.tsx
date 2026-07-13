import { Plus, Layout, Save, Download, Upload, Sparkles, X, Search, Music, Keyboard, Drum, Radio } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useCanvasStore } from '../stores/canvas-store'
import { useConnectionStore } from '../stores/connection-store'
import { usePatchStore } from '../stores/patch-store'
import { useLogStore } from '../stores/log-store'
import { Sidebar } from '../components/Sidebar'
import { LogPanel } from '../components/LogPanel'
import { SwipeStack } from '../components/touch/SwipeStack'
import { moduleRegistry } from '../modules'
import { getPatchName, ALL_PATCHES, JUNO_PATCHES, DX7_PATCHES, PIANO_PATCH, DRUM_PATCHES, type PatchEntry } from '../lib/amy-patches'
import { amyConnection } from '../lib/amy-connection'
import { applyPatchToCanvas } from '../engine/patch-applier'
import { canvasToPatch } from '../engine/patch-from-canvas'
import { loadPatchFromBoard, factoryPatchFromNumber } from '../engine/patch-from-board'
import type { AmyPatch } from '../types/amy'

// ─── AMY Wire → Python Bridge ─────────────────────────────────────────
// Konvertiert jedes AMY Wire-Format generisch in amy.send() Python-Code.
// Wire: v0w0f440a0.8Z  →  amy.send(osc=0, wave=0, freq=440, amp=0.8)
//       i0K42Z         →  amy.send(synth=0, patch=42, num_voices=6)
//
// Wire-Code-Mapping:
//   v=osc, w=wave, f=freq, a=amp, d=duty, Q=pan, y=bus,
//   F=filter_freq, G=filter_type, R=resonance, b=feedback,
//   A=bp0, B=bp1, T=eg0_type, X=eg1_type, L=mod_source,
//   i=synth, K=patch, n=note, l=vel, m=portamento,
//   c=chained_osc, P=phase,
//   iv=num_voices, in=oscs_per_voice,
//   h=reverb, j=chorus, k=echo, V=volume

const WIRE_CODES: Record<string, string> = {
  v:'osc', w:'wave', f:'freq', a:'amp', d:'duty', Q:'pan', y:'bus',
  F:'filter_freq', G:'filter_type', R:'resonance', b:'feedback',
  A:'bp0', B:'bp1', T:'eg0_type', X:'eg1_type', L:'mod_source',
  i:'synth', K:'patch', n:'note', l:'vel', m:'portamento',
  c:'chained_osc', P:'phase', S:'reset',
  h:'reverb', j:'chorus', k:'echo', V:'volume',
};

const TWO_CHAR_CODES: Record<string, string> = {
  iv:'num_voices', in:'oscs_per_voice',
};

// Regex: optional prefix (one-char or two-char) + value, repeated
// Captures pairs: [{code, value}, ...]
function parseWire(wire: string): Record<string, string> {
  const clean = wire.replace(/Z$/, '').trim()
  const result: Record<string, string> = {}
  let i = 0
  while (i < clean.length) {
    // Try two-char key first
    let key: string | undefined
    if (i + 1 < clean.length) {
      const tryTwo = clean.slice(i, i + 2)
      if (tryTwo in TWO_CHAR_CODES) key = tryTwo
    }
    if (!key) {
      const c = clean[i]
      if (c in WIRE_CODES) key = c
    }
    if (!key) { i++; continue }

    const pyKey = WIRE_CODES[key] ?? TWO_CHAR_CODES[key]
    i += key.length

    // Read value until next known code or EOL
    const valStart = i
    while (i < clean.length) {
      const c = clean[i]
      // '.'  ','  'e'  'E'  '+'  '-'  are value chars (numbers, strings)
      if (i > valStart && c !== '.' && c !== ',' && c !== 'e' && c !== 'E' && c !== '-' && c !== '+') {
        // Check if this char starts a new key
        const nextTwo = i + 1 < clean.length ? clean.slice(i, i + 2) : ''
        if (nextTwo in TWO_CHAR_CODES) break
        if (c in WIRE_CODES) break
      }
      i++
    }

    const val = clean.slice(valStart, i)
    if (val) result[pyKey] = val
  }
  return result
}

function sendWireMessage(wire: string): void {
  if (amyConnection.state !== 'connected') return
  const log = useLogStore.getState()

  const kwargs = parseWire(wire)
  if (!kwargs || Object.keys(kwargs).length === 0) {
    log.log('error', `Leeres/unbekanntes Wire-Format: ${wire}`)
    return
  }

  // Synth init: auto num_voices
  if (kwargs.synth && kwargs.patch && !kwargs.num_voices) {
    kwargs.num_voices = '6'
  }

  // Build Python amy.send(...)
  const pyArgs = Object.entries(kwargs).map(([k, v]) => {
    // bp0/bp1 sind Strings (breakpoint-Format: '100,1,300,0.5,600,0')
    if (k === 'bp0' || k === 'bp1') return `${k}='${v}'`
    // Velocity-Normalisierung (1-127 → 0.0-1.0)
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

// ─── Patch Selector Modal (fallback for no-MIDI mode) ────────────────
function PatchSelectorModal({
  onSelect,
  onClose,
}: {
  onSelect: (patch: AmyPatch) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const filteredPatches = (() => {
    let list: PatchEntry[]
    switch (category) {
      case 'juno': list = JUNO_PATCHES; break
      case 'dx7': list = DX7_PATCHES; break
      case 'drums': list = DRUM_PATCHES; break
      case 'piano': list = [PIANO_PATCH]; break
      default: list = ALL_PATCHES; break
    }
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.number.toString().includes(q),
    )
  })()

  const CAT_ICONS: Record<string, typeof Music> = {
    all: Music, juno: Music, dx7: Keyboard, drums: Drum, piano: Music,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-bold">Select Factory Patch</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Search + Categories */}
        <div className="p-4 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patches…"
              className="w-full text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg pl-8 pr-3 py-2 outline-none focus:border-[var(--color-primary)]"
              autoFocus
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['all', 'juno', 'dx7', 'drums', 'piano'].map((cat) => {
              const Icon = CAT_ICONS[cat] ?? Music
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full transition-colors cursor-pointer ${
                    category === cat
                      ? 'bg-[var(--color-primary-dim)] text-white'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <Icon size={11} />
                  {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Patch List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-0.5">
            {filteredPatches.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
                No patches found
              </p>
            ) : (
              filteredPatches.map((p) => (
                <button
                  key={p.number}
                  onClick={() => onSelect(factoryPatchFromNumber(p.number))}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors text-left hover:bg-[var(--color-surface-hover)] cursor-pointer"
                >
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)] w-10 shrink-0">
                    #{p.number}
                  </span>
                  <span className="truncate flex-1 text-[var(--color-text)]">{p.name}</span>
                  <span className="text-[9px] uppercase text-[var(--color-text-dim)]">{p.category}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Component ─────────────────────────────────────────────
export function Dashboard() {
  const { modules, selectedId, addModule, removeModule, selectModule, clear } = useCanvasStore()
  const { state } = useConnectionStore()
  const connected = state === 'connected'

  // Patch selector modal
  const [showPatchSelector, setShowPatchSelector] = useState(false)

  // Loading overlay
  const [loading, setLoading] = useState<string | null>(null)

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const [activeCardIndex, setActiveCardIndex] = useState(0)

  // ── Handle Save Patch ──────────────────────────────────────────────
  const handleSavePatch = useCallback(() => {
    const log = useLogStore.getState()
    if (modules.length === 0) {
      log.log('error', 'No modules to save — add some modules first')
      return
    }

    const synthModule = modules.find(m => m.moduleType === 'synth')
    const patchName = synthModule
      ? `Patch #${synthModule.params.patch}`
      : `Canvas State ${new Date().toLocaleTimeString()}`

    const patch = canvasToPatch(modules, patchName)
    const id = usePatchStore.getState().addPatch(patch)
    log.log('user', `Saved patch: ${patchName} (${modules.length} modules)`)
    console.log('[Save Patch] Saved:', id, patch.name)
  }, [modules])

  // ── Handle Load from Board ─────────────────────────────────────────
  const handleLoadFromBoard = useCallback(async () => {
    const log = useLogStore.getState()

    setLoading('Loading from board…')
    try {
      const patch = await loadPatchFromBoard()

      if (patch) {
        // Successfully loaded from board
        log.log('dump', `Loaded state dump from board (${patch.state.oscillators.length} oscs, ${patch.state.synths.length} synths)`)

        const sendWire = (wire: string) => {
          if (amyConnection.state === 'connected') sendWireMessage(wire)
        }
        applyPatchToCanvas(patch, sendWire)
        usePatchStore.getState().addPatch(patch)
        log.log('user', `Applied patch from board: ${patch.name}`)
      } else {
        // Board not connected or dump failed → show patch selector fallback
        log.log('user', 'Board not available — showing patch selector')
        setShowPatchSelector(true)
      }
    } catch (err) {
      log.log('error', `Failed to load from board: ${err}`)
      setShowPatchSelector(true)
    } finally {
      setLoading(null)
    }
  }, [])

  // ── Handle Patch Selector Result ────────────────────────────────────
  const handlePatchSelected = useCallback((patch: AmyPatch) => {
    const log = useLogStore.getState()
    setShowPatchSelector(false)

    const sendWire = (wire: string) => {
      if (amyConnection.state === 'connected') sendWireMessage(wire)
    }
    applyPatchToCanvas(patch, sendWire)
    usePatchStore.getState().addPatch(patch)
    log.log('user', `Loaded factory patch: ${patch.name}`)
  }, [])

  // ── Handle Save to Board ───────────────────────────────────────────
  const handleSaveToBoard = useCallback(async () => {
    const log = useLogStore.getState()

    if (amyConnection.state !== 'connected') {
      log.log('error', 'Not connected to AMYboard — cannot save to board')
      return
    }

    if (modules.length === 0) {
      log.log('error', 'No modules to save — add some modules first')
      return
    }

    setLoading('Saving to board…')
    try {
      // Build Python sketch from current modules
      const synthModule = modules.find(m => m.moduleType === 'synth')

      const lines: string[] = [
        'import amy, amyboard',
        '',
        'amy.reset()',
        '',
      ]

      // Synth initialization
      if (synthModule) {
        const synth = synthModule.params.synth ?? 0
        const patch = synthModule.params.patch ?? 0
        const numVoices = synthModule.params.num_voices ?? 6
        lines.push(`amy.send(synth=${synth}, patch=${patch}, num_voices=${numVoices})`)
        lines.push('')
      }

      // Oscillator + filter + envelope params
      const oscModules = modules.filter(m => m.moduleType === 'oscillator')
      const filterModules = modules.filter(m => m.moduleType === 'filter')
      const envelopeModules = modules.filter(m => m.moduleType === 'envelope')

      // Collect unique osc numbers
      const oscNums = new Set<number>()
      for (const m of [...oscModules, ...filterModules, ...envelopeModules]) {
        oscNums.add(m.params.osc ?? 0)
      }

      for (const oscNum of Array.from(oscNums).sort()) {
        const oscMod = oscModules.find(m => (m.params.osc ?? 0) === oscNum)
        const filterMod = filterModules.find(m => (m.params.osc ?? 0) === oscNum)
        const envMods = envelopeModules.filter(m => (m.params.osc ?? 0) === oscNum)

        if (oscMod) {
          const p = oscMod.params
          const freq = p.freq ?? 440
          const amp = p.amp ?? 0.8
          const pan = p.pan ?? 0.5
          const wave = p.wave ?? 0
          const bus = p.bus ?? 0
          const detune = p.detune ?? 0
          const portamento = p.portamento ?? 0

          // Build freq coef if note/vel/eg0/eg1/mod are set
          const coefSlots = [freq]
          const fc = p.freqCoefs
          if (fc?.note || fc?.vel || fc?.eg0 || fc?.eg1 || fc?.mod) {
            coefSlots.push(`note=${fc.note ?? 0}`)
            coefSlots.push(`vel=${fc.vel ?? 0}`)
            coefSlots.push(`eg0=${fc.eg0 ?? 0}`)
            coefSlots.push(`eg1=${fc.eg1 ?? 0}`)
            coefSlots.push(`mod=${fc.mod ?? 0}`)
          }

          lines.push(
            `# OSC ${oscNum}`,
            `amy.send(osc=${oscNum}, wave=${wave}, freq=${freq}, amp=${amp}, pan=${pan}, bus=${bus})`,
          )

          if (detune) lines.push(`amy.send(osc=${oscNum}, duty=${detune})`)
          if (portamento) lines.push(`amy.send(osc=${oscNum}, portamento=${portamento})`)
        }

        if (filterMod) {
          const p = filterMod.params
          lines.push(
            `# Filter ${oscNum}`,
            `amy.send(osc=${oscNum}, filter_type=${p.filter_type ?? 1}, filter_freq=${p.cutoff ?? 8000}, resonance=${p.resonance ?? 0.7})`,
          )
        }

        for (const envMod of envMods) {
          const p = envMod.params
          const egId = p.egId ?? 0
          const egType = p.eg_type ?? 0
          const totalA = p.attack ?? 100
          const decay = p.decay ?? 200
          const sustain = p.sustain ?? 0.5
          const release = p.release ?? 300
          const totalAD = totalA + decay
          const totalADR = totalAD + release

          const bpStr = [totalA, 1, totalAD, sustain, totalADR, 0].join(',')

          const bpKey = egId === 0 ? 'bp0' : 'bp1'
          const egTypeKey = egId === 0 ? 'eg0_type' : 'eg1_type'
          lines.push(
            `# EG${egId} ${oscNum}`,
            `amy.send(osc=${oscNum}, ${bpKey}='${bpStr}', ${egTypeKey}=${egType})`,
          )
        }
      }

      // Effects: check for reverb/chorus/echo params on any module
      // (could be extended later with dedicated FX modules)
      lines.push('')
      lines.push('# Global effects')
      lines.push('# amy.send(bus=0, reverb=0)')
      lines.push('# amy.send(bus=0, chorus=0)')
      lines.push('# amy.send(bus=0, echo=0)')

      // Empty loop
      lines.push('')
      lines.push('def loop():')
      lines.push('    pass')

      const sketchCode = lines.join('\n')

      // Upload and restart
      log.log('user', `Uploading sketch (${lines.length} lines)…`)
      await amyConnection.uploadSketch(sketchCode)
      await amyConnection.runPython('amyboard.restart_sketch()')
      log.log('user', 'Sketch uploaded and board restarted')
    } catch (err) {
      log.log('error', `Failed to save to board: ${err}`)
    } finally {
      setLoading(null)
    }
  }, [modules])

  // ── Handle Patch Instantiate ────────────────────────────────────────
  const handlePatchInstantiate = useCallback(() => {
    const synthModule = modules.find(m => m.moduleType === 'synth')
    if (!synthModule) {
      useLogStore.getState().log('error', 'No Synth module found — add a Synth Manager and select a patch first')
      return
    }

    const patchNum = synthModule.params.patch
    const patchEntry = ALL_PATCHES.find(p => p.number === patchNum)
    const patchName = patchEntry?.name ?? getPatchName(patchNum)

    const minimalPatch: AmyPatch = {
      id: `instantiate-${patchNum}`,
      name: patchName,
      author: 'amylive',
      category: (patchEntry?.category === 'piano' ? 'pcm' : (patchEntry?.category ?? 'user')) as AmyPatch['category'],
      tags: [],
      state: {
        oscillators: [{
          osc: 0,
          wave: 0,
          freq: { const: 440 },
          amp: { const: 0.8 },
          pan: { const: 0.5 },
          filter_freq: { const: 8000 },
          duty: { const: 0.5 },
          filter_type: 0,
          resonance: 0.7,
          bp0: '100,1,300,0.5,600,0',
          bp1: '',
          eg0_type: 0,
          eg1_type: 0,
          mod_source: -1,
          feedback: 0,
          bus: 0,
          chained_osc: 0,
          phase: 0,
        }],
        synths: [{
          synth: synthModule.params.synth ?? 0,
          patch: patchNum,
          num_voices: synthModule.params.num_voices ?? 6,
          oscs_per_voice: 1,
          midi_channel: synthModule.params.midiCh ?? 1,
          portamento: synthModule.params.portamento ?? 0,
          synth_delay: 0,
        }],
        effects: [],
      },
      wireCommands: [`i${synthModule.params.synth ?? 0}K${patchNum}`],
      created: Date.now(),
      modified: Date.now(),
      boardSlot: patchNum,
    }

    useLogStore.getState().log('user', `Instantiating modules for patch: ${patchName} (#${patchNum})`)

    const sendWire = (wire: string) => {
      if (amyConnection.state === 'connected') sendWireMessage(wire)
    }
    applyPatchToCanvas(minimalPatch, sendWire)
  }, [modules])

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 min-h-screen">
      <Sidebar />

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
            <div className="relative">
              <button
                id="module-add-btn"
                onClick={() => {
                  const dd = document.getElementById('module-dropdown')
                  if (dd) dd.classList.toggle('hidden')
                }}
                className="flex items-center gap-1.5 py-2 px-3 rounded-lg bg-[var(--color-primary-dim)] hover:bg-[var(--color-primary)] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Modul
              </button>
              <div
                id="module-dropdown"
                className="hidden absolute right-0 top-full mt-1 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl z-50"
              >
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
                          const dd = document.getElementById('module-dropdown')
                          if (dd) dd.classList.add('hidden')
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

        {/* Debug: visible module info */}
        <div className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-1 rounded flex items-center gap-2 flex-wrap">
          <span>🧩 {modules.length} mods</span>
          <span className="text-[var(--color-text-dim)]">|</span>
          <span>📱 {isMobile ? 'mobile' : 'desktop'}</span>
          <span className="text-[var(--color-text-dim)]">|</span>
          <span className="truncate max-w-[300px]">{modules.map(m => `${m.moduleType}#${m.id.slice(-4)}`).join(', ')}</span>
        </div>

        {/* Module Area */}
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
        ) : isMobile ? (
          <>
            <div className="-mx-4">
              <SwipeStack
                cards={modules.map((m) => ({
                  id: m.id,
                  node: (() => {
                    const modDef = moduleRegistry.get(m.moduleType)
                    if (!modDef) return (
                      <div className="p-4 text-xs text-red-400 bg-red-500/10 rounded-xl">
                        ❌ Unknown module type: {m.moduleType}
                      </div>
                    )
                    const CardComponent = modDef.cardComponent ?? modDef.component
                    const moduleIndex = modules.findIndex(mod => mod.id === m.id)
                    return (
                      <div className="h-full">
                        <CardComponent
                          id={m.id}
                          params={m.params}
                          cardIndex={moduleIndex}
                          totalCards={modules.length}
                          onParamChange={(key, value) => {
                            useLogStore.getState().log('wire', `Param ${key} = ${value}`, `${m.moduleType}#${m.id}`)
                            useCanvasStore.getState().updateParams(m.id, { [key]: value })
                          }}
                          onSendWire={(wire) => {
                            useLogStore.getState().log('wire', wire, m.moduleType + '#' + m.id)
                            sendWireMessage(wire)
                          }}
                          chainInfo={{
                            inputs: m.chainInputs ?? [],
                            outputs: m.chainOutputs ?? [],
                          }}
                        />
                      </div>
                    )
                  })()
                }))}
                activeIndex={Math.min(activeCardIndex, modules.length - 1)}
                onIndexChange={setActiveCardIndex}
              />
            </div>
            {/* Fallback Grid unter SwipeStack */}
            <details className="mt-2">
              <summary className="text-[10px] text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text)]">
                📋 Desktop Grid Fallback ({modules.length} modules)
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
                {modules.map(m => {
                  const modDef = moduleRegistry.get(m.moduleType)
                  if (!modDef) return null
                  const ModuleComponent = modDef.component
                  return (
                    <div key={m.id} className={selectedId === m.id ? 'module-selected' : ''} onClick={() => selectModule(m.id)}>
                      <ModuleComponent
                        id={m.id}
                        params={m.params}
                        onParamChange={(key, value) => {
                          useLogStore.getState().log('wire', `Param ${key} = ${value}`, `${m.moduleType}#${m.id}`)
                          useCanvasStore.getState().updateParams(m.id, { [key]: value })
                        }}
                        onSendWire={(wire) => {
                          useLogStore.getState().log('wire', wire, m.moduleType + '#' + m.id)
                          sendWireMessage(wire)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </details>
          </>
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
                      sendWireMessage(wire)
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
            <button
              onClick={handleSavePatch}
              className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Save size={12} /> Save Patch
            </button>
            <button
              onClick={handleSaveToBoard}
              disabled={!connected}
              className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Upload size={12} /> Save to Board
            </button>
            <button
              onClick={handlePatchInstantiate}
              disabled={!modules.find(m => m.moduleType === 'synth')}
              title="Parse the selected patch into individual module cards (OSC, Filter, Envelope)"
              className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles size={12} /> Instantiate Modules
            </button>
            <button
              onClick={handleLoadFromBoard}
              className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Download size={12} /> Load from Board
            </button>
          </div>
        </div>

        {/* Event Log */}
        <LogPanel />
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] rounded-2xl px-8 py-6 shadow-2xl border border-[var(--color-border)] flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--color-text)]">{loading}</p>
          </div>
        </div>
      )}

      {/* Patch Selector Modal */}
      {showPatchSelector && (
        <PatchSelectorModal
          onSelect={handlePatchSelected}
          onClose={() => setShowPatchSelector(false)}
        />
      )}
    </div>
  )
}