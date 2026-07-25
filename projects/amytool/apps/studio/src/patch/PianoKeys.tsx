import { useCallback, useRef } from 'react';
import { useEngine } from './engine';

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK: Record<number, number> = { 0: 1, 1: 3, 3: 6, 4: 8, 5: 10 };
const OCTAVES = 2;

/** Playable on-screen keyboard (core.keyboard). Sends note on/off through the
 *  engine context; note = 12*(octave+1) + semitone (MIDI, C4 = 60). */
export function PianoKeys({ octave, velocity }: { octave: number; velocity: number }) {
  const { playNote } = useEngine();
  const held = useRef<number | null>(null);
  const base = 12 * (octave + 1);

  const on = useCallback(
    (note: number) => {
      held.current = note;
      playNote(note, velocity, true);
    },
    [playNote, velocity],
  );
  const off = useCallback(() => {
    if (held.current !== null) {
      playNote(held.current, velocity, false);
      held.current = null;
    }
  }, [playNote, velocity]);

  const whiteKeys: number[] = [];
  for (let o = 0; o < OCTAVES; o++) for (const s of WHITE) whiteKeys.push(base + o * 12 + s);

  return (
    <div className="piano nodrag" onPointerLeave={off} onPointerUp={off}>
      {Array.from({ length: OCTAVES }).map((_, o) => (
        <div className="piano-octave" key={o}>
          {WHITE.map((s, i) => {
            const note = base + o * 12 + s;
            const blackSemi = BLACK[i];
            return (
              <div className="piano-white-wrap" key={s}>
                <button
                  type="button"
                  className="piano-key piano-white"
                  aria-label={`note ${note}`}
                  onPointerDown={() => on(note)}
                />
                {blackSemi !== undefined && (
                  <button
                    type="button"
                    className="piano-key piano-black"
                    aria-label={`note ${base + o * 12 + blackSemi}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      on(base + o * 12 + blackSemi);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
