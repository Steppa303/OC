/**
 * Three.js Blob 3D Animation Component
 * Mobile-friendly with touch controls
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

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x6366f1, 1, 100);
    pointLight1.position.set(10, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xec4899, 1, 100);
    pointLight2.position.set(-10, -10, 10);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x10b981, 1, 100);
    pointLight3.position.set(0, 15, -10);
    scene.add(pointLight3);

    // Create metaballs (blob effect)
    const createBlobMaterial = (color) => {
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.3,
        metalness: 0.7,
        transparent: true,
        opacity: 0.9,
        side: wireframe ? THREE.DoubleSide : THREE.FrontSide
      });
    };

    // Create multiple blobs for metaball effect
    const blobPositions = [
      { x: 5, y: 5, z: 0, color: 0x6366f1, radius: 6 },
      { x: -5, y: -5, z: 0, color: 0xec4899, radius: 6 },
      { x: 0, y: 8, z: 5, color: 0x10b981, radius: 6 },
      { x: -8, y: 0, z: -5, color: 0xf59e0b, radius: 5 },
      { x: 8, y: -3, z: -5, color: 0x8b5cf6, radius: 5 },
      { x: 3, y: -8, z: 5, color: 0x3b82f6, radius: 5 },
    ];

    blobPositions.forEach((pos, i) => {
      const geometry = new THREE.IcosahedronGeometry(pos.radius, 2);
      const material = createBlobMaterial(pos.color);
      const blob = new THREE.Mesh(geometry, material);
      blob.position.set(pos.x, pos.y, pos.z);
      blob.userData = {
        basePosition: new THREE.Vector3(pos.x, pos.y, pos.z),
        baseRadius: pos.radius,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        ),
        rotationSpeed: Math.random() * 0.02 + 0.01
      };
      scene.add(blob);
      blobsRef.current.push(blob);
    });

    // Add wireframe helper sphere
    const wireframeHelper = new THREE.Mesh(
      new THREE.IcosahedronGeometry(20, 2),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.05
      })
    );
    wireframeHelper.visible = wireframe;
    scene.add(wireframeHelper);

    sceneRef.current = scene;
    cameraRef.current = camera;

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      const time = clockRef.current.getElapsedTime();
      
      // Update blobs
      blobsRef.current.forEach(blob => {
        if (autoRotate) {
          blob.rotation.x += blob.userData.rotationSpeed;
          blob.rotation.y += blob.userData.rotationSpeed;
        }
        
        // Move blob
        blob.position.x = blob.userData.basePosition.x + 
          Math.sin(time * 0.5 + blob.userData.basePosition.y) * 3;
        blob.position.y = blob.userData.basePosition.y + 
          Math.cos(time * 0.7 + blob.userData.basePosition.x) * 3;
        blob.position.z = blob.userData.basePosition.z + 
          Math.sin(time * 0.3) * 2;

        // Update wireframe visibility
        if (blob.material.wireframe !== wireframe) {
          blob.material.wireframe = wireframe;
          blob.material.needsUpdate = true;
        }
      });

      // Rotate entire scene slightly
      if (autoRotate) {
        scene.rotation.y = Math.sin(time * 0.05) * 0.2;
        scene.rotation.x = Math.cos(time * 0.03) * 0.1;
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
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
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
      
      rotationRef.current.x += deltaY * 0.01;
      rotationRef.current.y += deltaX * 0.01;
      
      lastMousePosRef.current = { x, y };
      
      // Rotate scene
      sceneRef.current.rotation.y += deltaX * 0.01;
      sceneRef.current.rotation.x += deltaY * 0.01;
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

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    // Reset camera
    const resetCamera = () => {
      scene.rotation.set(0, 0, 0);
      camera.position.set(0, 0, 30);
      camera.lookAt(0, 0, 0);
      rotationRef.current = { x: 0, y: 0 };
    };

    window.resetCamera = resetCamera; // Expose to window for controls

    // Cleanup
    return () => {
      cancelAnimationFrame(animationRef.current);
      clearInterval(progressInterval);
      clearInterval(fpsInterval);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      containerRef.current.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
    };
  }, [autoRotate, wireframe]);

  // Update wireframe when changed
  useEffect(() => {
    if (blobsRef.current.length > 0) {
      blobsRef.current.forEach(blob => {
        blob.material.wireframe = wireframe;
        blob.material.needsUpdate = true;
      });
    }
  }, [wireframe]);

  return (
    <>
      {/* Loading Screen */}
      {isLoading && (
        <div id="loading-screen" style={{ 
          opacity: progress < 100 ? 1 : 0 
        }}>
          <div className="loading-spinner"></div>
          <div className="loading-text">
            {progress < 30 ? 'Initializing Three.js...' : 
             progress < 70 ? 'Loading assets...' : 'Finalizing...'}
          </div>
          <div className="progress-bar" style={{ opacity: progress < 100 ? 1 : 0 }}>
            <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }}></div>
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
    </>
  );
};

export default BlobAnimation;
