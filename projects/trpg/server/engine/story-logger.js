import db from '../db.js';

/**
 * Story Journal — detailliertes Logging für Story-Analyse und Evaluation.
 * 
 * Jeder Eintrag enthält:
 * - Den kompletten LLM-Prompt (system + user)
 * - Die rohe LLM-Response
 * - Die geparste Response als JSON
 * - Den verarbeiteten Story-Update (was sich geändert hat)
 * - Metadata (Szene-Typ, Würfel, Akt, Tension)
 */

// ─── Journal Entry schreiben ───────────────────────────────────────
export function logTurn({
  saveId,
  worldId,
  turnNumber,
  // Prompts
  systemPrompt,
  userPrompt,
  // LLM Response
  llmRaw,
  llmParsed,
  // Story State vor dem Turn
  preState,
  // Story State nach dem Turn (was sich geändert hat)
  storyUpdateProcessed,
  postState,
  // Player Context
  playerAction,
  isFreetext,
  diceRoll,
  // Metadata
  sceneType,
  narrativeStyle,
  actBefore,
  actAfter,
  tensionBefore,
  tensionAfter,
  questsBefore,
  questsAfter,
}) {
  try {
    // State-Diff berechnen
    const stateDiff = computeStateDiff(preState, postState, storyUpdateProcessed);

    db.prepare(`
      INSERT INTO story_journal (
        save_id, world_id, turn_number,
        system_prompt, user_prompt,
        llm_raw_response, llm_parsed_response,
        story_update_processed, state_diff,
        player_action, is_freetext,
        dice_roll, dice_success,
        scene_type, narrative_style,
        act_before, act_after,
        tension_before, tension_after,
        quests_snapshot,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      saveId || null,
      worldId || null,
      turnNumber,
      systemPrompt || '',
      userPrompt || '',
      llmRaw || '',
      llmParsed ? JSON.stringify(llmParsed) : null,
      storyUpdateProcessed ? JSON.stringify(storyUpdateProcessed) : null,
      stateDiff ? JSON.stringify(stateDiff) : null,
      playerAction || '',
      isFreetext ? 1 : 0,
      diceRoll ? JSON.stringify(diceRoll) : null,
      diceRoll?.success ? 1 : 0,
      sceneType || 'unbekannt',
      narrativeStyle || 'neutral',
      actBefore || null,
      actAfter || null,
      tensionBefore ?? null,
      tensionAfter ?? null,
      questsAfter ? JSON.stringify(questsAfter) : null,
    );
  } catch (err) {
    console.error('[StoryLogger] Failed to log turn:', err.message);
  }
}

// ─── Opening Scene loggen ──────────────────────────────────────────
export function logOpening({
  saveId,
  worldId,
  systemPrompt,
  llmRaw,
  llmParsed,
  storyUpdateProcessed,
  postState,
  arcId,
  arcName,
}) {
  try {
    db.prepare(`
      INSERT INTO story_journal (
        save_id, world_id, turn_number,
        system_prompt, user_prompt,
        llm_raw_response, llm_parsed_response,
        story_update_processed, state_diff,
        player_action, is_freetext,
        dice_roll, dice_success,
        scene_type, narrative_style,
        act_before, act_after,
        tension_before, tension_after,
        quests_snapshot,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      saveId || null,
      worldId || null,
      0, // turn 0 = opening
      systemPrompt || '',
      `[Opening Scene — Arc: ${arcName || arcId || 'unknown'}]`,
      llmRaw || '',
      llmParsed ? JSON.stringify(llmParsed) : null,
      storyUpdateProcessed ? JSON.stringify(storyUpdateProcessed) : null,
      postState ? JSON.stringify({ opening_world_state: postState }) : null,
      'OPENING SCENE',
      0,
      null,
      null,
      'opening',
      llmParsed?.narrative_style || 'neutral',
      null,
      1,
      null,
      0,
      postState?.quests ? JSON.stringify(postState.quests) : null,
    );
  } catch (err) {
    console.error('[StoryLogger] Failed to log opening:', err.message);
  }
}

// ─── State-Diff berechnen ──────────────────────────────────────────
function computeStateDiff(pre, post, storyUpdate) {
  if (!pre && !post && !storyUpdate) return null;

  const diff = {};

  // Tension
  if (pre?.tension !== undefined && post?.tension !== undefined && pre.tension !== post.tension) {
    diff.tension = { from: pre.tension, to: post.tension };
  }

  // Act
  if (pre?.current_act !== undefined && post?.current_act !== undefined && pre.current_act !== post.current_act) {
    diff.act = { from: pre.current_act, to: post.current_act };
  }

  // Quests
  if (storyUpdate?.quest_updates?.length > 0) {
    diff.quest_changes = storyUpdate.quest_updates.map(q => ({
      name: q.name,
      status: q.status,
      description: q.description,
    }));
  }

  // NPCs (aus storyUpdate)
  if (storyUpdate?.npc_updates?.length > 0) {
    diff.npc_changes = storyUpdate.npc_updates.map(n => ({
      name: n.name,
      status: n.status,
      attitude: n.attitude,
      location: n.location,
      is_new: n.new || false,
    }));
  }

  // Locations
  if (storyUpdate?.location_updates?.length > 0) {
    diff.location_changes = storyUpdate.location_updates.map(l => ({
      name: l.name,
      state: l.state,
      discovered: l.discovered,
    }));
  }

  // Factions
  if (storyUpdate?.faction_updates?.length > 0) {
    diff.faction_changes = storyUpdate.faction_updates.map(f => ({
      name: f.name,
      power_level: f.power_level,
      attitude: f.attitude,
    }));
  }

  // Events
  if (storyUpdate?.events?.length > 0) {
    diff.events_created = storyUpdate.events.map(e => ({
      type: e.event_type,
      description: e.description,
    }));
  }

  // Flags
  if (storyUpdate?.flags && Object.keys(storyUpdate.flags).length > 0) {
    diff.flags_set = storyUpdate.flags;
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

// ─── Journal abrufen (für Review) ──────────────────────────────────
export function getJournal(saveId, { limit = 100, offset = 0, includePrompts = true } = {}) {
  const fields = includePrompts
    ? '*'
    : `id, save_id, world_id, turn_number, player_action, is_freetext,
       dice_roll, dice_success, scene_type, narrative_style,
       act_before, act_after, tension_before, tension_after,
       story_update_processed, state_diff, quests_snapshot, created_at`;

  const rows = db.prepare(
    `SELECT ${fields} FROM story_journal WHERE save_id = ? ORDER BY turn_number ASC LIMIT ? OFFSET ?`
  ).all(saveId, limit, offset);

  return rows.map(r => ({
    ...r,
    llm_parsed_response: r.llm_parsed_response ? JSON.parse(r.llm_parsed_response) : null,
    story_update_processed: r.story_update_processed ? JSON.parse(r.story_update_processed) : null,
    state_diff: r.state_diff ? JSON.parse(r.state_diff) : null,
    dice_roll: r.dice_roll ? JSON.parse(r.dice_roll) : null,
    quests_snapshot: r.quests_snapshot ? JSON.parse(r.quests_snapshot) : null,
  }));
}

// ─── Journal Zusammenfassung (für schnelle Übersicht) ──────────────
export function getJournalSummary(saveId) {
  const total = db.prepare('SELECT COUNT(*) as c FROM story_journal WHERE save_id = ?').get(saveId);
  const turns = db.prepare(`
    SELECT turn_number, player_action, dice_success, scene_type, narrative_style,
           act_before, act_after, tension_before, tension_after,
           state_diff, created_at
    FROM story_journal WHERE save_id = ? ORDER BY turn_number ASC
  `).all(saveId);

  const scenes = turns.map(t => ({
    turn: t.turn_number,
    action: t.player_action,
    type: t.scene_type,
    dice_success: !!t.dice_success,
    narrative: t.narrative_style,
    act: t.act_after || t.act_before,
    tension: t.tension_after ?? t.tension_before,
    changes: t.state_diff ? JSON.parse(t.state_diff) : null,
    time: t.created_at,
  }));

  // Statistiken
  const stats = {
    total_turns: total.c,
    success_rate: turns.length > 0
      ? Math.round(turns.filter(t => t.dice_success).length / turns.length * 100)
      : 0,
    scene_types: {},
    narrative_styles: {},
    act_distribution: { 1: 0, 2: 0, 3: 0 },
  };

  for (const t of turns) {
    stats.scene_types[t.scene_type] = (stats.scene_types[t.scene_type] || 0) + 1;
    stats.narrative_styles[t.narrative_style] = (stats.narrative_styles[t.narrative_style] || 0) + 1;
    const act = t.act_after || t.act_before;
    if (act >= 1 && act <= 3) stats.act_distribution[act]++;
  }

  return { scenes, stats };
}

// ─── Journal für World (alle Saves einer Welt) ────────────────────
export function getWorldJournal(worldId, { limit = 200 } = {}) {
  const rows = db.prepare(`
    SELECT sj.*, s.name as save_name
    FROM story_journal sj
    LEFT JOIN saves s ON s.id = sj.save_id
    WHERE sj.world_id = ?
    ORDER BY sj.created_at ASC
    LIMIT ?
  `).all(worldId, limit);

  return rows.map(r => ({
    ...r,
    llm_parsed_response: r.llm_parsed_response ? JSON.parse(r.llm_parsed_response) : null,
    story_update_processed: r.story_update_processed ? JSON.parse(r.story_update_processed) : null,
    state_diff: r.state_diff ? JSON.parse(r.state_diff) : null,
    dice_roll: r.dice_roll ? JSON.parse(r.dice_roll) : null,
  }));
}
