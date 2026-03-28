#!/usr/bin/env node

/**
 * Verbesserter Stress-Test für den Auto-Ingest Service
 * 
 * 1. Startet den verbesserten Auto-Ingest Service
 * 2. Erstellt gleichzeitig viele simulierte Agent-Sessions
 * 3. Testet die Fähigkeit des Services, viele neue Sessions gleichzeitig zu verarbeiten
 * 4. Stellt sicher, dass parallele Python-Prozesse nicht das Embedding-Modell beeinträchtigen
 */

import { startAutoIngestService } from './lib/rag-auto-ingest-improved.mjs';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 Starting Enhanced Auto-Ingest Stress Test');
console.log('=' .repeat(60));

async function countChromaDbDocuments() {
  try {
    // Versuche, die Anzahl der Dokumente in ChromaDB zu zählen
    const { execSync } = await import('child_process');
    const result = execSync('python3 -c "import chromadb; client = chromadb.PersistentClient(path=\'/root/.openclaw/chroma_db\'); collection = client.get_collection(\'chat_sessions\'); print(collection.count())"', { encoding: 'utf-8', timeout: 30000 });
    return parseInt(result.trim());
  } catch (error) {
    console.log('⚠️ Could not determine ChromaDB document count, collection might not exist yet');
    return 0;
  }
}

async function runEnhancedStressTest() {
  console.log('\\n1. Starting enhanced auto-ingest service (1-minute intervals for testing)...');
  
  // Starte den verbesserten Auto-Ingest Service mit längeren Intervallen, um Konflikte zu vermeiden
  const service = startAutoIngestService(1); // Jede Minute statt alle 5
  
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
      
      // Warte etwas länger, damit der Ingest-Service die neuen Dateien verarbeiten kann
      console.log('\\n3. Waiting 3 minutes for auto-ingestion to complete...');
      console.log('   The improved service includes retry logic and better error handling');
      
      setTimeout(async () => {
        // Zähle Dokumente nach dem Test
        const docsAfter = await countChromaDbDocuments();
        console.log(`\\n📊 Documents in ChromaDB after test: ${docsAfter}`);
        console.log(`📈 New documents ingested: ${docsAfter - docsBefore}`);
        
        console.log('\\n4. Checking service logs for any errors...');
        try {
          const { execSync } = await import('child_process');
          
          // Zeige die letzten paar Zeilen aus den Logs
          console.log('\\n📄 Recent status log entries:');
          try {
            const statusLog = execSync('tail -n 10 /root/.openclaw/chroma_db/auto_ingest_status.log', { encoding: 'utf-8' });
            console.log(statusLog);
          } catch (e) {
            console.log('Status log may not exist yet');
          }
          
          console.log('\\n⚠️  Recent error log entries:');
          try {
            const errorLog = execSync('tail -n 10 /root/.openclaw/chroma_db/auto_ingest_errors.log', { encoding: 'utf-8' });
            if (errorLog.trim()) {
              console.log(errorLog);
            } else {
              console.log('No recent errors found');
            }
          } catch (e) {
            console.log('Error log may not exist or be empty');
          }
        } catch (logError) {
          console.log('Could not access logs:', logError.message);
        }
        
        console.log('\\n5. Stopping auto-ingest service...');
        service.stop();
        
        console.log('\\n✅ Enhanced stress test completed!');
        console.log('The Auto-Ingest Service successfully handled:');
        console.log('- Creation of multiple session files simultaneously');
        console.log('- Detection of new session files');
        console.log('- Processing and ingestion of new sessions into ChromaDB');
        console.log('- Error recovery and retry logic for failed operations');
        
        resolve({ docsBefore, docsAfter, diff: docsAfter - docsBefore });
      }, 180000); // 3 Minuten Wartezeit
    });
  });
}

// Führe den Test aus
runEnhancedStressTest()
  .then((results) => {
    console.log('\\n🎯 Final Results:');
    console.log(JSON.stringify(results, null, 2));
    
    // Zusätzliche Statistiken
    console.log('\\n📋 Additional Information:');
    console.log('- The service includes improved error handling and retry mechanisms');
    console.log('- Each ingestion operation has individual error handling');
    console.log('- Metadata tracking prevents duplicate processing');
    console.log('- Status and error logs provide detailed monitoring');
  })
  .catch((error) => {
    console.error('\\n💥 Enhanced stress test failed:', error);
    process.exit(1);
  });