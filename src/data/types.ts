// Shared type definitions for celestial objects across all themes

// Base interface for all celestial objects
export interface BaseCelestialObject {
  id: string;
  name: string;
  type: string;
  category: 'sphere' | 'static';
  color: string; // fallback color
  texture?: string; // filename for sphere textures
  image?: string; // filename for static images
  description: string;
  funFacts: string[];
}

// Cosmic Scale theme object (extends base with size and discovery info)
export interface CelestialObject extends BaseCelestialObject {
  sizeKm: number; // diameter in kilometers
  discoveryDate?: string;
  discoveredBy?: string;
}

// Ring system for ringed planets (e.g. J1407b)
export interface PlanetRings {
  texture: string;      // RGBA radial strip in textures/exoplanets/: x = inner edge -> outer edge
  innerRadius: number;  // in planet radii
  outerRadius: number;  // in planet radii
  tilt: [number, number, number]; // Euler XYZ (radians) applied to planet + rings so bands align
}

// Exoplanet theme object (extends base with exoplanet-specific fields)
export interface Exoplanet extends BaseCelestialObject {
  rings?: PlanetRings;
  distanceLightYears: number;
  hostStar: string;
  orbitalPeriodDays: number;
  discoveryYear: number;
  keyFeature: string; // The headline characteristic (e.g., "Glass rain at 5,400 mph")
  surfaceTemp?: string; // Optional temperature info
}
