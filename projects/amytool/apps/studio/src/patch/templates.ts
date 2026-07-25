/**
 * Starter templates (P7-01) — ready-to-play patches offered in the first-run
 * gallery. Built from the authored group fragments (docs/07 P5-04) plus an
 * on-screen keyboard where it makes sense, so every template is playable the
 * moment it lands on the rack.
 */
import { patchDocSchema, type PatchDoc } from '@amy/patchdoc';
import { expandGroup, groupById, moduleDefaultParams, registry } from '@amy/modules';

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  build: () => PatchDoc;
}

const KEYBOARD_HP_OFFSET = 12;

function buildFromGroup(name: string, tags: string[], groupId: string, withKeyboard: boolean): PatchDoc {
  const group = groupById(groupId);
  if (!group) throw new Error(`unknown starter group '${groupId}'`);
  const taken = new Set<string>();
  const cableIds = new Set<string>();

  const modules = [];
  if (withKeyboard) {
    const kb = registry.byId('core.keyboard');
    modules.push({
      id: 'keys1',
      type: 'core.keyboard',
      label: kb?.name ?? 'Keyboard',
      pos: { x: 0, y: 0 },
      params: kb ? moduleDefaultParams(kb) : {},
      advanced: false,
      state: {},
    });
    taken.add('keys1');
  }
  const expanded = expandGroup(group, { x: withKeyboard ? KEYBOARD_HP_OFFSET : 0, y: 0 }, taken, cableIds);
  modules.push(...expanded.modules);

  const now = new Date().toISOString();
  return patchDocSchema.parse({
    version: 1,
    meta: {
      id: crypto.randomUUID(),
      name,
      tags,
      createdAt: now,
      modifiedAt: now,
      origin: 'group-template',
    },
    modules,
    cables: expanded.cables,
  });
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'starter.subtractive',
    name: 'Subtractive Synth',
    description: 'Keyboard into the classic VCO → VCF → VCA chain with an envelope.',
    build: () => buildFromGroup('Subtractive Synth', ['starter', 'synth'], 'group.subtractive', true),
  },
  {
    id: 'starter.fm',
    name: 'FM Keys',
    description: 'Keyboard driving a 2-operator FM voice.',
    build: () => buildFromGroup('FM Keys', ['starter', 'fm'], 'group.fm2op', true),
  },
  {
    id: 'starter.drums',
    name: 'Drum Machine',
    description: 'A 4×16 drum grid pre-cabled to a drum kit through a mixer.',
    build: () => buildFromGroup('Drum Machine', ['starter', 'drums'], 'group.drummachine', false),
  },
];
