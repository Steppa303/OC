import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyPatch } from '@amy/patchdoc';
import { usePatchStore } from './patchStore';
import { hpToPx } from './geometry';

function reset() {
  usePatchStore.getState().loadDoc(createEmptyPatch());
}

beforeEach(reset);

describe('patchStore', () => {
  it('adds modules with unique ids and default params', () => {
    const { addModule } = usePatchStore.getState();
    const a = addModule('core.vco', { x: 0, y: 0 });
    const b = addModule('core.vco', { x: 8, y: 0 });
    expect(a).toBe('vco1');
    expect(b).toBe('vco2');
    const doc = usePatchStore.getState().doc;
    expect(doc.modules).toHaveLength(2);
    expect(doc.modules[0]!.params).toMatchObject({ wave: 'saw', coarse: 0 });
  });

  it('selects a freshly added module so it is highlighted (Stufe 1)', () => {
    const store = usePatchStore.getState();
    store.setSelectedEdges(['x']);
    const id = store.addModule('core.vco', { x: 0, y: 0 });
    const state = usePatchStore.getState();
    expect(state.selectedIds).toEqual([id]);
    expect(state.selectedEdgeIds).toEqual([]);
  });

  it('packs modules added at the same spot side by side (no overlap)', () => {
    const { addModule } = usePatchStore.getState();
    addModule('core.vco', { x: 2, y: 0 }); // 8 hp
    addModule('core.vcf', { x: 2, y: 0 }); // pushed right past the vco
    addModule('core.out', { x: 2, y: 1 }); // different row, keeps requested x
    const mods = usePatchStore.getState().doc.modules;
    expect(mods[0]!.pos).toEqual({ x: 2, y: 0 });
    expect(mods[1]!.pos).toEqual({ x: 10, y: 0 });
    expect(mods[2]!.pos).toEqual({ x: 2, y: 1 });
  });

  it('rejects unknown module types', () => {
    expect(usePatchStore.getState().addModule('core.nope', { x: 0, y: 0 })).toBeNull();
    expect(usePatchStore.getState().doc.modules).toHaveLength(0);
  });

  it('commits a drag by snapping ephemeral px to HP/row units', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    // drop near HP=5 (5*24=120), row 1 (~404) with a few px of slop
    store.setDragPx('vco1', { x: 123, y: 410 });
    expect(usePatchStore.getState().dragPx['vco1']).toEqual({ x: 123, y: 410 });
    store.commitDrag();
    const state = usePatchStore.getState();
    expect(state.dragPx).toEqual({});
    expect(state.doc.modules[0]!.pos).toEqual({ x: 5, y: 1 });
  });

  it('renders a committed position back to the same px via geometry', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 3, y: 2 });
    expect(hpToPx(usePatchStore.getState().doc.modules[0]!.pos)).toEqual({ x: 72, y: 808 });
  });

  it('removes modules and their cables and clears selection', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.addModule('core.out', { x: 10, y: 0 });
    usePatchStore.setState((s) => ({
      doc: {
        ...s.doc,
        cables: [
          { id: 'c1', from: { module: 'vco1', jack: 'out' }, to: { module: 'out1', jack: 'in' }, kind: 'audio' },
        ],
      },
    }));
    store.setSelected(['vco1']);
    store.removeModules(['vco1']);
    const state = usePatchStore.getState();
    expect(state.doc.modules.map((m) => m.id)).toEqual(['out1']);
    expect(state.doc.cables).toHaveLength(0);
    expect(state.selectedIds).toEqual([]);
  });

  it('duplicates modules with new ids, offset position, and selects the copies', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vcf', { x: 0, y: 0 });
    store.setParam('vcf1', 'cutoff', 1200);
    const created = store.duplicateModules(['vcf1']);
    expect(created).toEqual(['vcf2']);
    const state = usePatchStore.getState();
    const copy = state.doc.modules.find((m) => m.id === 'vcf2')!;
    expect(copy.pos).toEqual({ x: 8, y: 0 }); // offset by vcf hp (8)
    expect(copy.params['cutoff']).toBe(1200);
    expect(state.selectedIds).toEqual(['vcf2']);
  });

  it('sets params and renames modules', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.setParam('vco1', 'wave', 'square');
    store.renameModule('vco1', 'Sub Osc');
    const m = usePatchStore.getState().doc.modules[0]!;
    expect(m.params['wave']).toBe('square');
    expect(m.label).toBe('Sub Osc');
  });

  it('adds a legal cable and rejects illegal / duplicate ones', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.addModule('core.vcf', { x: 8, y: 0 });
    // audio out -> filter in: legal
    const ok = store.addCable({ module: 'vco1', jack: 'out' }, { module: 'vcf1', jack: 'in' });
    expect(ok.ok).toBe(true);
    expect(usePatchStore.getState().doc.cables).toHaveLength(1);
    expect(usePatchStore.getState().doc.cables[0]!.kind).toBe('audio');

    // audio out -> cv in: kind mismatch
    const mismatch = store.addCable({ module: 'vco1', jack: 'out' }, { module: 'vcf1', jack: 'cutoff_cv' });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toMatch(/audio output to a cv input/);

    // second cable into the same audio input: rejected (fan-in)
    store.addModule('core.noise', { x: 16, y: 0 });
    const full = store.addCable({ module: 'noise1', jack: 'out' }, { module: 'vcf1', jack: 'in' });
    expect(full.ok).toBe(false);
    expect(full.reason).toMatch(/already has a cable/);

    // self-connection rejected
    expect(store.addCable({ module: 'vco1', jack: 'out' }, { module: 'vco1', jack: 'pitch' }).ok).toBe(false);
  });

  it('allows one output to fan out to many inputs', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.addModule('core.vcf', { x: 8, y: 0 });
    store.addModule('core.scope', { x: 16, y: 0 });
    expect(store.addCable({ module: 'vco1', jack: 'out' }, { module: 'vcf1', jack: 'in' }).ok).toBe(true);
    expect(store.addCable({ module: 'vco1', jack: 'out' }, { module: 'scope1', jack: 'in' }).ok).toBe(true);
    expect(usePatchStore.getState().doc.cables).toHaveLength(2);
  });

  it('removes cables and drops cables when a connected module is deleted', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.addModule('core.vcf', { x: 8, y: 0 });
    store.addCable({ module: 'vco1', jack: 'out' }, { module: 'vcf1', jack: 'in' });
    const cableId = usePatchStore.getState().doc.cables[0]!.id;
    store.removeCables([cableId]);
    expect(usePatchStore.getState().doc.cables).toHaveLength(0);

    store.addCable({ module: 'vco1', jack: 'out' }, { module: 'vcf1', jack: 'in' });
    store.removeModules(['vco1']);
    expect(usePatchStore.getState().doc.cables).toHaveLength(0);
  });

  it('undoes and redoes structural changes', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    expect(usePatchStore.getState().doc.modules).toHaveLength(1);
    store.undo();
    expect(usePatchStore.getState().doc.modules).toHaveLength(0);
    store.redo();
    expect(usePatchStore.getState().doc.modules).toHaveLength(1);
  });

  it('coalesces a knob gesture into a single undo step', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vcf', { x: 0, y: 0 });
    // rapid successive edits to the same param = one gesture
    store.setParam('vcf1', 'cutoff', 900);
    store.setParam('vcf1', 'cutoff', 1200);
    store.setParam('vcf1', 'cutoff', 2000);
    expect(usePatchStore.getState().doc.modules[0]!.params['cutoff']).toBe(2000);
    store.undo(); // reverts the whole cutoff gesture at once
    expect(usePatchStore.getState().doc.modules[0]!.params['cutoff']).toBe(800);
    store.undo(); // reverts the add
    expect(usePatchStore.getState().doc.modules).toHaveLength(0);
  });

  it('undoes cable creation and clears redo after a new change', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.addModule('core.vcf', { x: 8, y: 0 });
    store.addCable({ module: 'vco1', jack: 'out' }, { module: 'vcf1', jack: 'in' });
    expect(usePatchStore.getState().doc.cables).toHaveLength(1);
    store.undo();
    expect(usePatchStore.getState().doc.cables).toHaveLength(0);
    // a new change invalidates the redo stack
    store.addModule('core.out', { x: 16, y: 0 });
    store.redo();
    expect(usePatchStore.getState().doc.cables).toHaveLength(0);
  });

  it('keeps the resulting document schema-valid', async () => {
    const { patchDocSchema } = await import('@amy/patchdoc');
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.addModule('core.vcf', { x: 8, y: 0 });
    store.duplicateModules(['vco1']);
    expect(patchDocSchema.safeParse(usePatchStore.getState().doc).success).toBe(true);
  });

  // --- P7-02 QoL actions ---

  it('disconnectJack removes every cable on a jack; highlightJackCables selects them', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.addModule('core.vcf', { x: 8, y: 0 });
    store.addModule('core.out', { x: 16, y: 0 });
    store.addCable({ module: 'vco1', jack: 'out' }, { module: 'vcf1', jack: 'in' });
    store.addCable({ module: 'vcf1', jack: 'out' }, { module: 'out1', jack: 'in' });

    usePatchStore.getState().highlightJackCables('vcf1', 'in');
    expect(usePatchStore.getState().selectedEdgeIds).toHaveLength(1);

    usePatchStore.getState().disconnectJack('vcf1', 'in');
    const cables = usePatchStore.getState().doc.cables;
    expect(cables).toHaveLength(1);
    expect(cables[0]!.from.module).toBe('vcf1');
  });

  it('setModuleColor sets and clears the cosmetic color tag (undoable)', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    usePatchStore.getState().setModuleColor('vco1', 'green');
    expect(usePatchStore.getState().doc.modules[0]!.color).toBe('green');
    usePatchStore.getState().setModuleColor('vco1', undefined);
    expect(usePatchStore.getState().doc.modules[0]!.color).toBeUndefined();
    usePatchStore.getState().undo();
    expect(usePatchStore.getState().doc.modules[0]!.color).toBe('green');
  });

  it('replaceModule swaps type, carries matching params, drops now-invalid cables', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.addModule('core.lfo', { x: 8, y: 0 });
    // cable from lfo.out into a param jack of the vco (an advanced fm/cv input)
    store.addModule('core.out', { x: 16, y: 0 });
    store.addCable({ module: 'vco1', jack: 'out' }, { module: 'out1', jack: 'in' });
    usePatchStore.getState().setParam('vco1', 'coarse', 7);

    usePatchStore.getState().replaceModule('vco1', 'core.lfo');
    const mod = usePatchStore.getState().doc.modules.find((m) => m.id === 'vco1')!;
    expect(mod.type).toBe('core.lfo');
    // 'coarse' isn't an LFO param → dropped; shared param ids survive if any
    expect(mod.params).not.toHaveProperty('coarse');
    // vco1 'out' jack still exists on lfo → cable kept
    expect(usePatchStore.getState().doc.cables).toHaveLength(1);
  });

  it('copyModuleParams / pasteModuleParams only apply between same-type modules', () => {
    const store = usePatchStore.getState();
    store.addModule('core.vco', { x: 0, y: 0 });
    store.addModule('core.vco', { x: 8, y: 0 });
    store.addModule('core.vcf', { x: 16, y: 0 });
    usePatchStore.getState().setParam('vco1', 'coarse', 12);

    usePatchStore.getState().copyModuleParams('vco1');
    expect(usePatchStore.getState().pasteModuleParams('vco2')).toBe(true);
    expect(usePatchStore.getState().doc.modules.find((m) => m.id === 'vco2')!.params['coarse']).toBe(12);
    // wrong type → refused
    expect(usePatchStore.getState().pasteModuleParams('vcf1')).toBe(false);
  });

  it('setCableTidy flips the tidy flag', () => {
    usePatchStore.getState().setCableTidy(true);
    expect(usePatchStore.getState().cableTidy).toBe(true);
    usePatchStore.getState().setCableTidy(false);
    expect(usePatchStore.getState().cableTidy).toBe(false);
  });
});
