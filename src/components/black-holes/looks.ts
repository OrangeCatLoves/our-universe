// Art direction for every black hole: camera, gas, jets, companions, sky and colour grade.
// Units: the Schwarzschild radius (event-horizon radius) = 1. Colours are linear RGB.

export type RGB = [number, number, number];

export interface DiskLook {
  thick?: boolean;        // hot, puffy flow rendered as a volume (Sgr A*, M87*) instead of a thin disk
  brightness: number;     // surface brightness at the inner edge (HDR)
  inner: number;          // inner edge
  outer: number;          // outer edge
  thickness: number;      // half-thickness as a fraction of radius
  opacity: number;        // optical depth of dense gas: high = glowing solid sheet, low = translucent glow
  hot: RGB;               // colour at the inner edge
  cool: RGB;              // colour at the outer edge
  tempFalloff: number;    // how quickly the colour cools outward (<1 = stays hot longer)
  profile: number;        // brightness falloff with radius
  radialScale: number;    // structure frequency across the disk
  azimuthScale: number;   // structure frequency around the orbit (low = long streaks)
  turbulence: number;     // 0 = clean orbital streaks, 1 = billowing clouds
  rings: number;          // concentric banding
  contrast: number;       // >1 = sharper filaments and darker gaps
  doppler: number;        // relativistic beaming strength (0 = symmetric)
  speed: number;          // rotation speed of the inner edge (rad/s)
  flicker?: number;       // outburst flicker (V404 Cygni)
}

export interface JetLook {
  strength: number;
  color: RGB;
  width: number;
  length: number;
  knotSpeed: number;      // speed of the bright plasma knots travelling outward
  counter: number;        // brightness of the receding counter-jet
  precession?: { angleDeg: number; periodS: number };
}

export interface CompanionLook {
  radius: number;
  distance: number;       // from the hole
  color: RGB;
  brightness: number;
  stretch: number;        // tidal stretching toward the hole (1 = round)
  angleDeg?: number;      // fixed position around the hole (when not orbiting)
  orbit?: { periodS: number };   // orbits in front of / behind the hole as seen by the camera
  stream?: { color: RGB; brightness: number; width: number };
}

export interface SkyLook {
  stars: number;
  starDensity: number;
  starTint: RGB;
  milkyWay?: { strength: number; tiltDeg: number; offsetDeg: number };
  diffuse?: { strength: number; color: RGB };   // unresolved starlight
  dust?: number;                                 // dark dust clouds
  filaments?: { strength: number; color: RGB; knots: RGB };
  echoes?: { strength: number; color: RGB };     // expanding light-echo rings
  galaxy?: { strength: number; color: RGB; clusters: number };
  halo?: { strength: number; color: RGB };
}

export interface PostLook {
  exposure: number;
  tone: 'punchy' | 'filmic';   // punchy keeps colours saturated (fire), filmic rolls highlights to white
  bloom: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  bloomRadius: number;
  saturation: number;
  contrast: number;
  lift: RGB;                   // colour of the blacks
  vignette: number;
  grain: number;
}

export interface Look {
  camera: { distance: number; elevationDeg: number; rollDeg: number; fovDeg: number; autoRotate: number; sway?: number };
  disk?: DiskLook;
  jet?: JetLook;
  companion?: CompanionLook;
  hotspot?: { radius: number; orbitRadius: number; periodS: number; color: RGB; brightness: number };
  binary?: boolean;
  gravitationalWaves?: number;
  glow?: { strength: number; color: RGB };
  sky: SkyLook;
  post: PostLook;
}

