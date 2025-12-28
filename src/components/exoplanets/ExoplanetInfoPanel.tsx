import { useExoplanetStore } from '../../store/useExoplanetStore';
import { exoplanets } from '../../data/extremeExoplanets';
import './ExoplanetInfoPanel.css';

// Format distance with appropriate units
function formatDistance(lightYears: number): string {
  if (lightYears < 10) {
    return `${lightYears.toFixed(2)} light-years`;
  } else if (lightYears < 1000) {
    return `${Math.round(lightYears)} light-years`;
  } else {
    return `${(lightYears / 1000).toFixed(1)}k light-years`;
  }
}

// Format orbital period
function formatOrbitalPeriod(days: number): string {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours} hours`;
  } else if (days < 30) {
    return `${days.toFixed(1)} days`;
  } else if (days < 365) {
    const months = days / 30;
    return `${months.toFixed(1)} months`;
  } else {
    const years = days / 365;
    return `${years.toFixed(1)} years`;
  }
}

export function ExoplanetInfoPanel() {
  const { currentIndex } = useExoplanetStore();
  const planet = exoplanets[currentIndex];

  return (
    <div className="exoplanet-info-panel">
      <h1 className="planet-name">{planet.name}</h1>
      <div className="planet-type">{planet.type}</div>

      {/* Exoplanet-specific highlight section */}
      <div className="planet-details">
        <div className="detail-row">
          <span className="detail-icon">★</span>
          <span className="detail-label">Host Star:</span>
          <span className="detail-value">{planet.hostStar}</span>
        </div>
        <div className="detail-row">
          <span className="detail-icon">◎</span>
          <span className="detail-label">Distance:</span>
          <span className="detail-value distance">{formatDistance(planet.distanceLightYears)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-icon">⟳</span>
          <span className="detail-label">Orbital Period:</span>
          <span className="detail-value">{formatOrbitalPeriod(planet.orbitalPeriodDays)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-icon">📅</span>
          <span className="detail-label">Discovered:</span>
          <span className="detail-value">{planet.discoveryYear}</span>
        </div>
        {planet.surfaceTemp && (
          <div className="detail-row">
            <span className="detail-icon">🌡</span>
            <span className="detail-label">Temperature:</span>
            <span className="detail-value temp">{planet.surfaceTemp}</span>
          </div>
        )}
      </div>

      {/* Key Feature - prominent display */}
      <div className="key-feature">
        <span className="key-feature-label">Key Feature</span>
        <p className="key-feature-text">"{planet.keyFeature}"</p>
      </div>

      <p className="description">{planet.description}</p>

      <div className="fun-facts">
        <h3>Fun Facts:</h3>
        <ul>
          {planet.funFacts.map((fact, index) => (
            <li key={index}>{fact}</li>
          ))}
        </ul>
      </div>

      <div className="progress-indicator">
        Planet {currentIndex + 1} of {exoplanets.length}
      </div>
    </div>
  );
}
