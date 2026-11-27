import { Routes, Route, useLocation } from 'react-router-dom';
import './App.css';

// Lazy load themes for better performance
import { lazy, Suspense, useEffect } from 'react';
import { sound } from './audio/soundEngine';
import { SoundToggle } from './components/SoundToggle';

const MainMenu = lazy(() => import('./components/MainMenu'));
const CosmicScaleTheme = lazy(() => import('./components/cosmic-scale/CosmicScaleTheme'));
const ExoplanetsTheme = lazy(() => import('./components/exoplanets/ExoplanetsTheme'));
const BlackHolesTheme = lazy(() => import('./components/black-holes/BlackHolesTheme'));

// Loading fallback
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-text">Loading...</div>
    </div>
  );
}

function App() {
  const { pathname } = useLocation();

  // Audio may only start after a user gesture; this arms the first click/key/touch to unlock it
  useEffect(() => {
    sound.installUnlock();
  }, []);

  return (
    <div className="app">
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/cosmic-scale" element={<CosmicScaleTheme />} />
          <Route path="/cosmic-scale/:objectId" element={<CosmicScaleTheme />} />
          <Route path="/extreme-exoplanets" element={<ExoplanetsTheme />} />
          <Route path="/extreme-exoplanets/:planetId" element={<ExoplanetsTheme />} />
          <Route path="/black-holes" element={<BlackHolesTheme />} />
          <Route path="/black-holes/:holeId" element={<BlackHolesTheme />} />
        </Routes>
      </Suspense>
      <SoundToggle onMenu={pathname === '/'} />
    </div>
  );
}

export default App;
