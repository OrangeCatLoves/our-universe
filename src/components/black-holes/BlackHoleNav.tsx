import { useState, useEffect } from 'react';
import { useBlackHoleStore } from '../../store/useBlackHoleStore';
import { blackHoles } from '../../data/blackHoles';
import '../exoplanets/StarPathNav.css';

/** Dot path navigation (same look as the exoplanet theme's star path). */
export function BlackHoleNav() {
  const { currentIndex, next, previous, jumpTo, isTransitioning } = useBlackHoleStore();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTransitioning) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        previous();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, previous, isTransitioning]);

  return (
    <div className="star-path-nav">
      <div className="star-path-progress">
        <span className="progress-text">{currentIndex + 1} of {blackHoles.length}</span>
      </div>
      <div className="star-path-controls">
        <button className="star-path-button prev" onClick={previous}
          disabled={currentIndex === 0 || isTransitioning} aria-label="Previous black hole">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="star-path-dots">
          <div className="star-path-line" />
          {blackHoles.map((bh, index) => (
            <button
              key={bh.id}
              className={`star-path-dot ${index === currentIndex ? 'current' : ''} ${index === hoveredIndex ? 'hovered' : ''} ${index < currentIndex ? 'past' : ''}`}
              onClick={() => !isTransitioning && jumpTo(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              disabled={isTransitioning}
              aria-label={bh.name}
              title={bh.name}
            >
              <span className="dot-inner" />
              <span className="dot-tooltip">{bh.name}</span>
            </button>
          ))}
        </div>
        <button className="star-path-button next" onClick={next}
          disabled={currentIndex === blackHoles.length - 1 || isTransitioning} aria-label="Next black hole">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="star-path-hint">Use arrow keys ← → to navigate · drag to orbit</div>
    </div>
  );
}
