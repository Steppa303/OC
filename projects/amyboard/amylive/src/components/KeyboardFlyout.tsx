// ─── Keyboard Flyout ─────────────────────────────────────────────────
// Touch-Keyboard für Mobile (Swipe-Up) + Desktop (Sidebar).
// Multi-Touch, Velocity, Oktav-Steuerung.

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronUp, ChevronDown, Plus, Minus } from 'lucide-react'

type KeyboardState = 'collapsed' | 'normal' | 'maximized'

const WHITE_KEYS = ['C','D','E','F','G','A','B']
const BLACK_KEYS: Record<number, string> = { 0: 'C#', 1: 'D#', 3: 'F#', 4: 'G#', 5: 'A#' }
const BLACK_OFFSETS = [0, 1, null, 3, 4, 5, null] // index of black key per white key position, null = no black

function noteName(octave: number, whiteIdx: number): string {
  return `${WHITE_KEYS[whiteIdx]}${octave}`
}

function blackNoteName(octave: number, whiteIdx: number): string | null {
  const offset = BLACK_OFFSETS[whiteIdx]
  if (offset === null) return null
  return `${BLACK_KEYS[offset]}${octave}`
}

export function KeyboardFlyout() {
  const [state, setState] = useState<KeyboardState>('normal')
  const [octave, setOctave] = useState(3)
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set())
  const keyboardRef = useRef<HTMLDivElement>(null)

  // Touch tracking
  const touchIdRef = useRef<Map<number, { note: string; velocity: number }>>(new Map())

  const getNoteFromPos = useCallback((clientX: number, clientY: number): { note: string; velocity: number } | null => {
    if (!keyboardRef.current) return null
    const rect = keyboardRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const width = rect.width
    const whiteKeyWidth = width / 7
    const whiteIdx = Math.floor(x / whiteKeyWidth)
    if (whiteIdx < 0 || whiteIdx > 6) return null

    // Check if we're in a black key area
    const blackKeyWidth = whiteKeyWidth * 0.6
    const blackKeyHeight = rect.height * 0.6
    const blackKeyOffset = whiteKeyWidth - blackKeyWidth / 2

    const blackOffset = BLACK_OFFSETS[whiteIdx]
    if (blackOffset !== null && x % whiteKeyWidth > whiteKeyWidth - blackKeyWidth && y < blackKeyHeight) {
      return { note: blackNoteName(octave, whiteIdx)!, velocity: Math.min(1, (rect.height - y) / rect.height + 0.2) }
    }

    // White key
    const velocity = Math.min(1, (rect.height - y) / rect.height + 0.2)
    return { note: noteName(octave, whiteIdx), velocity }
  }, [octave])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const noteInfo = getNoteFromPos(touch.clientX, touch.clientY)
      if (noteInfo) {
        touchIdRef.current.set(touch.identifier, noteInfo)
        setActiveNotes(prev => new Set(prev).add(noteInfo.note))
        // Note On via MIDI
        sendNoteOn(noteInfo.note, noteInfo.velocity)
      }
    }
  }, [getNoteFromPos])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const prev = touchIdRef.current.get(touch.identifier)
      const noteInfo = getNoteFromPos(touch.clientX, touch.clientY)

      if (prev && noteInfo && prev.note !== noteInfo.note) {
        // Note changed — send off for old, on for new
        sendNoteOff(prev.note)
        setActiveNotes(prevSet => {
          const next = new Set(prevSet)
          next.delete(prev.note)
          next.add(noteInfo.note)
          return next
        })
        sendNoteOn(noteInfo.note, noteInfo.velocity)
        touchIdRef.current.set(touch.identifier, noteInfo)
      }
    }
  }, [getNoteFromPos])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = touchIdRef.current.get(touch.identifier)
      if (info) {
        sendNoteOff(info.note)
        setActiveNotes(prev => {
          const next = new Set(prev)
          next.delete(info.note)
          return next
        })
        touchIdRef.current.delete(touch.identifier)
      }
    }
  }, [])

  // Note On/Off stubs (will be connected to WebMIDI later)
  const sendNoteOn = useCallback((note: string, velocity: number) => {
    // TODO: Connect to WebMIDI output
    console.log(`🎹 ON: ${note} v=${velocity.toFixed(2)}`)
  }, [])

  const sendNoteOff = useCallback((note: string) => {
    console.log(`🎹 OFF: ${note}`)
  }, [])

  // Computer keyboard input
  useEffect(() => {
    const KEY_MAP: Record<string, string> = {
      'a': 'C3', 'w': 'C#3', 's': 'D3', 'e': 'D#3', 'd': 'E3',
      'f': 'F3', 't': 'F#3', 'g': 'G3', 'z': 'G#3', 'h': 'A3',
      'u': 'A#3', 'j': 'B3', 'k': 'C4',
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const note = KEY_MAP[e.key.toLowerCase()]
      if (note && !activeNotes.has(note)) {
        setActiveNotes(prev => new Set(prev).add(note))
        sendNoteOn(note, 0.8)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const note = KEY_MAP[e.key.toLowerCase()]
      if (note) {
        setActiveNotes(prev => {
          const next = new Set(prev)
          next.delete(note)
          return next
        })
        sendNoteOff(note)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [activeNotes, sendNoteOn, sendNoteOff])

  const heightClass = state === 'collapsed' ? 'h-8'
    : state === 'normal' ? 'h-[30vh]'
    : 'h-[60vh]'

  // Swipe handler
  const handleSwipe = useCallback((direction: 'up' | 'down') => {
    if (direction === 'up') {
      setState(prev => prev === 'collapsed' ? 'normal' : 'maximized')
    } else {
      setState(prev => prev === 'maximized' ? 'normal' : 'collapsed')
    }
  }, [])

  // Touch swipe gesture detection
  const swipeStartY = useRef(0)
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartY.current = e.touches[0].clientY
  }, [])
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    const diff = swipeStartY.current - e.changedTouches[0].clientY
    if (Math.abs(diff) > 50) {
      handleSwipe(diff > 0 ? 'up' : 'down')
    }
  }, [handleSwipe])

  // Render keys
  const whiteKeys = Array.from({ length: 7 }, (_, i) => {
    const note = noteName(octave, i)
    const isActive = activeNotes.has(note) || activeNotes.has(blackNoteName(octave, i) ?? '')
    return (
      <div
        key={note}
        className={`
          relative flex-1 border-r border-[var(--color-border)] last:border-r-0
          flex items-end justify-center pb-1
          transition-colors cursor-pointer select-none
          ${isActive ? 'bg-[var(--color-primary-dim)]/30' : 'bg-white dark:bg-gray-900'}
          hover:bg-[var(--color-primary-dim)]/10
        `}
        style={{ height: '100%' }}
      >
        <span className="text-[9px] text-[var(--color-text-muted)] font-mono">{note}</span>
        {/* Black key */}
        {BLACK_OFFSETS[i] !== null && (
          <div
            className={`
              absolute -top-0.5 -right-2 w-[calc(100%+4px)] h-[60%] rounded-b-md
              z-10 shadow-md
              transition-colors cursor-pointer
              ${activeNotes.has(blackNoteName(octave, i)!) ? 'bg-[var(--color-primary)]' : 'bg-gray-800 dark:bg-gray-700'}
              hover:bg-[var(--color-primary-dim)]/80
            `}
            style={{ clipPath: 'inset(0 0 0 0 round 0 0 4px 4px)' }}
          />
        )}
      </div>
    )
  })

  return (
    <div
      className={`${heightClass} bg-[var(--color-surface)] border-t border-[var(--color-border)] transition-all duration-300 flex flex-col relative overflow-hidden`}
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
    >
      {/* Handle / Tab-Leiste */}
      <div
        className="flex items-center justify-between px-3 py-1 bg-[var(--color-surface-hover)] shrink-0 cursor-pointer"
        onClick={() => handleSwipe(state === 'collapsed' ? 'up' : 'down')}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">🎹 Keyboard</span>
          <span className="text-[9px] text-[var(--color-text-dim)] font-mono">{octave}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setOctave(prev => Math.max(0, prev - 1)) }}
            className="p-0.5 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOctave(prev => Math.min(8, prev + 1)) }}
            className="p-0.5 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]"
          >
            <Plus size={12} />
          </button>
          <span className="text-[var(--color-text-muted)] ml-2">
            {state === 'collapsed' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {/* Keys */}
      {state !== 'collapsed' && (
        <div
          ref={keyboardRef}
          className="flex-1 flex select-none touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {whiteKeys}
        </div>
      )}
    </div>
  )
}