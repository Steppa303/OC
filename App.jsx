import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';

const App = () => {
  // Audio context reference
  const audioContextRef = useRef(null);
  const oscillatorsRef = useRef([]);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  // State management
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveform, setWaveform] = useState('sine');
  const [bpm, setBpm] = useState(120);
  const [scale, setScale] = useState('major');
  const [melodyLength, setMelodyLength] = useState(8);
  const [chaosLevel, setChaosLevel] = useState(0.2);
  const [darkMode, setDarkMode] = useState(true);

  // Musical scales
  const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };

  // Note frequencies (C4 to B4)
  const baseFrequencies = [
    261.63, // C4
    277.18, // C#4
    293.66, // D4
    311.13, // D#4
    329.63, // E4
    349.23, // F4
    369.99, // F#4
    392.00, // G4
    415.30, // G#4
    440.00, // A4
    466.16, // A#4
    493.88  // B4
  ];

  // Initialize audio context on first user interaction
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create analyser for visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  // Generate random note based on scale and chaos level
  const generateNote = (octave = 4) => {
    const scaleIntervals = scales[scale];
    const randomInterval = scaleIntervals[Math.floor(Math.random() * scaleIntervals.length)];
    
    // Apply chaos factor
    if (Math.random() < chaosLevel) {
      // Random deviation from scale
      const deviation = Math.floor(Math.random() * 3) - 1;
      const adjustedInterval = Math.max(0, Math.min(11, randomInterval + deviation));
      return baseFrequencies[adjustedInterval] * Math.pow(2, octave - 4);
    }
    
    return baseFrequencies[randomInterval] * Math.pow(2, octave - 4);
  };

  // Play a single note
  const playNote = (frequency, duration = 0.5) => {
    if (!audioContextRef.current) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    
    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(analyserRef.current || audioContextRef.current.destination);

    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration);

    oscillatorsRef.current.push(oscillator);

    // Clean up oscillator after it stops
    oscillator.onended = () => {
      const index = oscillatorsRef.current.indexOf(oscillator);
      if (index > -1) {
        oscillatorsRef.current.splice(index, 1);
      }
    };
  };

  // Generate and play melody
  const playMelody = async () => {
    if (!audioContextRef.current) return;

    const interval = 60 / bpm;
    let currentOctave = 4;

    for (let i = 0; i < melodyLength; i++) {
      if (!isPlaying) break;

      const frequency = generateNote(currentOctave);
      playNote(frequency, interval * 0.8);

      // Occasionally change octave for variety
      if (Math.random() < 0.3) {
        currentOctave = 3 + Math.floor(Math.random() * 2);
      }

      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    }
  };

  // Start/stop playback
  const togglePlayback = () => {
    if (!isPlaying) {
      initAudioContext();
      setIsPlaying(true);
      playMelody();
    } else {
      setIsPlaying(false);
      stopAllSounds();
    }
  };

  // Stop all sounds and clear oscillators
  const stopAllSounds = () => {
    oscillatorsRef.current.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Oscillator already stopped
      }
    });
    oscillatorsRef.current = [];
  };

  // Visualization effect
  const drawVisualization = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyserRef.current.getByteFrequencyData(dataArray);

    ctx.fillStyle = darkMode ? '#0f172a' : '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = darkMode ? '#3b82f6' : '#2563eb';
    ctx.beginPath();

    const sliceWidth = (canvas.width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    animationFrameRef.current = requestAnimationFrame(drawVisualization);
  };

  // Start visualization when playing
  useEffect(() => {
    if (isPlaying) {
      drawVisualization();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, darkMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsPlaying(false);
      stopAllSounds();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Melody Generator</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Visualization Canvas */}
        <div className="mb-8">
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            className={`w-full h-48 rounded-lg border ${
              darkMode ? 'border-gray-700' : 'border-gray-300'
            }`}
          />
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Waveform Selection */}
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white shadow'}`}>
            <label className="block text-sm font-medium mb-2">Waveform</label>
            <select
              value={waveform}
              onChange={(e) => setWaveform(e.target.value)}
              className={`w-full p-2 rounded border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="sawtooth">Sawtooth</option>
              <option value="triangle">Triangle</option>
            </select>
          </div>

          {/* BPM Control */}
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white shadow'}`}>
            <label className="block text-sm font-medium mb-2">
              BPM: {bpm}
            </label>
            <input
              type="range"
              min="60"
              max="180"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Scale Selection */}
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white shadow'}`}>
            <label className="block text-sm font-medium mb-2">Scale</label>
            <select
              value={scale}
              onChange={(e) => setScale(e.target.value)}
              className={`w-full p-2 rounded border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="pentatonic">Pentatonic</option>
              <option value="blues">Blues</option>
              <option value="chromatic">Chromatic</option>
            </select>
          </div>

          {/* Melody Length */}
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white shadow'}`}>
            <label className="block text-sm font-medium mb-2">
              Length: {melodyLength}
            </label>
            <input
              type="range"
              min="4"
              max="16"
              value={melodyLength}
              onChange={(e) => setMelodyLength(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Chaos Level */}
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white shadow'}`}>
            <label className="block text-sm font-medium mb-2">
              Chaos: {(chaosLevel * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={chaosLevel}
              onChange={(e) => setChaosLevel(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Play/Stop Button */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={togglePlayback}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              isPlaying
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isPlaying ? <Square size={20} /> : <Play size={20} />}
            <span>{isPlaying ? 'Stop' : 'Play'}</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              stopAllSounds();
            }}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <RotateCcw size={20} />
            <span>Reset</span>
          </button>
        </div>

        {/* Info */}
        <div className={`mt-8 p-4 rounded-lg text-sm ${
          darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
        }`}>
          <p className="mb-2"><strong>How to use:</strong> Click Play to generate a random melody!</p>
          <p><strong>Waveform:</strong> Changes the sound character • <strong>BPM:</strong> Adjusts tempo • <strong>Scale:</strong> Musical key • <strong>Chaos:</strong> Randomness factor</p>
        </div>
      </div>
    </div>
  );
};

export default App;