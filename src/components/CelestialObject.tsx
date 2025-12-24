import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { useSpring, animated } from '@react-spring/three';
import type { CelestialObject as CelestialObjectType } from '../data/objects';
import * as THREE from 'three';

interface Props {
  object: CelestialObjectType;
  scale: number;
  positionX: number;
  positionY: number;
  isCurrent: boolean;
  entryFromRight: boolean;
}

export function CelestialObject({ object, scale, positionX, positionY, entryFromRight }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Animate position and scale
  // 'from' specifies where NEW components start (only applies on mount)
  // entryFromRight determines if new objects enter from right (forward) or left (backward)
  const { animatedScale, animatedPositionX, animatedPositionY } = useSpring({
    from: {
      animatedScale: entryFromRight ? 1.5 : 0.02, // 1.5 matches CURRENT_OBJECT_SCALE in store
      animatedPositionX: entryFromRight ? 5 : -5,
      animatedPositionY: entryFromRight ? 0 : -2,
    },
    to: {
      animatedScale: scale,
      animatedPositionX: positionX,
      animatedPositionY: positionY,
    },
    config: { tension: 80, friction: 26 },
  });

  // Try to load texture for spheres
  useEffect(() => {
    if (object.category === 'sphere' && object.texture) {
      const loader = new TextureLoader();
      loader.load(
        `/textures/${object.texture}`,
        (loadedTexture) => {
          setTexture(loadedTexture);
        },
        undefined,
        () => {
          console.log(`Texture not found for ${object.name}, using fallback color`);
          setTexture(null);
        }
      );
    }

    // Cleanup texture on unmount
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [object]);

  // Rotate spheres
  useFrame((_, delta) => {
    if (meshRef.current && object.category === 'sphere') {
      meshRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <animated.group
      position-x={animatedPositionX as any}
      position-y={animatedPositionY as any}
      position-z={0}
      scale={animatedScale as any}
    >
      {object.category === 'sphere' ? (
        // Render sphere with texture or solid color
        <mesh ref={meshRef}>
          <sphereGeometry args={[1, 64, 64]} />
          {texture ? (
            <meshStandardMaterial map={texture} />
          ) : (
            <meshStandardMaterial color={object.color} />
          )}
        </mesh>
      ) : (
        // Render static image (for nebulae, galaxies, etc.)
        <StaticImage object={object} />
      )}
    </animated.group>
  );
}

// Static image component for nebulae, galaxies, etc.
function StaticImage({ object }: { object: CelestialObjectType }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  useEffect(() => {
    if (object.image) {
      const loader = new TextureLoader();
      loader.load(
        `/images/${object.image}`,
        (loadedTexture) => {
          // Get aspect ratio from the loaded texture
          const image = loadedTexture.image;
          if (image && image.width && image.height) {
            setAspectRatio(image.width / image.height);
          }
          setTexture(loadedTexture);
        },
        undefined,
        () => {
          console.log(`Image not found for ${object.name}, using fallback`);
          setTexture(null);
        }
      );
    }

    // Cleanup texture on unmount
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [object.image]);

  if (texture) {
    // Calculate plane dimensions based on aspect ratio
    // Base size is 2, adjust width or height to maintain aspect ratio
    const baseSize = 2;
    let width = baseSize;
    let height = baseSize;

    if (aspectRatio > 1) {
      // Wider than tall
      height = baseSize / aspectRatio;
    } else {
      // Taller than wide
      width = baseSize * aspectRatio;
    }

    return (
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} transparent={true} />
      </mesh>
    );
  }

  // Fallback to colored sphere if image not found
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color={object.color} />
    </mesh>
  );
}
