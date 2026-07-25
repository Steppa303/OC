/**
 * CV simulation (P4-02). A `core.cvin` in the simulator produces a voltage from
 * its sim source (manual slider / LFO / step sequence). For a 1V/oct input the
 * voltage transposes pitch exactly one octave per volt — the same law the board
 * applies via ext0/ext1 (`freq = const * 2**(volts)`). Pure + unit-tested; the
 * realtime loop in the engine provider drives the target osc from these.
 */
type Params = Record<string, string | number | boolean>;

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const STEP_SEQUENCE = [0, 2, 4, 7]; // semitone-ish steps in volts (1 v = 1 octave/12? no — 1 v = 1 oct)

/** Current simulated voltage of a cvin at time `t` seconds. */
export function cvVoltage(params: Params, t: number): number {
  const source = String(params['source'] ?? 'manual');
  const manual = num(params['voltage'], 0);
  if (source === 'lfo') {
    const rate = num(params['rate'], 1);
    const amp = manual !== 0 ? Math.abs(manual) : 5;
    return Math.sin(2 * Math.PI * rate * t) * amp;
  }
  if (source === 'steps') {
    const rate = num(params['rate'], 1);
    const idx = Math.floor(t * rate) % STEP_SEQUENCE.length;
    // step values are in semitones; convert to volts (1 v/oct → 12 semitones/volt)
    return (STEP_SEQUENCE[(idx + STEP_SEQUENCE.length) % STEP_SEQUENCE.length] ?? 0) / 12;
  }
  return manual;
}

/**
 * Map a CV voltage onto a target frequency for the given cvin mode.
 * 1V/oct: one octave per volt. linear: ±10 V spans ±1 octave (gentle). trigger: no pitch effect.
 */
export function cvToFreq(mode: string, volts: number, baseFreq: number): number {
  if (mode === '1voct') return baseFreq * Math.pow(2, volts);
  if (mode === 'linear') return baseFreq * Math.pow(2, volts / 10);
  return baseFreq;
}
