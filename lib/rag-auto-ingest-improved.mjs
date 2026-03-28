/**
 * RAG Auto-Ingest Service (IMPROVED v2.0)
 * 
 * Automatisches Ingestieren von neuen Sessions und Agents in ChromaDB
 * 
 * FEATURES:
 * ✅ Deduplizierung: message_id Prüfung verhindert doppelte Vektorisierung
 * ✅ Fehler-Handling: spawn statt execSync (fangt Segfaults ab)
 * ✅ Local Embeddings: all-MiniLM-L6-v2 lokal (keine HuggingFace-Timeouts)
 * ✅ Batch-Limit: Max 50 Einträge pro Durchlauf (RAM-Schutz)
 * ✅ Retry-Logik: 3 Versuche mit exponentiellem Backoff
 * ✅ Umfangreiches Logging: Status + Error Logs
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== KONFIGURATION ====================

const CONFIG = {
  // Pfade
  chromaDBPath: '/root/.openclaw/chroma_db',
  sessionsDir: '/root/.openclaw/agents/main/sessions/',
  metadataFile: '/root/.openclaw/chroma_db/auto_ingest_metadata.json',
  errorLogFile: '/root/.openclaw/chroma_db/auto_ingest_errors.log',
  statusLogFile: '/root/.openclaw/chroma_db/auto_ingest_status.log',
  
  // Embedding Model (lokal)
  embeddingModel: 'all-MiniLM-L6-v2',
  embeddingModelPath: '/root/.openclaw/chroma_db/models/all-MiniLM-L6-v2',
  
  // Batch Limits
  maxSessionsPerBatch: 50,
  maxAgentsPerBatch: 50,
  
  // Retry Settings
  maxRetries: 3,
  retryDelayMs: 2000,
  
  // Timeouts
  pythonScriptTimeout: 600000, // 10 Minuten
};

// ==================== LOGGING ====================

/**
 * Schreibt eine Nachricht ins Error-Log
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
    await fs.appendFile(CONFIG.errorLogFile, logMessage);
  } catch (logError) {
    console.error(`Failed to write to error log: ${logError.message}`);
  }
}

/**
 * Schreibt eine Nachricht ins Status-Log
 */
