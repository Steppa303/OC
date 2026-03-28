import React from 'react';
import { FiMusic, FiClock, FiActivity, FiVolume2, FiSettings, FiRepeat, FiMove, FiGrid, FiLayers } from 'react-icons/fi';

type WaveformType = 'Sine' | 'Square' | 'Sawtooth' | 'Triangle' | 'Warm Pad' | 'Clear Lead' | 'Sub Bass' | 'Pluck';
type ScaleType = 'Major' | 'Minor' | 'Pentatonic' | 'Blues' | 'Dorian' | 'Phrygian' | 'Lydian' | 'Mixolydian';
type RhythmType = 'Quarter' | '8th' | '16th' | 'Syncopated';
type SectionType = 'Intro' | 'Verse' | 'Chorus' | 'Bridge' | 'Outro';

interface EffectControls {
  reverb: boolean;
  delay: boolean;
  chorus: boolean;
  compressor: boolean;
  eq: boolean;
}

interface EffectParams {
  reverb: {
    decay: number;
    wet: number;
  };
  delay: {
    time: string;
    feedback: number;
    wet: number;
  };
  chorus: {
    frequency: number;
    depth: number;
    wet: number;
  };
  compressor: {
    threshold: number;
    ratio: number;
  };
  eq: {
    low: number;
    mid: number;
    high: number;
  };
}

interface ControlPanelProps {
  bpm: number;
  setBpm: (value: number) => void;
  chaos: number;
  setChaos: (value: number) => void;
  length: number;
  setLength: (value: number) => void;
  keySignature: string;
  setKeySignature: (value: string) => void;
  waveform: WaveformType;
  setWaveform: (value: WaveformType) => void;
  scale: ScaleType;
  setScale: (value: ScaleType) => void;
  rhythm: RhythmType;
  setRhythm: (value: RhythmType) => void;
  section: SectionType;
  setSection: (value: SectionType) => void;
  arrangement: string;
  setArrangement: (value: string) => void;
  density: number;
  setDensity: (value: number) => void;
  range: number;
  setRange: (value: number) => void;
  jumpSize: number;
  setJumpSize: (value: number) => void;
  repetition: number;
  setRepetition: (value: number) => void;
  effects: EffectControls;
  effectParams: EffectParams;
  toggleEffect: (effect: keyof EffectControls) => void;
  updateEffectParam: <T extends keyof EffectParams, K extends keyof EffectParams[T]>(
    effect: T,
    param: K,
    value: EffectParams[T][K]
  ) => void;
  loadPreset: (preset: 'clean' | 'warm' | 'wide' | 'heavy') => void;
  isLoading?: boolean;
}

const keySignatures = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Hm'
];

const waveforms: WaveformType[] = [
  'Sine',
  'Square',
  'Sawtooth',
  'Triangle',
  'Warm Pad',
  'Clear Lead',
  'Sub Bass',
  'Pluck'
];

const scales: ScaleType[] = [
  'Major',
  'Minor',
  'Pentatonic',
  'Blues',
  'Dorian',
  'Phrygian',
  'Lydian',
  'Mixolydian'
];

const rhythms: RhythmType[] = [
  'Quarter',
  '8th',
  '16th',
  'Syncopated'
];

const sections: SectionType[] = [
  'Intro',
  'Verse',
  'Chorus',
  'Bridge',
  'Outro'
];

const arrangements = [
  'intro-verse-chorus-bridge-chorus-outro',
  'verse-chorus-verse-chorus-bridge-chorus',
  'intro-verse-verse-chorus-chorus-bridge-outro',
  'verse-prechorus-chorus-verse-prechorus-chorus-bridge-chorus'
];

