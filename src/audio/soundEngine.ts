/**
 * Procedural sound for Our Universe (Web Audio API, no audio files).
 *
 *  - Ambient beds per theme: detuned tone clusters through a slowly drifting low-pass filter, a breathy
 *    noise bed and occasional soft "shimmer" notes into a synthetic reverb. Themes crossfade.
 *  - Reactive parameters: `depth` (0..1) lowers the drone (bigger objects / heavier black holes).
 *  - One-shots: whoosh (navigation, panned with the motion), tick/hover (UI), chime (enter a theme),
 *    chirp (gravitational-wave merger).
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is created on the first
 * pointer/key/touch event; anything requested before that is remembered and starts then.
 */

export type AmbientId = 'menu' | 'cosmic' | 'exoplanets' | 'blackholes' | 'skies';
export interface AmbientParams {
  depth?: number; // 0 = lightest, 1 = deepest
}

const MUTE_KEY = 'our-universe-muted';

interface Voice {
  id: AmbientId;
  gain: GainNode;
  setDepth: (depth: number) => void;
  stop: () => void;
}

interface ThemeSpec {
  rootHigh: number;      // root frequency at depth 0 (Hz)
  rootLow: number;       // root frequency at depth 1 (Hz)
  ratios: number[];      // chord partials relative to the root
  waves: OscillatorType[];
  cutoffHigh: number;    // filter cutoff at depth 0
  cutoffLow: number;     // filter cutoff at depth 1
  level: number;         // overall bed level
  noise: { freq: number; q: number; level: number };
  shimmer: { notes: number[]; everyMs: [number, number]; level: number } | null;
  pulseHz: number;       // slow amplitude breathing (0 = none)
  windFromDepth?: boolean; // depth controls how much wind you hear (Skies of Other Worlds)
}

