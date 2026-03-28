const { Pool } = require('pg');

const pool = new Pool({
  user: 'webapp',
  host: 'localhost',
  database: 'webapp_db',
  password: 'db#Jungle68',
  port: 5432,
});

// Agent starten loggen
async function logAgentStart(sessionKey, label, task, model, parentSession = null) {
  await pool.query(`
    INSERT INTO agent_activities (session_key, label, task, status, model, parent_session, started_at)
    VALUES ($1, $2, $3, 'running', $4, $5, NOW())
    ON CONFLICT (session_key) DO UPDATE SET
      status = 'running',
      ended_at = NULL,
      error_message = NULL
  `, [sessionKey, label, task, model, parentSession]);
}

// Agent beenden loggen
async function logAgentEnd(sessionKey, status, runtimeMs, errorMessage = null) {
  await pool.query(`
    UPDATE agent_activities SET
      status = $2,
      ended_at = NOW(),
      runtime_ms = $3,
      error_message = $4
    WHERE session_key = $1
  `, [sessionKey, status, runtimeMs, errorMessage]);
}

// Alle Agents abrufen
async function getAgentActivities(limit = 50) {
  const result = await pool.query(`
    SELECT * FROM agent_activities
    ORDER BY started_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

// Aktive Agents abrufen
async function getActiveAgents() {
  const result = await pool.query(`
    SELECT * FROM agent_activities
    WHERE status = 'running' OR status = 'pending'
    ORDER BY started_at DESC
  `);
  return result.rows;
}

module.exports = { logAgentStart, logAgentEnd, getAgentActivities, getActiveAgents };