import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useExoplanetStore } from '../../store/useExoplanetStore';
import { exoplanets } from '../../data/extremeExoplanets';
import { ExoplanetObject } from './ExoplanetObject';
import { Suspense, useEffect, useState, useRef } from 'react';
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
        console.log('Cubemap loaded for exoplanets scene');
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

export function ExoplanetScene() {
  const { currentIndex, isTransitioning, navigationDirection } = useExoplanetStore();
  const [displayedIndex, setDisplayedIndex] = useState(currentIndex);
  const [isExiting, setIsExiting] = useState(false);
  const previousIndex = useRef(currentIndex);

  // Handle transition between planets
  useEffect(() => {
    if (currentIndex !== previousIndex.current) {
      // Start exit animation for current planet
      setIsExiting(true);

      // After exit animation, switch to new planet
      const timer = setTimeout(() => {
        setDisplayedIndex(currentIndex);
        setIsExiting(false);
        previousIndex.current = currentIndex;
      }, 500); // Half of the transition time

      return () => clearTimeout(timer);
    }
  }, [currentIndex]);

  const currentPlanet = exoplanets[displayedIndex];
  const isEntering = displayedIndex === currentIndex && isTransitioning && !isExiting;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 2, 8], fov: 50 }}
      >
        {/* Cubemap Skybox */}
        <Suspense fallback={null}>
          <Skybox />
        </Suspense>

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        {/* Current exoplanet */}
        <Suspense fallback={null}>
          <ExoplanetObject
            key={currentPlanet.id}
            planet={currentPlanet}
            isEntering={isEntering}
            isExiting={isExiting}
            navigationDirection={navigationDirection}
          />
        </Suspense>

        {/* Camera controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          minDistance={3}
          maxDistance={20}
          target={[1.5, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