const ControlPanel: React.FC<ControlPanelProps> = ({
  bpm,
  setBpm,
  chaos,
  setChaos,
  length,
  setLength,
  keySignature,
  setKeySignature,
  waveform,
  setWaveform,
  scale,
  setScale,
  rhythm,
  setRhythm,
  section,
  setSection,
  arrangement,
  setArrangement,
  density,
  setDensity,
  range,
  setRange,
  jumpSize,
  setJumpSize,
  repetition,
  setRepetition,
  effects,
  effectParams,
  toggleEffect,
  updateEffectParam,
  loadPreset,
  isLoading = false
}) => {
  const getProgressWidth = (value: number, min: number, max: number) => {
    return ((value - min) / (max - min)) * 100;
  };

  const getProgressWidthWithLog = (value: number, min: number, max: number, logScale: boolean = false) => {
    if (logScale) {
      // Logarithmic scaling for parameters like frequency
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      const logValue = Math.log(Math.max(value, min)); // prevent log(0)
      return ((logValue - logMin) / (logMax - logMin)) * 100;
    }
    return ((value - min) / (max - min)) * 100;
  };

  const roundValue = (value: number, decimals: number = 2): number => {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  };

  return (
    <div className="glass-card p-5 sm:p-6 transition-all duration-300">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
        <FiSettings className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg sm:text-xl font-semibold text-white">Einstellungen</h2>
      </div>

      <div className="space-y-5">
        {/* Struktur Section */}
        <div className="space-y-3 bg-gray-900/30 p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <FiGrid className="w-4 h-4 text-blue-400" />
            <h3 className="text-white font-medium">Struktur</h3>
          </div>
          
          {/* Arrangement Dropdown */}
          <div className="space-y-2">
            <label className="block text-white/80 text-sm font-medium">
              Arrangement
            </label>
            <select
              value={arrangement}
              onChange={(e) => setArrangement(e.target.value)}
              disabled={isLoading}
              className="w-full glass-strong text-white px-4 py-2 rounded-lg font-medium 
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 cursor-pointer
                         hover:bg-white/20"
            >
              {arrangements.map((arr) => (
                <option key={arr} value={arr}>
                  {arr.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' → ')}
                </option>
              ))}
            </select>
          </div>

          {/* Song-Length Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-white/80 text-sm font-medium">
                <FiClock className="w-4 h-4 text-blue-400" />
                Song-Länge
              </label>
              <span className="text-blue-300 font-bold text-sm min-w-[3rem] text-right">
                {length} Min
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="1"
                max="60"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                disabled={isLoading}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(90deg, #3b82f6 0%, #6366f1 ${getProgressWidth(length, 1, 60)}%, rgba(255,255,255,0.1) ${getProgressWidth(length, 1, 60)}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>
          </div>

          {/* Current Section */}
          <div className="space-y-2">
            <label className="block text-white/80 text-sm font-medium">
              Aktueller Abschnitt
            </label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as SectionType)}
              disabled={isLoading}
              className="w-full glass-strong text-white px-4 py-2 rounded-lg font-medium 
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 cursor-pointer
                         hover:bg-white/20"
            >
              {sections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Melodie Controls */}
        <div className="space-y-3 bg-gray-900/30 p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <FiMusic className="w-4 h-4 text-green-400" />
            <h3 className="text-white font-medium">Melodie</h3>
          </div>

          {/* Density Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-white/80 text-sm font-medium">
                <FiActivity className="w-4 h-4 text-green-400" />
                Notendichte
              </label>
              <span className="text-green-300 font-bold text-sm min-w-[3rem] text-right">
                {density}%
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
                disabled={isLoading}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(90deg, #10b981 0%, #34d399 ${getProgressWidth(density, 0, 100)}%, rgba(255,255,255,0.1) ${getProgressWidth(density, 0, 100)}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>
          </div>

          {/* Range Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-white/80 text-sm font-medium">
                <FiMove className="w-4 h-4 text-yellow-400" />
                Tonumfang
              </label>
              <span className="text-yellow-300 font-bold text-sm min-w-[3rem] text-right">
                {range}%
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                disabled={isLoading}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(90deg, #eab308 0%, #fbbf24 ${getProgressWidth(range, 0, 100)}%, rgba(255,255,255,0.1) ${getProgressWidth(range, 0, 100)}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>
          </div>

          {/* Jump Size Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-white/80 text-sm font-medium">
                <FiRepeat className="w-4 h-4 text-purple-400" />
                Sprunggröße
              </label>
              <span className="text-purple-300 font-bold text-sm min-w-[3rem] text-right">
                {jumpSize}%
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={jumpSize}
                onChange={(e) => setJumpSize(Number(e.target.value))}
                disabled={isLoading}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(90deg, #a855f7 0%, #c084fc ${getProgressWidth(jumpSize, 0, 100)}%, rgba(255,255,255,0.1) ${getProgressWidth(jumpSize, 0, 100)}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>
          </div>

          {/* Repetition Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-white/80 text-sm font-medium">
                <FiRepeat className="w-4 h-4 text-pink-400" />
                Wiederholung
              </label>
              <span className="text-pink-300 font-bold text-sm min-w-[3rem] text-right">
                {repetition}%
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={repetition}
                onChange={(e) => setRepetition(Number(e.target.value))}
                disabled={isLoading}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(90deg, #ec4899 0%, #f472b6 ${getProgressWidth(repetition, 0, 100)}%, rgba(255,255,255,0.1) ${getProgressWidth(repetition, 0, 100)}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>
          </div>

          {/* Scale Dropdown */}
          <div className="space-y-2">
            <label className="block text-white/80 text-sm font-medium">
              Skala
            </label>
            <select
              value={scale}
              onChange={(e) => setScale(e.target.value as ScaleType)}
              disabled={isLoading}
              className="w-full glass-strong text-white px-4 py-2 rounded-lg font-medium 
                         focus:outline-none focus:ring-2 focus:ring-green-500/50 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 cursor-pointer
                         hover:bg-white/20"
            >
              {scales.map((scl) => (
                <option key={scl} value={scl}>
                  {scl}
                </option>
              ))}
            </select>
          </div>

          {/* Rhythm Dropdown */}
          <div className="space-y-2">
            <label className="block text-white/80 text-sm font-medium">
              Rhythmus
            </label>
            <select
              value={rhythm}
              onChange={(e) => setRhythm(e.target.value as RhythmType)}
              disabled={isLoading}
              className="w-full glass-strong text-white px-4 py-2 rounded-lg font-medium 
                         focus:outline-none focus:ring-2 focus:ring-green-500/50 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 cursor-pointer
                         hover:bg-white/20"
            >
              {rhythms.map((rhy) => (
                <option key={rhy} value={rhy}>
                  {rhy}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sound Controls */}
        <div className="space-y-3 bg-gray-900/30 p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <FiVolume2 className="w-4 h-4 text-orange-400" />
            <h3 className="text-white font-medium">Sound</h3>
          </div>

          {/* Waveform Dropdown */}
          <div className="space-y-2">
            <label className="block text-white/80 text-sm font-medium">
              Synth-Typ
            </label>
            <select
              value={waveform}
              onChange={(e) => setWaveform(e.target.value as WaveformType)}
              disabled={isLoading}
              className="w-full glass-strong text-white px-4 py-2 rounded-lg font-medium 
                         focus:outline-none focus:ring-2 focus:ring-orange-500/50 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 cursor-pointer
                         hover:bg-white/20"
            >
              {waveforms.map((wave) => (
                <option key={wave} value={wave}>
                  {wave}
                </option>
              ))}
            </select>
          </div>

          {/* Effects Toggles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            <button
              onClick={() => toggleEffect('reverb')}
              disabled={isLoading}
              className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 ${
                effects.reverb
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Reverb
            </button>
            <button
              onClick={() => toggleEffect('delay')}
              disabled={isLoading}
              className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 ${
                effects.delay
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Delay
            </button>
            <button
              onClick={() => toggleEffect('chorus')}
              disabled={isLoading}
              className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 ${
                effects.chorus
                  ? 'bg-green-600 text-white shadow-lg shadow-green-600/25'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Chorus
            </button>
            <button
              onClick={() => toggleEffect('compressor')}
              disabled={isLoading}
              className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 ${
                effects.compressor
                  ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/25'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Comp
            </button>
            <button
              onClick={() => toggleEffect('eq')}
              disabled={isLoading}
              className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 ${
                effects.eq
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              EQ
            </button>
          </div>

          {/* Effect Parameters - Only show if at least one effect is enabled */}
          {(effects.reverb || effects.delay || effects.chorus || effects.compressor || effects.eq) && (
            <div className="mt-4 space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-medium flex items-center gap-2">
                  <FiSettings className="w-4 h-4 text-cyan-400" />
                  Effekt-Parameter
                </h4>
                
                {/* Preset Buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => loadPreset('clean')}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 transition-all disabled:opacity-50"
                  >
                    Clean
                  </button>
                  <button
                    onClick={() => loadPreset('warm')}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 transition-all disabled:opacity-50"
                  >
                    Warm
                  </button>
                  <button
                    onClick={() => loadPreset('wide')}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 transition-all disabled:opacity-50"
                  >
                    Wide
                  </button>
                  <button
                    onClick={() => loadPreset('heavy')}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 transition-all disabled:opacity-50"
                  >
                    Heavy
                  </button>
                </div>
              </div>

              {/* Reverb Parameters */}
              {effects.reverb && (
                <div className="space-y-3 bg-gray-800/30 p-3 rounded-lg">
                  <h5 className="text-purple-300 font-medium text-sm">Reverb</h5>
                  
                  {/* Decay Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-purple-200">
                      <span>Decay</span>
                      <span>{roundValue(effectParams.reverb.decay)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={effectParams.reverb.decay}
                      onChange={(e) => updateEffectParam('reverb', 'decay', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #8b5cf6 0%, #a855f7 ${getProgressWidth(effectParams.reverb.decay, 0.1, 10)}%, rgba(255,255,255,0.1) ${getProgressWidth(effectParams.reverb.decay, 0.1, 10)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                  
                  {/* Wet Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-purple-200">
                      <span>Wet/Dry</span>
                      <span>{Math.round(effectParams.reverb.wet * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={effectParams.reverb.wet}
                      onChange={(e) => updateEffectParam('reverb', 'wet', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #8b5cf6 0%, #a855f7 ${Math.round(effectParams.reverb.wet * 100)}%, rgba(255,255,255,0.1) ${Math.round(effectParams.reverb.wet * 100)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Delay Parameters */}
              {effects.delay && (
                <div className="space-y-3 bg-gray-800/30 p-3 rounded-lg">
                  <h5 className="text-blue-300 font-medium text-sm">Delay</h5>
                  
                  {/* Time Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-blue-200">
                      <span>Time</span>
                      <select
                        value={effectParams.delay.time}
                        onChange={(e) => updateEffectParam('delay', 'time', e.target.value)}
                        disabled={isLoading}
                        className="text-xs bg-gray-700/50 text-white px-2 py-1 rounded"
                      >
                        <option value="16n">1/16 Note</option>
                        <option value="8n">1/8 Note</option>
                        <option value="4n">1/4 Note</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Feedback Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-blue-200">
                      <span>Feedback</span>
                      <span>{Math.round(effectParams.delay.feedback * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={effectParams.delay.feedback}
                      onChange={(e) => updateEffectParam('delay', 'feedback', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #3b82f6 0%, #60a5fa ${Math.round(effectParams.delay.feedback * 100)}%, rgba(255,255,255,0.1) ${Math.round(effectParams.delay.feedback * 100)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                  
                  {/* Wet Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-blue-200">
                      <span>Wet/Dry</span>
                      <span>{Math.round(effectParams.delay.wet * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={effectParams.delay.wet}
                      onChange={(e) => updateEffectParam('delay', 'wet', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #3b82f6 0%, #60a5fa ${Math.round(effectParams.delay.wet * 100)}%, rgba(255,255,255,0.1) ${Math.round(effectParams.delay.wet * 100)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Chorus Parameters */}
              {effects.chorus && (
                <div className="space-y-3 bg-gray-800/30 p-3 rounded-lg">
                  <h5 className="text-green-300 font-medium text-sm">Chorus</h5>
                  
                  {/* Frequency Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-green-200">
                      <span>Frequency</span>
                      <span>{roundValue(effectParams.chorus.frequency, 1)} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={effectParams.chorus.frequency}
                      onChange={(e) => updateEffectParam('chorus', 'frequency', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #10b981 0%, #34d399 ${getProgressWidth(effectParams.chorus.frequency, 0.1, 10)}%, rgba(255,255,255,0.1) ${getProgressWidth(effectParams.chorus.frequency, 0.1, 10)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                  
                  {/* Depth Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-green-200">
                      <span>Depth</span>
                      <span>{Math.round(effectParams.chorus.depth * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={effectParams.chorus.depth}
                      onChange={(e) => updateEffectParam('chorus', 'depth', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #10b981 0%, #34d399 ${Math.round(effectParams.chorus.depth * 100)}%, rgba(255,255,255,0.1) ${Math.round(effectParams.chorus.depth * 100)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                  
                  {/* Wet Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-green-200">
                      <span>Wet/Dry</span>
                      <span>{Math.round(effectParams.chorus.wet * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={effectParams.chorus.wet}
                      onChange={(e) => updateEffectParam('chorus', 'wet', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #10b981 0%, #34d399 ${Math.round(effectParams.chorus.wet * 100)}%, rgba(255,255,255,0.1) ${Math.round(effectParams.chorus.wet * 100)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Compressor Parameters */}
              {effects.compressor && (
                <div className="space-y-3 bg-gray-800/30 p-3 rounded-lg">
                  <h5 className="text-yellow-300 font-medium text-sm">Compressor</h5>
                  
                  {/* Threshold Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-yellow-200">
                      <span>Threshold</span>
                      <span>{effectParams.compressor.threshold} dB</span>
                    </div>
                    <input
                      type="range"
                      min="-60"
                      max="0"
                      step="1"
                      value={effectParams.compressor.threshold}
                      onChange={(e) => updateEffectParam('compressor', 'threshold', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #eab308 0%, #fbbf24 ${getProgressWidth(effectParams.compressor.threshold, -60, 0)}%, rgba(255,255,255,0.1) ${getProgressWidth(effectParams.compressor.threshold, -60, 0)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                  
                  {/* Ratio Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-yellow-200">
                      <span>Ratio</span>
                      <span>{effectParams.compressor.ratio}:1</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={effectParams.compressor.ratio}
                      onChange={(e) => updateEffectParam('compressor', 'ratio', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #eab308 0%, #fbbf24 ${getProgressWidth(effectParams.compressor.ratio, 1, 20)}%, rgba(255,255,255,0.1) ${getProgressWidth(effectParams.compressor.ratio, 1, 20)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* EQ Parameters */}
              {effects.eq && (
                <div className="space-y-3 bg-gray-800/30 p-3 rounded-lg">
                  <h5 className="text-red-300 font-medium text-sm">EQ</h5>
                  
                  {/* Low Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-red-200">
                      <span>Low</span>
                      <span>{effectParams.eq.low} dB</span>
                    </div>
                    <input
                      type="range"
                      min="-15"
                      max="15"
                      step="0.5"
                      value={effectParams.eq.low}
                      onChange={(e) => updateEffectParam('eq', 'low', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #ef4444 0%, #f87171 ${getProgressWidth(effectParams.eq.low, -15, 15)}%, rgba(255,255,255,0.1) ${getProgressWidth(effectParams.eq.low, -15, 15)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                  
                  {/* Mid Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-red-200">
                      <span>Mid</span>
                      <span>{effectParams.eq.mid} dB</span>
                    </div>
                    <input
                      type="range"
                      min="-15"
                      max="15"
                      step="0.5"
                      value={effectParams.eq.mid}
                      onChange={(e) => updateEffectParam('eq', 'mid', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #ef4444 0%, #f87171 ${getProgressWidth(effectParams.eq.mid, -15, 15)}%, rgba(255,255,255,0.1) ${getProgressWidth(effectParams.eq.mid, -15, 15)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                  
                  {/* High Parameter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-red-200">
                      <span>High</span>
                      <span>{effectParams.eq.high} dB</span>
                    </div>
                    <input
                      type="range"
                      min="-15"
                      max="15"
                      step="0.5"
                      value={effectParams.eq.high}
                      onChange={(e) => updateEffectParam('eq', 'high', parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(90deg, #ef4444 0%, #f87171 ${getProgressWidth(effectParams.eq.high, -15, 15)}%, rgba(255,255,255,0.1) ${getProgressWidth(effectParams.eq.high, -15, 15)}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Additional Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-white/80 text-sm font-medium">
                <FiActivity className="w-4 h-4 text-indigo-400" />
                BPM (Tempo)
              </label>
              <span className="text-purple-300 font-bold text-sm min-w-[3rem] text-right">
                {bpm}
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="60"
                max="200"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                disabled={isLoading}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(90deg, #a855f7 0%, #6366f1 ${getProgressWidth(bpm, 60, 200)}%, rgba(255,255,255,0.1) ${getProgressWidth(bpm, 60, 200)}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-white/80 text-sm font-medium">
                <FiMusic className="w-4 h-4 text-pink-400" />
                Chaos Level
              </label>
              <span className="text-pink-300 font-bold text-sm min-w-[3rem] text-right">
                {chaos}%
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={chaos}
                onChange={(e) => setChaos(Number(e.target.value))}
                disabled={isLoading}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(90deg, #ec4899 0%, #a855f7 ${getProgressWidth(chaos, 0, 100)}%, rgba(255,255,255,0.1) ${getProgressWidth(chaos, 0, 100)}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>
          </div>

          {/* Key Signature Dropdown */}
          <div className="space-y-2">
            <label className="block text-white/80 text-sm font-medium">
              Tonart
            </label>
            <select
              value={keySignature}
              onChange={(e) => setKeySignature(e.target.value)}
              disabled={isLoading}
              className="w-full glass-strong text-white px-4 py-2 rounded-lg font-medium 
                         focus:outline-none focus:ring-2 focus:ring-purple-500/50 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 cursor-pointer
                         hover:bg-white/20"
            >
              {keySignatures.map((key) => (
                <option key={key} value={key}>
                  {key} {key.endsWith('m') ? 'm' : 'M'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;