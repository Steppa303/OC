// ─── Signal Chain Store (Zustand) ────────────────────────────────────
// Manages signal routing links between modules on the canvas.

import { create } from 'zustand'
import type { SignalChainLink, CanvasModule } from '@/types/amy'

function generateLinkId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
}

export interface ChainStore {
  links: SignalChainLink[]
  activeModuleId: string | null

  // Actions
  addLink: (from: { moduleId: string; output: string }, to: { moduleId: string; input: string }) => void
  removeLink: (id: string) => void
  getLinksForModule: (moduleId: string) => { inputs: SignalChainLink[]; outputs: SignalChainLink[] }
  clearLinks: () => void

  // New actions
  setActiveModule: (id: string | null) => void
  getChainForSynth: (synthNumber: number, allModules?: CanvasModule[]) => { modules: CanvasModule[]; links: SignalChainLink[] }
  reorderModule: (moduleId: string, newIndex: number, allModules: CanvasModule[]) => void

  // Serialization
  exportChain: () => string
  importChain: (json: string) => void
}

export const useChainStore = create<ChainStore>((set, get) => ({
  links: [],
  activeModuleId: null,

  addLink: (from, to) => {
    // Prevent duplicate links
    const existing = get().links.find(
      (l) => l.from.moduleId === from.moduleId && l.to.moduleId === to.moduleId,
    )
    if (existing) return

    const link: SignalChainLink = {
      id: generateLinkId(),
      from,
      to,
    }
    set((state) => ({ links: [...state.links, link] }))
  },

  removeLink: (id) => {
    set((state) => ({ links: state.links.filter((l) => l.id !== id) }))
  },

  getLinksForModule: (moduleId) => {
    const { links } = get()
    return {
      inputs: links.filter((l) => l.to.moduleId === moduleId),
      outputs: links.filter((l) => l.from.moduleId === moduleId),
    }
  },

  clearLinks: () => set({ links: [] }),

  setActiveModule: (id) => set({ activeModuleId: id }),

  getChainForSynth: (synthNumber, allModules = []) => {
    const canvasModules = allModules
    const synthModules = canvasModules.filter(
      (m) => m.targetSynth === synthNumber || m.params?.synth === synthNumber,
    )
    return {
      modules: synthModules,
      links: get().links.filter(
        (l) =>
          synthModules.some((m) => m.id === l.from.moduleId) ||
          synthModules.some((m) => m.id === l.to.moduleId),
      ),
    }
  },

  reorderModule: (moduleId, newIndex, allModules) => {
    const modules = [...allModules]
    const idx = modules.findIndex((m) => m.id === moduleId)
    if (idx < 0) return

    const [mod] = modules.splice(idx, 1)
    modules.splice(newIndex, 0, mod)
    // Return updated modules with re-assigned cardIndex via callback
    // Store consumer should apply the result
  },

  exportChain: () => {
    const { links, activeModuleId } = get()
    return JSON.stringify({ links, activeModuleId, version: 1 })
  },

  importChain: (json) => {
    try {
      const data = JSON.parse(json)
      if (data.version !== 1) return
      set({
        links: data.links ?? [],
        activeModuleId: data.activeModuleId ?? null,
      })
    } catch {
      // Invalid JSON — ignore
    }
  },
}))