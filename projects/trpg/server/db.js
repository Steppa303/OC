import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'trpg.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    mana INTEGER DEFAULT 0,
    max_mana INTEGER DEFAULT 0,
    stats TEXT NOT NULL,
    skills TEXT,
    gold INTEGER DEFAULT 0,
    inventory TEXT,
    equipment TEXT,
    status TEXT DEFAULT 'alive',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS saves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    setting TEXT NOT NULL,
    setting_config TEXT,
    character_id INTEGER REFERENCES characters(id),
    current_scene TEXT,
    scene_history TEXT,
    game_state TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS game_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    save_id INTEGER REFERENCES saves(id),
    turn_number INTEGER NOT NULL,
    user_action TEXT NOT NULL,
    dice_roll TEXT,
    ai_response TEXT NOT NULL,
    state_changes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    classes TEXT NOT NULL,
    tone TEXT,
    starting_items TEXT,
    is_custom BOOLEAN DEFAULT 0,
    user_id TEXT,
    lore TEXT
  );

  -- Story Engine + World Legacy Tables

  CREATE TABLE IF NOT EXISTS worlds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    world_state TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS world_npcs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    world_id INTEGER NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    personality TEXT DEFAULT '{}',
    status TEXT DEFAULT 'alive' CHECK(status IN ('alive','dead','missing','hostile','allied')),
    attitude INTEGER DEFAULT 0 CHECK(attitude BETWEEN -100 AND 100),
    location TEXT,
    first_appeared_in_save INTEGER,
    last_seen_save INTEGER,
    backstory TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS world_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    world_id INTEGER NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    state TEXT DEFAULT 'intakt' CHECK(state IN ('intakt','zerstört','verlassen')),
    connections TEXT DEFAULT '[]',
    discovered INTEGER DEFAULT 0,
    events TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS world_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    world_id INTEGER NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    save_id INTEGER REFERENCES saves(id),
    turn_number INTEGER,
    event_type TEXT CHECK(event_type IN ('death','alliance','destruction','discovery','quest','faction_change','other')),
    description TEXT NOT NULL,
    impact TEXT DEFAULT '{}',
    npc_involved TEXT,
    location_involved TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS world_factions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    world_id INTEGER NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    power_level INTEGER DEFAULT 50 CHECK(power_level BETWEEN 0 AND 100),
    attitude TEXT DEFAULT 'neutral' CHECK(attitude IN ('friendly','neutral','hostile')),
    leader_npc_id INTEGER REFERENCES world_npcs(id),
    territory TEXT DEFAULT '[]',
    history TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Story Journal — detailliertes Turn-by-Turn Logging
  CREATE TABLE IF NOT EXISTS story_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    save_id INTEGER REFERENCES saves(id),
    world_id INTEGER REFERENCES worlds(id),
    turn_number INTEGER NOT NULL,
    system_prompt TEXT,
    user_prompt TEXT,
    llm_raw_response TEXT,
    llm_parsed_response TEXT,
    story_update_processed TEXT,
    state_diff TEXT,
    player_action TEXT,
    is_freetext INTEGER DEFAULT 0,
    dice_roll TEXT,
    dice_success INTEGER,
    scene_type TEXT,
    narrative_style TEXT,
    act_before INTEGER,
    act_after INTEGER,
    tension_before INTEGER,
    tension_after INTEGER,
    quests_snapshot TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_story_journal_save ON story_journal(save_id);
  CREATE INDEX IF NOT EXISTS idx_story_journal_world ON story_journal(world_id);

  -- Add world_id to saves (nullable for backward compat)
  -- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we handle it in app startup
`);

// Migration: Add world_id to saves if not exists
try {
  db.prepare('SELECT world_id FROM saves LIMIT 1').get();
} catch {
  db.exec('ALTER TABLE saves ADD COLUMN world_id INTEGER REFERENCES worlds(id)');
  console.log('Migration: Added world_id to saves table.');
}

export default db;
