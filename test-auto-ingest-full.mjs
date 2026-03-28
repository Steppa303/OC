#!/usr/bin/env node

/**
 * Test für den RAG Auto-Ingest Service
 * 
 * 1. Startet den Auto-Ingest Service
 * 2. Simuliert das Erstellen eines neuen Agenten (über API-Aufruf)
 * 3. Wartet auf automatische Ingestion
 */

import { startAutoIngestService } from './lib/rag-auto-ingest.mjs';

console.log('🧪 Testing RAG Auto-Ingest Service...\n');

async function testAutoIngest() {
  console.log('1. Starting auto-ingest service (1-minute intervals)...');
  const service = startAutoIngestService(1);
  
  console.log('\n2. The service is now running and will check for new sessions/agents every minute.');
  console.log('   To properly test, create a new agent manually while this service runs.');
  console.log('   The service will automatically detect and ingest new data.');
  
  console.log('\n3. Waiting 3 minutes for potential auto-ingestion...');
  
  // Warte 3 Minuten
  await new Promise(resolve => setTimeout(resolve, 180000)); // 3 Minuten
  
  console.log('\n4. Test completed. Stopping service...');
  service.stop();
  
  console.log('✅ Test finished! Check ChromaDB collections for ingested data.');
}

// Starte den Test
testAutoIngest().catch(console.error);