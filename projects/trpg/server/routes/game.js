import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { settingPresets } from '../data/settings.js';
import { buildStoryContext, formatStoryContextForPrompt, processStoryUpdate, advanceAct, createWorld, selectArc } from '../engine/story.js';
import { logTurn, logOpening, getJournal, getJournalSummary, getWorldJournal } from '../engine/story-logger.js';

const router = Router();

// ─── LLM Config ────────────────────────────────────────────────────
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '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';
const LLM_MODEL = 'google/gemini-2.5-flash';
const LLM_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ─── LLM Call Helper ───────────────────────────────────────────────
async function callLLM(messages, maxTokens = 1024) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'https://trpg.steppa.online',
      'X-Title': 'TRPG Text Adventure',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.85,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
}

// ─── Robust JSON Parser ────────────────────────────────────────────
function parseLLMJson(raw) {
  if (!raw) return null;

  // Try direct parse
  try {
    return JSON.parse(raw);
  } catch {}

  // Try extracting JSON from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {}
  }

  // Try finding first { ... } block
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {}
  }

  return null;
}

// ─── System Prompt Builder ─────────────────────────────────────────
function buildSystemPrompt(settingName, character, currentScene, recentHistory, storyContextText, lastSceneTypes) {
  const stats = typeof character.stats === 'string' ? JSON.parse(character.stats) : character.stats || {};
  const inventory = typeof character.inventory === 'string' ? JSON.parse(character.inventory) : character.inventory || [];
  const invSummary = inventory.length > 0
    ? inventory.map(i => typeof i === 'string' ? i : i.name).join(', ')
    : 'Nichts';

  const historyText = recentHistory && recentHistory.length > 0
    ? recentHistory.map(h => `- ${h.user_action} → ${h.ai_response?.slice(0, 100)}`).join('\n')
    : 'Noch keine Aktionen.';

  const antiRepetition = lastSceneTypes && lastSceneTypes.length > 0
    ? `\nANTI-WIEDERHOLUNG: Letzte Szenen-Typen: ${lastSceneTypes.join(', ')}'. Wiederhole NICHT dieselbe Art von Szene. Variiere: Kampf, Erkundung, Dialog, Rätsel, soziale Interaktion, Entdeckung.`
    : '';

  return `Du bist ein erfahrener Pen & Paper Spielleiter. Du leitest ein Text-Adventure im ${settingName}-Setting.

REGELN:
- Beschreibe Szenen lebendig und atmosphärisch (3-5 Sätze)
- Gib dem Spieler IMMER 4 Wahlmöglichkeiten als Buttons
- Jede relevante Aktion erfordert einen W20-Wurf
- Bei Würfelwürfen: Beschreibe das Ergebnis narrativ
  - Nat 20: Kritischer Erfolg (episch, bonus Effekt)
  - 15+: Solider Erfolg
  - 10-14: Teilerfolg mit Konsequenz
  - 2-9: Misserfolg mit Konsequenz
  - Nat 1: Patzer (katastrophal, aber spannend)
- Halte Stats und Inventar konsistent
- XP vergeben bei Erfolgen (10-50 je nach Schwierigkeit)
- Tod ist möglich, aber fair (nicht bei Nat 1 im ersten Kampf)
- Nutze die Story-Kontext-Informationen für Konsistenz (NPCs, Locations, Factions)
- Wenn ein story_update relevant ist, liefere ihn mit im JSON
${antiRepetition}

CHARACTER: ${character.name}, ${character.class_name}, Level ${character.level}
STATS: STR ${stats.str || 10} DEX ${stats.dex || 10} CON ${stats.con || 10} INT ${stats.int || 10} WIS ${stats.wis || 10} CHA ${stats.cha || 10}
HP: ${character.hp}/${character.max_hp} | Mana: ${character.mana || 0}/${character.max_mana || 0}
INVENTAR: ${invSummary}
AKTUELLE SZENE: ${currentScene || 'Noch keine Szene.'}
VERLAUF (letzte 3 Aktionen):
${historyText}
${storyContextText || ''}

ANTWORT-FORMAT (exakt dieses JSON):
{
  "scene": "Beschreibung der neuen Situation...",
  "choices": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "dice_required": true,
  "dice_type": "d20",
  "difficulty_class": 12,
  "skill_used": "STR",
  "xp_gained": 25,
  "hp_change": 0,
  "mana_change": 0,
  "gold_change": 0,
  "items_added": [],
  "items_removed": [],
  "story_flag": "",
  "narrative_style": "success",
  "story_update": {
    "npc_updates": [{"name": "NPC Name", "status": "alive", "attitude": 10, "location": "Ort"}],
    "location_updates": [{"name": "Location", "discovered": true, "state": "intakt"}],
    "events": [{"event_type": "discovery", "description": "Was ist passiert", "npc_involved": "Name", "location_involved": "Ort"}],
    "faction_updates": [{"name": "Fraktion", "power_level": 60, "attitude": "neutral"}],
    "quest_updates": [{"name": "Quest-Name", "status": "aktiv", "description": "Was zu tun ist"}],
    "tension_change": 5
  }
}`;
}

