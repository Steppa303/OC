/**
 * EntertainBernd Mini App — Express/Node.js API Server
 * Port 3010, CommonJS
 */
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const { initAuth } = require('./auth');
const searchRouter = require('./routes/search');
const downloadRouter = require('./routes/download');
const queueRouter = require('./routes/queue');
const { initWebSocket } = require('./ws/queue');

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/ws',
  transports: ['websocket', 'polling'],
});

// Global middleware
app.use(cors());
app.use(express.json());

// Auth routes + middleware
const authMiddleware = initAuth(app);

// Protected API routes (nur Download braucht Auth)
app.use('/api/search', searchRouter);
app.use('/api/queue', queueRouter);
app.use('/api/download', authMiddleware, downloadRouter);

// Health check (unauthenticated)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// WebSocket
initWebSocket(io);

const PORT = process.env.PORT || 3010;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[EntertainBernd API] listening on port ${PORT}`);
});
