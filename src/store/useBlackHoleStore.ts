import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { blackHoles } from '../data/blackHoles';

interface BlackHoleStore {
  currentIndex: number;
  isTransitioning: boolean;
  navigationDirection: 'forward' | 'backward' | null;
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
}

const TRANSITION_MS = 1200;

export const useBlackHoleStore = create<BlackHoleStore>()(
  persist(
    (set, get) => {
      const go = (index: number) => {
        const { currentIndex, isTransitioning } = get();
        if (isTransitioning || index === currentIndex || index < 0 || index >= blackHoles.length) return;
        set({
          isTransitioning: true,
          navigationDirection: index > currentIndex ? 'forward' : 'backward',
          currentIndex: index,
        });
        setTimeout(() => set({ isTransitioning: false, navigationDirection: null }), TRANSITION_MS);
      };
      return {
        currentIndex: 0,
        isTransitioning: false,
        navigationDirection: null,
        next: () => go(get().currentIndex + 1),
        previous: () => go(get().currentIndex - 1),
        jumpTo: (index: number) => go(index),
      };
    },
    {
      name: 'our-universe-black-holes',
      partialize: (state) => ({ currentIndex: state.currentIndex }),
      // clamp saved progress in case the list changes length
      merge: (persisted, current) => {
        const saved = (persisted as { currentIndex?: number } | undefined)?.currentIndex ?? 0;
        return { ...current, currentIndex: Math.min(Math.max(saved, 0), blackHoles.length - 1) };
      },
    }
  )
);
