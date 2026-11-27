import { useEffect, useRef, useSyncExternalStore } from 'react';
import { sound } from './soundEngine';
import type { AmbientId } from './soundEngine';

/** Select this theme's ambient bed while mounted; `depth` (0..1) deepens it live. */
export function useAmbient(id: AmbientId, depth?: number) {
  useEffect(() => {
    sound.setAmbient(id, { depth });
    // depth changes are handled by the effect below without restarting the bed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (depth !== undefined) sound.updateAmbient({ depth });
  }, [depth]);
}

/**
 * Play the navigation whoosh whenever the current index changes, whatever caused it (buttons,
 * arrow keys, swipes, dot/radial navigation, jumps). `onArrive` runs after each change.
 */
export function useNavigationSound(index: number, onArrive?: (index: number) => void) {
  const prev = useRef<number | null>(null);
  const arrive = useRef(onArrive);
  useEffect(() => {
    arrive.current = onArrive;
  });
  useEffect(() => {
    if (prev.current !== null && prev.current !== index) {
      sound.whoosh(index > prev.current ? 'forward' : 'backward');
      arrive.current?.(index);
    }
    prev.current = index;
  }, [index]);
}

const subscribe = (cb: () => void) => sound.subscribe(cb);
const getMuted = () => sound.isMuted();

export function useMuted() {
  return useSyncExternalStore(subscribe, getMuted, getMuted);
}
