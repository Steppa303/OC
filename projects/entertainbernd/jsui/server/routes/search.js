/**
 * Search route — wraps NZBHydra2 + NZBGeek, dedup, paginate
 */
const express = require('express');
const router = express.Router();

const NZBHYDRA2_URL = process.env.NZBHYDRA2_URL || 'http://127.0.0.1:5076';
const NZBHYDRA2_API_KEY = process.env.NZBHYDRA2_API_KEY || '';
const NZBGEEK_URL = process.env.NZBGEEK_URL || 'https://api.nzbgeek.info';
const NZBGEEK_API_KEY = process.env.NZBGEEK_API_KEY || '';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Normalize title for dedup: lowercase, strip punctuation, collapse whitespace */
function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Format bytes to human-readable */
function formatSize(bytes) {
  const num = parseInt(bytes, 10);
  if (isNaN(num) || num === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(1024));
  const val = (num / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${val} ${units[i]}`;
}

/** Detect language from title keywords */
function detectLanguage(title) {
  const t = (title || '').toLowerCase();
  const dePatterns = [
    /\b(german|deutsch|german\.dl)\b/,
    /\b(der|die|das|und|mit|von|für|ein|eine|auf|aus|bei|nach|nicht|auch|wird|über|sich|zum|zur|einem|einen|einer)\b/,
  ];
  const enPatterns = [
    /\b(english|eng\.)\b/,
    /\b(the|and|for|with|from|this|that|have|will|your|what|when|they|them|their)\b/,
  ];

  const deScore = dePatterns.filter(p => p.test(t)).length;
  const enScore = enPatterns.filter(p => p.test(t)).length;

  if (deScore > enScore) return 'German';
  if (enScore > deScore) return 'English';
  return 'Unknown';
}

/** Map newznab category to media type */
function mediaTypeFromCat(cat) {
  const c = parseInt(cat, 10);
  if (c >= 2000 && c < 3000) return 'movie';
  if (c >= 5000 && c < 6000) return 'tv';
  if (c >= 3000 && c < 4000) return 'audio';
  if (c >= 1000 && c < 2000) return 'game';
  if (c >= 4000 && c < 5000) return 'game';
  if (c >= 6000 && c < 7000) return 'xxx';
  if (c >= 7000 && c < 8000) return 'book';
  return 'other';
}

/** Safe fetch with timeout */
async function safeFetch(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract coverurl from newznab attr array */
function extractCoverUrl(item) {
  // Direct fields first
  if (item.poster) return item.poster;
  if (item.poster_url) return item.poster_url;
  if (item.coverurl) return item.coverurl;
  // attr array — newznab standard
  // NZBGeek: attr[] = { '@attributes': { name, value } }
  // NZBHydra2: attr[] = { 'attributes': { name, value } }
  if (Array.isArray(item.attr)) {
    for (const a of item.attr) {
      const attrs = a['@attributes'] || a.attributes || a;
      if (attrs && attrs.name === 'coverurl' && attrs.value) return attrs.value;
    }
  }
  return null;
}

/** Map newznab result item to unified format */
function mapResult(item) {
  const size = parseInt(item.size, 10) || 0;
  const title = item.title || '';
  return {
    id: item.guid || item.link || title,
    title,
    category: item.category || item['category_name'] || '',
    media_type: mediaTypeFromCat(item.category || '0'),
    size,
    size_formatted: formatSize(size),
    language: detectLanguage(title),
    source: item.source || 'unknown',
    pub_date: item.pubDate || item.pub_date || null,
    poster_url: extractCoverUrl(item),
    rating: parseFloat(item.rating) || 0,
    grabs: parseInt(item.grabs, 10) || 0,
    link: item.link || '',
    guid: item.guid || item.link || '',
  };
}

// ----------------------------------------------------------------
// GET /api/search
// ----------------------------------------------------------------
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing search query (q)' });
  }

  const cat = req.query.cat || '2000,5000';
  const page = Math.max(0, parseInt(req.query.page, 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const sources = [];

  // NZBHydra2
  if (NZBHYDRA2_API_KEY) {
    try {
      const url = `${NZBHYDRA2_URL}/api?apikey=${encodeURIComponent(NZBHYDRA2_API_KEY)}&t=search&q=${encodeURIComponent(q)}&o=json&cat=${encodeURIComponent(cat)}&limit=100`;
      const data = await safeFetch(url);
      if (data && data.channel && data.channel.item) {
        const items = Array.isArray(data.channel.item) ? data.channel.item : [data.channel.item];
        items.forEach(item => {
          sources.push(mapResult({ ...item, source: 'nzbhydra2' }));
        });
      }
    } catch (err) {
      console.error('[search] NZBHydra2 error:', err.message);
    }
  }

  // NZBGeek
  if (NZBGEEK_API_KEY) {
    try {
      const url = `${NZBGEEK_URL}/api?apikey=${encodeURIComponent(NZBGEEK_API_KEY)}&t=search&q=${encodeURIComponent(q)}&o=json&cat=${encodeURIComponent(cat)}&limit=100`;
      const data = await safeFetch(url);
      if (data && data.channel && data.channel.item) {
        const items = Array.isArray(data.channel.item) ? data.channel.item : [data.channel.item];
        items.forEach(item => {
          sources.push(mapResult({ ...item, source: 'nzbgeek' }));
        });
      }
    } catch (err) {
      console.error('[search] NZBGeek error:', err.message);
    }
  }

  console.log('[search] sources before dedup:', sources.length, 'geek:', sources.filter(s => s.source === 'nzbgeek').length, 'hydra:', sources.filter(s => s.source === 'nzbhydra2').length, 'with_poster:', sources.filter(s => s.poster_url).length);

  // Deduplicate by normalized title
  const seen = new Map();
  for (const r of sources) {
    const norm = normalizeTitle(r.title);
    const existing = seen.get(norm);
    if (!existing) {
      seen.set(norm, r);
    } else {
      // Merge poster_url from Geek if Hydra doesn't have one
      if (!existing.poster_url && r.poster_url) {
        existing.poster_url = r.poster_url;
      }
      // Keep the one with higher grabs
      if (r.grabs > existing.grabs) {
        r.poster_url = existing.poster_url || r.poster_url;
        seen.set(norm, r);
      }
    }
  }
  const deduped = Array.from(seen.values());

  // Sort: poster_url first, then by grabs desc, then rating desc
  deduped.sort((a, b) => {
    // Results with poster first
    if (a.poster_url && !b.poster_url) return -1;
    if (!a.poster_url && b.poster_url) return 1;
    // Then by grabs desc
    return b.grabs - a.grabs || b.rating - a.rating;
  });

  // Paginate
  const total = deduped.length;
  const start = page * limit;
  const results = deduped.slice(start, start + limit);

  return res.json({
    query: q,
    total,
    page,
    results,
  });
});

module.exports = router;