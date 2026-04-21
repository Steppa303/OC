import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import Header from './components/Header';
import Visualizer from './components/Visualizer';
import ControlPanel from './components/ControlPanel';
import PlayControls from './components/PlayControls';
import Footer from './components/Footer';
import './App.css';

type WaveformType = 'Sine' | 'Square' | 'Sawtooth' | 'Triangle';

interface AppState {
  bpm: number;
  chaos: number;
  length: number;
  keySignature: string;
  waveform: WaveformType;
  isPlaying: boolean;
  isLoading: boolean;
}

// Einfache Skalen
const scales: Record<string, string[]> = {
  'C': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  'Cm': ['C4', 'D#4', 'F4', 'G4', 'G#4', 'A#4', 'C5', 'C#5'],
  'D': ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'],
  'Dm': ['D4', 'F4', 'G4', 'G#4', 'A4', 'A#4', 'C5', 'D5'],
  'E': ['E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5', 'E5'],
  'Em': ['E4', 'G4', 'A4', 'A#4', 'B4', 'D5', 'E5', 'F#5'],
  'F': ['F4', 'G4', 'A4', 'A#4', 'C5', 'D5', 'E5', 'F5'],
  'Fm': ['F4', 'G#4', 'A#4', 'B4', 'C5', 'D#5', 'F5', 'F#5'],
  'G': ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'],
  'Gm': ['G4', 'A#4', 'C5', 'C#5', 'D5', 'F5', 'G5', 'G#5'],
  'A': ['A4', 'B4', 'C#5', 'D5', 'E5', 'F#5', 'G#5', 'A5'],
  'Am': ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'],
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    bpm: 120,
    chaos: 30,
    length: 8,
    keySignature: 'Am',
    waveform: 'Sine',
    isPlaying: false,
    isLoading: false
  });

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const delayRef = useRef<Tone.FeedbackDelay | null>(null);
  const chorusRef = useRef<Tone.Chorus | null>(null);
  const loopRef = useRef<any>(null);
  const isInitialized = useRef(false);

  // Audio initialisieren - EFFEKTE KORREKT VERKETTEN
  const initAudio = useCallback(async () => {
    if (isInitialized.current) return;
    
    await Tone.start();
    
    // 1. Effekte erstellen
    reverbRef.current = new Tone.Reverb({
      decay: 2,
      wet: 0.4
    }).toDestination();
    
    delayRef.current = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.4,
      wet: 0.3
    }).toDestination();
    
    chorusRef.current = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 2.5,
      depth: 0.7,
      wet: 0.5
    }).toDestination();
    
    // 2. Synth erstellen
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: state.waveform.toLowerCase() as any
      },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.5,
        release: 0.8
      },
      volume: -6
    });
    
    // 3. Synth MIT EFFEKTEN verbinden (richtige Reihenfolge!)
    synthRef.current.connect(chorusRef.current);
    chorusRef.current.connect(delayRef.current);
    delayRef.current.connect(reverbRef.current);
    // Reverb geht bereits zu Destination
    
    isInitialized.current = true;
    console.log('✅ Audio initialisiert mit Effekten!');
  }, [state.waveform]);

  // Melodie generieren
  const generateMelody = useCallback(() => {
    const notes = scales[state.keySignature] || scales['Am'];
    const noteCount = state.length;
    const melody: string[] = [];

    for (let i = 0; i < noteCount; i++) {
      let noteIndex = i % notes.length;
      
      // Chaos für Variation
      if (Math.random() * 100 < state.chaos) {
        noteIndex = Math.floor(Math.random() * notes.length);
      }
      
      melody.push(notes[noteIndex]);
    }

    return melody;
  }, [state.keySignature, state.length, state.chaos]);

  // Melodie abspielen
  const playMelody = useCallback(() => {
    if (!synthRef.current) return;

    const melody = generateMelody();
    const noteDuration = '8n';
    
    console.log('🎵 Spiele Melodie:', melody);
    
    melody.forEach((note, index) => {
      const time = `+${index * 0.5}`; // Jede Note nach 0.5 Sekunden
      const velocity = 0.5 + Math.random() * 0.3;
      synthRef.current!.triggerAttackRelease(note, noteDuration, time, velocity);
    });
  }, [generateMelody]);

  const handlePlay = useCallback(async () => {
    if (state.isPlaying || state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await initAudio();
      
      setState(prev => ({
        ...prev,
        isPlaying: true,
        isLoading: false
      }));

      console.log('🎵 STARTING - BPM:', state.bpm);

      // Loop erstellen - ENDTLOS WIEDERHOLEN
      const loopDuration = state.length * 0.5; // Dauer der Melodie in Sekunden
      
      loopRef.current = new Tone.Loop(() => {
        console.log('🔁 Loop wiederholt!');
        playMelody();
      }, loopDuration).start(0);
      
      // Transport LOOP aktivieren!
      Tone.Transport.loop = true;
      Tone.Transport.loopStart = 0;
      Tone.Transport.loopEnd = loopDuration;
      Tone.Transport.bpm.value = state.bpm;

      // Transport starten
      await Tone.Transport.start();

      // Erste Melodie sofort spielen
      playMelody();

      console.log('✅ Loop läuft!', Tone.Transport.state);

    } catch (error) {
      console.error('❌ Fehler beim Starten:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.isPlaying, state.isLoading, state.bpm, state.length, initAudio, playMelody]);

  const handleStop = useCallback(async () => {
    if (!state.isPlaying) return;

    console.log('⏹ STOPPEN...');

    try {
      // isLoading setzen damit Controls disabled werden während wir stoppen
      setState(prev => ({ ...prev, isLoading: true }));

      // Loop stoppen
      if (loopRef.current) {
        loopRef.current.dispose();
        loopRef.current = null;
      }

      // Transport stoppen und resetten
      Tone.Transport.stop();
      Tone.Transport.loop = false;
      Tone.Transport.cancel();

      // Alle ausstehenden Notes stoppen
      if (synthRef.current) {
        synthRef.current.releaseAll();
      }

      // State zurücksetzen - WICHTIG: isLoading auf false!
      setState({
        ...state,
        isPlaying: false,
        isLoading: false
      });

      console.log('✅ GESTOPPT - State:', { isPlaying: false, isLoading: false });
    } catch (error) {
      console.error('❌ Fehler beim Stoppen:', error);
      // Im Fehlerfall auch isLoading zurücksetzen
      setState(prev => ({ ...prev, isPlaying: false, isLoading: false }));
    }
  }, [state.isPlaying, state]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (loopRef.current) loopRef.current.dispose();
      if (synthRef.current) synthRef.current.dispose();
      if (reverbRef.current) reverbRef.current.dispose();
      if (delayRef.current) delayRef.current.dispose();
      if (chorusRef.current) chorusRef.current.dispose();
      Tone.Transport.stop();
      Tone.Transport.loop = false;
    };
  }, []);

  const updateState = useCallback(<K extends keyof AppState>(
    key: K,
    value: AppState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="app-container">
      <div className="app-content">
        <Header isLoading={state.isLoading} />
        <Visualizer isPlaying={state.isPlaying} chaos={state.chaos} bpm={state.bpm} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <ControlPanel
            bpm={state.bpm}
            setBpm={(value) => updateState('bpm', value)}
            chaos={state.chaos}
            setChaos={(value) => updateState('chaos', value)}
            length={state.length}
            setLength={(value) => updateState('length', value)}
            keySignature={state.keySignature}
            setKeySignature={(value) => updateState('keySignature', value)}
            waveform={state.waveform}
            setWaveform={(value) => updateState('waveform', value as WaveformType)}
            isLoading={state.isLoading}
            scale={'Minor'}
            setScale={() => {}}
            rhythm={'8th'}
            setRhythm={() => {}}
            section={'Verse'}
            setSection={() => {}}
            arrangement={'simple'}
            setArrangement={() => {}}
            density={50}
            setDensity={() => {}}
            range={50}
            setRange={() => {}}
            jumpSize={50}
            setJumpSize={() => {}}
            repetition={50}
            setRepetition={() => {}}
            effects={{ reverb: true, delay: true, chorus: true, compressor: true, eq: true }}
            effectParams={{
              reverb: { decay: 2, wet: 0.4 },
              delay: { time: '8n', feedback: 0.4, wet: 0.3 },
              chorus: { frequency: 1.5, depth: 0.7, wet: 0.5 },
              compressor: { threshold: -12, ratio: 3 },
              eq: { low: 0, mid: 0, high: 0 }
            }}
            toggleEffect={() => {}}
            updateEffectParam={() => {}}
            loadPreset={() => {}}
          />
          
          <PlayControls
            isPlaying={state.isPlaying}
            onPlay={handlePlay}
            onStop={handleStop}
            isLoading={state.isLoading}
          />
        </div>
        
        <Footer />
      </div>
    </div>
  );
};

export default App;