export const looks: Record<string, Look> = {
  // Classic portrait: thin white-gold disk seen almost edge-on, far side lensed over the top
  'what-is-a-black-hole': {
    camera: { distance: 24, elevationDeg: 4, rollDeg: -3, fovDeg: 46, autoRotate: 0.1 },
    disk: {
      brightness: 4.2, inner: 3, outer: 14, thickness: 0.012, opacity: 3.0,
      hot: [1.0, 0.82, 0.55], cool: [1.0, 0.36, 0.07], tempFalloff: 0.7, profile: 1.9,
      radialScale: 2.2, azimuthScale: 1.1, turbulence: 0.15, rings: 0.55, contrast: 1.5, doppler: 2.2, speed: 0.26,
    },
    sky: { stars: 0.8, starDensity: 1.0, starTint: [1, 1, 1] },
    post: {
      exposure: 1.0, tone: 'filmic', bloom: 0.6, bloomThreshold: 0.6, bloomSmoothing: 0.3, bloomRadius: 0.68,
      saturation: 1.08, contrast: 1.05, lift: [0, 0, 0], vignette: 0.32, grain: 0.03,
    },
  },

  // Dormant: no disk, a Sun-like companion orbits and is bent into an Einstein ring as it passes behind
  'gaia-bh1': {
    camera: { distance: 30, elevationDeg: 6, rollDeg: 0, fovDeg: 50, autoRotate: 0.05 },
    companion: { radius: 1.2, distance: 13, color: [1.0, 0.8, 0.5], brightness: 2.6, stretch: 1.0, orbit: { periodS: 34 } },
    sky: { stars: 1.0, starDensity: 1.4, starTint: [1, 1, 1], milkyWay: { strength: 3.5, tiltDeg: -24, offsetDeg: 0 } },
    post: {
      exposure: 1.0, tone: 'filmic', bloom: 0.8, bloomThreshold: 0.6, bloomSmoothing: 0.3, bloomRadius: 0.8,
      saturation: 1.3, contrast: 1.06, lift: [0.004, 0.005, 0.009], vignette: 0.38, grain: 0.035,
    },
  },

  // Blue supergiant, tidally stretched, feeding a white-blue disk through a glowing stream
  'cygnus-x-1': {
    camera: { distance: 36, elevationDeg: 13, rollDeg: -6, fovDeg: 50, autoRotate: 0, sway: 0.25 },
    disk: {
      brightness: 4.2, inner: 3, outer: 11, thickness: 0.03, opacity: 2.2,
      hot: [0.78, 0.88, 1.0], cool: [0.3, 0.42, 1.0], tempFalloff: 0.8, profile: 1.5,
      radialScale: 1.9, azimuthScale: 1.5, turbulence: 0.35, rings: 0.3, contrast: 1.4, doppler: 1.4, speed: 0.35,
    },
    jet: { strength: 0.2, color: [0.6, 0.75, 1.0], width: 0.8, length: 14, knotSpeed: 3, counter: 0.35 },
    companion: {
      radius: 6.5, distance: 27, angleDeg: -38, color: [0.3, 0.5, 1.0], brightness: 2.6, stretch: 1.18,
      stream: { color: [0.6, 0.75, 1.0], brightness: 1.6, width: 0.9 },
    },
    sky: { stars: 0.8, starDensity: 1.0, starTint: [1, 1, 1] },
    post: {
      exposure: 1.0, tone: 'filmic', bloom: 1.0, bloomThreshold: 0.5, bloomSmoothing: 0.3, bloomRadius: 0.8,
      saturation: 1.22, contrast: 1.04, lift: [0.003, 0.004, 0.01], vignette: 0.32, grain: 0.03,
    },
  },

  // Outburst: flickering disk, wobbling (precessing) jets firing plasma blobs, expanding light-echo rings
  'v404-cygni': {
    camera: { distance: 27, elevationDeg: 16, rollDeg: 5, fovDeg: 50, autoRotate: 0.08 },
    disk: {
      brightness: 3.6, inner: 3, outer: 9.5, thickness: 0.035, opacity: 2.0,
      hot: [1.0, 0.78, 0.92], cool: [0.95, 0.2, 0.42], tempFalloff: 0.8, profile: 1.4,
      radialScale: 2.0, azimuthScale: 1.8, turbulence: 0.5, rings: 0.25, contrast: 1.5, doppler: 1.3, speed: 0.42, flicker: 0.8,
    },
    jet: { strength: 1.0, color: [0.8, 0.62, 1.0], width: 0.6, length: 12, knotSpeed: 6, counter: 0.4, precession: { angleDeg: 22, periodS: 9 } },
    sky: { stars: 0.8, starDensity: 1.1, starTint: [1, 1, 1], echoes: { strength: 0.22, color: [0.55, 0.72, 1.0] } },
    post: {
      exposure: 1.0, tone: 'filmic', bloom: 1.1, bloomThreshold: 0.4, bloomSmoothing: 0.3, bloomRadius: 0.8,
      saturation: 1.15, contrast: 1.05, lift: [0.006, 0.002, 0.008], vignette: 0.36, grain: 0.035,
    },
  },

  // Two black holes spiralling together in front of a dense star field; space itself ripples
  'gw150914': {
    camera: { distance: 22, elevationDeg: 34, rollDeg: 0, fovDeg: 50, autoRotate: 0.04 },
    binary: true,
    gravitationalWaves: 1.0,
    sky: {
      stars: 1.3, starDensity: 3.0, starTint: [1, 1, 1], milkyWay: { strength: 3.0, tiltDeg: 35, offsetDeg: 0 },
      diffuse: { strength: 0.06, color: [0.45, 0.5, 1.0] }, dust: 0.5,
    },
    post: {
      exposure: 1.1, tone: 'filmic', bloom: 0.6, bloomThreshold: 0.7, bloomSmoothing: 0.3, bloomRadius: 0.75,
      saturation: 1.3, contrast: 1.06, lift: [0.003, 0.004, 0.008], vignette: 0.35, grain: 0.03,
    },
  },

  // Heart of the Milky Way: a dim, ruddy, turbulent glow with a flare circling it, in a crowded, dusty sky
  'sagittarius-a-star': {
    camera: { distance: 22, elevationDeg: 28, rollDeg: -10, fovDeg: 44, autoRotate: 0.07 },
    disk: {
      thick: true, brightness: 10, inner: 1.6, outer: 7.5, thickness: 0.3, opacity: 0.8,
      hot: [1.0, 0.42, 0.1], cool: [0.7, 0.1, 0.03], tempFalloff: 0.6, profile: 2.6,
      radialScale: 1.0, azimuthScale: 2.4, turbulence: 0.8, rings: 0, contrast: 1.3, doppler: 2.4, speed: 0.45,
    },
    hotspot: { radius: 0.4, orbitRadius: 4.6, periodS: 11, color: [1.0, 0.8, 0.55], brightness: 2.5 },
    sky: {
      stars: 1.0, starDensity: 2.0, starTint: [1.0, 0.82, 0.66],
      diffuse: { strength: 0.012, color: [1.0, 0.55, 0.3] }, dust: 0.8,
    },
    post: {
      exposure: 1.0, tone: 'punchy', bloom: 0.9, bloomThreshold: 0.35, bloomSmoothing: 0.35, bloomRadius: 0.8,
      saturation: 1.1, contrast: 1.05, lift: [0.006, 0.002, 0.0], vignette: 0.38, grain: 0.035,
    },
  },

  // The jet is the hero: a blue-white beam with travelling knots, an orange ring at its base,
  // inside the soft glow of a giant elliptical galaxy
  'm87-star': {
    camera: { distance: 36, elevationDeg: 22, rollDeg: -24, fovDeg: 50, autoRotate: 0.05 },
    disk: {
      thick: true, brightness: 15, inner: 1.8, outer: 7, thickness: 0.18, opacity: 0.85,
      hot: [1.0, 0.6, 0.25], cool: [0.85, 0.25, 0.06], tempFalloff: 0.7, profile: 2.4,
      radialScale: 1.2, azimuthScale: 2.2, turbulence: 0.6, rings: 0.1, contrast: 1.3, doppler: 2.2, speed: 0.35,
    },
    jet: { strength: 1.6, color: [0.55, 0.72, 1.0], width: 0.7, length: 26, knotSpeed: 7, counter: 0.15 },
    sky: { stars: 0.5, starDensity: 0.8, starTint: [1, 1, 1], galaxy: { strength: 0.5, color: [1.0, 0.82, 0.6], clusters: 1.0 } },
    post: {
      exposure: 1.0, tone: 'filmic', bloom: 1.2, bloomThreshold: 0.35, bloomSmoothing: 0.3, bloomRadius: 0.85,
      saturation: 1.1, contrast: 1.04, lift: [0.004, 0.003, 0.002], vignette: 0.35, grain: 0.03,
    },
  },

  // Quasar: an enormous white-hot turbulent disk, so bright it floods the frame with glare
  'ton-618': {
    camera: { distance: 30, elevationDeg: 9, rollDeg: -9, fovDeg: 50, autoRotate: 0.05 },
    disk: {
      brightness: 6.5, inner: 3, outer: 22, thickness: 0.04, opacity: 1.6,
      hot: [1.0, 0.93, 0.84], cool: [0.8, 0.32, 0.1], tempFalloff: 0.55, profile: 1.8,
      radialScale: 1.1, azimuthScale: 3.0, turbulence: 0.7, rings: 0.2, contrast: 1.35, doppler: 1.3, speed: 0.16,
    },
    glow: { strength: 0.12, color: [1.0, 0.85, 0.65] },
    sky: { stars: 0.4, starDensity: 0.7, starTint: [1, 1, 1], halo: { strength: 0.025, color: [0.55, 0.45, 1.0] } },
    post: {
      exposure: 0.9, tone: 'filmic', bloom: 1.0, bloomThreshold: 0.5, bloomSmoothing: 0.4, bloomRadius: 0.8,
      saturation: 1.0, contrast: 1.05, lift: [0.01, 0.006, 0.003], vignette: 0.42, grain: 0.035,
    },
  },

  // Sheer size: a vast shadow inside the glowing gas filaments of the Phoenix galaxy cluster
  'phoenix-a': {
    camera: { distance: 12.5, elevationDeg: 10, rollDeg: 7, fovDeg: 62, autoRotate: 0.04 },
    disk: {
      brightness: 1.4, inner: 3, outer: 15, thickness: 0.05, opacity: 1.0,
      hot: [0.95, 0.8, 1.0], cool: [0.55, 0.25, 0.75], tempFalloff: 0.7, profile: 1.2,
      radialScale: 1.3, azimuthScale: 2.2, turbulence: 0.6, rings: 0.3, contrast: 1.4, doppler: 1.2, speed: 0.12,
    },
    jet: { strength: 0.35, color: [0.75, 0.6, 1.0], width: 1.0, length: 20, knotSpeed: 3, counter: 0.3 },
    sky: { stars: 0.6, starDensity: 0.9, starTint: [1, 1, 1], filaments: { strength: 0.22, color: [1.0, 0.35, 0.55], knots: [0.45, 0.65, 1.0] } },
    post: {
      exposure: 1.0, tone: 'filmic', bloom: 0.9, bloomThreshold: 0.45, bloomSmoothing: 0.3, bloomRadius: 0.8,
      saturation: 1.15, contrast: 1.05, lift: [0.006, 0.003, 0.008], vignette: 0.38, grain: 0.035,
    },
  },
};

export function lookFor(id: string): Look {
  return looks[id] ?? looks['what-is-a-black-hole'];
}
