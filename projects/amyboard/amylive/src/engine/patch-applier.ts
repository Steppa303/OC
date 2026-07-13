// ─── Patch Applier ────────────────────────────────────────────────────
// Bridge between patch parser and Zustand stores.
// Parses a loaded patch into canvas modules + chain links, then loads
// everything into the canvas and sends AMY wire commands to the board.

import { useCanvasStore } from '@/stores/canvas-store'
import { useChainStore } from '@/stores/chain-store'
import { parsePatchState } from './patch-parser'
import type { AmyPatch, CanvasModule, SignalChainLink } from '@/types/amy'

/**
 * Apply a patch to the canvas:
 * 1. Clear existing modules
 * 2. Parse patch → modules + chain links
 * 3. Load modules into canvas store
 * 4. Load chain links into chain store
 * 5. Send AMY wire commands to load the patch on the board
 */
export function applyPatchToCanvas(
  patch: AmyPatch,
  sendWire: (wire: string) => void,
): void {
  console.log('[applyPatchToCanvas] patch:', patch.name, 'state:', patch.state)

  // 1. Clear existing state
  useCanvasStore.getState().clear()
  useChainStore.getState().clearLinks()

  // 2. Parse patch
  let modules: CanvasModule[] = []
  let chainLinks: SignalChainLink[] = []
  try {
    const result = parsePatchState({
      name: patch.name,
      number: patch.boardSlot ?? patch.state.synths[0]?.patch ?? 0,
      state: patch.state,
    })
    modules = result.modules
    chainLinks = result.chainLinks
    console.log('[applyPatchToCanvas] parsed:', modules.length, 'modules,', chainLinks.length, 'chainLinks')
  } catch (err) {
    console.error('[applyPatchToCanvas] parsePatchState threw:', err)
  }

  // 3. Load modules into canvas store
  if (modules.length > 0) {
    useCanvasStore.getState().importModules(modules)
    console.log('[applyPatchToCanvas] imported', modules.length, 'modules into canvas store')
  } else {
    console.warn('[applyPatchToCanvas] No modules to import!')
  }

  // 4. Load chain links into chain store
  for (const link of chainLinks) {
    useChainStore.getState().addLink(link.from, link.to)
  }

  // 5. Send AMY wire commands — nur synth-init, KEINE raw dump lines
  // (dump lines enthalten z.B. S=reset was das Board resettet)
  for (const synth of patch.state.synths) {
    const wire = `i${synth.synth}K${synth.patch}Z`
    sendWire(wire)
    if (synth.portamento > 0) {
      sendWire(`i${synth.synth}m${synth.portamento}Z`)
    }
  }
}