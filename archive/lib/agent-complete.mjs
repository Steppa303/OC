/**
 * Agent Complete Helper
 * 
 * Diese Function wird Agents beim Spawn mitgegeben damit sie
 * ihren Status SELBST updaten können wenn sie fertig sind.
 * 
 * Usage im Agent:
 * ```javascript
 * import { completeAgent } from './lib/agent-complete.mjs';
 * 
 * // Am Ende der Task:
 * await completeAgent('done');
 * 
 * // Bei Fehler:
 * await completeAgent('failed', 'Error message');
 * ```
 */

const API_BASE = 'http://localhost:3002/api';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Hilfsfunktion für Delay
 * @param {number} ms - Millisekunden
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Agent Status updaten mit Retry-Logik
 * 
 * @param {string} sessionKey - Session Key des Agents
 * @param {string} status - Status (done, failed, timeout)
 * @param {number} startTime - Startzeit in ms (Date.now())
 * @param {string|null} errorMessage - Fehlermeldung (optional)
 */
export async function completeAgent(sessionKey, status, startTime, errorMessage = null) {
  const runtimeMs = Date.now() - startTime;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/agents/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionKey: sessionKey,
          status: status,
          runtimeMs: runtimeMs,
          error_message: errorMessage
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Agent completed: ${sessionKey} (${status}, ${runtimeMs}ms) - Attempt ${attempt}/${MAX_RETRIES}`);
        return result;
      } else {
        console.error(`❌ Failed to complete agent: ${result.error} - Attempt ${attempt}/${MAX_RETRIES}`);
        if (attempt === MAX_RETRIES) {
          console.error(`❌ Final failure after ${MAX_RETRIES} attempts`);
          return result;
        }
      }
    } catch (error) {
      console.error(`❌ Error completing agent (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);
      if (attempt === MAX_RETRIES) {
        console.error(`❌ Final failure after ${MAX_RETRIES} attempts`);
        throw error;
      }
      // Warte vor nächtem Versuch
      await delay(RETRY_DELAY_MS * attempt); // Exponential Backoff
    }
  }
}

/**
 * Helper der eine completeAgent Function für einen spezifischen Agent erstellt
 * 
 * @param {string} sessionKey - Session Key des Agents
 * @param {number} startTime - Startzeit in ms (Date.now())
 * @returns {Function} completeAgent Function
 */
export function createCompleteAgent(sessionKey, startTime) {
  return async (status = 'done', errorMessage = null) => {
    return await completeAgent(sessionKey, status, startTime, errorMessage);
  };
}

export default {
  completeAgent,
  createCompleteAgent
};
