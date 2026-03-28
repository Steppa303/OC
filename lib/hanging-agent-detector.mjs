/**
 * Hanging Agent Detector
 * 
 * Erkennt und behebt Agenten, die nicht korrekt beendet wurden
 */

import { getAgentActivities, logAgentEnd } from './agent-logger.mjs';

/**
 * Findet hängende Agenten und markiert sie als 'timeout'
 * @param {number} maxAgeMinutes - Maximales Alter in Minuten (default: 60)
 * @returns {Promise<Array>} Array von bereinigten Agenten
 */
export async function detectAndFixHangingAgents(maxAgeMinutes = 60) {
  try {
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    const now = Date.now();
    
    // Hole alle Agenten mit Status 'running' oder 'pending'
    const allAgents = await getAgentActivities(100, 0, null, true, false); // Kein Auto-Timeout
    
    const hangingAgents = [];
    
    for (const agent of allAgents) {
      if (agent.status === 'running' || agent.status === 'pending') {
        const startedAt = new Date(agent.started_at).getTime();
        const ageMs = now - startedAt;
        
        // Prüfe ob länger als maxAgeMinutes läuft
        if (ageMs > maxAgeMs) {
          hangingAgents.push({
            ...agent,
            ageMs,
            ageMinutes: Math.floor(ageMs / 60000)
          });
        }
      }
    }
    
    // Bereinige hängende Agenten
    const fixedAgents = [];
    
    for (const agent of hangingAgents) {
      await logAgentEnd(
        agent.session_key,
        'timeout',
        agent.ageMs,
        `Agent exceeded maximum age of ${maxAgeMinutes} minutes (was running for ${agent.ageMinutes} minutes)`
      );
      
      fixedAgents.push(agent);
      console.log(`🧹 Fixed hanging agent: ${agent.label} (${agent.session_key}) - Running for ${agent.ageMinutes} minutes`);
    }
    
    return fixedAgents;
    
  } catch (error) {
    console.error(`❌ Error detecting hanging agents: ${error.message}`);
    return [];
  }
}

/**
 * Startet einen Hintergrund-Service, der regelmäßig hängende Agenten bereinigt
 * @param {number} intervalMinutes - Intervall in Minuten (default: 30)
 * @param {number} maxAgeMinutes - Maximales Alter in Minuten (default: 60)
 * @returns {Object} {intervalId, stop: function to stop the interval}
 */
export function startHangingAgentDetection(intervalMinutes = 30, maxAgeMinutes = 60) {
  console.log(`🔍 Starting hanging agent detection every ${intervalMinutes} minutes (max age: ${maxAgeMinutes} minutes)`);
  
  const intervalId = setInterval(async () => {
    try {
      const fixed = await detectAndFixHangingAgents(maxAgeMinutes);
      if (fixed.length > 0) {
        console.log(`✅ Hanging agent detection completed: Fixed ${fixed.length} agents`);
        fixed.forEach(agent => {
          console.log(`   - ${agent.label}: ${agent.ageMinutes} minutes old`);
        });
      } else {
        console.log(`✅ Hanging agent detection completed: No hanging agents found`);
      }
    } catch (error) {
      console.error(`❌ Error in hanging agent detection: ${error.message}`);
    }
  }, intervalMinutes * 60 * 1000);
  
  return {
    intervalId,
    stop: () => {
      clearInterval(intervalId);
      console.log(`⏹️  Hanging agent detection stopped`);
    }
  };
}

/**
 * Manuelle Funktion zum Prüfen und Beheben aller hängenden Agenten
 * @returns {Promise<number>} Anzahl der behobenen Agenten
 */
export async function forceFixAllHangingAgents() {
  console.log('⚡ Forcing immediate fix of all hanging agents...');
  
  // Versuche Agenten älter als 30 Minuten zu beheben
  const fixed = await detectAndFixHangingAgents(30);
  
  console.log(`✅ Force fix completed: ${fixed.length} hanging agents fixed`);
  return fixed.length;
}

export default {
  detectAndFixHangingAgents,
  startHangingAgentDetection,
  forceFixAllHangingAgents
};