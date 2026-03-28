#!/usr/bin/env node

/**
 * Setup-Skript für den verbesserten RAG Auto-Ingest Service
 * 
 * Installiert alle benötigten Abhängigkeiten und richtet den Service ein
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupAutoIngestService() {
  console.log('🔧 Setting up Improved RAG Auto-Ingest Service...\n');
  
  try {
    // 1. Stelle sicher, dass das ChromaDB-Verzeichnis existiert
    console.log('📁 Creating ChromaDB directory...');
    await fs.mkdir('/root/.openclaw/chroma_db', { recursive: true });
    console.log('✅ ChromaDB directory ready\n');
    
    // 2. Installiere benötigte Python-Pakete falls nötig
    console.log('🐍 Checking Python dependencies...');
    try {
      execSync('python3 -c "import chromadb"', { stdio: 'pipe' });
      console.log('✅ chromadb is available');
    } catch (e) {
      console.log('📦 Installing chromadb...');
      execSync('pip install chromadb', { stdio: 'inherit' });
      console.log('✅ chromadb installed');
    }
    
    try {
      execSync('python3 -c "import sentence_transformers"', { stdio: 'pipe' });
      console.log('✅ sentence_transformers is available');
    } catch (e) {
      console.log('📦 Installing sentence_transformers...');
      execSync('pip install sentence-transformers', { stdio: 'inherit' });
      console.log('✅ sentence_transformers installed');
    }
    console.log('');
    
    // 3. Überprüfe, ob die alten Skripte umbenannt werden sollen
    console.log('🔄 Backing up original scripts...');
    const originalScripts = [
      'lib/ingest_agents.py',
      'lib/ingest_single_session.py',
      'ingest_chat_sessions.py'
    ];
    
    for (const script of originalScripts) {
      const originalPath = path.join(__dirname, script);
      const backupPath = path.join(__dirname, script.replace('.py', '_original.py'));
      
      try {
        await fs.access(originalPath);
        console.log(`   Backing up ${script} -> ${script.replace('.py', '_original.py')}`);
        await fs.copyFile(originalPath, backupPath);
      } catch (e) {
        // Datei existiert nicht, das ist ok
        console.log(`   ${script} not found, skipping backup`);
      }
    }
    console.log('');
    
    // 4. Kopiere die verbesserten Skripte an die richtigen Orte
    console.log('🚚 Copying improved scripts to correct locations...');
    
    // Kopiere die verbesserten Python-Skripte
    await fs.copyFile(
      path.join(__dirname, 'lib/ingest_agents_improved.py'),
      path.join(__dirname, 'lib/ingest_agents.py')
    );
    console.log('   Copied ingest_agents_improved.py -> lib/ingest_agents.py');
    
    await fs.copyFile(
      path.join(__dirname, 'lib/ingest_single_session_improved.py'),
      path.join(__dirname, 'lib/ingest_single_session.py')
    );
    console.log('   Copied ingest_single_session_improved.py -> lib/ingest_single_session.py');
    
    await fs.copyFile(
      path.join(__dirname, 'ingest_chat_sessions_improved.py'),
      path.join(__dirname, 'ingest_chat_sessions.py')
    );
    console.log('   Copied ingest_chat_sessions_improved.py -> ingest_chat_sessions.py');
    console.log('');
    
    // 5. Zeige Konfigurationsinformationen
    console.log('⚙️  Configuration:');
    console.log('   - Service runs every 5 minutes');
    console.log('   - Logs to: /root/.openclaw/chroma_db/auto_ingest_status.log');
    console.log('   - Error logs: /root/.openclaw/chroma_db/auto_ingest_errors.log');
    console.log('   - Metadata stored in: /root/.openclaw/chroma_db/auto_ingest_metadata.json');
    console.log('');
    
    // 6. Zeige Beispiel für den Service-Start
    console.log('🚀 To start the service:');
    console.log('   node -e "import(\'./lib/rag-auto-ingest-improved.mjs\').then(m => { const service = m.startAutoIngestService(); console.log(\'Service started!\'); })"');
    console.log('');
    
    console.log('🧪 To run a manual ingestion:');
    console.log('   node -e "import(\'./lib/rag-auto-ingest-improved.mjs\').then(m => m.manualIngestion().then(console.log))"');
    console.log('');
    
    console.log('✅ Setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Führe das Setup aus
setupAutoIngestService();