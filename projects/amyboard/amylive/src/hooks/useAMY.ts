import { useEffect, useRef } from 'react'
// WebMIDI types are available natively in the DOM lib

type UseAMYOptions = {
  onMessage?: (data: Uint8Array) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useAMY({ onMessage, onConnect, onDisconnect }: UseAMYOptions = {}) {
  const midiAccess = useRef<MIDIAccess | null>(null)
  const midiInput = useRef<MIDIInput | null>(null)
  const midiOutput = useRef<MIDIOutput | null>(null)

  useEffect(() => {
    const initMIDI = async () => {
      if (!navigator.requestMIDIAccess) return

      try {
        const access = await navigator.requestMIDIAccess()
        midiAccess.current = access

        access.onstatechange = () => {
          const inputs = Array.from(access.inputs.values())
          const outputs = Array.from(access.outputs.values())

          const amyIn = inputs.find(i =>
            i.name?.toLowerCase().includes('amy') ||
            i.manufacturer?.toLowerCase().includes('shorepine')
          )
          const amyOut = outputs.find(o =>
            o.name?.toLowerCase().includes('amy') ||
            o.manufacturer?.toLowerCase().includes('shorepine')
          )

          if (amyIn && amyOut) {
            midiInput.current = amyIn
            midiOutput.current = amyOut
            amyIn.onmidimessage = (e: MIDIMessageEvent) => {
              if (e.data) onMessage?.(new Uint8Array(e.data))
            }
            onConnect?.()
          } else {
            midiInput.current = null
            midiOutput.current = null
            onDisconnect?.()
          }
        }

        // Initial scan
        const inputs = Array.from(access.inputs.values())
        const outputs = Array.from(access.outputs.values())
        const amyIn = inputs.find(i =>
          i.name?.toLowerCase().includes('amy') ||
          i.manufacturer?.toLowerCase().includes('shorepine')
        )
        const amyOut = outputs.find(o =>
          o.name?.toLowerCase().includes('amy') ||
          o.manufacturer?.toLowerCase().includes('shorepine')
        )

        if (amyIn && amyOut) {
          midiInput.current = amyIn
          midiOutput.current = amyOut
          amyIn.onmidimessage = (e: MIDIMessageEvent) => {
            if (e.data) onMessage?.(new Uint8Array(e.data))
          }
          onConnect?.()
        }
      } catch (err) {
        console.error('WebMIDI init failed:', err)
      }
    }

    initMIDI()

    return () => {
      midiAccess.current = null
      midiInput.current = null
      midiOutput.current = null
    }
  }, [])

  const send = (data: number[]) => {
    if (midiOutput.current) {
      midiOutput.current.send(new Uint8Array(data))
    }
  }

  const sendSysex = (payload: number[]) => {
    send([0xF0, 0x00, 0x03, 0x45, ...payload, 0xF7])
  }

  const sendWire = (wire: string) => {
    const encoder = new TextEncoder()
    const bytes = Array.from(encoder.encode(wire))
    sendSysex(bytes)
  }

  const sendNoteOn = (note: number, velocity = 100, channel = 0) => {
    send([0x90 | channel, note, velocity])
  }

  const sendNoteOff = (note: number, channel = 0) => {
    send([0x80 | channel, note, 0])
  }

  const sendCC = (cc: number, value: number, channel = 0) => {
    send([0xB0 | channel, cc, value])
  }

  return { send, sendSysex, sendWire, sendNoteOn, sendNoteOff, sendCC }
}