import { useState, useEffect } from 'react';
import { useExoplanetStore } from '../../store/useExoplanetStore';
import { exoplanets } from '../../data/extremeExoplanets';
import './StarPathNav.css';

export function StarPathNav() {
  const { currentIndex, next, previous, jumpTo, isTransitioning } = useExoplanetStore();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < exoplanets.length - 1;

  return (
    <div className="star-path-nav">
      {/* Progress Bar */}
      <div className="star-path-progress">
        <span className="progress-text">
          {currentIndex + 1} of {exoplanets.length}
        </span>
      </div>

      <div className="star-path-controls">
        {/* Previous Button */}
        <button
          className="star-path-button prev"
          onClick={previous}
          disabled={!canGoPrevious || isTransitioning}
          aria-label="Previous planet"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Star Path - Linear Dot Navigation */}
        <div className="star-path-dots">
          {/* Connecting line */}
          <div className="star-path-line" />

          {/* Planet dots */}
          {exoplanets.map((planet, index) => {
            const isCurrent = index === currentIndex;
            const isHovered = index === hoveredIndex;
            const isPast = index < currentIndex;

            return (
              <button
                key={planet.id}
                className={`star-path-dot ${isCurrent ? 'current' : ''} ${isHovered ? 'hovered' : ''} ${isPast ? 'past' : ''}`}
                onClick={() => !isTransitioning && jumpTo(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                disabled={isTransitioning}
                aria-label={planet.name}
                title={planet.name}
              >
                <span className="dot-inner" />
                {/* Tooltip */}
                <span className="dot-tooltip">{planet.name}</span>
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          className="star-path-button next"
          onClick={next}
          disabled={!canGoNext || isTransitioning}
          aria-label="Next planet"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="star-path-hint">
        Use arrow keys ← → to navigate
      </div>
    </div>
  );
}
