import { spawnAgent } from './spawn-agent.mjs';

/**
 * Dashboard Automation Bundle
 * 
 * Zentrale Import-Datei für alle automatischen Dashboard-Funktionen
 * 
 * Enthält:
 * - Moderner Agent-Spawn mit Task/Prompt-Trennung (via spawnAgent)
 * - Auto-Complete Logger
 * - Background Cleaner
 * - Heartbeat Support
 */

// Neue Spawn-Funktionen (ersetzt die alten Wrapper)
export { 
  spawnAgent
};

// Auto-Complete Logger (unverändert)
export { 
  trackSession, 
  completeSession, 
  getSessionRuntime, 
  getTrackedSessions, 
  timeoutAllSessions 
} from './auto-complete-logger.mjs';

// Background Cleaner (unverändert)
export { 
  cleanupHungAgents, 
  startCleanupInterval, 
  cleanupAgentsByStatus 
} from './background-cleaner.mjs';

// Basis-Logger (unverändert)
export { 
  logAgentStart, 
  logAgentEnd, 
  getAgentActivities, 
  getActiveAgents 
} from './agent-logger.mjs';

/**
 * Komplette Initialisierung aller Dashboard-Funktionen
 * 
 * @param {Object} config - Konfigurationsoptionen
 * @param {boolean} config.enableBackgroundCleanup - Hintergrundbereinigung aktivieren
 * @param {number} config.cleanupInterval - Bereinigungsintervall in Minuten
 * @param {number} config.maxAgentAge - Maximales Agent-Alter in Minuten
 * @returns {Object} Dienste mit Stop-Funktionen
 */
export function initializeDashboardAutomation(config = {}) {
  const services = {};
  
  // Standardwerte
  const {
    enableBackgroundCleanup = true,
    cleanupInterval = 30,  // 30 Minuten
    maxAgentAge = 60       // 60 Minuten
  } = config;
  
  console.log('🚀 Initializing Dashboard Automation...');
  
  // Hintergrundbereinigung starten
  if (enableBackgroundCleanup) {
    services.backgroundCleanup = startCleanupInterval(cleanupInterval, maxAgentAge);
    console.log(`✅ Background cleanup started (every ${cleanupInterval}min, max age ${maxAgentAge}min)`);
  }
  
  // Weitere Dienste könnten hier hinzugefügt werden
  
  return {
    ...services,
    /**
     * Stoppt alle gestarteten Dienste
     */
    stopAll: () => {
      console.log('🛑 Stopping Dashboard Automation services...');
      
      if (services.backgroundCleanup) {
        services.backgroundCleanup.stop();
        console.log('✅ Background cleanup stopped');
      }
      
      console.log('🛑 All Dashboard Automation services stopped');
    }
  };
}

export default {
  // Exportierte Funktionen
  spawnAgent,
  cleanupHungAgents,
  startCleanupInterval,
  cleanupAgentsByStatus,
  logAgentStart,
  logAgentEnd,
  getAgentActivities,
  getActiveAgents,
  initializeDashboardAutomation
};