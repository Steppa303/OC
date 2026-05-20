/**
 * Auto-Complete Logger
 * 
 * Diese Funktion sorgt dafür, dass alle Agenten automatisch
 * geloggt werden, wenn sie fertig sind - egal ob erfolgreich oder fehlerhaft.
 */

import { logAgentEnd } from './agent-logger.mjs';

// Map für aktive Sessions, die geloggt werden sollen
const activeSessions = new Map();

/**
 * Startet das Tracking einer Session für automatisches Logging
 * @param {string} sessionKey - Die Session-ID
 * @param {number} startTime - Startzeitpunkt (Date.now())
 */
export function trackSession(sessionKey, startTime) {
  activeSessions.set(sessionKey, {
    startTime,
    trackedAt: Date.now()
  });
  console.log(`🎯 Started tracking session: ${sessionKey}`);
}

/**
 * Beendet das Tracking einer Session und loggt das Ende
 * @param {string} sessionKey - Die Session-ID
 * @param {string} status - 'done', 'failed', 'timeout'
 * @param {string} error - Optionaler Fehler
 */
export function completeSession(sessionKey, status = 'done', error = null) {
  const sessionData = activeSessions.get(sessionKey);
  
  if (sessionData) {
    const runtime = Date.now() - sessionData.startTime;
    
    logAgentEnd(sessionKey, status, runtime, error);
    activeSessions.delete(sessionKey);
    
    console.log(`✅ Completed session: ${sessionKey} - ${status} (${runtime}ms)`);
  } else {
    // Falls die Session nicht getrackt wurde, trotzdem loggen
    logAgentEnd(sessionKey, status, 0, error);
    console.log(`⚠️  Completed untracked session: ${sessionKey} - ${status}`);
  }
}

/**
 * Berechnet die Laufzeit für eine aktive Session
 * @param {string} sessionKey - Die Session-ID
 * @returns {number} Laufzeit in ms oder null
 */
export function getSessionRuntime(sessionKey) {
  const sessionData = activeSessions.get(sessionKey);
  if (sessionData) {
    return Date.now() - sessionData.startTime;
  }
  return null;
}

/**
 * Gibt alle aktiven Sessions zurück
 * @returns {Array} Array von Session-Keys
 */
export function getTrackedSessions() {
  return Array.from(activeSessions.keys());
}

/**
 * Beendet alle aktiven Sessions als 'timeout'
 */
export async function timeoutAllSessions(timeoutMs = 3600000) { // 1 hour default
  const now = Date.now();
  const sessionsToTimeout = [];
  
  for (const [sessionKey, sessionData] of activeSessions.entries()) {
    if ((now - sessionData.startTime) > timeoutMs) {
      sessionsToTimeout.push(sessionKey);
    }
  }
  
  for (const sessionKey of sessionsToTimeout) {
    completeSession(sessionKey, 'timeout', `Session timed out after ${(Date.now() - activeSessions.get(sessionKey).startTime)/1000}s`);
  }
  
  return sessionsToTimeout.length;
}

export default {
  trackSession,
  completeSession,
  getSessionRuntime,
  getTrackedSessions,
  timeoutAllSessions
};