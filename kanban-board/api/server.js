const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = 4000;
const JWT_SECRET = 'kanban-secret-' + Date.now();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Simple token-based auth (no JWT complexity for internal tool)
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const member = db.prepare('SELECT * FROM members WHERE token = ?').get(token);
  if (!member) return res.status(401).json({ error: 'Invalid token' });
  
  req.member = member;
  next();
}

// ============ AUTH ============

app.post('/api/auth/login', (req, res) => {
  const { email, name } = req.body;
  
  // Try to find by email, or create new member
  let member = db.prepare('SELECT * FROM members WHERE email = ?').get(email);
  
  if (!member && name) {
    const token = 'token-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    
    const result = db.prepare(
      "INSERT INTO members (team_id, name, email, avatar_color, token, role) VALUES (1, ?, ?, ?, ?, 'member')"
    ).run(name, email, avatarColor, token);
    
    member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  }
  
  if (!member) return res.status(401).json({ error: 'Member not found. Provide a name to register.' });
  
  res.json({ member, token: member.token });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  
  const existing = db.prepare('SELECT * FROM members WHERE email = ?').get(email);
  if (existing) return res.json({ member: existing, token: existing.token });
  
  const token = 'token-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];
  
  const result = db.prepare(
    "INSERT INTO members (team_id, name, email, avatar_color, token, role) VALUES (1, ?, ?, ?, ?, 'member')"
  ).run(name, email, avatarColor, token);
  
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  res.json({ member, token: member.token });
});

// ============ MEMBERS ============

app.get('/api/members', authMiddleware, (req, res) => {
  const members = db.prepare('SELECT id, name, email, avatar_color, role FROM members WHERE team_id = 1 ORDER BY name').all();
  res.json(members);
});

// ============ TASKS ============

app.get('/api/tasks', authMiddleware, (req, res) => {
  const tasks = db.prepare(`
    SELECT t.*, 
           m.name as assignee_name, m.avatar_color as assignee_color,
           c.name as creator_name
    FROM tasks t
    LEFT JOIN members m ON t.assignee_id = m.id
    LEFT JOIN members c ON t.creator_id = c.id
    WHERE t.team_id = 1
    ORDER BY t.column_order ASC, t.created_at DESC
  `).all();
  
  // Get comments count for each task
  tasks.forEach(task => {
    task.comments_count = db.prepare('SELECT COUNT(*) as count FROM comments WHERE task_id = ?').get(task.id).count;
  });
  
  res.json(tasks);
});

app.post('/api/tasks', authMiddleware, (req, res) => {
  const { title, description, priority, assignee_id, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  
  const maxOrder = db.prepare('SELECT MAX(column_order) as max_order FROM tasks WHERE status = ? AND team_id = 1').get('todo');
  const order = (maxOrder?.max_order || 0) + 1;
  
  const result = db.prepare(
    'INSERT INTO tasks (team_id, title, description, priority, assignee_id, creator_id, column_order, due_date) VALUES (1, ?, ?, ?, ?, ?, ?, ?)'
  ).run(title, description || '', priority || 'medium', assignee_id || null, req.member.id, order, due_date || null);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.json(task);
});

app.put('/api/tasks/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { title, description, priority, status, assignee_id, due_date, column_order } = req.body;
  
  const oldTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parseInt(id));
  if (!oldTask) return res.status(404).json({ error: 'Task not found' });
  
  // Log status change
  if (status && status !== oldTask.status) {
    db.prepare(
      'INSERT INTO status_history (task_id, member_id, from_status, to_status, note) VALUES (?, ?, ?, ?, ?)'
    ).run(parseInt(id), req.member.id, oldTask.status, status, null);
  }
  
  const updates = [];
  const values = [];
  
  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
  if (status !== undefined) { updates.push('status = ?'); values.push(status); }
  if (assignee_id !== undefined) { updates.push('assignee_id = ?'); values.push(assignee_id); }
  if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }
  if (column_order !== undefined) { updates.push('column_order = ?'); values.push(column_order); }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(parseInt(id));
  
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parseInt(id));
  res.json(task);
});

app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND team_id = 1').run(parseInt(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ success: true });
});

// ============ COMMENTS ============

app.get('/api/tasks/:id/comments', authMiddleware, (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, m.name, m.avatar_color
    FROM comments c
    JOIN members m ON c.member_id = m.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(parseInt(req.params.id));
  
  res.json(comments);
});

app.post('/api/tasks/:id/comments', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  
  const result = db.prepare(
    'INSERT INTO comments (task_id, member_id, content) VALUES (?, ?, ?)'
  ).run(parseInt(req.params.id), req.member.id, content);
  
  const comment = db.prepare(`
    SELECT c.*, m.name, m.avatar_color
    FROM comments c JOIN members m ON c.member_id = m.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);
  
  res.json(comment);
});

// ============ STATUS HISTORY ============

app.get('/api/tasks/:id/history', authMiddleware, (req, res) => {
  const history = db.prepare(`
    SELECT sh.*, m.name, m.avatar_color
    FROM status_history sh
    JOIN members m ON sh.member_id = m.id
    WHERE sh.task_id = ?
    ORDER BY sh.created_at ASC
  `).all(parseInt(req.params.id));
  
  res.json(history);
});

// ============ STATS ============

app.get('/api/stats', authMiddleware, (req, res) => {
  const stats = {
    total: db.prepare('SELECT COUNT(*) as count FROM tasks WHERE team_id = 1').get().count,
    todo: db.prepare("SELECT COUNT(*) as count FROM tasks WHERE team_id = 1 AND status = 'todo'").get().count,
    in_progress: db.prepare("SELECT COUNT(*) as count FROM tasks WHERE team_id = 1 AND status = 'in_progress'").get().count,
    review: db.prepare("SELECT COUNT(*) as count FROM tasks WHERE team_id = 1 AND status = 'review'").get().count,
    done: db.prepare("SELECT COUNT(*) as count FROM tasks WHERE team_id = 1 AND status = 'done'").get().count,
    members: db.prepare('SELECT COUNT(*) as count FROM members WHERE team_id = 1').get().count,
  };
  res.json(stats);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Kanban API running on http://localhost:${PORT}`);
});
