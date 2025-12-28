import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExoplanetScene } from './ExoplanetScene';
import { ExoplanetInfoPanel } from './ExoplanetInfoPanel';
import { StarPathNav } from './StarPathNav';
import { BackToMenu } from '../BackToMenu';
import { useExoplanetStore } from '../../store/useExoplanetStore';
import { exoplanets } from '../../data/extremeExoplanets';

function ExoplanetsTheme() {
  const { planetId } = useParams<{ planetId?: string }>();
  const navigate = useNavigate();
  const { currentIndex, jumpTo } = useExoplanetStore();

  // Handle deep linking - navigate to planet if planetId is in URL
  // Only runs when planetId changes (user navigates directly via URL)
  // NOT when currentIndex changes (that would cause a loop)
  useEffect(() => {
    if (planetId) {
      const index = exoplanets.findIndex(planet => planet.id === planetId);
      if (index !== -1) {
        jumpTo(index);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planetId]); // Intentionally exclude jumpTo and currentIndex

  // Update URL when current planet changes (for shareable links)
  useEffect(() => {
    const currentPlanet = exoplanets[currentIndex];
    if (currentPlanet) {
      const newPath = `/extreme-exoplanets/${currentPlanet.id}`;
      // Only update if different to avoid unnecessary history entries
      if (window.location.pathname !== newPath) {
        navigate(newPath, { replace: true });
      }
    }
  }, [currentIndex, navigate]);

  // Handle Escape key to go back to menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="theme exoplanets">
      <ExoplanetScene />
      <ExoplanetInfoPanel />
      <StarPathNav />
      <BackToMenu />
    </div>
  );
}

export default ExoplanetsTheme;
