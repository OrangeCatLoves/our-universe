import { useBlackHoleStore } from '../../store/useBlackHoleStore';
import { blackHoles } from '../../data/blackHoles';
import '../exoplanets/ExoplanetInfoPanel.css';

const KM_PER_SOLAR_MASS_RS = 2.95; // Schwarzschild radius per solar mass
const KM_PER_AU = 1.496e8;

function big(n: number): string {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)} million`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function formatMass(m: number): string {
  return `${big(m)} ${m === 1 ? 'Sun' : 'Suns'}`;
}

function formatDistance(ly: number): string {
  return `${big(ly)} light-years`;
}

/** Event-horizon diameter from mass, in the most readable unit. */
function formatHorizon(m: number): string {
  const km = 2 * KM_PER_SOLAR_MASS_RS * m;
  if (km < 1e4) return `${Math.round(km).toLocaleString('en-US')} km across`;
  if (km < 1e9) return `${big(Math.round(km))} km across`;
  return `${Math.round(km / KM_PER_AU).toLocaleString('en-US')} AU across`;
}

export function BlackHoleInfoPanel() {
  const { currentIndex } = useBlackHoleStore();
  const bh = blackHoles[currentIndex];
  const intro = bh.massSolar === null;

  return (
    <div className="exoplanet-info-panel">
      <h1 className="planet-name">{bh.name}</h1>
      <div className="planet-type">{bh.type}</div>

      {!intro && (
        <div className="planet-details">
          <div className="detail-row">
            <span className="detail-icon">●</span>
            <span className="detail-label">Mass:</span>
            <span className="detail-value">{bh.massNote ?? formatMass(bh.massSolar!)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-icon">◯</span>
            <span className="detail-label">Event horizon:</span>
            <span className="detail-value">{formatHorizon(bh.massSolar!)}</span>
          </div>
          {bh.distanceLy !== null && (
            <div className="detail-row">
              <span className="detail-icon">◎</span>
              <span className="detail-label">Distance:</span>
              <span className="detail-value distance">{formatDistance(bh.distanceLy)}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-icon">📅</span>
            <span className="detail-label">Discovered:</span>
            <span className="detail-value">{bh.discovered}</span>
          </div>
        </div>
      )}

      <div className="key-feature">
        <span className="key-feature-label">{intro ? 'In one line' : 'Key Feature'}</span>
        <p className="key-feature-text">"{bh.keyFeature}"</p>
      </div>

      <p className="description">{bh.description}</p>

      <div className="fun-facts">
        <h3>{intro ? 'What you are seeing:' : 'Fun Facts:'}</h3>
        <ul>
          {bh.funFacts.map((fact, i) => <li key={i}>{fact}</li>)}
        </ul>
      </div>

      <div className="progress-indicator">
        {currentIndex + 1} of {blackHoles.length} · drag to orbit, scroll to zoom
      </div>
    </div>
  );
}
