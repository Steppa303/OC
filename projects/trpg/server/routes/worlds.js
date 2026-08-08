import { Router } from 'express';
import db from '../db.js';
import { createWorld, buildStoryContext, getWorldHistory } from '../engine/story.js';
import { arcTemplates } from '../data/arcs.js';

const router = Router();

// ─── GET /worlds/arcs/:settingSlug ──────────────────────────────────
router.get('/arcs/:settingSlug', (req, res) => {
  const arcs = arcTemplates.filter(a => a.setting === req.params.settingSlug);
  res.json(arcs.map(a => ({
    id: a.id,
    name: a.name,
    premise: a.premise,
    antagonist_type: a.antagonist_type,
    acts: a.acts,
  })));
});

// ─── GET /worlds/setting/:settingSlug ───────────────────────────────
router.get('/setting/:settingSlug', (req, res) => {
  const worlds = db.prepare(
    'SELECT w.*, COUNT(s.id) as save_count FROM worlds w LEFT JOIN saves s ON s.world_id = w.id WHERE w.setting_slug = ? GROUP BY w.id ORDER BY w.updated_at DESC'
  ).all(req.params.settingSlug);

  res.json(worlds.map(w => {
    const ws = JSON.parse(w.world_state || '{}');
    return {
      id: w.id,
      name: w.name,
      setting_slug: w.setting_slug,
      current_act: ws.current_act || 1,
      tension: ws.tension || 0,
      arc_name: ws.arc_name || null,
      save_count: w.save_count || 0,
      created_at: w.created_at,
      updated_at: w.updated_at,
    };
  }));
});

// ─── POST /worlds ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { setting_slug, arc_id } = req.body;
  if (!setting_slug) {
    return res.status(400).json({ error: 'Missing setting_slug' });
  }

  try {
    const result = await createWorld(setting_slug, arc_id || null);
    res.json({
      world_id: result.worldId,
      arc: { id: result.arc.id, name: result.arc.name },
      world_name: result.seed.world_name,
      npcs: result.seed.npcs?.length || 0,
      locations: result.seed.locations?.length || 0,
      factions: result.seed.factions?.length || 0,
    });
  } catch (err) {
    console.error('POST /worlds error:', err);
    res.status(500).json({ error: 'Failed to create world' });
  }
});

// ─── GET /worlds/:worldId ───────────────────────────────────────────
router.get('/:worldId', (req, res) => {
  const ctx = buildStoryContext(Number(req.params.worldId));
  if (!ctx) return res.status(404).json({ error: 'World not found' });

  res.json({
    id: ctx.world.id,
    name: ctx.world.name,
    setting_slug: ctx.world.setting_slug,
    world_state: ctx.world_state,
    arc: ctx.arc ? { id: ctx.arc.id, name: ctx.arc.name, premise: ctx.arc.premise, acts: ctx.arc.acts } : null,
    npcs: ctx.npcs,
    locations: ctx.locations,
    factions: ctx.factions,
    recent_events: ctx.events.slice(0, 10),
  });
});

// ─── GET /worlds/:worldId/history ───────────────────────────────────
router.get('/:worldId/history', (req, res) => {
  const world = db.prepare('SELECT id FROM worlds WHERE id = ?').get(req.params.worldId);
  if (!world) return res.status(404).json({ error: 'World not found' });

  const events = getWorldHistory(Number(req.params.worldId));
  res.json(events);
});

// ─── GET /worlds/:worldId/npcs ──────────────────────────────────────
router.get('/:worldId/npcs', (req, res) => {
  const world = db.prepare('SELECT id FROM worlds WHERE id = ?').get(req.params.worldId);
  if (!world) return res.status(404).json({ error: 'World not found' });

  const npcs = db.prepare('SELECT * FROM world_npcs WHERE world_id = ? ORDER BY name').all(req.params.worldId);
  res.json(npcs.map(n => ({
    ...n,
    personality: JSON.parse(n.personality || '{}'),
  })));
});

// ─── GET /worlds/:worldId/locations ─────────────────────────────────
router.get('/:worldId/locations', (req, res) => {
  const world = db.prepare('SELECT id FROM worlds WHERE id = ?').get(req.params.worldId);
  if (!world) return res.status(404).json({ error: 'World not found' });

  const locs = db.prepare('SELECT * FROM world_locations WHERE world_id = ? ORDER BY name').all(req.params.worldId);
  res.json(locs.map(l => ({
    ...l,
    connections: JSON.parse(l.connections || '[]'),
    events: JSON.parse(l.events || '[]'),
  })));
});

export default router;
