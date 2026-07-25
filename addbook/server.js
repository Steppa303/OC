const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');

const app = express();
const PORT = 3006;
const RESULTS_DIR = '/srv/addbook/results';
const EPUB_DIR = '/srv/addbook/epubs';
const LISTS_DIR = '/srv/addbook/lists';
const ANSWER_DIR = '/srv/addbook/answers';
const RECIPE_JSON_DIR = '/srv/addbook/recipes';

// Ensure directories exist
[RESULTS_DIR, EPUB_DIR, LISTS_DIR, ANSWER_DIR, RECIPE_JSON_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// AgentMail config
let AGENTMAIL_API_KEY = '';
let TELEGRAM_BOT_TOKEN = '';
try {
  const config = JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json', 'utf8'));
  AGENTMAIL_API_KEY = config.skills?.entries?.agentmail?.env?.AGENTMAIL_API_KEY || '';
  TELEGRAM_BOT_TOKEN = config.channels?.telegram?.botToken || '';
} catch (e) {
  console.warn('Could not read openclaw.json:', e.message);
}

const KINDLE_EMAIL = 'bastianlewin_213e22@kindle.com';
const FROM_INBOX = 'bastians_assistent@agentmail.to';
const TELEGRAM_CHAT_ID = '1400987471';

// In-memory download status tracker
const downloads = new Map();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Static files (checklist frontend, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// Root — landing page
// ============================================================
app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  <title>AddBook</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; background: #fff; color: #111; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .wrap { text-align: center; padding: 40px; max-width: 500px; }
    h1 { font-size: 28px; margin-bottom: 16px; }
    p { font-size: 16px; color: #444; margin-bottom: 8px; line-height: 1.5; }
    code { background: #eee; padding: 2px 6px; font-size: 15px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>📚 AddBook</h1>
    <p>Schreib <code>Buch: Titel</code> auf deinen Kindle Scribe</p>
    <p>und du bekommst einen Telegram-Link mit Suchergebnissen.</p>
    <p>Klick auf "Zu Kindle senden" — fertig.</p>
  </div>
</body>
</html>`);
});

// ============================================================
// Renew Drive Watch (called by cron, expires every 24h)
// ============================================================
app.post('/api/renew-watch', async (req, res) => {
  const watchFile = path.join(__dirname, '.drive-watch.json');
  let watchData = {};
  try { watchData = JSON.parse(fs.readFileSync(watchFile, 'utf8')); } catch {}

  // Stop old watch
  if (watchData.channelId && watchData.resourceId) {
    try {
      const https = require('https');
      // We can't easily stop via Composio in a GET handler, so we just create a new one
    } catch {}
  }

  // Create new watch via Composio MCP (reuse sync script)
  const syncScript = path.join(__dirname, 'renew_watch.py');
  execFile('python3', [syncScript], { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Watch renewal error:', stderr);
      return res.status(500).json({ error: 'Renewal failed', details: stderr });
    }
    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch {
      res.json({ status: 'ok', output: stdout });
    }
  });
});

// ============================================================
// Google Drive Webhook (Push Notifications)
// ============================================================
app.post('/api/drive-webhook', (req, res) => {
  // Google sends headers: X-Goog-Channel-ID, X-Goog-Resource-State, etc.
  const state = req.headers['x-goog-resource-state'];
  const channelToken = req.headers['x-goog-channel-token'];

  console.log(`🔔 Drive webhook: state=${state}`);

  // Only trigger sync on 'change' or 'add' events
  if (state === 'change' || state === 'add') {
    const syncScript = path.join(__dirname, 'addbook_sync.py');
    // Phase 1: nur discover + job creation, < 5s
    execFile('python3', [syncScript, 'phase1'], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) console.error('Webhook phase1 error:', stderr ? stderr.slice(-300) : error.message);
      else console.log('Webhook phase1 done');
    });
  }

  // Always respond 200 quickly (Google expects fast response)
  res.status(200).end();
});

// ============================================================
// Sync manually
// ============================================================
app.post('/api/sync', (req, res) => {
  const syncScript = path.join(__dirname, 'addbook_sync.py');
  const mode = req.body.mode || 'phase1';
  execFile('python3', [syncScript, mode], { timeout: 120000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Sync error [' + mode + ']:', stderr);
      return res.status(500).json({ error: 'Sync failed', details: stderr });
    }
    console.log('Sync [' + mode + '] completed');
    res.json({ status: 'ok', mode, output: stdout.slice(-500) });
  });
});

// ============================================================
// Open Library proxy (CORS for Kindle browser)
// ============================================================
app.get('/api/bookinfo', async (req, res) => {
  const { title, author } = req.query;
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    const https = require('https');
    const query = encodeURIComponent(title);

    function fetchOL(lang) {
      return new Promise((resolve, reject) => {
        const url = lang
          ? `https://openlibrary.org/search.json?title=${query}&limit=3&language=${lang}&fields=key,title,author_name,first_publish_year,subject,description`
          : `https://openlibrary.org/search.json?title=${query}&limit=3&fields=key,title,author_name,first_publish_year,subject,description`;
        https.get(url, { headers: { 'User-Agent': 'AddBook/1.0' } }, (upstream) => {
          let data = '';
          upstream.on('data', (c) => data += c);
          upstream.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve({ docs: [] }); }
          });
        }).on('error', reject);
      });
    }

    // Try German first, then any language
    let result = await fetchOL('ger');
    if (!result.docs || !result.docs.length || !result.docs[0].description) {
      const fallback = await fetchOL();
      if (fallback.docs && fallback.docs.length) {
        if (!result.docs || !result.docs.length) {
          result = fallback;
        } else if (!result.docs[0].description && fallback.docs[0].description) {
          result.docs[0].description = fallback.docs[0].description;
        }
      }
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// Results page
// ============================================================
app.get('/r', (req, res) => {
  const resultFile = path.join(RESULTS_DIR, 'latest.json');
  if (!fs.existsSync(resultFile)) {
    return res.status(404).send(getErrorPage('Ergebnis nicht gefunden', 'Dieser Link ist ungültig oder abgelaufen.'));
  }

  try {
    const data = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    const template = fs.readFileSync(path.join(__dirname, 'templates', 'results.html'), 'utf8');
    const html = renderTemplate(template, data);
    res.type('html').send(html);
  } catch (e) {
    console.error('Error serving results:', e);
    res.status(500).send(getErrorPage('Serverfehler', e.message));
  }
});

// ============================================================
// Search API (for manual use or cron trigger)
// ============================================================
app.post('/api/search', (req, res) => {
  const { query, lang = 'de', ext = 'epub' } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  const searchPath = path.join(__dirname, 'scraper', 'search.py');
  execFile('python3', [searchPath, '--query', query, '--lang', lang, '--ext', ext],
    { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Search error:', stderr);
        return res.status(500).json({ error: 'Search failed', details: stderr });
      }
      try {
        const results = JSON.parse(stdout);
        const resultId = uuidv4();

        // Save results
        const resultData = {
          id: 'latest',
          query,
          timestamp: new Date().toISOString(),
          books: results
        };
        fs.writeFileSync(path.join(RESULTS_DIR, 'latest.json'), JSON.stringify(resultData, null, 2));

        res.json({ id: 'latest', count: results.length, url: '/r' });
      } catch (parseError) {
        console.error('Parse error:', parseError, stdout);
        res.status(500).json({ error: 'Invalid search results' });
      }
    });
});

