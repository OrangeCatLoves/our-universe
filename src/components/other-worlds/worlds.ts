// Scene settings for each world in "Skies of Other Worlds" (facts live in data/otherWorlds.ts).
// Directions use compass azimuth (0 = north, 90 = east, 180 = south, 270 = west) and elevation above
// the horizon, in degrees. Distances are metres; colours are linear RGB.

export type RGB = [number, number, number];

/** Small-scale ground texture: micro-craters, sulfur cracks, wind ripples, ... */
export type SurfaceStyle = 'rock' | 'regolith' | 'sulfur' | 'ice' | 'sand' | 'pebbles';

export interface SunSpec {
  color: RGB;          // colour of its light
  intensity: number;   // directional light strength at full daylight
  disk: number;        // HDR brightness of the visible disk (0 = hidden by haze)
  angularDeg: number;  // apparent diameter
  /** a second star of a binary: trails the primary along the sky path */
  trail?: { phase: number; elevDeg: number };
}

export type Placement =
  | { az: number; el: number }                                        // fixed in the sky
  | { pathPhase: number }                                              // fixed on the Sun's path (eclipses happen)
  | { orbit: { rate: number; maxElDeg: number; reverse?: boolean; phase0: number } } // moves across the sky
  | { followSun: number };                                             // trails the Sun (an evening star)

export interface BodySpec {
  id: string;
  label: string;
  angularDeg: number;
  place: Placement;
  texture?: string;
  procedural?: 'charon' | 'phobos';
  point?: { brightness: number; color: RGB }; // too small to see as a disk: a bright point of light
  rings?: { texture: string; inner: number; outer: number; openDeg: number };
  spinS?: number;  // visual rotation period, seconds
  atmosphere?: RGB; // glow along the sunlit edge
  shine?: number;  // fraction of sunlight it reflects onto the ground when fully lit (planet-shine)
  shineColor?: RGB;
}

export interface SkySpec {
  kind: 'airless' | 'air' | 'haze';
  zenith: RGB;
  horizon: RGB;
  night: RGB;
  glow: RGB;          // light scattered close around the Sun
  glowWidth: number;  // radians
  twilight: RGB;      // colour along the horizon near a low Sun
  brightness: number;
  extinction: RGB;    // how strongly the air dims and colours low sunlight (0 = none)
  starsDay: number;   // star visibility in daylight
  stars: number;
  milkyWay: number;
  hazeBands?: { color: RGB; strength: number };
}

export interface TerrainSpec {
  seed: number;
  surface: SurfaceStyle;
  tints?: [RGB, RGB];     // colour patches mixed in by some surface styles (Io: frost, sulfur)
  planetRadiusM: number;
  palette: { low: RGB; mid: RGB; high: RGB; accent: RGB };
  accentAmount: number;   // how much of the ground gets the accent colour
  hills: number;          // large relief (m)
  bumps: number;          // medium relief (m)
  grit: number;           // small relief near the viewer (m)
  craters?: { count: number; maxRadius: number; depth: number };
  dunes?: { amplitude: number; wavelength: number; directionDeg: number; from: number; to: number };
  mountains?: { height: number; azimuthDeg: number; widthDeg: number; distance: number; jagged: number };
  mesas?: { count: number; height: number; azimuthDeg: number; spreadDeg: number };
  ridges?: { amplitude: number; spacing: number; directionDeg: number };
  basin?: { azimuthDeg: number; distance: number; radius: number; depth: number };
  liquid?: { level: number; color: RGB; roughness: number; kind: 'methane' | 'ice' };
  rocks: { count: number; color: RGB; maxSize: number; rounded?: boolean };
  roughness: number;
}

export interface WorldSpec {
  sky: SkySpec;
  suns: SunSpec[];
  sunPath: { maxElevDeg: number; azimuthDeg: number; fixed?: { az: number; el: number } };
  bodies: BodySpec[];
  terrain: TerrainSpec;
  fog?: number;                                  // exponential fog density (per metre)
  ambient: { day: number; night: number };
  effects?: {
    plume?: { az: number; distance: number; heightDeg: number; widthDeg: number; color: RGB };
    geysers?: { az: number; distance: number; count: number; heightDeg: number; spreadDeg: number; color: RGB };
    flares?: { everyS: number; durationS: number; boost: number };
  };
  camera: { az: number; el: number; fov: number; focus?: string }; // focus: what a narrow portrait view centres on
  time: { start: number; periodS: number };
  post: { exposure: number; bloom: number; bloomThreshold: number; saturation: number; contrast: number; vignette: number; grain: number };
}

