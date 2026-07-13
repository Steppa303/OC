// ─── Patch from Board ─────────────────────────────────────────────────
// Loads a patch from the AMYboard by requesting a zDZ state dump and
// parsing the result. Falls back to factory patches if the board is not
// connected or the dump fails.

import { amyConnection } from '@/lib/amy-connection';
import { ALL_PATCHES, JUNO_PATCHES, DX7_PATCHES, getPatchName, PATCHES_BY_ID } from '@/lib/amy-patches';
import { parseDumpToPatch } from './dump-parser';
import type { AmyPatch, AmyOscState } from '@/types/amy';

const DUMP_TIMEOUT = 12000;

/**
 * Load a patch from the connected AMYboard.
 *
 * Strategy:
 * 1. If WebMIDI is connected, call amyConnection.dumpState() and parse
 * 2. If that fails (timeout, error, or not connected), return null
 *    (caller should show the factory-patch fallback UI)
 *
 * @returns The parsed AmyPatch, or null if the board is unavailable
 */
export async function loadPatchFromBoard(): Promise<AmyPatch | null> {
  // Check if MIDI is connected
  if (amyConnection.state !== 'connected') {
    return null;
  }

  try {
    const rawDump = await amyConnection.dumpState(DUMP_TIMEOUT);
    if (!rawDump || rawDump.length === 0) {
      return null;
    }
    return parseDumpToPatch(rawDump);
  } catch (err) {
    console.warn('[loadPatchFromBoard] Dump failed:', err);
    return null;
  }
}

/**
 * Create a minimal patch from a factory patch number (fallback path).
 * Used when MIDI is not connected or dump fails.
 */
export function factoryPatchFromNumber(patchNumber: number): AmyPatch {
  const entry = PATCHES_BY_ID[patchNumber];
  const name = entry?.name ?? getPatchName(patchNumber);
  const category = entry?.category ?? 'juno';

  // Map category to AmyPatch category
  const patchCategory: AmyPatch['category'] =
    category === 'piano' ? 'pcm' :
    category === 'drums' ? 'pcm' :
    category === 'dx7' ? 'dx7' :
    category === 'juno' ? 'juno' :
    'user';

  // Determine default oscillator count based on category
  const numOscs = category === 'dx7' ? 6 : 2;

  const oscillators: AmyOscState[] = [];
  for (let o = 0; o < numOscs; o++) {
    oscillators.push({
      osc: o,
      wave: 0 as any, // SINE default for juno; will be overridden per category
      freq: { const: 220 * (o + 1) },
      amp: { const: 0.8 - o * 0.15 },
      pan: { const: 0.5 },
      filter_freq: { const: 8000 },
      duty: { const: 0.5 },
      filter_type: o < 2 ? 1 as any : 0 as any, // LPF on first 2 oscs
      resonance: 0.7,
      bp0: o === 0 ? '50,1,200,0.5,300,0' : '',
      bp1: '',
      eg0_type: 0,
      eg1_type: 0,
      mod_source: -1,
      feedback: 0,
      bus: 0,
      chained_osc: 0,
      phase: 0,
    });
  }

  // DX7 patches get FM algo wave and 6 operators
  if (category === 'dx7') {
    for (let o = 0; o < 6; o++) {
      oscillators[o] = {
        ...oscillators[o],
        osc: o,
        wave: 8 as any, // ALGO = FM algorithm
        freq: { const: [440, 220, 660, 110, 880, 330][o] ?? 440 },
        amp: { const: [0.8, 0.4, 0.6, 0.3, 0.2, 0.5][o] ?? 0.5 },
        bus: o === 0 ? 0 : 0,
        chained_osc: o > 0 ? o - 1 : 0,
      };
    }
  }

  const patch: AmyPatch = {
    id: `factory-${patchNumber}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    author: category === 'juno' ? 'Roland Juno-106' : category === 'dx7' ? 'Yamaha DX7' : 'AMY',
    category: patchCategory,
    tags: [category, 'factory'],
    state: {
      oscillators,
      synths: [{
        synth: 0,
        patch: patchNumber,
        num_voices: 6,
        oscs_per_voice: category === 'dx7' ? 1 : 1,
        midi_channel: 1,
        portamento: 0,
        synth_delay: 0,
      }],
      effects: [],
    },
    wireCommands: [`i0K${patchNumber}Z`],
    created: Date.now(),
    modified: Date.now(),
    boardSlot: patchNumber,
  };

  return patch;
}

export type {  };