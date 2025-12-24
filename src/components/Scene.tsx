import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useCosmicStore } from '../store/useCosmicStore';
import { celestialObjects } from '../data/objects';
import { CelestialObject } from './CelestialObject';
import { Suspense } from 'react';

export function Scene() {
  const { visibleObjects, currentIndex } = useCosmicStore();

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Background image layer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'url(/images/spacebackground.jpg), url(/images/spacebackground.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }}
      />

      <Canvas
        camera={{ position: [0, 2, 8], fov: 50 }}
        style={{ background: 'transparent', position: 'relative', zIndex: 1 }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
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
