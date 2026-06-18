require('dotenv').config(); // Load environment variables from .env file if it exists

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');

// Import modules
const db = require('./db');
const epubParser = require('./epub-parser');
const ttsService = require('./tts-service');

// Ensure directories exist
const EPUB_STORAGE_DIR = '/srv/reader/epubs/';
const UPLOADS_DIR = path.join(EPUB_STORAGE_DIR); // Make sure this is the same as in epub-parser.js
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure directories exist at startup
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR);
  }
  // Initialize DB and schema
  db.getDb(); 
} catch (err) {
  console.error('Failed to initialize directories or database:', err);
  process.exit(1); // Exit if essential setup fails
}

// Set ElevenLabs API Key from environment or config file
const configFile = JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json', 'utf8'));
const elevenLabsApiKey = configFile.messages?.tts?.providers?.elevenlabs?.apiKey;
if (elevenLabsApiKey) {
  ttsService.setApiKey(elevenLabsApiKey);
} else {
  console.error("ElevenLabs API key not found in /root/.openclaw/openclaw.json. TTS will not function.");
}

const app = express();
const port = process.env.PORT || 3003;

// Middleware
app.use(morgan('combined')); // HTTP request logger
app.use(cors({
  exposedHeaders: ['Content-Disposition'], // Expose Content-Disposition for file downloads/metadata
  origin: (origin, callback) => {
    // Allow requests from localhost for development and the production domain
    if (origin === 'http://localhost:3000' || origin === 'http://localhost:3003' || origin === 'http://reader.steppa.online' || origin === 'https://reader.steppa.online' || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json({ limit: '50mb' })); // For parsing JSON bodies, increased limit
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // For parsing URL-encoded bodies

// Multer setup for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = uuidv4();
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- API Routes ---

// POST /api/upload - Upload EPUB
app.post('/api/upload', upload.single('epub'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No EPUB file uploaded.' });
  }
  
  const filePath = req.file.path;
  const originalFilename = req.file.originalname;
  
  try {
    // Parse EPUB and extract metadata
    const parsedEpub = await epubParser.saveEpub(fs.readFileSync(filePath), originalFilename);
    
    // Save book metadata to DB
    db.insertBook(parsedEpub.id, {
      title: parsedEpub.title,
      author: parsedEpub.author,
      coverPath: parsedEpub.coverDataUrl, // Store as data URL
      filePath: parsedEpub.filePath,
      fileSize: parsedEpub.fileSize,
      totalChapters: parsedEpub.totalChapters,
    });
    
    res.status(201).json({
      id: parsedEpub.id,
      message: 'EPUB uploaded and processed successfully.',
      book: {
        id: parsedEpub.id,
        title: parsedEpub.title,
        author: parsedEpub.author,
        coverPath: parsedEpub.coverDataUrl,
        filePath: parsedEpub.filePath,
        fileSize: parsedEpub.fileSize,
        totalChapters: parsedEpub.totalChapters
      }
    });
  } catch (error) {
    console.error('Error processing EPUB upload:', error);
    // Attempt to clean up the uploaded file if parsing failed
    try {
      await fsp.unlink(filePath);
    } catch (unlinkError) {
      console.error('Error cleaning up failed upload file:', unlinkError);
    }
    res.status(500).json({ error: 'Failed to process EPUB file.', details: error.message });
  }
});

// GET /api/books - List all books
app.get('/api/books', async (req, res) => {
  try {
    const books = db.getAllBooks();
    res.json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to retrieve book list.' });
  }
});

// GET /api/books/:id - Get book details + last bookmark
app.get('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const book = db.getBook(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    res.json(book);
  } catch (error) {
    console.error(`Error fetching book details for ${id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve book details.' });
  }
});

// GET /api/books/:id/content - Get book content (chapters)
app.get('/api/books/:id/content', async (req, res) => {
  const { id } = req.params;
  try {
    const book = db.getBook(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    
    // Re-parse EPUB to get chapter text
    const fullEpubData = epubParser.parseEpub(book.file_path);

    if (!fullEpubData || !fullEpubData.chapters) {
      throw new Error('Could not parse chapter data from EPUB.');
    }
    
    res.json({ 
      id: book.id, 
      title: book.title,
      chapters: fullEpubData.chapters.map(c => ({ index: c.index, title: c.title, text: c.text })) 
    });
    
  } catch (error) {
    console.error(`Error fetching content for book ${id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve book content.', details: error.message });
  }
});

// POST /api/books/:id/tts - Start TTS for a chapter
app.post('/api/books/:id/tts', async (req, res) => {
  const { id } = req.params;
  const { chapterIndex, voiceId = 'EXAVITQu4vr4xnSDxMaL' } = req.body;
  
  if (chapterIndex === undefined || chapterIndex === null) {
    return res.status(400).json({ error: 'chapterIndex is required.' });
  }

  try {
    const book = db.getBook(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    // Fetch chapter text - Ensure epubParser can get text by index
    let chapterText;
    try {
      chapterText = await epubParser.getChapterText(book.file_path, chapterIndex);
    } catch (e) {
      return res.status(404).json({ error: `Kapitel ${chapterIndex + 1} nicht gefunden.` });
    }
    
    // If chapter has no text, try to find the next chapter that does
    if (!chapterText || !chapterText.trim()) {
      const parsed = epubParser.parseEpub(book.file_path);
      const fallback = parsed.chapters.find(c => c.index > chapterIndex && c.text && c.text.trim().length > 20);
      if (fallback) {
        chapterText = fallback.text;
      } else {
        return res.status(404).json({ error: `Kapitel ${chapterIndex + 1} enthält keinen lesbaren Text.` });
      }
    }

    // Log TTS play event
    db.logTtsPlay(id, chapterIndex, voiceId);
    
    // Set headers for streaming audio
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no'); // Important for Nginx to stream without buffering

    const voiceSettings = {
      stability: 0.3,
      similarity_boost: 0.7
    };

    const audioStream = await ttsService.streamTextToSpeech(chapterText, voiceId, voiceSettings);

    // Pipe the audio stream directly to the response
    audioStream.pipe(res);

    audioStream.on('error', (err) => {
      console.error(`Error piping TTS stream for book ${id}, chapter ${chapterIndex}:`, err);
      if (!res.headersSent) {
        res.status(500).send('Error processing TTS stream.');
      }
    });

    res.on('error', (err) => {
      console.error(`Error on response stream for book ${id}, chapter ${chapterIndex}:`, err);
    });

    res.on('finish', () => {
      console.log(`TTS stream finished for book ${id}, chapter ${chapterIndex}.`);
    });
    
  } catch (error) {
    console.error(`Error starting TTS for book ${id}, chapter ${chapterIndex}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start TTS.', details: error.message });
    }
  }
});


// GET /api/bookmarks/:id - Get bookmark for a book
app.get('/api/bookmarks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const bookmark = db.getBookmark(id);
    if (!bookmark) {
      return res.status(404).json({ error: 'Bookmark not found for this book.' });
    }
    res.json(bookmark);
  } catch (error) {
    console.error(`Error fetching bookmark for book ${id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve bookmark.' });
  }
});

// POST /api/bookmarks/:id - Set bookmark for a book
app.post('/api/bookmarks/:id', async (req, res) => {
  const { id } = req.params;
  const { chapterIndex, progress } = req.body;
  
  if (chapterIndex === undefined || progress === undefined) {
    return res.status(400).json({ error: 'chapterIndex and progress are required.' });
  }

  try {
    db.upsertBookmark(id, { chapterIndex, progress });
    res.status(200).json({ message: 'Bookmark saved successfully.' });
  } catch (error) {
    console.error(`Error saving bookmark for book ${id}:`, error);
    res.status(500).json({ error: 'Failed to save bookmark.' });
  }
});

// DELETE /api/books/:id - Delete a book
app.delete('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const book = db.getBook(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    
    // Delete the EPUB file from storage
    await fsp.unlink(book.file_path);
    
    // Delete the book record from the DB (this will cascade delete bookmarks and TTS history)
    db.deleteBook(id);
    
    res.status(200).json({ message: 'Book deleted successfully.' });
  } catch (error) {
    console.error(`Error deleting book ${id}:`, error);
    res.status(500).json({ error: 'Failed to delete book.', details: error.message });
  }
});

// --- Static File Serving for Frontend ---
// Serve static files from the 'public' directory
app.use(express.static(PUBLIC_DIR));

// Catch-all route for SPA routing (if using client-side routing)
// This should generally serve index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.stack);
  
  // Handle CORS errors specifically
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation.', details: err.message });
  }

  // Generic error response
  res.status(err.status || 500).json({
    error: 'An unexpected error occurred.',
    details: err.message || 'Internal Server Error'
  });
});


// Start the server
app.listen(port, () => {
  console.log(`Reader App backend server listening on port ${port}`);
});