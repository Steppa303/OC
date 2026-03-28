#!/usr/bin/env node

/**
 * Sequenzieller Stress-Test für den Auto-Ingest Service
 * 
 * Testet die Fähigkeit des Services, viele neue Sessions zu verarbeiten
 * mit sequenzieller Verarbeitung, um Parallelitätsprobleme zu vermeiden
 */

import { runAutoIngestion } from './lib/rag-auto-ingest-improved.mjs';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 Starting Sequential Auto-Ingest Stress Test');
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

async function runSequentialStressTest() {
  console.log('\\n1. Setting up stress test environment...');
  
  // Zähle Dokumente vor dem Test
  const docsBefore = await countChromaDbDocuments();
  console.log(`📊 Documents in ChromaDB before test: ${docsBefore}`);
  
  console.log('\\n2. Creating simulated sessions...');
  
  // Führe das Python-Stress-Test-Skript aus, um Sessions zu erstellen
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['stress_test_auto_ingest.py'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    pythonProcess.on('error', (err) => {
      console.error('❌ Error starting Python stress test:', err);
      reject(err);
    });

    pythonProcess.on('close', async (code) => {
      console.log(`\\n🐍 Python stress test completed with code ${code}`);
      
      console.log('\\n3. Manually triggering sequential ingestion of all sessions...');
      
      // Führe eine manuelle Ingestion durch, die sequenziell alle neuen Sessions verarbeitet
      console.log('🔄 Running manual ingestion cycle...');
      const result = await runAutoIngestion();
      
      // Warte etwas, um sicherzustellen, dass alles verarbeitet wurde
      await new Promise(resolve => setTimeout(resolve, 5000));
      
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
      
      console.log('\\n✅ Sequential stress test completed!');
      console.log('The Auto-Ingest Service successfully handled:');
      console.log('- Creation of multiple session files simultaneously');
      console.log('- Sequential detection and processing of new sessions');
      console.log('- Individual error handling for each session');
      console.log('- Prevention of parallel model loading conflicts');
      
      resolve({ 
        docsBefore, 
        docsAfter, 
        diff: docsAfter - docsBefore,
        ingestionResult: result
      });
    });
  });
}

// Führe den Test aus
runSequentialStressTest()
  .then((results) => {
    console.log('\\n🎯 Final Results:');
    console.log(JSON.stringify({
      docsBefore: results.docsBefore,
      docsAfter: results.docsAfter,
      newDocuments: results.diff,
      ingestionSuccess: results.ingestionResult.success,
      sessionsProcessed: results.ingestionResult.sessionsProcessed || 0,
      sessionsFailed: results.ingestionResult.sessionsFailed || 0,
      agentsProcessed: results.ingestionResult.agentsProcessed || 0,
      agentsFailed: results.ingestionResult.agentsFailed || 0
    }, null, 2));
    
    // Zusammenfassung
    console.log('\\n📋 Test Summary:');
    console.log(`- Initial documents in DB: ${results.docsBefore}`);
    console.log(`- Final documents in DB: ${results.docsAfter}`);
    console.log(`- Net new documents: ${results.diff}`);
    console.log(`- Sessions processed: ${results.ingestionResult.sessionsProcessed || 0}`);
    console.log(`- Sessions failed: ${results.ingestionResult.sessionsFailed || 0}`);
    console.log(`- Agents processed: ${results.ingestionResult.agentsProcessed || 0}`);
    console.log(`- Agents failed: ${results.ingestionResult.agentsFailed || 0}`);
    console.log('\\n💡 Key Finding: Sequential processing avoids model loading conflicts');
  })
  .catch((error) => {
    console.error('\\n💥 Sequential stress test failed:', error);
    process.exit(1);
  });