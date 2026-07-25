import { describe, expect, it } from 'vitest';
import { compileToWire, patchDocSchema, type PatchDoc } from '@amy/patchdoc';
import { DEVICE_MODULE_TYPE, deviceFromState } from '@amy/modules';
import { attachDeviceModule, extractDeviceManifest, validateDevice } from './generateDevice';
import { registryProvider } from './plan';
import type { ChatMessage } from './chat';

const LOOP_CODE = `import amy
feedback = 0.5
tone = 0.7
amy.send(osc=0, wave=0, freq=220, vel=1)

def loop():
    amy.send(osc=0, feedback=feedback)
`;

const DEVICE_JSON = JSON.stringify({
  contract: 'devicemanifest.v1',
  name: 'Ping-Pong Delay',
  description: 'Stereo ping-pong delay with feedback and tone knobs.',
  params: [
    { id: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.5, binding: 'feedback' },
    { id: 'tone', label: 'Tone', min: 0, max: 1, default: 0.7, binding: 'tone' },
  ],
  jacks: [
    { id: 'in', kind: 'audio', dir: 'in' },
    { id: 'out', kind: 'audio', dir: 'out' },
  ],
});

function docWithLoopCode(loopCode: string | null): PatchDoc {
  const now = new Date().toISOString();
  return patchDocSchema.parse({
    version: 1,
    meta: {
      id: crypto.randomUUID(),
      name: 'Test',
      tags: [],
      createdAt: now,
      modifiedAt: now,
      origin: 'llm',
    },
    modules: [
      {
        id: 'out1',
        type: 'core.out',
        label: 'Output',
        pos: { x: 24, y: 0 },
        params: {},
        advanced: false,
        state: {},
      },
    ],
    cables: [],
    extras: { unmappedWire: [], userLoopCode: loopCode },
  });
}

describe('extractDeviceManifest', () => {
  it('accepts a valid manifest on the first attempt', async () => {
    const res = await extractDeviceManifest({
      prompt: 'stereo ping-pong delay with feedback and tone knobs',
      loopCode: LOOP_CODE,
      chat: () => Promise.resolve(DEVICE_JSON),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.device.name).toBe('Ping-Pong Delay');
      expect(res.attempts).toBe(1);
    }
  });

  it('repairs an invalid-then-valid response and records the trace', async () => {
    const bad = JSON.stringify({ contract: 'devicemanifest.v1', name: 'X', params: [] });
    let call = 0;
    const chat = (messages: ChatMessage[]) => {
      call++;
      if (call === 1) return Promise.resolve(bad);
      // The repair turn must carry the machine errors back to the model.
      expect(messages[messages.length - 1]?.content).toContain('failed validation');
      return Promise.resolve(DEVICE_JSON);
    };
    const res = await extractDeviceManifest({ prompt: 'delay', loopCode: LOOP_CODE, chat });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.attempts).toBe(2);
    expect(res.trace.some((t) => t.stage === 'domain' && !t.ok)).toBe(true);
  });

  it('fails softly after max attempts', async () => {
    const res = await extractDeviceManifest({
      prompt: 'delay',
      loopCode: LOOP_CODE,
      chat: () => Promise.resolve('not json'),
      maxAttempts: 2,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.attempts).toBe(2);
      expect(res.error).toContain('Custom Code');
    }
  });

  it('rejects bindings that are not top-level assignments in the code', async () => {
    const wrongBinding = JSON.stringify({
      contract: 'devicemanifest.v1',
      name: 'X',
      params: [{ id: 'a', label: 'A', min: 0, max: 1, default: 0.5, binding: 'ghost' }],
    });
    const res = await extractDeviceManifest({
      prompt: 'delay',
      loopCode: LOOP_CODE,
      chat: () => Promise.resolve(wrongBinding),
      maxAttempts: 1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toContain("'ghost'");
  });
});

describe('validateDevice', () => {
  it('returns zod issues for a malformed object', () => {
    const res = validateDevice({ contract: 'devicemanifest.v1' }, LOOP_CODE);
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});

describe('attachDeviceModule', () => {
  it('appends a core.device instance with defaults, code and embedded manifest', () => {
    const device = JSON.parse(DEVICE_JSON) as Parameters<typeof attachDeviceModule>[1];
    const doc = attachDeviceModule(docWithLoopCode(LOOP_CODE), device);
    const mod = doc.modules.find((m) => m.type === DEVICE_MODULE_TYPE);
    expect(mod).toBeDefined();
    expect(mod?.label).toBe('Ping-Pong Delay');
    expect(mod?.params).toEqual({ feedback: 0.5, tone: 0.7 });
    expect(deviceFromState(mod?.state ?? {})).not.toBeNull();
    expect(mod?.state['code']).toBe(LOOP_CODE);
    // placed right of the existing modules
    expect(mod?.pos.x).toBeGreaterThan(24);
  });

  it('falls back to a Custom Code module when no device was extracted', () => {
    const doc = attachDeviceModule(docWithLoopCode(LOOP_CODE), null);
    const mod = doc.modules.find((m) => m.type === 'core.customcode');
    expect(mod).toBeDefined();
    expect(mod?.state['code']).toBe(LOOP_CODE);
  });

  it('returns the doc unchanged when there is no loop code', () => {
    const doc = docWithLoopCode(null);
    expect(attachDeviceModule(doc, null)).toBe(doc);
  });

  it('the resulting doc still compiles without errors', () => {
    const device = JSON.parse(DEVICE_JSON) as Parameters<typeof attachDeviceModule>[1];
    const doc = attachDeviceModule(docWithLoopCode(LOOP_CODE), device);
    const { errors } = compileToWire(doc, registryProvider);
    expect(errors).toEqual([]);
  });
});
