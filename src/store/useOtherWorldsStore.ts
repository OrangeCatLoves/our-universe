import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { otherWorlds } from '../data/otherWorlds';

interface OtherWorldsStore {
  currentIndex: number;
  isTransitioning: boolean;
  labels: boolean;
  panelCollapsed: boolean;
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  toggleLabels: () => void;
  togglePanel: () => void;
}

const TRANSITION_MS = 1100;

export const useOtherWorldsStore = create<OtherWorldsStore>()(
  persist(
    (set, get) => {
      const go = (index: number) => {
        const { currentIndex, isTransitioning } = get();
        if (isTransitioning || index === currentIndex || index < 0 || index >= otherWorlds.length) return;
        set({ isTransitioning: true, currentIndex: index });
        setTimeout(() => set({ isTransitioning: false }), TRANSITION_MS);
      };
      return {
        currentIndex: 0,
        isTransitioning: false,
        labels: true,
        panelCollapsed: false,
        next: () => go(get().currentIndex + 1),
        previous: () => go(get().currentIndex - 1),
        jumpTo: (index: number) => go(index),
        toggleLabels: () => set({ labels: !get().labels }),
        togglePanel: () => set({ panelCollapsed: !get().panelCollapsed }),
      };
    },
    {
      name: 'our-universe-other-worlds',
      partialize: (state) => ({ currentIndex: state.currentIndex, labels: state.labels, panelCollapsed: state.panelCollapsed }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { currentIndex?: number; labels?: boolean; panelCollapsed?: boolean };
        return {
          ...current,
          currentIndex: Math.min(Math.max(p.currentIndex ?? 0, 0), otherWorlds.length - 1),
          labels: p.labels ?? true,
          panelCollapsed: p.panelCollapsed ?? false,
        };
      },
    }
  )
);

/**
 * The time-lapse clock, shared by the 3D scene (which advances it) and the time slider (which shows
 * and scrubs it). Kept outside React so it can change every frame without re-rendering anything.
 */
export const skyClock = {
  phase: 0.3,        // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
  playing: true,
  label: '',         // "Sunset", "Night", ... (written by the scene)
  worldId: '',
  notice: '',        // a short message shown in place of the label for a few seconds
  noticeUntil: 0,
};

/** "Look at" requests from the info panel, picked up by the scene. */
export const lookRequest = { id: '' as string, serial: 0 };

export function requestLook(id: string) {
  lookRequest.id = id;
  lookRequest.serial++;
}
