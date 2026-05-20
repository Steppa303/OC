/**
 * spawnAgent() - Usage Examples & Best Practices
 * 
 * Dieses File zeigt verschiedene Nutzungsmöglichkeiten der spawnAgent() Funktion
 * mit verschiedenen Konfigurationsoptionen und Anwendungsfällen.
 */

import { spawnAgent } from './spawn-agent.mjs';

// =============================================================================
// 1. GRUNDLEGENDER EINSATZ - Simple Subagent
// =============================================================================

async function basicUsage() {
  console.log('=== Basic Usage Example ===');
  
  const result = await spawnAgent({
    label: 'Simple Task Processor',
    task: 'Process simple data transformation',
    model: 'qwen3-coder-next',
    runtime: 'subagent',
    mode: 'run'
  });
  
  console.log('Agent gestartet:', result.sessionKey);
  
  // Warten auf Abschluss
  const completion = await result.waitForCompletion();
  console.log('Agent abgeschlossen:', completion.status);
}

// =============================================================================
// 2. DETAILIERTE PROMPT-VERWENDUNG
// =============================================================================

async function detailedPromptUsage() {
  console.log('=== Detailed Prompt Example ===');
  
  const longPrompt = `
    Bitte führe folgende Analyse durch:
    
    1. Analysiere den Code in /src/main.js
    2. Identifiziere Performance-Probleme
    3. Schlage Optimierungsmöglichkeiten vor
    4. Erstelle einen detaillierten Report
    
    Gehe dabei besonders auf folgende Aspekte ein:
    - Memory Leaks
    - Unnötige Render-Zyklen
    - Ineffiziente Algorithmen
    - Missing error handling
  `;
  
  const result = await spawnAgent({
    label: 'Code Analyzer',
    task: 'Perform detailed code performance analysis',
    prompt: longPrompt,
    model: 'qwen3-coder-plus',
    runtime: 'subagent',
    mode: 'run'
  });
  
  console.log('Analyse-Agent gestartet:', result.sessionKey);
  const completion = await result.waitForCompletion();
  console.log('Analyse abgeschlossen:', completion.status);
}

// =============================================================================
// 3. ACP (Coding Agent) EINSATZ
// =============================================================================

async function acpUsage() {
  console.log('=== ACP Agent Example ===');
  
  const result = await spawnAgent({
    label: 'React Component Builder',
    task: 'Create a responsive React component with Tailwind',
    prompt: `
      Erstelle eine React-Komponente namens UserProfileCard, die:
      - Benutzerbild, Name, Titel, Bio anzeigt
      - Responsive ist (mobile/desktop)
      - Mit TailwindCSS gestyled ist
      - Einen "Follow" Button enthält
      - Ladezustände behandelt
      
      Nutze modernes React mit Hooks und TypeScript.
    `,
    model: 'qwen3-coder-next',
    runtime: 'acp',
    mode: 'run',
    agentId: 'codex' // Oder welcher ACP Agent benötigt wird
  });
  
  console.log('ACP Agent gestartet:', result.sessionKey);
  const completion = await result.waitForCompletion();
  console.log('ACP Aufgabe abgeschlossen:', completion.status);
}

// =============================================================================
// 4. LANGLAUFENDE AUFGABEN MIT HEARTBEAT
// =============================================================================

async function longRunningTask() {
  console.log('=== Long Running Task with Heartbeat ===');
  
  const result = await spawnAgent({
    label: 'Data Processing Pipeline',
    task: 'Process large dataset with multiple transformations',
    prompt: `
      Führe folgende Schritte durch:
      1. Lade CSV Dateien aus /data/input/
      2. Bereinige und validiere Daten
      3. Führe Aggregationen durch
      4. Erstelle Berichte
      5. Exportiere Ergebnisse nach /data/output/
      
      Die Verarbeitung kann mehrere Minuten dauern.
    `,
    model: 'qwen3-coder-plus',
    runtime: 'subagent',
    mode: 'run',
    heartbeatInterval: 15000 // Alle 15 Sekunden Heartbeat
  });
  
  console.log('Langlebiges Task gestartet:', result.sessionKey);
  
  try {
    const completion = await result.waitForCompletion();
    console.log('Task erfolgreich abgeschlossen:', completion.status);
  } catch (error) {
    console.error('Task fehlgeschlagen:', error.message);
  }
}

// =============================================================================
// 5. PERSISTENTE SESSION (THREAD-BOUND)
// =============================================================================

