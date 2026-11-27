import { sound } from '../audio/soundEngine';
import { useMuted } from '../audio/useSound';
import './SoundToggle.css';

/** Mute / unmute button. `onMenu` places it in the corner of the main menu (no Menu button there). */
export function SoundToggle({ onMenu = false }: { onMenu?: boolean }) {
  const muted = useMuted();

  const toggle = () => {
    sound.setMuted(!muted);
    if (muted) sound.tick(); // audible confirmation when turning sound back on
  };

  return (
    <button
      className={`sound-toggle ${onMenu ? 'sound-toggle--menu' : ''} ${muted ? 'is-muted' : ''}`}
      onClick={toggle}
      aria-label={muted ? 'Turn sound on' : 'Mute sound'}
      aria-pressed={!muted}
      title={muted ? 'Sound off (click to turn on)' : 'Sound on (click to mute)'}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        {muted ? (
          <path d="M16 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <>
            <path d="M15.5 9.2a4 4 0 0 1 0 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
