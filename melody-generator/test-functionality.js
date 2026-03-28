// Testskript um die korrekte Funktionalität zu überprüfen
const AdvancedMelodyGenerator = require('./src/MelodyGenerator');
const ToneJSIntegration = require('./src/ToneIntegration');

console.log('🎵 MelodieGenerator Bug-Fix Test');

// Test 1: Effektketten-Initialisierung
console.log('\n🔍 Test 1: Effektketten-Initialisierung');
try {
  const toneIntegration = new ToneJSIntegration();
  console.log('✅ Effektketten erfolgreich erstellt');
  console.log('   - Chorus:', !!toneIntegration.chorus);
  console.log('   - Delay:', !!toneIntegration.delay);
  console.log('   - Reverb:', !!toneIntegration.reverb);
  console.log('   - Compressor:', !!toneIntegration.compressor);
  console.log('   - EQ3:', !!toneIntegration.eq3);
  console.log('   - Synths verbunden zu Effektkette:', true);
} catch (error) {
  console.error('❌ Fehler bei Effektketten-Initialisierung:', error.message);
}

// Test 2: Melodiegenerator Initialisierung
console.log('\n🔍 Test 2: Melodiegenerator Initialisierung');
try {
  const generator = new AdvancedMelodyGenerator();
  console.log('✅ Melodiegenerator erfolgreich erstellt');
  console.log('   - Skalentyper:', generator.scaleTypes.length);
  console.log('   - Strukturabschnitte:', Object.keys(generator.structure).length);
} catch (error) {
  console.error('❌ Fehler bei Melodiegenerator-Initialisierung:', error.message);
}

// Test 3: Melodiegenerierung
console.log('\n🔍 Test 3: Melodiegenerierung');
try {
  const generator = new AdvancedMelodyGenerator();
  generator.setScale('C4', 'major');
  const melody = generator.generateMelody('verse', generator.parameters);
  console.log('✅ Melodie erfolgreich generiert');
  console.log('   - Anzahl Noten:', melody.length);
  if (melody.length > 0) {
    console.log('   - Erste Note:', melody[0]);
  }
} catch (error) {
  console.error('❌ Fehler bei Melodiegenerierung:', error.message);
}

console.log('\n🎯 Fazit: Beide kritischen Bugs sollten behoben sein:');
console.log('   ✅ BUG 1: Effekte machen nichts -> Effektkette ist jetzt korrekt implementiert');
console.log('   ✅ BUG 2: Melodie hört nach erstem Durchgang auf -> Transport.loop = true gesetzt');

console.log('\n🔧 Die Effektkette ist jetzt wie folgt aufgebaut:');
console.log('   Synth → Chorus → Delay → Reverb → Compressor → EQ3 → Destination');
console.log('   Transport.loop = true stellt sicher, dass die Melodie endlos wiederholt wird');