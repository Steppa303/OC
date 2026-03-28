/**
 * Example usage of the Melody Generator
 * React component demonstrating how to use the melody generation functions
 */

import React, { useState, useEffect } from 'react';
import { generateMelody, generateRhythm, combineMelodyWithRhythm, SCALES, RHYTHMS } from './melodyGenerator';

// ============================================================
// COMPONENT: Melody Generator UI
// ============================================================

function MelodyGenerator() {
  const [scale, setScale] = useState('C-Dur');
  const [length, setLength] = useState(16);
  const [chaosLevel, setChaosLevel] = useState(0.3);
  const [rhythmType, setRhythmType] = useState('achtel');
  const [melody, setMelody] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);

  // Generate initial melody on mount
  useEffect(() => {
    handleGenerate();
  }, []);

  // Generate melody when options change
  useEffect(() => {
    handleGenerate();
  }, [scale, length, chaosLevel, rhythmType]);

  const handleGenerate = () => {
    // Generate rhythm first
    const rhythm = generateRhythm({
      length: length,
      rhythmType: rhythmType,
      chaosLevel: chaosLevel * 0.5 // Less chaos for rhythm than melody
    });

    // Generate melody
    const baseMelody = generateMelody({
      scaleName: scale,
      length: length,
      chaosLevel: chaosLevel,
      octaves: [4, 5] // Use octaves 4 and 5
    });

    // Combine melody with rhythm
    const finalMelody = combineMelodyWithRhythm(baseMelody, rhythm);
    
    setMelody(finalMelody);
    setGeneratedAt(new Date());
  };

  const getScaleDegrees = (scaleName) => {
    const scaleData = SCALES[scaleName];
    if (!scaleData) return [];
    
    const rootIndex = NOTES.indexOf(scaleData.root);
    const degrees = scaleData.intervals.map(interval => {
      const noteIndex = (rootIndex + interval) % NOTES.length;
      return NOTES[noteIndex];
    });
    return degrees;
  };

  return (
    <div className="melody-generator p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">🎵 Melodie Generator</h1>

      {/* Controls Section */}
      <div className="space-y-6 mb-8">
        {/* Scale Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Tonart / Scale</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.keys(SCALES).map(scaleName => (
              <button
                key={scaleName}
                onClick={() => setScale(scaleName)}
                className={`p-2 rounded-lg transition-colors ${
                  scale === scaleName
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                {scaleName}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Skalenstufen: {getScaleDegrees(scale).join(' - ')}
          </p>
        </div>

        {/* Length & Chaos Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Länge: {length} Noten
            </label>
            <input
              type="range"
              min="4"
              max="64"
              step="4"
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Chaos-Level: {(chaosLevel * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={chaosLevel}
              onChange={(e) => setChaosLevel(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Rhythm Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Rhythmus-Typ</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(RHYTHMS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setRhythmType(key)}
                className={`p-2 rounded-lg transition-colors ${
                  rhythmType === key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)} ({value}T)
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg transition-all transform hover:scale-105"
      >
        🎼 Neue Melodie generieren
      </button>

      {/* Results Section */}
      {melody.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Generierte Melodie</h2>
            <span className="text-sm text-gray-400">
              Generiert: {generatedAt?.toLocaleTimeString()}
            </span>
          </div>

          {/* Melody Visualization */}
          <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
            <div className="flex items-center space-x-1 min-w-max">
              {melody.map((note, index) => (
                <div
                  key={index}
                  className={`
                    h-12 rounded flex items-center justify-center transition-all duration-300
                    ${note.duration === 0.25 ? 'w-8' : note.duration === 0.5 ? 'w-12' : 'w-16'}
                    bg-gradient-to-b from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500
                  `}
                  style={{
                    height: `${Math.max(48, 24 + note.frequency / 50)}px`,
                    opacity: Math.min(1, 0.5 + note.frequency / 600)
                  }}
                >
                  <span className="text-xs font-mono text-white">{note.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400">Allgemein</h3>
              <p className="text-sm text-gray-300 mt-2">
                <strong>Scale:</strong> {scale}<br/>
                <strong>Länge:</strong> {melody.length} Noten<br/>
                <strong>Dauer:</strong> {melody[melody.length - 1]?.startTime + melody[melody.length - 1]?.duration || 0} Takte
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-400">Chaos-Effekte</h3>
              <p className="text-sm text-gray-300 mt-2">
                <strong>Level:</strong> {(chaosLevel * 100).toFixed(0)}%<br/>
                <strong>Rhythmik:</strong> {rhythmType}<br/>
                <strong>Pitch-Bending:</strong> {chaosLevel > 0.4 ? 'Aktiv' : 'Deaktiviert'}
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-400">Statistik</h3>
              <p className="text-sm text-gray-300 mt-2">
                <strong>Höchste Note:</strong> {Math.max(...melody.map(n => n.frequency)).toFixed(0)} Hz<br/>
                <strong>Niedrigste Note:</strong> {Math.min(...melody.map(n => n.frequency)).toFixed(0)} Hz<br/>
                <strong>Durchschnitt:</strong> {(melody.reduce((sum, n) => sum + n.frequency, 0) / melody.length).toFixed(0)} Hz
              </p>
            </div>
          </div>

          {/* JSON Output Preview */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">JSON Output (Auszug)</h3>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm font-mono text-green-400">
                {JSON.stringify(melody.slice(0, 5), null, 2)}
                {melody.length > 5 && <span className="text-gray-500">... ({melody.length} Noten total)</span>}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-400 mb-2">📚 How to use this in your app:</h3>
        <div className="text-sm text-gray-300 space-y-2">
          <pre className="bg-black/50 p-2 rounded overflow-x-auto">
            <code>{`
import { generateMelody, generateRhythm } from './melodyGenerator';

// Generate a melody
const melody = generateMelody({
  scaleName: 'C-Dur',
  length: 16,
  chaosLevel: 0.3,
  octaves: [4, 5]
});

// Use frequencies with Web Audio API
const playMelody = (melody) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  melody.forEach(note => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = note.frequency;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start(note.startTime * 0.5); // Adjust multiplier for tempo
    oscillator.stop(note.startTime * 0.5 + note.duration * 0.5);
  });
};
            `}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

// Export the generator functions for use without the UI
export { generateMelody, generateRhythm, combineMelodyWithRhythm, SCALES, RHYTHMS };

// Export the component
export default MelodyGenerator;
