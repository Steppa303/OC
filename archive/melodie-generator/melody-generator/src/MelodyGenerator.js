// Modular Music Generator - Hauptdatei
const express = require('express');
const Tone = require('tone');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Hauptklasse für die Melodiegenerierung
class AdvancedMelodyGenerator {
  constructor() {
    this.scaleTypes = ['major', 'minor', 'pentatonicMajor', 'pentatonicMinor', 'blues', 'dorian', 'phrygian', 'lydian', 'mixolydian'];
    this.currentScale = null;
    this.rootNote = 'C4';
    this.bpm = 120;
    
    // Struktur-Parameter
    this.structure = {
      intro: { duration: 4, density: 0.3, intensity: 0.3 },
      verse: { duration: 8, density: 0.5, intensity: 0.5 },
      chorus: { duration: 8, density: 0.8, intensity: 0.9 },
      bridge: { duration: 4, density: 0.4, intensity: 0.6 },
      outro: { duration: 4, density: 0.2, intensity: 0.2 }
    };
    
    // Melodie-Parameter
    this.parameters = {
      noteDensity: 0.5,        // Anzahl der Noten pro Beat
      pitchRange: 'medium',    // niedrig/mittel/hoch
      jumpSize: 'small',       // small/large
      rhythmVariation: 'even', // even/syncopated
      repetitionFactor: 0.3    // Wie stark Motive wiederholt werden
    };
  }

  // Setzt die aktuelle Tonart
  setScale(rootNote, scaleType) {
    this.rootNote = rootNote;
    this.currentScale = new Tone.Scale(rootNote, scaleType);
  }

  // Generiert eine Skala basierend auf Typ und Wurzelnote
  generateScale(rootNote, scaleType) {
    return new Tone.Scale(rootNote, scaleType);
  }

  // Generiert eine Melodie basierend auf Parametern
  generateMelody(section, params) {
    const { duration, density, intensity } = this.structure[section];
    const scale = this.currentScale || this.generateScale(this.rootNote, 'major');
    
    // Anpassung der Parameter für diesen Abschnitt
    const sectionParams = {
      ...this.parameters,
      noteDensity: this.parameters.noteDensity * density,
      intensity: intensity
    };
    
    // Generiere Noten für diesen Abschnitt
    const notes = this.createSectionNotes(scale, duration, sectionParams);
    return notes;
  }

  // Erzeugt Noten für einen bestimmten Abschnitt
  createSectionNotes(scale, duration, params) {
    const notes = [];
    const totalBeats = duration * 4; // Annahme: 4/4 Takt
    
    // Bestimme die Anzahl der Noten basierend auf Dichte
    const noteCount = Math.floor(totalBeats * params.noteDensity);
    
    // Wähle Noten aus der Skala basierend auf den Parametern
    for (let i = 0; i < noteCount; i++) {
      const beatPosition = i * (totalBeats / noteCount);
      
      // Wähle Note aus Skala
      let noteIndex;
      switch(params.pitchRange) {
        case 'low':
          noteIndex = Math.floor(Math.random() * 3);
          break;
        case 'high':
          noteIndex = Math.floor(Math.random() * 3) + scale.get().length - 3;
          break;
        default: // medium
          noteIndex = Math.floor(Math.random() * scale.get().length);
      }
      
      // Stelle sicher, dass Index innerhalb der Skala liegt
      noteIndex = noteIndex % scale.get().length;
      const note = scale.get()[noteIndex];
      
      // Berücksichtige Sprunggröße
      if (params.jumpSize === 'large' && i > 0) {
        // Wahrscheinlichkeit erhöhen, dass größere Intervalle gewählt werden
        const currentIndex = scale.get().findIndex(n => n === note);
        let newIndex = currentIndex + (Math.random() > 0.5 ? 3 : -3);
        newIndex = Math.max(0, Math.min(newIndex, scale.get().length - 1));
        note = scale.get()[newIndex];
      }
      
      // Füge Note mit Timing hinzu
      notes.push({
        time: beatPosition,
        note: note,
        velocity: params.intensity * (0.7 + Math.random() * 0.3) // Lautstärke basierend auf Intensität
      });
    }
    
    return notes;
  }

  // Generiert eine Akkordprogression für den Abschnitt
  generateChordProgression(section, params) {
    const { duration } = this.structure[section];
    const chords = [];
    
    // Standard-Akkordprogressionen je nach Abschnitt
    let chordProgression;
    switch(section) {
      case 'intro':
        chordProgression = ['I', 'vi', 'IV', 'V'];
        break;
      case 'verse':
        chordProgression = ['I', 'V', 'vi', 'IV'];
        break;
      case 'chorus':
        chordProgression = ['IV', 'I', 'V', 'vi'];
        break;
      case 'bridge':
        chordProgression = ['vi', 'IV', 'I', 'V'];
        break;
      case 'outro':
        chordProgression = ['I', 'IV', 'V', 'I'];
        break;
      default:
        chordProgression = ['I', 'V', 'vi', 'IV'];
    }
    
    // Konvertiere römische Zahlen zu tatsächlichen Akkorden
    const scaleChords = this.convertRomanToChords(chordProgression, params);
    
    // Erzeuge Akkorde mit Timing
    for (let i = 0; i < duration; i++) {
      const chordIndex = i % chordProgression.length;
      chords.push({
        time: i * 4, // Jeder Akkord dauert einen Takt (4 Beats)
        chord: scaleChords[chordIndex]
      });
    }
    
    return chords;
  }

