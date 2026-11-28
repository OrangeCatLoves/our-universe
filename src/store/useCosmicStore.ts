import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { celestialObjects } from '../data/cosmicScale';

// Where a newly mounted object starts its spring (only read when its component mounts):
//  'right' - forward navigation: the new current object slides in from the spawn point on the right
//  'left'  - backward navigation: the object slides in from off the left edge of the screen
//  'zoom'  - a giant jump forward (10x bigger or more): the new object starts filling the screen and
//            shrinks into place while the previous one falls away, like the camera pulling back
export type EntryDirection = 'right' | 'left' | 'zoom';

// Forward moves to something at least this many times bigger use the 'zoom' entrance
export const ZOOM_RATIO = 10;

/** How big a 'zoom' entrance starts (grows with the size of the jump, capped to stay on screen). */
export function zoomStartScale(ratio: number): number {
  return Math.min(1.5 * (1 + Math.log10(ratio) * 1.6), 6.5);
}

// Layout positions shared with CelestialObject
export const SPAWN_RIGHT_X = 5;        // where next() spawns the new current object
// Beyond the left/right screen edge at the default camera, even on 21:9 ultrawide displays
// (visible half-width at the planets' depth is ~7.3 on 16:9-ish screens, ~9.2 on 21:9;
//  a full-size planet has radius 1.5)
export const OFFSCREEN_RIGHT_X = 14;
export const OFFSCREEN_LEFT_X = -14;

export interface VisibleObject {
  id: string;
  index: number;
  scale: number;
  positionX: number;
  positionY: number;
  enterFrom: EntryDirection;
  zoomFrom?: number;   // starting scale of a 'zoom' entrance
  mountId?: number;    // identity of this on-screen instance (render key); new instance = new id
  exiting?: boolean;   // sliding out off the right edge (backward navigation); removed when it stops
  exitToken?: number;  // identifies which transition removes this object
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
  initializeFromIndex: (index: number) => void;
  /** Called by CelestialObject when a leaving object has finished sliding off-screen. */
  removeExited: (token: number) => void;
}

export const MINIMUM_VISIBLE_SCALE = 0.02; // 2% minimum scale to keep objects visible
const MAX_VISIBLE_OBJECTS = 2; // Keep only 2 recent objects (current + 1 previous)

const CURRENT_OBJECT_SCALE = 1.5; // Scale for the current/main object (1.5 = 50% bigger)
const TRANSITION_MS = 1500;       // Matches the spring settle time in CelestialObject
const EXIT_FALLBACK_MS = 4000;    // Safety net in case a leaving object's onRest never fires

let transitionToken = 0;

let mountCounter = 0;

/**
 * Give every object a render identity. An object that is already on screen (and not leaving) keeps
 * its instance, so its spring continues from where it is. Anything else is a new instance, so it
 * mounts fresh and starts from its entry point, even if a copy with the same id is still sliding out.
 */
function withMountIds(next: VisibleObject[], prev: VisibleObject[]): VisibleObject[] {
  return next.map((o) => {
    if (o.mountId !== undefined) return o;
    const same = prev.find((p) => p.id === o.id && !p.exiting && p.mountId !== undefined);
    return { ...o, mountId: same ? same.mountId : ++mountCounter };
  });
}

/** Objects that are still part of the layout (not on their way out). */
function liveObjects(objects: VisibleObject[]): VisibleObject[] {
  return objects.filter((o) => !o.exiting);
}

/**
 * Backward move, e.g. C -> B with A before B:
 *   1. C (current) slides out to the right, the way it slid in on next(), until it is off-screen.
 *   2. B moves from its small lower-left spot back to the centre, growing to full size.
 *   3. A slides in from off the left edge into the small lower-left spot.
 * All three start together. For a longer backward jump, the new current object also slides in from
 * the left (at full size) since it wasn't on screen.
 */
function backwardLayout(objects: VisibleObject[], currentIndex: number, targetIndex: number, token: number) {
  const live = liveObjects(objects);
  const targets = buildVisibleObjects(targetIndex).map((t): VisibleObject => {
    const existing = live.find((o) => o.id === t.id);
    // Already on screen (B): its component stays mounted and springs from where it is.
    // Not on screen (A, or a jump target): slides in from the left.
    return existing
      ? { ...t, enterFrom: existing.enterFrom, mountId: existing.mountId }
      : { ...t, enterFrom: 'left' as EntryDirection, mountId: ++mountCounter };
  });
  const targetIds = new Set(targets.map((t) => t.id));

  const leaving = live
    .filter((o) => o.index === currentIndex && !targetIds.has(o.id))
    .map((o): VisibleObject => ({
      ...o,
      exiting: true,
      exitToken: token,
      scale: CURRENT_OBJECT_SCALE,
      positionX: OFFSCREEN_RIGHT_X,
      positionY: 0,
    }));

  // Any other object that is no longer needed simply drops out (as the oldest one does in next())
  return [...targets, ...leaving];
}

