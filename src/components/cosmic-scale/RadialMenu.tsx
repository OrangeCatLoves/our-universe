import { useState, useRef, useEffect } from 'react';
import { celestialObjects } from '../../data/cosmicScale';
import './RadialMenu.css';

interface RadialMenuProps {
  currentIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

// Ring configuration - 5 rings with object indices
// Each ring has an angular offset to prevent vertical alignment of labels
const ringConfig = [
  {
    name: 'Moons & Dwarf Planets',
    color: '#A0AEC0', // Silver/Gray
    indices: [0, 1, 2, 3, 4, 5, 8], // Enceladus, Ceres, Pluto, Europa, Moon, Io, Ganymede
    angleOffset: 0,
  },
  {
    name: 'Planets',
    color: '#4DC9FF', // Cyan
    indices: [6, 7, 9, 10, 11, 12, 13, 14, 15], // Mercury, Titan, Mars, Venus, Earth, Neptune, Uranus, Saturn, Jupiter
    angleOffset: 20,
  },
  {
    name: 'Stars',
    color: '#FFB347', // Orange/Gold
    indices: [16, 17, 18, 19, 20, 22, 23, 24, 25, 26], // All stars
    angleOffset: 8,
  },
  {
    name: 'Black Holes & Nebulae',
    color: '#A855F7', // Purple
    indices: [21, 27, 28, 29, 30, 31, 32, 33], // Sagittarius A*, TON 618, all nebulae
    angleOffset: 25,
  },
  {
    name: 'Galaxies & Universe',
    color: '#FF6B9D', // Pink
    indices: [34, 35, 36, 37, 38, 39, 40, 41], // All galaxies + large-scale structures
    angleOffset: 12,
  },
];


export function RadialMenu({ currentIndex, onSelect, disabled }: RadialMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentObject = celestialObjects[currentIndex];

  // Calculate ring radii based on viewport
  const getMenuSize = () => {
    if (typeof window === 'undefined') return { baseRadius: 70, ringSpacing: 56, outerRadius: 380 };
    const vw = Math.min(window.innerWidth, window.innerHeight, 1000);
    const baseRadius = Math.max(50, vw * 0.07);
    const ringSpacing = Math.max(48, vw * 0.065);
    const outerRadius = baseRadius + ringSpacing * 6; // Extra padding beyond last ring
    return { baseRadius, ringSpacing, outerRadius };
  };

  const { baseRadius, ringSpacing, outerRadius } = getMenuSize();

  // Handle button click/hover to open
  const handleOpen = () => {
    if (disabled) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 100);
  };

  // Handle mouse leave from the entire menu area (outer boundary)
  const handleMenuMouseLeave = (e: React.MouseEvent) => {
    if (!menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const distance = Math.sqrt(
      Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2)
    );

    // Only close if mouse is outside the outer ring boundary
    if (distance > outerRadius) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsOpen(false);
      setHoveredIndex(null);
    }
  };

  // Handle clicking outside (on overlay)
  const handleOverlayClick = () => {
    setIsOpen(false);
    setHoveredIndex(null);
  };

  // Handle object selection
  const handleSelect = (index: number) => {
    onSelect(index);
    setIsOpen(false);
    setHoveredIndex(null);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Close menu when clicking escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setHoveredIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Dim Overlay */}
      {isOpen && (
        <div className="radial-overlay" onClick={handleOverlayClick} />
      )}

      {/* Center Button (in navigation bar) */}
      <div className={`radial-menu-trigger ${disabled ? 'disabled' : ''}`}>
        <button
          className="radial-center-button"
          onMouseEnter={handleOpen}
          onClick={() => !isOpen && handleOpen()}
          disabled={disabled}
        >
          <span className="center-button-text">{currentObject?.name || 'Select'}</span>
          <svg className={`center-button-icon ${isOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Radial Menu - Centered on Screen */}
      {isOpen && (
        <div
          ref={menuRef}
          className="radial-menu-container"
          onMouseMove={handleMenuMouseLeave}
          style={{
            '--outer-radius': `${outerRadius}px`,
          } as React.CSSProperties}
        >
          <div className="radial-menu">
            {/* Ring backgrounds */}
            {ringConfig.map((ring, ringIndex) => {
              const ringRadius = baseRadius + ringSpacing * (ringIndex + 1);
              return (
                <div
                  key={`ring-bg-${ringIndex}`}
                  className="ring-background"
                  style={{
                    width: `${ringRadius * 2}px`,
                    height: `${ringRadius * 2}px`,
                    borderColor: `${ring.color}20`,
                  }}
                />
              );
            })}

            {/* Objects on rings */}
            {ringConfig.map((ring, ringIndex) => {
              const ringRadius = baseRadius + ringSpacing * (ringIndex + 1);
              const objectCount = ring.indices.length;

              return ring.indices.map((objectIndex, posIndex) => {
                // Add ring's angular offset to prevent vertical alignment across rings
                const angle = (posIndex / objectCount) * 360 - 90 + ring.angleOffset;
                const object = celestialObjects[objectIndex];
                const isSelected = objectIndex === currentIndex;
                const isHovered = objectIndex === hoveredIndex;

                // Calculate label position (offset from dot)
                // Normalize angle to -180 to 180 range for determining side
                const normalizedAngle = ((angle + 180) % 360) - 180;
                const isRightSide = normalizedAngle > -90 && normalizedAngle < 90;

                return (
                  <div
                    key={object.id}
                    className={`radial-object ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                    style={{
                      '--angle': `${angle}deg`,
                      '--radius': `${ringRadius}px`,
                      '--color': ring.color,
                      '--delay': `${(ringIndex * 0.03) + (posIndex * 0.015)}s`,
                    } as React.CSSProperties}
                    onClick={() => handleSelect(objectIndex)}
                    onMouseEnter={() => setHoveredIndex(objectIndex)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div className="object-dot" />
                    <span
                      className={`object-label ${isRightSide ? 'right' : 'left'} ring-${ringIndex + 1}`}
                      style={{
                        '--label-color': ring.color,
                      } as React.CSSProperties}
                    >
                      {object.name}
                    </span>
                  </div>
                );
              });
            })}

            {/* Center info */}
            <div className="radial-center-info">
              {hoveredIndex !== null ? (
                <>
                  <span className="center-info-name">{celestialObjects[hoveredIndex].name}</span>
                  <span className="center-info-type">{celestialObjects[hoveredIndex].type}</span>
                </>
              ) : (
                <>
                  <span className="center-info-current">{currentObject?.name}</span>
                  <span className="center-info-hint">Click to select</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
