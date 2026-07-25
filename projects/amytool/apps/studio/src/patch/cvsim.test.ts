import { describe, expect, it } from 'vitest';
import { cvToFreq, cvVoltage } from './cvsim';

describe('cvVoltage', () => {
  it('manual source returns the slider voltage', () => {
    expect(cvVoltage({ source: 'manual', voltage: 2 }, 0)).toBe(2);
    expect(cvVoltage({ source: 'manual', voltage: -3.5 }, 10)).toBe(-3.5);
  });

  it('lfo source oscillates around zero at the given rate', () => {
    const p = { source: 'lfo', rate: 1, voltage: 4 };
    expect(cvVoltage(p, 0)).toBeCloseTo(0, 6);
    expect(cvVoltage(p, 0.25)).toBeCloseTo(4, 5); // quarter period → peak
    expect(cvVoltage(p, 0.5)).toBeCloseTo(0, 5);
  });

  it('steps source cycles through the sequence', () => {
    const p = { source: 'steps', rate: 2 };
    const a = cvVoltage(p, 0);
    const b = cvVoltage(p, 0.5); // one step later at rate 2
    expect(a).not.toBe(b);
  });
});

describe('cvToFreq (1V/oct pitch)', () => {
  it('transposes exactly one octave per volt', () => {
    expect(cvToFreq('1voct', 0, 440)).toBeCloseTo(440, 6);
    expect(cvToFreq('1voct', 1, 440)).toBeCloseTo(880, 6);
    expect(cvToFreq('1voct', -1, 440)).toBeCloseTo(220, 6);
    expect(cvToFreq('1voct', 2, 100)).toBeCloseTo(400, 6);
  });

  it('linear mode spans ±1 octave over ±10 V', () => {
    expect(cvToFreq('linear', 10, 440)).toBeCloseTo(880, 4);
    expect(cvToFreq('linear', -10, 440)).toBeCloseTo(220, 4);
  });

  it('trigger mode does not affect pitch', () => {
    expect(cvToFreq('trigger', 5, 440)).toBe(440);
  });
});
