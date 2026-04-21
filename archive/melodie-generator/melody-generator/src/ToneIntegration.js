// Tone.js Integration für Akkorde und Bass
// Diese Datei enthält spezialisierte Funktionen für die Klangerzeugung

const Tone = require('tone');

class ToneJSIntegration {
  constructor() {
    // Effekte definieren (OHNE .toDestination() für korrekte Kette)
    this.chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7 });
    this.delay = new Tone.FeedbackDelay({ delayTime: 0.2, feedback: 0.4 });
    this.reverb = new Tone.Reverb({ decay: 4 });
    this.compressor = new Tone.Compressor({ threshold: -6, ratio: 3 });
    this.eq3 = new Tone.EQ3({ low: -6, mid: 0, high: 6 });

    // Verbinde die Effektkette: Chorus → Delay → Reverb → Compressor → EQ → Destination
    this.chorus.connect(this.delay);
    this.delay.connect(this.reverb);
    this.reverb.connect(this.compressor);
    this.compressor.connect(this.eq3);
    this.eq3.toDestination();

    // Synths erstellen OHNE direkte Verbindung zur Destination
    this.synths = {
      melody: new Tone.PolySynth(Tone.Synth),
      chords: new Tone.PolySynth(Tone.AMSynth),
      bass: new Tone.MembraneSynth(),
      pad: new Tone.PolySynth(Tone.PluckSynth)
    };

    // Verbinde Synths zur Effektkette
    this.synths.melody.connect(this.chorus);
    this.synths.chords.connect(this.chorus);
    this.synths.bass.connect(this.chorus);
    this.synths.pad.connect(this.chorus);
  }

  // Spielt eine Melodie ab
  playMelody(notes, options = {}) {
    const {
      instrument = 'synth',
      attack = 0.01,
      release = 0.2,
      filterFreq = 3000
    } = options;
    
    // Setze Synthesizer-Parameter
    this.synths.melody.set({
      oscillator: { type: instrument },
      envelope: { attack, release }
    });
    
    // Setze Transport auf Loop-Modus
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
    
    notes.forEach((noteData) => {
      this.synths.melody.triggerAttackRelease(
        noteData.note,
        noteData.duration || "8n",
        noteData.time,
        noteData.velocity || 0.7
      );
    });
  }

  // Spielt Akkorde ab
  playChords(chords, options = {}) {
    const {
      attack = 0.1,
      release = 0.5,
      filterFreq = 2000
    } = options;
    
    this.synths.chords.set({
      envelope: { attack, release }
    });
    
    // Stelle sicher, dass Transport im Loop-Modus bleibt
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
    
    chords.forEach((chordData) => {
      this.synths.chords.triggerAttackRelease(
        chordData.chord,
        chordData.duration || "2n",
        chordData.time,
        chordData.velocity || 0.5
      );
    });
  }

  // Spielt die Bassline ab
  playBassline(bassNotes, options = {}) {
    const {
      attack = 0.01,
      release = 0.3,
      filterFreq = 1000
    } = options;
    
    this.synths.bass.set({
      pitchDecay: 0.05,
      octaves: 3,
      envelope: { attack, release }
    });
    
    // Stelle sicher, dass Transport im Loop-Modus bleibt
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
    
    bassNotes.forEach((bassData) => {
      this.synths.bass.triggerAttackRelease(
        bassData.note,
        bassData.duration || "4n",
        bassData.time,
        bassData.velocity || 0.6
      );
    });
  }

  // Spielt das Pad ab
  playPad(padNotes, options = {}) {
    const {
      attack = 0.5,
      release = 1.0,
      filterFreq = 4000
    } = options;
    
    this.synths.pad.set({
      attackNoise: 0.1,
      dampening: 4000,
      resonance: 0.7,
      combFilterResonance: 0.7,
      envelope: { attack, release }
    });
    
    // Stelle sicher, dass Transport im Loop-Modus bleibt
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
    
    padNotes.forEach((padData) => {
      this.synths.pad.triggerAttackRelease(
        padData.note,
        padData.duration || "1m", // Ganze Maß
        padData.time,
        padData.velocity || 0.3
      );
    });
  }

  // Stoppt alle Sounds
  stopAll() {
    Object.values(this.synths).forEach(synth => synth.releaseAll());
    Tone.Transport.stop();
  }

  // Startet die Transport Engine
  async startTransport() {
    await Tone.start();
    if (Tone.Transport.state !== 'started') {
      await Tone.Transport.start();
    }
    Tone.Transport.loop = true;  // WICHTIG für kontinuierliche Wiedergabe
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte
  }

  // Stoppt die Transport Engine
  stopTransport() {
    Tone.Transport.stop();
  }

  // Setzt BPM
  setBPM(bpm) {
    Tone.Transport.bpm.value = bpm;
  }

  // Spielt eine Sequenz ab
  playSequence(sequence, synthType) {
    if (!this.synths[synthType]) return;
    
    const synth = this.synths[synthType];
    const pattern = new Tone.Sequence((time, note) => {
      synth.triggerAttackRelease(note, "8n", time);
    }, sequence.notes, sequence.subdiv);
    
    pattern.start(0);
    return pattern;
  }
}

module.exports = ToneJSIntegration;