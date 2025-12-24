import { create } from 'zustand';
import { celestialObjects } from '../data/objects';

export interface VisibleObject {
  id: string;
  index: number;
  scale: number;
  positionX: number;
  positionY: number;
  entryFromRight: boolean; // true = enter from right (forward), false = enter from left (backward)
}

interface CosmicStore {
  currentIndex: number;
  visibleObjects: VisibleObject[];
  isTransitioning: boolean;

  // Actions
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  setTransitioning: (value: boolean) => void;
}

const MINIMUM_VISIBLE_SCALE = 0.02; // 2% minimum scale to keep objects visible
const MAX_VISIBLE_OBJECTS = 3; // Keep only 3 recent objects

const CURRENT_OBJECT_SCALE = 1.5; // Scale for the current/main object (1.5 = 50% bigger)

export const useCosmicStore = create<CosmicStore>((set, get) => ({
  currentIndex: 0,
  visibleObjects: [
    {
      id: celestialObjects[0].id,
      index: 0,
      scale: CURRENT_OBJECT_SCALE,
      positionX: 1.5,
      positionY: 0,
      entryFromRight: true,
    }
  ],
  isTransitioning: false,

  next: () => {
    const { currentIndex, visibleObjects } = get();
    const nextIndex = Math.min(currentIndex + 1, celestialObjects.length - 1);

    if (nextIndex === currentIndex) return;

    set({ isTransitioning: true });

    const currentObject = celestialObjects[currentIndex];
    const nextObject = celestialObjects[nextIndex];

    const sizeRatio = currentObject.sizeKm / nextObject.sizeKm;

    // Update all existing objects: shift left-down and scale down
    const updatedObjects = visibleObjects.map((obj) => {
      // If this was the current object, calculate scale from base 1 (not CURRENT_OBJECT_SCALE)
      // This ensures the 50% size boost only applies to the object currently in view
      const baseScale = obj.index === currentIndex ? 1 : obj.scale;
      const newScale = Math.max(baseScale * sizeRatio, MINIMUM_VISIBLE_SCALE);
      const distanceFromCurrent = (visibleObjects.length - visibleObjects.indexOf(obj));

      return {
        ...obj,
        positionX: -3 - (distanceFromCurrent * 1.5),
        positionY: -1.5 - (distanceFromCurrent * 0.8),
        scale: newScale,
      };
    });

    // Add the new object - enters from RIGHT (forward navigation)
    const newVisibleObjects = [
      ...updatedObjects,
      {
        id: nextObject.id,
        index: nextIndex,
        scale: CURRENT_OBJECT_SCALE,
        positionX: 1.5,
        positionY: 0,
        entryFromRight: true,
      }
    ];

    const trimmedObjects = newVisibleObjects.slice(-MAX_VISIBLE_OBJECTS);

    set({
      currentIndex: nextIndex,
      visibleObjects: trimmedObjects,
    });

    setTimeout(() => {
      set({ isTransitioning: false });
    }, 1500);
  },

  previous: () => {
    const { currentIndex, visibleObjects } = get();
    const prevIndex = Math.max(currentIndex - 1, 0);

    if (prevIndex === currentIndex) return;

    set({ isTransitioning: true });

    const existingPrevIndex = visibleObjects.findIndex(obj => obj.index === prevIndex);

    if (existingPrevIndex !== -1) {
      // Previous object exists - bring it back to center
      const updatedObjects = visibleObjects
        .filter((_, idx) => idx <= existingPrevIndex)
        .map((obj, idx, arr) => {
          if (idx === arr.length - 1) {
            return {
              ...obj,
              scale: CURRENT_OBJECT_SCALE,
              positionX: 1.5,
              positionY: 0,
            };
          }
          const distanceFromCurrent = arr.length - 1 - idx;
          const cumulativeScale = calculateCumulativeScale(prevIndex - distanceFromCurrent, prevIndex);
          return {
            ...obj,
            scale: Math.max(cumulativeScale, MINIMUM_VISIBLE_SCALE),
            positionX: -3 - (distanceFromCurrent * 1.5),
            positionY: -1.5 - (distanceFromCurrent * 0.8),
          };
        });

      set({
        currentIndex: prevIndex,
        visibleObjects: updatedObjects,
      });
    } else {
      // Previous object is not in visible objects - rebuild with entry from LEFT
      const startIndex = Math.max(0, prevIndex - (MAX_VISIBLE_OBJECTS - 1));
      const newObjects: VisibleObject[] = [];

      for (let i = startIndex; i <= prevIndex; i++) {
        const obj = celestialObjects[i];
        const distanceFromCurrent = prevIndex - i;
        const cumulativeScale = distanceFromCurrent === 0 ? CURRENT_OBJECT_SCALE : calculateCumulativeScale(i, prevIndex);

        newObjects.push({
          id: obj.id,
          index: i,
          scale: Math.max(cumulativeScale, MINIMUM_VISIBLE_SCALE),
          positionX: distanceFromCurrent === 0 ? 1.5 : -3 - (distanceFromCurrent * 1.5),
          positionY: distanceFromCurrent === 0 ? 0 : -1.5 - (distanceFromCurrent * 0.8),
          entryFromRight: false, // Enter from LEFT (backward navigation)
        });
      }

      set({
        currentIndex: prevIndex,
        visibleObjects: newObjects,
      });
    }

    setTimeout(() => {
      set({ isTransitioning: false });
    }, 1500);
  },

  jumpTo: (index: number) => {
    if (index < 0 || index >= celestialObjects.length) return;

    set({ isTransitioning: true });

    const startIndex = Math.max(0, index - (MAX_VISIBLE_OBJECTS - 1));
    const newObjects: VisibleObject[] = [];

    for (let i = startIndex; i <= index; i++) {
      const obj = celestialObjects[i];
      const distanceFromCurrent = index - i;
      const cumulativeScale = distanceFromCurrent === 0 ? CURRENT_OBJECT_SCALE : calculateCumulativeScale(i, index);

      newObjects.push({
        id: obj.id,
        index: i,
        scale: Math.max(cumulativeScale, MINIMUM_VISIBLE_SCALE),
        positionX: distanceFromCurrent === 0 ? 1.5 : -3 - (distanceFromCurrent * 1.5),
        positionY: distanceFromCurrent === 0 ? 0 : -1.5 - (distanceFromCurrent * 0.8),
        entryFromRight: true, // Default to right for jump
      });
    }

    set({
      currentIndex: index,
      visibleObjects: newObjects,
    });

    setTimeout(() => {
      set({ isTransitioning: false });
    }, 1500);
  },

  setTransitioning: (value: boolean) => set({ isTransitioning: value }),
}));

function calculateCumulativeScale(fromIndex: number, toIndex: number): number {
  if (fromIndex >= toIndex) return 1;

  let scale = 1;
  for (let i = fromIndex; i < toIndex; i++) {
    const currentObj = celestialObjects[i];
    const nextObj = celestialObjects[i + 1];
    const ratio = currentObj.sizeKm / nextObj.sizeKm;
    scale *= ratio;
  }
  return scale;
}
