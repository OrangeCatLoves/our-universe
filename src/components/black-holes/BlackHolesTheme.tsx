import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BlackHoleRenderer } from './BlackHoleRenderer';
import { BlackHoleInfoPanel } from './BlackHoleInfoPanel';
import { BlackHoleNav } from './BlackHoleNav';
import { BackToMenu } from '../BackToMenu';
import { useBlackHoleStore } from '../../store/useBlackHoleStore';
import { blackHoles } from '../../data/blackHoles';
import { useAmbient, useNavigationSound } from '../../audio/useSound';

/** Rumble depth from mass: ~10 Suns = light, 100 billion Suns = deepest. */
function depthFor(mass: number | null): number {
  if (mass === null) return 0.35;
  return Math.min(Math.max((Math.log10(mass) - 1) / 10, 0), 1);
}

function BlackHolesTheme() {
  const { holeId } = useParams<{ holeId?: string }>();
  const navigate = useNavigate();
  const { currentIndex, jumpTo } = useBlackHoleStore();
  const urlIndex = blackHoles.findIndex((b) => b.id === holeId);
  // On load the link wins (see Skies of Other Worlds): wait for it before syncing the URL or rendering
  const settled = useRef(false);
  if (!settled.current && (urlIndex === -1 || urlIndex === currentIndex)) settled.current = true;

  useAmbient('blackholes', depthFor(blackHoles[currentIndex].massSolar));
  // whoosh on every move (the merger's chirp is timed by the scene, at each merger)
  useNavigationSound(currentIndex);

  // Deep link: /black-holes/:holeId
  useEffect(() => {
    if (holeId) {
      const index = blackHoles.findIndex((b) => b.id === holeId);
      if (index !== -1) jumpTo(index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeId]);

  // Keep the URL in sync for shareable links
  useEffect(() => {
    if (!settled.current) return;
    const bh = blackHoles[currentIndex];
    if (bh) {
      const path = `/black-holes/${bh.id}`;
      if (window.location.pathname !== path) navigate(path + window.location.search, { replace: true });
    }
  }, [currentIndex, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="theme black-holes">
      {settled.current && <BlackHoleRenderer index={currentIndex} />}
      <BlackHoleInfoPanel />
      <BlackHoleNav />
      <BackToMenu />
    </div>
  );
}

export default BlackHolesTheme;
