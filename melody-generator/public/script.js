// JavaScript für den Melody Generator
document.addEventListener('DOMContentLoaded', () => {
    // Referenzen zu DOM-Elementen
    const generateBtn = document.getElementById('generate-btn');
    const playBtn = document.getElementById('play-btn');
    const stopBtn = document.getElementById('stop-btn');
    const compositionDataEl = document.getElementById('composition-data');
    
    // Parameter-Elemente
    const rootNoteEl = document.getElementById('rootNote');
    const scaleTypeEl = document.getElementById('scaleType');
    const bpmEl = document.getElementById('bpm');
    const bpmValueEl = document.getElementById('bpm-value');
    const noteDensityEl = document.getElementById('noteDensity');
    const noteDensityValueEl = document.getElementById('noteDensity-value');
    const pitchRangeEl = document.getElementById('pitchRange');
    const jumpSizeEl = document.getElementById('jumpSize');
    const rhythmVariationEl = document.getElementById('rhythmVariation');
    const repetitionFactorEl = document.getElementById('repetitionFactor');
    const repetitionFactorValueEl = document.getElementById('repetitionFactor-value');
    
    // Struktur-Elemente
    const introDurationEl = document.getElementById('intro-duration');
    const introDensityEl = document.getElementById('intro-density');
    const introIntensityEl = document.getElementById('intro-intensity');
    const verseDurationEl = document.getElementById('verse-duration');
    const verseDensityEl = document.getElementById('verse-density');
    const verseIntensityEl = document.getElementById('verse-intensity');
    const chorusDurationEl = document.getElementById('chorus-duration');
    const chorusDensityEl = document.getElementById('chorus-density');
    const chorusIntensityEl = document.getElementById('chorus-intensity');
    const bridgeDurationEl = document.getElementById('bridge-duration');
    const bridgeDensityEl = document.getElementById('bridge-density');
    const bridgeIntensityEl = document.getElementById('bridge-intensity');
    const outroDurationEl = document.getElementById('outro-duration');
    const outroDensityEl = document.getElementById('outro-density');
    const outroIntensityEl = document.getElementById('outro-intensity');
    
    // Zustand
    let currentComposition = null;
    let isPlaying = false;
    
    // Event Listener für Slider-Werte
    bpmEl.addEventListener('input', () => {
        bpmValueEl.textContent = bpmEl.value;
    });
    
    noteDensityEl.addEventListener('input', () => {
        noteDensityValueEl.textContent = parseFloat(noteDensityEl.value).toFixed(1);
    });
    
    repetitionFactorEl.addEventListener('input', () => {
        repetitionFactorValueEl.textContent = parseFloat(repetitionFactorEl.value).toFixed(1);
    });
    
    // Generiere Melodie
    generateBtn.addEventListener('click', async () => {
        updateButtonState(generateBtn, true, 'Generiere...');
        
        try {
            const params = collectParameters();
            
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });
            
            const result = await response.json();
            
            if (result.success) {
                currentComposition = result.composition;
                compositionDataEl.textContent = JSON.stringify(result.composition, null, 2);
                showMessage('Melodie erfolgreich generiert!', 'success');
            } else {
                showMessage(`Fehler: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Fehler beim Generieren:', error);
            showMessage(`Fehler: ${error.message}`, 'error');
        } finally {
            updateButtonState(generateBtn, false, ' melodisch generieren');
        }
    });
    
    // Spiele Komposition ab
    playBtn.addEventListener('click', async () => {
        if (!currentComposition) {
            showMessage('Keine Komposition zum Abspielen vorhanden. Bitte zuerst generieren.', 'warning');
            return;
        }
        
        updateButtonState(playBtn, true, 'Spielt ab...');
        isPlaying = true;
        
        try {
            const response = await fetch('/api/play', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    composition: currentComposition,
                    options: {
                        melody: { instrument: 'sine', attack: 0.01, release: 0.2 },
                        chords: { attack: 0.1, release: 0.5 },
                        bass: { attack: 0.01, release: 0.3 },
                        pad: { attack: 0.5, release: 1.0 }
                    }
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showMessage('Komposition wird abgespielt...', 'info');
            } else {
                showMessage(`Fehler beim Abspielen: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Fehler beim Abspielen:', error);
            showMessage(`Fehler: ${error.message}`, 'error');
        } finally {
            updateButtonState(playBtn, false, 'Wiedergabe starten');
        }
    });
    
    // Stoppe Wiedergabe
    stopBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                isPlaying = false;
                showMessage('Wiedergabe gestoppt', 'info');
            } else {
                showMessage(`Fehler beim Stoppen: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Fehler beim Stoppen:', error);
            showMessage(`Fehler: ${error.message}`, 'error');
        }
    });
    
    // Hilfsfunktionen
    function collectParameters() {
        return {
            rootNote: rootNoteEl.value,
            scaleType: scaleTypeEl.value,
            bpm: parseInt(bpmEl.value),
            parameters: {
                noteDensity: parseFloat(noteDensityEl.value),
                pitchRange: pitchRangeEl.value,
                jumpSize: jumpSizeEl.value,
                rhythmVariation: rhythmVariationEl.value,
                repetitionFactor: parseFloat(repetitionFactorEl.value)
            },
            structure: {
                intro: {
                    duration: parseInt(introDurationEl.value),
                    density: parseFloat(introDensityEl.value),
                    intensity: parseFloat(introIntensityEl.value)
                },
                verse: {
                    duration: parseInt(verseDurationEl.value),
                    density: parseFloat(verseDensityEl.value),
                    intensity: parseFloat(verseIntensityEl.value)
                },
                chorus: {
                    duration: parseInt(chorusDurationEl.value),
                    density: parseFloat(chorusDensityEl.value),
                    intensity: parseFloat(chorusIntensityEl.value)
                },
                bridge: {
                    duration: parseInt(bridgeDurationEl.value),
                    density: parseFloat(bridgeDensityEl.value),
                    intensity: parseFloat(bridgeIntensityEl.value)
                },
                outro: {
                    duration: parseInt(outroDurationEl.value),
                    density: parseFloat(outroDensityEl.value),
                    intensity: parseFloat(outroIntensityEl.value)
                }
            }
        };
    }
    
    function updateButtonState(button, isLoading, text) {
        if (isLoading) {
            button.innerHTML = '<span class="loading"></span> ' + text;
            button.disabled = true;
        } else {
            button.innerHTML = text;
            button.disabled = false;
        }
    }
    
    function showMessage(message, type) {
        // Entferne vorherige Nachrichten
        const existingMsg = document.querySelector('.message');
        if (existingMsg) {
            existingMsg.remove();
        }
        
        // Erstelle neue Nachricht
        const msgEl = document.createElement('div');
        msgEl.className = `message ${type}`;
        msgEl.textContent = message;
        msgEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem;
            border-radius: 4px;
            color: white;
            z-index: 1000;
            animation: slideIn 0.3s, fadeOut 0.5s 2.5s forwards;
        `;
        
        // Setze Farbe basierend auf Typ
        switch(type) {
            case 'success':
                msgEl.style.backgroundColor = '#10b981';
                break;
            case 'error':
                msgEl.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                msgEl.style.backgroundColor = '#f59e0b';
                break;
            case 'info':
                msgEl.style.backgroundColor = '#3b82f6';
                break;
        }
        
        document.body.appendChild(msgEl);
        
        // Entferne Nachricht nach 3 Sekunden
        setTimeout(() => {
            if (msgEl.parentNode) {
                msgEl.parentNode.removeChild(msgEl);
            }
        }, 3000);
    }
    
    // Füge Animationen zum Stylesheet hinzu
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Initialisiere Werte
    bpmValueEl.textContent = bpmEl.value;
    noteDensityValueEl.textContent = parseFloat(noteDensityEl.value).toFixed(1);
    repetitionFactorValueEl.textContent = parseFloat(repetitionFactorEl.value).toFixed(1);
    
    // Versuche, verfügbare Skalen vom Server zu laden
    loadAvailableScales();
    
    async function loadAvailableScales() {
        try {
            const response = await fetch('/api/scales');
            const result = await response.json();
            
            if (result.success) {
                // Aktualisiere die Skalen-Liste falls nötig
                console.log('Verfügbare Skalen:', result.scales);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Skalen:', error);
        }
    }
    
    // Initialisiere die Piano Roll Visualisierung
    initPianoRoll();
    
    function initPianoRoll() {
        const canvas = document.getElementById('piano-roll');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        
        // Setze Canvas-Größe
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Zeichne eine einfache Piano Roll
        drawPianoRoll(ctx, canvas.width, canvas.height);
    }
    
    function drawPianoRoll(ctx, width, height) {
        // Leere den Canvas
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(0, 0, width, height);
        
        // Zeichne Gitter
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Horizontale Linien (Zeitachsen)
        for (let y = 0; y < height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Vertikale Linien (Notenhöhen)
        for (let x = 0; x < width; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Falls Komposition vorhanden, zeichne Noten
        if (currentComposition) {
            drawNotes(ctx, width, height);
        } else {
            // Zeige Hinweis
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Generiere eine Melodie, um sie hier zu visualisieren', width/2, height/2);
        }
    }
    
    function drawNotes(ctx, width, height) {
        // Dies ist eine vereinfachte Darstellung
        // In einer echten Implementierung würden wir die tatsächlichen Noten zeichnen
        
        if (!currentComposition) return;
        
        // Durchlaufe alle Abschnitte
        let timeOffset = 0;
        for (const [sectionName, sectionData] of Object.entries(currentComposition)) {
            const sectionDuration = currentComposition[sectionName]?.melody?.length > 0 
                ? Math.max(...currentComposition[sectionName].melody.map(n => n.time)) + 4 
                : 4;
                
            // Zeichne Melodienoten
            if (sectionData.melody) {
                sectionData.melody.forEach(note => {
                    const x = mapValue(note.time + timeOffset, 0, 64, 0, width);
                    const y = mapValue(note.note.charCodeAt(0), 65, 103, height, 0); // Grobe Notenhöhenzuordnung
                    
                    if (x >= 0 && x <= width && y >= 0 && y <= height) {
                        ctx.fillStyle = 'rgba(99, 102, 241, 0.7)'; // Violett für Melodienoten
                        ctx.fillRect(x - 5, y - 5, 10, 10);
                    }
                });
            }
            
            timeOffset += sectionDuration;
        }
    }
    
    function mapValue(value, start1, stop1, start2, stop2) {
        return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
    }
    
    // Aktualisiere Piano Roll wenn sich die Komposition ändert
    const originalSetItem = Object.getOwnPropertyDescriptor(window, 'compositionDataEl').set;
    const dataDisplayObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'textContent') {
                initPianoRoll();
            }
        });
    });
    
    // Alternative Methode: Überschreibe die Anzeigefunktion
    const originalCompositionDisplay = compositionDataEl.textContent;
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const originalSet = descriptor.set;
    
    // Wir aktualisieren die Visualisierung jedes Mal, wenn die Komposition angezeigt wird
    compositionDataEl.addEventListener('DOMSubtreeModified', function() {
        setTimeout(initPianoRoll, 100);
    });
});

// Globale Funktion für den Fall, dass Tone.js noch nicht geladen ist
window.initAudioContext = () => {
    if (typeof Tone !== 'undefined') {
        Tone.start();
        console.log('Audio-Context gestartet');
    }
};

// Starte Audio-Context bei Benutzerinteraktion
document.addEventListener('click', initAudioContext, { once: true });
document.addEventListener('touchstart', initAudioContext, { once: true });