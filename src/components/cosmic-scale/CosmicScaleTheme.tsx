import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Scene } from './Scene';
import { InfoPanel } from './InfoPanel';
import { Navigation } from './Navigation';
import { BackToMenu } from '../BackToMenu';
import { useCosmicStore } from '../../store/useCosmicStore';
import { celestialObjects } from '../../data/cosmicScale';

function CosmicScaleTheme() {
  const { objectId } = useParams<{ objectId?: string }>();
  const navigate = useNavigate();
  const { currentIndex, jumpTo, setTransitioning, initializeFromIndex, visibleObjects } = useCosmicStore();

  // Ensure store is properly initialized on mount
  useEffect(() => {
    // Reset transitioning state to ensure navigation works
    setTransitioning(false);

    // If visibleObjects is empty or mismatched, reinitialize
    if (visibleObjects.length === 0 || visibleObjects[visibleObjects.length - 1]?.index !== currentIndex) {
      initializeFromIndex(currentIndex);
    }
  }, []); // Only run once on mount

  // Handle deep linking - navigate to object if objectId is in URL
  // Only runs when objectId changes (user navigates directly via URL)
  // NOT when currentIndex changes (that would cause a loop)
  useEffect(() => {
    if (objectId) {
      const index = celestialObjects.findIndex(obj => obj.id === objectId);
      if (index !== -1) {
        jumpTo(index);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectId]); // Intentionally exclude jumpTo and currentIndex

  // Update URL when current object changes (for shareable links)
  useEffect(() => {
    const currentObject = celestialObjects[currentIndex];
    if (currentObject) {
      const newPath = `/cosmic-scale/${currentObject.id}`;
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
    <div className="theme cosmic-scale">
      <Scene />
      <InfoPanel />
      <Navigation />
      <BackToMenu />
    </div>
  );
}

export default CosmicScaleTheme;
