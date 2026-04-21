/**
 * Rotierender Schwarzer Blob Shader
 * mit Simplex-Noise, Vertex-Displacement undDepth-based Shading
 */

// ============================================================
// UNIFORMS & CONFIG
// ============================================================

const uniforms = {
  uTime: { value: 0 },
  uAmplitude: { value: 0.3 },      // Stärke der Vertex-Displacement
  uFrequency: { value: 5.0 },      // Noise-Frequenz
  uSpeed: { value: 1.0 },          // Animationsgeschwindigkeit
  uRotationSpeed: { value: 0.3 },  // Rotationsgeschwindigkeit
  uBaseColor: { value: new THREE.Color(0x000000) },
  uSpecularColor: { value: new THREE.Color(0x666666) },
  uSpecularStrength: { value: 0.4 },
  uEmissiveColor: { value: new THREE.Color(0x0000ff) },  // Blaues Leuchten für Podest
  uEmissiveStrength: { value: 0.3 },
  uEdgeWidth: { value: 0.1 },      // Breite der leuchtenden Kanten
};

// ============================================================
// SIMPLEX NOISE IMPLEMENTATION
// ============================================================

const simplexNoiseGLSL = `
// Pseudo-random hash function
float hash(float n) {
    return fract(sin(n) * 43758.5453);
}

// 3D Simplex Noise
vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec3 v) {
    const C = vec3(1.0 / 6.0, 1.0 / 3.0, 0.5);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - C.zzz;
    i = mod(i, 289.0);
    vec3 p = permute(permute(permute(
            i.z + vec3(0.0, i1.z, i2.z)) + i.y + vec3(0.0, i1.y, i2.y)) + i.x + vec3(0.0, i1.x, i2.x));
    float n_ = 0.142857142857;
    vec3  ns = n_ * vec3(0.0, 0.5, 1.0);
    vec3 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec3 x2_ = mod(j, 7.0) * ns.x + 3.0 * ns.x - 1.0;
    vec3 y2_ = floor(j * ns.x) * ns.x + 3.0 * ns.x - 1.0;
    vec3 h2_ = 1.0 - abs(x2_) - abs(y2_);
    vec3 b0 = vec3(x2_.x, y2_.x, h2_.x);
    vec3 b1 = vec3(x2_.y, y2_.y, h2_.y);
    vec3 b2 = vec3(x2_.z, y2_.z, h2_.z);
    vec3 atten = max(vec3(0.0), 0.6 - vec3(dot(b0, b0), dot(b1, b1), dot(b2, b2)));
    vec3 pat = vec3(b0.x, b1.x, b2.x) * atten.xxx + vec3(b0.y, b1.y, b2.y) * atten.yyy + vec3(b0.z, b1.z, b2.z) * atten.zzz;
    vec3 g2 = vec3(6.0) * pat * vec3(0.0, 0.5, 1.0) - vec3(2.0);
    vec3 w2 = 1.9 - 2.0 * dot(g2, g2);
    vec3 w = min(w2, atten);
    return dot(w, vec3(dot(b0, g2), dot(b1, g2), dot(b2, g2)));
}
`;

// ============================================================
// VERTEX SHADER
// ============================================================

const vertexShader = `
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uRotationSpeed;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vNoise;

${simplexNoiseGLSL}

void main() {
    // --- 1. Base Sphere Position ---
    vec3 pos = position;
    
    // --- 2. Noise Animation für organische Bewegung ---
    vec3 noisePos = pos * uFrequency;
    float time = uTime * uRotationSpeed;
    
    // Multi-Scale Noise für detailreichere Form
    float noise1 = snoise(noisePos + vec3(time * 0.5));
    float noise2 = snoise(noisePos * 2.0 + vec3(time * 0.3));
    float noise3 = snoise(noisePos * 4.0 + vec3(time * 0.7));
    
    // Gewichtete Summe für organische Bewegung
    vNoise = noise1 * 0.6 + noise2 * 0.3 + noise3 * 0.1;
    
    // --- 3. Vertex Displacement ---
    pos += normalize(pos) * vNoise * uAmplitude;
    
    // --- 4. Rotation um Y-Achse ---
    float angle = time * 0.5;
    mat2 rotationMatrix = mat2(
        cos(angle), -sin(angle),
        sin(angle), cos(angle)
    );
    
    pos.xz *= rotationMatrix; // Rotation um Y-Achse
    
    // Kleine Z-Schwingung für "Schweben"-Effekt
    pos.y += sin(time * 1.5) * 0.1;
    
    // --- 5. Standard Transformationen ---
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vec4 clipping = projectionMatrix * mvPosition;
    
    gl_Position = clipping;
    
    // --- 6. Varyings für Fragment Shader ---
    vPosition = pos;
    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
}
`;

// ============================================================
// FRAGMENT SHADER
// ============================================================

