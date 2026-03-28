/**
 * Verbesserter RAG Auto-Ingest Service
 * 
 * Automatisches Ingestieren von neuen Sessions und Agents in ChromaDB
 * - Prüft regelmäßig auf neue Sessions/Agents
 * - Ingestet nur NEUE Einträge (keine Duplikate)
 * - Läuft als Background-Service alle 5 Minuten
 * - Robust gegen Fehler mit Retry-Logik und umfangreichem Logging
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import os from 'os';



// Für die Python-basierte ChromaDB-Integration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Metadaten-Datei für letzte Ingestion
const METADATA_FILE = '/root/.openclaw/chroma_db/auto_ingest_metadata.json';

// Fehlerprotokolldatei
const ERROR_LOG_FILE = '/root/.openclaw/chroma_db/auto_ingest_errors.log';

// Statusprotokolldatei
const STATUS_LOG_FILE = '/root/.openclaw/chroma_db/auto_ingest_status.log';

/**
 * Schreibt eine Nachricht ins Error-Log
 * @param {string} message - Die Nachricht
 * @param {Error} [error] - Optionaler Fehler
 */
async function logError(message, error = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ERROR - ${message}`;
  
  console.error(logEntry);
  if (error) {
    console.error(`Error details: ${error.stack || error.message || error}`);
  }
  
  try {
    const logMessage = `${logEntry}${error ? `\n${error.stack || error.message || error}` : ''}\n`;
    await fs.appendFile(ERROR_LOG_FILE, logMessage);
  } catch (logError) {
    console.error(`Failed to write to error log: ${logError.message}`);
  }
}

/**
 * Schreibt eine Nachricht ins Status-Log
 * @param {string} message - Die Nachricht
 */
async function logStatus(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - INFO - ${message}`;
  
  console.log(logEntry);
  
  try {
    await fs.appendFile(STATUS_LOG_FILE, logEntry + '\n');
  } catch (logError) {
    console.error(`Failed to write to status log: ${logError.message}`);
  }
}

/**
 * Liest die letzte Ingestion-Metadaten
 * @returns {Promise<Object>} Metadaten-Objekt
 */
async function readLastIngestionMetadata() {
  try {
    const content = await fs.readFile(METADATA_FILE, 'utf8');
    // Überprüfe, ob die Datei leer ist
    if (content.trim() === '') {
      logStatus('Metadata file is empty, using defaults');
      return {
        last_ingested_session: null,
        last_ingested_agent: null,
        last_successful_run: null,
        failed_attempts: 0
      };
    }
    const parsed = JSON.parse(content);
    logStatus(`Loaded previous ingestion metadata: ${JSON.stringify(parsed)}`);
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logStatus('No previous ingestion metadata found, using defaults');
      return {
        last_ingested_session: null,
        last_ingested_agent: null,
        last_successful_run: null,
        failed_attempts: 0
      };
    } else if (error instanceof SyntaxError) {
      // JSON Parse Fehler - Datei ist beschädigt
      logError('Metadata file is corrupted, using defaults', error);
      return {
        last_ingested_session: null,
        last_ingested_agent: null,
        last_successful_run: null,
        failed_attempts: 0
      };
    } else {
      await logError('Error reading ingestion metadata', error);
      throw error;
    }
  }
}

/**
 * Speichert die Ingestion-Metadaten
 * @param {Object} metadata - Metadaten-Objekt
 */
async function saveIngestionMetadata(metadata) {
  try {
    // Stelle sicher, dass das Verzeichnis existiert
    await fs.mkdir(path.dirname(METADATA_FILE), { recursive: true });
    await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
    logStatus(`Saved ingestion metadata: ${JSON.stringify(metadata)}`);
  } catch (error) {
    await logError('Error saving ingestion metadata', error);
    throw error;
  }
}

/**
 * Holt alle Session-Dateien mit ihren Änderungszeiten
 * @returns {Promise<Array>} Array von Session-Datei-Infos
 */
