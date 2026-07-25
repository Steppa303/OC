import { describe, expect, it } from 'vitest';
import {
  DEVICE_MODULE_TYPE,
  deviceBindingValues,
  deviceFromState,
  deviceHp,
  deviceManifestSchema,
  deviceToManifest,
  validateDeviceBindings,
  type DeviceManifest,
} from './device';
import { moduleManifestSchema } from './schema';
import { registry } from './registry';

const PINGPONG: DeviceManifest = deviceManifestSchema.parse({
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

const CODE = `import amy
feedback = 0.5
tone = 0.7
amy.send(osc=0, wave=0, freq=220, vel=1)

def loop():
    amy.send(osc=0, feedback=feedback)
`;

describe('deviceManifestSchema', () => {
  it('accepts the ping-pong fixture', () => {
    expect(PINGPONG.params).toHaveLength(2);
  });

  it('rejects a param with min >= max', () => {
    const res = deviceManifestSchema.safeParse({
      contract: 'devicemanifest.v1',
      name: 'X',
      params: [{ id: 'a', label: 'A', min: 1, max: 1, default: 1, binding: 'a' }],
    });
    expect(res.success).toBe(false);
  });

  it('rejects a default outside min..max', () => {
    const res = deviceManifestSchema.safeParse({
      contract: 'devicemanifest.v1',
      name: 'X',
      params: [{ id: 'a', label: 'A', min: 0, max: 1, default: 2, binding: 'a' }],
    });
    expect(res.success).toBe(false);
  });

  it('rejects duplicate bindings and reserved binding names', () => {
    const dup = deviceManifestSchema.safeParse({
      contract: 'devicemanifest.v1',
      name: 'X',
      params: [
        { id: 'a', label: 'A', min: 0, max: 1, default: 0, binding: 'v' },
        { id: 'b', label: 'B', min: 0, max: 1, default: 0, binding: 'v' },
      ],
    });
    expect(dup.success).toBe(false);
    const reserved = deviceManifestSchema.safeParse({
      contract: 'devicemanifest.v1',
      name: 'X',
      params: [{ id: 'a', label: 'A', min: 0, max: 1, default: 0, binding: 'amy' }],
    });
    expect(reserved.success).toBe(false);
  });

  it('rejects a non-identifier binding', () => {
    const res = deviceManifestSchema.safeParse({
      contract: 'devicemanifest.v1',
      name: 'X',
      params: [{ id: 'a', label: 'A', min: 0, max: 1, default: 0, binding: 'a b' }],
    });
    expect(res.success).toBe(false);
  });
});

describe('validateDeviceBindings', () => {
  it('passes when every binding is assigned at top level', () => {
    expect(validateDeviceBindings(PINGPONG, CODE)).toEqual([]);
  });

  it('reports bindings missing from the code', () => {
    const errors = validateDeviceBindings(PINGPONG, 'import amy\nfeedback = 0.5\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("'tone'");
  });

  it('does not count an indented (non-top-level) assignment', () => {
    const errors = validateDeviceBindings(PINGPONG, 'feedback = 1\ndef loop():\n    tone = 2\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("'tone'");
  });

  it('does not mistake == comparison for assignment', () => {
    const errors = validateDeviceBindings(PINGPONG, 'feedback = 1\ntone == 2\n');
    expect(errors).toHaveLength(1);
  });
});

describe('deviceToManifest', () => {
  it('produces a schema-valid ModuleManifest with knob params and jacks', () => {
    const manifest = deviceToManifest(PINGPONG);
    expect(() => moduleManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.id).toBe(DEVICE_MODULE_TYPE);
    expect(manifest.name).toBe('Ping-Pong Delay');
    expect(manifest.params.map((p) => p.control)).toEqual(['knob', 'knob']);
    expect(manifest.jacks).toHaveLength(2);
  });

  it('hp grows with param count and stays within 8..24', () => {
    expect(deviceHp(PINGPONG)).toBeGreaterThanOrEqual(8);
    const wide = deviceManifestSchema.parse({
      contract: 'devicemanifest.v1',
      name: 'Wide',
      params: Array.from({ length: 8 }, (_, i) => ({
        id: `p${i}`,
        label: `P${i}`,
        min: 0,
        max: 1,
        default: 0,
        binding: `p${i}`,
      })),
    });
    expect(deviceHp(wide)).toBeLessThanOrEqual(24);
  });
});

describe('deviceFromState / deviceBindingValues', () => {
  it('round-trips through a module instance state', () => {
    expect(deviceFromState({ device: PINGPONG, code: CODE })).toEqual(PINGPONG);
    expect(deviceFromState({ code: CODE })).toBeNull();
    expect(deviceFromState({ device: { junk: true } })).toBeNull();
  });

  it('maps current param values to bindings, falling back to defaults', () => {
    expect(deviceBindingValues(PINGPONG, { feedback: 0.9 })).toEqual({ feedback: 0.9, tone: 0.7 });
  });
});

describe('registry', () => {
  it('knows the core.device base manifest', () => {
    const base = registry.byId(DEVICE_MODULE_TYPE);
    expect(base).toBeDefined();
    expect(base?.role).toBe('custom');
  });
});
