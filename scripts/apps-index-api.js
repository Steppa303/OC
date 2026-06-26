/**
 * apps-index-api – Parses /etc/caddy/Caddyfile and returns project list as JSON.
 * Runs on port 3006, proxied via Caddy at apps.steppa.online/api/refresh
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const CADDYFILE = '/etc/caddy/Caddyfile';
const OUTPUT_HTML = '/var/www/apps/apps-index/index.html';
const PORT = 3006;

// Manual descriptions for known projects (keyed by domain or path)
const DESCRIPTIONS = {
  'steppa.online': 'Hauptseite & Agent-Frontend',
  'steppa.online/midi': 'MIDI Session Viewer & Bibliothek',
  'steppa.online/midi-files': 'MIDI-Dateien – Statisches File-Browser',
  'dashboard.steppa.online': 'Agent Dashboard – Echtzeit-Monitoring',
  'config.steppa.online': 'OpenClaw Config Editor',
  'kanban.steppa.online': 'Kanban Board – Task-Management',
  'gzpl.steppa.online': 'GZPL – Projektplanung',
  'swarmboard.steppa.online': 'Swarmboard – Multi-Agent-Übersicht',
  'clipsaver.steppa.online': 'ClipSaver – Clip-Verwaltung',
  'reader.steppa.online': 'Reader – Lese-App',
  'edit.steppa.online': 'Edit – Text-Editor',
  'sampler.steppa.online': 'Sampler – Audio-Sampling',
  'stepsampler.steppa.online': 'StepSampler – Step-Sequencer',
  'stepremix.steppa.online': 'StepRemix – Remix-Tool',
  'apps.steppa.online': 'Projekt-Übersicht (diese Seite)',
};

// Emoji icons per project
const ICONS = {
  'steppa.online': '🦞',
  'steppa.online/midi': '🎹',
  'steppa.online/midi-files': '📂',
  'dashboard.steppa.online': '📊',
  'config.steppa.online': '⚙️',
  'kanban.steppa.online': '📋',
  'gzpl.steppa.online': '📐',
  'swarmboard.steppa.online': '🐝',
  'clipsaver.steppa.online': '💾',
  'reader.steppa.online': '📖',
  'edit.steppa.online': '✏️',
  'sampler.steppa.online': '🎛️',
  'stepsampler.steppa.online': '🥁',
  'stepremix.steppa.online': '🎵',
  'apps.steppa.online': '🌐',
};

function parseCaddyfile(content) {
  const projects = [];
  const lines = content.split('\n');
  let currentDomain = null;
  let braceDepth = 0;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Track brace depth
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;

    // Detect top-level domain blocks: "domain.tld {" at brace depth 0
    if (braceDepth === 0 && /^\S+\.\S+\s*\{/.test(line)) {
      currentDomain = line.split(/\s+/)[0].replace(/\{/, '').trim();
      braceDepth += openBraces - closeBraces;

      // Skip internal/tailscale domains
      if (currentDomain.includes('.ts.net') || currentDomain === 'vmd190638.tail2f1fb9.ts.net') {
        currentDomain = null;
        continue;
      }

      // Check if it has a root directive (standalone app) or reverse_proxy (service)
      const blockContent = extractBlock(lines, i);
      const hasRoot = /^\s*root\s+/m.test(blockContent);
      const hasReverseProxy = /^\s*reverse_proxy\s+/m.test(blockContent);

      let type = 'subdomain';
      let url = `https://${currentDomain}`;

      // Determine type
      if (hasRoot && !hasReverseProxy) {
        type = 'static';
      } else if (hasReverseProxy && !hasRoot) {
        type = 'proxy';
      } else if (hasRoot && hasReverseProxy) {
        type = 'hybrid';
      }

      projects.push({
        id: currentDomain,
        name: formatName(currentDomain),
        domain: currentDomain,
        url: url,
        type: type,
        description: DESCRIPTIONS[currentDomain] || '',
        icon: ICONS[currentDomain] || '🌐',
        paths: [],
        _blockContent: blockContent  // stored for sub-path dedup
      });
      continue;
    }

    // Detect path-based sub-apps within a domain block
    if (currentDomain && braceDepth >= 1) {
      const pathMatch = line.match(/^handle\s+\/(\S+)\s*\{/);
      if (pathMatch) {
        const subPath = pathMatch[1].replace(/\/\*$/, '');
        const subBlock = extractBlock(lines, i);
        const hasRoot = /^\s*root\s+/m.test(subBlock);

        if (hasRoot && subPath !== '*' && subPath !== 'api' && subPath !== 'openclaw') {
          const subId = `${currentDomain}/${subPath}`;
          const existing = projects.find(p => p.id === subId);
          // Skip if it's just a sub-route of the root app (same root dir as parent)
          const parentProject = projects.find(p => p.id === currentDomain);
          const parentRoot = parentProject ? extractRootDir(parentProject._blockContent) : null;
          const subRoot = extractRootDir(subBlock);
          const isSameRoot = parentRoot && subRoot && parentRoot === subRoot;
          if (!existing && !isSameRoot) {
            projects.push({
              id: subId,
              name: formatPathName(subPath),
              domain: currentDomain,
              url: `https://${currentDomain}/${subPath}`,
              type: 'sub-app',
              description: DESCRIPTIONS[subId] || '',
              icon: ICONS[subId] || '📁',
              parentDomain: currentDomain
            });
          }
        }
      }
    }

    braceDepth += openBraces - closeBraces;
    if (braceDepth <= 0) {
      braceDepth = 0;
      currentDomain = null;
    }
  }

  // Clean internal fields
  projects.forEach(p => delete p._blockContent);

  return projects;
}

function extractBlock(lines, startIndex) {
  let depth = 0;
  let block = '';
  for (let i = startIndex; i < lines.length; i++) {
    block += lines[i] + '\n';
    depth += (lines[i].match(/{/g) || []).length;
    depth -= (lines[i].match(/}/g) || []).length;
    if (depth <= 0) break;
  }
  return block;
}

function extractRootDir(block) {
  const m = block.match(/root\s+\*?\s*(\S+)/);
  return m ? m[1] : null;
}

function formatName(domain) {
  const name = domain.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatPathName(p) {
  return p.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function generateHTML(projects) {
  const cards = projects.map(p => {
    const typeLabel = p.type === 'sub-app' ? 'Sub-App' : p.type === 'proxy' ? 'Service' : 'App';
    return `
    <a href="${p.url}" target="_blank" rel="noopener" class="card">
      <div class="card-icon">${p.icon}</div>
      <div class="card-body">
        <h3>${p.name}</h3>
        <p class="card-desc">${p.description || p.domain}</p>
        <span class="card-url">${p.url.replace('https://', '')}</span>
      </div>
      <span class="card-type">${typeLabel}</span>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>steppa.online – Projekte</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #0a0a0f;
      color: #e0e0e0;
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      margin-bottom: 3rem;
    }

    header h1 {
      font-size: 2rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }

    header h1 span {
      color: #ff4d4d;
    }

    header p {
      color: #666;
      font-size: 0.95rem;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .project-count {
      color: #555;
      font-size: 0.85rem;
    }

    .btn-refresh {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      background: rgba(255, 77, 77, 0.1);
      border: 1px solid rgba(255, 77, 77, 0.25);
      color: #ff4d4d;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .btn-refresh:hover {
      background: rgba(255, 77, 77, 0.2);
      border-color: rgba(255, 77, 77, 0.5);
    }

    .btn-refresh.loading {
      opacity: 0.6;
      pointer-events: none;
    }

    .btn-refresh.loading .spinner {
      display: inline-block;
    }

    .spinner {
      display: none;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 77, 77, 0.3);
      border-top-color: #ff4d4d;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s ease;
      position: relative;
    }

    .card:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 77, 77, 0.2);
      transform: translateY(-2px);
    }

    .card-icon {
      font-size: 1.8rem;
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 10px;
    }

    .card-body {
      flex: 1;
      min-width: 0;
    }

    .card-body h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 0.2rem;
    }

    .card-desc {
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 0.3rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-url {
      font-size: 0.75rem;
      color: #444;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }

    .card-type {
      position: absolute;
      top: 0.6rem;
      right: 0.8rem;
      font-size: 0.65rem;
      color: #555;
      background: rgba(255, 255, 255, 0.05);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .toast {
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #1a1a2e;
      color: #fff;
      padding: 0.8rem 1.5rem;
      border-radius: 10px;
      font-size: 0.9rem;
      border: 1px solid rgba(255, 77, 77, 0.3);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 100;
    }

    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    footer {
      text-align: center;
      margin-top: 4rem;
      color: #333;
      font-size: 0.75rem;
    }

    @media (max-width: 640px) {
      body { padding: 1.5rem 0.75rem; }
      header h1 { font-size: 1.5rem; }
      .grid { grid-template-columns: 1fr; }
      .toolbar { justify-content: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>steppa<span>.online</span></h1>
      <p>Alle Projekte auf einen Blick</p>
    </header>

    <div class="toolbar">
      <span class="project-count">${projects.length} Projekte</span>
      <button class="btn-refresh" id="btn-refresh" onclick="refresh()">
        <span class="spinner"></span>
        ↻ Aktualisieren
      </button>
    </div>

    <div class="grid" id="grid">
      ${cards}
    </div>

    <footer>
      Generiert aus /etc/caddy/Caddyfile · Letztes Update: ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} Uhr
    </footer>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    async function refresh() {
      const btn = document.getElementById('btn-refresh');
      btn.classList.add('loading');

      try {
        const res = await fetch('/api/refresh', { method: 'POST' });
        const data = await res.json();

        if (data.ok) {
          showToast('✓ Seite aktualisiert – ' + data.projects.length + ' Projekte');
          // Reload after short delay so user sees the toast
          setTimeout(() => location.reload(), 800);
        } else {
          showToast('✗ Fehler: ' + (data.error || 'Unbekannt'));
        }
      } catch (e) {
        showToast('✗ Verbindung fehlgeschlagen');
      } finally {
        btn.classList.remove('loading');
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
  </script>
</body>
</html>`;
}

// HTTP Server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // GET /api/projects – return project list as JSON
  if (req.method === 'GET' && req.url === '/api/projects') {
    try {
      const caddyfile = fs.readFileSync(CADDYFILE, 'utf8');
      const projects = parseCaddyfile(caddyfile);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, projects, generated: new Date().toISOString() }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // POST /api/refresh – regenerate HTML and return result
  if (req.method === 'POST' && req.url === '/api/refresh') {
    try {
      const caddyfile = fs.readFileSync(CADDYFILE, 'utf8');
      const projects = parseCaddyfile(caddyfile);
      const html = generateHTML(projects);
      fs.writeFileSync(OUTPUT_HTML, html, 'utf8');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        projects: projects.map(p => ({ name: p.name, url: p.url })),
        generated: new Date().toISOString()
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`apps-index-api running on http://127.0.0.1:${PORT}`);
});
