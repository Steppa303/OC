import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

function Blob() {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      // Langsame Rotation
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
      
      // Sanfte pulsierende Skalierung
      const scale = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.03;
      meshRef.current.scale.setScalar(scale);
    }
  });
  
  return (
    <mesh ref={meshRef} position={[0, 0.5, 0]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 64]} />
      {/* Dunkelgrauer schimmernder Blob mit reflexionen */}
      <meshPhysicalMaterial 
        color="#1a1a1a" 
        metalness={1.0}
        roughness={0.1}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        reflectivity={1.0}
        ior={1.5}
      />
    </mesh>
  );
}

function Pedestal() {
  return (
    <mesh 
      position={[0, -1.5, 0]} 
      castShadow 
      receiveShadow
    >
      <cylinderGeometry args={[1.8, 1.8, 0.4, 64]} />
      <meshStandardMaterial 
        color="#FFFFFF" 
        metalness={0.1}
        roughness={0.2}
      />
    </mesh>
  );
}

function Floor() {
  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -1.7, 0]}
      receiveShadow
    >
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial 
        color="#FFFFFF" 
        metalness={0.0}
        roughness={0.1}
      />
    </mesh>
  );
}

function StudioLights() {
  return (
    <>
      {/* HELLERS AMBIENT LIGHT - ganzen Raum ausleuchten */}
      <ambientLight intensity={1.2} color="#ffffff" />
      
      {/* Key Light - Hauptlicht von vorne oben */}
      <directionalLight 
        position={[5, 8, 5]} 
        intensity={4} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0001}
      />
      
      {/* Fill Light - Aufhelllicht von der Seite */}
      <directionalLight 
        position={[-5, 5, 3]} 
        intensity={2.5} 
        color="#ffffff"
      />
      
      {/* Rim Light - Kantenlicht von hinten */}
      <directionalLight 
        position={[0, 3, -8]} 
        intensity={2} 
        color="#aaccff"
      />
      
      {/* Top Light - Deckenlicht */}
      <pointLight 
        position={[0, 10, 0]} 
        intensity={2} 
        color="#ffffff"
      />
      
      {/* Back Light - Für Tiefe */}
      <pointLight 
        position={[0, 2, -8]} 
        intensity={1.5} 
        color="#ffffff"
      />
    </>
  );
}

function StudioBackplane() {
  return (
    <mesh position={[0, 0.5, -5]} receiveShadow>
      <planeGeometry args={[15, 10]} />
      <meshStandardMaterial 
        color="#f5f5f5" 
        metalness={0.0}
        roughness={0.8}
      />
    </mesh>
  );
}

function StudioFloor() {
  return (
    <mesh position={[0, -0.1, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial 
        color="#e8e8e8" 
        metalness={0.0}
        roughness={0.5}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      {/* Weiße Studio Hintergrundwand */}
      <StudioBackplane />
      
      {/* Weiße Studio Bodenplatte */}
      <StudioFloor />
      
      {/* STATE OF THE ART: HDRI Environment Map */}
      <Environment 
        preset="studio" 
        blur={0.8}
        background={false}
        ground={{ height: 10, radius: 10, scale: 0 }}
      />
      
      {/* Studio Beleuchtung */}
      <StudioLights />
      
      {/* Objekte */}
      <Blob />
      <Pedestal />
      <Floor />
      
      {/* Realistische Shadows */}
      <ContactShadows 
        position={[0, -1.48, 0]} 
        opacity={0.4} 
        scale={10} 
        blur={2} 
        far={4}
        resolution={512}
        color="#000000"
      />
      
      {/* Controls */}
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={10}
        autoRotate={true}
        autoRotateSpeed={0.3}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        makeDefault
      />
    </>
  );
}

export default function App() {
  return (
    <div className="w-full h-screen bg-gradient-to-b from-white via-gray-100 to-gray-200">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          physicallyCorrectLights: true,
        }}
      >
        <PerspectiveCamera 
          makeDefault 
          position={[0, 0, 8]} 
          fov={45}
        />
        <Scene />
      </Canvas>
      
      {/* Info Overlay */}
      <div className="absolute bottom-4 left-4 text-gray-800 text-sm bg-white/80 p-3 rounded-lg backdrop-blur-sm shadow-lg">
        <p className="font-bold">🖤 Three.js Blob Engine</p>
        <p className="text-xs mt-1">🖱️ Links: Rotieren | Rechts: Schwenken | Rad: Zoom</p>
      </div>
      
      {/* Titel Overlay */}
      <div className="absolute top-4 left-4 text-gray-800 text-lg font-bold bg-white/80 p-2 rounded-lg backdrop-blur-sm shadow-lg">
        Schwarzer schimmernder Blob
      </div>
      
      {/* Tech Badge */}
      <div className="absolute top-4 right-4 text-gray-600 text-xs bg-white/80 p-2 rounded-lg backdrop-blur-sm shadow-lg">
        <p>HDRI Environment</p>
        <p>Studio Lighting</p>
        <p>PBR Materials</p>
      </div>
    </div>
  );
}
