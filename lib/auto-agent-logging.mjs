/**
 * Auto Agent Logging Service
 * 
 * Dieser Service überwacht Completion Events und loggt Agents automatisch als "done".
 * 
 * Funktionsweise:
 * 1. Alle 5 Minuten werden alle "running" Agents geprüft
 * 2. Agents die 1 Stunde alt sind werden als "timeout" geloggt
 * 3. Agents die länger laufen als konfiguriert werden als "timeout" markiert
 * 
 * Usage:
 * node /root/.openclaw/workspace/lib/auto-agent-logging.mjs &
 */

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const API_BASE = 'http://localhost:3002';
const DB_HOST = 'localhost';
const DB_USER = 'webapp';
const DB_NAME = 'webapp_db';
const DB_PASS = 'db#Jungle68';

// Konfiguration
const TIMEOUT_THRESHOLD_HOURS = 2;  // Agents nach 2 Stunden als timeout markieren
const LONG_RUNNING_THRESHOLD_MINUTES = 30;  // Warnung bei 30+ Minuten Laufzeit
const CHECK_INTERVAL_MINUTES = 5;  // Alle 5 Minuten prüfen

/**
 * Sicheres Ausführen eines SQL-Befehls mit Error-Handling
 * @param {string} sqlQuery - SQL Query
 * @returns {Promise<Object>} Ergebnis des Befehls
 */