// ─── Opening Scene Prompt ──────────────────────────────────────────
function buildOpeningPrompt(settingName, settingDesc, character, classes, arc, storyContextText) {
  const stats = typeof character.stats === 'string' ? JSON.parse(character.stats) : character.stats || {};

  const arcSection = arc ? `

ARC: "${arc.name}"
Premise: ${arc.premise}
Antagonist: ${arc.antagonist_type}
Act 1: ${arc.acts?.[0]?.name} — Key Beats: ${arc.acts?.[0]?.key_beats?.join(', ') || 'N/A'}

Generiere die Eröffnungsszene so, dass sie zum Arc passt. Der Spieler soll die Hauptquest organisch entdecken.
Du MUSST im story_update die initialen NPCs, Locations und Factions angeben die der Spieler zu Beginn kennt.` : '';

  return `Du bist ein erfahrener Pen & Paper Spielleiter. Generiere die ERÖFFNUNGSSZENE für ein neues Abenteuer.

SETTING: ${settingName} — ${settingDesc || ''}
CHARACTER: ${character.name}, ${character.class_name}, Level 1
STATS: STR ${stats.str || 10} DEX ${stats.dex || 10} CON ${stats.con || 10} INT ${stats.int || 10} WIS ${stats.wis || 10} CHA ${stats.cha || 10}
HP: ${character.hp}/${character.max_hp}
${arcSection}
${storyContextText || ''}

REGELN:
- Beschreibe die Eröffnungsszene atmosphärisch (4-6 Sätze)
- Setze den Charakter sinnvoll in die Welt
- Gib dem Spieler 4 Wahlmöglichkeiten als Buttons
- Kein Würfelwurf nötig für die erste Szene

ANTWORT-FORMAT (exakt dieses JSON):
{
  "scene": "Atmosphärische Beschreibung der Eröffnungsszene...",
  "choices": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "dice_required": false,
  "xp_gained": 0,
  "hp_change": 0,
  "mana_change": 0,
  "gold_change": 0,
  "narrative_style": "neutral",
  "story_update": {
    "npc_updates": [{"name": "Name", "new": true, "role": "Rolle", "attitude": 0, "location": "Ort"}],
    "location_updates": [{"name": "Ort", "discovered": true}],
    "events": [{"event_type": "discovery", "description": "Was passiert ist"}],
    "quest_updates": [{"name": "Questname", "status": "aktiv", "description": "Ziel"}]
  }
}`;
}

