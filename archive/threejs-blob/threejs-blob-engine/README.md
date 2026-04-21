# Three.js Blob Engine

Eine fortschrittliche 3D-Engine basierend auf React und Three.js mit einem schimmernden, sich kontinuierlich verformenden schwarzen Blob auf einem weißen Podest.

## Features

### Szene
1. **Schwarzer schimmernder Blob** der sich konstant verformt
   - Custom GLSL Shader (Vertex + Fragment)
   - Simplex/Perlin Noise für organische Verformung
   - Schimmernder Effekt (Fresnel/Rim Lighting)
   - Animation über Zeit-Uniform

2. **Weißes Podest** unter dem Blob
   - CylinderGeometry mit MeshStandardMaterial
   - Weißes Material mit leichter Metallizität und Rauheit

3. **State of the Art Beleuchtung**
   - Ambient Light für Basisbeleuchtung
   - Directional Light mit Schatten
   - Point Lights für Akzente
   - Environment Map für globale Beleuchtung

4. **Kamera & Controls**
   - Perspective Camera
   - OrbitControls für interaktive Rotation
   - Responsive Canvas

5. **React Integration**
   - Vite + React 18 Setup
   - @react-three/fiber für Three.js Integration
   - @react-three/drei für zusätzliche Funktionen
   - Loading Screen für bessere UX

## Technologie-Stack

- React 18+
- Three.js r160+
- @react-three/fiber
- @react-three/drei
- Vite für Build
- TailwindCSS für UI

## Deployment

Die Anwendung ist unter folgender URL verfügbar:
http://[SERVER_URL]/threejs-blob-engine/

## Dateistruktur

```
src/
├── components/
│   ├── ShimmerBlob.jsx (Custom Shader für den Blob)
│   └── Pedestal.jsx (Das Podest für den Blob)
├── shaders/ (wird bei Bedarf erweitert)
├── utils/ (wird bei Bedarf erweitert)
└── App.jsx (Hauptanwendung)
```

## Benutzerdefinierte Shader

Der Blob verwendet einen benutzerdefinierten Shader mit:

- Perlin Noise für organische Verformung
- Fresnel-Effekt für schimmernde Ränder
- Zeitbasierte Animation für kontinuierliche Bewegung
- Spekular-Reflexionen für zusätzlichen Glanz

## Installation (für lokale Entwicklung)

1. Repository klonen
2. `npm install`
3. `npm run dev` zum Starten der Entwicklungsumgebung
4. `npm run build` zum Erstellen der Produktionsversion

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz.