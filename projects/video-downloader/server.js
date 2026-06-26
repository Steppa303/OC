const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3100;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const YT_DLP_TIMEOUT = 120_000;
const CLEANUP_AGE = 60 * 60 * 1000;

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

function cleanupOldDownloads() {
  const now = Date.now();
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    for (const file of files) {
      const filePath = path.join(DOWNLOADS_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > CLEANUP_AGE) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}
setInterval(cleanupOldDownloads, 30 * 60 * 1000);
cleanupOldDownloads();

function sanitizeFilename(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

// ── POST /api/info ──
app.post('/api/info', (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Keine gültige URL angegeben.' });
  }

  const trimmedUrl = url.trim();
  try { new URL(trimmedUrl); } catch {
    return res.status(400).json({ error: 'Die eingegebene URL ist ungültig.' });
  }

  const proc = spawn('yt-dlp', [
    '--dump-json', '--no-warnings', '--no-playlist', '--no-download', trimmedUrl
  ], { timeout: YT_DLP_TIMEOUT });

  let stdout = '', stderr = '';
  proc.stdout.on('data', (d) => { stdout += d.toString(); });
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  proc.on('close', (code) => {
    if (code !== 0) {
      const msg = stderr.trim() || 'yt-dlp konnte die URL nicht verarbeiten.';
      if (msg.includes('HTTP Error') || msg.includes('Unable to extract')) {
        return res.status(422).json({ error: 'Die URL konnte nicht verarbeitet werden. Möglicherweise ist der Inhalt nicht verfügbar oder geschützt.' });
      }
      return res.status(500).json({ error: msg.substring(0, 500) });
    }

    try {
      const data = JSON.parse(stdout);
      const rawFormats = data.formats || data.requested_formats || [];

      let formats = [];

      if (rawFormats.length > 0) {
        // ── Fall A: Website mit Format-Liste (YouTube, etc.) ──
        formats = rawFormats.filter(f => {
          if ((!f.vcodec || f.vcodec === 'none') && (!f.acodec || f.acodec === 'none')) return false;
          if (f.resolution === 'storyboard' || (f.format_note && f.format_note.includes('storyboard'))) return false;
          return true;
        });

        const seen = new Set();
        formats = formats
          .filter(f => {
            const isAudio = !f.vcodec || f.vcodec === 'none';
            const key = isAudio
              ? `audio-${f.abr || 0}-${f.filesize || 0}`
              : `${f.format_id}-${f.height || 0}-${f.filesize || f.filesize_approx || 0}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => {
            const aA = !a.vcodec || a.vcodec === 'none';
            const bA = !b.vcodec || b.vcodec === 'none';
            if (aA && !bA) return 1;
            if (!aA && bA) return -1;
            if (!aA && !bA) return (b.height || 0) - (a.height || 0);
            return (b.abr || 0) - (a.abr || 0);
          })
          .slice(0, 40);

        // Best-Option für Format-Listen
        formats.unshift({
          format_id: 'best',
          format_note: 'Best (Auto) – empfohlen',
          height: formats[0]?.height || null,
          ext: 'mp4',
          vcodec: 'avc1',
          acodec: 'mp4a',
          _isBest: true
        });
      } else if (data.url) {
        // ── Fall B: Direkt-URL (Motherless, einfache MP4-Links, etc.) ──
        formats.push({
          format_id: 'best',
          format_note: 'Video herunterladen',
          height: null,
          ext: data.ext || 'mp4',
          vcodec: 'avc1',
          acodec: 'mp4a',
          _isBest: true,
          _directUrl: true
        });
      }

      res.json({
        title: data.title || 'Unbekannter Titel',
        thumbnail: data.thumbnail || null,
        duration: formatDuration(data.duration),
        durationSeconds: data.duration || null,
        uploader: data.uploader || data.channel || data.uploader_id || null,
        formats,
        webpageUrl: data.webpage_url || trimmedUrl,
        _directUrl: !rawFormats.length && !!data.url
      });

    } catch (err) {
      res.status(500).json({ error: 'Fehler beim Verarbeiten der Video-Informationen.' });
    }
  });

  proc.on('error', (err) => {
    res.status(500).json({ error: 'yt-dlp konnte nicht gestartet werden: ' + err.message });
  });
});

// ── POST /api/download ──
app.post('/api/download', (req, res) => {
  const { url, formatId, filename } = req.body;

  if (!url || !formatId) {
    return res.status(400).json({ error: 'URL und Format-ID sind erforderlich.' });
  }

  try { new URL(url.trim()); } catch {
    return res.status(400).json({ error: 'Ungültige URL.' });
  }

  const safeName = sanitizeFilename(filename || 'video');
  const downloadName = safeName + '.mp4';

  // Antwort-Headers SOFORT – Browser weiß Bescheid, bevor yt-dlp loslegt
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache');

  const args = ['-f', formatId, '-o', '-', '--no-warnings', '--no-playlist', url.trim()];

  const proc = spawn('yt-dlp', args, {
    timeout: YT_DLP_TIMEOUT + 120000,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let errorOutput = '';
  proc.stderr.on('data', (d) => { errorOutput += d.toString(); });

  // yt-dlp stdout direkt in Response
  proc.stdout.pipe(res);

  let done = false;
  function finish(errMsg) {
    if (done) return;
    done = true;
    if (errMsg && !res.headersSent) {
      return res.status(500).json({ error: errMsg });
    }
    res.end();
  }

  proc.on('close', (code) => {
    if (code !== 0) {
      const msg = errorOutput.trim().substring(0, 300);
      console.error('yt-dlp error:', msg);
      if (!msg.includes('yt-dlp') && !msg.includes('Error')) {
        // Manche Sites schreiben Infos nach stderr, das ist kein Fehler
        finish(null);
      } else {
        finish(msg || 'Download fehlgeschlagen.');
      }
    } else {
      finish(null);
    }
  });

  proc.on('error', (err) => {
    finish('Fehler beim Starten von yt-dlp: ' + err.message);
  });

  const timer = setTimeout(() => {
    proc.kill('SIGTERM');
    finish('Download abgebrochen (Zeitüberschreitung).');
  }, YT_DLP_TIMEOUT + 120000);

  proc.on('close', () => clearTimeout(timer));
});

// ── Fallback: SPA ──
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Video Downloader läuft auf http://0.0.0.0:${PORT}`);
});