// ─── Fallback Responses ────────────────────────────────────────────
function fallbackResponse(isSuccess, settingName) {
  const scenes = isSuccess
    ? [
        'Du handelst entschlossen und dein Einsatz zahlt sich aus. Die Situation wendet sich zu deinen Gunsten. Neue Möglichkeiten tun sich vor dir auf.',
        'Dein Mut wird belohnt! Du findest etwas Nützliches und gewinnst wertvolle Erkenntnisse über die Umgebung.',
        'Mit Geschick und etwas Glück meisterst du die Herausforderung. Die Spuren führen dich tiefer ins Abenteuer.',
      ]
    : [
        'Dein Versuch scheitert, aber du lernst daraus. Die Situation spitzt sich zu — du musst dich entscheiden.',
        'Es läuft nicht wie geplant — doch das Abenteuer geht weiter. Die Konsequenzen sind noch nicht absehbar.',
        'Die Herausforderung erweist sich als größer als erwartet. Du musst einen anderen Weg finden.',
      ];

  return {
    scene: scenes[Math.floor(Math.random() * scenes.length)],
    choices: [
      'Weiter voranschreiten',
      'Vorsichtiger vorgehen',
      'Die Umgebung genauer untersuchen',
      'Einen anderen Weg einschlagen',
    ],
    dice_required: true,
    dice_type: 'd20',
    difficulty_class: 12,
    skill_used: 'STR',
    xp_gained: isSuccess ? 25 : 5,
    hp_change: isSuccess ? 0 : -3,
    mana_change: 0,
    gold_change: 0,
    items_added: [],
    items_removed: [],
    story_flag: '',
    narrative_style: isSuccess ? 'success' : 'failure',
  };
}

// ─── Seed Settings ─────────────────────────────────────────────────
function seedSettings() {
  const count = db.prepare('SELECT COUNT(*) as c FROM settings').get();
  if (count.c === 0) {
    const insert = db.prepare(
      'INSERT INTO settings (name, slug, description, classes, tone, starting_items) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const s of settingPresets) {
      insert.run(s.name, s.slug, s.description, JSON.stringify(s.classes), s.tone, JSON.stringify(s.starting_items));
    }
    console.log('Settings seeded.');
  }
}
seedSettings();

// ─── GET /game/settings ────────────────────────────────────────────
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const result = rows.map((r) => ({
    ...r,
    classes: JSON.parse(r.classes),
    starting_items: r.starting_items ? JSON.parse(r.starting_items) : [],
  }));
  res.json(result);
});

