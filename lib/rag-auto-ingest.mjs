/**
 * RAG Auto-Ingest Service
 * 
 * Automatisches Ingestieren von neuen Sessions und Agents in ChromaDB
 * - Prüft regelmäßig auf neue Sessions/Agents
 * - Ingestet nur NEUE Einträge (keine Duplikate)
 * - Läuft als Background-Service alle 5 Minuten
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Für die Python-basierte ChromaDB-Integration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Metadaten-Datei für letzte Ingestion
const METADATA_FILE = '/root/.openclaw/chroma_db/auto_ingest_metadata.json';

/**
 * Liest die letzte Ingestion-Metadaten
 * @returns {Promise<Object>} Metadaten-Objekt
 */
async function readLastIngestionMetadata() {
  try {
    const content = await fs.readFile(METADATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    // Falls Datei nicht existiert, gib Standard-Werte zurück
    if (error.code === 'ENOENT') {
      return {
        last_ingested_session: null,
        last_ingested_agent: null
      };
    }
    throw error;
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
  } catch (error) {
    console.error(`❌ Error saving ingestion metadata: ${error.message}`);
  }
}

/**
 * Holt alle Session-Dateien mit ihren Änderungszeiten
 * @returns {Promise<Array>} Array von Session-Datei-Infos
 */
async function getSessionFiles() {
  try {
    const sessionsDir = '/root/.openclaw/agents/main/sessions/';
    const files = await fs.readdir(sessionsDir);

    const sessionFiles = [];
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const filePath = path.join(sessionsDir, file);
        const stat = await fs.stat(filePath);

        sessionFiles.push({
          filename: file,
          filepath: filePath,
          mtime: stat.mtime.getTime(), // Modification time als Unix timestamp
          basename: path.parse(file).name
        });
      }
    }

    // Sortiere nach Änderungszeit (neueste zuerst)
    sessionFiles.sort((a, b) => b.mtime - a.mtime);

    return sessionFiles;
  } catch (error) {
    console.error(`❌ Error reading session files: ${error.message}`);
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
    // Wenn keine letzte Session bekannt, nimm alle
    return sessionFiles;
  }

  // Finde die Session, die zuletzt ingested wurde
  const lastIngestedTime = new Date(lastIngested.last_ingested_session).getTime();

  // Filtere nur Session-Dateien, die nach der letzten Ingestion geändert wurden
  return sessionFiles.filter(sessionFile => sessionFile.mtime > lastIngestedTime);
}

/**
 * Ingestet eine einzelne Session-Datei in ChromaDB
 * @param {string} sessionFilePath - Pfad zur Session-Datei
 * @returns {Promise<boolean>} Erfolg/Fehlschlag
 */
async function ingestSingleSession(sessionFilePath) {
  try {
    console.log(`🔄 Ingesting session: ${sessionFilePath}`);

    // Führe das Python-Skript für die Session-Ingestion aus
    const pythonScriptPath = path.join(__dirname, 'ingest_single_session.py');
    const result = execSync(`python3 ${pythonScriptPath} "${sessionFilePath}"`, { 
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 300000 // 5 Minuten Timeout
    });

    console.log(`✅ Successfully ingested session: ${sessionFilePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error ingesting session ${sessionFilePath}: ${error.message}`);
    return false;
  }
}

/**
 * Holt neue Agent-Daten von der API
 * @returns {Promise<Array>} Array von Agent-Objekten
 */
async function getNewAgents(lastIngested) {
  try {
    const response = await fetch('http://localhost:3002/api/agents');
    const data = await response.json();

    if (!data.agents || !Array.isArray(data.agents)) {
      console.error('❌ Invalid response format from agents API');
      return [];
    }

    const agents = data.agents;

    if (!lastIngested?.last_ingested_agent) {
      // Wenn keine letzte Agent-ID bekannt, nimm alle
      return agents;
    }

    // Filtere nur Agenten, die nach der letzten Ingestion erstellt wurden
    // Basierend auf der ID (angenommen höhere IDs sind neuer)
    const lastIngestedId = parseInt(lastIngested.last_ingested_agent);
    return agents.filter(agent => parseInt(agent.id) > lastIngestedId);
  } catch (error) {
    console.error(`❌ Error fetching agents: ${error.message}`);
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
    console.log('⏭️  No new agents to ingest');
    return true;
  }

  try {
    console.log(`🔄 Ingesting ${agents.length} new agents to ChromaDB...`);

    // Führe das Python-Skript für die Agent-Ingestion aus
    const pythonScriptPath = path.join(__dirname, 'ingest_agents.py');
    const agentsJson = JSON.stringify(agents);
    
    const result = execSync(`echo '${agentsJson}' | python3 ${pythonScriptPath}`, { 
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 300000 // 5 Minuten Timeout
    });

    console.log(`✅ Successfully ingested ${agents.length} agents to ChromaDB!`);
    return true;
  } catch (error) {
    console.error(`❌ Error ingesting agents to ChromaDB: ${error.message}`);
    return false;
  }
}