/**
 * Where the previous object rests: right beside the current one, standing on the same baseline, like
 * a size-comparison chart (so the two can be compared at a glance, truly to scale).
 */
function previousSlot(index: number, scale: number): { x: number; y: number } {
  const o = celestialObjects[index];
  const isImage = o.category !== 'sphere';
  const halfWidth = isImage ? scale * (o.type.toLowerCase().includes('black hole') ? 4.5 : 1.75) : scale * (o.id === 'saturn' ? 2.2 : 1);
  const halfHeight = isImage ? halfWidth * 0.55 : scale;
  return {
    x: 1.5 - CURRENT_OBJECT_SCALE - 0.35 - halfWidth,
    y: -CURRENT_OBJECT_SCALE + halfHeight,
  };
}

// Helper to build visible objects for a given index
function buildVisibleObjects(index: number): VisibleObject[] {
  const startIndex = Math.max(0, index - (MAX_VISIBLE_OBJECTS - 1));
  const newObjects: VisibleObject[] = [];

  for (let i = startIndex; i <= index; i++) {
    const obj = celestialObjects[i];
    const distanceFromCurrent = index - i;
    // true to scale: earlier objects are drawn at their real size relative to the current one
    const cumulativeScale = CURRENT_OBJECT_SCALE * (distanceFromCurrent === 0 ? 1 : calculateCumulativeScale(i, index));

    const scale = Math.max(cumulativeScale, MINIMUM_VISIBLE_SCALE);
    const slot = distanceFromCurrent === 0
      ? { x: 1.5, y: 0 }
      : distanceFromCurrent === 1
        ? previousSlot(i, scale)
        : { x: -3 - distanceFromCurrent * 1.5, y: -1.5 - distanceFromCurrent * 0.8 };
    newObjects.push({
      id: obj.id,
      index: i,
      scale,
      positionX: slot.x,
      positionY: slot.y,
      enterFrom: 'right',
    });
  }

  return newObjects;
}

type SetState = (partial: Partial<CosmicStore> | ((state: CosmicStore) => Partial<CosmicStore>)) => void;

/** Removes the objects that left during the given backward transition. Safe to call twice. */
function removeExitedObjects(set: SetState, token: number) {
  set((state) => ({
    visibleObjects: state.visibleObjects.filter((o) => !(o.exiting && o.exitToken === token)),
  }));
}

/** Runs a backward transition to targetIndex (previous(), or jumping to an earlier object). */
function runBackward(get: () => CosmicStore, set: SetState, targetIndex: number) {
  const { currentIndex, visibleObjects } = get();
  const token = ++transitionToken;

  set({
    isTransitioning: true,
    currentIndex: targetIndex,
    visibleObjects: backwardLayout(visibleObjects, currentIndex, targetIndex, token),
  });

  // Navigation unlocks after the same time as next()
  setTimeout(() => {
    if (token === transitionToken) set({ isTransitioning: false });
  }, TRANSITION_MS);

  // The leaving object is normally removed by its own onRest, once it has stopped off-screen
  setTimeout(() => removeExitedObjects(set, token), EXIT_FALLBACK_MS);
}

