/**
 * Automatic Dashboard Cleanup System
 * 
 * Vollständige Lösung für das Dashboard Cleanup Problem:
 * - Automatisches Logging von Agent-Start/Ende
 * - Hintergrund-Bereinigung von hängenden Agenten
 * - Integration in den Haupt-Agenten-Workflow
 */

import { logAgentStart, logAgentEnd } from './agent-logger.mjs';
import { detectAndFixHangingAgents, startHangingAgentDetection } from './hanging-agent-detector.mjs';

// Map für aktive Sessions
const activeSessions = new Map();

/**
 * Startet einen Agenten mit automatischem Logging
 * 
 * Diese Funktion ersetzt den direkten Aufruf von logAgentStart
 * und trackt die Session für automatisches Cleanup
 * 
 * @param {Object} options - Agent-Optionen
 * @param {string} options.sessionKey - Eindeutiger Session-Key
 * @param {string} options.label - Agent-Label
 * @param {string} options.task - Aufgabenbeschreibung
 * @param {string} options.model - Verwendetes Model
 * @param {string} [options.parentSession] - Eltern-Session (optional)
 * @returns {Promise<void>}
 */
export async function startManagedAgent(options) {
  const { sessionKey, label, task, model, parentSession } = options;
  const startTime = Date.now();
  
  // Start loggen (task als prompt wenn kein separater)
  await logAgentStart(sessionKey, label, task, task, model, parentSession);
  
  // Session tracken
  activeSessions.set(sessionKey, {
    startTime,
    label,
    task,
    model,
    parentSession
  });
  
  console.log(`🚀 Started managed agent: ${label} (${sessionKey})`);
}

/**
 * Beendet einen Agenten mit automatischem Logging
 * 
 * Diese Funktion ersetzt den direkten Aufruf von logAgentEnd
 * und entfernt die Session aus dem Tracking
 * 
 * @param {string} sessionKey - Session-Key des Agenten
 * @param {string} status - 'done', 'failed', 'timeout'
 * @param {string} [errorMessage] - Fehlermeldung (optional)
 * @returns {Promise<void>}
 */
export async function completeManagedAgent(sessionKey, status = 'done', errorMessage = null) {
  const session = activeSessions.get(sessionKey);
  
  if (session) {
    const runtime = Date.now() - session.startTime;
    
    // Ende loggen
    await logAgentEnd(sessionKey, status, runtime, errorMessage);
    
    // Session aus Tracking entfernen
    activeSessions.delete(sessionKey);
    
    console.log(`✅ Completed managed agent: ${session.label} (${sessionKey}) - ${status} (${runtime}ms)`);
  } else {
    // Falls Session nicht getrackt, trotzdem loggen
    await logAgentEnd(sessionKey, status, 0, errorMessage);
    console.log(`⚠️  Completed untracked agent: ${sessionKey} - ${status}`);
  }
}

/**
 * Hilfsfunktion für try/catch Blöcke
 * Stellt sicher, dass Agenten immer korrekt beendet werden
 * 
 * @param {Function} agentFunction - Die Agent-Funktion
 * @param {string} sessionKey - Session-Key
 * @param {Function} errorHandler - Optionaler Fehler-Handler
 * @returns {*} Ergebnis der Agent-Funktion
 */
export async function withAutomaticCleanup(agentFunction, sessionKey, errorHandler = null) {
  try {
    const result = await agentFunction();
    await completeManagedAgent(sessionKey, 'done');
    return result;
  } catch (error) {
    const errorMessage = errorHandler ? await errorHandler(error) : error.message;
    await completeManagedAgent(sessionKey, 'failed', errorMessage);
    throw error;
  }
}

/**
 * Startet den Hintergrund-Cleanup-Service
 * 
 * @param {Object} options - Konfigurationsoptionen
 * @param {number} [options.intervalMinutes] - Intervall für Bereinigung (default: 30)
 * @param {number} [options.maxAgeMinutes] - Maximales Alter für Bereinigung (default: 60)
 * @param {boolean} [options.immediateCheck] - Sofortige Prüfung durchführen (default: true)
 * @returns {Object} Service-Objekt mit stop-Funktion
 */
export function startAutomaticCleanup(options = {}) {
  const {
    intervalMinutes = 30,
    maxAgeMinutes = 60,
    immediateCheck = true
  } = options;
  
  console.log(`🧹 Starting automatic dashboard cleanup...`);
  
  // Sofortige Prüfung
  if (immediateCheck) {
    console.log(`🔍 Performing immediate cleanup of hanging agents...`);
    detectAndFixHangingAgents(maxAgeMinutes)
      .then(fixed => {
        if (fixed.length > 0) {
          console.log(`✅ Immediate cleanup: Fixed ${fixed.length} hanging agents`);
        } else {
          console.log(`✅ Immediate cleanup: No hanging agents found`);
        }
      })
      .catch(err => console.error(`❌ Error in immediate cleanup: ${err.message}`));
  }
  
  // Hintergrund-Service starten
  const cleanupService = startHangingAgentDetection(intervalMinutes, maxAgeMinutes);
  
  return {
    ...cleanupService,
    /**
     * Stoppt den Cleanup-Service
     */
    stop: () => {
      console.log(`🛑 Stopping automatic dashboard cleanup...`);
      cleanupService.stop();
    },
    
    /**
     * Manuelle Bereinigung durchführen
     */
    runCleanup: async () => {
      console.log(`🔍 Manual cleanup triggered...`);
      const fixed = await detectAndFixHangingAgents(maxAgeMinutes);
      console.log(`✅ Manual cleanup: Fixed ${fixed.length} hanging agents`);
      return fixed;
    }
  };
}

/**
 * Gibt die Anzahl der aktuell getrackten Sessions zurück
 */
export function getActiveSessionCount() {
  return activeSessions.size;
}

/**
 * Gibt alle aktuell getrackten Sessions zurück
 */
export function getActiveSessions() {
  return Array.from(activeSessions.entries()).map(([key, value]) => ({
    sessionKey: key,
    ...value,
    runtime: Date.now() - value.startTime
  }));
}

/**
 * Beendet alle aktiven Sessions als 'timeout'
 * Nützlich beim Shutdown
 */
export async function timeoutAllActiveSessions(timeoutMessage = 'Session timed out due to system shutdown') {
  const sessionsToTimeout = Array.from(activeSessions.keys());
  
  for (const sessionKey of sessionsToTimeout) {
    await completeManagedAgent(sessionKey, 'timeout', timeoutMessage);
  }
  
  return sessionsToTimeout.length;
}

export default {
  startManagedAgent,
  completeManagedAgent,
  withAutomaticCleanup,
  startAutomaticCleanup,
  getActiveSessionCount,
  getActiveSessions,
  timeoutAllActiveSessions
};