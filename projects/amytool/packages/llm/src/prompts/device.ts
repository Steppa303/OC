/**
 * Device-extraction prompt (docs/07 P6-03). After a patch with loopCode is
 * accepted, a follow-up call asks the model to describe the code's tweakable
 * parameters + jacks as a DeviceManifest so the canvas can render a native
 * panel instead of the raw Custom Code box.
 */
import type { ChatMessage } from '../chat';

const RULES = `You extract a control panel description from a Python synth sketch. Output EXACTLY ONE JSON object — a DeviceManifest — and nothing else (no markdown, no prose).

Shape:
{
  "contract": "devicemanifest.v1",
  "name": "<short device name>",
  "description": "<one line>",
  "params": [ { "id": "feedback", "label": "Feedback", "min": 0, "max": 0.95, "default": 0.5, "binding": "feedback" } ],
  "jacks":  [ { "id": "in", "kind": "audio|cv|gate|midi", "dir": "in|out", "label": "in" } ]
}

Rules:
- Each param's "binding" MUST be a variable that is assigned at the TOP LEVEL of the given code (column 0, "name = value"). Never invent variables.
- Only numeric variables a user would want to tweak (1–8 params). "default" is the value assigned in the code; pick a sensible musical min/max around it.
- 0–6 jacks describing the device's signal role (e.g. an effect: audio in + audio out). Ids are lowercase identifiers.
- If the code has no tweakable top-level variables, still return the object with the best single param you can justify — otherwise the caller falls back to a plain code box.`;

const FEWSHOT_USER = `Request: "a simple vibrato lead"
Code:
import amy
rate = 6.0
depth = 0.4
amy.send(osc=1, wave=3, freq=6.0, amp='0,0,0,0,0,0')
amy.send(osc=0, wave=0, note=60, vel=1, mod_source=1)

def loop():
    amy.send(osc=1, freq=rate)
`;

const FEWSHOT = JSON.stringify({
  contract: 'devicemanifest.v1',
  name: 'Vibrato Lead',
  description: 'Saw lead with LFO vibrato; rate and depth are tweakable.',
  params: [
    { id: 'rate', label: 'Rate', min: 0.1, max: 20, default: 6.0, binding: 'rate', unit: 'Hz' },
    { id: 'depth', label: 'Depth', min: 0, max: 1, default: 0.4, binding: 'depth' },
  ],
  jacks: [{ id: 'out', kind: 'audio', dir: 'out', label: 'out' }],
});

export function buildExtractDeviceMessages(prompt: string, loopCode: string): ChatMessage[] {
  return [
    { role: 'system', content: RULES },
    { role: 'user', content: FEWSHOT_USER },
    { role: 'assistant', content: FEWSHOT },
    { role: 'user', content: `Request: ${JSON.stringify(prompt)}\nCode:\n${loopCode}` },
  ];
}

export function buildDeviceRepairMessages(prior: ChatMessage[], badOutput: string, errors: string[]): ChatMessage[] {
  return [
    ...prior,
    { role: 'assistant', content: badOutput },
    { role: 'user', content: `Your previous DeviceManifest JSON failed validation:\n${errors.map((e) => `- ${e}`).join('\n')}\nReturn the corrected JSON only.` },
  ];
}
