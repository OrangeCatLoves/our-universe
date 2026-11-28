import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WorldScene } from './WorldScene';
import { WorldInfoPanel } from './WorldInfoPanel';
import { WorldNav } from './WorldNav';
import { TimeControl } from './TimeControl';
import { BackToMenu } from '../BackToMenu';
import { useOtherWorldsStore } from '../../store/useOtherWorldsStore';
import { otherWorlds } from '../../data/otherWorlds';
import { useAmbient, useNavigationSound } from '../../audio/useSound';
import './OtherWorlds.css';

// how windy each world sounds (0 = airless silence)
const WIND: Record<string, number> = {
  mars: 0.55,
  titan: 0.75,
  'proxima-b': 0.45,
  'kepler-16b': 0.5,
  pluto: 0.04,
};

function OtherWorldsTheme() {
  const { worldId } = useParams<{ worldId?: string }>();
  const navigate = useNavigate();
  const { currentIndex, jumpTo } = useOtherWorldsStore();
  const world = otherWorlds[currentIndex];
  const urlIndex = otherWorlds.findIndex((w) => w.id === worldId);
  // On load the link wins: until the store has switched to the linked world, don't write the
  // previously remembered world back into the URL (and don't build its scene).
  const settled = useRef(false);
  if (!settled.current && (urlIndex === -1 || urlIndex === currentIndex)) settled.current = true;

  useAmbient('skies', WIND[world.id] ?? 0);
  useNavigationSound(currentIndex);

  // Deep link: /other-worlds/:worldId
  useEffect(() => {
    if (worldId) {
      const index = otherWorlds.findIndex((w) => w.id === worldId);
      if (index !== -1) jumpTo(index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId]);

  // Keep the URL in sync for shareable links
  useEffect(() => {
    if (!settled.current) return;
    const path = `/other-worlds/${world.id}`;
    if (window.location.pathname !== path) navigate(path + window.location.search, { replace: true });
  }, [world.id, currentIndex, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="theme other-worlds">
      {settled.current && <WorldScene index={currentIndex} />}
      <WorldInfoPanel />
      <TimeControl />
      <WorldNav />
      <BackToMenu />
    </div>
  );
}

export default OtherWorldsTheme;
