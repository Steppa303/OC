import { Pool } from 'pg';

export const pool = new Pool({
  user: 'webapp',
  host: 'localhost',
  database: 'webapp_db',
  password: 'db#Jungle68',
  port: 5432,
});

/**
 * Agent-Start loggen
 * @param {string} sessionKey - Eindeutige Session-ID
 * @param {string} label - Agent-Label/Name
 * @param {string} task - Kurze Zusammenfassung (~80 Zeichen)
 * @param {string} prompt - Vollständiger Prompt (kompletter Task-Text)
 * @param {string} model - Verwendetes Model
 * @param {string|null} parentSession - Parent-Session-Key (optional)
 */
export async function logAgentStart(sessionKey, label, task, prompt, model, parentSession = null) {
  try {
    await pool.query(`
      INSERT INTO agent_activities (session_key, label, task, prompt, status, model, parent_session, started_at)
      VALUES ($1, $2, $3, $4, 'running', $5, $6, NOW())
      ON CONFLICT (session_key) DO UPDATE SET
        status = 'running',
        task = $3,
        prompt = $4,
        ended_at = NULL,
        error_message = NULL,
        started_at = NOW()
    `, [sessionKey, label, task, prompt, model, parentSession]);
    console.log(`📝 Agent start logged: ${label} (${sessionKey})`);
  } catch (error) {
    console.error('❌ Error logging agent start:', error.message);
  }
}

/**
 * Agent-Ende loggen
 * @param {string} sessionKey - Eindeutige Session-ID
 * @param {string} status - Status (done, failed, timeout)
 * @param {number} runtimeMs - Laufzeit in Millisekunden
 * @param {string|null} errorMessage - Fehlermeldung (optional)
 */
export async function logAgentEnd(sessionKey, status, runtimeMs, errorMessage = null) {
  try {
    await pool.query(`
      UPDATE agent_activities SET
        status = $2,
        ended_at = NOW(),
        runtime_ms = $3,
        error_message = $4
      WHERE session_key = $1
    `, [sessionKey, status, runtimeMs, errorMessage]);
    console.log(`📝 Agent end logged: ${sessionKey} - ${status} (${runtimeMs}ms)`);
  } catch (error) {
    console.error('❌ Error logging agent end:', error.message);
  }
}

/**
 * Alle Agent-Aktivitäten abrufen mit Filterung, Paginierung und Timeout-Erkennung
 * @param {number} limit - Maximale Anzahl Einträge (Standard: 50)
 * @param {number} offset - Offset für Paginierung (Standard: 0)
 * @param {string} status - Status-Filter (optional)
 * @param {boolean} includeOld - Ob alte Agents (>7 Tage) eingeschlossen werden sollen (Standard: true)
 * @param {boolean} autoDetectTimeout - Ob hängende Agents automatisch als timeout erkannt werden sollen (Standard: true)
 * @returns {Promise<Array>} Array von Agent-Aktivitäten
 */
export async function getAgentActivities(limit = 50, offset = 0, status = null, includeOld = true, autoDetectTimeout = true) {
  try {
    // Basis-Query zusammenbauen
    let query = `
      SELECT 
        *,
        CASE 
          WHEN status = 'running' AND started_at < NOW() - INTERVAL '1 hour' THEN 'timeout'
          ELSE status
        END as effective_status
      FROM agent_activities
    `;
    
    // Bedingungen zusammenbauen
    const conditions = [];
    const params = [];
    
    // Status-Filter
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    
    // Alter-Filter
    if (!includeOld) {
      conditions.push(`started_at >= NOW() - INTERVAL '7 days'`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Sortierung und Limit/Offset
    query += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Wenn autoDetectTimeout aktiviert ist, aktualisiere hängende Agents in der DB
    if (autoDetectTimeout) {
      try {
        await pool.query(`
          UPDATE agent_activities 
          SET status = 'timeout', 
              ended_at = started_at + INTERVAL '1 hour',
              error_message = 'Auto-timeout: Agent took too long'
          WHERE status = 'running' 
          AND started_at < NOW() - INTERVAL '1 hour';
        `);
      } catch (updateError) {
        console.error('⚠️ Error updating hanging agents to timeout:', updateError.message);
      }
    }
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching agent activities:', error.message);
    return [];
  }
}

/**
 * Aktive Agents abrufen (laufende Agents, keine hängenden)
 * @returns {Promise<Array>} Array von aktiven Agents
 */
export async function getActiveAgents() {
  try {
    const result = await pool.query(`
      SELECT * FROM agent_activities
      WHERE status IN ('running', 'pending')
      AND started_at >= NOW() - INTERVAL '1 hour'  -- Ausschluss von hängenden Agents (>1h)
      ORDER BY started_at DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching active agents:', error.message);
    return [];
  }
}

/**
 * Datenbank-Verbindung schließen (für Cleanup)
 */
export async function closePool() {
  await pool.end();
}

// Export für CommonJS (fallback)
export default {
  logAgentStart,
  logAgentEnd,
  getAgentActivities,
  getActiveAgents,
  closePool
};
