import { useCosmicStore } from '../../store/useCosmicStore';
import { celestialObjects } from '../../data/cosmicScale';
import './ScaleLadder.css';

// A vertical size ruler on a logarithmic scale (each step = 10x bigger), from 100 km to beyond the
// observable universe, with familiar landmarks and a "you are here" marker for the current object.
const MIN_LOG = 2;  // 100 km
const MAX_LOG = 24; // 10^24 km

const LANDMARKS: Array<{ km: number; label: string }> = [
  { km: 1e3, label: '1,000 km' },
  { km: 12742, label: 'Earth' },
  { km: 1.3927e6, label: 'Sun' },
  { km: 2.99e8, label: "Earth's orbit" },
  { km: 9.0e9, label: 'Solar System' },
  { km: 9.461e12, label: '1 light-year' },
  { km: 9.461e15, label: '1,000 light-years' },
  { km: 9.783e17, label: 'Milky Way' },
  { km: 9.461e21, label: '1 billion light-years' },
];

const topFor = (km: number) => `${(1 - (Math.log10(km) - MIN_LOG) / (MAX_LOG - MIN_LOG)) * 100}%`;

function shortSize(km: number): string {
  const LY = 9.461e12;
  if (km < 1e6) return `${Math.round(km).toLocaleString('en-US')} km`;
  if (km < 1e9) return `${+(km / 1e6).toFixed(1)} million km`;
  if (km < 0.05 * LY) return `${+(km / 1e9).toFixed(1)} billion km`;
  const ly = km / LY;
  if (ly < 1000) return `${+ly.toFixed(ly < 10 ? 1 : 0)} light-years`;
  if (ly < 1e6) return `${Math.round(ly / 1000).toLocaleString('en-US')},000 light-years`;
  if (ly < 1e9) return `${+(ly / 1e6).toFixed(1)} million light-years`;
  return `${+(ly / 1e9).toFixed(0)} billion light-years`;
}

export function ScaleLadder() {
  const { currentIndex, jumpTo, isTransitioning } = useCosmicStore();
  const current = celestialObjects[currentIndex];

  return (
    <div className="scale-ladder" aria-label="Size scale">
      <div className="ladder-title">Size scale</div>
      <div className="ladder-track">
        <div className="ladder-line" />
        <div className="ladder-progress" style={{ top: topFor(current.sizeKm) }} />
        {Array.from({ length: MAX_LOG - MIN_LOG + 1 }, (_, i) => (
          <div key={i} className="ladder-tick" style={{ top: topFor(10 ** (MIN_LOG + i)) }} />
        ))}
        {LANDMARKS.map((l) => (
          <div key={l.label} className="ladder-landmark" style={{ top: topFor(l.km) }}>
            <span>{l.label}</span>
          </div>
        ))}
        {celestialObjects.map((o, i) => (
          <button
            key={o.id}
            className={`ladder-dot${i <= currentIndex ? ' seen' : ''}${i === currentIndex ? ' current' : ''}`}
            style={{ top: topFor(o.sizeKm) }}
            title={`${o.name}: ${shortSize(o.sizeKm)}`}
            aria-label={o.name}
            onClick={() => !isTransitioning && jumpTo(i)}
          />
        ))}
        <div className="ladder-marker" style={{ top: topFor(current.sizeKm) }}>
          <span className="ladder-marker-name">{current.name}</span>
          <span className="ladder-marker-size">{shortSize(current.sizeKm)}</span>
        </div>
      </div>
      <div className="ladder-foot">each tick = 10× bigger</div>
    </div>
  );
}
