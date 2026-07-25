/**
 * generateModule prompt (docs/05 §5). The model targets a ModuleManifestV1 JSON.
 * Few-shots show a plain knob module, a sequencer module, and a behavior-script
 * module so cheap models learn all three shapes.
 */
import type { ChatMessage } from '../chat';

const RULES = `You design library modules for the AmyPatch synth. Output EXACTLY ONE JSON object — a ModuleManifestV1 — and nothing else (no markdown, no prose).

Shape:
{
  "manifestVersion": 1,
  "id": "user.<lowercase_id>",           // MUST start with "user."
  "name": "<display name>",
  "category": "source|filter|envelope|modulation|mixer|fx|io|sequencer|display|voice",
  "hp": <4..24>,
  "description": "<one line>",
  "role": "vco|vcf|env|lfo|vca|fx|io|seq|voice|custom",
  "params": [ { "id": "cutoff", "label": "Cutoff", "control": "knob|select|toggle|slider", "default": 800, "min": 20, "max": 20000, "options": [...], "amyParam": "filter_freq" } ],
  "jacks":  [ { "id": "in", "kind": "audio|cv|gate|midi", "dir": "in|out", "label": "in", "target": "filter_freq" } ],
  "behavior": null
}

Rules:
- id starts with "user." and is a lowercase identifier path.
- knob/slider params need min and max; select params need a non-empty options array.
- "amyParam" (if set) must be a real AMY param name (e.g. filter_freq, freq, amp, duty, wave, patch, reverb).
- cv/gate input jacks may set "target" to the AMY param they modulate.
- Only add "behavior": { "script": "…JS…" } for logic beyond params/jacks. Scripts use only the frozen api (api.onTick, api.emit, api.param, api.state, api.display) — no fetch, eval, importScripts, DOM.`;

const FEWSHOT_1_USER = 'a resonant lowpass filter';
const FEWSHOT_1 = JSON.stringify({
  manifestVersion: 1,
  id: 'user.lowpass',
  name: 'Lowpass',
  category: 'filter',
  hp: 8,
  description: 'A resonant lowpass filter.',
  role: 'vcf',
  params: [
    { id: 'cutoff', label: 'Cutoff', control: 'knob', default: 800, min: 20, max: 20000, amyParam: 'filter_freq' },
    { id: 'resonance', label: 'Res', control: 'knob', default: 0.7, min: 0.5, max: 16, amyParam: 'resonance' },
  ],
  jacks: [
    { id: 'in', kind: 'audio', dir: 'in', label: 'in' },
    { id: 'out', kind: 'audio', dir: 'out', label: 'out' },
  ],
  behavior: null,
});

const FEWSHOT_2_USER = 'a random gate generator that fires on some ticks';
const FEWSHOT_2 = JSON.stringify({
  manifestVersion: 1,
  id: 'user.randomgate',
  name: 'Random Gate',
  category: 'modulation',
  hp: 6,
  description: 'Emits a gate on random ticks.',
  role: 'custom',
  params: [{ id: 'density', label: 'Density', control: 'knob', default: 0.5, min: 0, max: 1 }],
  jacks: [{ id: 'gate', kind: 'gate', dir: 'out', label: 'gate' }],
  behavior: { script: "api.onTick(() => { if (Math.random() < api.param('density')) api.emit('gate', { on: true }); });" },
});

export function buildGenerateModuleMessages(prompt: string): ChatMessage[] {
  return [
    { role: 'system', content: RULES },
    { role: 'user', content: FEWSHOT_1_USER },
    { role: 'assistant', content: FEWSHOT_1 },
    { role: 'user', content: FEWSHOT_2_USER },
    { role: 'assistant', content: FEWSHOT_2 },
    { role: 'user', content: prompt },
  ];
}

export function buildModuleRepairMessages(prior: ChatMessage[], badOutput: string, errors: string[]): ChatMessage[] {
  return [
    ...prior,
    { role: 'assistant', content: badOutput },
    { role: 'user', content: `Your previous module JSON failed validation:\n${errors.map((e) => `- ${e}`).join('\n')}\nReturn the corrected JSON only.` },
  ];
}
