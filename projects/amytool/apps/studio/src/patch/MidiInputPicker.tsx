import { useCallback } from 'react';
import { useEngine } from './engine';
import { usePatchStore } from './patchStore';
import { useMidiInput, type NoteEvent } from './midiInput';

/**
 * External MIDI input device picker (P4-01). Notes from the chosen device pass
 * through to the engine/board on the patch's configured MIDI channel.
 */
export function MidiInputPicker() {
  const { playNote } = useEngine();
  const channel = usePatchStore((s) => s.doc.io.midiChannel);

  const onNote = useCallback((e: NoteEvent) => playNote(e.note, e.vel, e.on), [playNote]);
  const midi = useMidiInput(onNote, channel);

  if (!midi.supported) return null;

  return (
    <label className="midi-input-picker" title="External MIDI input device">
      <span>MIDI in</span>
      <select
        data-testid="midi-input"
        value={midi.selectedId}
        onChange={(e) => midi.select(e.target.value)}
      >
        <option value="">none</option>
        {midi.inputs.map((input) => (
          <option key={input.id} value={input.id}>
            {input.name}
          </option>
        ))}
      </select>
    </label>
  );
}
