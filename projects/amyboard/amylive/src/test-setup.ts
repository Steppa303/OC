import '@testing-library/jest-dom'
import { vi } from 'vitest'

// WebMIDI Mock
class MockMIDIPort {
  name = 'AMYboard'
  manufacturer = 'Shorepine Synth Systems'
  id = 'amyboard-1'
  type = 'input'
  state = 'connected'
  connection = 'open'
  onstatechange: ((e: Event) => void) | null = null
  send = vi.fn()
  close = vi.fn()
  open = vi.fn()
}

class MockMIDIAccess {
  inputs = new Map([['amyboard-1', new MockMIDIPort()]])
  outputs = new Map([['amyboard-1', new MockMIDIPort()]])
  onstatechange: ((e: Event) => void) | null = null
}

if (typeof navigator !== 'undefined' && !navigator.requestMIDIAccess) {
  ;(navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(new MockMIDIAccess())
}