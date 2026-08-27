import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { TextOverlay } from './components/TextOverlay';
import { Toolbar } from './components/Toolbar';
import { SessionList } from './components/SessionList';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSocket } from './hooks/useSocket';
import { useSession } from './hooks/useSession';

export default function App() {
  // State
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isThinking, setIsThinking] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [drawingCommands, setDrawingCommands] = useState<any[] | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [smoothingEnabled, setSmoothingEnabled] = useState(true);

  // Session management
  const {
    currentSession,
    sessions,
    loadSessions,
    loadSession,
    createSession,
    deleteSession,
    setCurrentSession
  } = useSession();

  // Socket handlers
  const handleThinking = useCallback(() => {
    setIsThinking(true);
  }, []);

  const handleResponse = useCallback((data: { text: string; drawing: any[] | null; interactionId: number }) => {
    setIsThinking(false);
    setAiText(data.text);
    if (data.drawing) {
      setDrawingCommands(data.drawing);
    }
  }, []);

  const handleError = useCallback((data: { message: string }) => {
    setIsThinking(false);
    setAiText(`Fehler: ${data.message}`);
  }, []);

  const handleSessionCreated = useCallback((data: { session: any }) => {
    setCurrentSession(data.session);
    loadSessions();
  }, [setCurrentSession, loadSessions]);

  const handleSessionHistory = useCallback((data: { session: any; interactions: any[] }) => {
    setCurrentSession(data.session);
    // TODO: Re-render previous interactions on canvas
  }, [setCurrentSession]);

  const handleSessionDeleted = useCallback((data: { sessionId: string }) => {
    loadSessions();
  }, [loadSessions]);

  // Socket connection
  const {
    sendStrokeComplete,
    sendSessionNew,
    sendSessionSwitch,
    sendSessionDelete
  } = useSocket({
    onThinking: handleThinking,
    onResponse: handleResponse,
    onError: handleError,
    onSessionCreated: handleSessionCreated,
    onSessionHistory: handleSessionHistory,
    onSessionDeleted: handleSessionDeleted
  });

  // Handle stroke completion
  const handleStrokeComplete = useCallback((canvasPng: string) => {
    if (!currentSession) {
      // Auto-create session if none exists
      createSession().then((session) => {
        if (session) {
          sendStrokeComplete(session.id, canvasPng);
        }
      });
      return;
    }
    sendStrokeComplete(currentSession.id, canvasPng);
  }, [currentSession, sendStrokeComplete, createSession]);

  // Handle new session
  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  // Handle session switch
  const handleSessionSwitch = useCallback((sessionId: string) => {
    loadSession(sessionId);
    sendSessionSwitch(sessionId);
    // Clear canvas for new session
    setDrawingCommands(null);
    setAiText(null);
  }, [loadSession, sendSessionSwitch]);

  // Handle session delete
  const handleSessionDelete = useCallback((sessionId: string) => {
    deleteSession(sessionId);
    sendSessionDelete(sessionId);
  }, [deleteSession, sendSessionDelete]);

  // Handle clear canvas
  const handleClear = useCallback(() => {
    if (canvasElement) {
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      }
    }
    setDrawingCommands(null);
    setAiText(null);
  }, [canvasElement]);

  // Canvas ready callback
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setCanvasElement(canvas);
  }, []);

  return (
    <ErrorBoundary>
    <div className="relative w-full h-full bg-white">
      {/* Canvas */}
      <Canvas
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        onStrokeComplete={handleStrokeComplete}
        drawingCommands={drawingCommands}
        onCanvasReady={handleCanvasReady}
        smoothingEnabled={smoothingEnabled}
      />

      {/* Text overlay */}
      <TextOverlay
        text={aiText}
        duration={8000}
        onDismiss={() => setAiText(null)}
      />

      {/* Toolbar */}
      <Toolbar
        sessionName={currentSession?.name || ''}
        onSessionClick={() => setShowSessionList(true)}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onWidthChange={setStrokeWidth}
        onClear={handleClear}
        onNewSession={handleNewSession}
        isThinking={isThinking}
        smoothingEnabled={smoothingEnabled}
        onSmoothingChange={setSmoothingEnabled}
      />

      {/* Session list modal */}
      {showSessionList && (
        <SessionList
          sessions={sessions}
          currentSessionId={currentSession?.id || null}
          onSelect={handleSessionSwitch}
          onDelete={handleSessionDelete}
          onNew={handleNewSession}
          onClose={() => setShowSessionList(false)}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}
