import * as THREE from 'three';
import { celestialObjects } from '../data/cosmicScale';

// Global texture cache - persists across component unmounts
const textureCache = new Map<string, THREE.Texture>();
const loadingPromises = new Map<string, Promise<THREE.Texture | null>>();

const loader = new THREE.TextureLoader();

/**
 * Get a texture from cache, or null if not cached
 */
export function getCachedTexture(path: string): THREE.Texture | null {
  return textureCache.get(path) || null;
}

/**
 * Load a single texture and cache it
 */
export function loadTexture(path: string): Promise<THREE.Texture | null> {
  // Return cached texture immediately
  if (textureCache.has(path)) {
    return Promise.resolve(textureCache.get(path)!);
  }

  // Return existing loading promise if already loading
  if (loadingPromises.has(path)) {
    return loadingPromises.get(path)!;
  }

  // Start new load
  const promise = new Promise<THREE.Texture | null>((resolve) => {
    loader.load(
      path,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        textureCache.set(path, texture);
        loadingPromises.delete(path);
        resolve(texture);
      },
      undefined,
      () => {
        loadingPromises.delete(path);
        resolve(null);
      }
    );
  });

  loadingPromises.set(path, promise);
  return promise;
}

/**
 * Preload textures for objects at given indices
 */
export function preloadTexturesForIndices(indices: number[]): void {
  indices.forEach((index) => {
    const obj = celestialObjects[index];
    if (!obj) return;

    if (obj.category === 'sphere' && obj.texture) {
      const path = `/textures/cosmic-scale/${obj.texture}`;
      loadTexture(path);
    } else if (obj.category === 'static' && obj.image) {
      const path = `/images/cosmic-scale/${obj.image}`;
      loadTexture(path);
    }
  });
}

/**
 * Preload textures around the current index
 * Loads current + next few + previous few for smooth navigation
 */
export function preloadNearbyTextures(currentIndex: number, range: number = 3): void {
  const indices: number[] = [];

  // Add current
  indices.push(currentIndex);

  // Add next objects (more important for forward navigation)
  for (let i = 1; i <= range; i++) {
    if (currentIndex + i < celestialObjects.length) {
      indices.push(currentIndex + i);
    }
  }

  // Add previous objects (for backward navigation)
  for (let i = 1; i <= range - 1; i++) {
    if (currentIndex - i >= 0) {
      indices.push(currentIndex - i);
    }
  }

  preloadTexturesForIndices(indices);
}

/**
 * Check if a texture is cached
 */
export function isTextureCached(path: string): boolean {
  return textureCache.has(path);
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): { cached: number; loading: number } {
  return {
    cached: textureCache.size,
    loading: loadingPromises.size,
  };
}
