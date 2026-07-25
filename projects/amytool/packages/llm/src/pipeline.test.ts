import { describe, expect, it, vi } from 'vitest';
import { generatePatch, validatePlan, type GenerateResult } from './pipeline';
import { PATCHPLAN_CONTRACT, patchPlanSchema } from './contracts/patchplan';
import { planToDoc } from './plan';
import { describePatch } from './prompts/patch';
import { buildCatalog, catalogIds } from './catalog';
import { stripFences, type ChatFn, type ChatMessage } from './chat';

const validPlan = {
  contract: PATCHPLAN_CONTRACT,
  name: 'Test Saw',
  modules: [
    { id: 'vco1', type: 'core.vco', params: { wave: 'saw' } },
    { id: 'vcf1', type: 'core.vcf', params: { cutoff: 1200 } },
    { id: 'vca1', type: 'core.vca', params: {} },
    { id: 'out1', type: 'core.out', params: {} },
    { id: 'env1', type: 'core.env', params: {} },
  ],
  cables: [
    { from: 'vco1.out', to: 'vcf1.in' },
    { from: 'vcf1.out', to: 'vca1.in' },
    { from: 'vca1.out', to: 'out1.in' },
    { from: 'env1.out', to: 'vca1.cv' },
  ],
  notes: 'a test saw',
};

const json = (o: unknown) => JSON.stringify(o);

function mockChat(responses: string[]): { fn: ChatFn; calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  let i = 0;
  const fn: ChatFn = (messages) => {
    calls.push(messages);
    const r = responses[Math.min(i, responses.length - 1)] ?? '';
    i += 1;
    return Promise.resolve(r);
  };
  return { fn, calls };
}

describe('catalog', () => {
  it('lists core modules and excludes the Custom Code residue box', () => {
    const cat = buildCatalog();
    expect(cat).toContain('core.vco (source)');
    expect(cat).toContain('wave[sine|saw|square|triangle|pulse|noise]');
    expect(cat).not.toContain('core.customcode');
    expect(catalogIds().has('core.vco')).toBe(true);
    expect(catalogIds().has('core.customcode')).toBe(false);
  });
});

describe('patchPlan contract + planToDoc', () => {
  it('accepts a valid plan and rejects a missing contract tag', () => {
    expect(patchPlanSchema.safeParse(validPlan).success).toBe(true);
    expect(patchPlanSchema.safeParse({ ...validPlan, contract: 'nope' }).success).toBe(false);
  });

  it('lifts a plan into a PatchDoc: defaults merged, layout by depth, loopCode preserved', () => {
    const plan = patchPlanSchema.parse({
      ...validPlan,
      loopCode: 'def loop():\n    pass',
    });
    const doc = planToDoc(plan, { prompt: 'a test saw' });
    expect(doc.meta.origin).toBe('llm');
    expect(doc.meta.prompt).toBe('a test saw');
    // manifest defaults are filled, plan params win
    const vco = doc.modules.find((m) => m.id === 'vco1')!;
    expect(vco.params).toMatchObject({ wave: 'saw', coarse: 0 });
    // auto-layout: sources sit left of the modules they feed
    const x = (id: string) => doc.modules.find((m) => m.id === id)!.pos.x;
    expect(x('vco1')).toBeLessThan(x('vcf1'));
    expect(x('vcf1')).toBeLessThan(x('out1'));
    // escape hatch → extras
    expect(doc.extras.userLoopCode).toBe('def loop():\n    pass');
    // cable kinds are derived from the jack manifests
    expect(doc.cables.find((c) => c.from.module === 'env1')!.kind).toBe('cv');
  });
});

describe('validatePlan', () => {
  it('rejects unknown module types, bad params and illegal cables', () => {
    const ids = catalogIds();
    expect(validatePlan(patchPlanSchema.parse(validPlan), ids).ok).toBe(true);

    const unknownType = validatePlan(
      patchPlanSchema.parse({ ...validPlan, modules: [{ id: 'x1', type: 'core.bogus' }] }),
      ids,
    );
    expect(unknownType.ok).toBe(false);
    expect(unknownType.errors.join()).toContain("unknown module type 'core.bogus'");

    const illegalCable = validatePlan(
      patchPlanSchema.parse({
        contract: PATCHPLAN_CONTRACT,
        name: 'x',
        modules: [
          { id: 'vco1', type: 'core.vco' },
          { id: 'juno1', type: 'core.junovoice' },
        ],
        cables: [{ from: 'vco1.out', to: 'juno1.notes' }],
        notes: '',
      }),
      ids,
    );
    expect(illegalCable.ok).toBe(false);
    expect(illegalCable.errors.join()).toMatch(/audio output to a midi input/);
  });

  it('gates loopCode through the Python safety checks', () => {
    const ids = catalogIds();
    const unsafe = validatePlan(
      patchPlanSchema.parse({ ...validPlan, loopCode: 'import os\ndef loop():\n    os.system("id")' }),
      ids,
    );
    expect(unsafe.ok).toBe(false);
    expect(unsafe.errors.join()).toContain("loopCode: import 'os'");

    const safe = validatePlan(
      patchPlanSchema.parse({ ...validPlan, loopCode: 'def loop():\n    amy.send(osc=0, vel=1)' }),
      ids,
    );
    expect(safe.ok).toBe(true);
  });
});