export const useCosmicStore = create<CosmicStore>()(
  persist(
    (set, get) => ({
      currentIndex: 0,
      visibleObjects: [
        {
          id: celestialObjects[0].id,
          index: 0,
          scale: CURRENT_OBJECT_SCALE,
          positionX: 1.5,
          positionY: 0,
          enterFrom: 'right',
          mountId: ++mountCounter,
        }
      ],
      isTransitioning: false,

      // Initialize visible objects from a persisted index
      initializeFromIndex: (index: number) => {
        set({
          currentIndex: index,
          visibleObjects: withMountIds(buildVisibleObjects(index), get().visibleObjects),
          isTransitioning: false,
        });
      },

  next: () => {
    const { currentIndex, isTransitioning } = get();
    // Objects still sliding out from a previous backward move are dropped from the layout
    const visibleObjects = liveObjects(get().visibleObjects);
    console.log('next() called', { currentIndex, isTransitioning, visibleObjectsLength: visibleObjects.length });

    const nextIndex = Math.min(currentIndex + 1, celestialObjects.length - 1);
    console.log('nextIndex:', nextIndex, 'total objects:', celestialObjects.length);

    if (nextIndex === currentIndex) {
      console.log('Already at last object, returning');
      return;
    }

    set({ isTransitioning: true });
    transitionToken++;
    console.log('Setting isTransitioning to true');

    const currentObject = celestialObjects[currentIndex];
    const nextObject = celestialObjects[nextIndex];

    const sizeRatio = currentObject.sizeKm / nextObject.sizeKm;

    // Update all existing objects: shift left-down and scale down
    const updatedObjects = visibleObjects.map((obj) => {
      // True to scale: the previous objects keep their real size relative to the new current one
      const baseScale = obj.index === currentIndex ? CURRENT_OBJECT_SCALE : obj.scale;
      const newScale = Math.max(baseScale * sizeRatio, MINIMUM_VISIBLE_SCALE);
      const distanceFromCurrent = (visibleObjects.length - visibleObjects.indexOf(obj));
      const slot = distanceFromCurrent === 1
        ? previousSlot(obj.index, newScale)
        : { x: -3 - distanceFromCurrent * 1.5, y: -1.5 - distanceFromCurrent * 0.8 };

      return {
        ...obj,
        positionX: slot.x,
        positionY: slot.y,
        scale: newScale,
      };
    });

    // Add the new object - enters from RIGHT (forward navigation), or zooms in for a giant jump
    const growth = nextObject.sizeKm / currentObject.sizeKm;
    const zoom = growth >= ZOOM_RATIO;
    const newVisibleObjects = [
      ...updatedObjects,
      {
        id: nextObject.id,
        index: nextIndex,
        scale: CURRENT_OBJECT_SCALE,
        positionX: 1.5,
        positionY: 0,
        enterFrom: (zoom ? 'zoom' : 'right') as EntryDirection,
        zoomFrom: zoom ? zoomStartScale(growth) : undefined,
        mountId: ++mountCounter, // fresh instance, even if a copy with this id is still sliding out
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
    const { currentIndex } = get();
    const prevIndex = Math.max(currentIndex - 1, 0);
    if (prevIndex === currentIndex) return;
    runBackward(get, set, prevIndex);
  },

  jumpTo: (index: number) => {
    if (index < 0 || index >= celestialObjects.length) return;

    const { currentIndex, visibleObjects } = get();
    // Already there. Important: next()/previous() change the URL, which re-runs the theme's
    // deep-link effect and calls jumpTo(currentIndex). Rebuilding here used to wipe the running
    // animation and make objects fly in from the right after going back.
    if (index === currentIndex) return;

    if (index < currentIndex) {
      // Jumping backward moves the same way as previous()
      runBackward(get, set, index);
      return;
    }

    // Jumping forward (or initial deep link): new objects enter from the right; ones already on
    // screen keep their mounted component and animate to their new slot
    transitionToken++;
    const live = liveObjects(visibleObjects);
    const growth = celestialObjects[index].sizeKm / celestialObjects[currentIndex].sizeKm;
    const newObjects = buildVisibleObjects(index).map((t): VisibleObject => {
      const existing = live.find((o) => o.id === t.id);
      if (existing) return { ...t, enterFrom: existing.enterFrom, mountId: existing.mountId };
      // the jump target zooms in when it is a giant leap in size
      if (t.index === index && growth >= ZOOM_RATIO) {
        return { ...t, enterFrom: 'zoom', zoomFrom: zoomStartScale(growth), mountId: ++mountCounter };
      }
      return { ...t, mountId: ++mountCounter };
    });

    set({ isTransitioning: true, currentIndex: index, visibleObjects: newObjects });

    setTimeout(() => {
      set({ isTransitioning: false });
    }, TRANSITION_MS);
  },

  setTransitioning: (value: boolean) => set({ isTransitioning: value }),

  removeExited: (token: number) => removeExitedObjects(set, token),
    }),
    {
      name: 'our-universe-cosmic',
      partialize: (state) => ({ currentIndex: state.currentIndex }),
      onRehydrateStorage: () => (state) => {
        // Rebuild visible objects from persisted index on rehydration
        if (state) {
          // Use setTimeout to ensure store is ready, then properly set state
          setTimeout(() => {
            useCosmicStore.setState({
              visibleObjects: withMountIds(buildVisibleObjects(state.currentIndex), useCosmicStore.getState().visibleObjects),
              isTransitioning: false,
            });
          }, 0);
        }
      },
    }
  )
);

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