// ============================================================
// Download + Send to Kindle
// ============================================================
app.post('/api/download', (req, res) => {
  const { resultId, index, md5, title, author = '' } = req.body;
  if (!md5 || !title) return res.status(400).json({ error: 'md5 and title required' });

  const downloadId = uuidv4();
  downloads.set(downloadId, { status: 'queued', progress: 0, md5, title });

  // Background: download → send to Kindle
  processDownload(downloadId, md5, title, author);

  res.json({ id: downloadId, status: 'queued' });
});

// ============================================================
// Download status polling
// ============================================================
app.get('/api/status/:id', (req, res) => {
  const dl = downloads.get(req.params.id);
  if (!dl) return res.status(404).json({ error: 'Not found' });
  res.json(dl);
});

// ============================================================
// Health check
// ============================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ============================================================
// LIST CHECKLISTS — API & Frontend
// ============================================================

// POST /api/lists — Neue Liste anlegen
app.post('/api/lists', (req, res) => {
  const { title, items } = req.body;
  if (!title || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'title and non-empty items[] required' });
  }

  const id = require('crypto').randomUUID();
  const list = {
    id,
    title: title.trim(),
    createdAt: new Date().toISOString(),
    items: items.map((text, i) => ({
      id: String(i + 1),
      text: typeof text === 'string' ? text.trim() : String(text),
      checked: false
    }))
  };

  fs.writeFileSync(path.join(LISTS_DIR, `${id}.json`), JSON.stringify(list, null, 2));
  console.log(`📋 List created: "${list.title}" (${list.items.length} items, ID: ${id})`);

  res.status(201).json({ id: list.id, title: list.title, url: `/l/${id}` });
});