describe('stripFences', () => {
  it('extracts JSON from fenced and prose-wrapped replies', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('Sure! {"a":1} hope that helps')).toBe('{"a":1}');
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe('generatePatch verify→repair loop', () => {
  it('accepts a valid plan on the first attempt', async () => {
    const { fn } = mockChat([json(validPlan)]);
    const result = await generatePatch({ prompt: 'a saw', chat: fn });
    expect(result.ok).toBe(true);
    assertOk(result);
    expect(result.attempts).toBe(1);
    expect(result.doc.modules).toHaveLength(5);
    expect(result.wire.length).toBeGreaterThan(0);
    expect(result.notes).toBe('a test saw');
    expect(result.trace.some((t) => t.stage === 'accept' && t.ok)).toBe(true);
  });

  it('repairs an invalid first response, then accepts (invalid-then-repaired)', async () => {
    const bad = json({ ...validPlan, modules: [{ id: 'x1', type: 'core.bogus' }] });
    const { fn, calls } = mockChat([bad, json(validPlan)]);
    const result = await generatePatch({ prompt: 'a saw', chat: fn });

    assertOk(result);
    expect(result.attempts).toBe(2);
    // trace records the first-attempt domain failure and the eventual accept
    expect(result.trace.some((t) => t.attempt === 1 && t.stage === 'domain' && !t.ok)).toBe(true);
    expect(result.trace.some((t) => t.stage === 'accept' && t.ok)).toBe(true);
    // the repair turn fed the exact error back to the model
    const repairTurn = calls[1]!.at(-1)!;
    expect(repairTurn.role).toBe('user');
    expect(repairTurn.content).toContain('failed validation');
    expect(repairTurn.content).toContain("unknown module type 'core.bogus'");
  });

  it('recovers from non-JSON output', async () => {
    const { fn } = mockChat(['sorry, I can only chat', json(validPlan)]);
    const result = await generatePatch({ prompt: 'a saw', chat: fn });
    assertOk(result);
    expect(result.trace.some((t) => t.attempt === 1 && t.stage === 'parse' && !t.ok)).toBe(true);
  });

  it('gives up after maxAttempts with a friendly error and full trace', async () => {
    const { fn } = mockChat(['garbage']);
    const result = await generatePatch({ prompt: 'a saw', chat: fn, maxAttempts: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.attempts).toBe(3);
    expect(result.error).toMatch(/after 3 attempts/);
    expect(result.trace.filter((t) => t.stage === 'request')).toHaveLength(3);
  });

  it('streams each stage to onTrace as it happens', async () => {
    const seen: string[] = [];
    const { fn } = mockChat([json(validPlan)]);
    const result = await generatePatch({
      prompt: 'a saw',
      chat: fn,
      onTrace: (e) => seen.push(`${e.attempt}:${e.stage}:${e.ok ? 'ok' : 'fail'}`),
    });
    assertOk(result);
    // the live stream matches the final trace, in order
    expect(seen).toEqual(result.trace.map((t) => `${t.attempt}:${t.stage}:${t.ok ? 'ok' : 'fail'}`));
    expect(seen[0]).toBe('1:request:ok');
    expect(seen.at(-1)).toBe('1:accept:ok');
  });

  it('runs the injected render smoke test and repairs on its failure', async () => {
    const smoke = vi
      .fn<(wire: string[]) => Promise<void>>()
      .mockRejectedValueOnce(new Error('silent output'))
      .mockResolvedValueOnce(undefined);
    const { fn } = mockChat([json(validPlan), json(validPlan)]);
    const result = await generatePatch({ prompt: 'a saw', chat: fn, renderSmokeTest: smoke });

    assertOk(result);
    expect(smoke).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.trace.some((t) => t.stage === 'render' && !t.ok)).toBe(true);
    expect(result.trace.some((t) => t.stage === 'render' && t.ok)).toBe(true);
  });
});

describe('editPatch', () => {
  it('summarizes the current patch for the prompt', () => {
    const base = planToDoc(patchPlanSchema.parse(validPlan));
    const digest = describePatch(base);
    expect(digest).toContain('vco1: core.vco');
    expect(digest).toContain('vco1.out -> vcf1.in');
  });

  it('edits in place: preserves patch identity and sends the digest + instruction', async () => {
    const base = planToDoc(patchPlanSchema.parse(validPlan));
    const edited = {
      ...validPlan,
      name: 'Test Saw (darker)',
      modules: validPlan.modules.map((m) => (m.id === 'vcf1' ? { ...m, params: { cutoff: 400 } } : m)),
    };
    const { fn, calls } = mockChat([json(edited)]);
    const result = await generatePatch({ prompt: 'make it darker', chat: fn, editBase: base });

    assertOk(result);
    // same patch identity (edit, not a new patch)
    expect(result.doc.meta.id).toBe(base.meta.id);
    expect(result.doc.meta.createdAt).toBe(base.meta.createdAt);
    expect(result.doc.modules.find((m) => m.id === 'vcf1')!.params['cutoff']).toBe(400);
    // the model was shown the current patch + the instruction
    const userMsg = calls[0]!.find((m) => m.role === 'user')!;
    expect(userMsg.content).toContain('current patch');
    expect(userMsg.content).toContain('make it darker');
    expect(userMsg.content).toContain('vco1: core.vco');
  });
});

function assertOk(r: GenerateResult): asserts r is Extract<GenerateResult, { ok: true }> {
  if (!r.ok) throw new Error(`expected success, got: ${r.error} (${r.errors.join('; ')})`);
}
