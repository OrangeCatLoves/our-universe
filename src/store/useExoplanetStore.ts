import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { exoplanets } from '../data/extremeExoplanets';

interface ExoplanetStore {
  currentIndex: number;
  isTransitioning: boolean;
  // Track navigation direction for animation
  navigationDirection: 'forward' | 'backward' | null;

  // Actions
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  setTransitioning: (value: boolean) => void;
}

export const useExoplanetStore = create<ExoplanetStore>()(
  persist(
    (set, get) => ({
      currentIndex: 0,
      isTransitioning: false,
      navigationDirection: null,

      next: () => {
        const { currentIndex, isTransitioning } = get();
        if (isTransitioning) return;

        const nextIndex = Math.min(currentIndex + 1, exoplanets.length - 1);
        if (nextIndex === currentIndex) return;

        set({
          isTransitioning: true,
          navigationDirection: 'forward',
          currentIndex: nextIndex,
        });

        // Reset transitioning after animation completes
        setTimeout(() => {
          set({ isTransitioning: false, navigationDirection: null });
        }, 1200);
      },

      previous: () => {
        const { currentIndex, isTransitioning } = get();
        if (isTransitioning) return;

        const prevIndex = Math.max(currentIndex - 1, 0);
        if (prevIndex === currentIndex) return;

        set({
          isTransitioning: true,
          navigationDirection: 'backward',
          currentIndex: prevIndex,
        });

        // Reset transitioning after animation completes
        setTimeout(() => {
          set({ isTransitioning: false, navigationDirection: null });
        }, 1200);
      },

      jumpTo: (index: number) => {
        const { currentIndex, isTransitioning } = get();
        if (isTransitioning) return;
        if (index < 0 || index >= exoplanets.length) return;
        if (index === currentIndex) return;

        const direction = index > currentIndex ? 'forward' : 'backward';

        set({
          isTransitioning: true,
          navigationDirection: direction,
          currentIndex: index,
        });

        // Reset transitioning after animation completes
        setTimeout(() => {
          set({ isTransitioning: false, navigationDirection: null });
        }, 1200);
      },

      setTransitioning: (value: boolean) => set({ isTransitioning: value }),
    }),
    {
      name: 'our-universe-exoplanets',
      partialize: (state) => ({ currentIndex: state.currentIndex }),
    }
  )
);
