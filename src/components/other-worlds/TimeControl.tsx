import { useEffect, useRef, useState } from 'react';
import { skyClock, useOtherWorldsStore } from '../../store/useOtherWorldsStore';
import { sound } from '../../audio/soundEngine';

/** Play / pause and scrub the day: reads the shared clock every frame without re-rendering. */
export function TimeControl() {
  const slider = useRef<HTMLInputElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(skyClock.playing);
  const { labels, toggleLabels } = useOtherWorldsStore();

  useEffect(() => {
    let raf = 0;
    let lastPlaying: boolean | null = null; // sync on the first frame (a world may have just paused it)
    const tick = () => {
      if (slider.current && document.activeElement !== slider.current) slider.current.value = String(Math.round(skyClock.phase * 1000));
      const text = performance.now() < skyClock.noticeUntil ? skyClock.notice : skyClock.label;
      if (label.current && label.current.textContent !== text) label.current.textContent = text;
      if (skyClock.playing !== lastPlaying) {
        lastPlaying = skyClock.playing;
        setPlaying(lastPlaying); // e.g. a new world started playing
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggle = () => {
    skyClock.playing = !skyClock.playing;
    setPlaying(skyClock.playing);
    sound.tick();
  };

  return (
    <div className="time-control" aria-label="Time of day">
      <button className="time-play" onClick={toggle} aria-label={playing ? 'Pause time-lapse' : 'Play time-lapse'}>
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
        )}
      </button>
      <div className="time-body">
        <span className="time-label" ref={label} />
        <input
          ref={slider}
          className="time-slider"
          type="range"
          min={0}
          max={1000}
          defaultValue={Math.round(skyClock.phase * 1000)}
          aria-label="Time of day"
          onPointerDown={() => {
            skyClock.playing = false;
            setPlaying(false);
          }}
          onInput={(e) => {
            skyClock.phase = Number((e.target as HTMLInputElement).value) / 1000;
          }}
        />
      </div>
      <button className={`time-labels ${labels ? 'on' : ''}`} onClick={toggleLabels} aria-pressed={labels} title="Show names in the sky">
        Labels
      </button>
    </div>
  );
}
