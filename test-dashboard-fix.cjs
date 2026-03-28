/**
 * Test für das Dashboard Cleanup Problem (CommonJS Version)
 * 
 * Testet die neue automatische Logging-Implementierung
 */

const { 
  logAgentStart, 
  logAgentEnd, 
  getActiveAgents,
  getAgentActivities 
} = require('./lib/agent-logger.js');

// Import der automatischen Logging-Funktionen (als separate Module)
const fs = require('fs');
const path = require('path');

// Dynamische Imports für ES-Module Funktionen
async function importESM(modulePath) {
  const moduleUrl = `file://${path.resolve(modulePath)}`;
  return await import(moduleUrl);
}

async function runTest() {
  console.log('🧪 Starting Dashboard Cleanup Test...');
  
  // 1. Test-Agent starten mit Logging
  const sessionKey = `test-agent-${Date.now()}`;
  const startTime = Date.now();
  
  await logAgentStart(
    sessionKey,
    'Dashboard Reliability Test Agent',
    'Testing the new automated dashboard cleanup system',
    'qwen3-coder-plus'
  );
  
  console.log(`✅ Test agent logged as running: ${sessionKey}`);
  
  // 2. Kurze Arbeit simulieren
  console.log('⏱️  Simulating agent work...');
  await new Promise(resolve => setTimeout(resolve, 3000)); // 3 Sekunden
  
  // 3. Erfolgreich abschließen
  const runtime = Date.now() - startTime;
  await logAgentEnd(sessionKey, 'done', runtime);
  console.log(`✅ Test agent completed successfully in ${runtime}ms`);
  
  // 4. Aktive Agenten prüfen - sollte jetzt leer sein
  const activeAgents = await getActiveAgents();
  console.log(`📊 Currently active agents: ${activeAgents.length}`);
  
  if (activeAgents.length === 0) {
    console.log('✅ SUCCESS: No active agents remaining - cleanup working!');
  } else {
    console.log('⚠️  WARNING: Still have active agents:');
    activeAgents.forEach(agent => {
      console.log(`   - ${agent.label} (${agent.session_key}): ${agent.status} since ${agent.started_at}`);
    });
  }
  
  // 5. Prüfe, ob der abgeschlossene Agent in der Gesamtliste ist
  const allAgents = await getAgentActivities(10);
  const ourAgent = allAgents.find(agent => agent.session_key === sessionKey);
  
  if (ourAgent && ourAgent.status === 'done') {
    console.log(`✅ SUCCESS: Our test agent correctly marked as 'done': ${ourAgent.label}`);
  } else {
    console.log(`❌ ERROR: Test agent not found or not marked as done`);
  }
  
  console.log('🏁 Test completed');
}

// Test starten
runTest().catch(console.error);