  // Konvertiert römische Zahlen zu tatsächlichen Akkorden
  convertRomanToChords(romanNumerals, params) {
    const scaleNotes = this.currentScale ? this.currentScale.get() : this.generateScale(this.rootNote, 'major').get();
    const majorChords = ['maj', 'm', 'm', 'maj', 'maj', 'm', 'dim'];
    const minorChords = ['m', 'dim', 'maj', 'm', 'm', 'maj', 'maj'];
    
    // Bestimme ob Dur- oder Moll-Skala
    const isMajor = this.currentScale.type.includes('major') || this.currentScale.type === 'ionian';
    const chordQualities = isMajor ? majorChords : minorChords;
    
    return romanNumerals.map(roman => {
      // Entferne Groß-/Kleinschreibung und ggf. zusätzliche Zeichen
      const cleanRoman = roman.replace(/[^\dIViv]/g, '');
      let degree;
      
      // Bestimme Grad der Tonleiter
      switch(cleanRoman.toUpperCase()) {
        case 'I': degree = 0; break;
        case 'II': degree = 1; break;
        case 'III': degree = 2; break;
        case 'IV': degree = 3; break;
        case 'V': degree = 4; break;
        case 'VI': degree = 5; break;
        case 'VII': degree = 6; break;
        default: degree = 0;
      }
      
      // Stelle sicher, dass der Grad innerhalb der Skala liegt
      degree = degree % scaleNotes.length;
      
      // Erzeuge die Note mit der richtigen Oktave
      const baseNote = scaleNotes[degree];
      
      // Extrahiere Oktave von der Wurzelnote
      const octave = this.rootNote.match(/\d/)[0];
      
      // Ersetze die Oktave in der gefundenen Note
      const noteWithOctave = baseNote.replace(/[0-9]/, octave);
      
      // Füge Akkordqualität hinzu
      return `${noteWithOctave}${chordQualities[degree]}`;
    });
  }

  // Generiert eine Bassline
  generateBassline(section, params) {
    const { duration } = this.structure[section];
    const bassNotes = [];
    
    // Erzeuge Bassnoten basierend auf der Akkordprogression
    const chords = this.generateChordProgression(section, params);
    
    for (const chord of chords) {
      // Verwende jeweils die Root-Note des Akkords für die Bassline
      const rootNote = chord.chord.substring(0, chord.chord.length - 3); // Entfernt Akkordtyp (z.B. 'maj', 'm')
      
      // Senke die Oktave für die Bassline
      const bassNote = rootNote.replace(/(\d)/, (match) => parseInt(match) - 1);
      
      bassNotes.push({
        time: chord.time,
        note: bassNote,
        velocity: 0.6
      });
    }
    
    return bassNotes;
  }

  // Generiert ein Hintergrund-Pad
  generatePad(section, params) {
    const { duration } = this.structure[section];
    const padNotes = [];
    
    // Erzeuge leise, langgehaltene Akkorde für das Pad
    const chords = this.generateChordProgression(section, params);
    
    for (const chord of chords) {
      // Konvertiere Akkord zu einzelnen Noten für das Pad
      const chordObj = new Tone.Chord(chord.chord);
      const chordNotes = chordObj.get();
      
      // Füge jede Note des Akkords als Pad hinzu
      chordNotes.forEach(note => {
        padNotes.push({
          time: chord.time,
          note: note,
          velocity: 0.2,
          duration: '2n' // Halben Ton lang
        });
      });
    }
    
    return padNotes;
  }