async function getSessionFiles() {
  try {
    const sessionsDir = '/root/.openclaw/agents/main/sessions/';
    let files = [];
    
    try {
      files = await fs.readdir(sessionsDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logStatus(`Sessions directory does not exist: ${sessionsDir}, creating it...`);
        await fs.mkdir(sessionsDir, { recursive: true });
        files = [];
      } else {
        throw error;
      }
    }

    const sessionFiles = [];
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        try {
          const filePath = path.join(sessionsDir, file);
          const stat = await fs.stat(filePath);

          sessionFiles.push({
            filename: file,
            filepath: filePath,
            mtime: stat.mtime.getTime(), // Modification time als Unix timestamp
            size: stat.size, // Dateigröße für Monitoring
            basename: path.parse(file).name
          });
        } catch (statError) {
          await logError(`Error getting stats for session file ${file}`, statError);
          continue; // Überspringe fehlerhafte Dateien
        }
      }
    }

    // Sortiere nach Änderungszeit (neueste zuerst)
    sessionFiles.sort((a, b) => b.mtime - a.mtime);

    logStatus(`Found ${sessionFiles.length} session files in ${sessionsDir}`);
    return sessionFiles;
  } catch (error) {
    await logError('Error reading session files', error);
    return [];
  }
}

/**
 * Holt alle Chat-Session-Dateien (für Chat-Session-Ingest)
 * @returns {Promise<Array>} Array von Chat-Session-Datei-Infos
 */
async function getChatSessionFiles() {
  try {
    const sessionsDir = '/root/.openclaw/agents/main/sessions/';
    let files = [];
    
    try {
      files = await fs.readdir(sessionsDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logStatus(`Sessions directory does not exist: ${sessionsDir}, creating it...`);
        await fs.mkdir(sessionsDir, { recursive: true });
        files = [];
      } else {
        throw error;
      }
    }

    const chatSessionFiles = [];
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        try {
          const filePath = path.join(sessionsDir, file);
          const stat = await fs.stat(filePath);

          chatSessionFiles.push({
            filename: file,
            filepath: filePath,
            mtime: stat.mtime.getTime(), // Modification time als Unix timestamp
            size: stat.size, // Dateigröße für Monitoring
            basename: path.parse(file).name
          });
        } catch (statError) {
          await logError(`Error getting stats for chat session file ${file}`, statError);
          continue; // Überspringe fehlerhafte Dateien
        }
      }
    }

    // Sortiere nach Änderungszeit (neueste zuerst)
    chatSessionFiles.sort((a, b) => b.mtime - a.mtime);

    logStatus(`Found ${chatSessionFiles.length} chat session files in ${sessionsDir}`);
    return chatSessionFiles;
  } catch (error) {
    await logError('Error reading chat session files', error);
    return [];
  }
}

/**
 * Filtert Session-Dateien basierend auf der letzten Ingestion
 * @param {Array} sessionFiles - Array von Session-Datei-Infos
 * @param {Object} lastIngested - Letzte Ingestion-Metadaten
 * @returns {Array} Gefilterte Session-Dateien
 */
function filterNewSessions(sessionFiles, lastIngested) {
  if (!lastIngested?.last_ingested_session) {
    logStatus('No previous session ingestion found, ingesting all sessions');
    return sessionFiles;
  }

  // Finde die Session, die zuletzt ingested wurde
  const lastIngestedTime = new Date(lastIngested.last_ingested_session).getTime();
  logStatus(`Filtering sessions newer than: ${new Date(lastIngestedTime).toISOString()}`);

  // Filtere nur Session-Dateien, die nach der letzten Ingestion geändert wurden
  const filtered = sessionFiles.filter(sessionFile => sessionFile.mtime > lastIngestedTime);
  logStatus(`Found ${filtered.length} new session files to ingest`);
  return filtered;
}

/**
 * Filtert Chat-Session-Dateien basierend auf der letzten Ingestion
 * @param {Array} chatSessionFiles - Array von Chat-Session-Datei-Infos
 * @param {Object} lastIngested - Letzte Ingestion-Metadaten
 * @returns {Array} Gefilterte Chat-Session-Dateien
 */
