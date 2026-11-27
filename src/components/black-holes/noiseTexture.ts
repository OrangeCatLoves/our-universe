import * as THREE from 'three';

/**
 * A tileable 3D gradient-noise volume (64^3 voxels, 4 independent channels), generated once.
 * The lensing shader reads gas turbulence from it: one texture fetch per noise octave instead of
 * evaluating noise maths per sample, which is what makes a detailed, volumetric disk affordable.
 *
 * Lattice period: 16 cells across the volume (4 voxels per cell), so in the shader a coordinate p
 * measured in lattice cells is sampled at p / 16 with repeat wrapping.
 */
const SIZE = 64;
const PERIOD = 16;

let cached: THREE.Data3DTexture | null = null;

function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function getNoiseTexture(): THREE.Data3DTexture {
  if (cached) return cached;
  const data = new Uint8Array(SIZE * SIZE * SIZE * 4);
  const cells = PERIOD * PERIOD * PERIOD;
  const step = PERIOD / SIZE;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

  for (let ch = 0; ch < 4; ch++) {
    const rnd = makeRandom(0x9e3779b9 + ch * 7919);
    const grad = new Float32Array(cells * 3);
    for (let i = 0; i < cells; i++) {
      const z = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      grad[i * 3] = r * Math.cos(a);
      grad[i * 3 + 1] = r * Math.sin(a);
      grad[i * 3 + 2] = z;
    }
    const dot = (ix: number, iy: number, iz: number, fx: number, fy: number, fz: number) => {
      const g = (((iz & (PERIOD - 1)) * PERIOD + (iy & (PERIOD - 1))) * PERIOD + (ix & (PERIOD - 1))) * 3;
      return grad[g] * fx + grad[g + 1] * fy + grad[g + 2] * fz;
    };
    for (let z = 0; z < SIZE; z++) {
      const pz = (z + 0.5) * step;
      const iz = Math.floor(pz);
      const fz = pz - iz;
      const wz = fade(fz);
      for (let y = 0; y < SIZE; y++) {
        const py = (y + 0.5) * step;
        const iy = Math.floor(py);
        const fy = py - iy;
        const wy = fade(fy);
        for (let x = 0; x < SIZE; x++) {
          const px = (x + 0.5) * step;
          const ix = Math.floor(px);
          const fx = px - ix;
          const wx = fade(fx);
          const x00 = dot(ix, iy, iz, fx, fy, fz) + wx * (dot(ix + 1, iy, iz, fx - 1, fy, fz) - dot(ix, iy, iz, fx, fy, fz));
          const x10 = dot(ix, iy + 1, iz, fx, fy - 1, fz) + wx * (dot(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz) - dot(ix, iy + 1, iz, fx, fy - 1, fz));
          const x01 = dot(ix, iy, iz + 1, fx, fy, fz - 1) + wx * (dot(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1) - dot(ix, iy, iz + 1, fx, fy, fz - 1));
          const x11 = dot(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1) + wx * (dot(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1) - dot(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1));
          const y0 = x00 + wy * (x10 - x00);
          const y1 = x01 + wy * (x11 - x01);
          const v = y0 + wz * (y1 - y0); // roughly -0.8 .. 0.8
          data[((z * SIZE + y) * SIZE + x) * 4 + ch] = Math.max(0, Math.min(255, Math.round(128 + v * 175)));
        }
      }
    }
  }

  const tex = new THREE.Data3DTexture(data, SIZE, SIZE, SIZE);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.wrapR = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
