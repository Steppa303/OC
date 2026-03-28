/**
 * Agent spawnen mit automatischem Logging
 * @param {Object} options
 * @param {string} options.label - Agent Name
 * @param {string} options.task - Kurze Zusammenfassung (~80 Zeichen)
 * @param {string} options.prompt - Vollständiger Prompt (optional, default = task)
 * @param {string} options.model - Model Name
 * @param {string} options.runtime - 'subagent' oder 'acp'
 * @param {string} options.mode - 'run' oder 'session'
 * @param {number} options.heartbeatInterval - Heartbeat Intervall in ms (default: 30000)
 * @param {boolean} options.autoEnd - Bei Completion automatisch beenden (default: true)
 * @returns {Promise<Object>} Ergebnis mit sessionKey und cleanup Funktion
 */
export async function spawnAgent(options) {
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

    sessionKey = spawnResult.sessionKey;

    // Log start event
    await logAgentStart(sessionKey, processedTask, processedPrompt);

    // Heartbeat-Loop starten falls aktiviert
    if (heartbeatInterval > 0) {
      heartbeatIntervalId = setInterval(async () => {
        try {
          await fetch(`/api/agents/${sessionKey}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timestamp: Date.now(),
              status: 'running',
              progress: await calculateProgress(sessionKey)
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

    // Completion Event Listener (push-basiert)
    const completionPromise = new Promise((resolve, reject) => {
      const originalOnMessage = globalThis.onUserMessage || ((() => {}));
      
      // Temporärer Message Handler für Completion Events
      globalThis.onUserMessage = async (message) => {
        // Original handler aufrufen
        if (originalOnMessage) {
          originalOnMessage(message);
        }

        // Completion Event erkennen
        if (message.type === 'completion' && message.sessionKey === sessionKey) {
          // Heartbeat stoppen
          if (heartbeatIntervalId) {
            clearInterval(heartbeatIntervalId);
            heartbeatIntervalId = null;
          }

          const endTime = Date.now();
          const runtimeMs = endTime - startTime;

          try {
            if (message.status === 'done') {
              await logAgentEnd(sessionKey, 'done', runtimeMs);
              console.log(`[spawn-agent] Agent completed successfully: ${sessionKey}`);
              resolve({
                sessionKey,
                status: 'done',
                runtimeMs,
                result: message.result
              });
            } else if (message.status === 'failed') {
              await logAgentEnd(sessionKey, 'failed', runtimeMs, message.error);
              console.error(`[spawn-agent] Agent failed: ${sessionKey}`, message.error);
              reject(new Error(`Agent failed: ${message.error?.message || 'Unknown error'}`));
            } else {
              console.warn(`[spawn-agent] Unexpected completion status for ${sessionKey}:`, message.status);
              resolve({
                sessionKey,
                status: message.status,
                runtimeMs,
                result: message.result
              });
            }
          } catch (logError) {
            console.error(`[spawn-agent] Error logging agent end:`, logError);
            // Trotz Log-Fehler das Ergebnis zurückgeben
            if (message.status === 'done') {
              resolve({
                sessionKey,
                status: 'done',
                runtimeMs,
                result: message.result
              });
            } else {
              reject(new Error(`Agent failed: ${message.error?.message || 'Unknown error'}`));
            }
          }
        }
      };
    });

    // Timeout handling falls konfiguriert
    if (options.timeoutSeconds) {
      setTimeout(() => {
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId);
          heartbeatIntervalId = null;
        }
        
        console.warn(`[spawn-agent] Agent timed out: ${sessionKey}`);
        // Hier müsste eigentlich ein properes Timeout-Handling rein
      }, options.timeoutSeconds * 1000);
    }

    // Rückgabe des Session Keys und einer Cleanup-Funktion
    return {
      sessionKey,
      waitForCompletion: () => completionPromise,
      cancelHeartbeat: () => {
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId);
          heartbeatIntervalId = null;
        }
      },
      cleanup: async () => {
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId);
          heartbeatIntervalId = null;
        }
        
        if (autoEnd && sessionKey) {
          const endTime = Date.now();
          const runtimeMs = endTime - startTime;
          await logAgentEnd(sessionKey, 'cancelled', runtimeMs, 'Manually cancelled');
        }
      }
    };

  } catch (error) {
    // Error cleanup
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId);
    }

    console.error(`[spawn-agent] Error spawning agent ${label}:`, error);
    
    // Falls sessionKey bereits gesetzt wurde, auch im Fehlerfall loggen
    if (sessionKey) {
      const endTime = Date.now();
      const runtimeMs = endTime - startTime;
      await logAgentEnd(sessionKey, 'failed', runtimeMs, error.message);
    }

    throw error;
  }
}

/**
 * Hilfsfunktion für Fortschrittsberechnung (placeholder)
 * @param {string} sessionKey 
 * @returns {Promise<number>} Fortschritt in Prozent (0-100)
 */
async function calculateProgress(sessionKey) {
  // Placeholder - hier könnte z.B. Fortschritt basierend auf:
  // - Anzahl abgeschlossener Schritte
  // - Dateigröße Verarbeitung
  // - API-Call Fortschritt
  // - etc. berechnet werden
  return 50; // Standardwert
}

/**
 * Start-Logging Funktion
 * @param {string} sessionKey 
 * @param {string} task 
 * @param {string} prompt 
 */
async function logAgentStart(sessionKey, task, prompt) {
  console.log(`[AGENT_START] ${sessionKey}`, {
    task,
    prompt,
    timestamp: new Date().toISOString()
  });
  
  // Hier würde eigentlich eine richtige Logging-Implementierung rein
  // z.B. in eine Datenbank, Datei, oder externes Logging-System
}

/**
 * End-Logging Funktion
 * @param {string} sessionKey 
 * @param {string} status 
 * @param {number} runtimeMs 
 * @param {any} error 
 */
async function logAgentEnd(sessionKey, status, runtimeMs, error = null) {
  console.log(`[AGENT_END] ${sessionKey}`, {
    status,
    runtimeMs,
    error: error ? error.toString() : null,
    timestamp: new Date().toISOString()
  });
  
  // Hier würde eigentlich eine richtige Logging-Implementierung rein
  // z.B. in eine Datenbank, Datei, oder externes Logging-System
}