const fragmentShader = `
uniform vec3 uBaseColor;
uniform vec3 uSpecularColor;
uniform float uSpecularStrength;
uniform vec3 uEmissiveColor;
uniform float uEmissiveStrength;
uniform float uEdgeWidth;
uniform float uAmplitude;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vNoise;

void main() {
    // --- 1. Base Color (Schwarz) ---
    vec3 color = uBaseColor;
    
    // --- 2. Noise-basierter Farbverlauf für organischen Effekt ---
    // Hellere Bereiche bei hohem Noise
    float noiseFactor = smoothstep(-0.3, 0.5, vNoise);
    vec3 noiseTint = mix(uBaseColor * 0.8, vec3(0.1), noiseFactor);
    color = mix(color, noiseTint, 0.3);
    
    // --- 3. Normalen Normalisierung (wichtig nach Vertex-Displacement) ---
    vec3 normal = normalize(vNormal);
    
    // --- 4. Lichtquellen ---
    vec3 lightDir = normalize(vec3(1.0, 2.0, 3.0)); // Main light
    vec3 lightDir2 = normalize(vec3(-1.0, 0.5, 1.0)); // Rim light
    
    // --- 5. Ambient Occlusion basierend auf Noise ---
    float ambient = 0.3 + 0.2 * vNoise;
    
    // --- 6. Diffuse Beleuchtung (Lambert) ---
    float diff = max(dot(normal, lightDir), 0.0);
    
    // --- 7. Specular Beleuchtung (Phong) ---
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(reflectDir, viewDir), 0.0), 32.0);
    
    //stärke basierend auf Noise (höhere Reflexion bei "hohen" Bereichen)
    float specMask = smoothstep(0.0, 0.6, vNoise);
    spec = spec * (uSpecularStrength + 0.5 * specMask);
    
    // --- 8. Rim Light (Kantenbeleuchtung für 3D-Effekt) ---
    float rim = 1.0 - max(dot(normal, viewDir), 0.0);
    rim = pow(rim, 3.0);
    vec3 rimColor = uSpecularColor * rim * 0.8;
    
    // --- 9. Depth-based Shading (dunklere Bereiche weiter im Hintergrund) ---
    // Approximation durch Position in View Space
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float depthShading = smoothstep(5.0, 15.0, depth);
    
    // --- 10. Emissive für Podest-Kante (wenn am unteren Rand) ---
    float edgeIntensity = smoothstep(-0.3, 0.0, vPosition.y);
    vec3 emissive = uEmissiveColor * uEmissiveStrength * edgeIntensity;
    
    // --- 11. Farbmixing ---
    vec3 finalColor = color;
    
    // Diffuse Beleuchtung
    finalColor += color * diff * 0.8;
    
    // Specular Highlight
    finalColor += uSpecularColor * spec;
    
    // Rim Light
    finalColor += rimColor;
    
    // Depth Shading (3D-Tiefe)
    finalColor = mix(finalColor, finalColor * 0.6, depthShading * 0.5);
    
    // Emissive Kanten
    finalColor += emissive;
    
    // Ambient
    finalColor += color * ambient;
    
    // --- 12. Post-processing_effekt: Kontrast erhöhen ---
    finalColor = normalize(finalColor) * clamp(length(finalColor), 0.0, 1.0);
    
    // --- 13. Ausgabe ---
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ============================================================
// THREE.JS BLOB KLASSE
// ============================================================

class BlobMesh extends THREE.Mesh {
    constructor(radius = 1, segments = 64) {
        const geometry = new THREE.SphereGeometry(radius, segments, segments);
        const material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(uniforms),
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.DoubleSide,
            roughness: 0.2,
            metalness: 0.1
        });
        
        super(geometry, material);
        
        this.animationId = null;
        this.isPlaying = false;
    }
    
    play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            // Uniforms updaten
            this.material.uniforms.uTime.value += 0.016; // ~60fps
            
            // Kleiner "Schwebe"-Offset für den gesamten Blob
            this.position.y = 1.5 + Math.sin(this.material.uniforms.uTime.value * 0.5) * 0.3;
        };
        
        animate();
    }
    
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.isPlaying = false;
    }
    
    // Utility Methoden für Animations-Steuerung
    setSpeed(speed) {
        this.material.uniforms.uRotationSpeed.value = speed;
    }
    
    setAmplitude(amount) {
        this.material.uniforms.uAmplitude.value = amount;
    }
}

// ============================================================
// PODEST (BASE) KLASSE
// ============================================================

class PodestMesh extends THREE.Mesh {
    constructor(radius = 1.5, height = 0.3) {
        const geometry = new THREE.CylinderGeometry(radius * 0.6, radius, height, 64);
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.4,
            metalness: 0.8,
            emissive: new THREE.Color(0x0000ff),
            emissiveIntensity: 0.3,
            emissiveMap: null
        });
        
        super(geometry, material);
        
        // Leuchtende Kanten mit EdgeHelper
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 })
        );
        line.position.y = height / 2;
        this.add(line);
        
        // Unterer Rand Leuchten (durch emissive Map simuliert)
        this.position.y = height / 2;
    }
}

// ============================================================
// TOTALER BLOB SCENE SETUP
// ============================================================

function createBlobScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    
    // Kamera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    
    // Lichter
    const ambientLight = new THREE.AmbientLight(0x404040, 1); // Sanftes Umgebungslicht
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 5, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);
    
    const pointLight = new THREE.PointLight(0x0000ff, 2, 10);
    pointLight.position.set(0, 2, 0);
    scene.add(pointLight);
    
    // Podest erstellen
    const podest = new PodestMesh(1.2, 0.25);
    scene.add(podest);
    
    // Blob erstellen
    const blob = new BlobMesh(0.8, 64);
    blob.position.y = 1.2; // Schwebt über Podest
    scene.add(blob);
    
    // Animation starten
    blob.play();
    
    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Rotation laufen lassen
    const render = () => {
        requestAnimationFrame(render);
        renderer.render(scene, camera);
    };
    
    render();
    
    return { scene, camera, renderer, blob, podest };
}

// ============================================================
// EXPORTS (für Import in andere Projekte)
// ============================================================

// Export falls ES6 Module genutzt werden sollen
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BlobMesh,
        PodestMesh,
        createBlobScene,
        vertexShader,
        fragmentShader,
        uniforms,
        simplexNoiseGLSL
    };
}
