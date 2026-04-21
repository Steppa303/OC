// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class ModernScene3D {
    constructor(container) {
        this.container = container || document.body;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.environment = null; // Platzhalter für spätere HDRI
        
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();
        this.setupLights();
        this.setupObjects();
        this.setupEvents();
        
        this.clock = new THREE.Clock();
        this.animate();
    }
    
    setupCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 2, 5);
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance' // Mobile Optimierung
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // State of the Art Rendering
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        this.container.appendChild(this.renderer.domElement);
    }
    
    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 25;
        
        // Mobile Optimierung
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            this.controls.enablePan = false;
            this.controls.rotateSpeed = 0.7;
            this.controls.zoomSpeed = 0.8;
        }
    }
    
    setupLights() {
        // Ambient Light
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.25);
        this.scene.add(this.ambientLight);
        
        // Directional Light mit High-Quality Shadows
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.directionalLight.position.set(5, 10, 7);
        this.directionalLight.castShadow = true;
        
        // Shadow Map Settings
        this.directionalLight.shadow.mapSize.width = 4096;
        this.directionalLight.shadow.mapSize.height = 4096;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 50;
        this.directionalLight.shadow.camera.left = -15;
        this.directionalLight.shadow.camera.right = 15;
        this.directionalLight.shadow.camera.top = 15;
        this.directionalLight.shadow.camera.bottom = -15;
        this.directionalLight.shadow.radius = 2;
        this.directionalLight.shadow.bias = -0.0001;
        
        this.scene.add(this.directionalLight);
        
        // Point Lights für dynamische Beleuchtung
        const colors = [0xff4444, 0x44ff44, 0x4444ff];
        for (let i = 0; i < 3; i++) {
            const light = new THREE.PointLight(colors[i], 0.8, 30);
            light.position.set(
                Math.cos(i * Math.PI * 2 / 3) * 4,
                3 + Math.sin(Date.now()) * 0.5,
                Math.sin(i * Math.PI * 2 / 3) * 4
            );
            light.castShadow = true;
            light.shadow.mapSize.width = 1024;
            light.shadow.mapSize.height = 1024;
            this.scene.add(light);
            this.pointLights = this.pointLights || [];
            this.pointLights.push(light);
        }
    }
    
    setupObjects() {
        // Pedestal
        const pedestalGeometry = new THREE.CylinderGeometry(1.8, 1.8, 0.8, 64);
        const pedestalMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x000022,
            emissiveIntensity: 0.05
        });
        
        this.pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
        this.pedestal.position.y = -1.2;
        this.pedestal.receiveShadow = true;
        this.scene.add(this.pedestal);
        
        // Blob Placeholder
        const blobGeometry = new THREE.SphereGeometry(1.2, 128, 128);
        const blobMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            metalness: 0.95,
            roughness: 0.05,
            emissive: 0x000000,
            side: THREE.DoubleSide
        });
        
        this.blob = new THREE.Mesh(blobGeometry, blobMaterial);
        this.blob.position.y = -0.6;
        this.blob.castShadow = true;
        this.blob.receiveShadow = true;
        this.scene.add(this.blob);
        
        // Optional Animation
        this.autoRotate = true;
    }
    
    setupEvents() {
        window.addEventListener('resize', () => this.onResize());
        
        // Performance für mobile optimieren
        if ('ontouchstart' in window) {
            this.renderer.domElement.style.touchAction = 'none';
        }
    }
    
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();
        
        // Controls Update
        this.controls.update();
        
        // Blob Animation
        if (this.blob && this.autoRotate) {
            this.blob.rotation.x = Math.sin(elapsed * 0.2) * 0.1;
            this.blob.rotation.y = elapsed * 0.3;
            this.blob.rotation.z = Math.cos(elapsed * 0.15) * 0.05;
        }
        
        // Pulsierende Point Lights
        if (this.pointLights) {
            this.pointLights.forEach((light, index) => {
                light.intensity = 0.6 + Math.sin(elapsed * 2 + index) * 0.4;
                light.position.y = 3 + Math.sin(elapsed * 1.5 + index) * 0.8;
            });
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    new ModernScene3D(document.body);
});