// GET /api/lists/:listId — Liste als JSON
app.get('/api/lists/:listId', (req, res) => {
  const filePath = path.join(LISTS_DIR, `${req.params.listId}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'List not found' });
  }
  res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
});

// POST /api/lists/:listId/toggle/:itemIndex — Item umschalten
app.post('/api/lists/:listId/toggle/:itemIndex', (req, res) => {
  const filePath = path.join(LISTS_DIR, `${req.params.listId}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'List not found' });
  }
  const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const idx = parseInt(req.params.itemIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= list.items.length) {
    return res.status(400).json({ error: 'Invalid item index' });
  }
  list.items[idx].checked = !list.items[idx].checked;
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
  res.json(list);
});

// POST /api/lists/:listId/add — Neues Item hinzufügen
app.post('/api/lists/:listId/add', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text required' });
  }
  const filePath = path.join(LISTS_DIR, `${req.params.listId}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'List not found' });
  }
  const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const nextId = String(list.items.length + 1);
  list.items.push({ id: nextId, text: text.trim(), checked: false });
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
  res.json(list);
});

// GET /api/lists/:listId/share — Share-Info
app.get('/api/lists/:listId/share', (req, res) => {
  const filePath = path.join(LISTS_DIR, `${req.params.listId}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'List not found' });
  }
  const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  res.json({ id: list.id, title: list.title, url: `https://addbook.steppa.online/l/${list.id}` });
});

