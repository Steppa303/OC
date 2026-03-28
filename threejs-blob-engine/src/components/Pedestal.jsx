import React from 'react';
import * as THREE from 'three';

function Pedestal({ position }) {
  return (
    <mesh 
      position={position} 
      castShadow 
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <cylinderGeometry args={[1.2, 1.2, 0.2, 32]} />
      <meshStandardMaterial 
        color="#FFFFFF" 
        metalness={0.1}
        roughness={0.2}
      />
    </mesh>
  );
}

export default Pedestal;