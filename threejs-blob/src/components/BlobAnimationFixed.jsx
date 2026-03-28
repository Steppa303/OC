/**
 * Fixed Three.js Blob 3D Animation Component
 * Mobile-friendly with touch controls
 * FIXED: C4.clone is not a function error
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { 
  RotateCcw, 
  Rotate3d, 
  Grid3X3, 
  Cpu 
} from 'lucide-react';
import FPSCounter from './FPSCounter';

// Helper function for smooth blob movement
const getBlobPosition = (time, index, baseRadius) => {
  const offset = index * Math.PI * 0.5;
  return new THREE.Vector3(
    Math.sin(time * 0.7 + offset) * baseRadius * 0.6,
    Math.cos(time * 0.5 + offset) * baseRadius * 0.6,
    Math.sin(time * 0.9 + offset) * baseRadius * 0.4
  );
};

const BlobAnimation = () => {
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [fps, setFps] = useState(60);

  // Simulation refs (avoid re-renders)
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const blobRef = useRef(null);
  const blobsRef = useRef([]);
  const pedestalRef = useRef(null);
  const animationRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const rotationRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    // Progress simulation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => setIsLoading(false), 300);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f11);
    scene.fog = new THREE.FogExp2(0x0f0f11, 0.02);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 30);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance",
      alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    // Add pedestal/base
    const pedestalGeometry = new THREE.CylinderGeometry(12, 12, 2, 32);
    const pedestalMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.1
    });
    const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
    pedestal.position.y = -12;
    pedestal.receiveShadow = true;
    scene.add(pedestal);
    pedestalRef.current = pedestal;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0x6366f1, 1, 100);
    pointLight1.position.set(10, 10, 10);
    pointLight1.castShadow = true;
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xec4899, 1, 100);
    pointLight2.position.set(-10, -10, 10);
    pointLight2.castShadow = true;
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x10b981, 1, 100);
    pointLight3.position.set(0, 15, -10);
    pointLight3.castShadow = true;
    scene.add(pointLight3);

    // Create shader material for blob with animated displacement
    const blobShaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x6366f1) },
        lightPosition: { value: new THREE.Vector3(10, 10, 10) }
      },
      vertexShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          
          // Animated displacement for blob effect
          vec3 displacedPosition = position;
          displacedPosition.x += sin(position.y * 2.0 + time) * 0.5;
          displacedPosition.y += cos(position.x * 2.0 + time) * 0.5;
          displacedPosition.z += sin(position.z * 2.0 + time * 1.5) * 0.5;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // Fresnel-like effect
          float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          vec3 baseColor = color.rgb;
          vec3 rimColor = mix(vec3(1.0), baseColor, 0.5);
          vec3 finalColor = mix(baseColor, rimColor, fresnel * 0.8);
          
          gl_FragColor = vec4(finalColor, 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    // Create main blob mesh with shader material
    const blobGeometry = new THREE.IcosahedronGeometry(8, 64); // High detail for smooth animation
    const blob = new THREE.Mesh(blobGeometry, blobShaderMaterial);
    blob.castShadow = true;
    scene.add(blob);
    blobRef.current = blob;

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      const time = clockRef.current.getElapsedTime();
      
      // Update shader time uniform
      if (blobRef.current && blobRef.current.material) {
        blobRef.current.material.uniforms.time.value = time;
        blobRef.current.material.uniformsNeedUpdate = true;
      }
      
      // Rotate blob
      if (autoRotate) {
        if (blobRef.current) {
          blobRef.current.rotation.x = Math.sin(time * 0.2) * 0.3;
          blobRef.current.rotation.y = time * 0.5;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // FPS counter
    let frames = 0;
    const fpsInterval = setInterval(() => {
      setFps(frames);
      frames = 0;
    }, 1000);

    // Handle resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Touch/Mouse events for camera control
    const handleStart = (x, y) => {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x, y };
    };

    const handleMove = (x, y) => {
      if (!isDraggingRef.current) return;
      
      const deltaX = x - lastMousePosRef.current.x;
      const deltaY = y - lastMousePosRef.current.y;
      
      if (sceneRef.current) {
        sceneRef.current.rotation.y += deltaX * 0.01;
        sceneRef.current.rotation.x += deltaY * 0.01;
      }
      
      lastMousePosRef.current = { x, y };
    };

    const handleEnd = () => {
      isDraggingRef.current = false;
    };

    const handleMouseDown = (e) => handleStart(e.clientX, e.clientY);
    const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const handleMouseUp = handleEnd;
    
    const handleTouchStart = (e) => {
      e.preventDefault();
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchEnd = handleEnd;

    const domElement = rendererRef.current.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    // Reset camera function
    const resetCamera = () => {
      if (sceneRef.current && cameraRef.current) {
        sceneRef.current.rotation.set(0, 0, 0);
        cameraRef.current.position.set(0, 0, 30);
        cameraRef.current.lookAt(0, 0, 0);
      }
    };

    window.resetCamera = resetCamera; // Expose to window for controls

    // Cleanup function
    return () => {
      // Cancel animation frame
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      // Clear intervals
      clearInterval(progressInterval);
      clearInterval(fpsInterval);
      
      // Remove event listeners
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      
      // Dispose of geometries and materials properly
      if (blobRef.current) {
        if (blobRef.current.geometry) {
          blobRef.current.geometry.dispose();
        }
        if (blobRef.current.material) {
          if (Array.isArray(blobRef.current.material)) {
            blobRef.current.material.forEach(material => {
              Object.values(material.uniforms || {}).forEach(uniform => {
                if (uniform.value && typeof uniform.value.dispose === 'function') {
                  uniform.value.dispose();
                }
              });
              if (material.map) material.map.dispose();
              if (material.lightMap) material.lightMap.dispose();
              if (material.bumpMap) material.bumpMap.dispose();
              if (material.normalMap) material.normalMap.dispose();
              if (material.displacementMap) material.displacementMap.dispose();
              if (material.roughnessMap) material.roughnessMap.dispose();
              if (material.metalnessMap) material.metalnessMap.dispose();
              if (material.alphaMap) material.alphaMap.dispose();
              if (material.envMap) material.envMap.dispose();
            });
          } else {
            Object.values(blobRef.current.material.uniforms || {}).forEach(uniform => {
              if (uniform.value && typeof uniform.value.dispose === 'function') {
                uniform.value.dispose();
              }
            });
            if (blobRef.current.material.map) blobRef.current.material.map.dispose();
            if (blobRef.current.material.lightMap) blobRef.current.material.lightMap.dispose();
            if (blobRef.current.material.bumpMap) blobRef.current.material.bumpMap.dispose();
            if (blobRef.current.material.normalMap) blobRef.current.material.normalMap.dispose();
            if (blobRef.current.material.displacementMap) blobRef.current.material.displacementMap.dispose();
            if (blobRef.current.material.roughnessMap) blobRef.current.material.roughnessMap.dispose();
            if (blobRef.current.material.metalnessMap) blobRef.current.material.metalnessMap.dispose();
            if (blobRef.current.material.alphaMap) blobRef.current.material.alphaMap.dispose();
            if (blobRef.current.material.envMap) blobRef.current.material.envMap.dispose();
          }
        }
      }
      
      if (pedestalRef.current) {
        if (pedestalRef.current.geometry) {
          pedestalRef.current.geometry.dispose();
        }
        if (pedestalRef.current.material) {
          if (pedestalRef.current.material.map) pedestalRef.current.material.map.dispose();
          if (pedestalRef.current.material.lightMap) pedestalRef.current.material.lightMap.dispose();
          if (pedestalRef.current.material.bumpMap) pedestalRef.current.material.bumpMap.dispose();
          if (pedestalRef.current.material.normalMap) pedestalRef.current.material.normalMap.dispose();
          if (pedestalRef.current.material.displacementMap) pedestalRef.current.material.displacementMap.dispose();
          if (pedestalRef.current.material.roughnessMap) pedestalRef.current.material.roughnessMap.dispose();
          if (pedestalRef.current.material.metalnessMap) pedestalRef.current.material.metalnessMap.dispose();
          if (pedestalRef.current.material.alphaMap) pedestalRef.current.material.alphaMap.dispose();
          if (pedestalRef.current.material.envMap) pedestalRef.current.material.envMap.dispose();
        }
      }

      // Remove from DOM
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }

      // Delete references
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      blobRef.current = null;
      pedestalRef.current = null;
      blobsRef.current = [];
    };
  }, [autoRotate, wireframe]);

  // Update wireframe when changed
  useEffect(() => {
    if (blobRef.current && blobRef.current.material) {
      if (blobRef.current.material.uniforms) {
        blobRef.current.material.wireframe = wireframe;
        blobRef.current.material.needsUpdate = true;
      }
    }
  }, [wireframe]);

  return (
    <>
      {/* Loading Screen */}
      {isLoading && (
        <div id="loading-screen" style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: '#0f0f11',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          opacity: progress < 100 ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease'
        }}>
          <div className="loading-spinner" style={{
            width: 50,
            height: 50,
            border: '3px solid rgba(255,255,255,0.1)',
            borderTop: '3px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div className="loading-text" style={{
            marginTop: 20,
            color: '#ffffff',
            fontSize: 16,
            fontFamily: 'monospace'
          }}>
            {progress < 30 ? 'Initializing Three.js...' : 
             progress < 70 ? 'Loading assets...' : 'Finalizing...'}
          </div>
          <div className="progress-bar" style={{
            width: '200px',
            height: 4,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 2,
            marginTop: 15,
            overflow: 'hidden'
          }}>
            <div className="progress-fill" style={{
              height: '100%',
              width: `${Math.min(progress, 100)}%`,
              background: 'linear-gradient(90deg, #6366f1, #ec4899)',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
        </div>
      )}

      {/* FPS Counter */}
      <FPSCounter fps={fps} />

      {/* Container */}
      <div ref={containerRef} style={{ 
        width: '100vw',
        height: '100vh',
        overflow: 'hidden'
      }} />

      {/* Mobile Overlay Controls */}
      <div className="mobile-controls" style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 15,
        padding: '15px 20px',
        background: 'rgba(15, 15, 17, 0.85)',
        backdropFilter: 'blur(10px)',
        borderRadius: 30,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 100
      }}>
        {/* Auto Rotate Toggle */}
        <button 
          onClick={() => setAutoRotate(!autoRotate)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 50,
            height: 50,
            borderRadius: 25,
            background: autoRotate 
              ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          aria-label={autoRotate ? "Auto-rotate aus" : "Auto-rotate an"}
        >
          <Rotate3d 
            size={24} 
            color={autoRotate ? '#fff' : '#9ca3af'} 
            fill={autoRotate ? '#fff' : 'none'}
          />
        </button>

        {/* Wireframe Toggle */}
        <button 
          onClick={() => setWireframe(!wireframe)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 50,
            height: 50,
            borderRadius: 25,
            background: wireframe 
              ? 'linear-gradient(135deg, #ec4899, #db2777)'
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          aria-label={wireframe ? "Wireframe aus" : "Wireframe an"}
        >
          <Grid3X3 
            size={24} 
            color={wireframe ? '#fff' : '#9ca3af'} 
            fill={wireframe ? '#fff' : 'none'}
          />
        </button>

        {/* Reset Camera */}
        <button 
          onClick={() => {
            if (window.resetCamera) {
              window.resetCamera();
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 50,
            height: 50,
            borderRadius: 25,
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          aria-label="Kamera zurücksetzen"
        >
          <RotateCcw 
            size={24} 
            color="#ffffff" 
          />
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default BlobAnimation;