async function safeExecSQL(sqlQuery) {
  try {
    const result = await execAsync(`
      PGPASSWORD='${DB_PASS}' psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -t -A -c "${sqlQuery}"
    `);
    return { success: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    console.error(`❌ SQL Error: ${error.message}`);
    return { success: false, error: error.message, stdout: '', stderr: error.stderr || '' };
  }
}

/**
 * Sicheres Senden einer HTTP-Anfrage mit Error-Handling
 * @param {string} sessionKey - Session Key des Agents
 * @param {string} status - Status (timeout, etc.)
 * @param {number} runtimeMs - Laufzeit in Millisekunden
 * @param {string} errorMessage - Fehlermeldung
 * @returns {Promise<boolean>} Erfolg der Anfrage
 */
async function safeUpdateAgentStatus(sessionKey, status, runtimeMs, errorMessage) {
  try {
    const response = await execAsync(`
      curl -s -X POST ${API_BASE}/api/agents/end \\
        -H "Content-Type: application/json" \\
        -d '{"sessionKey":"${sessionKey}","status":"${status}","runtimeMs":${runtimeMs}, "errorMessage":"${errorMessage.replace(/"/g, '\\"')}"}' \\
        -w "\\nHTTP_STATUS:%{http_code}"
    `);
    
    const responseLines = response.stdout.trim().split('\n');
    const httpStatus = responseLines.pop()?.replace('HTTP_STATUS:', '');
    
    if (httpStatus && parseInt(httpStatus) >= 200 && parseInt(httpStatus) < 300) {
      return true;
    } else {
      console.error(`❌ HTTP Error updating agent ${sessionKey}: Status ${httpStatus}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating agent ${sessionKey}: ${error.message}`);
    return false;
  }
}

/**
 * Alle laufenden Agents prüfen und hängende Agents loggen
 */
async function checkAndLogAgents() {
  console.log(`[${new Date().toISOString()}] Checking agents...`);
  
  try {
    // Agents, die länger als konfigurierte Stunden laufen, als timeout markieren
    const timeoutQuery = `
      SELECT session_key, label, started_at, 
             EXTRACT(EPOCH FROM (NOW() - started_at)) as seconds_running
      FROM agent_activities 
      WHERE status = 'running'
      AND started_at < NOW() - INTERVAL '${TIMEOUT_THRESHOLD_HOURS} hours'
      ORDER BY started_at ASC;
    `;
    
    const timeoutResult = await safeExecSQL(timeoutQuery);
    
    if (timeoutResult.success) {
      const timeoutAgents = timeoutResult.stdout.trim().split('\n').filter(line => line.length > 0);
      
      let processedCount = 0;
      
      for (const agent of timeoutAgents) {
        const [sessionKey, label, startedAt, secondsRunning] = agent.split('|');
        if (sessionKey && sessionKey.trim()) {  // Sicherstellen, dass wir gültige Daten haben
          const hours = Math.floor(secondsRunning / 3600);
          
          // Agent als timeout loggen
          const success = await safeUpdateAgentStatus(
            sessionKey.trim(), 
            'timeout', 
            Math.floor(secondsRunning * 1000), 
            `Auto-timeout: Agent ran for more than ${TIMEOUT_THRESHOLD_HOURS} hours`
          );
          
          if (success) {
            console.log(`⏰ Marked as timeout: ${label} (${hours}h)`);
            processedCount++;
          } else {
            console.error(`❌ Failed to update timeout for agent: ${sessionKey}`);
          }
        }
      }
      
      if (processedCount > 0) {
        console.log(`⏰ Marked ${processedCount} agents as timeout (>${TIMEOUT_THRESHOLD_HOURS}h)`);
      }
    } else {
      console.error(`❌ Failed to query timeout agents: ${timeoutResult.error}`);
    }
    
    // Optionale zusätzliche Prüfung: Agents, die länger als konfigurierte Minuten laufen, als "long-running" betrachten
    const longRunningQuery = `
      SELECT session_key, label, started_at, 
             EXTRACT(EPOCH FROM (NOW() - started_at)) as seconds_running
      FROM agent_activities 
      WHERE status = 'running'
      AND started_at < NOW() - INTERVAL '${LONG_RUNNING_THRESHOLD_MINUTES} minutes'
      AND started_at >= NOW() - INTERVAL '${TIMEOUT_THRESHOLD_HOURS} hours'
      ORDER BY started_at ASC;
    `;
    
    const longRunningResult = await safeExecSQL(longRunningQuery);
    
    if (longRunningResult.success) {
      const longRunningAgents = longRunningResult.stdout.trim().split('\n').filter(line => line.length > 0);
      
      if (longRunningAgents.length > 0) {
        console.log(`⚠️ Found ${longRunningAgents.length} long-running agents (>${LONG_RUNNING_THRESHOLD_MINUTES}min, <${TIMEOUT_THRESHOLD_HOURS}h)`);
        for (const agent of longRunningAgents) {
          const [sessionKey, label, startedAt, secondsRunning] = agent.split('|');
          if (sessionKey && sessionKey.trim()) {
            const minutes = Math.floor(secondsRunning / 60);
            console.log(`   - ${label} (${minutes} min)`);
          }
        }
      }
    } else {
      console.error(`❌ Failed to query long-running agents: ${longRunningResult.error}`);
    }
    
    // Zusätzliche Prüfung: Agents, die länger als 1 Stunde laufen, aber nicht als timeout markiert wurden
    // Dies könnte auf fehlende completion calls hinweisen
    const hangingQuery = `
      SELECT session_key, label, started_at, 
             EXTRACT(EPOCH FROM (NOW() - started_at)) as seconds_running
      FROM agent_activities 
      WHERE status = 'running'
      AND started_at < NOW() - INTERVAL '1 hour'
      AND started_at >= NOW() - INTERVAL '${TIMEOUT_THRESHOLD_HOURS} hours'
      ORDER BY started_at ASC;
    `;
    
    const hangingResult = await safeExecSQL(hangingQuery);
    
    if (hangingResult.success) {
      const hangingAgents = hangingResult.stdout.trim().split('\n').filter(line => line.length > 0);
      
      if (hangingAgents.length > 0) {
        console.log(`🔍 Found ${hangingAgents.length} potentially hanging agents (1h-${TIMEOUT_THRESHOLD_HOURS}h)`);
        for (const agent of hangingAgents) {
          const [sessionKey, label, startedAt, secondsRunning] = agent.split('|');
          if (sessionKey && sessionKey.trim()) {
            const hours = secondsRunning / 3600;
            console.log(`   - ${label} (${hours.toFixed(1)}h) - May need manual timeout`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ Critical error checking agents: ${error.message}`);
    console.error(error.stack);
  }
}

/**
 * Service starten
 */
async function startService() {
  console.log('🚀 Starting Auto Agent Logging Service...');
  console.log(`   Checking every ${CHECK_INTERVAL_MINUTES} minutes`);
  console.log(`   Timeout threshold: ${TIMEOUT_THRESHOLD_HOURS} hours`);
  console.log(`   Long-running warning: ${LONG_RUNNING_THRESHOLD_MINUTES} minutes`);
  
  // Initialisierung prüfen
  try {
    const healthCheck = await safeExecSQL("SELECT 1 as test;");
    if (healthCheck.success) {
      console.log('✅ Database connection OK');
    } else {
      console.error('❌ Database connection FAILED');
      return;
    }
  } catch (error) {
    console.error(`❌ Service initialization failed: ${error.message}`);
    return;
  }
  
  // Regelmäßige Prüfung starten
  const intervalId = setInterval(checkAndLogAgents, CHECK_INTERVAL_MINUTES * 60 * 1000);
  
  // Sofort einmal prüfen
  await checkAndLogAgents();
  
  // Graceful Shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Auto Agent Logging Service...');
    clearInterval(intervalId);
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down Auto Agent Logging Service...');
    clearInterval(intervalId);
    process.exit(0);
  });
}

// Service starten
startService().catch(console.error);