/**
 * Führt einen vollständigen Ingestion-Durchlauf durch
 * @returns {Promise<Object>} Ergebnis des Durchlaufs
 */
export async function runAutoIngestion() {
  console.log('🔄 Running auto-ingestion cycle...');

  try {
    // Lese letzte Ingestion-Metadaten
    const lastIngested = await readLastIngestionMetadata();
    console.log(`📋 Last ingestion metadata:`, lastIngested);

    // Hole alle Session-Dateien
    const allSessionFiles = await getSessionFiles();
    console.log(`📁 Found ${allSessionFiles.length} session files`);

    // Filtere nur neue Session-Dateien
    const newSessionFiles = filterNewSessions(allSessionFiles, lastIngested);
    console.log(`🆕 Found ${newSessionFiles.length} new session files to ingest`);

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
        console.error(`❌ Error processing session ${sessionFile.filepath}: ${error.message}`);
        sessionsFailed++;
      }
    }

    // Hole neue Agent-Daten
    const newAgents = await getNewAgents(lastIngested);
    console.log(`🆕 Found ${newAgents.length} new agents to ingest`);

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

    // Aktualisiere die Metadaten mit den neuesten IDs/Werten
    const updatedMetadata = { ...lastIngested };

    if (newSessionFiles.length > 0) {
      // Nehme die Änderungszeit der neuesten Session-Datei
      const latestSession = newSessionFiles[0];
      updatedMetadata.last_ingested_session = new Date(latestSession.mtime).toISOString();
    }

    if (newAgents.length > 0) {
      // Nehme die höchste Agent-ID
      const highestAgentId = Math.max(...newAgents.map(agent => parseInt(agent.id)));
      updatedMetadata.last_ingested_agent = highestAgentId.toString();
    }

    // Speichere aktualisierte Metadaten
    await saveIngestionMetadata(updatedMetadata);

    console.log(`✅ Auto-ingestion cycle completed:`);
    console.log(`   - Sessions processed: ${sessionsProcessed} (failed: ${sessionsFailed})`);
    console.log(`   - Agents processed: ${agentsProcessed} (failed: ${agentsFailed})`);
    console.log(`   - Updated metadata: `, updatedMetadata);

    return {
      success: true,
      sessionsProcessed,
      sessionsFailed,
      agentsProcessed,
      agentsFailed,
      metadata: updatedMetadata
    };
  } catch (error) {
    console.error(`❌ Error in auto-ingestion cycle: ${error.message}`);
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
export function startAutoIngestService(intervalMinutes = 5) {
  console.log(`🔄 Starting auto-ingest service (every ${intervalMinutes} minutes)...`);

  const intervalId = setInterval(async () => {
    try {
      console.log(`⏰ Scheduled auto-ingestion cycle starting...`);
      await runAutoIngestion();
    } catch (error) {
      console.error(`❌ Error in scheduled auto-ingestion: ${error.message}`);
    }
  }, intervalMinutes * 60 * 1000);

  return {
    intervalId,
    stop: () => {
      clearInterval(intervalId);
      console.log(`⏹️  Auto-ingest service stopped`);
    }
  };
}

/**
 * Manuelle Ingestion-Funktion
 * @returns {Promise<Object>} Ergebnis der manuellen Ingestion
 */
export async function manualIngestion() {
  console.log('>manual ingestion triggered...');
  return await runAutoIngestion();
}

export default {
  runAutoIngestion,
  startAutoIngestService,
  manualIngestion
};