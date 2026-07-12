import { useState, useRef, useCallback } from 'react';
import { useAMY } from '../../amy/AMYProvider';


// MIDI Note numbers for C2-C4 (2 Oktaven)
const NOTES = [
  { name: 'C',  note: 36 }, // C2
  { name: 'C#', note: 37, sharp: true },
  { name: 'D',  note: 38 },
  { name: 'D#', note: 39, sharp: true },
  { name: 'E',  note: 40 },
  { name: 'F',  note: 41 },
  { name: 'F#', note: 42, sharp: true },
  { name: 'G',  note: 43 },
  { name: 'G#', note: 44, sharp: true },
  { name: 'A',  note: 45 },
  { name: 'A#', note: 46, sharp: true },
  { name: 'B',  note: 47 },
  { name: 'C',  note: 48 }, // C3
  { name: 'C#', note: 49, sharp: true },
  { name: 'D',  note: 50 },
  { name: 'D#', note: 51, sharp: true },
  { name: 'E',  note: 52 },
  { name: 'F',  note: 53 },
  { name: 'F#', note: 54, sharp: true },
  { name: 'G',  note: 55 },
  { name: 'G#', note: 56, sharp: true },
  { name: 'A',  note: 57 },
  { name: 'A#', note: 58, sharp: true },
  { name: 'B',  note: 59 },
];

export default function MiniKeyboard() {
  const { send, ready } = useAMY();
  const [activeNotes, setActiveNotes] = useState(new Set<number>());
  const octaveOffset = useRef(0);
  const touchIds = useRef<Map<number, number>>(new Map());

  const getNote = useCallback((touchX: number, keyWidth: number) => {
    const index = Math.floor(touchX / keyWidth);
    const noteIndex = Math.min(Math.max(index, 0), NOTES.length - 1);
    return NOTES[noteIndex].note + octaveOffset.current * 12;
  }, []);

  const getVelocity = useCallback((touchY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const relY = (touchY - rect.top) / rect.height;
    return Math.max(0.1, Math.min(1, 1 - relY));
  }, []);

  const handleNoteOn = (note: number, vel: number) => {
    if (!ready) return;
    send({ osc: 0, note, vel });
    setActiveNotes(prev => new Set(prev).add(note));
  };

  const handleNoteOff = (note: number) => {
    if (!ready) return;
    send({ osc: 0, note, vel: 0 });
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    const keyWidth = el.clientWidth / NOTES.length;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const note = getNote(t.clientX, keyWidth);
      const vel = getVelocity(t.clientY, el);
      touchIds.current.set(t.identifier, note);
      handleNoteOn(note, vel);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    const keyWidth = el.clientWidth / NOTES.length;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const oldNote = touchIds.current.get(t.identifier);
      const newNote = getNote(t.clientX, keyWidth);
      const vel = getVelocity(t.clientY, el);
      if (oldNote !== undefined && oldNote !== newNote) {
        handleNoteOff(oldNote);
        handleNoteOn(newNote, vel);
        touchIds.current.set(t.identifier, newNote);
      } else {
        handleNoteOn(newNote, vel);
        touchIds.current.set(t.identifier, newNote);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const note = touchIds.current.get(t.identifier);
      if (note !== undefined) {
        handleNoteOff(note);
        touchIds.current.delete(t.identifier);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const keyWidth = el.clientWidth / NOTES.length;
    const note = getNote(e.clientX, keyWidth);
    const vel = getVelocity(e.clientY, el);
    handleNoteOn(note, vel);

    const onMove = (me: MouseEvent) => {
      const n = getNote(me.clientX, keyWidth);
      if (n !== note) {
        handleNoteOff(note);
        const v = getVelocity(me.clientY, el);
        handleNoteOn(n, v);
      }
    };
    const onUp = () => {
      handleNoteOff(note);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const keyWidth = `${100 / NOTES.length}%`;

  return (
    <div className="w-full select-none">
      {/* Octave controls */}
      <div className="flex justify-center gap-2 mb-1">
        <button onClick={() => octaveOffset.current = Math.max(-2, octaveOffset.current - 1)}
          className="px-3 py-1 rounded text-xs bg-[var(--color-surface-2)] text-[var(--color-text-dim)] border border-[#333] touch-target">
          ◀ Oct
        </button>
        <span className="text-xs text-[var(--color-text-dim)] self-center font-mono">
          C{2 + octaveOffset.current}
        </span>
        <button onClick={() => octaveOffset.current = Math.min(4, octaveOffset.current + 1)}
          className="px-3 py-1 rounded text-xs bg-[var(--color-surface-2)] text-[var(--color-text-dim)] border border-[#333] touch-target">
          Oct ▶
        </button>
      </div>

      {/* Keyboard */}
      <div className="relative h-44 flex"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {NOTES.map((n, i) => {
          const isSharp = n.sharp;
          const isActive = activeNotes.has(n.note + octaveOffset.current * 12);

          if (isSharp) {
            return (
              <div key={`${n.name}${n.note}`}
                className={`absolute z-10 rounded-b-sm ${
                  isActive
                    ? 'bg-[var(--color-accent-cyan)]'
                    : 'bg-[#1a1a1a] border border-[#333]'
                }`}
                style={{
                  left: `calc(${i * parseFloat(keyWidth)}% - ${parseFloat(keyWidth) * 0.35}%)`,
                  width: `${parseFloat(keyWidth) * 0.7}%`,
                  height: '60%',
                  top: 0,
                }}
              />
            );
          }

          return (
            <div key={`${n.name}${n.note}`}
              className={`flex-1 border-r border-[#222] last:border-r-0 rounded-b-sm transition-colors ${
                isActive
                  ? 'bg-[rgba(0,212,255,0.15)] border-b-2 border-b-[var(--color-accent-cyan)]'
                  : 'bg-[#2a2a2a]'
              }`}
              style={{ height: '100%' }}
            />
          );
        })}
      </div>

      {/* Note labels */}
      <div className="flex text-[10px] text-[var(--color-text-dim)] mt-0.5">
        {NOTES.map((n, i) => (
          <div key={`label-${i}`} className="flex-1 text-center" style={{ width: keyWidth }}>
            {!n.sharp && n.name}
          </div>
        ))}
      </div>
    </div>
  );
}