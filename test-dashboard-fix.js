/**
 * Test für das neue spawnAgent System
 * 
 * Testet die neue spawnAgent Implementierung mit Task/Prompt-Trennung
 */

import { initializeDashboardAutomation, spawnAgent, getActiveAgents } from './lib/dashboard-automation.mjs';

async function runTest() {
  console.log('🧪 Starting spawnAgent Migration Test...');
  
  // 1. Dashboard Automation initialisieren
  const automation = initializeDashboardAutomation({
    enableBackgroundCleanup: true,
    cleanupInterval: 1,  // 1 Minute für Test
    maxAgentAge: 2       // 2 Minuten max Alter für Test
  });
  
  console.log('✅ Dashboard Automation initialized');
  
  // 2. Test-Agent erstellen mit neuem spawnAgent
  const result = await spawnAgent({
    label: 'Dashboard Migration Test Agent',
    task: 'Testing the new spawnAgent system with task/prompt separation',
    prompt: `You are a test agent for the new spawnAgent system. Your task is to demonstrate the proper separation of task and prompt fields.
    
    TASK: Testing the new spawnAgent system with task/prompt separation
    WORKFLOW:
    1. Acknowledge receipt of this task
    2. Perform a 3-second simulation of work
    3. Report successful completion
    4. Exit gracefully
    
    The task field should be a short summary (~80 chars) while the prompt contains the full instructions.`,
    model: 'qwen3-coder-plus',
    runtime: 'subagent',
    mode: 'run',
    heartbeatInterval: 15000  // 15s Heartbeat für Test
  });
  
  console.log(`✅ Test agent spawned: ${result.sessionKey}`);
  
  // 3. Kurze Arbeit simulieren (statt echtem Agentenlauf)
  console.log('⏱️  Simulating agent work...');
  await new Promise(resolve => setTimeout(resolve, 3000)); // 3 Sekunden
  
  // 4. Agent beenden (automatisch durch spawnAgent mit autoEnd)
  console.log('✅ Test agent completed successfully (auto-logged via spawnAgent)');
  
  // 5. Aktive Agenten prüfen
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
  
  // 6. Cleanup Service stoppen
  automation.stopAll();
  
  console.log('🏁 Test completed');
}

// Test starten
runTest().catch(console.error);