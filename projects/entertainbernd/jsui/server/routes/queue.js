/**
 * Queue route — SABnzbd queue status + control actions
 */
const express = require('express');
const router = express.Router();

const SABNZBD_URL = process.env.SABNZBD_URL || 'http://127.0.0.1:8080';
const SABNZBD_API_KEY = process.env.SABNZBD_API_KEY || '';

/**
 * Helper: call SABnzbd API
 */
async function sabCall(params) {
  const p = new URLSearchParams({ apikey: SABNZBD_API_KEY, output: 'json', ...params });
  const url = `${SABNZBD_URL}/api?${p.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/queue — current queue status
 */
router.get('/', async (req, res) => {
  if (!SABNZBD_API_KEY) {
    return res.status(500).json({ error: 'SABnzbd API key not configured' });
  }

  try {
    const data = await sabCall({ mode: 'queue' });
    if (!data || !data.queue) {
      return res.status(502).json({ error: 'Invalid SABnzbd response' });
    }

    const queue = data.queue;
    const active = [];
    const paused = [];

    if (queue.slots) {
      (Array.isArray(queue.slots) ? queue.slots : []).forEach(slot => {
        const item = {
          nzo_id: slot.nzo_id || '',
          filename: slot.filename || '',
          mb: parseFloat(slot.mb) || 0,
          mb_left: parseFloat(slot.mb_left) || 0,
          percentage: parseFloat(slot.percentage) || 0,
          speed: slot.speed || '0',
          eta: slot.timeleft || '0:00:00',
          status: slot.status || 'unknown',
          category: slot.cat || '',
        };
        if (slot.status === 'Paused') {
          paused.push(item);
        } else {
          active.push(item);
        }
      });
    }

    return res.json({
      active,
      paused,
      total_size: `${(parseFloat(queue.mb) || 0).toFixed(1)} MB`,
      total_left: `${(parseFloat(queue.mbleft) || 0).toFixed(1)} MB`,
      speed: queue.speed || '0 B/s',
      eta: queue.timeleft || '0:00:00',
    });
  } catch (err) {
    console.error('[queue] error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

/**
 * POST /api/queue/:nzoId/pause
 */
router.post('/:nzoId/pause', async (req, res) => {
  try {
    const data = await sabCall({ mode: 'queue', name: 'pause', value: req.params.nzoId });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/queue/:nzoId/resume
 */
router.post('/:nzoId/resume', async (req, res) => {
  try {
    const data = await sabCall({ mode: 'queue', name: 'resume', value: req.params.nzoId });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/queue/:nzoId/cancel
 */
router.post('/:nzoId/cancel', async (req, res) => {
  try {
    const data = await sabCall({ mode: 'queue', name: 'delete', value: req.params.nzoId });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;