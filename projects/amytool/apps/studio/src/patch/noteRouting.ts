/**
 * Note routing (Stufe 3). A live keyboard / external-MIDI note plays the
 * oscillator & voice modules the note source is *cabled* to. When no keyboard
 * (or MIDI-in) note cable exists anywhere, notes play every voice/oscillator —
 * the pre-Stufe-3 behavior — so uncabled patches keep working.
 *
 * Sequencer note cables are handled separately in `compileToWire` (§5) and do
 * NOT constrain live keyboard play, so a sequenced drum voice doesn't swallow
 * the keyboard.
 */
import type { ModuleInfoProvider, PatchDoc } from '@amy/patchdoc';

/** A module is a live note *source* if it's an IO module with a midi output
 *  (the on-screen keyboard, external MIDI-in) — not a sequencer. */
function isKeyboardSource(type: string, provider: ModuleInfoProvider): boolean {
  const info = provider(type);
  return !!info && info.role === 'io' && info.jacks.some((j) => j.kind === 'midi' && j.dir === 'out');
}

/**
 * The set of module ids that live keyboard notes should play, or `null` to play
 * everything (no keyboard note cable present). Targets are the modules a
 * keyboard/MIDI-in `notes` output is cabled to.
 */
export function noteSinkModules(doc: PatchDoc, provider: ModuleInfoProvider): Set<string> | null {
  const sourceIds = new Set(
    doc.modules.filter((m) => isKeyboardSource(m.type, provider)).map((m) => m.id),
  );
  const cables = doc.cables.filter((c) => c.kind === 'midi' && sourceIds.has(c.from.module));
  if (cables.length === 0) return null;
  return new Set(cables.map((c) => c.to.module));
}
