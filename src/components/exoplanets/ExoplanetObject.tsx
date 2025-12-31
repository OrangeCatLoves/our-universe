import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated, SpringValue } from '@react-spring/three';
import { Billboard } from '@react-three/drei';
import type { Exoplanet } from '../../data/extremeExoplanets';
import * as THREE from 'three';

// Shader for static images with transparent dark backgrounds
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
    float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    float alpha = smoothstep(threshold, threshold + smoothness, luminance);
    gl_FragColor = vec4(texColor.rgb, alpha * texColor.a);
  }
`;

interface Props {
  planet: Exoplanet;
  isEntering: boolean;
  isExiting: boolean;
  navigationDirection: 'forward' | 'backward' | null;
}

export function ExoplanetObject({ planet, isEntering, isExiting, navigationDirection }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Determine animation state
  const getAnimationState = () => {
    if (isEntering) {
      // Entry animation - approach from distance
      return {
        scale: 0.1,
        positionZ: -15,
        opacity: 0,
      };
    }
    if (isExiting) {
      // Exit animation - recede into distance
      return {
        scale: 0.3,
        positionZ: navigationDirection === 'forward' ? 10 : -10,
        opacity: 0,
      };
    }
    // Normal visible state
    return {
      scale: 1.5,
      positionZ: 0,
      opacity: 1,
    };
  };

  const targetState = getAnimationState();

  // Animate position, scale, and opacity
  const { animatedScale, animatedPositionZ, animatedOpacity } = useSpring({
    animatedScale: targetState.scale,
    animatedPositionZ: targetState.positionZ,
    animatedOpacity: targetState.opacity,
    config: { tension: 60, friction: 20 },
  });

  // Load texture for spheres
  useEffect(() => {
    let isMounted = true;
    let loadedTexture: THREE.Texture | null = null;

    if (planet.category === 'sphere' && planet.texture) {
      const loader = new THREE.TextureLoader();
      console.log(`Loading exoplanet texture: /textures/exoplanets/${planet.texture}`);

      loader.load(
        `/textures/exoplanets/${planet.texture}`,
        (tex) => {
          if (isMounted) {
            console.log(`Texture loaded for ${planet.name}`);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
            loadedTexture = tex;
            setTexture(tex);
          }
        },
        undefined,
        (error) => {
          console.log(`Texture not found for ${planet.name}, using fallback color`, error);
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
  }, [planet.id, planet.texture, planet.category, planet.name]);

  // Rotate spheres slowly and animate material opacity
  useFrame((_, delta) => {
    if (meshRef.current && planet.category === 'sphere') {
      meshRef.current.rotation.y += delta * 0.08;
    }
    // Animate opacity using the spring value
    if (materialRef.current) {
      materialRef.current.opacity = animatedOpacity.get();
    }
  });

  // Position offset to the right to make room for info panel
  const positionX = 1.5;

  return (
    <animated.group
      position-x={positionX}
      position-y={0}
      position-z={animatedPositionZ as unknown as number}
      scale={animatedScale as unknown as number}
    >
      {planet.category === 'sphere' ? (
        <mesh ref={meshRef}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial
            ref={materialRef}
            key={texture?.uuid ?? 'fallback'}
            color={texture ? '#ffffff' : planet.color}
            map={texture}
            roughness={0.65}
            metalness={0.1}
            transparent={true}
            opacity={targetState.opacity}
          />
        </mesh>
      ) : (
        <StaticImage planet={planet} animatedOpacity={animatedOpacity} />
      )}
    </animated.group>
  );
}

// Static image component for the TRAPPIST-1 system
function StaticImage({ planet, animatedOpacity }: { planet: Exoplanet; animatedOpacity: SpringValue<number> }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const fallbackMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Animate fallback material opacity
  useFrame(() => {
    if (fallbackMaterialRef.current) {
      fallbackMaterialRef.current.opacity = animatedOpacity.get();
    }
  });

  const uniforms = useMemo(() => ({
    map: { value: null as THREE.Texture | null },
    threshold: { value: 0.05 },
    smoothness: { value: 0.1 },
  }), []);

  useEffect(() => {
    if (texture) {
      uniforms.map.value = texture;
    }
  }, [texture, uniforms]);

  useEffect(() => {
    let isMounted = true;
    let loadedTexture: THREE.Texture | null = null;

    if (planet.image) {
      const loader = new THREE.TextureLoader();
      loader.load(
        `/images/exoplanets/${planet.image}`,
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
          console.log(`Image not found for ${planet.name}, using fallback`);
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
  }, [planet.image, planet.name]);

  if (texture) {
    const baseSize = 3.5;
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
        <meshStandardMaterial
          ref={fallbackMaterialRef}
          color={planet.color}
          roughness={0.65}
          metalness={0.1}
          transparent={true}
          opacity={1}
        />
      </mesh>
    </Billboard>
  );
}
