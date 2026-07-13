import { describe, it, expect, beforeEach } from 'vitest'
import { useChainStore } from '../chain-store'

describe('chainStore', () => {
  beforeEach(() => {
    useChainStore.setState({ links: [], activeModuleId: null })
  })

  it('adds a link between two modules', () => {
    useChainStore.getState().addLink(
      { moduleId: 'osc1', output: 'audio' },
      { moduleId: 'filter1', input: 'input' },
    )
    expect(useChainStore.getState().links).toHaveLength(1)
  })

  it('prevents duplicate links', () => {
    useChainStore.getState().addLink(
      { moduleId: 'osc1', output: 'audio' },
      { moduleId: 'filter1', input: 'input' },
    )
    useChainStore.getState().addLink(
      { moduleId: 'osc1', output: 'audio' },
      { moduleId: 'filter1', input: 'input' },
    )
    expect(useChainStore.getState().links).toHaveLength(1)
  })

  it('removes a link by id', () => {
    useChainStore.getState().addLink(
      { moduleId: 'osc1', output: 'audio' },
      { moduleId: 'filter1', input: 'input' },
    )
    const linkId = useChainStore.getState().links[0].id
    useChainStore.getState().removeLink(linkId)
    expect(useChainStore.getState().links).toHaveLength(0)
  })

  it('gets links for a specific module', () => {
    useChainStore.getState().addLink(
      { moduleId: 'osc1', output: 'audio' },
      { moduleId: 'filter1', input: 'input' },
    )
    useChainStore.getState().addLink(
      { moduleId: 'env1', output: 'envelope' },
      { moduleId: 'osc1', input: 'amp_mod' },
    )
    const oscLinks = useChainStore.getState().getLinksForModule('osc1')
    expect(oscLinks.outputs).toHaveLength(1)
    expect(oscLinks.inputs).toHaveLength(1)
  })

  it('clears all links', () => {
    useChainStore.getState().addLink(
      { moduleId: 'osc1', output: 'audio' },
      { moduleId: 'filter1', input: 'input' },
    )
    useChainStore.getState().clearLinks()
    expect(useChainStore.getState().links).toHaveLength(0)
  })

  it('sets active module', () => {
    useChainStore.getState().setActiveModule('osc1')
    expect(useChainStore.getState().activeModuleId).toBe('osc1')
    useChainStore.getState().setActiveModule(null)
    expect(useChainStore.getState().activeModuleId).toBeNull()
  })

  it('exports and imports chain as JSON', () => {
    useChainStore.getState().addLink(
      { moduleId: 'osc1', output: 'audio' },
      { moduleId: 'filter1', input: 'input' },
    )
    const json = useChainStore.getState().exportChain()

    // Clear and re-import
    useChainStore.getState().clearLinks()
    expect(useChainStore.getState().links).toHaveLength(0)

    useChainStore.getState().importChain(json)
    expect(useChainStore.getState().links).toHaveLength(1)
    expect(useChainStore.getState().links[0].from.moduleId).toBe('osc1')
  })

  it('handles invalid import JSON silently', () => {
    useChainStore.getState().importChain('invalid json')
    // State should remain unchanged
    expect(useChainStore.getState().links).toHaveLength(0)
  })
})