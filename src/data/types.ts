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

// Exoplanet theme object (extends base with exoplanet-specific fields)
export interface Exoplanet extends BaseCelestialObject {
  distanceLightYears: number;
  hostStar: string;
  orbitalPeriodDays: number;
  discoveryYear: number;
  keyFeature: string; // The headline characteristic (e.g., "Glass rain at 5,400 mph")
  surfaceTemp?: string; // Optional temperature info
}