async function persistentSession() {
  console.log('=== Persistent Session Example ===');
  
  const result = await spawnAgent({
    label: 'Research Assistant',
    task: 'Conduct ongoing research on AI trends',
    prompt: `
      Führe kontinuierliche Recherche durch:
      - Verfolge aktuelle AI-Papers
      - Analysiere Markt-Trends
      - Erstelle wöchentliche Zusammenfassungen
      - Aktualisiere Wissensbasis
      
      Diese Session bleibt aktiv und kann über längere Zeit interagieren.
    `,
    model: 'qwen3.5-plus',
    runtime: 'subagent',
    mode: 'session',
    thread: true, // Thread-bound Session
    heartbeatInterval: 30000
  });
  
  console.log('Persistente Session gestartet:', result.sessionKey);
  
  // Für persistente Sessions: einfach laufen lassen
  // Die Session bleibt aktiv bis sie natürlicherweise endet
  await result.waitForCompletion();
  console.log('Persistente Session beendet');
}

// =============================================================================
// 6. FEHLERHAFNGUNG UND TIMEOUTS
// =============================================================================

async function errorHandlingExample() {
  console.log('=== Error Handling Example ===');
  
  try {
    const result = await spawnAgent({
      label: 'Critical Task',
      task: 'Perform critical operation with timeout',
      prompt: 'Führe wichtige Berechnungen durch...',
      model: 'qwen3-coder-plus',
      runtime: 'subagent',
      mode: 'run',
      timeoutSeconds: 300, // 5 Minuten Timeout
      heartbeatInterval: 10000
    });
    
    console.log('Task gestartet mit Timeout:', result.sessionKey);
    const completion = await result.waitForCompletion();
    console.log('Erfolgreich abgeschlossen:', completion.status);
    
  } catch (error) {
    console.error('Task fehlgeschlagen:', error.message);
    
    // Optional: Cleanup durchführen
    // await result.cleanup?.();
  }
}

// =============================================================================
// 7. BEST PRACTICES & DOs/DON'Ts
// =============================================================================

/**
 * ✅ DOs:
 * 
 * 1. Klare, beschreibende Labels verwenden
 * 2. Tasks kurz halten (~80 Zeichen) aber aussagekräftig
 * 3. Detaillierte Prompts separat übergeben wenn nötig
 * 4. Passendes Model für die Aufgabe wählen
 * 5. Heartbeat-Intervall anpassen je nach Task-Dauer
 * 6. Timeouts setzen für langlaufende Tasks
 * 7. Error Handling immer implementieren
 * 8. Session Keys für späteres Tracking speichern
 */

/**
 * ❌ DON'Ts:
 * 
 * 1. Keine sehr langen Tasks direkt in 'task' Feld schreiben
 * 2. Keine sensiblen Daten im Prompt ohne Verschlüsselung
 * 3. Kein hartes Polling von Status (push-basiert nutzen)
 * 4. Keine extrem kurzen Heartbeat-Intervalle (< 5s)
 * 5. Keine sehr langen Prompts inline schreiben
 * 6. Keine synchronen Operationen während Agent läuft blockieren
 */

// =============================================================================
// 8. MODELLAUSWAHL EMPFEHLUNGEN
// =============================================================================

/**
 * Model Empfehlungen basierend auf Aufgabentyp:
 * 
 * Frontend/UI Entwicklung:
 * - qwen3-coder-next (schnell, gut für UI-Code)
 * 
 * Backend/Architektur:
 * - qwen3-coder-plus (tiefer, komplexere Logik)
 * 
 * Analyse/Forschung:
 * - qwen3.5-plus (generalist, web integration)
 * 
 * Testing:
 * - qwen3-coder-plus (gründlich, detailorientiert)
 * 
 * Sprachliche Aufgaben:
 * - qwen3.5-plus (sprachliche Qualität)
 */

// =============================================================================
// 9. KOMPLEXES BEISPIEL - WORKFLOW ORCHESTRATION
// =============================================================================

async function workflowOrchestration() {
  console.log('=== Workflow Orchestration Example ===');
  
  // Mehrere Agenten starten
  const agents = [
    spawnAgent({
      label: 'Data Preparer',
      task: 'Prepare dataset for analysis',
      model: 'qwen3-coder-next',
      runtime: 'subagent',
      mode: 'run'
    }),
    spawnAgent({
      label: 'Analyzer',
      task: 'Analyze prepared data',
      model: 'qwen3-coder-plus',
      runtime: 'subagent',
      mode: 'run'
    }),
    spawnAgent({
      label: 'Reporter',
      task: 'Generate report from analysis',
      model: 'qwen3.5-plus',
      runtime: 'subagent',
      mode: 'run'
    })
  ];
  
  // Alle starten und auf Abschluss warten
  const results = await Promise.all(agents.map(agent => agent.then(r => r.waitForCompletion())));
  
  console.log('Alle Agents abgeschlossen:', results.map(r => r.status));
  
  return results;
}

// =============================================================================
// EXPORT FUNKTIONEN FÜR TESTS
// =============================================================================

export {
  basicUsage,
  detailedPromptUsage,
  acpUsage,
  longRunningTask,
  persistentSession,
  errorHandlingExample,
  workflowOrchestration
};

// Wenn als Skript ausgeführt:
if (typeof require !== 'undefined' && require.main === module) {
  console.log('spawnAgent Examples geladen. Importiere die gewünschten Funktionen.');
}