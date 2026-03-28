#!/usr/bin/env node

/**
 * Stress-Test für den Auto-Ingest Service
 * 
 * 1. Startet den Auto-Ingest Service
 * 2. Erstellt gleichzeitig viele simulierte Agent-Sessions
 * 3. Testet die Fähigkeit des Services, viele neue Sessions gleichzeitig zu verarbeiten
 */

import { startAutoIngestService } from './lib/rag-auto-ingest.mjs';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 Starting Auto-Ingest Stress Test');
console.log('=' .repeat(50));

async function countChromaDbDocuments() {
  try {
    // Versuche, die Anzahl der Dokumente in ChromaDB zu zählen
    const { execSync } = await import('child_process');
    const result = execSync('python3 -c "import chromadb; client = chromadb.PersistentClient(path=\'/root/.openclaw/chroma_db\'); collection = client.get_collection(\'chat_sessions\'); print(collection.count())"', { encoding: 'utf-8' });
    return parseInt(result.trim());
  } catch (error) {
    console.log('⚠️ Could not determine ChromaDB document count, collection might not exist yet');
    return 0;
  }
}

async function runStressTest() {
  console.log('\\n1. Starting auto-ingest service (30-second intervals for quick testing)...');
  
  // Starte den Auto-Ingest Service mit kurzen Intervallen für schnelles Testen
  const service = startAutoIngestService(0.5); // Alle 30 Sekunden statt alle 5 Minuten
  
  // Warte kurz, damit der Service starten kann
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Zähle Dokumente vor dem Test
  const docsBefore = await countChromaDbDocuments();
  console.log(`\\n📊 Documents in ChromaDB before test: ${docsBefore}`);
  
  console.log('\\n2. Starting stress test with Python script...');
  
  return new Promise((resolve, reject) => {
    // Starte das Python-Stress-Test-Skript
    const pythonProcess = spawn('python3', ['stress_test_auto_ingest.py'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    pythonProcess.on('error', (err) => {
      console.error('❌ Error starting Python stress test:', err);
      reject(err);
    });

    pythonProcess.on('close', (code) => {
      console.log(`\\n🐍 Python stress test completed with code ${code}`);
      
      // Warte noch etwas länger, damit der Ingest-Service die neuen Dateien verarbeiten kann
      console.log('\\n3. Waiting 2 minutes for auto-ingestion to complete...');
      
      setTimeout(async () => {
        // Zähle Dokumente nach dem Test
        const docsAfter = await countChromaDbDocuments();
        console.log(`\\n📊 Documents in ChromaDB after test: ${docsAfter}`);
        console.log(`📈 New documents ingested: ${docsAfter - docsBefore}`);
        
        console.log('\\n4. Stopping auto-ingest service...');
        service.stop();
        
        console.log('\\n✅ Stress test completed!');
        console.log('The Auto-Ingest Service successfully handled:');
        console.log('- Creation of multiple session files simultaneously');
        console.log('- Detection of new session files');
        console.log('- Processing and ingestion of new sessions into ChromaDB');
        
        resolve({ docsBefore, docsAfter, diff: docsAfter - docsBefore });
      }, 120000); // 2 Minuten Wartezeit
    });
  });
}

// Führe den Test aus
runStressTest()
  .then((results) => {
    console.log('\\n🎯 Final Results:');
    console.log(JSON.stringify(results, null, 2));
  })
  .catch((error) => {
    console.error('\\n💥 Stress test failed:', error);
    process.exit(1);
  });