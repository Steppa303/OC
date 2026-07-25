import { describe, expect, it } from 'vitest';
import { generateModule, validateModule } from './generateModule';
import type { ChatFn, ChatMessage } from './chat';

const validModule = {
  manifestVersion: 1,
  id: 'user.warmfilter',
  name: 'Warm Filter',
  category: 'filter',
  hp: 8,
  description: 'A warm lowpass.',
  role: 'vcf',
  params: [{ id: 'cutoff', label: 'Cutoff', control: 'knob', default: 800, min: 20, max: 20000, amyParam: 'filter_freq' }],
  jacks: [
    { id: 'in', kind: 'audio', dir: 'in' },
    { id: 'out', kind: 'audio', dir: 'out' },
  ],
  behavior: null,
};

const json = (o: unknown) => JSON.stringify(o);
function mockChat(responses: string[]): { fn: ChatFn; calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  let i = 0;
  return {
    calls,
    fn: (m) => {
      calls.push(m);
      const r = responses[Math.min(i, responses.length - 1)] ?? '';
      i += 1;
      return Promise.resolve(r);
    },
  };
}

describe('validateModule', () => {
  it('accepts a valid user module', () => {
    expect(validateModule(validModule).ok).toBe(true);
  });
  it('rejects a non-user id', () => {
    const r = validateModule({ ...validModule, id: 'core.sneaky' });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('must start with "user."');
  });
  it('rejects a bad amyParam and a forbidden script', () => {
    expect(validateModule({ ...validModule, params: [{ id: 'x', label: 'X', control: 'knob', default: 0, min: 0, max: 1, amyParam: 'nope' }] }).ok).toBe(false);
    const withScript = validateModule({
      ...validModule,
      role: 'custom',
      behavior: { script: "api.onTick(() => fetch('http://x'))" },
    });
    expect(withScript.ok).toBe(false);
    expect(withScript.errors.join()).toContain("forbidden api 'fetch'");
  });
});

describe('generateModule', () => {
  it('accepts a valid module on the first attempt', async () => {
    const { fn } = mockChat([json(validModule)]);
    const result = await generateModule({ prompt: 'a warm filter', chat: fn });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.manifest.id).toBe('user.warmfilter');
    expect(result.attempts).toBe(1);
  });

  it('repairs an invalid module then accepts', async () => {
    const bad = json({ ...validModule, id: 'core.bad' });
    const { fn, calls } = mockChat([bad, json(validModule)]);
    const result = await generateModule({ prompt: 'a filter', chat: fn });
    expect(result.ok).toBe(true);
    expect((result as { attempts: number }).attempts).toBe(2);
    expect(calls[1]!.at(-1)!.content).toContain('failed validation');
  });

  it('gives up after maxAttempts', async () => {
    const { fn } = mockChat(['not json']);
    const result = await generateModule({ prompt: 'x', chat: fn, maxAttempts: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.attempts).toBe(2);
  });
});
