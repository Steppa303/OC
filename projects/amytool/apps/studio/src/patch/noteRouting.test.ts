import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyPatch } from '@amy/patchdoc';
import { usePatchStore } from './patchStore';
import { moduleInfoProvider } from './routing';
import { noteSinkModules } from './noteRouting';

beforeEach(() => usePatchStore.getState().loadDoc(createEmptyPatch()));

describe('noteSinkModules (Stufe 3)', () => {
  it('returns null (play everything) when no keyboard note cable exists', () => {
    const s = usePatchStore.getState();
    s.addModule('core.keyboard', { x: 0, y: 0 });
    s.addModule('core.vco', { x: 8, y: 0 });
    expect(noteSinkModules(usePatchStore.getState().doc, moduleInfoProvider)).toBeNull();
  });

  it('routes keyboard notes to only the cabled oscillator', () => {
    const s = usePatchStore.getState();
    const keys = s.addModule('core.keyboard', { x: 0, y: 0 })!;
    const vco1 = s.addModule('core.vco', { x: 8, y: 0 })!;
    s.addModule('core.vco', { x: 16, y: 0 });
    const res = s.addCable({ module: keys, jack: 'notes' }, { module: vco1, jack: 'notes' });
    expect(res.ok).toBe(true);
    expect(noteSinkModules(usePatchStore.getState().doc, moduleInfoProvider)).toEqual(new Set([vco1]));
  });

  it('routes to a cabled preset voice', () => {
    const s = usePatchStore.getState();
    const keys = s.addModule('core.keyboard', { x: 0, y: 0 })!;
    const voice = s.addModule('core.junovoice', { x: 8, y: 0 })!;
    s.addCable({ module: keys, jack: 'notes' }, { module: voice, jack: 'notes' });
    expect(noteSinkModules(usePatchStore.getState().doc, moduleInfoProvider)).toEqual(new Set([voice]));
  });

  it('ignores sequencer note cables — only keyboard/MIDI-in count', () => {
    const s = usePatchStore.getState();
    const grid = s.addModule('core.drumgrid', { x: 0, y: 0 })!;
    const voice = s.addModule('core.drumvoice', { x: 0, y: 1 })!;
    s.addCable({ module: grid, jack: 'notes' }, { module: voice, jack: 'notes' });
    // a sequencer→voice cable must not constrain live keyboard play
    expect(noteSinkModules(usePatchStore.getState().doc, moduleInfoProvider)).toBeNull();
  });
});