// ─── POST /game/new ────────────────────────────────────────────────
router.post('/new', async (req, res) => {
  const { user_id, setting, character: charData, world_id, arc_id } = req.body;
  if (!user_id || !setting || !charData) {
    return res.status(400).json({ error: 'Missing user_id, setting, or character' });
  }

  try {
    // Insert character
    const charInsert = db.prepare(
      'INSERT INTO characters (user_id, name, class_name, hp, max_hp, mana, max_mana, stats, skills, gold, inventory, equipment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const charResult = charInsert.run(
      user_id,
      charData.name,
      charData.class_name,
      charData.hp,
      charData.max_hp,
      charData.mana || 0,
      charData.max_mana || 0,
      JSON.stringify(charData.stats),
      JSON.stringify(charData.skills || []),
      0,
      JSON.stringify([]),
      JSON.stringify({ weapon: null, armor: null, shield: null, acc1: null, acc2: null })
    );

    const charId = Number(charResult.lastInsertRowid);
    const settingRow = db.prepare('SELECT * FROM settings WHERE slug = ?').get(setting);
    const startingItems = settingRow?.starting_items ? JSON.parse(settingRow.starting_items) : [];

    // Handle world: use existing or create new
    let worldId = world_id || null;
    let storyCtx = null;
    let arc = null;

    if (!worldId) {
      // Create a new world
      try {
        const worldResult = await createWorld(setting, arc_id || null);
        worldId = worldResult.worldId;
        arc = worldResult.arc;
      } catch (worldErr) {
        console.error('World creation failed, proceeding without world:', worldErr.message);
      }
    }

    if (worldId) {
      storyCtx = buildStoryContext(worldId);
      if (storyCtx?.arc) arc = storyCtx.arc;
    }

    // Generate opening scene via LLM
    let openingScene = '';
    let choices = ['Erkunde die Umgebung', 'Sprich mit einem Fremden', 'Suche nach Vorräten', 'Sieh dich nach Gefahren um'];

    try {
      const charForPrompt = {
        name: charData.name,
        class_name: charData.class_name,
        level: 1,
        hp: charData.hp,
        max_hp: charData.max_hp,
        mana: charData.mana || 0,
        max_mana: charData.max_mana || 0,
        stats: charData.stats,
      };

      const storyContextText = storyCtx ? formatStoryContextForPrompt(storyCtx) : '';

      const prompt = buildOpeningPrompt(
        settingRow?.name || setting,
        settingRow?.description || '',
        charForPrompt,
        settingRow?.classes ? JSON.parse(settingRow.classes) : [],
        arc,
        storyContextText
      );

      const llmRaw = await callLLM([{ role: 'system', content: prompt }], 1200);
      const parsed = parseLLMJson(llmRaw);

      if (parsed?.scene) {
        openingScene = parsed.scene;
        if (parsed.choices?.length >= 2) {
          choices = parsed.choices.slice(0, 4);
        }

        // Process initial story update from opening scene
        let storyUpdateResult = null;
        if (parsed.story_update && worldId) {
          storyUpdateResult = processStoryUpdate(worldId, null, 0, parsed);
        }

        // Log opening scene to story journal
        if (worldId) {
          const wsAfter = db.prepare('SELECT world_state FROM worlds WHERE id = ?').get(worldId);
          logOpening({
            saveId: null, // save not yet created
            worldId,
            systemPrompt: prompt,
            llmRaw,
            llmParsed: parsed,
            storyUpdateProcessed: storyUpdateResult || parsed.story_update || null,
            postState: wsAfter ? JSON.parse(wsAfter.world_state || '{}') : null,
            arcId: arc?.id,
            arcName: arc?.name,
          });
        }
      }
    } catch (llmErr) {
      console.error('LLM opening scene failed, using fallback:', llmErr.message);
      openingScene = `Willkommen, ${charData.name}! Du stehst am Anfang eines großen Abenteuers im ${settingRow?.name || setting}-Setting. Die Welt liegt vor dir — voller Gefahren, Schätze und ungeschriebener Geschichten.`;
    }

    // Insert save
    const saveInsert = db.prepare(
      'INSERT INTO saves (user_id, name, setting, character_id, current_scene, scene_history, game_state, world_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const saveResult = saveInsert.run(
      user_id,
      `${charData.name}'s Abenteuer`,
      setting,
      charId,
      openingScene,
      JSON.stringify([]),
      JSON.stringify({ turn: 0, flags: {}, quests: [], world_id: worldId }),
      worldId
    );

    const saveId = Number(saveResult.lastInsertRowid);

    // Backfill save_id in story journal entry for this opening
    if (worldId) {
      try {
        db.prepare('UPDATE story_journal SET save_id = ? WHERE world_id = ? AND turn_number = 0 AND save_id IS NULL')
          .run(saveId, worldId);
      } catch {}
    }

    // Update first_appeared_in_save for NPCs created during world seed
    if (worldId) {
      db.prepare('UPDATE world_npcs SET first_appeared_in_save = ?, last_seen_save = ? WHERE world_id = ? AND first_appeared_in_save IS NULL')
        .run(saveId, saveId, worldId);
    }

    res.json({
      save_id: saveId,
      character_id: charId,
      world_id: worldId,
      opening_scene: openingScene,
      choices,
      starting_items: startingItems,
    });
  } catch (err) {
    console.error('POST /game/new error:', err);
    res.status(500).json({ error: 'Server error creating game' });
  }
});

