#!/usr/bin/env node

/**
 * Startskript für den verbesserten RAG Auto-Ingest Service
 */

import { startAutoIngestService, manualIngestion, checkServiceStatus } from './lib/rag-auto-ingest-improved.mjs';

async function startService() {
  console.log('🚀 Starting Improved RAG Auto-Ingest Service...\n');
  
  // Starte den Service mit 5-Minuten-Intervall (Produktionseinstellung)
  const service = startAutoIngestService(5);
  
  console.log('✅ Service started with 5-minute intervals (production setting)');
  console.log('📊 Service is now monitoring and ingesting new sessions and agents');
  console.log('📈 Check logs at /root/.openclaw/chroma_db/auto_ingest_status.log');
  console.log('🚨 Errors logged at /root/.openclaw/chroma_db/auto_ingest_errors.log');
  console.log('');
  
  // Führe eine initiale manuelle Ingestion durch
  console.log('🔄 Executing initial ingestion cycle...');
  const initialResult = await manualIngestion();
  console.log(`   Initial ingestion result: ${initialResult.success ? 'SUCCESS' : 'FAILED'}`);
  if (initialResult.success) {
    console.log(`   - Sessions processed: ${initialResult.sessionsProcessed}`);
    console.log(`   - Agents processed: ${initialResult.agentsProcessed}`);
    console.log(`   - Duration: ${initialResult.duration}ms`);
  }
  console.log('');
  
  // Zeige aktuellen Status
  const status = await checkServiceStatus();
  console.log(`📈 Current service status:`);
  console.log(`   - Timestamp: ${status.timestamp}`);
  console.log(`   - Service running: ${status.serviceRunning}`);
  console.log(`   - Uptime: ${Math.round(status.uptime)} seconds`);
  console.log(`   - Platform: ${status.platform}-${status.arch}`);
  console.log('');
  
  console.log('🎉 Improved RAG Auto-Ingest Service is now fully operational!');
  console.log('');
  console.log('🛡️  Robust features active:');
  console.log('   • Automatic retry on failures');
  console.log('   • Comprehensive error logging');
  console.log('   • Incremental ingestion (no duplicates)');
  console.log('   • Both agent and chat session ingestion');
  console.log('   • Health monitoring and status reporting');
  console.log('');
  console.log('🔄 The service will continue running and check for new data every 5 minutes');
  console.log('🔄 Press Ctrl+C to stop the service');
  
  // Halte den Prozess am Laufen
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down improved RAG Auto-Ingest Service...');
    service.stop();
    console.log('👋 Service stopped gracefully. Goodbye!');
    process.exit(0);
  });
}

// Starte die Funktion
startService().catch(console.error);