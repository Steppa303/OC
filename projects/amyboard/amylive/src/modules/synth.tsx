// ─── Synth Manager Module ─────────────────────────────────────────────
// Patch browser, MIDI keyboard pads, synth config (voices, ch, portamento).
// Calls onSendWire with AMY wire protocol to load patches & play notes.

import { useState, useCallback, useMemo } from 'react';
import {
  Radio,
  Search,
  Music,
  Keyboard,
  Drum,
  Volume2,
} from 'lucide-react';
import { ModuleWrapper } from '../components/ModuleWrapper';
import type { ModuleProps } from '../types/amy';
import {
  ALL_PATCHES,
  JUNO_PATCHES,
  DX7_PATCHES,
  PIANO_PATCH,
  DRUM_PATCHES,
  getEmptyUserSlots,
  getPatchName,
  type PatchEntry,
} from '../lib/amy-patches';

// ── Constants ─────────────────────────────────────────────────────────
const MIDI_NOTES = [
  { note: 60, label: 'C4' },
  { note: 61, label: 'C#4' },
  { note: 62, label: 'D4' },
  { note: 63, label: 'D#4' },
  { note: 64, label: 'E4' },
  { note: 65, label: 'F4' },
  { note: 66, label: 'F#4' },
  { note: 67, label: 'G4' },
  { note: 68, label: 'G#4' },
  { note: 69, label: 'A4' },
  { note: 70, label: 'A#4' },
  { note: 71, label: 'B4' },
  { note: 72, label: 'C5' },
];

const NOTE_NAMES: Record<number, string> = {};
for (const n of MIDI_NOTES) {
  NOTE_NAMES[n.note] = n.label;
}

const CATEGORIES: { key: string; label: string; icon: typeof Radio }[] = [
  { key: 'all', label: 'All', icon: Music },
  { key: 'juno', label: 'Juno-6', icon: Radio },
  { key: 'dx7', label: 'DX7', icon: Keyboard },
  { key: 'drums', label: 'Drums', icon: Drum },
  { key: 'piano', label: 'Piano', icon: Music },
];

