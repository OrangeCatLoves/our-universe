import { Routes, Route } from 'react-router-dom';
import './App.css';

// Lazy load themes for better performance
import { lazy, Suspense } from 'react';

const MainMenu = lazy(() => import('./components/MainMenu'));
const CosmicScaleTheme = lazy(() => import('./components/cosmic-scale/CosmicScaleTheme'));
const ExoplanetsTheme = lazy(() => import('./components/exoplanets/ExoplanetsTheme'));

// Loading fallback
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-text">Loading...</div>
    </div>
  );
}

function App() {
  return (
    <div className="app">
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/cosmic-scale" element={<CosmicScaleTheme />} />
          <Route path="/cosmic-scale/:objectId" element={<CosmicScaleTheme />} />
          <Route path="/extreme-exoplanets" element={<ExoplanetsTheme />} />
          <Route path="/extreme-exoplanets/:planetId" element={<ExoplanetsTheme />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
