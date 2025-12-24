import { Scene } from './components/Scene';
import { InfoPanel } from './components/InfoPanel';
import { Navigation } from './components/Navigation';
import './App.css';

function App() {
  return (
    <div className="app">
      <Scene />
      <InfoPanel />
      <Navigation />
    </div>
  );
}

export default App;
