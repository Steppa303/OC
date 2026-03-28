/**
 * Background Agent Cleaner
 * 
 * Diese Funktion läuft im Hintergrund und bereinigt hängende Agenten,
 * die nicht korrekt beendet wurden.
 */

import { getActiveAgents, logAgentEnd } from './agent-logger.mjs';

/**
 * Prüft auf hängende Agenten und markiert sie als timeout
 * @param {number} maxAgeMinutes - Maximales Alter in Minuten (default: 60)
 * @returns {Promise<number>} Anzahl der bereinigten Agenten
 */
export async function cleanupHungAgents(maxAgeMinutes = 60) {
  try {
    const maxAgeMs = maxAgeMinutes * 60 * 1000; // Minuten zu Millisekunden
    const now = Date.now();
    
    // Hole alle aktiven Agenten aus der DB
    const activeAgents = await getActiveAgents();
    
    let cleanedCount = 0;
    
    for (const agent of activeAgents) {
      // Prüfe ob der Agent älter als maxAgeMinutes ist
      const startedAt = new Date(agent.started_at).getTime();
      const ageMs = now - startedAt;
      
      if (ageMs > maxAgeMs) {
        // Markiere als timeout
        await logAgentEnd(
          agent.session_key,
          'timeout',
          ageMs,
          `Agent exceeded maximum age of ${maxAgeMinutes} minutes`
        );
        
        console.log(`🧹 Cleaned up hung agent: ${agent.session_key} (${agent.label}) - ${ageMs/1000}s old`);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
    
  } catch (error) {
    console.error(`❌ Error during hung agent cleanup: ${error.message}`);
    return 0;
  }
}

/**
 * Startet einen Hintergrund-Interval für regelmäßige Bereinigung
 * @param {number} intervalMinutes - Intervall in Minuten (default: 30)
 * @param {number} maxAgeMinutes - Maximales Alter in Minuten (default: 60)
 * @returns {Object} {intervalId, stop: function to stop the interval}
 */
export function startCleanupInterval(intervalMinutes = 30, maxAgeMinutes = 60) {
  console.log(`🔄 Starting background cleanup every ${intervalMinutes} minutes, cleaning agents older than ${maxAgeMinutes} minutes`);
  
  const intervalId = setInterval(async () => {
    try {
      const cleaned = await cleanupHungAgents(maxAgeMinutes);
      if (cleaned > 0) {
        console.log(`✅ Background cleanup completed: ${cleaned} agents cleaned up`);
      } else {
        console.log(`✅ Background cleanup completed: no hung agents found`);
      }
    } catch (error) {
      console.error(`❌ Error in background cleanup: ${error.message}`);
    }
  }, intervalMinutes * 60 * 1000);
  
  return {
    intervalId,
    stop: () => {
      clearInterval(intervalId);
      console.log(`⏹️  Background cleanup stopped`);
    }
  };
}

/**
 * Manuelle Bereinigungsfunktion
 * Entfernt alle Agenten mit einem bestimmten Status
 * @param {string} status - Status zum Löschen (z.B. 'timeout', 'failed')
 * @returns {Promise<number>} Anzahl der bereinigten Agenten
 */
export async function cleanupAgentsByStatus(status) {
  // Diese Funktion würde zusätzlichen SQL-Code benötigen
  // Da die aktuelle logAgentEnd Funktion nur den Status ändert, 
  // ist dies eine Ergänzung für zukünftige Erweiterungen
  
  console.warn(`⚠️  cleanupAgentsByStatus('${status}') - Not implemented in current logger`);
  return 0;
}

export default {
  cleanupHungAgents,
  startCleanupInterval,
  cleanupAgentsByStatus
};