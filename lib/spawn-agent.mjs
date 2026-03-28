/**
 * ⚠️  ACHTUNG: Diese Funktion BENÖTIGT sessions_spawn Tool!
 * 
 * spawnAgent() kann NUR in Umgebungen verwendet werden wo sessions_spawn verfügbar ist:
 * - OpenClaw Main Agent (via Tool-System)
 * - Subagent Sessions (via Vererbung)
 * 
 * NICHT verwendbar in:
 * - Node.js Scripts (ohne Tool-System)
 * - Externen Prozessen
 * 
 * @param {Object} options
 * @param {string} options.label - Agent Name
 * @param {string} options.task - Kurze Zusammenfassung (~80 Zeichen)
 * @param {string} options.prompt - Vollständiger Prompt (optional, default = task)
 * @param {string} options.model - Model Name
 * @param {string} options.runtime - 'subagent' oder 'acp'
 * @param {string} options.mode - 'run' oder 'session'
 * @param {number} options.heartbeatInterval - Heartbeat Intervall in ms (default: 30000)
 * @param {boolean} options.autoEnd - Bei Completion automatisch beenden (default: true)
 * @returns {Promise<{sessionKey: string, waitForCompletion: Function, cancelHeartbeat: Function, cleanup: Function}>}
 */
export async function spawnAgent(options) {
  // sessions_spawn Verfügbarkeit prüfen
  if (typeof sessions_spawn !== 'function') {
    throw new Error('sessions_spawn ist nicht verfügbar! Diese Funktion kann nur in OpenClaw Sessions verwendet werden.');
  }

  const {
    label,
    task,
    prompt,
    model,
    runtime = 'subagent',
    mode = 'run',
    heartbeatInterval = 30000,
    autoEnd = true
  } = options;

  // Input validation
  if (!label || !task) {
    throw new Error('label and task are required');
  }

  if (!['subagent', 'acp'].includes(runtime)) {
    throw new Error('runtime must be "subagent" or "acp"');
  }

  if (!['run', 'session'].includes(mode)) {
    throw new Error('mode must be "run" or "session"');
  }

  // Task und Prompt Handling gemäß Anforderungen
  let processedTask = task;
  let processedPrompt = prompt || task;

  // Task auf 80 Zeichen begrenzen falls Prompt angegeben ist
  if (prompt) {
    processedTask = task.length > 80 ? task.substring(0, 77) + '...' : task;
  }

  // Startzeit für Laufzeitberechnung
  const startTime = Date.now();
  
  // Session Key wird vom System generiert
  let sessionKey = null;
  let heartbeatIntervalId = null;

  try {
    // Start logging
    console.log(`[spawn-agent] Starting agent: ${label}`, {
      task: processedTask,
      hasCustomPrompt: !!prompt,
      model,
      runtime,
      mode
    });

    // Agent spawnen
    const spawnResult = await sessions_spawn({
      label,
      task: processedTask,
      model,
      runtime,
      mode,
      ...(runtime === 'acp' && options.agentId ? { agentId: options.agentId } : {}),
      ...(options.thread !== undefined ? { thread: options.thread } : {}),
      ...(options.timeoutSeconds !== undefined ? { timeoutSeconds: options.timeoutSeconds } : {}),
      ...(options.attachments !== undefined ? { attachments: options.attachments } : {})
    });

    sessionKey = spawnResult.sessionKey || spawnResult.childSessionKey;

    if (!sessionKey) {
      throw new Error('sessions_spawn returned no sessionKey');
    }

    // Log start event
    await logAgentStart(sessionKey, processedTask, processedPrompt);

    // Heartbeat-Loop starten falls aktiviert
    if (heartbeatInterval > 0) {
      heartbeatIntervalId = setInterval(async () => {
        try {
          // Heartbeat an API senden
          await fetch('http://localhost:3002/api/agents/' + sessionKey + '/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timestamp: Date.now(),
              status: 'running',
              progress: 50  // Dummy progress
            })
          }).catch(err => {
            console.warn(`[spawn-agent] Heartbeat failed for ${sessionKey}:`, err.message);
          });
        } catch (error) {
          console.warn(`[spawn-agent] Heartbeat error for ${sessionKey}:`, error.message);
        }
      }, heartbeatInterval);

      console.log(`[spawn-agent] Heartbeat started for ${sessionKey} (interval: ${heartbeatInterval}ms)`);
    }

    // Rückgabe des Session Keys und Hilfsfunktionen
    return {
      sessionKey,
      startTime,
      waitForCompletion: async () => {
        console.log(`[spawn-agent] waitForCompletion() called for ${sessionKey}`);
        // Completion wird vom System signalisiert (subagent_announce)
        // Diese Funktion wartet NICHT aktiv, sondern gibt nur Status zurück
        return {
          sessionKey,
          status: 'pending',
          message: 'Completion will be announced via subagent_announce'
        };
      },
      cancelHeartbeat: () => {
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId);
          heartbeatIntervalId = null;
          console.log(`[spawn-agent] Heartbeat cancelled for ${sessionKey}`);
        }
      },
      cleanup: async (status = 'cancelled', error = null) => {
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId);
          heartbeatIntervalId = null;
        }
        
        if (autoEnd && sessionKey) {
          const endTime = Date.now();
          const runtimeMs = endTime - startTime;
          await logAgentEnd(sessionKey, status, runtimeMs, error);
          console.log(`[spawn-agent] Cleanup completed for ${sessionKey}: ${status}`);
        }
      }
    };

  } catch (error) {
    // Error cleanup
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId);
    }

    // Error loggen
    if (sessionKey && autoEnd) {
      const endTime = Date.now();
      const runtimeMs = endTime - startTime;
      await logAgentEnd(sessionKey, 'failed', runtimeMs, error.message);
    }

    console.error(`[spawn-agent] Failed to spawn agent: ${error.message}`);
    throw error;
  }
}

/**
 * Helper: Progress berechnen (Dummy-Implementation)
 * @param {string} sessionKey 
 * @returns {Promise<number>} Progress 0-100
 */
async function calculateProgress(sessionKey) {
  // TODO: Echten Progress ermitteln (z.B. aus Token-Usage)
  return 50; // Dummy value
}
