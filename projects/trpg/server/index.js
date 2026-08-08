import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import gameRoutes from './routes/game.js';
import worldRoutes from './routes/worlds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3800;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/game', gameRoutes);
app.use('/api/worlds', worldRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TRPG server running on http://localhost:${PORT}`);
});
