/**
 * Audio Player Component using Web Audio API
 * Plays the generated melodies with proper timing and sound
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Audio Synthesizer class to play generated melodies
 */
class AudioSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.scheduledNotes = [];
  }

  // Initialize Audio Context (needs user interaction first)
  async initialize() {
    if (this.audioCtx) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.3; // Master volume
    this.masterGain.connect(this.audioCtx.destination);
  }

  // Generate oscillator for a note
  playNote(frequency, duration, startTime, type = 'sine', volume = 0.5) {
    if (!this.audioCtx) return;

    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    // Volume envelope
    const now = this.audioCtx.currentTime;
    const startTimeInSec = startTime * 0.5; // Adjust multiplier for tempo (0.5 = 120 BPM)
    const durationInSec = duration * 0.5;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, startTimeInSec + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTimeInSec + durationInSec);

    // Connect and schedule
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(startTimeInSec);
    oscillator.stop(startTimeInSec + durationInSec);

    this.scheduledNotes.push({
      frequency,
      duration: durationInSec,
      startTime: startTimeInSec,
      oscillator,
      gainNode
    });
  }

  // Play a full melody
  playMelody(melody, type = 'sine', volume = 0.5) {
    this.stop();

    if (!this.audioCtx) {
      return { error: 'Audio context not initialized. Click play first.' };
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.isPlaying = true;

    melody.forEach(note => {
      this.playNote(
        note.frequency,
        note.duration,
        note.startTime,
        type,
        volume
      );
    });

    const totalTime = (melody[melody.length - 1]?.startTime || 0) + 
                     (melody[melody.length - 1]?.duration || 0);
    
    return { 
      success: true, 
      duration: totalTime * 0.5 // Adjust for tempo
    };
  }

  // Stop currently playing notes
  stop() {
    this.scheduledNotes.forEach(note => {
      try {
        note.oscillator.stop();
        note.oscillator.disconnect();
        note.gainNode.disconnect();
      } catch (e) {
        // Ignore errors for already stopped notes
      }
    });

    this.scheduledNotes = [];
    this.isPlaying = false;
  }

  // Resume playback (after suspension)
  async resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
      this.isPlaying = true;
    }
  }

  // Pause playback
  async pause() {
    if (this.audioCtx) {
      await this.audioCtx.suspend();
      this.isPlaying = false;
    }
  }
}

// Create singleton instance
let audioSynth = null;
export function getAudioSynth() {
  if (!audioSynth) {
    audioSynth = new AudioSynthesizer();
  }
  return audioSynth;
}

/**
 * AudioPlayer Component
 * @param {Object} props - Component props
 * @param {Array} props.melody - Array of note objects to play
 * @param {string} props.waveform - Oscillator type (sine, square, sawtooth, triangle)
 * @param {number} props.volume - Volume (0-1)
 */
function AudioPlayer({ melody, waveform = 'sine', volume = 0.5 }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const synthRef = useRef(null);

  useEffect(() => {
    synthRef.current = getAudioSynth();
    return () => {
      if (synthRef.current) {
        synthRef.current.stop();
      }
    };
  }, []);

  const handleInitialize = async () => {
    try {
      await synthRef.current.initialize();
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError('Failed to initialize audio context');
    }
  };

  const handlePlay = async () => {
    if (!synthRef.current) {
      await handleInitialize();
    }

    try {
      const result = synthRef.current.playMelody(melody, waveform, volume);
      
      if (result.error) {
        setError(result.error);
        return;
      }

      setIsPlaying(true);
      setError(null);

      // Reset playing state when melody finishes
      setTimeout(() => {
        setIsPlaying(false);
      }, result.duration * 1000);
    } catch (err) {
      setError('Error playing melody: ' + err.message);
    }
  };

  const handleStop = () => {
    if (synthRef.current) {
      synthRef.current.stop();
      setIsPlaying(false);
    }
  };

  const handlePause = async () => {
    if (synthRef.current) {
      await synthRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleResume = async () => {
    if (synthRef.current) {
      await synthRef.current.resume();
      setIsPlaying(true);
    }
  };

  // Calculate melody duration
  const duration = melody.length > 0 
    ? (melody[melody.length - 1].startTime + melody[melody.length - 1].duration) * 0.5 
    : 0;

  return (
    <div className="audio-player bg-gray-800 rounded-lg p-4 mb-6">
      {/* Play Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {!isInitialized ? (
            <button
              onClick={handleInitialize}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              🎵 Audio starten
            </button>
          ) : (
            <>
              {!isPlaying ? (
                <button
                  onClick={handlePlay}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  <span>▶</span>
                  <span>Play</span>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  <span>⏸</span>
                  <span>Pause</span>
                </button>
              )}
            </>
          )}
          
          <button
            onClick={handleStop}
            disabled={!isInitialized}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isPlaying 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
           ⏹ Stop
          </button>
        </div>

        {/* Playback Info */}
        <div className="text-sm text-gray-400 space-y-1">
          <div>-duration: {duration.toFixed(2)}s</div>
          <div>Notes: {melody.length}</div>
          {error && (
            <div className="text-red-400 text-xs">⚠️ {error}</div>
          )}
        </div>
      </div>

      {/* Waveform & Volume Controls */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <label className="text-sm text-gray-400 mr-2">Waveform:</label>
          <select
            value={waveform}
            onChange={(e) => {
              // Update waveform for next playback
              // This will take effect when playing next melody
            }}
            className="bg-gray-700 text-white rounded px-2 py-1"
            disabled={!isPlaying}
          >
            <option value="sine">Sine (weich)</option>
            <option value="square">Square (8-Bit)</option>
            <option value="sawtooth">Sawtooth (scharf)</option>
            <option value="triangle">Triangle (flach)</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-400 mr-2">Volume:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => {
              // Update volume for next playback
            }}
            className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            disabled={!isPlaying}
          />
        </div>
      </div>

      {/* Progress Bar (Visual Only) */}
      {isPlaying && melody.length > 0 && (
        <div className="mt-4">
          <div className="w-full bg-gray-600 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full animate-pulse"
              style={{ 
                width: '0%', 
                animation: 'progress 5s linear' 
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export components and utilities
export { AudioSynthesizer, getAudioSynth, AudioPlayer };

export default AudioPlayer;
