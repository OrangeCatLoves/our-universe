import { useEffect, useState } from 'react';
import { useCosmicStore } from '../store/useCosmicStore';
import { celestialObjects } from '../data/objects';
import './Navigation.css';

export function Navigation() {
  const { currentIndex, next, previous, jumpTo, isTransitioning } = useCosmicStore();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        previous();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [next, previous, isTransitioning]);

  // Touch gesture support
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || isTransitioning) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      next();
    } else if (isRightSwipe) {
      previous();
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value);
    jumpTo(index);
  };

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < celestialObjects.length - 1;

  return (
    <div
      className="navigation"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="nav-controls">
        <button
          className="nav-button"
          onClick={previous}
          disabled={!canGoPrevious || isTransitioning}
          aria-label="Previous object"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Previous</span>
        </button>

        <select
          className="object-select"
          value={currentIndex}
          onChange={handleDropdownChange}
          disabled={isTransitioning}
          aria-label="Jump to object"
        >
          {celestialObjects.map((obj, index) => (
            <option key={obj.id} value={index}>
              {obj.name}
            </option>
          ))}
        </select>

        <button
          className="nav-button"
          onClick={next}
          disabled={!canGoNext || isTransitioning}
          aria-label="Next object"
        >
          <span>Next</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="keyboard-hint">
        Use arrow keys ← → or swipe to navigate
      </div>
    </div>
  );
}