// ─── POST /game/action ─────────────────────────────────────────────
router.post('/action', async (req, res) => {
  const { save_id, action, is_freetext } = req.body;
  if (!save_id || !action) {
    return res.status(400).json({ error: 'Missing save_id or action' });
  }

  const save = db.prepare('SELECT * FROM saves WHERE id = ?').get(save_id);
  if (!save) return res.status(404).json({ error: 'Save not found' });

  const character = save.character_id
    ? db.prepare('SELECT * FROM characters WHERE id = ?').get(save.character_id)
    : null;
  if (!character) return res.status(404).json({ error: 'Character not found' });

  const turn = (JSON.parse(save.game_state || '{}').turn || 0) + 1;

  // Roll dice server-side
  const diceResult = crypto.randomInt(1, 21);
  const stats = typeof character.stats === 'string' ? JSON.parse(character.stats) : character.stats || {};

  // Get recent history for context
  const recentHistory = db.prepare(
    'SELECT user_action, ai_response FROM game_log WHERE save_id = ? ORDER BY turn_number DESC LIMIT 3'
  ).all(save_id);

  // Get last 5 scene types for anti-repetition
  const lastSceneTypes = db.prepare(
    'SELECT ai_response FROM game_log WHERE save_id = ? ORDER BY turn_number DESC LIMIT 5'
  ).all(save_id);
  const sceneTypeHints = lastSceneTypes.map(h => {
    const text = h.ai_response?.toLowerCase() || '';
    if (text.includes('kampf') || text.includes('angriff') || text.includes('schwert')) return 'Kampf';
    if (text.includes('dialog') || text.includes('sagst') || text.includes('sprichst')) return 'Dialog';
    if (text.includes('untersuch') || text.includes('suchst') || text.includes('findest')) return 'Erkundung';
    return 'Erzählung';
  });

  // Build LLM messages
  const settingRow = db.prepare('SELECT * FROM settings WHERE slug = ?').get(save.setting);
  const charForPrompt = {
    name: character.name,
    class_name: character.class_name,
    level: character.level,
    hp: character.hp,
    max_hp: character.max_hp,
    mana: character.mana,
    max_mana: character.max_mana,
    stats,
    inventory: typeof character.inventory === 'string' ? JSON.parse(character.inventory) : character.inventory || [],
  };

  // Build story context
  let storyContextText = '';
  const worldId = save.world_id || JSON.parse(save.game_state || '{}').world_id;
  if (worldId) {
    const storyCtx = buildStoryContext(worldId);
    if (storyCtx) {
      storyContextText = formatStoryContextForPrompt(storyCtx);
    }
  }

  const systemPrompt = buildSystemPrompt(
    settingRow?.name || save.setting,
    charForPrompt,
    save.current_scene,
    recentHistory,
    storyContextText,
    sceneTypeHints
  );

  const diceContext = is_freetext
    ? `Der Spieler schreibt frei: "${action}"`
    : `Der Spieler wählt: "${action}"`;

  const userMessage = `${diceContext}
Der W20-Wurf ergibt: ${diceResult}

Generiere die nächste Szene im JSON-Format. Berücksichtige das Würfelergebnis narrativ.`;

  let llmResponse;
  let llmRawResponse = '';

  // Capture pre-turn state for journal
  const effectiveWorldId = save.world_id || JSON.parse(save.game_state || '{}').world_id;
  let preTurnWorldState = null;
  let actBefore = null;
  let tensionBefore = null;
  let questsBefore = null;
  if (effectiveWorldId) {
    try {
      const ws = db.prepare('SELECT world_state FROM worlds WHERE id = ?').get(effectiveWorldId);
      preTurnWorldState = ws ? JSON.parse(ws.world_state) : null;
      actBefore = preTurnWorldState?.current_act || null;
      tensionBefore = preTurnWorldState?.tension ?? null;
      questsBefore = preTurnWorldState?.quests || null;
    } catch {}
  }

  try {
    const llmRaw = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ], 1200);
    llmRawResponse = llmRaw || '';

    llmResponse = parseLLMJson(llmRaw);

    if (!llmResponse?.scene) {
      console.warn('LLM returned invalid JSON, using fallback. Raw:', llmRaw?.slice(0, 300));
      llmResponse = null;
    }
  } catch (llmErr) {
    console.error('LLM call failed:', llmErr.message);
    llmResponse = null;
  }

  // Fallback if LLM failed
  if (!llmResponse) {
    const success = diceResult >= 12;
    llmResponse = fallbackResponse(success, settingRow?.name || save.setting);
  }

  // Build dice_roll object
  const skillMap = { STR: 'str', DEX: 'dex', CON: 'con', INT: 'int', WIS: 'wis', CHA: 'cha' };
  const skillUsed = llmResponse.skill_used || 'STR';
  const skillKey = skillMap[skillUsed] || 'str';
  const bonus = Math.floor(((stats[skillKey] || 10) - 10) / 2);
  const dc = llmResponse.difficulty_class || 12;
  const total = diceResult + bonus;
  const success = total >= dc;

  const diceRoll = {
    type: 'd20',
    result: diceResult,
    bonus,
    total,
    dc,
    success,
    skill: skillUsed,
  };

  // Apply state changes
  const xpGained = llmResponse.xp_gained || (success ? 25 : 5);
  const hpChange = llmResponse.hp_change || 0;
  const manaChange = llmResponse.mana_change || 0;
  const goldChange = llmResponse.gold_change || 0;

  // Update character stats
  {
    const newHp = Math.max(0, Math.min(character.hp + hpChange, character.max_hp));
    const newMana = Math.max(0, Math.min(character.mana + manaChange, character.max_mana));
    const newGold = Math.max(0, (character.gold || 0) + goldChange);
    const newXp = (character.xp || 0) + xpGained;
    const newLevel = Math.floor(newXp / 100) + 1;

    db.prepare(
      'UPDATE characters SET hp = ?, mana = ?, gold = ?, xp = ?, level = ? WHERE id = ?'
    ).run(newHp, newMana, newGold, newXp, newLevel, character.id);

    // Handle items
    if (llmResponse.items_added?.length > 0) {
      const inv = typeof character.inventory === 'string' ? JSON.parse(character.inventory) : character.inventory || [];
      inv.push(...llmResponse.items_added);
      db.prepare('UPDATE characters SET inventory = ? WHERE id = ?').run(JSON.stringify(inv), character.id);
    }
    if (llmResponse.items_removed?.length > 0) {
      const inv = typeof character.inventory === 'string' ? JSON.parse(character.inventory) : character.inventory || [];
      for (const item of llmResponse.items_removed) {
        const idx = inv.findIndex(i => (typeof i === 'string' ? i : i.name) === item);
        if (idx >= 0) inv.splice(idx, 1);
      }
      db.prepare('UPDATE characters SET inventory = ? WHERE id = ?').run(JSON.stringify(inv), character.id);
    }
  }

  // Update save
  const gameState = JSON.parse(save.game_state || '{}');
  gameState.turn = turn;
  if (llmResponse.story_flag) {
    gameState.flags = gameState.flags || {};
    gameState.flags[llmResponse.story_flag] = true;
  }

  const sceneHistory = JSON.parse(save.scene_history || '[]');
  sceneHistory.push({ scene: save.current_scene, turn: turn - 1 });
  if (sceneHistory.length > 10) sceneHistory.shift();

  db.prepare(
    'UPDATE saves SET current_scene = ?, scene_history = ?, game_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(llmResponse.scene, JSON.stringify(sceneHistory), JSON.stringify(gameState), save_id);

  // Process story update from LLM response
  let storyUpdateResult = null;
  if (effectiveWorldId && llmResponse.story_update) {
    try {
      storyUpdateResult = processStoryUpdate(effectiveWorldId, save_id, turn, llmResponse);
      advanceAct(effectiveWorldId);
    } catch (storyErr) {
      console.error('Story update processing failed:', storyErr.message);
    }
  }

  // Get post-turn world state
  let postTurnWorldState = null;
  let actAfter = null;
  let tensionAfter = null;
  let questsAfter = null;
  if (effectiveWorldId) {
    try {
      const ws = db.prepare('SELECT world_state FROM worlds WHERE id = ?').get(effectiveWorldId);
      postTurnWorldState = ws ? JSON.parse(ws.world_state) : null;
      actAfter = postTurnWorldState?.current_act || null;
      tensionAfter = postTurnWorldState?.tension ?? null;
      questsAfter = postTurnWorldState?.quests || null;
    } catch {}
  }

  // Scene type classification
  const sceneText = llmResponse.scene?.toLowerCase() || '';
  let sceneType = 'erzählung';
  if (sceneText.includes('kampf') || sceneText.includes('angriff') || sceneText.includes('schwert') || sceneText.includes('feind') || sceneText.includes('gegner')) sceneType = 'kampf';
  else if (sceneText.includes('dialog') || sceneText.includes('sagst') || sceneText.includes('sprichst') || sceneText.includes('antwort')) sceneType = 'dialog';
  else if (sceneText.includes('untersuch') || sceneText.includes('suchst') || sceneText.includes('findest') || sceneText.includes('entdeck')) sceneType = 'erkundung';
  else if (sceneText.includes('rätsel') || sceneText.includes('puzzle') || sceneText.includes('lösung')) sceneType = 'rätsel';
  else if (sceneText.includes('händler') || sceneText.includes('handel') || sceneText.includes('kauf')) sceneType = 'sozial';

  // Log to story journal
  try {
    logTurn({
      saveId: save_id,
      worldId: effectiveWorldId,
      turnNumber: turn,
      systemPrompt: systemPrompt,
      userPrompt: userMessage,
      llmRaw: llmRawResponse,
      llmParsed: llmResponse,
      preState: preTurnWorldState,
      storyUpdateProcessed: storyUpdateResult || llmResponse.story_update || null,
      postState: postTurnWorldState,
      playerAction: action,
      isFreetext: !!is_freetext,
      diceRoll,
      sceneType,
      narrativeStyle: llmResponse.narrative_style,
      actBefore,
      actAfter,
      tensionBefore,
      tensionAfter,
      questsBefore,
      questsAfter,
    });
  } catch (logErr) {
    console.error('[StoryLogger] logTurn failed:', logErr.message);
  }

  // Get current world state for response
  let worldState = null;
  if (effectiveWorldId) {
    try {
      worldState = postTurnWorldState;
    } catch {}
  }

  // Log
  db.prepare(
    'INSERT INTO game_log (save_id, turn_number, user_action, dice_roll, ai_response, state_changes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    save_id,
    turn,
    action,
    JSON.stringify(diceRoll),
    llmResponse.scene,
    JSON.stringify({ xp: xpGained, hp: hpChange, mana: manaChange, gold: goldChange })
  );

  res.json({
    turn,
    dice_roll: diceRoll,
    scene: llmResponse.scene,
    choices: llmResponse.choices?.slice(0, 4) || [
      'Weiter voranschreiten',
      'Vorsichtiger vorgehen',
      'Die Umgebung genauer untersuchen',
      'Einen anderen Weg einschlagen',
    ],
    state_changes: {
      xp: xpGained,
      hp: hpChange,
      mana: manaChange,
      gold: goldChange,
      items_added: llmResponse.items_added || [],
      items_removed: llmResponse.items_removed || [],
    },
    narrative_style: llmResponse.narrative_style || (success ? 'success' : 'failure'),
    combat: llmResponse.combat || null,
    world_state: worldState ? { ...worldState, id: effectiveWorldId } : null,
  });
});

