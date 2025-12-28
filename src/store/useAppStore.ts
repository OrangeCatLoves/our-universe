import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeInfo {
  id: string;
  name: string;
  tagline: string;
  route: string;
}

// Available themes
export const themes: ThemeInfo[] = [
  {
    id: 'cosmic-scale',
    name: 'Cosmic Scale Comparison',
    tagline: 'From moons to the observable universe',
    route: '/cosmic-scale',
  },
  {
    id: 'extreme-exoplanets',
    name: 'Extreme Exoplanets',
    tagline: 'Worlds of glass rain, iron storms, and impossible heat',
    route: '/extreme-exoplanets',
  },
];

interface AppStore {
  // Track if user has visited before (for potential future use)
  hasVisited: boolean;
  setHasVisited: (value: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      hasVisited: false,
      setHasVisited: (value: boolean) => set({ hasVisited: value }),
    }),
    {
      name: 'our-universe-app',
    }
  )
);
