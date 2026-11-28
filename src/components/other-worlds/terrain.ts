import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TerrainSpec } from './worlds';

// Procedural ground for "Skies of Other Worlds".
// A radial mesh centred on the viewer: dense close by, then evenly spaced rings through the horizon band
// (so distant ridges have sharp silhouettes), bent down by the planet's curvature so the horizon sits at
// the real distance for that world's size. Height maps sampled from the mesh feed the terrain shadows.

export const TERRAIN_RADIUS = 6000;
const SEGMENTS = 768;
const NEAR_R0 = 0.35;          // first ring
const GEO_K = 1.0667;          // ring spacing ratio close to the viewer
// Rings grow apart geometrically until they are BAND_STEP apart (~525 m out), then stay evenly spaced. (They
// used to keep growing to 160 m apart at 2.4 km, where small craters and dunes turned into zigzag noise.)
const BAND_STEP = 35;
const BAND_START = BAND_STEP / (GEO_K - 1);
// Skylines: every ring has SEGMENTS slices of 0.47 degrees, so horizons and ridges were polylines with a kink
// every 10-60 px (worst when zoomed in). Rings beyond FINE_FROM get FINE times more slices, with heights on a
// smooth curve through the original samples (cheap: no extra noise to evaluate). Phones keep the plain mesh.
const FINE_FROM = 60;
const FINE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 1 : 3;

// height maps for terrain shadows, finest around the viewer (cells: 0.6 m, 2.3 m, 11.7 m); coarse cells
// gave stair-stepped shadow outlines
export const NEAR_MAP_HALF = 160;
export const MID_MAP_HALF = 1200;
export const FAR_MAP_HALF = TERRAIN_RADIUS;
const NEAR_MAP_SIZE = 512;
const MID_MAP_SIZE = 1024;
const FAR_MAP_SIZE = 1024;

// ---------------------------------------------------------------- noise
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440670441) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Smooth value noise in [-1, 1]. */
function noise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const ux = fade(x - ix);
  const uy = fade(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

/** Smooth 3D value noise in [-1, 1] (rock shapes). */
function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const ux = fade(x - ix);
  const uy = fade(y - iy);
  const uz = fade(z - iz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c000 = hash3(ix, iy, iz, seed);
  const c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed);
  const c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed);
  const c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);
  const x0 = lerp(lerp(c000, c100, ux), lerp(c010, c110, ux), uy);
  const x1 = lerp(lerp(c001, c101, ux), lerp(c011, c111, ux), uy);
  return lerp(x0, x1, uz) * 2 - 1;
}

function fbm2(x: number, y: number, seed: number, octaves: number): number {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    s += amp * noise2(x, y, seed + i * 17);
    norm += amp;
    x = x * 2.03 + 11.7;
    y = y * 2.03 - 7.3;
    amp *= 0.5;
  }
  return s / norm;
}

/** Ridged multifractal: sharp crests that get sharper where the coarse ridge is high (like eroded rock). */
function ridged2(x: number, y: number, seed: number, octaves: number): number {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  let weight = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(noise2(x, y, seed + i * 29));
    n = n * n * weight;
    weight = Math.min(Math.max(n * 1.6, 0), 1);
    s += amp * n;
    norm += amp;
    x = x * 2.1 + 3.1;
    y = y * 2.1 + 5.9;
    amp *= 0.5;
  }
  return s / norm;
}

function fbm3(x: number, y: number, z: number, seed: number, octaves: number): number {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    s += amp * noise3(x, y, z, seed + i * 13);
    norm += amp;
    x = x * 2.07 + 1.3;
    y = y * 2.07 - 4.1;
    z = z * 2.07 + 2.9;
    amp *= 0.5;
  }
  return s / norm;
}

/** fbm2 without the octaves finer than `spacing` metres (`scale`: feature size of the first octave). Same
 * octaves, seeds and normalisation as fbm2, so close to the viewer the two are identical. */
