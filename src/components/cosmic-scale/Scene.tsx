import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useCosmicStore } from '../../store/useCosmicStore';
import { celestialObjects } from '../../data/cosmicScale';
import { CelestialObject } from './CelestialObject';
import { Suspense, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { preloadNearbyTextures } from '../../utils/textureCache';

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

// Component to fade background to black when viewing Observable Universe
// This creates the effect that there's nothing "outside" the observable universe
function BackgroundFade() {
  const { currentIndex } = useCosmicStore();
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const [targetOpacity, setTargetOpacity] = useState(0);
  const currentOpacity = useRef(0);

  // Check if current object is Observable Universe
  useEffect(() => {
    const isObservableUniverse = celestialObjects[currentIndex]?.id === 'observable-universe';
    setTargetOpacity(isObservableUniverse ? 1 : 0);
  }, [currentIndex]);

  // Smoothly animate opacity
  useFrame((_, delta) => {
    if (materialRef.current) {
      const speed = 0.12; // Animation speed (lower = slower, more dramatic cinematic fade)
      const diff = targetOpacity - currentOpacity.current;

      if (Math.abs(diff) > 0.001) {
        currentOpacity.current += diff * speed * delta * 60; // 60fps normalized
        currentOpacity.current = Math.max(0, Math.min(1, currentOpacity.current));
        materialRef.current.opacity = currentOpacity.current;
      }
    }
  });

  return (
    <mesh>
      {/* Large sphere that surrounds everything - renders on inside (BackSide) */}
      <sphereGeometry args={[100, 32, 32]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#000000"
        side={THREE.BackSide}
        transparent={true}
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}

// Component to reset camera when entering Observable Universe
function CameraController({ isObservableUniverse }: { isObservableUniverse: boolean }) {
  const { camera } = useThree();
  const prevIsObservableUniverse = useRef(false);

  useEffect(() => {
    // Only reset when transitioning TO Observable Universe (not when leaving)
    if (isObservableUniverse && !prevIsObservableUniverse.current) {
      // Reset camera to default position
      camera.position.set(0, 2, 8);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
    prevIsObservableUniverse.current = isObservableUniverse;
  }, [isObservableUniverse, camera]);

  return null;
}

export function Scene() {
  const { visibleObjects, currentIndex } = useCosmicStore();

  // Preload textures for nearby objects when currentIndex changes
  useEffect(() => {
    // Preload current + next 4 + previous 2 objects
    preloadNearbyTextures(currentIndex, 4);
  }, [currentIndex]);

  // Initial preload on mount - load more objects for smoother start
  useEffect(() => {
    preloadNearbyTextures(currentIndex, 6);
  }, []);

  // Disable camera controls when viewing Observable Universe
  const isObservableUniverse = celestialObjects[currentIndex]?.id === 'observable-universe';

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 2, 8], fov: 50 }}
      >
        {/* Cubemap Skybox */}
        <Suspense fallback={null}>
          <Skybox />
        </Suspense>

        {/* Background fade overlay - fades to black for Observable Universe */}
        <BackgroundFade />

        {/* Camera controller - resets camera when entering Observable Universe */}
        <CameraController isObservableUniverse={isObservableUniverse} />

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

        {/* Camera controls - disabled at Observable Universe */}
        <OrbitControls
          enabled={!isObservableUniverse}
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
