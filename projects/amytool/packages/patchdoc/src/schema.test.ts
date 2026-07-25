import { createEmptyPatch, patchDocSchema, type PatchDoc } from './schema';
import { exportPatchFile, importPatchFile, PatchFileError } from './file';

function subtractiveFixture(): PatchDoc {
  const doc = createEmptyPatch('Test Subtractive');
  doc.modules.push(
    {
      id: 'midi1',
      type: 'core.midiin',
      label: 'MIDI In',
      pos: { x: 0, y: 0 },
      params: {},
      advanced: false,
      state: {},
    },
    {
      id: 'vco1',
      type: 'core.vco',
      label: 'VCO 1',
      pos: { x: 4, y: 0 },
      params: { wave: 'saw', coarse: 0 },
      advanced: false,
      state: {},
    },
    {
      id: 'vcf1',
      type: 'core.vcf',
      label: 'VCF',
      pos: { x: 12, y: 0 },
      params: { cutoff: 800, resonance: 0.7, type: 'lowpass' },
      advanced: false,
      state: {},
    },
    {
      id: 'out1',
      type: 'core.out',
      label: 'Out',
      pos: { x: 20, y: 0 },
      params: {},
      advanced: false,
      state: {},
    },
  );
  doc.cables.push(
    { id: 'c1', from: { module: 'midi1', jack: 'notes' }, to: { module: 'vco1', jack: 'pitch' }, kind: 'midi' },
    { id: 'c2', from: { module: 'vco1', jack: 'out' }, to: { module: 'vcf1', jack: 'in' }, kind: 'audio' },
    { id: 'c3', from: { module: 'vcf1', jack: 'out' }, to: { module: 'out1', jack: 'in' }, kind: 'audio' },
  );
  return patchDocSchema.parse(doc);
}

describe('patchDocSchema', () => {
  it('accepts a valid subtractive patch and fills defaults', () => {
    const doc = subtractiveFixture();
    expect(doc.globals.tempo).toBe(108);
    expect(doc.io.midiChannel).toBe(1);
    expect(doc.extras.userLoopCode).toBeNull();
  });

  it('rejects duplicate module ids', () => {
    const doc = subtractiveFixture();
    doc.modules.push({ ...doc.modules[1]!, pos: { x: 30, y: 0 } });
    const res = patchDocSchema.safeParse(doc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message.includes("duplicate module id 'vco1'"))).toBe(true);
    }
  });

  it('rejects cables to unknown modules', () => {
    const doc = subtractiveFixture();
    doc.cables.push({ id: 'c4', from: { module: 'ghost', jack: 'out' }, to: { module: 'out1', jack: 'in2' }, kind: 'audio' });
    const res = patchDocSchema.safeParse(doc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message.includes("unknown module 'ghost'"))).toBe(true);
    }
  });

  it('rejects a second cable into the same non-midi input jack', () => {
    const doc = subtractiveFixture();
    doc.cables.push({ id: 'c5', from: { module: 'vco1', jack: 'out' }, to: { module: 'out1', jack: 'in' }, kind: 'audio' });
    const res = patchDocSchema.safeParse(doc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message.includes("input jack 'out1.in' already has a cable"))).toBe(true);
    }
  });

  it('allows multiple midi cables into one input (merge rule)', () => {
    const doc = subtractiveFixture();
    doc.modules.push({ id: 'kbd1', type: 'core.keyboard', label: 'Keys', pos: { x: 0, y: 1 }, params: {}, advanced: false, state: {} });
    doc.cables.push({ id: 'c6', from: { module: 'kbd1', jack: 'notes' }, to: { module: 'vco1', jack: 'pitch' }, kind: 'midi' });
    expect(patchDocSchema.safeParse(doc).success).toBe(true);
  });

  it('rejects bad module ids and types', () => {
    const doc = subtractiveFixture();
    doc.modules[0]!.id = 'Bad-Id';
    expect(patchDocSchema.safeParse(doc).success).toBe(false);
    const doc2 = subtractiveFixture();
    doc2.modules[0]!.type = 'evil.module';
    expect(patchDocSchema.safeParse(doc2).success).toBe(false);
  });
});

describe('.amypatch file round-trip', () => {
  it('export → import yields an equal document', () => {
    const doc = subtractiveFixture();
    const imported = importPatchFile(exportPatchFile(doc));
    expect(imported).toEqual(doc);
  });

  it('rejects invalid JSON with a friendly error', () => {
    expect(() => importPatchFile('not json')).toThrow(PatchFileError);
    expect(() => importPatchFile('not json')).toThrow(/invalid JSON/);
  });

  it('rejects version 0 files with a friendly error', () => {
    const doc = subtractiveFixture() as unknown as Record<string, unknown>;
    const text = JSON.stringify({ ...doc, version: 0 });
    expect(() => importPatchFile(text)).toThrow(/missing or invalid "version"|no migration path/);
  });

  it('rejects files from a newer app version', () => {
    const doc = subtractiveFixture() as unknown as Record<string, unknown>;
    const text = JSON.stringify({ ...doc, version: 99 });
    expect(() => importPatchFile(text)).toThrow(/newer version/);
  });

  it('reports schema issues with paths', () => {
    const doc = subtractiveFixture();
    const raw = JSON.parse(exportPatchFile(doc)) as { modules: { pos: unknown }[] };
    raw.modules[0]!.pos = 'nope';
    expect(() => importPatchFile(JSON.stringify(raw))).toThrow(/modules.0.pos/);
  });
});
