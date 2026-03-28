/**
 * Spawn Subagent mit AUTOMATISCHEM Logging
 * 
 * Diese Funktion wrapper sessions_spawn und sorgt dafür dass:
 * 1. Agent VOR Spawn geloggt wird (start)
 * 2. Agent NACH Completion automatisch geloggt wird (end)
 * 
 * Usage:
 * ```javascript
 * import { spawnWithLogging } from './lib/spawn-with-logging.mjs';
 * 
 * const result = await spawnWithLogging({
 *   label: 'My Agent',
 *   task: 'Do something',
 *   model: 'qwen3-coder-next',
 *   mode: 'run'
 * });
 * ```
 */

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const API_BASE = 'http://localhost:3002/api';

/**
 * Agent starten loggen
 */
async function logAgentStart(sessionKey, label, task, prompt, model, parentSession) {
  try {
    await execAsync(`
      curl -s -X POST ${API_BASE}/agents/start \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify({
          sessionKey,
          label,
          task,
          prompt: prompt || task, // prompt = task wenn nicht separat
          model,
          parentSession
        })}'
    `);
    console.log(`✅ Agent start logged: ${label}`);
  } catch (error) {
    console.error(`❌ Failed to log agent start: ${error.message}`);
  }
}

/**
 * Agent ende loggen
 */
async function logAgentEnd(sessionKey, status = 'done', runtimeMs = 0, errorMessage = null) {
  try {
    await execAsync(`
      curl -s -X POST ${API_BASE}/agents/end \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify({
          sessionKey,
          status,
          runtimeMs,
          error_message: errorMessage
        })}'
    `);
    console.log(`✅ Agent end logged: ${sessionKey} (${status})`);
  } catch (error) {
    console.error(`❌ Failed to log agent end: ${error.message}`);
  }
}

/**
 * Subagent spawnen mit automatischem Logging
 * 
 * @param {Object} options - sessions_spawn options
 * @param {string} options.label - Agent Label
 * @param {string} options.task - Task Beschreibung
 * @param {string} options.model - Model (z.B. qwen3-coder-next)
 * @param {string} options.mode - Mode (run/session)
 * @param {string} options.runtime - Runtime (subagent/acp)
 * @returns {Promise<Object>} sessions_spawn result
 */
export async function spawnWithLogging(options) {
  const startTime = Date.now();
  const parentSession = 'agent:main:telegram:direct:1400987471';
  
  // Session Key generieren (eindeutig)
  const sessionKey = `agent:main:subagent:${options.label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  
  // 1. Agent start loggen (task als prompt wenn kein separater)
  await logAgentStart(sessionKey, options.label, options.task, options.task, options.model, parentSession);
  
  try {
    // 2. Agent spawnen (HIER MUSS sessions_spawn AUFGERUFEN WERDEN!)
    // ACHTUNG: sessions_spawn ist eine Tool-Funktion die hier nicht direkt verfügbar ist
    // Diese Funktion muss vom Main Agent aufgerufen werden!
    
    console.log(`⚠️ spawnWithLogging: sessions_spawn muss manuell aufgerufen werden!`);
    console.log(`📝 Session Key: ${sessionKey}`);
    
    // Return session info for manual spawn
    return {
      sessionKey,
      startTime,
      label: options.label,
      task: options.task,
      model: options.model,
      
      // Helper function to log end after completion
      logEnd: async (status = 'done', errorMessage = null) => {
        const runtimeMs = Date.now() - startTime;
        await logAgentEnd(sessionKey, status, runtimeMs, errorMessage);
      }
    };
  } catch (error) {
    // 3. Bei Fehler loggen
    const runtimeMs = Date.now() - startTime;
    await logAgentEnd(sessionKey, 'failed', runtimeMs, error.message);
    throw error;
  }
}

export default {
  spawnWithLogging,
  logAgentStart,
  logAgentEnd
};
