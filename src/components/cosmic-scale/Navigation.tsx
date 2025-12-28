import { useEffect, useState } from 'react';
import { useCosmicStore } from '../../store/useCosmicStore';
import { celestialObjects } from '../../data/cosmicScale';
import { RadialMenu } from './RadialMenu';
import './Navigation.css';

export function Navigation() {
  const { currentIndex, next, previous, jumpTo, isTransitioning } = useCosmicStore();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Debug logging
  console.log('Navigation render:', { currentIndex, isTransitioning });

  // Detect mobile/desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const totalObjects = celestialObjects.length;

  // Debug click handlers
  const handleNextClick = () => {
    console.log('Next button clicked!', { canGoNext, isTransitioning });
    next();
  };

  const handlePrevClick = () => {
    console.log('Previous button clicked!', { canGoPrevious, isTransitioning });
    previous();
  };
  const progressPercent = (currentIndex / (totalObjects - 1)) * 100;

  return (
    <div
      className="navigation"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress Bar */}
      <div className="progress-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-text">
          {currentIndex + 1} of {totalObjects}
        </div>
      </div>

      <div className="nav-controls">
        <button
          className="nav-button"
          onClick={handlePrevClick}
          disabled={!canGoPrevious || isTransitioning}
          aria-label="Previous object"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Previous</span>
        </button>

        {/* Desktop: Radial Menu / Mobile: Dropdown */}
        {isMobile ? (
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
        ) : (
          <RadialMenu
            currentIndex={currentIndex}
            onSelect={jumpTo}
            disabled={isTransitioning}
          />
        )}

        <button
          className="nav-button"
          onClick={handleNextClick}
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