const SPACE: Pick<SkySpec, 'zenith' | 'horizon' | 'night' | 'twilight' | 'brightness' | 'extinction'> = {
  zenith: [0, 0, 0],
  horizon: [0, 0, 0],
  night: [0, 0, 0],
  twilight: [0, 0, 0],
  brightness: 0,
  extinction: [0, 0, 0],
};

export const worlds: Record<string, WorldSpec> = {
  moon: {
    sky: { kind: 'airless', ...SPACE, glow: [1, 0.97, 0.92], glowWidth: 0.025, starsDay: 0.75, stars: 1, milkyWay: 0.7 },
    suns: [{ color: [1, 0.97, 0.92], intensity: 4.2, disk: 90, angularDeg: 0.53 }],
    sunPath: { maxElevDeg: 40, azimuthDeg: 0 },
    bodies: [
      { id: 'earth', label: 'Earth', angularDeg: 1.9, place: { az: 205, el: 15 }, texture: '/textures/cosmic-scale/earth.jpg', spinS: 240, shine: 0.002, shineColor: [0.75, 0.85, 1.0], atmosphere: [0.35, 0.6, 1.0] },
    ],
    terrain: {
      seed: 11, surface: 'regolith', planetRadiusM: 1.737e6,
      palette: { low: [0.25, 0.245, 0.235], mid: [0.4, 0.39, 0.375], high: [0.56, 0.55, 0.53], accent: [0.19, 0.19, 0.2] },
      accentAmount: 0.35, hills: 28, bumps: 3, grit: 0.25,
      craters: { count: 150, maxRadius: 140, depth: 0.22 },
      mountains: { height: 340, azimuthDeg: 160, widthDeg: 120, distance: 5600, jagged: 0.04 },
      rocks: { count: 280, color: [0.36, 0.355, 0.345], maxSize: 1.5 },
      roughness: 0.95,
    },
    ambient: { day: 0.006, night: 0.003 },
    camera: { az: 204, el: 8, fov: 46, focus: 'earth' },
    time: { start: 0.325, periodS: 120 },
    post: { exposure: 1.0, bloom: 0.5, bloomThreshold: 1.2, saturation: 1.0, contrast: 1.06, vignette: 0.32, grain: 0.025 },
  },

  mars: {
    sky: {
      kind: 'air', zenith: [0.3, 0.17, 0.09], horizon: [0.8, 0.5, 0.3], night: [0.004, 0.004, 0.008],
      glow: [0.35, 0.58, 1.0], glowWidth: 0.2, twilight: [0.28, 0.4, 0.72], brightness: 0.42,
      extinction: [0.22, 0.28, 0.36], starsDay: 0, stars: 1, milkyWay: 0.45,
    },
    suns: [{ color: [1, 0.94, 0.86], intensity: 3.2, disk: 60, angularDeg: 0.35 }],
    sunPath: { maxElevDeg: 55, azimuthDeg: 0 },
    bodies: [
      { id: 'phobos', label: 'Phobos', angularDeg: 0.2, place: { orbit: { rate: 2.2, maxElDeg: 38, reverse: true, phase0: 0.62 } }, procedural: 'phobos' },
      { id: 'deimos', label: 'Deimos', angularDeg: 0.03, place: { orbit: { rate: 0.27, maxElDeg: 42, phase0: 0.55 } }, point: { brightness: 2.5, color: [1, 0.94, 0.86] } },
      { id: 'earth', label: 'Earth', angularDeg: 0.02, place: { followSun: 0.42 }, point: { brightness: 8, color: [0.72, 0.84, 1.0] } },
    ],
    terrain: {
      seed: 23, surface: 'sand', planetRadiusM: 3.39e6,
      palette: { low: [0.42, 0.21, 0.1], mid: [0.6, 0.34, 0.18], high: [0.72, 0.47, 0.31], accent: [0.2, 0.11, 0.07] },
      accentAmount: 0.3, hills: 18, bumps: 3, grit: 0.3,
      craters: { count: 24, maxRadius: 70, depth: 0.18 },
      dunes: { amplitude: 1.6, wavelength: 9, directionDeg: 40, from: 60, to: 700 },
      mountains: { height: 700, azimuthDeg: 232, widthDeg: 75, distance: 5300, jagged: 0.45 },
      rocks: { count: 320, color: [0.3, 0.16, 0.09], maxSize: 1.25 },
      roughness: 0.92,
    },
    fog: 0.00011,
    ambient: { day: 0.45, night: 0.02 },
    camera: { az: 262, el: 5, fov: 62, focus: 'sun0' },
    time: { start: 0.733, periodS: 110 },
    post: { exposure: 1.05, bloom: 0.7, bloomThreshold: 1.3, saturation: 1.1, contrast: 1.05, vignette: 0.32, grain: 0.03 },
  },

  io: {
    sky: { kind: 'airless', ...SPACE, glow: [1, 1, 0.95], glowWidth: 0.02, starsDay: 0.6, stars: 1, milkyWay: 0.55 },
    suns: [{ color: [1, 0.97, 0.92], intensity: 3.2, disk: 70, angularDeg: 0.12 }],
    sunPath: { maxElevDeg: 50, azimuthDeg: 0 },
    bodies: [
      { id: 'jupiter', label: 'Jupiter', angularDeg: 18.8, place: { pathPhase: 0.665 }, texture: '/textures/cosmic-scale/jupiter.jpg', spinS: 300, shine: 0.045, shineColor: [1.0, 0.78, 0.52], atmosphere: [0.5, 0.42, 0.32] },
    ],
    terrain: {
      seed: 37, surface: 'sulfur', tints: [[1.22, 1.18, 1.02], [1.15, 0.72, 0.42]], planetRadiusM: 1.82e6,
      palette: { low: [0.55, 0.38, 0.14], mid: [0.84, 0.7, 0.3], high: [0.72, 0.58, 0.36], accent: [0.07, 0.055, 0.045] },
      accentAmount: 0.32, hills: 22, bumps: 2.2, grit: 0.2,
      mountains: { height: 950, azimuthDeg: 250, widthDeg: 40, distance: 5400, jagged: 0.2 },
      rocks: { count: 130, color: [0.42, 0.32, 0.14], maxSize: 1.1 },
      roughness: 0.9,
    },
    ambient: { day: 0.008, night: 0.004 },
    effects: { plume: { az: 200, distance: 7400, heightDeg: 10, widthDeg: 17, color: [0.62, 0.74, 1.0] } },
    camera: { az: 233, el: 11, fov: 66, focus: 'jupiter' },
    time: { start: 0.42, periodS: 130 },
    post: { exposure: 1.0, bloom: 0.55, bloomThreshold: 1.2, saturation: 1.08, contrast: 1.05, vignette: 0.32, grain: 0.025 },
  },

  enceladus: {
    sky: { kind: 'airless', ...SPACE, glow: [1, 0.98, 0.95], glowWidth: 0.02, starsDay: 0.6, stars: 1, milkyWay: 0.55 },
    suns: [{ color: [1, 0.97, 0.93], intensity: 3.4, disk: 60, angularDeg: 0.1 }],
    sunPath: { maxElevDeg: 32, azimuthDeg: 0 },
    bodies: [
      {
        id: 'saturn', label: 'Saturn', angularDeg: 28, place: { pathPhase: 0.6 }, texture: '/textures/cosmic-scale/saturn.jpg', spinS: 420, shine: 0.06, shineColor: [1.0, 0.88, 0.68], atmosphere: [0.5, 0.45, 0.32],
        rings: { texture: '/textures/cosmic-scale/saturn-rings.jpg', inner: 1.24, outer: 2.27, openDeg: 0.25 },
      },
    ],
    terrain: {
      seed: 41, surface: 'ice', planetRadiusM: 2.52e5,
      palette: { low: [0.6, 0.7, 0.82], mid: [0.85, 0.9, 0.95], high: [0.97, 0.98, 1.0], accent: [0.42, 0.6, 0.78] },
      accentAmount: 0.2, hills: 9, bumps: 1.6, grit: 0.15,
      craters: { count: 12, maxRadius: 50, depth: 0.15 },
      ridges: { amplitude: 7, spacing: 160, directionDeg: 25 },
      rocks: { count: 170, color: [0.78, 0.84, 0.92], maxSize: 1.0 },
      roughness: 0.6,
    },
    ambient: { day: 0.012, night: 0.004 },
    effects: { geysers: { az: 188, distance: 4200, count: 5, heightDeg: 17, spreadDeg: 34, color: [0.78, 0.88, 1.0] } },
    camera: { az: 214, el: 14, fov: 68, focus: 'saturn' },
    time: { start: 0.45, periodS: 130 },
    post: { exposure: 0.95, bloom: 0.5, bloomThreshold: 1.3, saturation: 1.05, contrast: 1.06, vignette: 0.32, grain: 0.025 },
  },

  titan: {
    sky: {
      kind: 'haze', zenith: [0.22, 0.11, 0.035], horizon: [0.62, 0.36, 0.13], night: [0.012, 0.006, 0.002],
      glow: [0.95, 0.6, 0.24], glowWidth: 0.75, twilight: [0.5, 0.24, 0.08], brightness: 0.42,
      extinction: [0.5, 0.8, 1.3], starsDay: 0, stars: 0, milkyWay: 0,
    },
    suns: [{ color: [1, 0.72, 0.42], intensity: 0.9, disk: 0, angularDeg: 0.06 }],
    sunPath: { maxElevDeg: 58, azimuthDeg: 0 },
    bodies: [],
    terrain: {
      seed: 53, surface: 'pebbles', planetRadiusM: 2.575e6,
      palette: { low: [0.16, 0.11, 0.06], mid: [0.28, 0.19, 0.1], high: [0.4, 0.28, 0.15], accent: [0.1, 0.07, 0.04] },
      accentAmount: 0.25, hills: 6, bumps: 1.2, grit: 0.12,
      dunes: { amplitude: 7, wavelength: 70, directionDeg: 80, from: 1500, to: 6000 },
      basin: { azimuthDeg: 240, distance: 22, radius: 2600, depth: 14 },
      liquid: { level: -1.8, color: [0.025, 0.016, 0.008], roughness: 0.08, kind: 'methane' },
      rocks: { count: 300, color: [0.34, 0.28, 0.22], maxSize: 0.45, rounded: true },
      roughness: 0.85,
    },
    fog: 0.0009,
    ambient: { day: 0.95, night: 0.03 },
    camera: { az: 276, el: -1, fov: 62 },
    time: { start: 0.42, periodS: 150 },
    post: { exposure: 1.15, bloom: 0.45, bloomThreshold: 1.5, saturation: 1.05, contrast: 1.04, vignette: 0.38, grain: 0.035 },
  },

  pluto: {
    sky: {
      kind: 'airless', ...SPACE, glow: [1, 0.98, 0.95], glowWidth: 0.015, starsDay: 0.9, stars: 1, milkyWay: 0.65,
      hazeBands: { color: [0.32, 0.55, 1.0], strength: 0.05 },
    },
    suns: [{ color: [1, 0.98, 0.95], intensity: 1.9, disk: 900, angularDeg: 0.05 }],
    sunPath: { maxElevDeg: 34, azimuthDeg: 0 },
    bodies: [
      { id: 'charon', label: 'Charon', angularDeg: 3.54, place: { az: 212, el: 21 }, procedural: 'charon', shine: 0.004, shineColor: [0.85, 0.85, 0.88] },
    ],
    terrain: {
      seed: 67, surface: 'ice', planetRadiusM: 1.188e6,
      palette: { low: [0.8, 0.77, 0.72], mid: [0.92, 0.9, 0.86], high: [0.74, 0.62, 0.54], accent: [0.5, 0.3, 0.2] },
      accentAmount: 0.18, hills: 5, bumps: 0.8, grit: 0.1,
      mountains: { height: 1250, azimuthDeg: 232, widthDeg: 80, distance: 5600, jagged: 0.6 },
      rocks: { count: 90, color: [0.72, 0.7, 0.68], maxSize: 1.3 },
      roughness: 0.7,
    },
    ambient: { day: 0.01, night: 0.004 },
    camera: { az: 205, el: 9, fov: 64, focus: 'charon' },
    time: { start: 0.36, periodS: 130 },
    post: { exposure: 1.0, bloom: 0.55, bloomThreshold: 1.2, saturation: 1.05, contrast: 1.05, vignette: 0.34, grain: 0.03 },
  },

  'proxima-b': {
    sky: {
      kind: 'air', zenith: [0.05, 0.028, 0.08], horizon: [0.62, 0.22, 0.08], night: [0.004, 0.003, 0.006],
      glow: [1, 0.45, 0.18], glowWidth: 0.35, twilight: [0.75, 0.26, 0.1], brightness: 0.8,
      extinction: [0.1, 0.25, 0.5], starsDay: 0.5, stars: 1, milkyWay: 0.55,
    },
    suns: [{ color: [1, 0.48, 0.24], intensity: 2.4, disk: 40, angularDeg: 1.68 }],
    sunPath: { maxElevDeg: 30, azimuthDeg: 0, fixed: { az: 270, el: 3 } },
    bodies: [
      { id: 'alpha-a', label: 'Alpha Centauri A & B', angularDeg: 0.02, place: { az: 102, el: 42 }, point: { brightness: 14, color: [1, 0.95, 0.85] } },
      { id: 'alpha-b', label: '', angularDeg: 0.02, place: { az: 102.35, el: 42.2 }, point: { brightness: 6, color: [1, 0.8, 0.6] } },
    ],
    terrain: {
      seed: 79, surface: 'rock', planetRadiusM: 7.2e6,
      palette: { low: [0.15, 0.13, 0.13], mid: [0.27, 0.23, 0.21], high: [0.4, 0.36, 0.33], accent: [0.6, 0.62, 0.68] },
      accentAmount: 0.25, hills: 15, bumps: 2, grit: 0.25,
      basin: { azimuthDeg: 245, distance: 60, radius: 2600, depth: 10 },
      liquid: { level: -1.6, color: [0.2, 0.23, 0.3], roughness: 0.35, kind: 'ice' },
      rocks: { count: 280, color: [0.2, 0.18, 0.17], maxSize: 1.4 },
      roughness: 0.85,
    },
    fog: 0.00012,
    ambient: { day: 0.22, night: 0.02 },
    effects: { flares: { everyS: 26, durationS: 3.5, boost: 2.2 } },
    camera: { az: 262, el: 5, fov: 62, focus: 'sun0' },
    time: { start: 0.5, periodS: 200 },
    post: { exposure: 1.05, bloom: 0.75, bloomThreshold: 1.2, saturation: 1.08, contrast: 1.05, vignette: 0.34, grain: 0.03 },
  },

  'kepler-16b': {
    sky: {
      kind: 'air', zenith: [0.08, 0.14, 0.4], horizon: [0.75, 0.5, 0.36], night: [0.005, 0.005, 0.01],
      glow: [1, 0.66, 0.38], glowWidth: 0.28, twilight: [1, 0.36, 0.14], brightness: 0.5,
      extinction: [0.12, 0.22, 0.42], starsDay: 0, stars: 1, milkyWay: 0.5,
    },
    suns: [
      { color: [1, 0.8, 0.58], intensity: 3.0, disk: 70, angularDeg: 0.52 },
      { color: [1, 0.48, 0.26], intensity: 0.9, disk: 35, angularDeg: 0.17, trail: { phase: 0.022, elevDeg: 1.2 } },
    ],
    sunPath: { maxElevDeg: 58, azimuthDeg: 0 },
    bodies: [
      { id: 'kepler-16b', label: 'Kepler-16b', angularDeg: 8.5, place: { az: 226, el: 25 }, texture: '/textures/exoplanets/kepler-16b.jpg', spinS: 220, shine: 0.01, shineColor: [1.0, 0.85, 0.7], atmosphere: [0.8, 0.62, 0.45] },
    ],
    terrain: {
      seed: 97, surface: 'sand', planetRadiusM: 5.0e6,
      palette: { low: [0.64, 0.44, 0.28], mid: [0.78, 0.58, 0.4], high: [0.86, 0.7, 0.52], accent: [0.5, 0.25, 0.15] },
      accentAmount: 0.3, hills: 24, bumps: 2.5, grit: 0.25,
      dunes: { amplitude: 2.2, wavelength: 14, directionDeg: 60, from: 40, to: 900 },
      mesas: { count: 9, height: 160, azimuthDeg: 250, spreadDeg: 110 },
      rocks: { count: 210, color: [0.55, 0.32, 0.19], maxSize: 1.6 },
      roughness: 0.92,
    },
    fog: 0.00008,
    ambient: { day: 0.5, night: 0.02 },
    camera: { az: 248, el: 7, fov: 66, focus: 'sun0' },
    time: { start: 0.728, periodS: 100 },
    post: { exposure: 1.05, bloom: 0.7, bloomThreshold: 1.3, saturation: 1.1, contrast: 1.05, vignette: 0.32, grain: 0.03 },
  },
};

export function worldSpec(id: string): WorldSpec {
  return worlds[id] ?? worlds.moon;
}

export const SUN_NAMES: Record<string, string[]> = {
  'proxima-b': ['Proxima Centauri'],
  'kepler-16b': ['Kepler-16 A', 'Kepler-16 B'],
};

/** Things the info panel can point the camera at. */
export function lookTargets(id: string): Array<{ id: string; label: string }> {
  const spec = worldSpec(id);
  const out: Array<{ id: string; label: string }> = [];
  spec.bodies.forEach((b) => b.label && out.push({ id: b.id, label: b.label }));
  spec.suns.forEach((s, i) => s.disk > 0 && out.push({ id: `sun${i}`, label: (SUN_NAMES[id] ?? ['Sun'])[i] ?? 'Sun' }));
  if (spec.effects?.plume) out.push({ id: 'plume', label: 'Volcanic plume' });
  if (spec.effects?.geysers) out.push({ id: 'geysers', label: 'Ice geysers' });
  return out;
}