// ─── GET /game/state/:saveId ───────────────────────────────────────
router.get('/state/:saveId', (req, res) => {
  const save = db.prepare('SELECT * FROM saves WHERE id = ?').get(req.params.saveId);
  if (!save) return res.status(404).json({ error: 'Save not found' });

  const character = save.character_id
    ? db.prepare('SELECT * FROM characters WHERE id = ?').get(save.character_id)
    : null;

  const log = db.prepare('SELECT * FROM game_log WHERE save_id = ? ORDER BY turn_number DESC LIMIT 10').all(save.id);

  const parseJSON = (str) => {
    try { return JSON.parse(str); } catch { return null; }
  };

  res.json({
    save: {
      id: save.id,
      name: save.name,
      setting: save.setting,
      current_scene: save.current_scene,
      game_state: parseJSON(save.game_state),
    },
    character: character
      ? {
          ...character,
          stats: parseJSON(character.stats),
          skills: parseJSON(character.skills),
          inventory: parseJSON(character.inventory),
          equipment: parseJSON(character.equipment),
        }
      : null,
    log,
  });
});

// ─── GET /game/saves/:userId ───────────────────────────────────────
router.get('/saves/:userId', (req, res) => {
  const saves = db.prepare('SELECT * FROM saves WHERE user_id = ? ORDER BY updated_at DESC').all(req.params.userId);
  res.json(saves.map((s) => ({
    id: s.id,
    name: s.name,
    setting: s.setting,
    created_at: s.created_at,
    updated_at: s.updated_at,
  })));
});