function fbm2bl(x: number, y: number, seed: number, octaves: number, scale: number, spacing: number): number {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  let size = scale;
  for (let i = 0; i < octaves; i++) {
    const w = smooth(spacing * 1.2, spacing * 2.4, size);
    if (w > 0) s += amp * w * noise2(x, y, seed + i * 17);
    norm += amp;
    x = x * 2.03 + 11.7;
    y = y * 2.03 - 7.3;
    amp *= 0.5;
    size /= 2.03;
  }
  return s / norm;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- height field
export interface HeightField {
  /** height without curvature (m) */
  local: (x: number, z: number) => number;
  /** height including the planet's curvature */
  at: (x: number, z: number) => number;
  /** 0..1 colour-patch mask; soft widens its edges (where the mesh is coarse) */
  accent: (x: number, z: number, soft?: number) => number;
  /** the mountains and mesas alone (part of local): sharp skyline features, evaluated exactly on fine rings */
  relief: (x: number, z: number) => number;
}

export function makeHeightField(t: TerrainSpec): HeightField {
  const rnd = mulberry32(t.seed);
  const seed = t.seed * 101;

  // craters, bucketed on a grid so each point only checks its neighbours
  const CELL = 250;
  const buckets = new Map<string, Array<{ x: number; z: number; r: number; depth: number }>>();
  if (t.craters) {
    for (let i = 0; i < t.craters.count; i++) {
      const r = 3 + t.craters.maxRadius * Math.pow(rnd(), 2.4);
      const dist = r * 1.4 + 6 + Math.pow(rnd(), 0.7) * 5200;
      const a = rnd() * Math.PI * 2;
      const c = { x: Math.cos(a) * dist, z: Math.sin(a) * dist, r, depth: t.craters.depth * r };
      const reach = c.r * 2.2;
      for (let gx = Math.floor((c.x - reach) / CELL); gx <= Math.floor((c.x + reach) / CELL); gx++) {
        for (let gz = Math.floor((c.z - reach) / CELL); gz <= Math.floor((c.z + reach) / CELL); gz++) {
          const k = `${gx},${gz}`;
          const list = buckets.get(k);
          if (list) list.push(c);
          else buckets.set(k, [c]);
        }
      }
    }
  }

  const mesas: Array<{ x: number; z: number; r: number; h: number }> = [];
  if (t.mesas) {
    for (let i = 0; i < t.mesas.count; i++) {
      const az = THREE.MathUtils.degToRad(t.mesas.azimuthDeg + (rnd() - 0.5) * t.mesas.spreadDeg);
      const dist = 1400 + rnd() * 3400;
      mesas.push({ x: Math.sin(az) * dist, z: -Math.cos(az) * dist, r: 70 + rnd() * 200, h: t.mesas.height * (0.45 + rnd() * 0.75) });
    }
  }

  const basin = t.basin
    ? (() => {
        const az = THREE.MathUtils.degToRad(t.basin.azimuthDeg);
        const c = t.basin.distance + t.basin.radius; // near shore at `distance`
        return { x: Math.sin(az) * c, z: -Math.cos(az) * c, r: t.basin.radius, depth: t.basin.depth };
      })()
    : null;

  const dune = t.dunes
    ? { c: Math.cos(THREE.MathUtils.degToRad(t.dunes.directionDeg)), s: Math.sin(THREE.MathUtils.degToRad(t.dunes.directionDeg)) }
    : null;
  const ridge = t.ridges
    ? { c: Math.cos(THREE.MathUtils.degToRad(t.ridges.directionDeg)), s: Math.sin(THREE.MathUtils.degToRad(t.ridges.directionDeg)) }
    : null;

  const base = (x: number, z: number): number => {
    const r = Math.sqrt(x * x + z * z);
    const sp = meshSpacing(r); // every term below is limited to what the mesh can hold here
    let h = fbm2(x / 1700, z / 1700, seed, 4) * t.hills + fbm2bl(x / 330, z / 330, seed + 5, 4, 330, sp) * t.hills * 0.35;
    h += fbm2bl(x / 38, z / 38, seed + 9, 4, 38, sp) * t.bumps;
    if (r < 450 && sp < 2.5) h += fbm2bl(x / 3.5, z / 3.5, seed + 13, 3, 3.5, sp) * t.grit * smooth(400, 40, r);

    const list = buckets.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (list) {
      for (const c of list) {
        const dx = x - c.x;
        const dz = z - c.z;
        const d2 = dx * dx + dz * dz;
        const lim = c.r * 2.2;
        if (d2 > lim * lim) continue;
        const vis = smooth(sp, sp * 2.5, c.r); // craters too small for the mesh here fade out
        if (vis <= 0) continue;
        const q = Math.sqrt(d2) / c.r;
        const bowl = q < 1 ? Math.max(q * q - 1, -0.8) : 0;
        const rw = Math.sqrt(0.04 + ((0.6 * sp) / c.r) ** 2); // rim at least as wide as the mesh, same volume
        const rim = 0.32 * (0.2 / rw) * Math.exp(-(((q - 1) / rw) ** 2));
        const ejecta = q > 1 ? 0.08 * Math.exp(-(q - 1) / 0.35) : 0;
        h += c.depth * (bowl + rim + ejecta) * vis;
      }
    }

    if (t.dunes && dune) {
      // the mesh carries dunes only where its rings are close enough; the ground shader draws them beyond
      const band = smooth(t.dunes.from * 0.7, t.dunes.from, r) * (1 - smooth(t.dunes.to * 0.8, t.dunes.to, r)) * (1 - smooth(t.dunes.wavelength * 0.25, t.dunes.wavelength * 0.5, sp));
      if (band > 0) {
        const warp = noise2(x / (t.dunes.wavelength * 6), z / (t.dunes.wavelength * 6), seed + 21) * 1.5;
        const ph = (x * dune.c + z * dune.s) / t.dunes.wavelength + warp;
        const crest = Math.pow(1 - Math.abs(Math.sin(Math.PI * ph)), 1.6);
        h += t.dunes.amplitude * crest * band * (0.6 + 0.4 * noise2(x / 200, z / 200, seed + 23));
      }
    }

    if (t.ridges && ridge) {
      const perp = (-x * ridge.s + z * ridge.c) / t.ridges.spacing + noise2(x / 300, z / 300, seed + 31) * 0.35;
      const f = perp - Math.floor(perp) - 0.5;
      // crest and groove widened to the mesh spacing (same volume), so they never alias into zigzags
      const s1 = (0.5 * sp) / t.ridges.spacing;
      const w1 = Math.sqrt(0.01 + s1 * s1);
      const w2 = Math.sqrt(0.000625 + s1 * s1);
      const crest = (0.1 / w1) * Math.exp(-((f / w1) ** 2)) - 0.7 * (0.025 / w2) * Math.exp(-((f / w2) ** 2));
      h += t.ridges.amplitude * crest * (0.6 + 0.4 * noise2(x / 120, z / 120, seed + 33));
    }

    if (basin) {
      const d = Math.hypot(x - basin.x, z - basin.z) + noise2(x / 250, z / 250, seed + 61) * 120;
      h -= basin.depth * smooth(basin.r, basin.r * 0.965, d);
    }
    return h;
  };

  // Mountains and mesas. Their noise is limited to what the finest skyline rings can sample (0.16 degrees
  // around, 30 m between rings): finer octaves only made the crests zigzag between neighbouring vertices.
  const relief = (x: number, z: number): number => {
    const r = Math.sqrt(x * x + z * z);
    let h = 0;
    if (t.mountains && r > t.mountains.distance - 2200) {
      const m = t.mountains;
      const azDeg = THREE.MathUtils.radToDeg(Math.atan2(x, -z));
      let da = Math.abs(azDeg - m.azimuthDeg) % 360;
      if (da > 180) da = 360 - da;
      const win = smooth(m.widthDeg / 2, m.widthDeg * 0.25, da);
      if (win > 0 && r > m.distance - 2200) {
        const ramp = smooth(m.distance - 2200, m.distance - 300, r);
        // noise on a circle of azimuth (seamless all the way round; no jump at due south)
        const az = THREE.MathUtils.degToRad(azDeg);
        const ca = Math.cos(az);
        const sa = Math.sin(az);
        const massif = 0.3 + 0.7 * (0.5 + 0.5 * fbm2(ca * 3.2 + r / 1400, sa * 3.2 - r / 1900, seed + 41, 4));
        // eroded crests: ridged multifractal along the skyline and down the faces
        const crest = ridged2(ca * 14 + r / 520, sa * 14 - r / 700, seed + 43, 4);
        const gullies = ridged2(ca * 46 + r / 160, sa * 46 - r / 210, seed + 47, 2);
        const rough = 1 - m.jagged * 0.55 + m.jagged * 0.55 * (0.65 * crest + 0.35 * gullies);
        h += m.height * win * ramp * massif * rough;
      }
    }

    for (const ms of mesas) {
      const mx = x - ms.x;
      const mz = z - ms.z;
      const lim = ms.r * 2.25; // the outline noise moves the edge by at most 0.45 r
      if (mx > lim || mx < -lim || mz > lim || mz < -lim) continue;
      const d0 = Math.sqrt(mx * mx + mz * mz);
      if (d0 > lim) continue;
      // outline, cliff and terraces limited to what the mesh can hold at the mesa's distance (terraces finer
      // than the mesh, or a hard step, turned mesa tops into sawtooth spikes). Seen from the viewer, a mesa's
      // outline against the sky is sampled around the circle, so that spacing is the one that matters.
      const sp = Math.max(0.05, (r * Math.PI * 2) / (SEGMENTS * FINE));
      const d = d0 + fbm2bl(x / 90, z / 90, seed + 51, 3, 90, sp) * ms.r * 0.45;
      if (d < ms.r * 1.8) {
        const cw = Math.max(ms.r * 0.18, sp * 1.5);
        const cliff = smooth(ms.r * 0.99 + cw / 2, ms.r * 0.99 - cw / 2, d);
        const tv = cliff * 3.0 + noise2(x / 50, z / 50, seed + 55) * 0.4;
        const step = Math.floor(tv);
        const terraceW = 1 - smooth(cw / 6, cw / 3, sp);
        const terrace = ((step + smooth(0.6, 1.0, tv - step)) / 3.0) * terraceW + cliff * (1 - terraceW);
        const talus = smooth(ms.r * 1.75, ms.r * 1.0, d) * 0.22;
        h += ms.h * Math.max(cliff * 0.75 + terrace * 0.25, talus) * (0.9 + 0.1 * noise2(x / 40, z / 40, seed + 53));
      }
    }
    return h;
  };

  const local = (x: number, z: number): number => base(x, z) + relief(x, z);

  const curve = 1 / (2 * t.planetRadiusM);
  const at = (x: number, z: number) => local(x, z) - (x * x + z * z) * curve;
  const accent = (x: number, z: number, soft = 0) =>
    smooth(0.15 - soft, 0.4 + soft, fbm2(x / 90, z / 90, seed + 71, 4) * 0.5 + 0.5 - (1 - t.accentAmount) * 0.55);
  return { local, at, accent, relief };
}

// ---------------------------------------------------------------- meshes
const GEO_RINGS = Math.ceil(Math.log(BAND_START / NEAR_R0) / Math.log(GEO_K)) + 1;

function radii(): number[] {
  const out = [0];
  for (let i = 0; i < GEO_RINGS; i++) out.push(Math.min(NEAR_R0 * Math.pow(GEO_K, i), BAND_START));
  for (let r = BAND_START + BAND_STEP; r <= TERRAIN_RADIUS + 1e-6; r += BAND_STEP) out.push(r);
  return out;
}

/** Fractional ring index of a radius (inverse of radii()). */
function ringIndex(r: number): number {
  if (r <= NEAR_R0) return r / NEAR_R0; // between the centre (0) and the first ring (1)
  if (r <= BAND_START) return 1 + Math.log(r / NEAR_R0) / Math.log(GEO_K);
  return GEO_RINGS + (r - BAND_START) / BAND_STEP;
}

const mix3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Polar grid geometry; `height` gives y for each (x, z). */
function polarGrid(rings: number[], segments: number, height: (x: number, z: number) => number) {
  const count = 1 + (rings.length - 1) * segments;
  const pos = new Float32Array(count * 3);
  pos[1] = height(0, 0);
  let v = 1;
  for (let i = 1; i < rings.length; i++) {
    const r = rings[i];
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos[v * 3] = x;
      pos[v * 3 + 1] = height(x, z);
      pos[v * 3 + 2] = z;
      v++;
    }
  }
  const idx = new Uint32Array(segments * 3 + (rings.length - 2) * segments * 6);
  let k = 0;
  for (let j = 0; j < segments; j++) {
    idx[k++] = 0;
    idx[k++] = 1 + ((j + 1) % segments);
    idx[k++] = 1 + j;
  }
  for (let i = 1; i < rings.length - 1; i++) {
    const a0 = 1 + (i - 1) * segments;
    const b0 = 1 + i * segments;
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments;
      idx[k++] = a0 + j;
      idx[k++] = a0 + j1;
      idx[k++] = b0 + j;
      idx[k++] = a0 + j1;
      idx[k++] = b0 + j1;
      idx[k++] = b0 + j;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** How far apart neighbouring vertices of the (coarse) ground grid are at radius r, in metres. Height detail
 * finer than this can't be shown by the mesh: it only turns into random spikes (zigzag patterns), so every
 * term of the height field is limited to it (the pixel shader adds the fine detail instead). */
export const MESH_SPACING = { geo: GEO_K - 1, band: BAND_STEP, seg: (Math.PI * 2) / SEGMENTS };
function meshSpacing(r: number): number {
  return Math.max(0.05, Math.min(r * MESH_SPACING.geo, BAND_STEP), r * MESH_SPACING.seg);
}

/** computeVertexNormals for an indexed geometry (same result: area-weighted face normals), working on the
 * typed arrays directly, which is several times faster for meshes of this size. */
function fastNormals(g: THREE.BufferGeometry) {
  const pos = (g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const idx = (g.getIndex() as THREE.BufferAttribute).array as Uint32Array;
  const nor = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    const cbx = pos[c] - pos[b];
    const cby = pos[c + 1] - pos[b + 1];
    const cbz = pos[c + 2] - pos[b + 2];
    const abx = pos[a] - pos[b];
    const aby = pos[a + 1] - pos[b + 1];
    const abz = pos[a + 2] - pos[b + 2];
    const nx = cby * abz - cbz * aby;
    const ny = cbz * abx - cbx * abz;
    const nz = cbx * aby - cby * abx;
    nor[a] += nx;
    nor[a + 1] += ny;
    nor[a + 2] += nz;
    nor[b] += nx;
    nor[b + 1] += ny;
    nor[b + 2] += nz;
    nor[c] += nx;
    nor[c + 1] += ny;
    nor[c + 2] += nz;
  }
  for (let i = 0; i < nor.length; i += 3) {
    const l = Math.sqrt(nor[i] * nor[i] + nor[i + 1] * nor[i + 1] + nor[i + 2] * nor[i + 2]) || 1;
    nor[i] /= l;
    nor[i + 1] /= l;
    nor[i + 2] /= l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
}

/** Catmull-Rom through p1..p2 (p0, p3 are the neighbours), t in 0..1. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t2 * t);
}

/**
 * The render mesh: the coarse polar grid with its outer rings resampled FINE times more densely around the
 * circle, stitched to the inner rings. Mountains and mesas are evaluated exactly at the new vertices; the
 * smooth rest of the ground follows a curve through the original samples; colours are interpolated.
 */
function refineSkyline(coarse: THREE.BufferGeometry, rings: number[], relief: (x: number, z: number) => number): THREE.BufferGeometry {
  if (FINE <= 1) return coarse;
  const S = SEGMENTS;
  const F = S * FINE;
  const first = rings.findIndex((r) => r >= FINE_FROM); // first refined ring (index into rings; 0 = centre)
  if (first < 2) return coarse;
  const inner = first - 1;                // plain rings 1..inner
  const outer = rings.length - first;     // refined rings
  const cPos = (coarse.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const cCol = (coarse.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
  const plain = 1 + inner * S;
  const count = plain + outer * F;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  pos.set(cPos.subarray(0, plain * 3));
  col.set(cCol.subarray(0, plain * 3));
  const smoothY = new Float32Array(S);
  for (let o = 0; o < outer; o++) {
    const ring = first + o;
    const r = rings[ring];
    const cb = 1 + (ring - 1) * S; // this ring in the coarse grid
    const fb = plain + o * F;
    // the ring's samples without mountains and mesas: smooth enough to interpolate
    for (let j = 0; j < S; j++) {
      const v = (cb + j) * 3;
      smoothY[j] = cPos[v + 1] - relief(cPos[v], cPos[v + 2]);
    }
    for (let k = 0; k < F; k++) {
      const j = Math.floor(k / FINE);
      const t = (k % FINE) / FINE;
      const a = (k / F) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const v = (fb + k) * 3;
      pos[v] = x;
      pos[v + 1] = catmullRom(smoothY[(j + S - 1) % S], smoothY[j], smoothY[(j + 1) % S], smoothY[(j + 2) % S], t) + relief(x, z);
      pos[v + 2] = z;
      const c0 = (cb + j) * 3;
      const c1 = (cb + ((j + 1) % S)) * 3;
      for (let c = 0; c < 3; c++) col[v + c] = cCol[c0 + c] * (1 - t) + cCol[c1 + c] * t;
    }
  }
  // triangles: centre fan, plain quads, a stitch ring (S -> F), refined quads (same winding as polarGrid)
  const idx = new Uint32Array(S * 3 + (inner - 1) * S * 6 + S * (FINE + 1) * 3 + (outer - 1) * F * 6);
  let n = 0;
  for (let j = 0; j < S; j++) {
    idx[n++] = 0;
    idx[n++] = 1 + ((j + 1) % S);
    idx[n++] = 1 + j;
  }
  for (let i = 1; i < inner; i++) {
    const a0 = 1 + (i - 1) * S;
    const b0 = 1 + i * S;
    for (let j = 0; j < S; j++) {
      const j1 = (j + 1) % S;
      idx[n++] = a0 + j;
      idx[n++] = a0 + j1;
      idx[n++] = b0 + j;
      idx[n++] = a0 + j1;
      idx[n++] = b0 + j1;
      idx[n++] = b0 + j;
    }
  }
  {
    const a0 = 1 + (inner - 1) * S;
    const b0 = plain;
    const half = Math.floor(FINE / 2);
    for (let j = 0; j < S; j++) {
      const A0 = a0 + j;
      const A1 = a0 + ((j + 1) % S);
      const o = (m: number) => b0 + ((j * FINE + m) % F);
      for (let m = 0; m < half; m++) {
        idx[n++] = A0;
        idx[n++] = o(m + 1);
        idx[n++] = o(m);
      }
      idx[n++] = A0;
      idx[n++] = A1;
      idx[n++] = o(half);
      for (let m = half; m < FINE; m++) {
        idx[n++] = A1;
        idx[n++] = o(m + 1);
        idx[n++] = o(m);
      }
    }
  }
  for (let q = 0; q < outer - 1; q++) {
    const a0 = plain + q * F;
    const b0 = plain + (q + 1) * F;
    for (let k = 0; k < F; k++) {
      const k1 = (k + 1) % F;
      idx[n++] = a0 + k;
      idx[n++] = a0 + k1;
      idx[n++] = b0 + k;
      idx[n++] = a0 + k1;
      idx[n++] = b0 + k1;
      idx[n++] = b0 + k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  fastNormals(g);
  g.computeBoundingSphere();
  return g;
}

/** Height of the ground mesh at (x, z), by bilinear interpolation between its rings and segments. */
function meshHeight(pos: Float32Array, rings: number, x: number, z: number): number {
  const r = Math.sqrt(x * x + z * z);
  const fi = Math.min(ringIndex(r), rings - 1);
  let a = Math.atan2(z, x);
  if (a < 0) a += Math.PI * 2;
  const fj = (a / (Math.PI * 2)) * SEGMENTS;
  const jf = Math.floor(fj);
  const j0 = jf % SEGMENTS;
  const j1 = (j0 + 1) % SEGMENTS;
  const tj = fj - jf;
  const i0 = Math.floor(fi);
  const i1 = Math.min(i0 + 1, rings - 1);
  const ti = fi - i0;
  const b0 = (1 + (i0 - 1) * SEGMENTS) * 3 + 1;
  const b1 = (1 + (i1 - 1) * SEGMENTS) * 3 + 1;
  const h0 = i0 === 0 ? pos[1] : pos[b0 + j0 * 3] * (1 - tj) + pos[b0 + j1 * 3] * tj;
  const h1 = i1 === 0 ? pos[1] : pos[b1 + j0 * 3] * (1 - tj) + pos[b1 + j1 * 3] * tj;
  return h0 * (1 - ti) + h1 * ti;
}

function heightMap(pos: Float32Array, rings: number, size: number, half: number): THREE.DataTexture {
  const data = new Uint16Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wx = ((x + 0.5) / size * 2 - 1) * half;
      const wz = ((y + 0.5) / size * 2 - 1) * half;
      data[y * size + x] = THREE.DataUtils.toHalfFloat(meshHeight(pos, rings, wx, wz));
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- rocks
/**
 * A boulder: a finely subdivided sphere with shared vertices (smooth normals), shaped by 3D noise,
 * with a few planar cuts that leave flat fractured faces, and a flattened base that sits in the ground.
 */
function rockGeometry(seed: number, rounded: boolean): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 4);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const rnd = mulberry32(seed * 7919 + 3);
  const cuts = rounded
    ? []
    : Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => {
        const n = new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.4 - 0.2, rnd() * 2 - 1).normalize();
        return { n, d: 0.55 + rnd() * 0.3 };
      });
  const stretch = new THREE.Vector3(0.8 + rnd() * 0.5, 0.6 + rnd() * 0.35, 0.8 + rnd() * 0.5);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize();
    const big = fbm3(p.x * 1.2 + seed, p.y * 1.2, p.z * 1.2, seed, 3);
    const fine = fbm3(p.x * 4.5, p.y * 4.5 + seed, p.z * 4.5, seed + 5, 4);
    const crag = 1 - Math.abs(noise3(p.x * 3.1, p.y * 3.1, p.z * 3.1 + seed, seed + 9));
    const r = rounded ? 1 + 0.12 * big + 0.03 * fine : 1 + 0.26 * big + 0.07 * fine + 0.06 * crag * crag;
    p.multiplyScalar(r).multiply(stretch);
    for (const c of cuts) {
      const s = p.dot(c.n);
      if (s > c.d) p.addScaledVector(c.n, -(s - c.d) * 0.92);
    }
    if (p.y < -0.3) p.y = -0.3 + (p.y + 0.3) * 0.25; // base settles into the ground
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- terrain bundle
export interface RockSet {
  geometry: THREE.BufferGeometry;
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
}

export interface Terrain {
  ground: THREE.BufferGeometry;
  liquid: THREE.BufferGeometry | null;
  rocks: RockSet[];
  eye: number;                 // ground height under the viewer
  nearMap: THREE.DataTexture;  // heights within NEAR_MAP_HALF of the viewer
  midMap: THREE.DataTexture;   // heights within MID_MAP_HALF
  farMap: THREE.DataTexture;   // heights out to the edge of the terrain
}

const cache = new Map<string, Terrain>();

export function buildTerrain(key: string, t: TerrainSpec): Terrain {
  const hit = cache.get(key);
  if (hit) return hit;
  const field = makeHeightField(t);
  // a sea (if any) sits just below the ground under the viewer, so you always stand on its shore
  const liquidLevel = t.liquid ? field.local(0, 0) + t.liquid.level : 0;
  const rings = radii();
  const coarse = polarGrid(rings, SEGMENTS, field.at);
  fastNormals(coarse);
  const ground = coarse; // refined below, once it has colours

  // colours: height bands, accent patches, darker steep slopes, large-scale variation, wet shores
  const pos = ground.getAttribute('position') as THREE.BufferAttribute;
  const nor = ground.getAttribute('normal') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const { low, mid, high, accent } = t.palette;
  const span = Math.max(t.hills, 4);
  const curveK = 1 / (2 * t.planetRadiusM);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const hl = pos.getY(i) + (x * x + z * z) * curveK; // = field.local(x, z), without evaluating it again
    const tH = Math.min(Math.max((hl / span) * 0.5 + 0.5, 0), 1);
    let c = tH < 0.5 ? mix3(low, mid, tH * 2) : mix3(mid, high, (tH - 0.5) * 2);
    // vertex colours can't hold detail finer than the mesh: fade small-scale variation where rings are far
    // apart (otherwise it shows as stripes and zigzag patch edges along the rings)
    const sp = meshSpacing(Math.sqrt(x * x + z * z));
    c = mix3(c, accent, field.accent(x, z, Math.min(0.25, sp / 120)) * 0.85);
    const wide = fbm2(x / 260, z / 260, t.seed + 91, 3);
    c = mix3(c, wide > 0 ? high : low, Math.abs(wide) * 0.45);
    if (t.liquid) c = mix3(c, mix3(low, accent, 0.5), smooth(liquidLevel + 1.2, liquidLevel + 0.1, hl) * 0.8);
    const slope = 1 - nor.getY(i);
    c = mix3(c, mix3(accent, low, 0.5), smooth(0.08, 0.4, slope) * 0.6);
    const v = 1 + 0.08 * noise2(x / 7, z / 7, t.seed + 3) * (1 - smooth(2, 7, sp));
    colors[i * 3] = c[0] * v;
    colors[i * 3 + 1] = c[1] * v;
    colors[i * 3 + 2] = c[2] * v;
  }
  coarse.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  coarse.computeBoundingSphere();
  const renderGround = refineSkyline(coarse, rings, field.relief);

  const posArray = pos.array as Float32Array; // height maps sample the coarse grid
  const nearMap = heightMap(posArray, rings.length, NEAR_MAP_SIZE, NEAR_MAP_HALF);
  const midMap = heightMap(posArray, rings.length, MID_MAP_SIZE, MID_MAP_HALF);
  const farMap = heightMap(posArray, rings.length, FAR_MAP_SIZE, FAR_MAP_HALF);

  let liquid: THREE.BufferGeometry | null = null;
  if (t.liquid) {
    const curve = 1 / (2 * t.planetRadiusM);
    const lr = rings.filter((_, i) => i % 2 === 0);
    liquid = polarGrid(lr, 256, (x, z) => liquidLevel - (x * x + z * z) * curve);
  }

  // rocks: four shapes, scattered densely near the viewer, bedded into the ground
  const VARIANTS = 4;
  const rocks: RockSet[] = Array.from({ length: VARIANTS }, (_, v) => ({
    geometry: rockGeometry(t.seed * 10 + v, !!t.rocks.rounded),
    matrices: [],
    colors: [],
  }));
  const rnd = mulberry32(t.seed + 7);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < t.rocks.count; i++) {
    const r = 2.2 + 170 * Math.pow(rnd(), 2.1);
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = field.at(x, z);
    const variant = Math.floor(rnd() * VARIANTS);
    const size = t.rocks.maxSize * (0.06 + Math.pow(rnd(), 3) * 0.94) * (r < 6 ? 0.5 : 1);
    const shade = 0.75 + rnd() * 0.4;
    e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
    if (t.liquid && field.local(x, z) < liquidLevel + 0.15) continue;
    q.setFromEuler(e);
    const set = rocks[variant];
    set.matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - size * 0.18, z), q, new THREE.Vector3(size, size, size)));
    set.colors.push(new THREE.Color(t.rocks.color[0] * shade, t.rocks.color[1] * shade, t.rocks.color[2] * shade));
  }

  const result: Terrain = { ground: renderGround, liquid, rocks, eye: field.at(0, 0), nearMap, midMap, farMap };
  cache.set(key, result);
  return result;
}

