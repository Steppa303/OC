/**
 * Core module library (docs/04 §5). These are the Phase-1 building blocks.
 * `amyParam` is set only where a control maps 1:1 onto an AMY parameter; pitch
 * offsets, ADSR times, mix levels etc. are realized by the allocator/compiler
 * (P1-04/P1-05), so they intentionally carry no amyParam.
 *
 * Each doubles as a few-shot example for the LLM module generator (docs/05), so
 * keep them clean and representative.
 */
import type { ModuleManifest } from './schema';

const WAVES = ['sine', 'saw', 'square', 'triangle', 'pulse', 'noise'] as const;

export const CORE_MANIFESTS: readonly ModuleManifest[] = [
  // ---- IO ----
  {
    manifestVersion: 1,
    id: 'core.midiin',
    name: 'MIDI In',
    category: 'io',
    hp: 4,
    description: 'Incoming MIDI notes on the patch channel.',
    role: 'io',
    params: [],
    jacks: [{ id: 'notes', kind: 'midi', dir: 'out', label: 'notes', advanced: false }],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.keyboard',
    name: 'Keyboard',
    category: 'io',
    hp: 12,
    description: 'On-screen playable keyboard.',
    role: 'io',
    params: [
      { id: 'octave', label: 'Octave', control: 'knob', default: 4, min: 0, max: 8, advanced: false },
      { id: 'velocity', label: 'Vel', control: 'knob', default: 1, min: 0, max: 1, advanced: false },
      // Aftertouch/pressure macro (0..1) — sim source for the `aftertouch` output (Stufe 5).
      { id: 'pressure', label: 'Pressure', control: 'slider', default: 0, min: 0, max: 1, advanced: false },
    ],
    jacks: [
      { id: 'notes', kind: 'midi', dir: 'out', label: 'notes', advanced: false },
      { id: 'aftertouch', kind: 'cv', dir: 'out', label: 'at', param: 'pressure', advanced: false },
    ],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.cvin',
    name: 'CV In',
    category: 'io',
    hp: 6,
    description: 'Hardware CV input (or simulated source).',
    role: 'io',
    params: [
      { id: 'channel', label: 'Ch', control: 'select', default: '0', options: ['0', '1'], advanced: false },
      {
        id: 'mode',
        label: 'Mode',
        control: 'select',
        default: '1voct',
        options: ['1voct', 'linear', 'trigger'],
        advanced: false,
      },
      // Simulator source (ignored on hardware, where the real CV drives ext0/ext1).
      {
        id: 'source',
        label: 'Src',
        control: 'select',
        default: 'manual',
        options: ['manual', 'lfo', 'steps'],
        advanced: false,
      },
      { id: 'voltage', label: 'V', control: 'knob', default: 0, min: -10, max: 10, unit: 'V', advanced: false },
      { id: 'rate', label: 'Rate', control: 'knob', default: 1, min: 0.01, max: 20, scale: 'log', unit: 'Hz', advanced: true },
    ],
    jacks: [{ id: 'out', kind: 'cv', dir: 'out', label: 'cv', advanced: false }],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.audioin',
    name: 'Audio In',
    category: 'io',
    hp: 4,
    description: 'Stereo audio input as an oscillator source.',
    role: 'io',
    params: [],
    jacks: [
      { id: 'l', kind: 'audio', dir: 'out', label: 'L', advanced: false },
      { id: 'r', kind: 'audio', dir: 'out', label: 'R', advanced: false },
    ],
    displays: [{ id: 'meter', kind: 'value', source: 'l' }],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.out',
    name: 'Output',
    category: 'io',
    hp: 6,
    description: 'Main output / master level.',
    role: 'io',
    params: [
      { id: 'level', label: 'Level', control: 'knob', default: 0.8, min: 0, max: 1, amyParam: 'volume', advanced: false },
    ],
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in', label: 'in', advanced: false },
      { id: 'in_r', kind: 'audio', dir: 'in', label: 'in R', advanced: true },
    ],
    displays: [],
    behavior: null,
  },

  // ---- Sources ----
  {
    manifestVersion: 1,
    id: 'core.vco',
    name: 'VCO',
    category: 'source',
    hp: 8,
    advancedHp: 10,
    description: 'Band-limited oscillator.',
    role: 'vco',
    params: [
      { id: 'wave', label: 'Wave', control: 'select', default: 'saw', options: [...WAVES], amyParam: 'wave', advanced: false },
      { id: 'coarse', label: 'Coarse', control: 'knob', default: 0, min: -24, max: 24, unit: 'st', advanced: false },
      { id: 'fine', label: 'Fine', control: 'knob', default: 0, min: -1, max: 1, advanced: false },
      { id: 'pan', label: 'Pan', control: 'knob', default: 0.5, min: 0, max: 1, amyParam: 'pan', advanced: true },
      { id: 'duty', label: 'Duty', control: 'knob', default: 0.5, min: 0.01, max: 0.99, amyParam: 'duty', advanced: true },
    ],
    jacks: [
      { id: 'notes', kind: 'midi', dir: 'in', label: 'notes', advanced: false },
      { id: 'pitch', kind: 'cv', dir: 'in', label: '1v/oct', target: 'freq', param: 'coarse', advanced: false },
      { id: 'fm', kind: 'cv', dir: 'in', label: 'fm', target: 'freq', advanced: true },
      { id: 'pan_cv', kind: 'cv', dir: 'in', label: 'pan', target: 'pan', param: 'pan', advanced: true },
      { id: 'pwm', kind: 'cv', dir: 'in', label: 'pwm', target: 'duty', param: 'duty', advanced: true },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.lfo',
    name: 'LFO',
    category: 'modulation',
    hp: 6,
    description: 'Low-frequency modulation source.',
    role: 'lfo',
    params: [
      { id: 'wave', label: 'Wave', control: 'select', default: 'sine', options: [...WAVES], amyParam: 'wave', advanced: false },
      { id: 'rate', label: 'Rate', control: 'knob', default: 2, min: 0.01, max: 40, scale: 'log', unit: 'Hz', advanced: false },
      { id: 'depth', label: 'Depth', control: 'knob', default: 0.5, min: 0, max: 1, advanced: false },
    ],
    jacks: [{ id: 'out', kind: 'cv', dir: 'out', label: 'out', advanced: false }],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.noise',
    name: 'Noise',
    category: 'source',
    hp: 4,
    description: 'White noise source.',
    role: 'vco',
    params: [],
    jacks: [
      { id: 'notes', kind: 'midi', dir: 'in', label: 'notes', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },

  // ---- Filter ----
  {
    manifestVersion: 1,
    id: 'core.vcf',
    name: 'VCF',
    category: 'filter',
    hp: 8,
    description: 'Multimode filter (per-oscillator biquad).',
    role: 'vcf',
    params: [
      {
        id: 'type',
        label: 'Type',
        control: 'select',
        default: 'lowpass',
        options: ['lowpass', 'bandpass', 'highpass', 'lowpass24'],
        amyParam: 'filter_type',
        advanced: false,
      },
      { id: 'cutoff', label: 'Cutoff', control: 'knob', default: 800, min: 20, max: 20000, scale: 'log', unit: 'Hz', amyParam: 'filter_freq', advanced: false },
      { id: 'resonance', label: 'Res', control: 'knob', default: 0.7, min: 0.5, max: 16, amyParam: 'resonance', advanced: false },
    ],
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in', label: 'in', advanced: false },
      { id: 'cutoff_cv', kind: 'cv', dir: 'in', label: 'cutoff', target: 'filter_freq', param: 'cutoff', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },

  // ---- Envelope ----
  {
    manifestVersion: 1,
    id: 'core.env',
    name: 'Envelope',
    category: 'envelope',
    hp: 8,
    description: 'ADSR envelope (AMY breakpoint generator).',
    role: 'env',
    params: [
      { id: 'attack', label: 'A', control: 'knob', default: 5, min: 1, max: 5000, scale: 'log', unit: 'ms', advanced: false },
      { id: 'decay', label: 'D', control: 'knob', default: 100, min: 1, max: 5000, scale: 'log', unit: 'ms', advanced: false },
      { id: 'sustain', label: 'S', control: 'knob', default: 0.7, min: 0, max: 1, advanced: false },
      { id: 'release', label: 'R', control: 'knob', default: 200, min: 1, max: 5000, scale: 'log', unit: 'ms', advanced: false },
    ],
    jacks: [
      { id: 'gate', kind: 'gate', dir: 'in', label: 'gate', advanced: false },
      { id: 'out', kind: 'cv', dir: 'out', label: 'env', advanced: false },
    ],
    displays: [],
    behavior: null,
  },

  // ---- Amp / mixer ----
  {
    manifestVersion: 1,
    id: 'core.vca',
    name: 'VCA',
    category: 'mixer',
    hp: 6,
    description: 'Voltage-controlled amplifier.',
    role: 'vca',
    params: [{ id: 'gain', label: 'Gain', control: 'knob', default: 1, min: 0, max: 1, amyParam: 'amp', advanced: false }],
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in', label: 'in', advanced: false },
      { id: 'cv', kind: 'cv', dir: 'in', label: 'cv', target: 'amp', param: 'gain', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.mixer4',
    name: 'Mixer 4',
    category: 'mixer',
    hp: 8,
    description: 'Four-channel audio mixer.',
    role: 'vca',
    params: [
      { id: 'level1', label: '1', control: 'slider', default: 0.8, min: 0, max: 1, advanced: false },
      { id: 'level2', label: '2', control: 'slider', default: 0.8, min: 0, max: 1, advanced: false },
      { id: 'level3', label: '3', control: 'slider', default: 0.8, min: 0, max: 1, advanced: false },
      { id: 'level4', label: '4', control: 'slider', default: 0.8, min: 0, max: 1, advanced: false },
    ],
    jacks: [
      { id: 'in1', kind: 'audio', dir: 'in', label: '1', param: 'level1', advanced: false },
      { id: 'in2', kind: 'audio', dir: 'in', label: '2', param: 'level2', advanced: false },
      { id: 'in3', kind: 'audio', dir: 'in', label: '3', param: 'level3', advanced: false },
      { id: 'in4', kind: 'audio', dir: 'in', label: '4', param: 'level4', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },

  // ---- Effects (global bus) ----
  {
    manifestVersion: 1,
    id: 'core.fx.reverb',
    name: 'Reverb',
    category: 'fx',
    hp: 6,
    description: 'Global reverb send.',
    role: 'fx',
    params: [
      { id: 'level', label: 'Level', control: 'knob', default: 0.4, min: 0, max: 1, amyParam: 'reverb', advanced: false },
      { id: 'liveness', label: 'Live', control: 'knob', default: 0.85, min: 0, max: 1, advanced: false },
      { id: 'damping', label: 'Damp', control: 'knob', default: 0.5, min: 0, max: 1, advanced: false },
    ],
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in', label: 'in', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.fx.chorus',
    name: 'Chorus',
    category: 'fx',
    hp: 6,
    description: 'Global chorus send.',
    role: 'fx',
    params: [
      { id: 'level', label: 'Level', control: 'knob', default: 0.5, min: 0, max: 1, amyParam: 'chorus', advanced: false },
      { id: 'rate', label: 'Rate', control: 'knob', default: 0.5, min: 0.01, max: 10, scale: 'log', unit: 'Hz', advanced: false },
      { id: 'depth', label: 'Depth', control: 'knob', default: 0.5, min: 0, max: 1, advanced: false },
    ],
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in', label: 'in', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.fx.echo',
    name: 'Echo',
    category: 'fx',
    hp: 6,
    description: 'Global echo/delay send.',
    role: 'fx',
    params: [
      { id: 'level', label: 'Level', control: 'knob', default: 0.4, min: 0, max: 1, amyParam: 'echo', advanced: false },
      { id: 'time', label: 'Time', control: 'knob', default: 300, min: 10, max: 2000, scale: 'log', unit: 'ms', advanced: false },
      { id: 'feedback', label: 'FB', control: 'knob', default: 0.3, min: 0, max: 0.95, advanced: false },
    ],
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in', label: 'in', advanced: false },
      // Scripted-modulation input for feedback (Stufe 5): non-coef target → control loop.
      { id: 'fb_cv', kind: 'cv', dir: 'in', label: 'fb', target: 'feedback', param: 'feedback', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.fx.eq',
    name: 'EQ',
    category: 'fx',
    hp: 6,
    description: 'Global 3-band EQ.',
    role: 'fx',
    params: [
      { id: 'low', label: 'Low', control: 'knob', default: 0, min: -15, max: 15, unit: 'dB', amyParam: 'eq', advanced: false },
      { id: 'mid', label: 'Mid', control: 'knob', default: 0, min: -15, max: 15, unit: 'dB', advanced: false },
      { id: 'high', label: 'High', control: 'knob', default: 0, min: -15, max: 15, unit: 'dB', advanced: false },
    ],
    jacks: [
      { id: 'in', kind: 'audio', dir: 'in', label: 'in', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },

  // ---- Display ----
  {
    manifestVersion: 1,
    id: 'core.scope',
    name: 'Scope',
    category: 'display',
    hp: 8,
    description: 'Oscilloscope on the input signal.',
    role: 'custom',
    params: [],
    jacks: [{ id: 'in', kind: 'audio', dir: 'in', label: 'in', advanced: false }],
    displays: [{ id: 'scope', kind: 'scope', source: 'in' }],
    behavior: null,
  },

  // ---- Sequencers ----
  {
    manifestVersion: 1,
    id: 'core.stepseq16',
    name: 'Step Seq 16',
    category: 'sequencer',
    hp: 20,
    description: '16-step pitch/gate sequencer.',
    role: 'seq',
    sequencer: { tracks: 1, steps: 16 },
    params: [{ id: 'octave', label: 'Oct', control: 'knob', default: 4, min: 1, max: 7, advanced: false }],
    jacks: [{ id: 'notes', kind: 'midi', dir: 'out', label: 'notes', advanced: false }],
    displays: [],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.drumgrid',
    name: 'Drum Grid',
    category: 'sequencer',
    hp: 24,
    description: '4×16 drum sequencer with per-track voice select, accent and pattern copy/clear.',
    role: 'seq',
    sequencer: {
      tracks: 4,
      steps: 16,
      trackDefaults: [{ note: 36 }, { note: 38 }, { note: 42 }, { note: 39 }],
    },
    params: [],
    jacks: [{ id: 'notes', kind: 'midi', dir: 'out', label: 'notes', advanced: false }],
    displays: [],
    behavior: null,
  },

  // ---- Custom code (import residue) ----
  {
    manifestVersion: 1,
    id: 'core.customcode',
    name: 'Custom Code',
    category: 'io',
    hp: 10,
    description:
      'Imported Python that could not be modeled as modules. Read-only; opens the code view. Upgraded to a Device Module where possible (P6-03).',
    role: 'custom',
    params: [],
    jacks: [],
    displays: [{ id: 'code', kind: 'text', source: 'code' }],
    behavior: null,
  },

  // ---- Device module (P6-03) ----
  // Base entry so the registry/allocator know the type; a placed instance
  // carries its real panel (params/jacks) as a DeviceManifest in state.device.
  {
    manifestVersion: 1,
    id: 'core.device',
    name: 'Device',
    category: 'fx',
    hp: 10,
    description:
      'LLM-generated custom-code device. Created by the generator; knobs bind to variables in the running sketch (P6-03).',
    role: 'custom',
    params: [],
    jacks: [],
    displays: [],
    behavior: null,
  },

  // ---- Preset voices ----
  {
    manifestVersion: 1,
    id: 'core.junovoice',
    name: 'Juno Voice',
    category: 'voice',
    hp: 8,
    description: 'Juno-6 preset voice (patches 0-127).',
    role: 'voice',
    voice: { patchRange: [0, 127] },
    params: [{ id: 'patch', label: 'Patch', control: 'knob', default: 0, min: 0, max: 127, amyParam: 'patch', advanced: false }],
    jacks: [
      { id: 'notes', kind: 'midi', dir: 'in', label: 'notes', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [{ id: 'patch_no', kind: 'value', source: 'patch' }],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.dx7voice',
    name: 'DX7 Voice',
    category: 'voice',
    hp: 8,
    description: 'DX7 FM preset voice (patches 128-255).',
    role: 'voice',
    voice: { patchRange: [128, 255] },
    params: [{ id: 'patch', label: 'Patch', control: 'knob', default: 128, min: 128, max: 255, amyParam: 'patch', advanced: false }],
    jacks: [
      { id: 'notes', kind: 'midi', dir: 'in', label: 'notes', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [{ id: 'patch_no', kind: 'value', source: 'patch' }],
    behavior: null,
  },
  {
    manifestVersion: 1,
    id: 'core.drumvoice',
    name: 'Drum Kit',
    category: 'voice',
    hp: 8,
    description: 'GM drum kit voice (patches 384-390).',
    role: 'voice',
    voice: { patchRange: [384, 390] },
    params: [
      {
        id: 'kit',
        label: 'Kit',
        control: 'select',
        default: '384',
        options: ['384', '385', '386', '387', '388', '389', '390'],
        amyParam: 'patch',
        advanced: false,
      },
    ],
    jacks: [
      { id: 'notes', kind: 'midi', dir: 'in', label: 'notes', advanced: false },
      { id: 'out', kind: 'audio', dir: 'out', label: 'out', advanced: false },
    ],
    displays: [],
    behavior: null,
  },
];
