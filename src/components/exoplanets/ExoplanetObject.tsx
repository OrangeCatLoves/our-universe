import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSpring, animated, SpringValue } from '@react-spring/three';
import { Billboard } from '@react-three/drei';
import type { Exoplanet } from '../../data/extremeExoplanets';
import type { PlanetRings as PlanetRingsData } from '../../data/types';
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
  uniform float useImageAlpha; // 1.0 for images with a real alpha channel (.webp/.png)
  uniform float opacity;
  varying vec2 vUv;

  void main() {
    vec4 texColor = texture2D(map, vUv);
    float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    float lumAlpha = smoothstep(threshold, threshold + smoothness, luminance);
    float alpha = mix(lumAlpha, 1.0, useImageAlpha) * texColor.a;
    gl_FragColor = vec4(texColor.rgb, alpha * opacity);
    // Convert back to the output colour space (the sRGB texture is sampled as linear);
    // without this, static images render noticeably darker than the source file.
    #include <colorspace_fragment>
  }
`;

/**
 * Load /<folder>/exoplanets/<file>. Dev only: a draft in <project>/draft/<folder>/exoplanets/
 * takes priority so it can be reviewed before being promoted to public/ (never in production).
 */
function loadExoplanetTexture(
  file: string,
  onLoad: (tex: THREE.Texture) => void,
  onFail: (error: unknown) => void,
  folder: 'textures' | 'images' = 'textures'
) {
  const loader = new THREE.TextureLoader();
  const candidates = [
    ...(import.meta.env.DEV ? [`/draft/${folder}/exoplanets/${file}`] : []),
    `/${folder}/exoplanets/${file}`,
  ];
  const tryLoad = (i: number) => {
    loader.load(
      candidates[i],
      (tex) => {
        console.log(`Texture loaded: ${candidates[i]}`);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        onLoad(tex);
      },
      undefined,
      (error) => {
        if (i + 1 < candidates.length) {
          tryLoad(i + 1);
        } else {
          onFail(error);
        }
      }
    );
  };
  tryLoad(0);
}

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
      loadExoplanetTexture(
        planet.texture,
        (tex) => {
          if (isMounted) {
            loadedTexture = tex;
            setTexture(tex);
          } else {
            tex.dispose();
          }
        },
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
        // Ringed planets tilt as a whole so the spin axis stays perpendicular to the rings
        <group rotation={planet.rings?.tilt ?? [0, 0, 0]}>
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
          {planet.rings && <PlanetRings rings={planet.rings} animatedOpacity={animatedOpacity} />}
        </group>
      ) : (
        <StaticImage planet={planet} animatedOpacity={animatedOpacity} />
      )}
    </animated.group>
  );
}

// Ring system (e.g. J1407b). The texture is a radial RGBA strip: x = inner edge -> outer edge.
function PlanetRings({ rings, animatedOpacity }: { rings: PlanetRingsData; animatedOpacity: SpringValue<number> }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());

  useEffect(() => {
    let isMounted = true;
    let loaded: THREE.Texture | null = null;
    loadExoplanetTexture(
      rings.texture,
      (tex) => {
        if (!isMounted) {
          tex.dispose();
          return;
        }
        tex.anisotropy = maxAnisotropy; // rings are seen at grazing angles
        loaded = tex;
        setTexture(tex);
      },
      (error) => console.log(`Ring texture not found: ${rings.texture}`, error)
    );
    return () => {
      isMounted = false;
      loaded?.dispose();
    };
  }, [rings.texture, maxAnisotropy]);

  // Flat annulus with UVs remapped so u runs radially across the strip texture
  const geometry = useMemo(() => {
    const { innerRadius, outerRadius } = rings;
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 256, 24);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - innerRadius) / (outerRadius - innerRadius), 0.5);
    }
    return geo;
  }, [rings]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = animatedOpacity.get();
    }
  });

  if (!texture) return null;

  return (
    // RingGeometry lies in XY; rotate into the planet's equatorial (XZ) plane.
    // renderOrder 1 draws after the planet so the planet correctly hides the far side.
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <meshStandardMaterial
        ref={materialRef}
        map={texture}
        roughness={0.9}
        metalness={0}
        transparent={true}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// Static image component (for objects with category 'static')
function StaticImage({ planet, animatedOpacity }: { planet: Exoplanet; animatedOpacity: SpringValue<number> }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const fallbackMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const imageMaterialRef = useRef<THREE.ShaderMaterial>(null);
  // Images with a real alpha channel skip the dark-pixels-become-transparent trick
  const hasAlpha = /\.(webp|png)$/i.test(planet.image ?? '');

  // Animate fallback material / image opacity
  useFrame(() => {
    if (fallbackMaterialRef.current) {
      fallbackMaterialRef.current.opacity = animatedOpacity.get();
    }
    if (imageMaterialRef.current) {
      imageMaterialRef.current.uniforms.opacity.value = animatedOpacity.get();
    }
  });

  const uniforms = useMemo(() => ({
    map: { value: null as THREE.Texture | null },
    threshold: { value: 0.05 },
    smoothness: { value: 0.1 },
    useImageAlpha: { value: hasAlpha ? 1.0 : 0.0 },
    opacity: { value: 1.0 },
  }), [hasAlpha]);

  useEffect(() => {
    if (texture) {
      uniforms.map.value = texture;
    }
  }, [texture, uniforms]);

  useEffect(() => {
    let isMounted = true;
    let loadedTexture: THREE.Texture | null = null;

    if (planet.image) {
      loadExoplanetTexture(
        planet.image,
        (tex) => {
          if (!isMounted) {
            tex.dispose();
            return;
          }
          const image = tex.image as HTMLImageElement | undefined;
          if (image && image.width && image.height) {
            setAspectRatio(image.width / image.height);
          }
          loadedTexture = tex;
          setTexture(tex);
        },
        () => {
          console.log(`Image not found for ${planet.name}, using fallback`);
          if (isMounted) {
            setTexture(null);
          }
        },
        'images'
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
    // Wide images get extra width so their details stay readable
    const baseSize = aspectRatio > 1.5 ? 5.0 : 3.5;
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
            ref={imageMaterialRef}
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