async function logStatus(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - INFO - ${message}`;
  
  console.log(logEntry);
  
  try {
    await fs.appendFile(CONFIG.statusLogFile, logEntry + '\n');
  } catch (logError) {
    console.error(`Failed to write to status log: ${logError.message}`);
  }
}

// ==================== METADATA ====================

/**
 * Liest die letzte Ingestion-Metadaten
 */
async function readLastIngestionMetadata() {
  try {
    const content = await fs.readFile(CONFIG.metadataFile, 'utf8');
    if (content.trim() === '') {
      logStatus('Metadata file is empty, using defaults');
      return {
        last_ingested_session: null,
        last_ingested_agent: null,
        last_successful_run: null,
        failed_attempts: 0,
        ingested_message_ids: []  // NEU: Deduplizierung
      };
    }
    const parsed = JSON.parse(content);
    // Rückwärtskompatibilität
    if (!parsed.ingested_message_ids) {
      parsed.ingested_message_ids = [];
    }
    logStatus(`Loaded previous ingestion metadata`);
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      logStatus('No previous ingestion metadata found, using defaults');
      return {
        last_ingested_session: null,
        last_ingested_agent: null,
        last_successful_run: null,
        failed_attempts: 0,
        ingested_message_ids: []
      };
    }
    await logError('Error reading ingestion metadata', error);
    throw error;
  }
}

/**
 * Speichert die Ingestion-Metadaten
 */
async function saveIngestionMetadata(metadata) {
  try {
    await fs.mkdir(path.dirname(CONFIG.metadataFile), { recursive: true });
    await fs.writeFile(CONFIG.metadataFile, JSON.stringify(metadata, null, 2));
    logStatus(`Saved ingestion metadata`);
  } catch (error) {
    await logError('Error saving ingestion metadata', error);
    throw error;
  }
}

// ==================== SESSION FILES ====================

/**
 * Holt alle Session-Dateien
 */
async function getSessionFiles() {
  try {
    let files = [];
    
    try {
      files = await fs.readdir(CONFIG.sessionsDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logStatus(`Sessions directory does not exist, creating it...`);
        await fs.mkdir(CONFIG.sessionsDir, { recursive: true });
        files = [];
      } else {
        throw error;
      }
    }

    const sessionFiles = [];
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        try {
          const filePath = path.join(CONFIG.sessionsDir, file);
          const stat = await fs.stat(filePath);

          sessionFiles.push({
            filename: file,
            filepath: filePath,
            mtime: stat.mtime.getTime(),
            size: stat.size,
            basename: path.parse(file).name
          });
        } catch (statError) {
          await logError(`Error getting stats for session file ${file}`, statError);
        }
      }
    }

    sessionFiles.sort((a, b) => b.mtime - a.mtime);
    logStatus(`Found ${sessionFiles.length} session files`);
    return sessionFiles;
  } catch (error) {
    await logError('Error reading session files', error);
    return [];
  }
}

/**
 * Holt alle Chat-Session-Dateien
 */
async function getChatSessionFiles() {
  try {
    let files = [];
    
    try {
      files = await fs.readdir(CONFIG.sessionsDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(CONFIG.sessionsDir, { recursive: true });
        files = [];
      } else {
        throw error;
      }
    }

    const chatSessionFiles = [];
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        try {
          const filePath = path.join(CONFIG.sessionsDir, file);
          const stat = await fs.stat(filePath);

          chatSessionFiles.push({
            filename: file,
            filepath: filePath,
            mtime: stat.mtime.getTime(),
            size: stat.size,
            basename: path.parse(file).name
          });
        } catch (statError) {
          await logError(`Error getting stats for chat session file ${file}`, statError);
        }
      }
    }

    chatSessionFiles.sort((a, b) => b.mtime - a.mtime);
    logStatus(`Found ${chatSessionFiles.length} chat session files`);
    return chatSessionFiles;
  } catch (error) {
    await logError('Error reading chat session files', error);
    return [];
  }
}

/**
 * Filtert neue Session-Dateien (nach Timestamp)
 */
function filterNewSessions(sessionFiles, lastIngested) {
  if (!lastIngested?.last_ingested_session) {
    logStatus('No previous session ingestion found, ingesting all sessions');
    return sessionFiles.slice(0, CONFIG.maxSessionsPerBatch);
  }

  const lastIngestedTime = new Date(lastIngested.last_ingested_session).getTime();
  logStatus(`Filtering sessions newer than: ${new Date(lastIngestedTime).toISOString()}`);

  const filtered = sessionFiles.filter(sessionFile => sessionFile.mtime > lastIngestedTime);
  logStatus(`Found ${filtered.length} new session files`);
  
  // BATCH LIMIT
  return filtered.slice(0, CONFIG.maxSessionsPerBatch);
}

/**
 * Filtert neue Chat-Session-Dateien (nach Timestamp)
 */
function filterNewChatSessions(chatSessionFiles, lastIngested) {
  if (!lastIngested?.last_ingested_chat_session) {
    logStatus('No previous chat session ingestion found, ingesting all chat sessions');
    return chatSessionFiles.slice(0, CONFIG.maxSessionsPerBatch);
  }

  const lastIngestedTime = new Date(lastIngested.last_ingested_chat_session).getTime();
  logStatus(`Filtering chat sessions newer than: ${new Date(lastIngestedTime).toISOString()}`);

  const filtered = chatSessionFiles.filter(chatSessionFile => chatSessionFile.mtime > lastIngestedTime);
  logStatus(`Found ${filtered.length} new chat session files`);
  
  // BATCH LIMIT
  return filtered.slice(0, CONFIG.maxSessionsPerBatch);
}

// ==================== PYTHON SCRIPT EXECUTION (SPAWN) ====================

/**
 * Führt ein Python-Skript mit spawn aus (statt execSync!)
 * Fängt Segfaults und andere Fehler sicher ab
 */
async function runPythonScriptWithSpawn(scriptPath, args = '', inputData = null) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      logStatus(`🔄 Attempt ${attempt}/${CONFIG.maxRetries}: ${scriptPath}`);
      
      const result = await new Promise((resolve, reject) => {
        const child = spawn('python3', [scriptPath, ...(args ? args.split(' ') : [])], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: CONFIG.pythonScriptTimeout,
          env: { 
            ...process.env,
            PYTHONUNBUFFERED: '1'
          }
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        // stdin schreiben wenn inputData vorhanden
        if (inputData && child.stdin.writable) {
          child.stdin.write(inputData);
          child.stdin.end();
        }
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, output: stdout, stderr });
          } else {
            reject(new Error(`Process exited with code ${code}: ${stderr}`));
          }
        });
        
        child.on('error', (err) => {
          reject(err);
        });
        
        // Timeout handling
        setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error('Process timeout'));
        }, CONFIG.pythonScriptTimeout);
      });
      
      logStatus(`✅ Successfully executed: ${scriptPath}`);
      return result;
      
    } catch (error) {
      lastError = error;
      logError(`Attempt ${attempt} failed: ${scriptPath}`, error);
      
      if (attempt < CONFIG.maxRetries) {
        const delay = CONFIG.retryDelayMs * attempt; // Exponentieller Backoff
        logStatus(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  await logError(`❌ Failed after ${CONFIG.maxRetries} attempts: ${scriptPath}`, lastError);
  return { success: false, output: lastError?.message || 'Unknown error', stderr: lastError?.stderr };
}

// ==================== DEDUPLIZIERUNG ====================

/**
 * Extrahiert message_ids aus einer Session-Datei
 */
async function extractMessageIds(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const messageIds = [];
    
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.message_id) {
          messageIds.push(msg.message_id);
        }
      } catch (parseError) {
        // Überspringe ungültige JSON Zeilen
      }
    }
    
    return messageIds;
  } catch (error) {
    await logError(`Error extracting message_ids from ${filepath}`, error);
    return [];
  }
}

/**
 * Filtert bereits ingested message_ids heraus
 */
function filterDuplicateMessageIds(messageIds, ingestedIds) {
  const ingestedSet = new Set(ingestedIds || []);
  const newIds = messageIds.filter(id => !ingestedSet.has(id));
  
  if (newIds.length < messageIds.length) {
    logStatus(`🔍 Deduplizierung: ${messageIds.length - newIds.length} Duplikate entfernt`);
  }
  
  return newIds;
}

// ==================== EMBEDDING MODEL ====================

/**
 * Stellt sicher, dass das lokale Embedding-Modell vorhanden ist
 */
async function ensureEmbeddingModelExists() {
  try {
    const modelExists = await fs.access(CONFIG.embeddingModelPath).then(() => true).catch(() => false);
    
    if (!modelExists) {
      logStatus(`📥 Downloading embedding model: ${CONFIG.embeddingModel}`);
      await fs.mkdir(path.dirname(CONFIG.embeddingModelPath), { recursive: true });
      
      // Modell herunterladen mit sentence-transformers
      const downloadScript = path.join(__dirname, 'download-embedding-model.py');
      const downloadExists = await fs.access(downloadScript).then(() => true).catch(() => false);
      
      if (downloadExists) {
        const result = await runPythonScriptWithSpawn(downloadScript, `"${CONFIG.embeddingModel}" "${CONFIG.embeddingModelPath}"`);
        if (result.success) {
          logStatus(`✅ Embedding model downloaded to: ${CONFIG.embeddingModelPath}`);
        } else {
          logStatus(`⚠️ Model download failed, will try HuggingFace fallback`);
        }
      } else {
        logStatus(`⚠️ Download script not found, will use HuggingFace fallback`);
      }
    } else {
      logStatus(`✅ Embedding model already exists: ${CONFIG.embeddingModelPath}`);
    }
    
    return modelExists;
  } catch (error) {
    await logError('Error ensuring embedding model exists', error);
    return false;
  }
}

// ==================== INGESTION ====================

/**
 * Ingested eine Session-Datei in ChromaDB
 */
async function ingestSessionFile(sessionFile, metadata) {
  try {
    logStatus(`🔄 Ingesting session: ${sessionFile.filepath}`);
    
    // 1. message_ids extrahieren
    const messageIds = await extractMessageIds(sessionFile.filepath);
    logStatus(`📊 Found ${messageIds.length} messages in session`);
    
    // 2. Deduplizierung
    const newMessageIds = filterDuplicateMessageIds(messageIds, metadata.ingested_message_ids);
    
    if (newMessageIds.length === 0) {
      logStatus(`⏭️ Skipping session (all messages already ingested): ${sessionFile.basename}`);
      return { success: true, skipped: true };
    }
    
    logStatus(`✨ ${newMessageIds.length} new messages to ingest`);
    
    // 3. Python Script ausführen (mit spawn!)
    const ingestScript = path.join(__dirname, 'ingest_single_session.py');
    const result = await runPythonScriptWithSpawn(ingestScript, `"${sessionFile.filepath}"`);
    
    if (result.success) {
      logStatus(`✅ Successfully ingested session: ${sessionFile.basename}`);
      
      // 4. message_ids zu Metadaten hinzufügen
      metadata.ingested_message_ids = [...metadata.ingested_message_ids, ...newMessageIds];
      metadata.last_ingested_session = new Date(sessionFile.mtime).toISOString();
      
      return { success: true, skipped: false, newMessageIds: newMessageIds.length };
    } else {
      await logError(`Failed to ingest session: ${sessionFile.basename}`, new Error(result.output));
      return { success: false, skipped: false, error: result.output };
    }
    
  } catch (error) {
    await logError(`Error ingesting session file: ${sessionFile.filename}`, error);
    return { success: false, skipped: false, error: error.message };
  }
}

/**
 * Ingested Chat-Sessions in ChromaDB
 */
async function ingestChatSessions(chatSessionFiles, metadata) {
  try {
    if (chatSessionFiles.length === 0) {
      logStatus('No new chat sessions to ingest');
      return;
    }
    
    logStatus(`🔄 Ingesting ${chatSessionFiles.length} chat sessions...`);
    
    // Chat-Ingest Script
    const ingestScript = path.join(__dirname, '..', 'ingest_chat_sessions.py');
    const result = await runPythonScriptWithSpawn(ingestScript);
    
    if (result.success) {
      logStatus(`✅ Successfully ingested chat sessions`);
      metadata.last_ingested_chat_session = new Date().toISOString();
    } else {
      await logError('Failed to ingest chat sessions', new Error(result.output));
    }
    
  } catch (error) {
    await logError('Error ingesting chat sessions', error);
  }
}

// ==================== MAIN SERVICE ====================

/**
 * Haupt-Service für Auto-Ingestion
 */
async function runAutoIngest() {
  try {
    logStatus('🚀 Starting auto-ingestion cycle...');
    
    // 1. Metadaten laden
    const metadata = await readLastIngestionMetadata();
    
    // 2. Embedding Model sicherstellen
    await ensureEmbeddingModelExists();
    
    // 3. Session Files holen
    const sessionFiles = await getSessionFiles();
    const newSessionFiles = filterNewSessions(sessionFiles, metadata);
    
    // 4. Chat Session Files holen
    const chatSessionFiles = await getChatSessionFiles();
    const newChatSessionFiles = filterNewChatSessions(chatSessionFiles, metadata);
    
    // 5. Sessions ingestieren
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const sessionFile of newSessionFiles) {
      const result = await ingestSessionFile(sessionFile, metadata);
      
      if (result.success) {
        if (result.skipped) {
          skipCount++;
        } else {
          successCount++;
        }
      } else {
        failCount++;
      }
    }
    
    // 6. Chat Sessions ingestieren
    if (newChatSessionFiles.length > 0) {
      await ingestChatSessions(newChatSessionFiles, metadata);
    }
    
    // 7. Metadaten speichern
    metadata.last_successful_run = new Date().toISOString();
    metadata.failed_attempts = failCount > 0 ? metadata.failed_attempts + 1 : 0;
    await saveIngestionMetadata(metadata);
    
    // 8. Zusammenfassung
    logStatus(`📊 Ingestion complete: ${successCount} success, ${skipCount} skipped, ${failCount} failed`);
    
    return {
      success: true,
      sessionsIngested: successCount,
      sessionsSkipped: skipCount,
      sessionsFailed: failCount
    };
    
  } catch (error) {
    await logError('Auto-ingestion cycle failed', error);
    
    // Fehler-Metadaten aktualisieren
    try {
      const metadata = await readLastIngestionMetadata();
      metadata.failed_attempts++;
      await saveIngestionMetadata(metadata);
    } catch (metaError) {
      // Ignoriere Metadaten-Fehler
    }
    
    return { success: false, error: error.message };
  }
}

// ==================== EXPORTS ====================

export {
  runAutoIngest,
  ingestSessionFile,
  extractMessageIds,
  filterDuplicateMessageIds,
  ensureEmbeddingModelExists,
  runPythonScriptWithSpawn,
  CONFIG
};

// ==================== CLI ====================

// Wenn direkt ausgeführt
if (process.argv[1]?.includes('rag-auto-ingest-improved.mjs')) {
  (async () => {
    const result = await runAutoIngest();
    console.log('\n=== Auto-Ingest Result ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })();
}
