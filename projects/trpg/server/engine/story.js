import db from '../db.js';
import { arcTemplates } from '../data/arcs.js';

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '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';
const LLM_MODEL = 'xiaomi-token-plan/mimo-v2.5-pro';
const LLM_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ─── LLM Call (lightweight, for story generation) ──────────────────
async function callLLM(messages, maxTokens = 1024) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'https://trpg.steppa.online',
      'X-Title': 'TRPG Story Engine',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseLLMJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) { try { return JSON.parse(codeBlockMatch[1]); } catch {} }
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch {} }
  return null;
}

// ─── selectArc ─────────────────────────────────────────────────────
export function selectArc(setting, worldState) {
  const candidates = arcTemplates.filter(a => a.setting === setting);
  if (candidates.length === 0) return null;
  // Pick random from candidates
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ─── generateWorldSeed ─────────────────────────────────────────────
export async function generateWorldSeed(setting, arc) {
  const prompt = `Du bist ein World-Builder für ein Pen & Paper Spiel im ${setting}-Setting.

ARC: "${arc.name}"
Premise: ${arc.premise}
Antagonist: ${arc.antagonist_type}

Generiere einen World-Seed mit:
- world_name: Ein atmosphärischer Name für diese Welt
- locations: 4-5 Locations (je mit name, description, type, connections)
- npcs: 4-6 NPCs (je mit name, role, personality, backstory, attitude -50 bis +50)
- factions: 2-3 Fraktionen (je mit name, description, power_level 0-100, attitude)

Antworte als JSON:
{
  "world_name": "...",
  "locations": [
    {"name": "...", "description": "...", "type": "dorf/stadt/dungeon/wildnis/gebäude", "connections": ["Location2", "Location3"]}
  ],
  "npcs": [
    {"name": "...", "role": "...", "personality": {"traits": ["mutig", "..."], "ideal": "...", "flaw": "..."}, "backstory": "...", "attitude": 20, "location": "Location1"}
  ],
  "factions": [
    {"name": "...", "description": "...", "power_level": 50, "attitude": "neutral", "leader_npc_name": "NPC Name"}
  ]
}`;

  try {
    const raw = await callLLM([{ role: 'system', content: prompt }], 2000);
    const parsed = parseLLMJson(raw);
    if (parsed?.world_name && parsed?.locations && parsed?.npcs) {
      return parsed;
    }
  } catch (err) {
    console.error('generateWorldSeed LLM failed:', err.message);
  }

  // Fallback: generate minimal seed from arc
  return {
    world_name: arc.name + ' — ' + setting,
    locations: [
      { name: 'Marktplatz', description: 'Ein belebter Treffpunkt', type: 'stadt', connections: [] },
      { name: 'Taverne', description: 'Rastplatz für Reisende', type: 'gebäude', connections: ['Marktplatz'] },
    ],
    npcs: [
      { name: 'Der Fremde', role: arc.antagonist_type, personality: { traits: ['geheimnisvoll'] }, backstory: arc.premise, attitude: -20, location: 'Taverne' },
    ],
    factions: [],
  };
}

// ─── createWorld ────────────────────────────────────────────────────
export async function createWorld(settingSlug, arcId) {
  const arc = arcId
    ? arcTemplates.find(a => a.id === arcId) || selectArc(settingSlug)
    : selectArc(settingSlug);

  if (!arc) throw new Error('No arc found for setting: ' + settingSlug);

  const seed = await generateWorldSeed(settingSlug, arc);

  // Create world
  const worldState = {
    arc_id: arc.id,
    arc_name: arc.name,
    current_act: 1,
    tension: 0,
    quests: [],
    flags: {},
  };

  const worldResult = db.prepare(
    'INSERT INTO worlds (setting_slug, name, world_state) VALUES (?, ?, ?)'
  ).run(settingSlug, seed.world_name || arc.name, JSON.stringify(worldState));

  const worldId = Number(worldResult.lastInsertRowid);

  // Create locations
  const insertLoc = db.prepare(
    'INSERT INTO world_locations (world_id, name, description, type, connections, discovered) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const locationMap = {};
  for (const loc of seed.locations || []) {
    const r = insertLoc.run(worldId, loc.name, loc.description || '', loc.type || 'unbekannt', JSON.stringify(loc.connections || []), loc.type === 'stadt' || loc.type === 'dorf' ? 1 : 0);
    locationMap[loc.name] = Number(r.lastInsertRowid);
  }

  // Create NPCs
  const insertNpc = db.prepare(
    'INSERT INTO world_npcs (world_id, name, role, personality, attitude, location, backstory) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const npcMap = {};
  for (const npc of seed.npcs || []) {
    const r = insertNpc.run(worldId, npc.name, npc.role || '', JSON.stringify(npc.personality || {}), npc.attitude || 0, npc.location || '', npc.backstory || '');
    npcMap[npc.name] = Number(r.lastInsertRowid);
  }

  // Create factions
  const insertFaction = db.prepare(
    'INSERT INTO world_factions (world_id, name, description, power_level, attitude, leader_npc_id, territory) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const f of seed.factions || []) {
    const leaderId = f.leader_npc_name ? npcMap[f.leader_npc_name] || null : null;
    insertFaction.run(worldId, f.name, f.description || '', f.power_level || 50, f.attitude || 'neutral', leaderId, JSON.stringify(f.territory || []));
  }

  // Log creation event
  db.prepare(
    'INSERT INTO world_events (world_id, event_type, description, impact) VALUES (?, ?, ?, ?)'
  ).run(worldId, 'discovery', `Welt "${seed.world_name}" erschaffen. Arc: ${arc.name}`, JSON.stringify({ arc_id: arc.id }));

  return { worldId, arc, seed };
}

// ─── buildStoryContext ──────────────────────────────────────────────
export function buildStoryContext(worldId) {
  const world = db.prepare('SELECT * FROM worlds WHERE id = ?').get(worldId);
  if (!world) return null;

  const npcs = db.prepare('SELECT * FROM world_npcs WHERE world_id = ?').all(worldId);
  const locations = db.prepare('SELECT * FROM world_locations WHERE world_id = ?').all(worldId);
  const events = db.prepare('SELECT * FROM world_events WHERE world_id = ? ORDER BY created_at DESC LIMIT 20').all(worldId);
  const factions = db.prepare('SELECT * FROM world_factions WHERE world_id = ?').all(worldId);

  const ws = JSON.parse(world.world_state || '{}');
  const arc = arcTemplates.find(a => a.id === ws.arc_id);

  return {
    world,
    world_state: ws,
    arc,
    npcs: npcs.map(n => ({
      ...n,
      personality: JSON.parse(n.personality || '{}'),
    })),
    locations: locations.map(l => ({
      ...l,
      connections: JSON.parse(l.connections || '[]'),
      events: JSON.parse(l.events || '[]'),
    })),
    events: events.map(e => ({
      ...e,
      impact: JSON.parse(e.impact || '{}'),
    })),
    factions: factions.map(f => ({
      ...f,
      territory: JSON.parse(f.territory || '[]'),
      history: JSON.parse(f.history || '[]'),
    })),
  };
}

// ─── formatStoryContextForPrompt ────────────────────────────────────
export function formatStoryContextForPrompt(ctx) {
  if (!ctx) return '';

  const { world_state, arc, npcs, locations, events, factions } = ctx;

  let text = `\n\n=== STORY ENGINE CONTEXT ===\n`;
  text += `Welt: ${ctx.world.name}\n`;

  if (arc) {
    text += `Arc: ${arc.name} — ${arc.premise}\n`;
    text += `Akt: ${world_state.current_act || 1}/3 — ${arc.acts?.[world_state.current_act - 1]?.name || 'Unbekannt'}\n`;
    text += `Tension: ${world_state.tension || 0}/100\n`;
    if (arc.acts?.[world_state.current_act - 1]?.key_beats) {
      text += `Key Beats: ${arc.acts[world_state.current_act - 1].key_beats.join(', ')}\n`;
    }
  }

  if (npcs.length > 0) {
    text += `\nNPCs:\n`;
    for (const n of npcs) {
      text += `- ${n.name} (${n.role}, ${n.status}, Attitude: ${n.attitude}) @ ${n.location || 'unbekannt'}\n`;
    }
  }

  if (locations.length > 0) {
    text += `\nLocations:\n`;
    for (const l of locations) {
      const disc = l.discovered ? '✓' : '?';
      text += `- ${disc} ${l.name} (${l.type}, ${l.state}) — ${l.description?.slice(0, 80)}\n`;
    }
  }

  if (factions.length > 0) {
    text += `\nFactions:\n`;
    for (const f of factions) {
      text += `- ${f.name} (Power: ${f.power_level}, ${f.attitude}) — ${f.description?.slice(0, 80)}\n`;
    }
  }

  if (events.length > 0) {
    text += `\nLetzte Events:\n`;
    for (const e of events.slice(0, 5)) {
      text += `- [${e.event_type}] ${e.description}\n`;
    }
  }

  if (world_state.quests?.length > 0) {
    text += `\nAktive Quests:\n`;
    for (const q of world_state.quests) {
      text += `- ${q.name}: ${q.status || 'aktiv'}\n`;
    }
  }

  text += `=== END STORY CONTEXT ===\n`;
  return text;
}

// ─── processStoryUpdate ─────────────────────────────────────────────
export function processStoryUpdate(worldId, saveId, turnNumber, llmResponse) {
  const storyUpdate = llmResponse?.story_update;
  if (!storyUpdate) return;

  const world = db.prepare('SELECT * FROM worlds WHERE id = ?').get(worldId);
  if (!world) return;

  const worldState = JSON.parse(world.world_state || '{}');

  // NPC updates
  if (storyUpdate.npc_updates) {
    for (const upd of storyUpdate.npc_updates) {
      if (!upd.name) continue;
      const existing = db.prepare('SELECT * FROM world_npcs WHERE world_id = ? AND name = ?').get(worldId, upd.name);
      if (existing) {
        const updates = [];
        const params = [];
        if (upd.status) { updates.push('status = ?'); params.push(upd.status); }
        if (upd.attitude !== undefined) { updates.push('attitude = ?'); params.push(upd.attitude); }
        if (upd.location) { updates.push('location = ?'); params.push(upd.location); }
        if (upd.last_seen_save) { updates.push('last_seen_save = ?'); params.push(upd.last_seen_save); }
        if (updates.length > 0) {
          params.push(existing.id);
          db.prepare(`UPDATE world_npcs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }
      } else if (upd.new) {
        // New NPC discovered
        db.prepare(
          'INSERT INTO world_npcs (world_id, name, role, personality, attitude, location, backstory, first_appeared_in_save, last_seen_save) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(worldId, upd.name, upd.role || '', JSON.stringify(upd.personality || {}), upd.attitude || 0, upd.location || '', upd.backstory || '', saveId, saveId);
      }
    }
  }

  // Location updates
  if (storyUpdate.location_updates) {
    for (const upd of storyUpdate.location_updates) {
      if (!upd.name) continue;
      const existing = db.prepare('SELECT * FROM world_locations WHERE world_id = ? AND name = ?').get(worldId, upd.name);
      if (existing) {
        const updates = [];
        const params = [];
        if (upd.state) { updates.push('state = ?'); params.push(upd.state); }
        if (upd.discovered !== undefined) { updates.push('discovered = ?'); params.push(upd.discovered ? 1 : 0); }
        if (upd.description) { updates.push('description = ?'); params.push(upd.description); }
        if (updates.length > 0) {
          params.push(existing.id);
          db.prepare(`UPDATE world_locations SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }
      } else {
        db.prepare(
          'INSERT INTO world_locations (world_id, name, description, type, state, discovered) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(worldId, upd.name, upd.description || '', upd.type || 'unbekannt', upd.state || 'intakt', upd.discovered ? 1 : 0);
      }
    }
  }

  // World events
  if (storyUpdate.events) {
    for (const evt of storyUpdate.events) {
      db.prepare(
        'INSERT INTO world_events (world_id, save_id, turn_number, event_type, description, impact, npc_involved, location_involved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(worldId, saveId, turnNumber, evt.event_type || 'other', evt.description || '', JSON.stringify(evt.impact || {}), evt.npc_involved || null, evt.location_involved || null);
    }
  }

  // Faction updates
  if (storyUpdate.faction_updates) {
    for (const upd of storyUpdate.faction_updates) {
      if (!upd.name) continue;
      const existing = db.prepare('SELECT * FROM world_factions WHERE world_id = ? AND name = ?').get(worldId, upd.name);
      if (existing) {
        const updates = [];
        const params = [];
        if (upd.power_level !== undefined) { updates.push('power_level = ?'); params.push(Math.max(0, Math.min(100, upd.power_level))); }
        if (upd.attitude) { updates.push('attitude = ?'); params.push(upd.attitude); }
        if (updates.length > 0) {
          params.push(existing.id);
          db.prepare(`UPDATE world_factions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }
      }
    }
  }

  // Quest updates
  if (storyUpdate.quest_updates) {
    worldState.quests = worldState.quests || [];
    for (const q of storyUpdate.quest_updates) {
      const existing = worldState.quests.find(eq => eq.name === q.name);
      if (existing) {
        Object.assign(existing, q);
      } else {
        worldState.quests.push(q);
      }
    }
  }

  // Tension update
  if (storyUpdate.tension_change !== undefined) {
    worldState.tension = Math.max(0, Math.min(100, (worldState.tension || 0) + storyUpdate.tension_change));
  }
  if (storyUpdate.tension !== undefined) {
    worldState.tension = Math.max(0, Math.min(100, storyUpdate.tension));
  }

  // Flags
  if (storyUpdate.flags) {
    worldState.flags = worldState.flags || {};
    Object.assign(worldState.flags, storyUpdate.flags);
  }

  // Act advancement
  if (storyUpdate.advance_act) {
    worldState.current_act = Math.min(3, (worldState.current_act || 1) + 1);
  }

  db.prepare('UPDATE worlds SET world_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(worldState), worldId);

  return storyUpdate;
}

// ─── advanceAct ─────────────────────────────────────────────────────
export function advanceAct(worldId) {
  const world = db.prepare('SELECT * FROM worlds WHERE id = ?').get(worldId);
  if (!world) return false;

  const ws = JSON.parse(world.world_state || '{}');
  const arc = arcTemplates.find(a => a.id === ws.arc_id);
  if (!arc) return false;

  const currentAct = ws.current_act || 1;
  if (currentAct >= 3) return false;

  const nextAct = arc.acts[currentAct]; // 0-indexed, currentAct is 1-based
  if (!nextAct) return false;

  const tension = ws.tension || 0;
  if (tension >= nextAct.tension_range[0]) {
    ws.current_act = currentAct + 1;
    db.prepare('UPDATE worlds SET world_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(ws), worldId);

    // Log act change
    db.prepare(
      'INSERT INTO world_events (world_id, event_type, description, impact) VALUES (?, ?, ?, ?)'
    ).run(worldId, 'other', `Akt-Wechsel: ${arc.acts[currentAct - 1]?.name} → ${nextAct.name}`, JSON.stringify({ new_act: currentAct + 1 }));

    return true;
  }
  return false;
}

// ─── getWorldHistory ────────────────────────────────────────────────
export function getWorldHistory(worldId) {
  const events = db.prepare(
    'SELECT * FROM world_events WHERE world_id = ? ORDER BY created_at ASC'
  ).all(worldId);

  return events.map(e => ({
    ...e,
    impact: JSON.parse(e.impact || '{}'),
  }));
}
