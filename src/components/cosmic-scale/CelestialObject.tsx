import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import { Billboard } from '@react-three/drei';
import type { CelestialObject as CelestialObjectType } from '../../data/cosmicScale';
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

// Special shader for black holes - preserves dark center (event horizon) while making edges transparent
const blackHoleFragmentShader = `
  uniform sampler2D map;
  uniform float threshold;
  uniform float smoothness;
  uniform float centerPreserveRadius;
  varying vec2 vUv;

  void main() {
    vec4 texColor = texture2D(map, vUv);

    // Calculate luminance (perceived brightness)
    float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

    // Calculate distance from center (0 at center, 1 at corners)
    vec2 centered = vUv - 0.5;
    float distFromCenter = length(centered) * 2.0; // Normalize to 0-1 range

    // Determine if we're in the center region that should stay solid
    // The center preserve radius defines how much of the center stays opaque even if dark
    float centerWeight = 1.0 - smoothstep(centerPreserveRadius * 0.5, centerPreserveRadius, distFromCenter);

    // For edges: dark pixels become transparent
    // For center: dark pixels stay opaque (it's the event horizon)
    float edgeAlpha = smoothstep(threshold, threshold + smoothness, luminance);

    // Blend: center region ignores luminance-based transparency
    float alpha = mix(edgeAlpha, 1.0, centerWeight);

    // But if the pixel is bright, it should always be visible
    alpha = max(alpha, edgeAlpha);

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

// Helper to check if object is a black hole (needs special transparency handling)
function isBlackHole(type: string): boolean {
  return type.toLowerCase().includes('black hole');
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
      '/textures/cosmic-scale/saturn-rings.jpg',
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
  const [_textureLoaded, setTextureLoaded] = useState(false);

  // Animate position and scale
  // When entering from right (forward nav): animate from right side
  // When backward nav (entryFromRight=false): start at target position
  const { animatedScale, animatedPositionX, animatedPositionY } = useSpring({
    from: {
      animatedScale: entryFromRight ? 1.5 : scale,
      animatedPositionX: entryFromRight ? 5 : positionX,
      animatedPositionY: entryFromRight ? 0 : positionY,
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
      console.log(`Loading texture: /textures/cosmic-scale/${object.texture}`);

      loader.load(
        `/textures/cosmic-scale/${object.texture}`,
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

// Static image component for nebulae, galaxies, black holes, etc.
// Uses Billboard to always face camera and custom shader for dark pixel transparency
// Black holes use a special shader that preserves the dark center (event horizon)
function StaticImage({ object }: { object: CelestialObjectType }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const objectIsBlackHole = isBlackHole(object.type);

  // Create shader uniforms - memoized to prevent recreation
  // Black holes need an extra uniform for center preservation
  const uniforms = useMemo(() => ({
    map: { value: null as THREE.Texture | null },
    threshold: { value: 0.05 },    // Pixels darker than this become transparent
    smoothness: { value: 0.1 },    // Smooth transition range
    centerPreserveRadius: { value: 0.6 }, // For black holes: preserve dark center within this radius
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
    // Black holes get a larger base size for more imposing presence
    const baseSize = objectIsBlackHole ? 9.0 : 3.5;
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
            fragmentShader={objectIsBlackHole ? blackHoleFragmentShader : transparentDarkFragmentShader}
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
