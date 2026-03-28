/**
 * ⚠️  DEPRECATED - NICHT MEHR VERWENDEN! ⚠️  
 * 
 * Diese Datei wird nicht mehr gewartet und enthält bekannte Bugs:
 * - ❌ task wird als prompt verwendet (Task/Prompt immer identisch!)
 * - ❌ Kein Heartbeat Support
 * - ❌ Inkonsistente Logging-Praxis
 * 
 * @deprecated Verwende stattdessen: lib/spawn-agent.mjs
 * @see {@link ../../README.md#spawnagent-options} für Migration Guide
 * @see {@link ../STOLPERSTEINE.md#11-zu-viele-wrapper} für Details
 * 
 * ---
 * 
 * Auto-Logging Wrapper für sessions_spawn (VERALTET)
 * 
 * @example
 * // ❌ ALT (deprecated):
 * import { autoLogSpawn } from './auto-log-spawn.mjs';
 * 
 * // ✅ NEU (verwenden):
 * import { spawnAgent } from './spawn-agent.mjs';
 * await spawnAgent({ label: '...', task: '...', prompt: '...' });
 */

import { logAgentStart, logAgentEnd } from './agent-logger.mjs';

/**
 * Session-Tracker für aktive Agents
 */
const activeSessions = new Map();

/**
 * Spawned einen Agent mit automatischem Logging.
 * 
 * @param {Object} options - sessions_spawn options
 * @param {string} options.label - Agent Label
 * @param {string} options.task - Aufgabe
 * @param {string} options.model - Model
 * @param {string} options.runtime - "subagent" oder "acp"
 * @param {string} options.mode - "run" oder "session"
 * @returns {Promise<{sessionKey: string, startTime: number}>}
 */
export async function autoLogSpawn(options) {
  const sessionKey = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  // Start loggen (task als prompt verwenden, wenn kein separater Prompt)
  await logAgentStart(
    sessionKey,
    options.label || 'Unnamed Agent',
    options.task || 'No task',
    options.task || 'No task', // prompt = task wenn kein separater Prompt
    options.model || 'unknown'
  );
  
  // Session tracken
  activeSessions.set(sessionKey, {
    startTime,
    label: options.label,
    task: options.task,
    model: options.model
  });
  
  console.log(`📝 Agent started: ${options.label} (${sessionKey})`);
  
  return { sessionKey, startTime };
}

/**
 * Loggt Agent-Ende nach Completion.
 * 
 * @param {string} sessionKey - Vom autoLogSpawn
 * @param {string} status - 'done', 'failed', 'timeout'
 * @param {string|null} error - Fehlermeldung (optional)
 */
export async function autoLogEnd(sessionKey, status = 'done', error = null) {
  const session = activeSessions.get(sessionKey);
  const runtime = session ? Date.now() - session.startTime : 0;
  
  await logAgentEnd(sessionKey, status, runtime, error);
  activeSessions.delete(sessionKey);
  
  console.log(`📝 Agent ended: ${sessionKey} - ${status} (${runtime}ms)`);
}

/**
 * Helper für Error-Fälle.
 * 
 * @param {string} sessionKey - Vom autoLogSpawn
 * @param {Error} error - Error object
 */
export async function autoLogError(sessionKey, error) {
  await autoLogEnd(sessionKey, 'failed', error?.message || 'Unknown error');
}

export default {
  autoLogSpawn,
  autoLogEnd,
  autoLogError,
  activeSessions
};
