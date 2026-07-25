import { useEffect, useRef, useState } from 'react';

/** Minimal Web MIDI input surface (not in lib.dom). */
interface MidiMessageEvent {
  data: Uint8Array;
}
interface MidiInputPort {
  id: string;
  name: string | null;
  onmidimessage: ((event: MidiMessageEvent) => void) | null;
}
interface MidiAccess {
  inputs: Map<string, MidiInputPort>;
  onstatechange: ((event: unknown) => void) | null;
}
type RequestMidiAccess = (options?: { sysex?: boolean }) => Promise<MidiAccess>;

export interface MidiInputInfo {
  id: string;
  name: string;
}

export interface NoteEvent {
  note: number;
  /** 0..1 */
  vel: number;
  on: boolean;
}

/**
 * Parse a raw MIDI message into a note event on the given channel (1–16), or null
 * if it's not a note on/off for that channel. Channel routing per PatchDoc `io`.
 */
export function parseMidiMessage(data: Uint8Array, channel: number): NoteEvent | null {
  const status = data[0];
  if (status === undefined || status < 0x80) return null;
  const type = status & 0xf0;
  const ch = status & 0x0f;
  if (ch !== channel - 1) return null;
  const note = data[1] ?? 0;
  const velByte = data[2] ?? 0;
  if (type === 0x90 && velByte > 0) return { note, vel: velByte / 127, on: true };
  if (type === 0x80 || (type === 0x90 && velByte === 0)) return { note, vel: 0, on: false };
  return null;
}

function getRequestMidiAccess(): RequestMidiAccess | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { requestMIDIAccess?: RequestMidiAccess };
  return typeof nav.requestMIDIAccess === 'function' ? nav.requestMIDIAccess.bind(nav) : null;
}

export interface MidiInputController {
  supported: boolean;
  inputs: MidiInputInfo[];
  selectedId: string;
  select: (id: string) => void;
}

/**
 * Subscribe to an external Web MIDI input device and forward its note on/offs
 * (filtered to `channel`) to `onNote`. Feature-detected; no-op without Web MIDI.
 */
export function useMidiInput(onNote: (event: NoteEvent) => void, channel: number): MidiInputController {
  const [supported, setSupported] = useState(false);
  const [inputs, setInputs] = useState<MidiInputInfo[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const accessRef = useRef<MidiAccess | null>(null);
  const onNoteRef = useRef(onNote);
  const channelRef = useRef(channel);
  onNoteRef.current = onNote;
  channelRef.current = channel;

  useEffect(() => {
    const request = getRequestMidiAccess();
    if (!request) {
      setSupported(false);
      return;
    }
    setSupported(true);
    let cancelled = false;
    void request()
      .then((access) => {
        if (cancelled) return;
        accessRef.current = access;
        const refresh = () => setInputs([...access.inputs.values()].map((p) => ({ id: p.id, name: p.name ?? p.id })));
        refresh();
        access.onstatechange = refresh;
      })
      .catch(() => setSupported(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const port = accessRef.current?.inputs.get(selectedId);
    if (!port) return;
    const handler = (event: MidiMessageEvent) => {
      const parsed = parseMidiMessage(event.data, channelRef.current);
      if (parsed) onNoteRef.current(parsed);
    };
    port.onmidimessage = handler;
    return () => {
      if (port.onmidimessage === handler) port.onmidimessage = null;
    };
  }, [selectedId, inputs]);

  return { supported, inputs, selectedId, select: setSelectedId };
}
