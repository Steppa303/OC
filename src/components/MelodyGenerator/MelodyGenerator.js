import React, { useState } from 'react';
import { 
  Music, 
  Play, 
  Pause, 
  Settings, 
  ChartBar, 
  Volume2, 
  Activity,
  Layers,
  Waveform,
  Sliders,
 repeat,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Simple SVG-based Piano Roll Component
const PianoRoll = ({ melody }) => {
  return (
    <div className="relative w-full h-48 bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
      <div className="absolute inset-0 grid grid-cols-16 gap-0.5 p-4">
        {[...Array(16)].map((_, col) => (
          <div key={col} className="grid grid-rows-12 gap-0.5">
            {[...Array(12)].map((_, row) => (
              <div 
                key={row} 
                className={`rounded-sm transition-all duration-300 ${
                  melody[col]?.notes?.includes(row) 
                    ? 'bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/30' 
                    : 'bg-slate-800/30 hover:bg-slate-700/30'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="absolute top-2 left-2 text-xs text-slate-400 flex items-center gap-1">
        <Activity className="w-3 h-3" />
        Piano Roll
      </div>
    </div>
  );
};

// Simple Waveform Visualizer
const WaveformVisualizer = ({ isPlaying }) => {
  return (
    <div className="relative w-full h-24 bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center gap-1 p-4">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full transition-all duration-100 ${
            isPlaying 
              ? `bg-gradient-to-t from-blue-500 to-purple-500 animate-pulse`
              : 'bg-slate-800/50'
          }`}
          style={{
            height: isPlaying ? `${Math.random() * 100}%` : '10%',
            animationDelay: `${i * 50}ms`
          }}
        />
      ))}
      <div className="absolute top-2 left-2 text-xs text-slate-400 flex items-center gap-1">
        <Waveform className="w-3 h-3" />
        Wellenform
      </div>
    </div>
  );
};

// BPM Visualizer
const BPMVisualizer = ({ bpm, isPlaying }) => {
  return (
    <div className="relative w-full h-16 bg-slate-900/50 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-300 ${
            isPlaying && Math.floor(Date.now() / (60000 / bpm / 4)) % 2 === 0
              ? 'bg-gradient-to-t from-green-400 to-emerald-500 h-12'
              : 'bg-slate-800 h-4'
          }`}
        />
      ))}
      <div className="absolute top-2 right-2 bg-slate-800/80 px-2 py-1 rounded-lg text-sm font-mono text-green-400">
        {bpm} BPM
      </div>
      <div className="absolute top-2 left-2 text-xs text-slate-400 flex items-center gap-1">
        <Activity className="w-3 h-3" />
        BPM
      </div>
    </div>
  );
};

// Accordion Component
const Accordion = ({ title, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
      >
        <span className="font-semibold text-white flex items-center gap-2">
          {children.props.icon}
          {title}
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {isOpen && (
        <div className="p-4 space-y-4 border-t border-white/10">
          {React.cloneElement(children, { isOpen })}
        </div>
      )}
    </div>
  );
};

// Main App Component
export default function MelodyGenerator() {
  const [activeTab, setActiveTab] = useState('structure');
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);

  // State for all controls
  const [controls, setControls] = useState({
    arrangementType: 'verse-chorus',
    songLength: 32,
    noteDensity: 50,
    range: 50,
    complexity: 50,
    repetition: 50,
    synthType: 'lead',
    effects: {
      reverb: true,
      delay: true,
      chorus: false
    },
    layerMix: {
      lead: 80,
      pad: 50,
      bass: 70,
      pluck: 40
    }
  });

  const updateControl = (section, key, value) => {
    setControls(prev => ({
      ...prev,
      [section]:typeof value === 'object' && !Array.isArray(value) 
        ? { ...prev[section], ...value }
        : value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Music className="w-8 h-8 md:w-10 md:h-10 text-purple-400" />
            Melodiegenerator
          </h1>
          <p className="text-slate-400">Kreative KI-generierte Musik mit voller Kontrolle</p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all hover:scale-105 active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </button>
          
          <div className="flex flex-col items-center">
              <div className="text-4xl font-mono font-bold text-white mb-2">
                {bpm} <span className="text-sm text-slate-400">BPM</span>
              </div>
              <input
                type="range"
                min="60"
                max="180"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value))}
                className="w-48 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
          </div>
          
          <button className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-slate-300">
            <Layers className="w-6 h-6" />
          </button>
        </div>

        {/* Generator Area */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Controls Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
              {[
                { id: 'structure', label: 'Struktur', icon: <Settings className="w-4 h-4" /> },
                { id: 'melody', label: 'Melodie', icon: <Music className="w-4 h-4" /> },
                { id: 'sound', label: 'Sound', icon: <Volume2 className="w-4 h-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Controls Content */}
            <div className="space-y-6">
              {activeTab === 'structure' && (
                <Accordion title="Arrangement & Struktur" icon={<Layers className="w-5 h-5 text-blue-400" />}>
                  <div className="space-y-6">
                    {/* Arrangement Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-3">Arrangement-Typ</label>
                      <div className="grid grid-cols-3 gap-3">
                        {['Einfach', 'Verse-Chorus', 'Progressiv'].map((type) => (
                          <button
                            key={type}
                            onClick={() => updateControl('arrangementType', type)}
                            className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                              controls.arrangementType === type
                                ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-blue-500 text-white'
                                : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/30'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Song Length */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-300">Song-Länge</label>
                        <span className="text-sm text-slate-400 font-mono">{controls.songLength} Takte</span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="128"
                        step="8"
                        value={controls.songLength}
                        onChange={(e) => updateControl('songLength', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-2">
                        <span>8 Takte</span>
                        <span>32 Takte</span>
                        <span>64 Takte</span>
                        <span>128 Takte</span>
                      </div>
                    </div>
                  </div>
                </Accordion>
              )}

              {activeTab === 'melody' && (
                <>
                  <Accordion title="Melodische Parameter" icon={<Music className="w-5 h-5 text-purple-400" />}>
                    <div className="space-y-5">
                      {/* Note Density */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium text-slate-300">Notendichte</label>
                          <span className="text-xs text-slate-400">
                            {controls.noteDensity < 30 ? 'Spärlich' : controls.noteDensity > 70 ? 'Dicht' : 'Mäßig'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={controls.noteDensity}
                          onChange={(e) => updateControl('noteDensity', parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>

                      {/* Range */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium text-slate-300">Tonumfang</label>
                          <span className="text-xs text-slate-400">
                            {controls.range < 30 ? 'Tief' : controls.range > 70 ? 'Hoch' : 'Mittel'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={controls.range}
                          onChange={(e) => updateControl('range', parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>

                      {/* Complexity */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium text-slate-300">Komplexität</label>
                          <span className="text-xs text-slate-400">
                            {controls.complexity < 30 ? 'Einfach' : controls.complexity > 70 ? 'Komplex' : 'Ausgewogen'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={controls.complexity}
                          onChange={(e) => updateControl('complexity', parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>

                      {/* Repetition */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium text-slate-300">Wiederholung</label>
                          <span className="text-xs text-slate-400">
                            {controls.repetition < 30 ? 'Wenig' : controls.repetition > 70 ? 'Viel' : 'Mäßig'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={controls.repetition}
                          onChange={(e) => updateControl('repetition', parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                      </div>
                    </div>
                  </Accordion>
                  </>
                  )}

                  {activeTab === 'sound' && (
                    <>
                      <Accordion title="Synth-Typ & Sound" icon={<Volume2 className="w-5 h-5 text-pink-400" />}>
                        <div className="space-y-6">
                          {/* Synth Type */}
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-3">Synth-Typ</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {['Lead', 'Pad', 'Pluck', 'Bass'].map((type) => (
                                <button
                                  key={type}
                                  onClick={() => updateControl('synthType', type)}
                                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                    controls.synthType === type
                                      ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-2 border-pink-500 text-white'
                                      : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/30'
                                  }`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Effects */}
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-3">Effekte</label>
                             <div className="grid grid-cols-3 gap-3">
                              {[
                                { name: 'Reverb', color: 'blue' },
                                { name: 'Delay', color: 'purple' },
                                { name: 'Chorus', color: 'pink' }
                              ].map((effect) => (
                                <button
                                  key={effect.name}
                                  onClick={() => updateControl('effects', {
                                    [effect.name.toLowerCase()]: !controls.effects[effect.name.toLowerCase()]
                                  })}
                                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                    controls.effects[effect.name.toLowerCase()]
                                      ? `bg-gradient-to-r from-${effect.color}-500/20 to-purple-500/20 border-2 border-${effect.color}-500 text-white`
                                      : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/30'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${controls.effects[effect.name.toLowerCase()] ? `bg-${effect.color}-500` : 'bg-slate-600'}`} />
                                  {effect.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Layer Mix */}
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-4">Mix-Regler</label>
                            <div className="space-y-4">
                              {Object.entries(controls.layerMix).map(([layer, value]) => (
                                <div key={layer}>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-medium text-slate-400 capitalize">{layer}</span>
                                    <span className="text-xs text-slate-500 font-mono">{value}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={value}
                                    onChange={(e) => updateControl('layerMix', {
                                      [layer]: parseInt(e.target.value)
                                    })}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Accordion>
                     </>
                    )}
               </div>
            </div>

            {/* Visual Feedback Section */}
             <div className="grid md:grid-cols-2 gap-6">
              <PianoRoll melody={{
                0: { notes: [2, 5, 9] },
                4: { notes: [3, 6, 10] },
                8: { notes: [1, 5, 8] },
                12: { notes: [4, 7, 11] }
              }} />
              
              <div className="space-y-6">
                <WaveformVisualizer isPlaying={isPlaying} />
                <BPMVisualizer bpm={bpm} isPlaying={isPlaying} />
              </div>
            </div>

            {/* Generate Button */}
            <div className="mt-8">
               <button className="w-full py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 rounded-xl text-white font-bold text-lg shadow-lg shadow-purple-500/30 transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <Music className="w-5 h-5" />
                Melodie Generieren
               </button>
             </div>
          </div>

          {/* Sidebar / Quick Stats */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ChartBar className="w-5 h-5 text-purple-400" />
                Statistiken
              </h3>
              
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5">
                  <div className="text-xs text-slate-400 mb-1">Duration</div>
                  <div className="text-xl font-mono text-white">{Math.ceil(controls.songLength * 4 / bpm * 60)}s</div>
                </div>
                
                <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5">
                  <div className="text-xs text-slate-400 mb-1">Komplexität</div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-4 h-2 rounded-sm ${
                          i < Math.round(controls.complexity / 20) ? 'bg-gradient-to-r from-blue-400 to-purple-400' : 'bg-slate-800/50'
                        }`} 
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5">
                  <div className="text-xs text-slate-400 mb-1">Erzeugt</div>
                  <div className="text-sm text-slate-300">12.03.2025, 22:15</div>
                </div>
              </div>
            </div>

             <div className="bg-white/5 rounded-xl border border-white/10 p-6">
               <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                 <Activity className="w-5 h-5 text-green-400" />
                 Status
               </h3>
               
               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-slate-300">Generation</span>
                   <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                     Bereit
                   </span>
                 </div>
                 
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-slate-300">BPM</span>
                   <span className="text-sm font-mono text-purple-400">{bpm}</span>
                 </div>
                 
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-slate-300">Synth</span>
                   <span className="text-sm capitalize font-medium text-pink-400">{controls.synthType}</span>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}