// GET /l/:listId — Frontend (Checkliste als SPA)
app.get('/l/:listId', (req, res) => {
  const filePath = path.join(LISTS_DIR, `${req.params.listId}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(getErrorPage('Liste nicht gefunden', 'Die Liste existiert nicht oder wurde gelöscht.'));
  }

  const templatePath = path.join(__dirname, 'public', 'checklist.html');
  if (!fs.existsSync(templatePath)) {
    return res.status(500).send(getErrorPage('Serverfehler', 'Template nicht gefunden.'));
  }

  try {
    const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let html = fs.readFileSync(templatePath, 'utf8');
    html = html.replace('__LIST_ID__', list.id);
    html = html.replace('__LIST_DATA__', JSON.stringify(list));
    res.type('html').send(html);
  } catch (e) {
    res.status(500).send(getErrorPage('Serverfehler', e.message));
  }
});

// ============================================================
// Download + Send pipeline
// ============================================================
function processDownload(downloadId, md5, title, author) {
  const epubPath = path.join(EPUB_DIR, `${md5}.epub`);
  const dlScript = path.join(__dirname, 'scripts', 'anna-browser-download.sh');
  const sendScript = path.join(__dirname, 'scripts', 'send-to-kindle.py');

  // Step 1: Download EPUB
  downloads.set(downloadId, { status: 'downloading', progress: 10, md5, title });
  console.log(`📥 Downloading ${title} (MD5: ${md5})...`);

  execFile('bash', [dlScript, md5, epubPath], { timeout: 300000 }, (dlError, dlStdout, dlStderr) => {
    if (dlError) {
      console.error('Download error:', dlStderr);
      downloads.set(downloadId, { status: 'failed', error: `Download fehlgeschlagen: ${dlStderr || dlError.message}`, md5, title });
      return;
    }

    if (!fs.existsSync(epubPath)) {
      downloads.set(downloadId, { status: 'failed', error: 'EPUB-Datei nicht erstellt', md5, title });
      return;
    }

    // Step 2: Send to Kindle
    downloads.set(downloadId, { status: 'sending', progress: 70, md5, title });
    console.log(`📧 Sending "${title}" to Kindle...`);

    execFile('python3', [sendScript, title, epubPath, author], { timeout: 30000 }, (sendError, sendStdout, sendStderr) => {
      if (sendError) {
        console.error('Send error:', sendStderr);
        downloads.set(downloadId, { status: 'failed', error: `Kindle-Versand fehlgeschlagen: ${sendStderr || sendError.message}`, md5, title });
        return;
      }

      try {
        const result = JSON.parse(sendStdout);
        if (result.error) {
          downloads.set(downloadId, { status: 'failed', error: result.error, md5, title });
        } else {
          console.log(`✅ "${title}" sent to Kindle — message_id: ${result.message_id}`);
          downloads.set(downloadId, { status: 'done', progress: 100, md5, title, messageId: result.message_id });
        }
      } catch (parseErr) {
        console.error('Send parse error:', sendStdout);
        downloads.set(downloadId, { status: 'failed', error: 'Unexpected send response', md5, title });
      }
    });
  });
}

// ============================================================
// Template rendering
// ============================================================
function renderTemplate(template, data) {
  const { id, query, timestamp, books } = data;
  let html = template;

  // Inject data into template
  html = html.replace(
    'const __BOOKS__ = [];',
    `const __BOOKS__ = ${JSON.stringify(books)};`
  );
  html = html.replace(
    'const __RESULT_ID__ = "";',
    `const __RESULT_ID__ = "${id}";`
  );
  html = html.replace(
    'const __QUERY__ = "";',
    `const __QUERY__ = ${JSON.stringify(query)};`
  );
  html = html.replace(
    'const __TIMESTAMP__ = "";',
    `const __TIMESTAMP__ = "${timestamp || ''}";`
  );

  return html;
}

// ============================================================
// Simple Markdown-to-HTML converter
// ============================================================
function markdownToHtml(md) {
  if (!md) return '';
  let html = md;

  // Escape HTML entities first
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (fenced) - do this before inline processing
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers (must be before bold/italic)
  html = html.replace(/^#### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Horizontal rules
  html = html.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '<hr>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Wrap consecutive <li> after ordered items (but not inside existing <ul>)
  html = html.replace(/(<ul>[\s\S]*?<\/ul>)/g, (match) => {
    return match;
  });

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/((?:<blockquote>.*<\/blockquote>\n?)+)/g, (match) => {
    return match.replace(/<\/blockquote>\n?<blockquote>/g, '<br>');
  });

  // Paragraphs: split by double newline, wrap non-tag blocks in <p>
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // Don't wrap tags in <p>
    if (/^<(h[1-4]|ul|ol|pre|hr|blockquote|li)/.test(trimmed)) {
      return trimmed;
    }
    // Replace single newlines with <br> within paragraphs
    const withBreaks = trimmed.replace(/\n/g, '<br>');
    return `<p>${withBreaks}</p>`;
  }).join('\n');

  return html;
}

// ============================================================
// Answer template rendering
// ============================================================
function renderAnswerTemplate(template, data) {
  const { question, answer, timestamp } = data;
  let html = template;

  html = html.split('__QUESTION__').join(escHtml(question || 'Frage'));
  html = html.split('__ANSWER_HTML__').join(markdownToHtml(answer || ''));

  // Format date
  let dateStr = '';
  if (timestamp) {
    try {
      const d = new Date(timestamp);
      dateStr = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { dateStr = timestamp; }
  }
  html = html.split('__DATE__').join(dateStr || new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }));

  return html;
}

// ============================================================
// Recipe list template rendering (multiple recipes, selection view)
// ============================================================
function renderRecipeListTemplate(template, data) {
  const { id, query, recipes, count } = data;
  let html = template;

  html = html.split('__QUERY__').join(escHtml(query || 'Rezepte'));
  html = html.split('__COUNT__').join(String(count || recipes.length));

  const cards = (recipes || []).map((r, i) => {
    const stars = '★'.repeat(Math.round(r.rating || 0)) + '☆'.repeat(5 - Math.round(r.rating || 0));
    const imageHtml = r.image
      ? `<img src="${escAttr(r.image)}" alt="" loading="lazy">`
      : '<span class="no-img">🍽️</span>';
    const meta = [r.prep_time, r.cook_time, r.yield].filter(Boolean).join(' · ');

    return `<a class="recipe-card" href="/rezepte/${id}/r/${i}">
      <div class="card-image">${imageHtml}</div>
      <div class="card-info">
        <div class="recipe-title">${escHtml(r.title || 'Rezept')}</div>
        ${meta ? `<div class="recipe-meta">${escHtml(meta)}</div>` : ''}
        <div class="recipe-rating"><span class="stars">${stars}</span> ${r.rating} (${r.rating_count || 0})</div>
        <div class="recipe-source">${escHtml(r.source_domain || '')}</div>
      </div>
    </a>`;
  }).join('\n');

  html = html.split('__RECIPE_CARDS__').join(cards || '<li class="recipe-card"><div class="card-info"><em>Keine Rezepte gefunden.</em></div></li>');

  return html;
}

// ============================================================
// Recipe detail template rendering (single recipe)
// ============================================================
function renderRecipeDetailTemplate(template, recipe, resultId, hasMultiple) {
  let html = template;

  html = html.split('__TITLE__').join(escHtml(recipe.title || 'Rezept'));

  // Back link (only if part of a multi-recipe result)
  const backLink = hasMultiple
    ? `<a class="back-link" href="/rezepte/${resultId}">← Zurück zur Übersicht</a>`
    : '';
  html = html.split('__BACK_LINK__').join(backLink);

  // Image
  const imageHtml = recipe.image
    ? `<img src="${escAttr(recipe.image)}" alt="${escAttr(recipe.title)}" loading="lazy">`
    : '<span class="no-img">🍽️</span>';
  html = html.split('__IMAGE__').join(imageHtml);

  // Meta items
  const metaItems = [];
  const timeFormat = (iso) => {
    if (!iso) return null;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!m) return iso;
    const parts = [];
    if (m[1]) parts.push(`${m[1]} Std`);
    if (m[2]) parts.push(`${m[2]} Min`);
    return parts.join(' ');
  };
  if (recipe.prep_time) metaItems.push({ label: 'Vorbereitung', value: timeFormat(recipe.prep_time) || recipe.prep_time });
  if (recipe.cook_time) metaItems.push({ label: 'Kochzeit', value: timeFormat(recipe.cook_time) || recipe.cook_time });
  if (recipe.total_time) metaItems.push({ label: 'Gesamtzeit', value: timeFormat(recipe.total_time) || recipe.total_time });
  if (recipe.yield) metaItems.push({ label: 'Portionen', value: recipe.yield });

  html = html.split('__META_ITEMS__').join(metaItems.map(m =>
    `<div class="meta-item"><div class="meta-label">${escHtml(m.label)}</div><div class="meta-value">${escHtml(m.value)}</div></div>`
  ).join(''));

  // Rating
  let ratingHtml = '';
  if (recipe.rating) {
    const stars = '★'.repeat(Math.round(recipe.rating)) + '☆'.repeat(5 - Math.round(recipe.rating));
    ratingHtml = `<div class="rating-box"><span class="stars">${stars}</span> ${recipe.rating} / 5 (${recipe.rating_count || 0} Bewertungen)</div>`;
  }
  html = html.split('__RATING__').join(ratingHtml);

  // Ingredients
  const ingredients = (recipe.ingredients || []).map(i => `<li>${escHtml(i)}</li>`).join('\n');
  html = html.split('__INGREDIENTS__').join(ingredients || '<li><em>Keine Zutaten gefunden</em></li>');

  // Instructions
  const instructions = (recipe.instructions || []).map(i => `<li>${escHtml(i)}</li>`).join('\n');
  html = html.split('__INSTRUCTIONS__').join(instructions || '<li><em>Keine Anleitung gefunden</em></li>');

  // Source
  let sourceHtml = '';
  if (recipe.url) {
    sourceHtml = `<div class="source-link">Quelle: <a href="${escAttr(recipe.url)}" target="_blank" rel="noopener">${escHtml(recipe.source_domain || recipe.url)}</a></div>`;
  }
  html = html.split('__SOURCE__').join(sourceHtml);

  return html;
}

// HTML escape helpers (used in template rendering, not for browser JS)
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// ANSWER ROUTES
// ============================================================
app.get('/a', (req, res) => {
  const latestFile = path.join(ANSWER_DIR, 'latest.json');
  if (!fs.existsSync(latestFile)) {
    return res.status(404).send(getErrorPage('Keine Antwort', 'Es wurde noch keine Frage beantwortet.'));
  }
  try {
    const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    const template = fs.readFileSync(path.join(__dirname, 'templates', 'answer.html'), 'utf8');
    const html = renderAnswerTemplate(template, data);
    res.type('html').send(html);
  } catch (e) {
    console.error('Error serving latest answer:', e);
    res.status(500).send(getErrorPage('Serverfehler', e.message));
  }
});

app.get('/a/:id', (req, res) => {
  const answerFile = path.join(ANSWER_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(answerFile)) {
    return res.status(404).send(getErrorPage('Antwort nicht gefunden', 'Diese Antwort existiert nicht oder wurde gelöscht.'));
  }
  try {
    const data = JSON.parse(fs.readFileSync(answerFile, 'utf8'));
    const template = fs.readFileSync(path.join(__dirname, 'templates', 'answer.html'), 'utf8');
    const html = renderAnswerTemplate(template, data);
    res.type('html').send(html);
  } catch (e) {
    console.error('Error serving answer:', e);
    res.status(500).send(getErrorPage('Serverfehler', e.message));
  }
});

// ============================================================
// RECIPE ROUTES
// ============================================================
app.get('/rezepte', (req, res) => {
  const latestFile = path.join(RECIPE_JSON_DIR, 'latest.json');
  if (!fs.existsSync(latestFile)) {
    return res.status(404).send(getErrorPage('Keine Rezepte', 'Es wurden noch keine Rezepte gesucht.'));
  }
  const id = JSON.parse(fs.readFileSync(latestFile, 'utf8')).id;
  res.redirect(302, `/rezepte/${id}`);
});

app.get('/rezepte/:id', (req, res) => {
  const recipeFile = path.join(RECIPE_JSON_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(recipeFile)) {
    return res.status(404).send(getErrorPage('Rezepte nicht gefunden', 'Diese Rezeptsammlung existiert nicht oder wurde gelöscht.'));
  }

  try {
    const data = JSON.parse(fs.readFileSync(recipeFile, 'utf8'));
    const recipes = data.recipes || [];

    if (recipes.length === 1) {
      // Single recipe → render detail page directly
      const template = fs.readFileSync(path.join(__dirname, 'templates', 'recipe-detail.html'), 'utf8');
      const html = renderRecipeDetailTemplate(template, recipes[0], data.id, false);
      res.type('html').send(html);
    } else {
      // Multiple recipes → render selection page
      const template = fs.readFileSync(path.join(__dirname, 'templates', 'recipe-list.html'), 'utf8');
      const html = renderRecipeListTemplate(template, data);
      res.type('html').send(html);
    }
  } catch (e) {
    console.error('Error serving recipes:', e);
    res.status(500).send(getErrorPage('Serverfehler', e.message));
  }
});

app.get('/rezepte/:id/r/:index', (req, res) => {
  const recipeFile = path.join(RECIPE_JSON_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(recipeFile)) {
    return res.status(404).send(getErrorPage('Rezept nicht gefunden', 'Diese Rezeptsammlung existiert nicht.'));
  }

  try {
    const data = JSON.parse(fs.readFileSync(recipeFile, 'utf8'));
    const recipes = data.recipes || [];
    const index = parseInt(req.params.index, 10);

    if (isNaN(index) || index < 0 || index >= recipes.length) {
      return res.status(404).send(getErrorPage('Rezept nicht gefunden', 'Dieses Rezept existiert nicht in dieser Sammlung.'));
    }

    const template = fs.readFileSync(path.join(__dirname, 'templates', 'recipe-detail.html'), 'utf8');
    const html = renderRecipeDetailTemplate(template, recipes[index], data.id, recipes.length > 1);
    res.type('html').send(html);
  } catch (e) {
    console.error('Error serving recipe detail:', e);
    res.status(500).send(getErrorPage('Serverfehler', e.message));
  }
});

function getErrorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=yes">
<title>${title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;min-height:100vh}.wrap{text-align:center;padding:40px}h1{font-size:22px;margin-bottom:8px}p{font-size:15px;color:#555}</style>
</head><body>
<div class="wrap">
  <h1>${title}</h1>
  <p>${message}</p>
</div>
</body></html>`;
}

// ============================================================
// Start
// ============================================================
app.listen(PORT, () => {
  console.log(`📚 AddBook server running on port ${PORT}`);
  console.log(`   Results dir: ${RESULTS_DIR}`);
  console.log(`   EPUB dir: ${EPUB_DIR}`);
});
