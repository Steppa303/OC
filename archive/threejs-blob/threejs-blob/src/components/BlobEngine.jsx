/**
 * Three.js Blob 3D Animation Component - Fixed Version
 * Fixed: Black screen issue by simplifying materials and lighting
 * Features: 
 * - Simple meshStandardMaterial instead of complex shaders
 * - Proper lighting setup to ensure visibility
 * - Scene with blob and pedestal
 * - Animation with useFrame pattern
 * - Orbit controls
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BlobEngine = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const blobRef = useRef(null);
  const controlsRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 15);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Pedestal/base
    const pedestalGeometry = new THREE.CylinderGeometry(6, 6, 1, 32);
    const pedestalMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.1
    });
    const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
    pedestal.position.y = -4;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    // Blob with simple standard material (instead of complex shader)
    const blobGeometry = new THREE.IcosahedronGeometry(3, 64);
    const blobMaterial = new THREE.MeshStandardMaterial({ 
      color: "#000000", 
      metalness: 0.9,
      roughness: 0.1,
      envMapIntensity: 1.0
    });

    const blob = new THREE.Mesh(blobGeometry, blobMaterial);
    blob.castShadow = true;
    blob.position.y = 0;
    scene.add(blob);
    blobRef.current = blob;

    // Proper lighting setup to ensure visibility
    // Ambient light (soft overall illumination)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Directional light (main light source)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Point light for accents
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(-5, 5, 5);
    scene.add(pointLight);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Animation loop with proper blob animation
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      const time = performance.now() * 0.001;
      
      // Simple blob animation: scale and rotation
      if (blobRef.current) {
        blobRef.current.scale.setScalar(1 + Math.sin(time) * 0.1);
        blobRef.current.rotation.y = time * 0.5;
      }
      
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      window.removeEventListener('resize', handleResize);
      
      // Dispose resources
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (blobRef.current) {
        if (blobRef.current.geometry) blobRef.current.geometry.dispose();
        if (blobRef.current.material) {
          if (Array.isArray(blobRef.current.material)) {
            blobRef.current.material.forEach(mat => mat.dispose());
          } else {
            blobRef.current.material.dispose();
          }
        }
      }
      
      if (pedestal.geometry) pedestal.geometry.dispose();
      if (pedestal.material) pedestal.material.dispose();
      
      if (controlsRef.current) controlsRef.current.dispose();
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
};

export default BlobEngine;