  // Spielt eine Melodie ab
  playMelody(notes) {
    const synth = new Tone.PolySynth(Tone.Synth);
    
    // Effekte definieren
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7 });
    const delay = new Tone.FeedbackDelay({ delayTime: 0.2, feedback: 0.4 });
    const reverb = new Tone.Reverb({ decay: 4 });
    const compressor = new Tone.Compressor({ threshold: -6, ratio: 3 });
    const eq3 = new Tone.EQ3({ low: -6, mid: 0, high: 6 });
    
    // Verkettung: Synth → Chorus → Delay → Reverb → Compressor → EQ → Destination
    synth.chain(chorus, delay, reverb, compressor, eq3, Tone.Destination);
    
    notes.forEach((noteData) => {
      synth.triggerAttackRelease(
        noteData.note,
        "8n", // Achtelnote
        noteData.time,
        noteData.velocity
      );
    });
    
    Tone.Transport.bpm.value = this.bpm;
    
    // Sicherstellen, dass Transport läuft und im Loop-Modus ist
    if (Tone.Transport.state !== 'started') {
      Tone.start().then(() => {
        Tone.Transport.start();
      });
    }
    Tone.Transport.loop = true;  // WICHTIG!
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
  }

  // Spielt Akkorde ab
  playChords(chords) {
    const synth = new Tone.PolySynth(Tone.AMSynth);
    
    // Effekte definieren
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7 });
    const delay = new Tone.FeedbackDelay({ delayTime: 0.2, feedback: 0.4 });
    const reverb = new Tone.Reverb({ decay: 4 });
    const compressor = new Tone.Compressor({ threshold: -6, ratio: 3 });
    const eq3 = new Tone.EQ3({ low: -6, mid: 0, high: 6 });
    
    // Verkettung: Synth → Chorus → Delay → Reverb → Compressor → EQ → Destination
    synth.chain(chorus, delay, reverb, compressor, eq3, Tone.Destination);
    
    chords.forEach((chordData) => {
      synth.triggerAttackRelease(
        chordData.chord,
        "1n", // Ganzer Ton
        chordData.time,
        0.5
      );
    });
    
    // Sicherstellen, dass Transport im Loop-Modus bleibt
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
  }

  // Spielt die Bassline ab
  playBassline(bassNotes) {
    const bassSynth = new Tone.MembraneSynth();
    
    // Effekte definieren
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7 });
    const delay = new Tone.FeedbackDelay({ delayTime: 0.2, feedback: 0.4 });
    const reverb = new Tone.Reverb({ decay: 4 });
    const compressor = new Tone.Compressor({ threshold: -6, ratio: 3 });
    const eq3 = new Tone.EQ3({ low: -6, mid: 0, high: 6 });
    
    // Verkettung: Synth → Chorus → Delay → Reverb → Compressor → EQ → Destination
    bassSynth.chain(chorus, delay, reverb, compressor, eq3, Tone.Destination);
    
    bassNotes.forEach((bassData) => {
      bassSynth.triggerAttackRelease(
        bassData.note,
        "4n", // Viertelnote
        bassData.time,
        bassData.velocity
      );
    });
    
    // Sicherstellen, dass Transport im Loop-Modus bleibt
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
  }

  // Spielt das Pad ab
  playPad(padNotes) {
    const padSynth = new Tone.PolySynth(Tone.PluckSynth);
    
    // Effekte definieren
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7 });
    const delay = new Tone.FeedbackDelay({ delayTime: 0.2, feedback: 0.4 });
    const reverb = new Tone.Reverb({ decay: 4 });
    const compressor = new Tone.Compressor({ threshold: -6, ratio: 3 });
    const eq3 = new Tone.EQ3({ low: -6, mid: 0, high: 6 });
    
    // Verkettung: Synth → Chorus → Delay → Reverb → Compressor → EQ → Destination
    padSynth.chain(chorus, delay, reverb, compressor, eq3, Tone.Destination);
    
    padNotes.forEach((padData) => {
      padSynth.triggerAttackRelease(
        padData.note,
        padData.duration,
        padData.time,
        padData.velocity
      );
    });
    
    // Sicherstellen, dass Transport im Loop-Modus bleibt
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
  }

  // Generiert eine vollständige Komposition basierend auf der Struktur
  generateComposition() {
    const composition = {};
    
    for (const section in this.structure) {
      composition[section] = {
        melody: this.generateMelody(section, this.parameters),
        chords: this.generateChordProgression(section, this.parameters),
        bassline: this.generateBassline(section, this.parameters),
        pad: this.generatePad(section, this.parameters)
      };
    }
    
    return composition;
  }

  // Spielt die gesamte Komposition ab
  playComposition(composition) {
    // Setze Transport auf Loop-Modus
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
    
    // Spiele jeden Abschnitt ab
    for (const section in composition) {
      const sectionData = composition[section];
      
      // Melodie
      this.playMelody(sectionData.melody);
      
      // Akkorde
      setTimeout(() => {
        this.playChords(sectionData.chords);
      }, 100);
      
      // Bassline
      setTimeout(() => {
        this.playBassline(sectionData.bassline);
      }, 200);
      
      // Pad
      setTimeout(() => {
        this.playPad(sectionData.pad);
      }, 300);
    }
  }
}

// Exportiere die Klasse
module.exports = AdvancedMelodyGenerator;

// Wenn die Datei direkt ausgeführt wird
if (require.main === module) {
  const generator = new AdvancedMelodyGenerator();
  
  // Beispiel: Setze eine C-Dur-Skala
  generator.setScale('C4', 'major');
  
  // Generiere eine Komposition
  const composition = generator.generateComposition();
  
  console.log('Komposition generiert:', Object.keys(composition));
  
  // Optional: Spiele die Komposition ab
  // generator.playComposition(composition);
}