#!/usr/bin/env node
/**
 * Update Agent Prompts from Session History
 * 
 * This script extracts the full prompt/task from OpenClaw session history
 * and updates the agent_activities table with proper task/prompt separation:
 * - task: First line or ~80 chars (summary)
 * - prompt: Complete original task string
 * 
 * Usage:
 *   node update-agent-prompts.js [--limit N] [--session-key KEY]
 */

const { execSync } = require('child_process');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'webapp',
  host: 'localhost',
  database: 'webapp_db',
  password: 'db#Jungle68',
  port: 5432,
});

async function getSessionHistory(sessionKey) {
  try {
    // Use openclaw CLI to get session history
    const result = execSync(`openclaw sessions history --session "${sessionKey}" --limit 5`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    
    return result;
  } catch (error) {
    console.error(`Failed to fetch history for ${sessionKey}:`, error.message);
    return null;
  }
}

async function updateAgentPrompt(sessionKey, fullTask) {
  if (!fullTask || fullTask.trim() === '') {
    console.log(`⚠️  Skipping ${sessionKey}: No task found`);
    return;
  }
  
  // Extract summary (first line or 80 chars)
  const firstLine = fullTask.split('\n')[0];
  const taskSummary = firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine;
  
  try {
    await pool.query(`
      UPDATE agent_activities 
      SET task = $1, prompt = $2
      WHERE session_key = $3
    `, [taskSummary, fullTask, sessionKey]);
    
    console.log(`✅ Updated ${sessionKey}`);
    console.log(`   Task: ${taskSummary}`);
    console.log(`   Prompt length: ${fullTask.length} chars`);
  } catch (error) {
    console.error(`❌ Failed to update ${sessionKey}:`, error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.indexOf('--limit');
  const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) : 50;
  const sessionKeyArg = args.indexOf('--session-key');
  const specificSession = sessionKeyArg !== -1 ? args[sessionKeyArg + 1] : null;
  
  console.log('🔍 Fetching agents from database...\n');
  
  let agents;
  
  if (specificSession) {
    // Fetch specific session
    const result = await pool.query(`
      SELECT session_key, label, task, prompt 
      FROM agent_activities 
      WHERE session_key = $1
    `, [specificSession]);
    agents = result.rows;
  } else {
    // Fetch recent agents where task === prompt (need updating)
    const result = await pool.query(`
      SELECT session_key, label, task, prompt, LENGTH(task) as task_len, LENGTH(prompt) as prompt_len
      FROM agent_activities 
      WHERE task = prompt 
        AND LENGTH(task) > 80  -- Only long tasks that would benefit from summarization
        AND status IN ('done', 'running', 'pending')
      ORDER BY started_at DESC
      LIMIT $1
    `, [limit]);
    agents = result.rows;
  }
  
  if (agents.length === 0) {
    console.log('No agents need updating.');
    await pool.end();
    return;
  }
  
  console.log(`Found ${agents.length} agents to update:\n`);
  
  for (const agent of agents) {
    console.log(`Processing: ${agent.label} (${agent.session_key})`);
    
    // Currently task === prompt, so we use the existing task as the "full prompt"
    // In a real scenario, you'd fetch the actual session history here
    const fullTask = agent.task; // This is already the full task since task === prompt
    
    await updateAgentPrompt(agent.session_key, fullTask);
    console.log('');
  }
  
  console.log('✅ Done!');
  await pool.end();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
