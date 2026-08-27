const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const ai = require('./ai');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle new session creation
    socket.on('session:new', (data = {}) => {
      try {
        const sessionId = uuidv4();
        const name = data.name || `Session ${new Date().toLocaleString('de-DE')}`;
        const session = db.createSession(sessionId, name);
        
        socket.emit('session:created', { session });
        console.log(`Session created: ${sessionId}`);
      } catch (error) {
        console.error('Error creating session:', error);
        socket.emit('ai:error', { message: 'Fehler beim Erstellen der Session.' });
      }
    });

    // Handle session switch
    socket.on('session:switch', (data) => {
      try {
        const { sessionId } = data;
        const session = db.getSession(sessionId);
        
        if (!session) {
          socket.emit('ai:error', { message: 'Session nicht gefunden.' });
          return;
        }

        const interactions = db.getInteractions(sessionId);
        socket.emit('session:history', { session, interactions });
        console.log(`Session switched: ${sessionId}`);
      } catch (error) {
        console.error('Error switching session:', error);
        socket.emit('ai:error', { message: 'Fehler beim Laden der Session.' });
      }
    });

    // Handle session deletion
    socket.on('session:delete', (data) => {
      try {
        const { sessionId } = data;
        db.deleteSession(sessionId);
        socket.emit('session:deleted', { sessionId });
        console.log(`Session deleted: ${sessionId}`);
      } catch (error) {
        console.error('Error deleting session:', error);
        socket.emit('ai:error', { message: 'Fehler beim Löschen der Session.' });
      }
    });

    // Handle stroke completion (main AI interaction)
    socket.on('stroke:complete', async (data) => {
      try {
        const { sessionId, canvasPng } = data;

        if (!sessionId || !canvasPng) {
          socket.emit('ai:error', { message: 'Ungültige Daten: sessionId und canvasPng erforderlich.' });
          return;
        }

        // Verify session exists
        const session = db.getSession(sessionId);
        if (!session) {
          socket.emit('ai:error', { message: 'Session nicht gefunden. Bitte erstelle eine neue Session.' });
          return;
        }

        // Emit thinking state
        socket.emit('ai:thinking', {});

        // Get previous interactions for context
        const previousInteractions = db.getInteractions(sessionId);

        // Analyze canvas with AI
        const aiResponse = await ai.analyzeCanvas(canvasPng, previousInteractions);

        // Save interaction to database
        const interactionId = db.addInteraction(
          sessionId,
          canvasPng,
          aiResponse.text,
          aiResponse.drawing ? JSON.stringify(aiResponse.drawing) : null
        );

        // Send response back to client
        socket.emit('ai:response', {
          text: aiResponse.text,
          drawing: aiResponse.drawing,
          interactionId
        });

        console.log(`AI response sent for session ${sessionId}`);
      } catch (error) {
        console.error('Error processing stroke:', error);
        socket.emit('ai:error', { message: 'Fehler bei der KI-Analyse. Versuche es nochmal!' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = { setupSocketHandlers };
