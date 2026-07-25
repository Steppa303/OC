import { StepGrid } from '@amy/ui';
import { usePatchStore } from './patchStore';

const STEPS = 16;

/** GM drum sounds selectable per track (note → label). */
const DRUM_PRESETS: { note: number; label: string }[] = [
  { note: 36, label: 'Kick' },
  { note: 38, label: 'Snare' },
  { note: 37, label: 'Rim' },
  { note: 39, label: 'Clap' },
  { note: 42, label: 'Closed Hat' },
  { note: 46, label: 'Open Hat' },
  { note: 45, label: 'Low Tom' },
  { note: 50, label: 'Hi Tom' },
  { note: 49, label: 'Crash' },
  { note: 51, label: 'Ride' },
];
const DRUM_DEFAULTS = [36, 38, 42, 39];

interface Track {
  note: number;
  vel: number;
  steps: boolean[];
  notes?: number[];
}

function normSteps(raw: unknown): boolean[] {
  const arr = Array.isArray(raw) ? raw.map(Boolean) : [];
  return Array.from({ length: STEPS }, (_, i) => arr[i] ?? false);
}

function readTracks(state: Record<string, unknown>, count: number, defaults: number[]): Track[] {
  const raw = Array.isArray(state['tracks']) ? (state['tracks'] as Record<string, unknown>[]) : [];
  return Array.from({ length: count }, (_, i) => {
    const t = raw[i] ?? {};
    const notes = Array.isArray(t['notes'])
      ? Array.from({ length: STEPS }, (_, j) => Number((t['notes'] as unknown[])[j] ?? 60))
      : undefined;
    return {
      note: Number(t['note'] ?? defaults[i] ?? 36),
      vel: Number(t['vel'] ?? 1),
      steps: normSteps(t['steps']),
      ...(notes ? { notes } : {}),
    };
  });
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (n: number) => `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;

// --- Drum grid -------------------------------------------------------------

let drumClipboard: Track[] | null = null;

export function DrumGrid({ moduleId }: { moduleId: string }) {
  const state = usePatchStore((s) => s.doc.modules.find((m) => m.id === moduleId)?.state ?? {});
  const setModuleState = usePatchStore((s) => s.setModuleState);
  const tracks = readTracks(state, 4, DRUM_DEFAULTS);

  const write = (next: Track[]) => setModuleState(moduleId, { tracks: next });

  const toggle = (r: number, c: number) => {
    const next = tracks.map((t, i) => (i === r ? { ...t, steps: t.steps.map((s, j) => (j === c ? !s : s)) } : t));
    write(next);
  };
  const setVoice = (r: number, note: number) => write(tracks.map((t, i) => (i === r ? { ...t, note } : t)));
  const clear = () => write(tracks.map((t) => ({ ...t, steps: Array(STEPS).fill(false) })));
  const copy = () => {
    drumClipboard = tracks.map((t) => ({ ...t, steps: [...t.steps] }));
  };
  const paste = () => {
    if (drumClipboard) write(drumClipboard.map((t) => ({ ...t, steps: [...t.steps] })));
  };

  return (
    <div className="nodrag drum-grid">
      <div className="drum-grid-voices">
        {tracks.map((t, r) => (
          <select
            key={r}
            aria-label={`track ${r + 1} voice`}
            value={t.note}
            onChange={(e) => setVoice(r, Number(e.target.value))}
          >
            {DRUM_PRESETS.map((d) => (
              <option key={d.note} value={d.note}>
                {d.label}
              </option>
            ))}
          </select>
        ))}
      </div>
      <StepGrid
        rows={4}
        cols={STEPS}
        cells={tracks.map((t) => t.steps)}
        rowLabels={tracks.map((t) => DRUM_PRESETS.find((d) => d.note === t.note)?.label ?? String(t.note))}
        onToggle={toggle}
      />
      <div className="drum-grid-actions">
        <button type="button" data-testid="drum-clear" onClick={clear}>
          Clear
        </button>
        <button type="button" data-testid="drum-copy" onClick={copy}>
          Copy
        </button>
        <button type="button" data-testid="drum-paste" onClick={paste}>
          Paste
        </button>
      </div>
    </div>
  );
}

// --- Step sequencer (pitch/gate) -------------------------------------------

export function StepSeq({ moduleId }: { moduleId: string }) {
  const module = usePatchStore((s) => s.doc.modules.find((m) => m.id === moduleId));
  const setModuleState = usePatchStore((s) => s.setModuleState);
  const octave = Number(module?.params['octave'] ?? 4);
  const base = 12 * (octave + 1); // MIDI note for C at this octave

  const track = readTracks(module?.state ?? {}, 1, [base])[0] ?? { note: base, vel: 1, steps: normSteps(undefined) };
  const notes = track.notes ?? Array.from({ length: STEPS }, () => base);

  const write = (steps: boolean[], nextNotes: number[]) =>
    setModuleState(moduleId, { tracks: [{ note: base, vel: 1, steps, notes: nextNotes }] });

  const toggle = (_r: number, c: number) => write(track.steps.map((s, j) => (j === c ? !s : s)), notes);
  const shift = (c: number, delta: number) =>
    write(track.steps, notes.map((n, j) => (j === c ? Math.max(0, Math.min(127, n + delta)) : n)));

  return (
    <div className="nodrag stepseq">
      <StepGrid rows={1} cols={STEPS} cells={[track.steps]} onToggle={toggle} />
      <div className="stepseq-pitches">
        {notes.map((n, c) => (
          <button
            key={c}
            type="button"
            className={track.steps[c] ? 'stepseq-pitch on' : 'stepseq-pitch'}
            aria-label={`step ${c + 1} pitch`}
            title="click +1, right-click −1 semitone"
            onClick={() => shift(c, 1)}
            onContextMenu={(e) => {
              e.preventDefault();
              shift(c, -1);
            }}
          >
            {noteName(n)}
          </button>
        ))}
      </div>
    </div>
  );
}
