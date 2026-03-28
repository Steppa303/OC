/**
 * Test für die neue spawnAgent Funktionalität
 * 
 * Überprüft, ob die Migration korrekt funktioniert
 */

import { spawnAgent } from './lib/spawn-agent.mjs';

async function testSpawnAgent() {
  console.log('🧪 Testing spawnAgent functionality...');
  
  try {
    // Test-Aufruf mit allen Optionen
    const result = await spawnAgent({
      label: 'Migration Test Agent',
      task: 'Testing spawnAgent with full options',
      prompt: `You are a test agent to verify spawnAgent functionality.

TASK: Testing spawnAgent with full options
WORKFLOW:
1. Confirm you received this prompt
2. Demonstrate proper task/prompt separation
3. Complete successfully`,
      model: 'qwen3-coder-plus',
      runtime: 'subagent',
      mode: 'run',
      heartbeatInterval: 10000, // 10s für Test
      autoEnd: true
    });
    
    console.log('✅ spawnAgent call successful!');
    console.log('Session Key:', result.sessionKey);
    console.log('Has waitForCompletion:', typeof result.waitForCompletion);
    console.log('Has cancelHeartbeat:', typeof result.cancelHeartbeat);
    console.log('Has cleanup:', typeof result.cleanup);
    
    // Test heartbeat cancellation
    result.cancelHeartbeat();
    console.log('✅ Heartbeat cancellation test passed');
    
    // Test cleanup
    await result.cleanup('completed', null);
    console.log('✅ Cleanup test passed');
    
    console.log('🎉 All spawnAgent tests passed!');
    
  } catch (error) {
    console.error('❌ spawnAgent test failed:', error);
    throw error;
  }
}

// Test ausführen
testSpawnAgent().catch(console.error);