const THEMES: Record<AmbientId, ThemeSpec> = {
  menu: {
    rootHigh: 55, rootLow: 55,
    ratios: [1, 1.5, 2, 2.5, 3],
    waves: ['sine', 'triangle', 'sine', 'sine', 'triangle'],
    cutoffHigh: 900, cutoffLow: 900, level: 0.22,
    noise: { freq: 700, q: 0.6, level: 0.05 },
    shimmer: { notes: [880, 987.8, 1174.7, 1318.5, 1568], everyMs: [3500, 8000], level: 0.035 },
    pulseHz: 0,
  },
  cosmic: {
    rootHigh: 65.4, rootLow: 34.6,
    ratios: [1, 1.5, 2, 3, 4],
    waves: ['sine', 'triangle', 'sine', 'triangle', 'sine'],
    cutoffHigh: 1100, cutoffLow: 380, level: 0.22,
    noise: { freq: 600, q: 0.5, level: 0.045 },
    shimmer: { notes: [784, 880, 1046.5, 1174.7, 1318.5], everyMs: [4000, 9000], level: 0.03 },
    pulseHz: 0,
  },
  exoplanets: {
    rootHigh: 49, rootLow: 49,
    ratios: [1, 1.498, 2, 2.378, 3],
    waves: ['sine', 'sawtooth', 'sine', 'triangle', 'sine'],
    cutoffHigh: 650, cutoffLow: 650, level: 0.2,
    noise: { freq: 900, q: 0.7, level: 0.05 },
    shimmer: { notes: [698.5, 830.6, 932.3, 1046.5, 1244.5], everyMs: [5000, 11000], level: 0.026 },
    pulseHz: 0,
  },
  skies: {
    rootHigh: 49, rootLow: 49,
    ratios: [1, 1.5, 2, 3],
    waves: ['sine', 'triangle', 'sine', 'sine'],
    cutoffHigh: 620, cutoffLow: 620, level: 0.2,
    noise: { freq: 420, q: 0.35, level: 0.09 },
    shimmer: { notes: [659.3, 784, 987.8, 1174.7], everyMs: [6000, 13000], level: 0.022 },
    pulseHz: 0,
    windFromDepth: true,
  },
  blackholes: {
    rootHigh: 41.2, rootLow: 27.5,
    ratios: [1, 1.0015, 2, 1.5],
    waves: ['sine', 'sawtooth', 'sine', 'triangle'],
    cutoffHigh: 220, cutoffLow: 120, level: 0.34,
    noise: { freq: 160, q: 0.4, level: 0.09 },
    shimmer: null,
    pulseHz: 0.22,
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private voice: Voice | null = null;
  private wanted: { id: AmbientId; params: AmbientParams } | null = null;
  private muted: boolean;
  private listeners = new Set<(muted: boolean) => void>();
  private unlockInstalled = false;

  constructor() {
    let stored: string | null = null;
    try {
      stored = typeof localStorage !== 'undefined' ? localStorage.getItem(MUTE_KEY) : null;
    } catch {
      stored = null;
    }
    this.muted = stored === '1';
  }

  /** Install one-time listeners that create/resume the AudioContext on the first user gesture. */
  installUnlock() {
    if (this.unlockInstalled || typeof window === 'undefined') return;
    this.unlockInstalled = true;
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended' && !this.muted) void this.ctx.resume();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(ev, unlock, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (!this.muted) void this.ctx.resume();
    });
  }

  isMuted() {
    return this.muted;
  }

  subscribe(fn: (muted: boolean) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* storage unavailable: keep in memory only */
    }
    this.listeners.forEach((fn) => fn(muted));
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.15);
    if (muted) {
      setTimeout(() => {
        if (this.muted) void ctx.suspend();
      }, 900);
    } else {
      void ctx.resume();
    }
  }

  /** Switch the ambient bed (crossfades). Safe to call before audio is unlocked. */
  setAmbient(id: AmbientId, params: AmbientParams = {}) {
    this.wanted = { id, params };
    if (!this.ctx) return;
    if (this.voice?.id === id) {
      this.voice.setDepth(params.depth ?? 0);
      return;
    }
    const old = this.voice;
    this.voice = this.createAmbient(id, params.depth ?? 0);
    old?.stop();
  }

  /** Update the live bed's parameters (e.g. depth as the user moves through objects). */
  updateAmbient(params: AmbientParams) {
    if (this.wanted) this.wanted.params = { ...this.wanted.params, ...params };
    if (this.voice && params.depth !== undefined) this.voice.setDepth(params.depth);
  }

  // ------------------------------------------------------------------ one-shots
  /** Navigation whoosh. forward = arriving from the right; backward = leaving to the right. */
  whoosh(direction: 'forward' | 'backward', strength = 1) {
    const ctx = this.ready();
    if (!ctx || !this.sfxBus || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const dur = 1.25;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    const [f0, f1] = direction === 'forward' ? [260, 2400] : [2400, 260];
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.85);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * strength, t + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pan = ctx.createStereoPanner();
    const [p0, p1] = direction === 'forward' ? [0.8, -0.2] : [-0.2, 0.8];
    pan.pan.setValueAtTime(p0, t);
    pan.pan.linearRampToValueAtTime(p1, t + dur);
    src.connect(bp).connect(g).connect(pan);
    pan.connect(this.sfxBus);
    this.sendToReverb(pan, 0.25);
    src.start(t, rand(0, 1.5));
    src.stop(t + dur + 0.05);
  }

  /** Soft UI click. */
  tick() {
    this.blip(1700, 1150, 0.05, 0.09);
  }

  /** Even softer hover blip. */
  hover() {
    this.blip(2500, 2200, 0.018, 0.05);
  }

  /** Gentle bell when entering a theme. */
  chime() {
    const ctx = this.ready();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime + 0.02;
    const base = 523.25;
    [[1, 0.06, 2.6], [2.01, 0.025, 1.8], [2.76, 0.02, 1.4], [5.4, 0.008, 0.9]].forEach(([ratio, level, decay]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g);
      g.connect(this.sfxBus!);
      this.sendToReverb(g, 0.6);
      o.start(t);
      o.stop(t + decay + 0.05);
    });
  }

  /** Stylised gravitational-wave chirp (the LIGO "chirp" of two black holes merging). */
  chirp() {
    const ctx = this.ready();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime + 0.05;
    const dur = 1.6;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(38, t);
    o.frequency.exponentialRampToValueAtTime(320, t + dur);
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(76, t);
    o2.frequency.exponentialRampToValueAtTime(640, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.9);   // amplitude grows as the orbit shrinks
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35); // ringdown
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.sfxBus);
    this.sendToReverb(g, 0.5);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.4);
    o2.stop(t + dur + 0.4);
  }

  // ------------------------------------------------------------------ internals
  private ready(): AudioContext | null {
    if (!this.ctx || this.muted) return null;
    return this.ctx;
  }

  private blip(f0: number, f1: number, level: number, dur: number) {
    const ctx = this.ready();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private sendToReverb(node: AudioNode, amount: number) {
    if (!this.ctx || !this.reverb) return;
    const send = this.ctx.createGain();
    send.gain.value = amount;
    node.connect(send).connect(this.reverb);
  }

  private ensureContext() {
    if (this.ctx) return;
    const Ctor: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    // DEV only: a level meter on the final output, so the sound can be checked objectively
    if (import.meta.env.DEV) {
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      comp.connect(an);
      const buf = new Float32Array(an.fftSize);
      (window as unknown as { __soundLevels?: () => { peak: number; rms: number; state: string } }).__soundLevels = () => {
        an.getFloatTimeDomainData(buf);
        let peak = 0;
        let sum = 0;
        for (const v of buf) {
          peak = Math.max(peak, Math.abs(v));
          sum += v * v;
        }
        return { peak, rms: Math.sqrt(sum / buf.length), state: ctx.state };
      };
    }
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(comp);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.7;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    // synthetic hall reverb: exponentially decaying stereo noise
    const irLen = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    // ~4 s of soft (brown-ish) noise, reused by every noise source
    const nLen = ctx.sampleRate * 4;
    this.noiseBuffer = ctx.createBuffer(2, nLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = this.noiseBuffer.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < nLen; i++) {
        last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
        d[i] = last * 3.2;
      }
    }

    if (this.muted) void ctx.suspend();
    if (this.wanted) {
      const { id, params } = this.wanted;
      this.voice = this.createAmbient(id, params.depth ?? 0);
    }
  }

  private createAmbient(id: AmbientId, depth: number): Voice {
    const ctx = this.ctx!;
    const spec = THEMES[id];
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(spec.level, t + 3.0);
    out.connect(this.musicBus!);

    const stoppers: Array<() => void> = [];
    const root = (d: number) => lerp(spec.rootHigh, spec.rootLow, Math.min(Math.max(d, 0), 1));
    const cutoff = (d: number) => lerp(spec.cutoffHigh, spec.cutoffLow, Math.min(Math.max(d, 0), 1));

    // tone cluster -> drifting low-pass
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    lp.frequency.value = cutoff(depth);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rand(0.025, 0.05);
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = cutoff(depth) * 0.35;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lfo.start();
    stoppers.push(() => lfo.stop());

    // optional slow "breathing" of the whole bed (black-hole throb)
    const bed = ctx.createGain();
    bed.gain.value = 1;
    if (spec.pulseHz > 0) {
      const pulse = ctx.createOscillator();
      pulse.frequency.value = spec.pulseHz;
      const pulseAmt = ctx.createGain();
      pulseAmt.gain.value = 0.35;
      pulse.connect(pulseAmt).connect(bed.gain);
      pulse.start();
      stoppers.push(() => pulse.stop());
    }
    lp.connect(bed).connect(out);

    const oscs: Array<{ osc: OscillatorNode; ratio: number }> = [];
    spec.ratios.forEach((ratio, i) => {
      for (const detune of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = spec.waves[i % spec.waves.length];
        o.frequency.value = root(depth) * ratio;
        o.detune.value = detune + rand(-2, 2);
        const g = ctx.createGain();
        g.gain.value = (o.type === 'sawtooth' ? 0.05 : 0.11) / (1 + i * 0.6);
        o.connect(g).connect(lp);
        o.start();
        oscs.push({ osc: o, ratio });
        stoppers.push(() => o.stop());
      }
    });

    // breathy noise bed (wind)
    let noiseGain: GainNode | null = null;
    let windGain: GainNode | null = null;
    if (this.noiseBuffer) {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = spec.noise.freq;
      bp.Q.value = spec.noise.q;
      const ng = ctx.createGain();
      ng.gain.value = spec.windFromDepth ? spec.noise.level * (0.05 + 1.8 * depth) : spec.noise.level;
      noiseGain = ng;
      const wind = ctx.createOscillator();
      wind.frequency.value = rand(0.04, 0.09);
      const windAmt = ctx.createGain();
      windAmt.gain.value = spec.noise.level * 0.6;
      windGain = windAmt;
      wind.connect(windAmt).connect(ng.gain);
      n.connect(bp).connect(ng).connect(out);
      n.start(0, rand(0, 3));
      wind.start();
      stoppers.push(() => n.stop(), () => wind.stop());
    }

    // occasional soft shimmer notes into the reverb
    let shimmerTimer: ReturnType<typeof setTimeout> | null = null;
    if (spec.shimmer) {
      const sh = spec.shimmer;
      const schedule = () => {
        shimmerTimer = setTimeout(() => {
          if (this.ctx && !this.muted && this.voice && this.voice.gain === out) {
            const c = this.ctx;
            const now = c.currentTime;
            const o = c.createOscillator();
            o.type = 'sine';
            o.frequency.value = sh.notes[Math.floor(Math.random() * sh.notes.length)];
            const g = c.createGain();
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(sh.level, now + 0.6);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);
            const p = c.createStereoPanner();
            p.pan.value = rand(-0.7, 0.7);
            o.connect(g).connect(p);
            p.connect(out);
            this.sendToReverb(p, 0.9);
            o.start(now);
            o.stop(now + 4.6);
          }
          schedule();
        }, rand(sh.everyMs[0], sh.everyMs[1]));
      };
      schedule();
    }

    return {
      id,
      gain: out,
      setDepth: (d: number) => {
        const now = ctx.currentTime;
        oscs.forEach(({ osc, ratio }) => osc.frequency.setTargetAtTime(root(d) * ratio, now, 1.2));
        lp.frequency.setTargetAtTime(cutoff(d), now, 1.2);
        lfoAmt.gain.setTargetAtTime(cutoff(d) * 0.35, now, 1.2);
        if (spec.windFromDepth && noiseGain && windGain) {
          noiseGain.gain.setTargetAtTime(spec.noise.level * (0.05 + 1.8 * d), now, 1.5);
          windGain.gain.setTargetAtTime(spec.noise.level * (0.05 + 1.2 * d), now, 1.5);
        }
      },
      stop: () => {
        const now = ctx.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), now);
        out.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
        if (shimmerTimer) clearTimeout(shimmerTimer);
        setTimeout(() => {
          stoppers.forEach((s) => {
            try {
              s();
            } catch {
              /* already stopped */
            }
          });
          out.disconnect();
        }, 2700);
      },
    };
  }
}

export const sound = new SoundEngine();

// DEV only: expose the engine for automated checks
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __sound?: SoundEngine }).__sound = sound;
}
