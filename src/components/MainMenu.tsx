import { useNavigate } from 'react-router-dom';
import { themes } from '../store/useAppStore';
import { sound } from '../audio/soundEngine';
import { useAmbient } from '../audio/useSound';
import './MainMenu.css';

function MainMenu() {
  const navigate = useNavigate();
  useAmbient('menu');

  const handleThemeSelect = (route: string) => {
    sound.tick();
    sound.chime();
    navigate(route);
  };

  return (
    <div className="main-menu">
      <div className="menu-background">
        <video
          className="menu-video"
          autoPlay
          loop
          muted
          playsInline
          src="/videos/space-animation.mp4"
        />
      </div>

      <div className="menu-content">
        <h1 className="menu-title">Our Universe</h1>
        <p className="menu-subtitle">An Interactive Journey Through Space</p>

        <div className="theme-portals">
          {themes.map((theme) => (
            <button
              key={theme.id}
              className="theme-portal"
              onClick={() => handleThemeSelect(theme.route)}
              onMouseEnter={() => sound.hover()}
            >
              <div className="portal-glow" />
              <div className="portal-content">
                <h2 className="portal-title">{theme.name}</h2>
                <p className="portal-tagline">"{theme.tagline}"</p>
                <span className="portal-enter">Enter</span>
              </div>
            </button>
          ))}
        </div>

        <div className="menu-hint">
          Click a portal to begin your journey
        </div>
      </div>
    </div>
  );
}

export default MainMenu;
