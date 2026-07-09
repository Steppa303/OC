/**
 * Download route — send NZB to SABnzbd, get result details
 */
const express = require('express');
const router = express.Router();

const SABNZBD_URL = process.env.SABNZBD_URL || 'http://127.0.0.1:8080';
const SABNZBD_API_KEY = process.env.SABNZBD_API_KEY || '';

/**
 * Sanitize filename: remove problematic characters.
 */
function sanitizeFilename(name) {
  return (name || 'download')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200);
}

/**
 * POST /api/download
 * Body: { link, title, size, category }
 * Sends NZB URL to SABnzbd via addurl mode.
 */
router.post('/', async (req, res) => {
  const { link, title, size, category } = req.body;

  if (!link) {
    return res.status(400).json({ error: 'Missing NZB link' });
  }

  if (!SABNZBD_API_KEY) {
    return res.status(500).json({ error: 'SABnzbd API key not configured' });
  }

  try {
    // Rewrite NZB URL für SABnzbd (Docker): localhost → Docker-Hostname
    let nzbUrl = link;
    if (nzbUrl.includes('127.0.0.1') || nzbUrl.includes('localhost')) {
      nzbUrl = nzbUrl.replace('127.0.0.1', 'nzbhydra2').replace('localhost', 'nzbhydra2');
    }

    const params = new URLSearchParams({
      apikey: SABNZBD_API_KEY,
      mode: 'addurl',
      name: nzbUrl,
      output: 'json',
    });

    // Optionally set NZB name
    if (title) {
      params.set('nzbname', sanitizeFilename(title));
    }

    // Map category to SABnzbd category name
    const catMap = {
      '2000': 'movies',
      '2010': 'movies',
      '2020': 'movies',
      '2030': 'movies',
      '2040': 'movies',
      '2045': 'movies',
      '2050': 'movies',
      '2060': 'movies',
      '5000': 'tv',
      '5010': 'tv',
      '5020': 'tv',
      '5030': 'tv',
      '5040': 'tv',
      '5045': 'tv',
      '5050': 'tv',
      '5060': 'tv',
      '3000': 'music',
      '1000': 'games',
      '4000': 'games',
    };
    const sabCat = catMap[String(category)] || 'movies';
    params.set('cat', sabCat);

    const url = `${SABNZBD_URL}/api?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();
    clearTimeout(timer);

    if (data && data.status) {
      return res.json({
        success: true,
        nzo_ids: data.nzo_ids || [],
        status: data.status,
      });
    }

    // Some SABnzbd versions return error in different format
    const error = (data && data.error) || 'Unknown SABnzbd error';
    return res.status(400).json({ success: false, error });
  } catch (err) {
    console.error('[download] error:', err.message);
    return res.status(500).json({ error: 'Download request failed' });
  }
});

/**
 * GET /api/detail/:id
 * Returns single result details — searches by guid across both indexers.
 */
router.get('/detail/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Missing result ID (guid)' });
  }

  const NZBHYDRA2_URL = process.env.NZBHYDRA2_URL || 'http://127.0.0.1:5076';
  const NZBHYDRA2_API_KEY = process.env.NZBHYDRA2_API_KEY || '';
  const NZBGEEK_URL = process.env.NZBGEEK_URL || 'https://api.nzbgeek.info';
  const NZBGEEK_API_KEY = process.env.NZBGEEK_API_KEY || '';

  try {
    // Try NZBHydra2 details endpoint
    if (NZBHYDRA2_API_KEY) {
      const url = `${NZBHYDRA2_URL}/api?apikey=${encodeURIComponent(NZBHYDRA2_API_KEY)}&t=details&id=${encodeURIComponent(id)}&o=json`;
      const data = await fetch(url).then(r => r.json()).catch(() => null);
      if (data && data.channel && data.channel.item) {
        const item = data.channel.item;
        return res.json({
          id: item.guid || id,
          title: item.title || '',
          category: item.category || '',
          size: parseInt(item.size, 10) || 0,
          pub_date: item.pubDate || null,
          description: item.description || '',
          link: item.link || '',
          guid: item.guid || id,
          comments: item.comments || '',
          grabs: parseInt(item.grabs, 10) || 0,
          rating: parseFloat(item.rating) || 0,
        });
      }
    }

    // Fallback: search by guid on NZBGeek
    if (NZBGEEK_API_KEY) {
      const url = `${NZBGEEK_URL}/api?apikey=${encodeURIComponent(NZBGEEK_API_KEY)}&t=details&id=${encodeURIComponent(id)}&o=json`;
      const data = await fetch(url).then(r => r.json()).catch(() => null);
      if (data && data.channel && data.channel.item) {
        const item = data.channel.item;
        return res.json({
          id: item.guid || id,
          title: item.title || '',
          category: item.category || '',
          size: parseInt(item.size, 10) || 0,
          pub_date: item.pubDate || null,
          description: item.description || '',
          link: item.link || '',
          guid: item.guid || id,
          comments: item.comments || '',
          grabs: parseInt(item.grabs, 10) || 0,
          rating: parseFloat(item.rating) || 0,
        });
      }
    }

    return res.status(404).json({ error: 'Result not found' });
  } catch (err) {
    console.error('[download] detail error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch details' });
  }
});

module.exports = router;