// ── Component ─────────────────────────────────────────────────────────
export function SynthModule({
  id,
  params,
  onParamChange,
  onSendWire,
}: ModuleProps) {
  const synth = params.synth ?? 0;
  const numVoices = params.num_voices ?? 6;
  const currentPatch = params.patch ?? 0;
  const midiCh = params.midiCh ?? 1;
  const portamento = params.portamento ?? 0;

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showBrowser, setShowBrowser] = useState(false);

  const activePatchName = getPatchName(currentPatch);

  // ── Filter patches ──────────────────────────────────────────────────
  const filteredPatches = useMemo(() => {
    let list: PatchEntry[];
    switch (category) {
      case 'juno': list = JUNO_PATCHES; break;
      case 'dx7': list = DX7_PATCHES; break;
      case 'drums': list = DRUM_PATCHES; break;
      case 'piano': list = [PIANO_PATCH]; break;
      default: list = ALL_PATCHES; break;
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.number.toString().includes(q),
    );
  }, [category, search]);

  // ── Send AMY wire ───────────────────────────────────────────────────
  const sendWire = useCallback(
    (wire: string) => {
      if (onSendWire) onSendWire(wire);
    },
    [onSendWire],
  );

  const loadPatch = useCallback(
    (patchNum: number) => {
      onParamChange('patch', patchNum);
      sendWire(`i${synth}K${patchNum}Z`);
      setShowBrowser(false);
    },
    [synth, onParamChange, sendWire],
  );

  const noteOn = useCallback(
    (note: number) => {
      setActiveNotes((prev) => new Set(prev).add(note));
      sendWire(`i${synth}n${note}l100Z`);
    },
    [synth, sendWire],
  );

  const noteOff = useCallback(
    (note: number) => {
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(note);
        return next;
      });
      sendWire(`i${synth}n${note}l0Z`);
    },
    [synth, sendWire],
  );

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <ModuleWrapper
      id={id}
      title={`Synth ${synth}`}
      icon={<Radio size={14} />}
    >
      <div className="space-y-2">
        {/* ── Top Bar: Current Patch ─────────────────────────────────── */}
        <button
          onClick={() => setShowBrowser(!showBrowser)}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[var(--color-primary-dim)]/10 hover:bg-[var(--color-primary-dim)]/20 border border-[var(--color-primary-dim)]/20 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Radio size={12} className="text-[var(--color-primary)] shrink-0" />
            <span className="text-xs font-medium truncate">
              {activePatchName}
            </span>
            <span className="text-[9px] font-mono text-[var(--color-text-muted)] shrink-0">
              #{currentPatch}
            </span>
          </div>
          <span className="text-[10px] text-[var(--color-text-dim)]">
            {showBrowser ? '▼' : '▲'} Browse
          </span>
        </button>

        {/* ── Patch Browser ──────────────────────────────────────────── */}
        {showBrowser && (
          <div className="space-y-2">
            {/* Search + Category */}
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <Search
                  size={10}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patches..."
                  className="w-full text-[10px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded pl-5 pr-1.5 py-1 outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Category Chips */}
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full transition-colors ${
                      category === cat.key
                        ? 'bg-[var(--color-primary-dim)] text-white'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Icon size={10} />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Patch List */}
            <div className="max-h-40 overflow-y-auto space-y-0.5 border border-[var(--color-border)] rounded-lg p-1">
              {filteredPatches.length === 0 ? (
                <p className="text-[10px] text-[var(--color-text-muted)] text-center py-3">
                  No patches found
                </p>
              ) : (
                filteredPatches.map((p) => (
                  <button
                    key={p.number}
                    onClick={() => loadPatch(p.number)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] transition-colors text-left ${
                      currentPatch === p.number
                        ? 'bg-[var(--color-primary-dim)]/20 text-[var(--color-primary)]'
                        : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text)]'
                    }`}
                  >
                    <span className="font-mono text-[9px] text-[var(--color-text-muted)] w-8 shrink-0">
                      #{p.number}
                    </span>
                    <span className="truncate flex-1">{p.name}</span>
                    <span className="text-[8px] uppercase text-[var(--color-text-dim)]">
                      {p.category}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Synth Config ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label className="text-[9px] text-[var(--color-text-muted)] block mb-0.5">
              Synth
            </label>
            <select
              value={synth}
              onChange={(e) => onParamChange('synth', Number(e.target.value))}
              className="w-full text-[10px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1.5 py-1 outline-none"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => (
                <option key={s} value={s}>
                  #{s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-[var(--color-text-muted)] block mb-0.5">
              Voices
            </label>
            <select
              value={numVoices}
              onChange={(e) =>
                onParamChange('num_voices', Number(e.target.value))
              }
              className="w-full text-[10px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1.5 py-1 outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 8, 12, 16].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-[var(--color-text-muted)] block mb-0.5">
              MIDI CH
            </label>
            <select
              value={midiCh}
              onChange={(e) => onParamChange('midiCh', Number(e.target.value))}
              className="w-full text-[10px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1.5 py-1 outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
                (ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        {/* Portamento */}
        <div className="flex items-center gap-2">
          <label className="text-[9px] text-[var(--color-text-muted)] shrink-0">
            Portamento
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={portamento}
            onChange={(e) =>
              onParamChange('portamento', Number(e.target.value))
            }
            className="flex-1 h-1 accent-[var(--color-primary)]"
          />
          <span className="text-[9px] font-mono text-[var(--color-text-dim)] w-6 text-right">
            {portamento}
          </span>
        </div>

        {/* ── MIDI Keyboard Pads ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-[var(--color-text-muted)]">
              Keyboard
            </span>
            <span className="text-[9px] text-[var(--color-text-dim)]">
              {activeNotes.size > 0
                ? Array.from(activeNotes)
                    .sort()
                    .map((n) => NOTE_NAMES[n] ?? `#${n}`)
                    .join(' ')
                : '—'}
            </span>
          </div>
          <div className="flex gap-px">
            {MIDI_NOTES.map(({ note, label }) => {
              const isActive = activeNotes.has(note);
              const isBlack = label.includes('#');
              return (
                <button
                  key={note}
                  onMouseDown={() => noteOn(note)}
                  onMouseUp={() => noteOff(note)}
                  onMouseLeave={() => {
                    if (activeNotes.has(note)) noteOff(note);
                  }}
                  className={`flex-1 h-10 rounded text-[8px] font-mono transition-all ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white scale-95'
                      : isBlack
                        ? 'bg-gray-700 text-[var(--color-text-dim)] hover:bg-gray-600'
                        : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Quick Note Buttons ─────────────────────────────────────── */}
        <div className="flex gap-1">
          {[48, 60, 72, 84].map((note) => (
            <button
              key={note}
              onMouseDown={() => noteOn(note)}
              onMouseUp={() => noteOff(note)}
              onMouseLeave={() => {
                if (activeNotes.has(note)) noteOff(note);
              }}
              className={`flex-1 py-2 rounded text-[9px] font-mono transition-colors ${
                activeNotes.has(note)
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface)]'
              }`}
            >
              {NOTE_NAMES[note]}
            </button>
          ))}
        </div>

        {/* ── All Notes Off ──────────────────────────────────────────── */}
        {activeNotes.size > 0 && (
          <button
            onClick={() => {
              for (const n of activeNotes) {
                sendWire(`i${synth}n${n}l0Z`);
              }
              setActiveNotes(new Set());
            }}
            className="w-full py-1 rounded text-[9px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            All Notes Off ({activeNotes.size} active)
          </button>
        )}
      </div>
    </ModuleWrapper>
  );
}

// ── Default params ────────────────────────────────────────────────────
export const synthDefaults = {
  synth: 0,
  patch: 0,
  num_voices: 6,
  midiCh: 1,
  portamento: 0,
};