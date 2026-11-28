import { useEffect, useState } from 'react';
import { useOtherWorldsStore } from '../../store/useOtherWorldsStore';
import { otherWorlds } from '../../data/otherWorlds';
import '../exoplanets/StarPathNav.css';

/** Dot path navigation between worlds (same look as the other themes). */
export function WorldNav() {
  const { currentIndex, next, previous, jumpTo, isTransitioning } = useOtherWorldsStore();
  const [hovered, setHovered] = useState<number | null>(null);

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
        <span className="progress-text">{currentIndex + 1} of {otherWorlds.length}</span>
      </div>
      <div className="star-path-controls">
        <button className="star-path-button prev" onClick={previous} disabled={currentIndex === 0 || isTransitioning} aria-label="Previous world">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="star-path-dots">
          <div className="star-path-line" />
          {otherWorlds.map((w, i) => (
            <button
              key={w.id}
              className={`star-path-dot ${i === currentIndex ? 'current' : ''} ${i === hovered ? 'hovered' : ''} ${i < currentIndex ? 'past' : ''}`}
              onClick={() => !isTransitioning && jumpTo(i)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              disabled={isTransitioning}
              aria-label={w.name}
              title={w.name}
            >
              <span className="dot-inner" />
              <span className="dot-tooltip">{w.name}</span>
            </button>
          ))}
        </div>
        <button className="star-path-button next" onClick={next} disabled={currentIndex === otherWorlds.length - 1 || isTransitioning} aria-label="Next world">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="star-path-hint">Arrow keys ← → change world · drag to look around</div>
    </div>
  );
}
