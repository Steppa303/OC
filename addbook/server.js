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

// Ensure directories exist
[RESULTS_DIR, EPUB_DIR].forEach(dir => {
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
// Open Library proxy (CORS for Kindle browser)
// ============================================================
app.get('/api/bookinfo', async (req, res) => {
  const { title, author } = req.query;
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    const https = require('https');
    const query = encodeURIComponent(title);
    const url = `https://openlibrary.org/search.json?title=${query}&limit=3&fields=key,title,author_name,first_publish_year,subject,description`;

    https.get(url, { headers: { 'User-Agent': 'AddBook/1.0' } }, (upstream) => {
      let data = '';
      upstream.on('data', (c) => data += c);
      upstream.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          res.json(parsed);
        } catch (e) {
          res.status(502).json({ error: 'invalid upstream response' });
        }
      });
    }).on('error', (e) => res.status(502).json({ error: e.message }));
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