function filterNewChatSessions(chatSessionFiles, lastIngested) {
  if (!lastIngested?.last_ingested_chat_session) {
    logStatus('No previous chat session ingestion found, ingesting all chat sessions');
    return chatSessionFiles;
  }

  // Finde die Chat-Session, die zuletzt ingested wurde
  const lastIngestedTime = new Date(lastIngested.last_ingested_chat_session).getTime();
  logStatus(`Filtering chat sessions newer than: ${new Date(lastIngestedTime).toISOString()}`);

  // Filtere nur Chat-Session-Dateien, die nach der letzten Ingestion geändert wurden
  const filtered = chatSessionFiles.filter(chatSessionFile => chatSessionFile.mtime > lastIngestedTime);
  logStatus(`Found ${filtered.length} new chat session files to ingest`);
  return filtered;
}

/**
 * Führt ein Python-Skript mit Retry-Logik aus
 * @param {string} scriptPath - Pfad zum Python-Skript
 * @param {string} args - Argumente für das Skript
 * @param {number} maxRetries - Maximale Wiederholungsversuche
 * @param {number} retryDelayMs - Verzögerung zwischen Versuchen in ms
 * @returns {Promise<{success: boolean, output: string}>}
 */
async function runPythonScriptWithRetry(scriptPath, args = '', maxRetries = 3, retryDelayMs = 2000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logStatus(`🔄 Attempt ${attempt}/${maxRetries} running Python script: ${scriptPath} ${args}`);
      
      const cmd = `python3 ${scriptPath} ${args}`;
      const result = execSync(cmd, { 
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 600000, // 10 Minuten Timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB Buffer
      });

      logStatus(`✅ Successfully executed Python script: ${scriptPath}`);
      return { success: true, output: result };
    } catch (error) {
      lastError = error;
      logError(`Attempt ${attempt} failed for Python script: ${scriptPath}`, error);
      
      if (attempt < maxRetries) {
        logStatus(`⏳ Waiting ${retryDelayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  
  await logError(`❌ Failed to execute Python script after ${maxRetries} attempts: ${scriptPath}`, lastError);
  return { success: false, output: lastError?.stdout || lastError?.stderr || lastError?.message || 'Unknown error' };
}

/**
 * Führt ein Python-Skript mit Retry-Logik aus und übergibt Daten über stdin
 * @param {string} scriptPath - Pfad zum Python-Skript
 * @param {string} inputData - Daten, die an das Skript über stdin übergeben werden
 * @param {number} maxRetries - Maximale Wiederholungsversuche
 * @param {number} retryDelayMs - Verzögerung zwischen Versuchen in ms
 * @returns {Promise<{success: boolean, output: string}>}
 */
async function runPythonScriptWithRetryUsingStdin(scriptPath, inputData, maxRetries = 3, retryDelayMs = 2000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logStatus(`🔄 Attempt ${attempt}/${maxRetries} running Python script: ${scriptPath} (with stdin data)`);
      
      const { spawn } = await import('child_process');
      
      return new Promise((resolve, reject) => {
        const child = spawn('python3', [scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 600000, // 10 Minuten Timeout
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        child.on('error', (error) => {
          reject(error);
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            logStatus(`✅ Successfully executed Python script: ${scriptPath}`);
            resolve({ success: true, output: stdout });
          } else {
            reject(new Error(`Process exited with code ${code}: ${stderr}`));
          }
        });
        
        // Sende die Eingabedaten an stdin
        child.stdin.write(inputData);
        child.stdin.end();
      });
    } catch (error) {
      lastError = error;
      logError(`Attempt ${attempt} failed for Python script: ${scriptPath}`, error);
      
      if (attempt < maxRetries) {
        logStatus(`⏳ Waiting ${retryDelayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  
  await logError(`❌ Failed to execute Python script after ${maxRetries} attempts: ${scriptPath}`, lastError);
  return { success: false, output: lastError?.message || 'Unknown error' };
}

/**
 * Ingestet eine einzelne Session-Datei in ChromaDB
 * @param {string} sessionFilePath - Pfad zur Session-Datei
 * @returns {Promise<boolean>} Erfolg/Fehlschlag
 */
async function ingestSingleSession(sessionFilePath) {
  try {
    logStatus(`🔄 Ingesting session: ${sessionFilePath}`);

    // Überprüfe, ob die Datei existiert und lesbar ist
    try {
      await fs.access(sessionFilePath, fs.constants.R_OK);
    } catch (accessError) {
      await logError(`Session file not accessible: ${sessionFilePath}`, accessError);
      return false;
    }

    // Hole das Python-Skript für Session-Ingestion
    const pythonScriptPath = path.join(__dirname, 'ingest_single_session.py');
    
    // Führe das Python-Skript für die Session-Ingestion mit Retry aus
    const result = await runPythonScriptWithRetry(pythonScriptPath, `"${sessionFilePath}"`);
    
    if (result.success) {
      logStatus(`✅ Successfully ingested session: ${sessionFilePath}`);
      return true;
    } else {
      await logError(`❌ Failed to ingest session: ${sessionFilePath}`, new Error(result.output));
      return false;
    }
  } catch (error) {
    await logError(`❌ Error ingesting session ${sessionFilePath}`, error);
    return false;
  }
}

/**
 * Ingestet Chat-Sessions in ChromaDB
 * @returns {Promise<boolean>} Erfolg/Fehlschlag
 */
async function ingestChatSessions() {
  try {
    logStatus(`🔄 Starting chat session ingestion...`);

    // Hole das Python-Skript für Chat-Session-Ingestion (im Hauptverzeichnis)
    const pythonScriptPath = path.join(__dirname, '../ingest_chat_sessions.py');
    
    // Führe das Python-Skript für die Chat-Session-Ingestion mit Retry aus
    const result = await runPythonScriptWithRetry(pythonScriptPath);
    
    if (result.success) {
      logStatus(`✅ Successfully ingested chat sessions`);
      return true;
    } else {
      await logError(`❌ Failed to ingest chat sessions`, new Error(result.output));
      return false;
    }
  } catch (error) {
    await logError(`❌ Error ingesting chat sessions`, error);
    return false;
  }
}

/**
 * Holt neue Agent-Daten von der API
 * @returns {Promise<Array>} Array von Agent-Objekten
 */
async function getNewAgents(lastIngested) {
  try {
    logStatus('Fetching agents from API...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 Sekunden Timeout
    
    const response = await fetch('http://localhost:3002/api/agents', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();

    if (!data.agents || !Array.isArray(data.agents)) {
      await logError('Invalid response format from agents API', new Error(`Expected array of agents, got: ${typeof data.agents}`));
      return [];
    }

    const agents = data.agents;
    logStatus(`Fetched ${agents.length} agents from API`);

    if (!lastIngested?.last_ingested_agent) {
      logStatus('No previous agent ingestion found, ingesting all agents');
      return agents;
    }

    // Filtere nur Agenten, die nach der letzten Ingestion erstellt wurden
    // Basierend auf der ID (angenommen höhere IDs sind neuer)
    const lastIngestedId = parseInt(lastIngested.last_ingested_agent);
    const newAgents = agents.filter(agent => parseInt(agent.id) > lastIngestedId);
    
    logStatus(`Found ${newAgents.length} new agents to ingest (last ingested ID: ${lastIngestedId})`);
    return newAgents;
  } catch (error) {
    await logError('Error fetching agents from API', error);
    return [];
  }
}

/**
 * Ingestet Agent-Daten in ChromaDB
 * @param {Array} agents - Array von Agent-Objekten
 * @returns {Promise<boolean>} Erfolg/Fehlschlag
 */
async function ingestAgentsToChromadb(agents) {
  if (!agents || agents.length === 0) {
    logStatus('⏭️  No new agents to ingest');
    return true;
  }

  try {
    logStatus(`🔄 Ingesting ${agents.length} new agents to ChromaDB...`);

    // Hole das Python-Skript für Agent-Ingestion
    const pythonScriptPath = path.join(__dirname, '../lib/ingest_agents.py');
    const agentsJson = JSON.stringify(agents);
    
    // Führe das Python-Skript für die Agent-Ingestion mit Retry aus
    // Verwende stdin statt -c flag wegen Argument-Längenbeschränkungen
    const result = await runPythonScriptWithRetryUsingStdin(pythonScriptPath, agentsJson);
    
    if (result.success) {
      logStatus(`✅ Successfully ingested ${agents.length} agents to ChromaDB!`);
      return true;
    } else {
      await logError(`❌ Failed to ingest agents to ChromaDB`, new Error(result.output));
      return false;
    }
  } catch (error) {
    await logError('Error ingesting agents to ChromaDB', error);
    return false;
  }
}

/**
 * Führt einen vollständigen Ingestion-Durchlauf durch
 * @returns {Promise<Object>} Ergebnis des Durchlaufs
 */
async function runAutoIngestion() {
  logStatus('🔄 Running auto-ingestion cycle...');

  try {
    // Lese letzte Ingestion-Metadaten
    const lastIngested = await readLastIngestionMetadata();
    logStatus(`📋 Last ingestion metadata: ${JSON.stringify(lastIngested)}`);

    // Starte Zeitmessung
    const startTime = Date.now();

    // Hole alle Session-Dateien
    const allSessionFiles = await getSessionFiles();
    logStatus(`📁 Found ${allSessionFiles.length} session files`);

    // Filtere nur neue Session-Dateien
    const newSessionFiles = filterNewSessions(allSessionFiles, lastIngested);
    logStatus(`🆕 Found ${newSessionFiles.length} new session files to ingest`);

    // Ingeste neue Sessions
    let sessionsProcessed = 0;
    let sessionsFailed = 0;

    for (const sessionFile of newSessionFiles) {
      try {
        const success = await ingestSingleSession(sessionFile.filepath);
        if (success) {
          sessionsProcessed++;
        } else {
          sessionsFailed++;
        }
      } catch (error) {
        await logError(`❌ Error processing session ${sessionFile.filepath}`, error);
        sessionsFailed++;
      }
    }

    // Hole neue Agent-Daten
    const newAgents = await getNewAgents(lastIngested);
    logStatus(`🆕 Found ${newAgents.length} new agents to ingest`);

    // Ingeste neue Agent-Daten
    let agentsProcessed = 0;
    let agentsFailed = 0;

    if (newAgents.length > 0) {
      const agentsSuccess = await ingestAgentsToChromadb(newAgents);
      if (agentsSuccess) {
        agentsProcessed = newAgents.length;
      } else {
        agentsFailed = newAgents.length;
      }
    }

    // Ingeste Chat-Sessions
    const chatSessionsSuccess = await ingestChatSessions();
    if (!chatSessionsSuccess) {
      logStatus('⚠️  Chat session ingestion failed, but continuing...');
    }

    // Aktualisiere die Metadaten mit den neuesten IDs/Werten
    const updatedMetadata = { ...lastIngested };

    if (newSessionFiles.length > 0) {
      // Nehme die Änderungszeit der neuesten Session-Datei
      const latestSession = newSessionFiles[0];
      updatedMetadata.last_ingested_session = new Date(latestSession.mtime).toISOString();
      logStatus(`Updated last_ingested_session to: ${updatedMetadata.last_ingested_session}`);
    }

    if (newAgents.length > 0) {
      // Nehme die höchste Agent-ID
      const highestAgentId = Math.max(...newAgents.map(agent => parseInt(agent.id)));
      updatedMetadata.last_ingested_agent = highestAgentId.toString();
      logStatus(`Updated last_ingested_agent to: ${updatedMetadata.last_ingested_agent}`);
    }

    // Update chat session timestamp
    updatedMetadata.last_ingested_chat_session = new Date().toISOString();
    logStatus(`Updated last_ingested_chat_session to: ${updatedMetadata.last_ingested_chat_session}`);

    // Setze failed_attempts zurück bei erfolgreichem Durchlauf
    updatedMetadata.failed_attempts = 0;
    updatedMetadata.last_successful_run = new Date().toISOString();

    // Speichere aktualisierte Metadaten
    await saveIngestionMetadata(updatedMetadata);

    const duration = Date.now() - startTime;
    logStatus(`✅ Auto-ingestion cycle completed in ${duration}ms:`);
    logStatus(`   - Sessions processed: ${sessionsProcessed} (failed: ${sessionsFailed})`);
    logStatus(`   - Agents processed: ${agentsProcessed} (failed: ${agentsFailed})`);
    logStatus(`   - Chat sessions: Ingested`);
    logStatus(`   - Updated metadata: ${JSON.stringify(updatedMetadata)}`);

    return {
      success: true,
      sessionsProcessed,
      sessionsFailed,
      agentsProcessed,
      agentsFailed,
      duration,
      metadata: updatedMetadata
    };
  } catch (error) {
    await logError('❌ Error in auto-ingestion cycle', error);
    
    // Update failed attempts in metadata
    try {
      const lastIngested = await readLastIngestionMetadata();
      const updatedMetadata = { ...lastIngested };
      updatedMetadata.failed_attempts = (updatedMetadata.failed_attempts || 0) + 1;
      updatedMetadata.last_error = error.message;
      updatedMetadata.last_error_time = new Date().toISOString();
      await saveIngestionMetadata(updatedMetadata);
    } catch (metadataError) {
      await logError('Error updating failed attempts in metadata', metadataError);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Startet den Hintergrund-Service für regelmäßiges Ingesting
 * @param {number} intervalMinutes - Intervall in Minuten (default: 5)
 * @returns {Object} {intervalId, stop: function to stop the interval}
 */
function startAutoIngestService(intervalMinutes = 5) {
  logStatus(`🔄 Starting auto-ingest service (every ${intervalMinutes} minutes)...`);

  const intervalId = setInterval(async () => {
    try {
      logStatus(`⏰ Scheduled auto-ingestion cycle starting...`);
      await runAutoIngestion();
    } catch (error) {
      await logError('❌ Error in scheduled auto-ingestion', error);
    }
  }, intervalMinutes * 60 * 1000);

  logStatus(`✅ Auto-ingest service started with ${intervalMinutes}-minute intervals`);

  return {
    intervalId,
    stop: () => {
      clearInterval(intervalId);
      logStatus(`⏹️  Auto-ingest service stopped`);
    }
  };
}

/**
 * Manuelle Ingestion-Funktion
 * @returns {Promise<Object>} Ergebnis der manuellen Ingestion
 */
async function manualIngestion() {
  logStatus('> Manual ingestion triggered...');
  return await runAutoIngestion();
}

/**
 * Prüft den Service-Status
 * @returns {Promise<Object>} Status-Informationen
 */
async function checkServiceStatus() {
  try {
    const lastIngested = await readLastIngestionMetadata();
    const now = new Date().toISOString();
    
    const status = {
      timestamp: now,
      serviceRunning: true,
      lastIngestion: lastIngested,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      platform: os.platform(),
      arch: os.arch()
    };
    
    logStatus(`📊 Service status: ${JSON.stringify(status)}`);
    return status;
  } catch (error) {
    await logError('Error checking service status', error);
    return { error: error.message };
  }
}

// Exportiere nur die Hauptfunktionen
export {
  runAutoIngestion,
  startAutoIngestService,
  manualIngestion,
  checkServiceStatus
};

// Exportiere auch als Standard-Export für Kompatibilität
export default {
  runAutoIngestion,
  startAutoIngestService,
  manualIngestion,
  checkServiceStatus
};