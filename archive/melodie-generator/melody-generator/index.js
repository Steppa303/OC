// Hauptindex-Datei für den Musikgenerator
const express = require('express');
const path = require('path');
const AdvancedMelodyGenerator = require('./src/MelodyGenerator');
const ToneJSIntegration = require('./src/ToneIntegration');

const app = express();
const PORT = process.env.PORT || 3000;

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// JSON-Parser für eingehende Requests
app.use(express.json());

// Instanz des Musikgenerators
const generator = new AdvancedMelodyGenerator();
const toneIntegration = new ToneJSIntegration();

// API-Endpunkt zum Generieren einer Melodie
app.post('/api/generate', async (req, res) => {
  try {
    const {
      rootNote = 'C4',
      scaleType = 'major',
      bpm = 120,
      structure = {},
      parameters = {}
    } = req.body;

    // Setze die Parameter
    generator.rootNote = rootNote;
    generator.setScale(rootNote, scaleType);
    generator.bpm = bpm;

    // Aktualisiere Struktur falls übergeben
    if (Object.keys(structure).length > 0) {
      generator.structure = { ...generator.structure, ...structure };
    }

    // Aktualisiere Parameter falls übergeben
    if (Object.keys(parameters).length > 0) {
      generator.parameters = { ...generator.parameters, ...parameters };
    }

    // Generiere die Komposition
    const composition = generator.generateComposition();

    // Sende die Komposition zurück
    res.json({
      success: true,
      composition: composition,
      metadata: {
        rootNote,
        scaleType,
        bpm,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Fehler beim Generieren der Melodie:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API-Endpunkt zum Abspielen einer Komposition
app.post('/api/play', async (req, res) => {
  try {
    const { composition, options = {} } = req.body;

    // Starte die Transport Engine
    await toneIntegration.startTransport();
    toneIntegration.setBPM(generator.bpm);

    // Setze Transport auf Loop-Modus
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '16m'; // 16 Takte

    // Spiele jeden Teil der Komposition ab
    for (const section in composition) {
      const sectionData = composition[section];

      // Spiele Melodie
      if (sectionData.melody && sectionData.melody.length > 0) {
        toneIntegration.playMelody(sectionData.melody, options.melody);
      }

      // Spiele Akkorde
      if (sectionData.chords && sectionData.chords.length > 0) {
        setTimeout(() => {
          toneIntegration.playChords(sectionData.chords, options.chords);
        }, 100);
      }

      // Spiele Bassline
      if (sectionData.bassline && sectionData.bassline.length > 0) {
        setTimeout(() => {
          toneIntegration.playBassline(sectionData.bassline, options.bass);
        }, 200);
      }

      // Spiele Pad
      if (sectionData.pad && sectionData.pad.length > 0) {
        setTimeout(() => {
          toneIntegration.playPad(sectionData.pad, options.pad);
        }, 300);
      }
    }

    res.json({
      success: true,
      message: 'Komposition wird abgespielt'
    });
  } catch (error) {
    console.error('Fehler beim Abspielen der Komposition:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API-Endpunkt zum Stoppen der Wiedergabe
app.post('/api/stop', (req, res) => {
  try {
    toneIntegration.stopAll();
    res.json({
      success: true,
      message: 'Wiedergabe gestoppt'
    });
  } catch (error) {
    console.error('Fehler beim Stoppen der Wiedergabe:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API-Endpunkt zum Abrufen verfügbarer Skalen
app.get('/api/scales', (req, res) => {
  res.json({
    success: true,
    scales: generator.scaleTypes
  });
});

// API-Endpunkt zum Abrufen der Standardstruktur
app.get('/api/default-structure', (req, res) => {
  res.json({
    success: true,
    structure: generator.structure
  });
});

// API-Endpunkt zum Abrufen der Standardparameter
app.get('/api/default-parameters', (req, res) => {
  res.json({
    success: true,
    parameters: generator.parameters
  });
});

// Hauptseite
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Starte den Server
app.listen(PORT, () => {
  console.log(`🎵 Musikgenerator-Server läuft auf Port ${PORT}`);
  console.log(`Zugriff unter: http://localhost:${PORT}`);
});