import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyPatch } from '@amy/patchdoc';
import { usePatchStore } from './patchStore';
import { moduleInfoProvider } from './routing';
import { buildModLoop, modSourceValue, scriptedMods } from './scriptedMods';

beforeEach(() => usePatchStore.getState().loadDoc(createEmptyPatch()));

/** Build a keyboard-aftertouch → echo-feedback patch, return ids. */
function aftertouchToEcho() {
  const s = usePatchStore.getState();
  const keys = s.addModule('core.keyboard', { x: 0, y: 0 })!;
  const echo = s.addModule('core.fx.echo', { x: 8, y: 0 })!;
  const res = s.addCable({ module: keys, jack: 'aftertouch' }, { module: echo, jack: 'fb_cv' });
  return { keys, echo, res };
}

describe('scriptedMods (Stufe 5)', () => {
  it('accepts a cv cable into a non-coef (effect) target', () => {
    const { res } = aftertouchToEcho();
    expect(res.ok).toBe(true);
  });

  it('derives a deterministic scripted mod for the echo feedback cable', () => {
    const { keys, echo } = aftertouchToEcho();
    const mods = scriptedMods(usePatchStore.getState().doc, moduleInfoProvider);
    expect(mods).toHaveLength(1);
    expect(mods[0]).toMatchObject({
      varName: 'mod1',
      source: { module: keys, jack: 'aftertouch' },
      target: { module: echo, type: 'core.fx.echo', param: 'feedback' },
    });
  });

  it('ignores native coef cv cables (LFO → filter cutoff)', () => {
    const s = usePatchStore.getState();
    const lfo = s.addModule('core.lfo', { x: 0, y: 0 })!;
    const vcf = s.addModule('core.vcf', { x: 8, y: 0 })!;
    s.addCable({ module: lfo, jack: 'out' }, { module: vcf, jack: 'cutoff_cv' });
    expect(scriptedMods(usePatchStore.getState().doc, moduleInfoProvider)).toHaveLength(0);
  });

  it('builds a loop that writes echo feedback from the variable', () => {
    aftertouchToEcho();
    const built = buildModLoop(usePatchStore.getState().doc, moduleInfoProvider);
    expect(built).not.toBeNull();
    expect(built!.code).toContain('mod1 = 0.0');
    expect(built!.code).toContain('def loop():');
    // feedback slot (4th) is the variable; other slots are the echo's static params
    expect(built!.code).toMatch(/amy\.send\(echo=\[0\.4, 300, 2000, mod1, 0\]\)/);
  });

  it('returns null when there are no scripted mods', () => {
    usePatchStore.getState().addModule('core.vco', { x: 0, y: 0 });
    expect(buildModLoop(usePatchStore.getState().doc, moduleInfoProvider)).toBeNull();
  });

  it('reads the keyboard pressure macro as the aftertouch source value', () => {
    const { keys } = aftertouchToEcho();
    usePatchStore.getState().setParam(keys, 'pressure', 0.8);
    const mods = scriptedMods(usePatchStore.getState().doc, moduleInfoProvider);
    expect(modSourceValue(usePatchStore.getState().doc, mods[0]!)).toBeCloseTo(0.8);
  });
});