// ---------------------------------------------------------------- detail noise for the ground shader
let detailNoise: THREE.DataTexture | null = null;

/** Four channels of tileable fractal noise (full 0..1 range, linear), sampled at several scales in world space. */
export function groundDetailTexture(): THREE.DataTexture {
  if (detailNoise) return detailNoise;
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  for (let ch = 0; ch < 4; ch++) {
    const vals = new Float32Array(N * N);
    let lo = Infinity;
    let hi = -Infinity;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        // tileable: sample on a torus
        const u = (x / N) * Math.PI * 2;
        const v = (y / N) * Math.PI * 2;
        let s = 0;
        let amp = 0.5;
        let f = 2.2;
        for (let o = 0; o < 5; o++) {
          s += amp * noise3(Math.cos(u) * f, Math.sin(u) * f + Math.cos(v) * f * 0.7, Math.sin(v) * f, 400 + ch * 31 + o);
          f *= 2.03;
          amp *= 0.5;
        }
        vals[y * N + x] = s;
        lo = Math.min(lo, s);
        hi = Math.max(hi, s);
      }
    }
    for (let i = 0; i < N * N; i++) data[i * 4 + ch] = Math.round(((vals[i] - lo) / (hi - lo)) * 255);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  detailNoise = tex;
  return tex;
}

