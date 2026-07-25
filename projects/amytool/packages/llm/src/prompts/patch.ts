/**
 * generatePatch prompt template (docs/05 §3). System preamble carries the hard
 * rules + the capability matrix in prose + the live CATALOG, followed by two
 * small few-shot examples. Repair messages (verify→repair loop) are built here
 * too so the failure wording stays in one place.
 */
import type { PatchDoc } from '@amy/patchdoc';
import { PATCHPLAN_CONTRACT } from '../contracts/patchplan';
import type { ChatMessage } from '../chat';

const RULES = `You design synthesizer patches for AMY. Output EXACTLY ONE JSON object and nothing else — no markdown, no code fences, no commentary.

The JSON is a "PatchPlan" with this shape:
{
  "contract": "${PATCHPLAN_CONTRACT}",
  "name": "<short patch name>",
  "modules": [ { "id": "vco1", "type": "<catalog id>", "params": { ... } } ],
  "cables":  [ { "from": "vco1.out", "to": "vcf1.in" } ],
  "globals": { "effects": { "reverb": { "level": 0.4 } }, "tempo": 110 },
  "io": { "midiChannel": 1 },
  "notes": "<one sentence on the sound-design intent>"
}

Hard rules:
- Use ONLY module "type" ids and param names/ranges listed in the CATALOG below.
- Module ids are short lowercase identifiers, unique within the patch (e.g. vco1, vcf1, env1).
- Cables are "moduleId.jackId" → "moduleId.jackId", always output → input, same kind.
- audio jacks connect to audio, cv to cv, gate to gate, midi to midi.
- AMY can only modulate amp, frequency, filter cutoff, duty or pan via cv.
- At most 2 envelope targets per oscillator.
- Do NOT include positions — layout is automatic.
- Prefer a pure PatchPlan. Only add "loopCode" (Python) for behavior impossible with modules.`;

const FEWSHOT_USER_1 = 'a simple bright saw lead';
const FEWSHOT_ASSISTANT_1 = JSON.stringify({
  contract: PATCHPLAN_CONTRACT,
  name: 'Bright Saw Lead',
  modules: [
    { id: 'vco1', type: 'core.vco', params: { wave: 'saw' } },
    { id: 'vcf1', type: 'core.vcf', params: { cutoff: 3000, resonance: 1.2 } },
    { id: 'env1', type: 'core.env', params: { attack: 3, decay: 120, sustain: 0.6, release: 150 } },
    { id: 'vca1', type: 'core.vca', params: {} },
    { id: 'out1', type: 'core.out', params: {} },
  ],
  cables: [
    { from: 'vco1.out', to: 'vcf1.in' },
    { from: 'vcf1.out', to: 'vca1.in' },
    { from: 'vca1.out', to: 'out1.in' },
    { from: 'env1.out', to: 'vca1.cv' },
  ],
  notes: 'A bright sawtooth lead with a snappy amplitude envelope.',
});

const FEWSHOT_USER_2 = 'a warm juno pad with reverb';
const FEWSHOT_ASSISTANT_2 = JSON.stringify({
  contract: PATCHPLAN_CONTRACT,
  name: 'Warm Juno Pad',
  modules: [
    { id: 'juno1', type: 'core.junovoice', params: { patch: 8 } },
    { id: 'rev1', type: 'core.fx.reverb', params: { level: 0.5 } },
    { id: 'out1', type: 'core.out', params: {} },
  ],
  cables: [
    { from: 'juno1.out', to: 'rev1.in' },
    { from: 'rev1.out', to: 'out1.in' },
  ],
  globals: { effects: { reverb: { level: 0.5 } } },
  notes: 'A lush Juno preset pad drenched in reverb.',
});

export function buildGeneratePatchMessages(userPrompt: string, catalog: string): ChatMessage[] {
  return [
    { role: 'system', content: `${RULES}\n\nCATALOG:\n${catalog}` },
    { role: 'user', content: FEWSHOT_USER_1 },
    { role: 'assistant', content: FEWSHOT_ASSISTANT_1 },
    { role: 'user', content: FEWSHOT_USER_2 },
    { role: 'assistant', content: FEWSHOT_ASSISTANT_2 },
    { role: 'user', content: userPrompt },
  ];
}

/** Compact digest of the current patch, so the model can modify it (docs/05 §3). */
export function describePatch(doc: PatchDoc): string {
  const modules = doc.modules.map((m) => {
    const params = Object.entries(m.params)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(' ');
    return `- ${m.id}: ${m.type}${params ? ` { ${params} }` : ''}`;
  });
  const cables = doc.cables.map((c) => `- ${c.from.module}.${c.from.jack} -> ${c.to.module}.${c.to.jack}`);
  return [
    `name: ${doc.meta.name}`,
    'modules:',
    ...(modules.length > 0 ? modules : ['- (none)']),
    'cables:',
    ...(cables.length > 0 ? cables : ['- (none)']),
  ].join('\n');
}

/** editPatch turn (docs/05 §3): current patch digest + instruction → full updated plan. */
export function buildEditPatchMessages(doc: PatchDoc, instruction: string, catalog: string): ChatMessage[] {
  return [
    { role: 'system', content: `${RULES}\n\nCATALOG:\n${catalog}` },
    {
      role: 'user',
      content: `Here is the current patch (base id: ${doc.meta.id}):\n${describePatch(doc)}\n\nApply this change: ${instruction}\n\nReturn the COMPLETE updated PatchPlan JSON — every module and cable of the resulting patch, not just the changes. Keep unrelated parts of the patch intact.`,
    },
  ];
}

/** Repair turn appended after a failed attempt (docs/05 §4). */
export function buildRepairMessages(
  prior: ChatMessage[],
  badOutput: string,
  errors: string[],
): ChatMessage[] {
  return [
    ...prior,
    { role: 'assistant', content: badOutput },
    {
      role: 'user',
      content: `Your previous output failed validation:\n${errors
        .map((e) => `- ${e}`)
        .join('\n')}\nReturn the corrected JSON only.`,
    },
  ];
}
