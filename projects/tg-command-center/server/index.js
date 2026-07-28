import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3721;
const UPLOADS_DIR = join(__dirname, '..', 'uploads');
const DATA_DIR = join(__dirname, '..', 'data');

// Ensure dirs exist
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// DB
const db = new Database(join(DATA_DIR, 'canvas.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'text',
    x REAL DEFAULT 200,
    y REAL DEFAULT 200,
    width REAL DEFAULT 280,
    height REAL DEFAULT 180,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    color TEXT DEFAULT 'default',
    image_url TEXT,
    caption TEXT DEFAULT '',
    pinned INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname) || '.png';
    cb(null, `${uuid()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  },
});

// Express
const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(join(__dirname, '..', 'client', 'dist')));

// --- API ---

// GET all items
app.get('/api/items', (req, res) => {
  const items = db.prepare('SELECT * FROM items ORDER BY pinned DESC, sort_order ASC, updated_at DESC').all();
  res.json(items);
});

// POST create item
app.post('/api/items', (req, res) => {
  const id = uuid();
  const { type = 'text', x = 200, y = 200, width = 280, height = 180, title = '', content = '', color = 'default', image_url, caption = '', pinned = 0 } = req.body;
  const stmt = db.prepare(`
    INSERT INTO items (id, type, x, y, width, height, title, content, color, image_url, caption, pinned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, type, x, y, width, height, title, content, color, image_url || null, caption, pinned ? 1 : 0);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(item);
});

// PUT update item
app.put('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fields = ['x', 'y', 'width', 'height', 'title', 'content', 'color', 'image_url', 'caption', 'pinned', 'sort_order'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(f === 'pinned' ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  }
  if (updates.length === 0) return res.json(existing);

  updates.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(item);
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  res.json({ ok: true });
});

// POST upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const imageUrl = `/uploads/${req.file.filename}`;

  // Auto-create an image card at a random position
  const id = uuid();
  const x = Math.floor(100 + Math.random() * 400);
  const y = Math.floor(100 + Math.random() * 300);
  db.prepare(`
    INSERT INTO items (id, type, x, y, width, height, image_url, caption)
    VALUES (?, 'image', ?, ?, 300, 240, ?, '')
  `).run(id, x, y, imageUrl);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json({ url: imageUrl, item });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Canvas server running on port ${PORT}`);
});
