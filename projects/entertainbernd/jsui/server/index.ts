import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initAuth } from './auth.js';
import { searchRouter } from './routes/search.js';
import { downloadRouter } from './routes/download.js';
import { queueRouter } from './routes/queue.js';
import { initWebSocket } from './ws/queue.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/ws',
});

app.use(cors());
app.use(express.json());

// Auth middleware
const authMiddleware = initAuth(app);

// API routes
app.use('/api/search', authMiddleware, searchRouter);
app.use('/api/download', authMiddleware, downloadRouter);
app.use('/api/queue', authMiddleware, queueRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket
initWebSocket(io);

const PORT = 3010;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[EntertainBernd API] listening on port ${PORT}`);
});