// ---------------------------------------------------------------- procedural moon surfaces
/** Equirectangular texture for bodies without a photo map (Charon, Phobos). */
export function proceduralBodyTexture(kind: 'charon' | 'phobos'): THREE.Texture {
  const W = 512;
  const H = 256;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const lat = (y / H - 0.5) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2;
      const px = Math.cos(lat) * Math.cos(lon) * 4;
      const pz = Math.cos(lat) * Math.sin(lon) * 4;
      const py = Math.sin(lat) * 4;
      const n = fbm3(px, py, pz, kind === 'charon' ? 501 : 777, 6) * 0.5 + 0.5;
      const craters = ridged2(px * 2.5 + pz, py * 2.5 - pz, 901, 3);
      let c: number[];
      if (kind === 'charon') {
        // grey icy surface with a dark red-brown north polar cap ("Mordor Macula")
        c = mix3([0.42, 0.42, 0.43], [0.62, 0.61, 0.6], n);
        const cap = smooth(0.95, 1.25, lat + n * 0.25);
        c = mix3(c, [0.34, 0.16, 0.11], cap * 0.85);
      } else {
        c = mix3([0.3, 0.27, 0.24], [0.5, 0.46, 0.41], n);
      }
      const k = 0.85 + 0.3 * craters;
      const i = (y * W + x) * 4;
      data[i] = Math.round(Math.min(c[0] * k, 1) * 255);
      data[i + 1] = Math.round(Math.min(c[1] * k, 1) * 255);
      data[i + 2] = Math.round(Math.min(c[2] * k, 1) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