// ─── POST /game/save ───────────────────────────────────────────────
router.post('/save', (req, res) => {
  const { save_id } = req.body;
  if (!save_id) return res.status(400).json({ error: 'Missing save_id' });
  db.prepare('UPDATE saves SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(save_id);
  res.json({ ok: true, message: 'Spielstand gespeichert.' });
});

// ─── GET /game/log/:saveId ────────────────────────────────────────
router.get('/log/:saveId', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM game_log WHERE save_id = ? ORDER BY turn_number DESC LIMIT 20'
  ).all(req.params.saveId);

  const result = rows.map((r) => ({
    ...r,
    dice_roll: r.dice_roll ? JSON.parse(r.dice_roll) : null,
    state_changes: r.state_changes ? JSON.parse(r.state_changes) : null,
  }));

  res.json(result);
});

// ─── POST /game/char ───────────────────────────────────────────────
router.post('/char', (req, res) => {
  const { user_id, name, class_name, stats, hp, max_hp, mana, max_mana } = req.body;
  if (!user_id || !name || !class_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const result = db.prepare(
    'INSERT INTO characters (user_id, name, class_name, hp, max_hp, mana, max_mana, stats) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(user_id, name, class_name, hp || 20, max_hp || 20, mana || 0, max_mana || 0, JSON.stringify(stats || {}));

  res.json({ character_id: Number(result.lastInsertRowid) });
});

// ─── Story Journal Endpoints ───────────────────────────────────────

// Full journal for a save (detailed, includes prompts)
router.get('/journal/:saveId', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const includePrompts = req.query.prompts !== 'false';

  try {
    const journal = getJournal(req.params.saveId, { limit, offset, includePrompts });
    res.json(journal);
  } catch (err) {
    console.error('GET /game/journal error:', err);
    res.status(500).json({ error: 'Failed to load journal' });
  }
});

// Journal summary for a save (lightweight overview)
router.get('/journal/:saveId/summary', (req, res) => {
  try {
    const summary = getJournalSummary(req.params.saveId);
    res.json(summary);
  } catch (err) {
    console.error('GET /game/journal/summary error:', err);
    res.status(500).json({ error: 'Failed to load journal summary' });
  }
});

// Full journal for a world (all saves)
router.get('/journal/world/:worldId', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 1000);

  try {
    const journal = getWorldJournal(req.params.worldId, { limit });
    res.json(journal);
  } catch (err) {
    console.error('GET /game/journal/world error:', err);
    res.status(500).json({ error: 'Failed to load world journal' });
  }
});

export default router;
