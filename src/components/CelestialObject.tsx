import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import { Billboard } from '@react-three/drei';
import type { CelestialObject as CelestialObjectType } from '../data/objects';
import * as THREE from 'three';

// Shader to make dark pixels transparent (for space images with black backgrounds)
const transparentDarkVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const transparentDarkFragmentShader = `
  uniform sampler2D map;
  uniform float threshold;
  uniform float smoothness;
  varying vec2 vUv;

  void main() {
    vec4 texColor = texture2D(map, vUv);

    // Calculate luminance (perceived brightness)
    float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

    // Smooth transition from transparent to opaque based on luminance
    float alpha = smoothstep(threshold, threshold + smoothness, luminance);

    gl_FragColor = vec4(texColor.rgb, alpha * texColor.a);
  }
`;

interface Props {
  object: CelestialObjectType;
  scale: number;
  positionX: number;
  positionY: number;
  isCurrent: boolean;
  entryFromRight: boolean;
}

// Helper to check if object is a star (should be self-luminous)
function isStar(type: string): boolean {
  return type.toLowerCase().includes('star');
}

// Helper to check if object is Saturn (has rings)
function isSaturn(id: string): boolean {
  return id === 'saturn';
}

// Saturn's rings component
function SaturnRings() {
  const ringsRef = useRef<THREE.Mesh>(null);
  const [ringTexture, setRingTexture] = useState<THREE.Texture | null>(null);

  // Create shader uniforms for ring transparency
  const uniforms = useMemo(() => ({
    map: { value: null as THREE.Texture | null },
    threshold: { value: 0.02 },
    smoothness: { value: 0.05 },
  }), []);

  // Load ring texture
  useEffect(() => {
    let isMounted = true;
    const loader = new THREE.TextureLoader();

    loader.load(
      '/textures/saturn-rings.jpg',
      (tex) => {
        if (isMounted) {
          tex.colorSpace = THREE.SRGBColorSpace;
          setRingTexture(tex);
          uniforms.map.value = tex;
        }
      },
      undefined,
      (error) => {
        console.log('Saturn rings texture not found', error);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [uniforms]);

  // Create ring geometry with corrected UVs for horizontal strip texture
  const ringGeometry = useMemo(() => {
    const innerRadius = 1.2;
    const outerRadius = 2.5;
    const thetaSegments = 64;

    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments);

    // Fix UVs to map horizontal strip texture radially
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const radius = Math.sqrt(x * x + y * y);

      // Map radius to U coordinate (0 = inner, 1 = outer)
      const u = (radius - innerRadius) / (outerRadius - innerRadius);
      uv.setXY(i, u, 0.5);
    }

    return geometry;
  }, []);

  if (!ringTexture) return null;

  return (
    <mesh
      ref={ringsRef}
      rotation={[1.2, 0, 0.5]} // Tilted to show ring surface at ~70 degrees
    >
      <primitive object={ringGeometry} attach="geometry" />
      <shaderMaterial
        vertexShader={transparentDarkVertexShader}
        fragmentShader={transparentDarkFragmentShader}
        uniforms={uniforms}
        transparent={true}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function CelestialObject({ object, scale, positionX, positionY, entryFromRight }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [textureLoaded, setTextureLoaded] = useState(false);

  // Animate position and scale
  const { animatedScale, animatedPositionX, animatedPositionY } = useSpring({
    from: {
      animatedScale: entryFromRight ? 1.5 : 0.02,
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

  // Load texture for spheres
  useEffect(() => {
    let isMounted = true;
    let loadedTexture: THREE.Texture | null = null;

    if (object.category === 'sphere' && object.texture) {
      const loader = new THREE.TextureLoader();
      console.log(`Loading texture: /textures/${object.texture}`);

      loader.load(
        `/textures/${object.texture}`,
        (tex) => {
          if (isMounted) {
            console.log(`Texture loaded successfully for ${object.name}`, tex);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
            loadedTexture = tex;
            setTexture(tex);
            setTextureLoaded(true);
          }
        },
        (progress) => {
          console.log(`Loading progress for ${object.name}:`, progress);
        },
        (error) => {
          console.log(`Texture not found for ${object.name}, using fallback color`, error);
          if (isMounted) {
            setTexture(null);
            setTextureLoaded(true);
          }
        }
      );
    } else {
      setTextureLoaded(true);
    }

    return () => {
      isMounted = false;
      if (loadedTexture) {
        loadedTexture.dispose();
      }
    };
  }, [object.id, object.texture, object.category, object.name]);

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
        <>
          <mesh ref={meshRef}>
            <sphereGeometry args={[1, 64, 64]} />
            {isStar(object.type) ? (
              // Stars use meshBasicMaterial - self-luminous, ignores lighting, no shadows
              <meshBasicMaterial
                key={texture?.uuid ?? 'fallback-star'}
                color={texture ? '#ffffff' : object.color}
                map={texture}
                toneMapped={false}
              />
            ) : (
              // Non-stars use meshStandardMaterial - responds to lighting
              <meshStandardMaterial
                key={texture?.uuid ?? 'fallback'}
                color={texture ? '#ffffff' : object.color}
                map={texture}
              />
            )}
          </mesh>
          {/* Saturn's rings */}
          {isSaturn(object.id) && <SaturnRings />}
        </>
      ) : (
        <StaticImage object={object} />
      )}
    </animated.group>
  );
}

// Static image component for nebulae, galaxies, etc.
// Uses Billboard to always face camera and custom shader for dark pixel transparency
function StaticImage({ object }: { object: CelestialObjectType }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  // Create shader uniforms - memoized to prevent recreation
  const uniforms = useMemo(() => ({
    map: { value: null as THREE.Texture | null },
    threshold: { value: 0.05 },    // Pixels darker than this become transparent
    smoothness: { value: 0.1 },    // Smooth transition range
  }), []);

  // Update texture uniform when texture changes
  useEffect(() => {
    if (texture) {
      uniforms.map.value = texture;
    }
  }, [texture, uniforms]);

  useEffect(() => {
    let isMounted = true;
    let loadedTexture: THREE.Texture | null = null;

    if (object.image) {
      const loader = new THREE.TextureLoader();
      loader.load(
        `/images/${object.image}`,
        (tex) => {
          if (isMounted) {
            tex.colorSpace = THREE.SRGBColorSpace;
            const image = tex.image;
            if (image && image.width && image.height) {
              setAspectRatio(image.width / image.height);
            }
            loadedTexture = tex;
            setTexture(tex);
          }
        },
        undefined,
        () => {
          console.log(`Image not found for ${object.name}, using fallback`);
          if (isMounted) {
            setTexture(null);
          }
        }
      );
    }

    return () => {
      isMounted = false;
      if (loadedTexture) {
        loadedTexture.dispose();
      }
    };
  }, [object.image, object.name]);

  if (texture) {
    const baseSize = 3.5; // Increased from 2 to make static images more prominent
    let width = baseSize;
    let height = baseSize;

    if (aspectRatio > 1) {
      height = baseSize / aspectRatio;
    } else {
      width = baseSize * aspectRatio;
    }

    return (
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <mesh>
          <planeGeometry args={[width, height]} />
          <shaderMaterial
            vertexShader={transparentDarkVertexShader}
            fragmentShader={transparentDarkFragmentShader}
            uniforms={uniforms}
            transparent={true}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    );
  }

  return (
    <Billboard follow={true}>
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={object.color} />
      </mesh>
    </Billboard>
  );
}
