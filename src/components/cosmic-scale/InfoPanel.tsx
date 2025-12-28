import { useCosmicStore } from '../../store/useCosmicStore';
import { celestialObjects } from '../../data/cosmicScale';
import './InfoPanel.css';

// Format size with smart unit switching
function formatSize(sizeKm: number): string {
  const LY_KM = 9.461e12; // 9.461 trillion km
  const AU_KM = 1.496e8; // 149.6 million km

  if (sizeKm < 10000) {
    return `${sizeKm.toLocaleString()} km`;
  } else if (sizeKm < 1e6) {
    return `${(sizeKm / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} thousand km`;
  } else if (sizeKm < 1e9) {
    return `${(sizeKm / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })} million km`;
  } else if (sizeKm < AU_KM * 10) {
    return `${(sizeKm / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })} million km`;
  } else if (sizeKm < LY_KM) {
    const au = sizeKm / AU_KM;
    return `${au.toLocaleString(undefined, { maximumFractionDigits: 1 })} AU`;
  } else if (sizeKm < LY_KM * 1000) {
    const ly = sizeKm / LY_KM;
    return `${ly.toLocaleString(undefined, { maximumFractionDigits: 2 })} light years`;
  } else if (sizeKm < LY_KM * 1e6) {
    const kly = sizeKm / (LY_KM * 1000);
    return `${kly.toLocaleString(undefined, { maximumFractionDigits: 0 })} thousand light years`;
  } else if (sizeKm < LY_KM * 1e9) {
    const mly = sizeKm / (LY_KM * 1e6);
    return `${mly.toLocaleString(undefined, { maximumFractionDigits: 1 })} million light years`;
  } else {
    const bly = sizeKm / (LY_KM * 1e9);
    return `${bly.toLocaleString(undefined, { maximumFractionDigits: 1 })} billion light years`;
  }
}

export function InfoPanel() {
  const { currentIndex } = useCosmicStore();
  const object = celestialObjects[currentIndex];

  return (
    <div className="info-panel">
      <h1 className="object-name">{object.name}</h1>
      <div className="object-type">{object.type}</div>
      <div className="object-size">
        <strong>Size:</strong> {formatSize(object.sizeKm)}
      </div>

      {object.discoveryDate && object.discoveredBy && (
        <div className="discovery-info">
          <strong>Discovered:</strong> {object.discoveryDate}
          {object.discoveredBy !== 'N/A' && ` by ${object.discoveredBy}`}
        </div>
      )}

      <p className="description">{object.description}</p>

      <div className="fun-facts">
        <h3>Fun Facts:</h3>
        <ul>
          {object.funFacts.map((fact, index) => (
            <li key={index}>{fact}</li>
          ))}
        </ul>
      </div>

      <div className="progress-indicator">
        Object {currentIndex + 1} of {celestialObjects.length}
      </div>
    </div>
  );
}
