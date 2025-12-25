import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useCosmicStore } from '../store/useCosmicStore';
import { celestialObjects } from '../data/objects';
import { CelestialObject } from './CelestialObject';
import { Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';

// Component to load and set the cubemap skybox
function Skybox() {
  const { scene } = useThree();
  const [cubeTexture, setCubeTexture] = useState<THREE.CubeTexture | null>(null);

  useEffect(() => {
    const loader = new THREE.CubeTextureLoader();
    loader.setPath('/textures/spacebg/');

    loader.load(
      ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'],
      (texture) => {
        console.log('Cubemap loaded successfully');
        setCubeTexture(texture);
      },
      undefined,
      (error) => {
        console.error('Failed to load cubemap:', error);
      }
    );

    return () => {
      if (cubeTexture) {
        cubeTexture.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (cubeTexture) {
      scene.background = cubeTexture;
    }

    return () => {
      scene.background = null;
    };
  }, [cubeTexture, scene]);

  return null;
}

export function Scene() {
  const { visibleObjects, currentIndex } = useCosmicStore();

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 2, 8], fov: 50 }}
      >
        {/* Cubemap Skybox */}
        <Suspense fallback={null}>
          <Skybox />
        </Suspense>

        {/* Lighting - increased ambient for better visibility */}
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        {/* Render all visible celestial objects */}
        <Suspense fallback={null}>
          {visibleObjects.map((visibleObj) => {
            const object = celestialObjects[visibleObj.index];
            return (
              <CelestialObject
                key={visibleObj.id}
                object={object}
                scale={visibleObj.scale}
                positionX={visibleObj.positionX}
                positionY={visibleObj.positionY}
                isCurrent={visibleObj.index === currentIndex}
                entryFromRight={visibleObj.entryFromRight}
              />
            );
          })}
        </Suspense>

        {/* Camera controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          minDistance={3}
          maxDistance={20}
          target={[0, 0, 0]}
        />

      </Canvas>
    </div>
  );
}
