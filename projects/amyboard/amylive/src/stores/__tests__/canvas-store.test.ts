import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../canvas-store'

describe('canvasStore', () => {
  beforeEach(() => {
    useCanvasStore.setState({ modules: [], selectedId: null })
  })

  it('adds a module with cardIndex', () => {
    const id = useCanvasStore.getState().addModule('oscillator', 0, 0, 280, 200, {}, undefined, undefined, undefined, 0)
    const mod = useCanvasStore.getState().modules.find(m => m.id === id)
    expect(mod).toBeDefined()
    expect(mod?.cardIndex).toBe(0)
    expect(mod?.moduleType).toBe('oscillator')
  })

  it('adds a module with specified cardIndex', () => {
    const id = useCanvasStore.getState().addModule('filter', 0, 0, 280, 200, {}, undefined, undefined, undefined, 3)
    const mod = useCanvasStore.getState().modules.find(m => m.id === id)
    expect(mod).toBeDefined()
    expect(mod?.cardIndex).toBe(3)
  })

  it('adds module with targetOsc, targetSynth, targetBus', () => {
    const id = useCanvasStore.getState().addModule('oscillator', 0, 0, 280, 200, {}, 1, 2, 3, 0)
    const mod = useCanvasStore.getState().modules.find(m => m.id === id)
    expect(mod?.targetOsc).toBe(1)
    expect(mod?.targetSynth).toBe(2)
    expect(mod?.targetBus).toBe(3)
  })

  it('removes a module by id', () => {
    const id = useCanvasStore.getState().addModule('oscillator', 0, 0)
    expect(useCanvasStore.getState().modules).toHaveLength(1)
    useCanvasStore.getState().removeModule(id)
    expect(useCanvasStore.getState().modules).toHaveLength(0)
  })

  it('updates module params', () => {
    const id = useCanvasStore.getState().addModule('oscillator', 0, 0, 280, 200, { freq: 440, amp: 0.8 })
    useCanvasStore.getState().updateParams(id, { freq: 880 })
    const mod = useCanvasStore.getState().modules.find(m => m.id === id)
    expect(mod?.params.freq).toBe(880)
    expect(mod?.params.amp).toBe(0.8) // unchanged
  })

  it('moves a module', () => {
    const id = useCanvasStore.getState().addModule('oscillator', 10, 20)
    useCanvasStore.getState().moveModule(id, 100, 200)
    const mod = useCanvasStore.getState().modules.find(m => m.id === id)
    expect(mod?.x).toBe(100)
    expect(mod?.y).toBe(200)
  })

  it('selects and deselects module', () => {
    const id = useCanvasStore.getState().addModule('oscillator', 0, 0)
    expect(useCanvasStore.getState().selectedId).toBe(id)
    useCanvasStore.getState().selectModule(null)
    expect(useCanvasStore.getState().selectedId).toBeNull()
  })

  it('imports modules and clears old ones', () => {
    useCanvasStore.getState().addModule('oscillator', 0, 0)
    expect(useCanvasStore.getState().modules).toHaveLength(1)

    useCanvasStore.getState().importModules([
      { id: 'new1', moduleType: 'filter', x: 0, y: 0, width: 280, height: 200, params: {}, cardIndex: 0 },
    ])
    expect(useCanvasStore.getState().modules).toHaveLength(1)
    expect(useCanvasStore.getState().modules[0].moduleType).toBe('filter')
  })

  it('clears all modules', () => {
    useCanvasStore.getState().addModule('oscillator', 0, 0)
    useCanvasStore.getState().addModule('filter', 0, 0)
    useCanvasStore.getState().clear()
    expect(useCanvasStore.getState().modules).toHaveLength(0)
    expect(useCanvasStore.getState().selectedId).toBeNull()
  })

  it('resizes a module', () => {
    const id = useCanvasStore.getState().addModule('oscillator', 0, 0, 280, 200)
    useCanvasStore.getState().resizeModule(id, 400, 300)
    const mod = useCanvasStore.getState().modules.find(m => m.id === id)
    expect(mod?.width).toBe(400)
    expect(mod?.height).toBe(300)
  })
})