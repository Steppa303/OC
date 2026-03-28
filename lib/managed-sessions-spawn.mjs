/**
 * Managed Sessions Spawn
 * 
 * Wrapper für sessions_spawn mit automatischem Logging und Management.
 * Dies stellt sicher, dass alle Agents korrekt geloggt werden.
 */

import { logAgentStart } from './agent-logger.mjs';
import { trackSession, completeSession } from './auto-complete-logger.mjs';

/**
 * Managed Version von sessions_spawn mit automatischem Logging
 * 
 * @param {Object} options - sessions_spawn options
 * @param {string} options.label - Agent Label
 * @param {string} options.task - Aufgabenbeschreibung  
 * @param {string} options.model - Model
 * @param {string} options.runtime - 'subagent' oder 'acp'
 * @param {string} options.mode - 'run' oder 'session'
 * @param {string} options.parentSession - Optional parent session key
 * @returns {Promise<Object>} sessions_spawn result mit zusätzlichem managedSessionKey
 */
export async function managedSessionsSpawn(options) {
  // Generiere einen eindeutigen Session-Key für dieses Managed-Session
  const managedSessionKey = `managed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    // 1. Start logging (task als prompt wenn kein separater)
    await logAgentStart(
      managedSessionKey,
      options.label || 'Managed Agent',
      options.task || 'No task specified',
      options.task || 'No task specified', // prompt = task
      options.model || 'unknown',
      options.parentSession || null
    );
    
    // 2. Session tracking starten
    trackSession(managedSessionKey, startTime);
    
    // 3. Originale sessions_spawn aufrufen
    // Da sessions_spawn eine Tool-Funktion ist, müssen wir sie separat aufrufen
    // Aber wir geben den managedSessionKey zurück, damit er später verwendet werden kann
    
    console.log(`🚀 Starting managed session: ${managedSessionKey} - ${options.label || 'Unnamed'}`);
    
    return {
      managedSessionKey,
      startTime,
      originalOptions: options,
      status: 'started'
    };
    
  } catch (error) {
    // Bei Fehler trotzdem loggen (task als prompt)
    await logAgentStart(
      managedSessionKey,
      options.label || 'Managed Agent',
      `FAILED TO START: ${options.task || 'No task specified'}`,
      `FAILED TO START: ${options.task || 'No task specified'}`, // prompt = task
      options.model || 'unknown',
      options.parentSession || null
    );
    
    completeSession(managedSessionKey, 'failed', error.message);
    
    throw error;
  }
}

/**
 * Hilfsfunktion um eine Session nach Abschluss zu markieren
 * 
 * @param {string} managedSessionKey - Der von managedSessionsSpawn zurückgegebene Key
 * @param {string} status - 'done', 'failed', 'timeout'
 * @param {string} error - Optionaler Fehler
 */
export async function markSessionComplete(managedSessionKey, status = 'done', error = null) {
  try {
    completeSession(managedSessionKey, status, error);
  } catch (logError) {
    console.error(`Failed to log session completion: ${logError.message}`);
  }
}

/**
 * Hilfsfunktion für try/catch Blöcke
 * 
 * @param {Function} spawnFn - Funktion die sessions_spawn aufruft
 * @param {string} managedSessionKey - Der Managed Session Key
 * @returns {*} Ergebnis der spawnFn
 */
export async function withManagedSession(spawnFn, managedSessionKey) {
  try {
    const result = await spawnFn();
    await markSessionComplete(managedSessionKey, 'done');
    return result;
  } catch (error) {
    await markSessionComplete(managedSessionKey, 'failed', error.message);
    throw error;
  }
}

export default {
  managedSessionsSpawn,
  markSessionComplete,
  withManagedSession
};