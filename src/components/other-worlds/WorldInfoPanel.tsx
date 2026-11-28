import { useOtherWorldsStore, requestLook } from '../../store/useOtherWorldsStore';
import { otherWorlds } from '../../data/otherWorlds';
import { lookTargets } from './worlds';
import { sound } from '../../audio/soundEngine';
import '../exoplanets/ExoplanetInfoPanel.css';

export function WorldInfoPanel() {
  const { currentIndex, panelCollapsed, togglePanel } = useOtherWorldsStore();
  const world = otherWorlds[currentIndex];
  const targets = lookTargets(world.id);

  return (
    <div className={`exoplanet-info-panel world-info-panel${panelCollapsed ? ' is-collapsed' : ''}`}>
      <button
        className="panel-toggle"
        onClick={() => {
          sound.tick();
          togglePanel();
        }}
        aria-expanded={!panelCollapsed}
        aria-label={panelCollapsed ? 'Show details' : 'Hide details to see the whole view'}
        title={panelCollapsed ? 'Show details' : 'Hide details'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={panelCollapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="world-kicker">Standing on</div>
      <h1 className="planet-name">{world.name}</h1>
      {panelCollapsed ? null : (
      <>
      <div className="planet-type">{world.place}</div>

      {targets.length > 0 && (
        <div className="look-at">
          <span className="look-at-label">Look at</span>
          <div className="look-at-chips">
            {targets.map((t) => (
              <button
                key={t.id}
                className="look-at-chip"
                onClick={() => {
                  sound.tick();
                  requestLook(t.id);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="description">{world.description}</p>

      <div className="fun-facts">
        <h3>Things to notice:</h3>
        <ul>
          {world.facts.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      </div>

      <div className="progress-indicator">
        {world.dayLength} · drag to look around, scroll to zoom
      </div>
      </>
      )}
    </div>
  );
}
