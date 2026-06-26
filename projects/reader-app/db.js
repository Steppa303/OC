const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = '/srv/reader/reader.db';

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Unknown Title',
      author TEXT DEFAULT 'Unknown Author',
      cover_path TEXT,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      total_chapters INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id TEXT NOT NULL,
      chapter_index INTEGER DEFAULT 0,
      progress REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tts_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id TEXT NOT NULL,
      chapter_index INTEGER NOT NULL,
      voice_id TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL',
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
  `);
}

// Books
function insertBook(id, { title, author, coverPath, filePath, fileSize, totalChapters }) {
  const stmt = getDb().prepare(`
    INSERT INTO books (id, title, author, cover_path, file_path, file_size, total_chapters)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, title, author, coverPath, filePath, fileSize, totalChapters);
}

function getBook(id) {
  return getDb().prepare(`
    SELECT b.*, 
      (SELECT chapter_index FROM bookmarks WHERE book_id = b.id ORDER BY updated_at DESC LIMIT 1) as last_chapter,
      (SELECT progress FROM bookmarks WHERE book_id = b.id ORDER BY updated_at DESC LIMIT 1) as last_progress
    FROM books b WHERE b.id = ?
  `).get(id);
}

function getAllBooks() {
  return getDb().prepare(`
    SELECT b.*,
      (SELECT chapter_index FROM bookmarks WHERE book_id = b.id ORDER BY updated_at DESC LIMIT 1) as last_chapter,
      (SELECT progress FROM bookmarks WHERE book_id = b.id ORDER BY updated_at DESC LIMIT 1) as last_progress
    FROM books b ORDER BY b.created_at DESC
  `).all();
}

function deleteBook(id) {
  getDb().prepare('DELETE FROM books WHERE id = ?').run(id);
}

// Bookmarks
function getBookmark(bookId) {
  return getDb().prepare(`
    SELECT * FROM bookmarks 
    WHERE book_id = ? 
    ORDER BY updated_at DESC 
    LIMIT 1
  `).get(bookId);
}

function upsertBookmark(bookId, { chapterIndex, progress }) {
  const existing = getDb().prepare('SELECT id FROM bookmarks WHERE book_id = ?').get(bookId);
  if (existing) {
    getDb().prepare(`
      UPDATE bookmarks 
      SET chapter_index = ?, progress = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE book_id = ?
    `).run(chapterIndex, progress, bookId);
  } else {
    getDb().prepare(`
      INSERT INTO bookmarks (book_id, chapter_index, progress) 
      VALUES (?, ?, ?)
    `).run(bookId, chapterIndex, progress);
  }
}

// TTS History
function logTtsPlay(bookId, chapterIndex, voiceId) {
  getDb().prepare(`
    INSERT INTO tts_history (book_id, chapter_index, voice_id) 
    VALUES (?, ?, ?)
  `).run(bookId, chapterIndex, voiceId);
}

module.exports = {
  getDb,
  insertBook,
  getBook,
  getAllBooks,
  deleteBook,
  getBookmark,
  upsertBookmark,
  logTtsPlay
};