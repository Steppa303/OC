# Browser Test Instruktionen für Three.js Blob Engine

## Server status: ✅ Läuft auf http://localhost:3004/threejs-blob-engine/

## Test Schritte:

1. **Öffne Browser**: gehe zu `http://localhost:3004/threejs-blob-engine/`
2. **Erwartetes Ergebnis**:
   - Weißer Hintergrund (nicht schwarz!)
   - Fullscreen Canvas (ganze Seite ausfüllen)
   - Schwarzer schimmernder Blob rotiert im Zentrum
   - Weiße平台 darunter
   - Weiße Hintergrundwand
3. **Rechte Maustaste**: Camera Rotation (OrbitControls)
4. **Scrollen**: Zoom In/Out

## Wie man Screenshots macht:

1. Drücke **F12** (Developer Tools)
2. Drücke **Ctrl+Shift+P** (Command Menu)
3. Tippe "screenshot" und wähle "Capture full size screenshot"
4. Save nach `/root/.openclaw/workspace/test-results/threejs-blob-engine/browser-*.png`

## For QA Agent:
Benutze die Screenshots von echtem Browser als proof dass:
- ✅ Hintergrund ist WEISS (nicht schwarz)
- ✅ Canvas ist Fullscreen (nicht 150px)
- ✅ Studio-Raum ist Weiß (Wände + Boden)
