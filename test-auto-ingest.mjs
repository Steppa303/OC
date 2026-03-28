#!/usr/bin/env node

/**
 * Testskript für den RAG Auto-Ingest Service
 * 
 * Startet den Service und führt eine manuelle Ingestion durch
 */

import { startAutoIngestService, manualIngestion } from './lib/rag-auto-ingest.mjs';

console.log('🧪 Testing RAG Auto-Ingest Service...\n');

async function testService() {
  // Starte den Service mit 1 Minute Intervall für schnelles Testen
  const service = startAutoIngestService(1); // Jede Minute statt alle 5
  
  console.log('✅ Service started with 1-minute intervals\n');
  
  // Führe eine manuelle Ingestion durch
  console.log('🔄 Running initial manual ingestion...');
  const result = await manualIngestion();
  console.log('📋 Manual ingestion result:', result);
  console.log('');
  
  // Warte etwas und zeige Status
  console.log('⏳ Waiting for scheduled ingestion (will run in ~1 minute)...');
  console.log('   Press Ctrl+C to stop the service');
  
  // Halte das Programm am Leben, damit der Interval weiterläuft
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down service...');
    service.stop();
    console.log('👋 Service stopped. Goodbye!');
    process.exit(0);
  });
}

// Starte den Test
testService().catch(console.error);