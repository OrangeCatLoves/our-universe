// Turns an object's size into comparisons people can feel ("1,321 Earths would fit inside",
// "light takes 4.6 seconds to cross it"). Everything is computed from the diameter in km.
// Numbers to emphasise are wrapped in **double asterisks** (rendered bold by the info panel).
import { celestialObjects } from '../data/cosmicScale';

const EARTH_KM = 12742;
const SUN_KM = 1.3927e6;
const AU_KM = 1.496e8;
const LY_KM = 9.461e12;
const MOON_DISTANCE_KM = 384400;
const LIGHT_KM_S = 299792.458;
const JET_KM_H = 900;
const CAR_KM_H = 100;
const VOYAGER_KM_S = 17;                 // Voyager 1, the fastest probe leaving the Solar System
const NEPTUNE_ORBIT_KM = 2 * 30.07 * AU_KM;
const MILKY_WAY_KM = 9.783e17;

export interface Comparison {
  icon: string;
  text: string;
}

const round = (n: number, digits = 0) => Number(n.toFixed(digits));

/** 1321 -> "1,321", 1.3e6 -> "1.3 million", 6.5e15 -> "6.5 quadrillion" */
export function formatCount(n: number): string {
  const words: Array<[number, string]> = [
    [1e15, 'quadrillion'],
    [1e12, 'trillion'],
    [1e9, 'billion'],
    [1e6, 'million'],
  ];
  for (const [v, w] of words) {
    if (n >= v) {
      const x = n / v;
      return `${x < 10 ? round(x, 1) : Math.round(x).toLocaleString('en-US')} ${w}`;
    }
  }
  if (n >= 100) return Math.round(n).toLocaleString('en-US');
  return n < 10 ? String(round(n, 1)) : String(Math.round(n));
}

/** Like formatCount, but rounded to 2 significant figures from 2,000 up (3,867 -> "3,900"). */
function formatApprox(n: number): string {
  if (n < 2000 || n >= 1e6) return formatCount(n);
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return (Math.round(n / mag) * mag).toLocaleString('en-US');
}

/** "the Moon", "the Orion Nebula", but "Jupiter" */
function named(name: string): string {
  return /^(Moon|Sun)$|Nebula|Galaxy|Cloud|Void|Supercluster|Universe|Milky Way/.test(name) ? `the ${name}` : name;
}

/** 137.5 -> "137×", 3.86 -> "3.9×", 1.1e6 -> "1.1 million×" */
function formatRatio(r: number): string {
  if (r < 10) return `${round(r, 1)}×`;
  if (r < 1e6) return `${Math.round(r).toLocaleString('en-US')}×`;
  return `${formatCount(r)}×`;
}

function plural(n: number, unit: string) {
  return `${n.toLocaleString('en-US')} ${unit}${n === 1 ? '' : 's'}`;
}

/** A duration in seconds, in the most natural unit. */
export function formatDuration(seconds: number): string {
  const min = 60;
  const hour = 3600;
  const day = 86400;
  const year = 365.25 * day;
  if (seconds < 10) return plural(round(seconds, 1), 'second');
  if (seconds < min) return plural(Math.round(seconds), 'second');
  if (seconds < 10 * min) return plural(round(seconds / min, 1), 'minute');
  if (seconds < hour) return plural(Math.round(seconds / min), 'minute');
  if (seconds < 2 * day) {
    const h = Math.floor(seconds / hour);
    const m = Math.round((seconds - h * hour) / min);
    return m >= 5 && h < 10 ? `${plural(h, 'hour')} ${plural(m, 'minute')}` : plural(Math.round(seconds / hour), 'hour');
  }
  if (seconds < year) return plural(Math.round(seconds / day), 'day');
  const y = seconds / year;
  if (y < 10) return `${round(y, 1)} years`;
  if (y < 1000) return `${Math.round(y)} years`;
  if (y < 1e6) return `${(Math.round(y / 100) * 100).toLocaleString('en-US')} years`;
  return `${formatCount(y)} years`;
}

/** A distance in km, compared to something familiar when it is large. */
function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} metres`;
  if (km < 1e4) return `${Math.round(km).toLocaleString('en-US')} km`;
  if (km < MOON_DISTANCE_KM * 0.8) return `${Number(km.toPrecision(3)).toLocaleString('en-US')} km`;
  if (km < AU_KM * 0.5) {
    const x = km / MOON_DISTANCE_KM;
    return x < 1.5 ? 'about the distance to the Moon' : `${formatRatio(x).replace('×', '')} times the distance to the Moon`;
  }
  return `${formatRatio(km / AU_KM).replace('×', '')} times the distance from Earth to the Sun`;
}

/** Where a star of this diameter would reach if it replaced the Sun. */
function inPlaceOfTheSun(diameterKm: number): string {
  const r = diameterKm / 2 / AU_KM; // radius in AU
  if (r < 0.3) return `In place of the Sun, it would reach **${Math.round((r / 0.387) * 100)}%** of the way to Mercury`;
  if (r < 0.387) return 'In place of the Sun, its surface would reach almost to **Mercury**';
  if (r < 0.72) return 'In place of the Sun, it would swallow **Mercury**';
  if (r < 1.0) return 'In place of the Sun, it would swallow **Mercury and Venus**';
  if (r < 1.52) return 'In place of the Sun, it would swallow **Mercury, Venus and Earth**';
  if (r < 3.3) return 'In place of the Sun, it would swallow **everything out to Mars**';
  if (r < 5.2) return 'In place of the Sun, it would reach **past the asteroid belt**';
  if (r < 9.0) return 'In place of the Sun, it would reach **past Jupiter**';
  if (r < 10) return "In place of the Sun, it would reach **Saturn's orbit**";
  return 'In place of the Sun, it would reach **beyond Saturn**';
}

export function comparisonsFor(index: number): Comparison[] {
  const o = celestialObjects[index];
  const d = o.sizeKm;
  const prev = index > 0 ? celestialObjects[index - 1] : null;
  const isBlackHole = o.type.toLowerCase().includes('black hole');
  const out: Comparison[] = [];

  if (prev) {
    const r = d / prev.sizeKm;
    out.push({
      icon: '↔',
      text: r < 1.12 ? `Only slightly wider than **${named(prev.name)}**` : `**${formatRatio(r)}** wider than ${named(prev.name)}`,
    });
  }

  const lightCross = `Light takes **${formatDuration(d / LIGHT_KM_S)}** to cross it`;

  if (d < 2e5) {
    // moons and planets: Earth for scale, and how long a trip around would take
    if (o.id === 'earth') {
      out.push({ icon: '⚡', text: `Light could circle it **${round(LIGHT_KM_S / (Math.PI * d), 1)} times** in one second` });
    } else if (d < EARTH_KM * 0.9) {
      out.push({ icon: '🌍', text: `**${Math.round((d / EARTH_KM) * 100)}%** of Earth's width: it would take ${formatApprox((EARTH_KM / d) ** 3)} of them to fill Earth` });
    } else if (d < EARTH_KM * 1.1) {
      out.push({ icon: '🌍', text: `Almost exactly **Earth-sized** (${Math.round((d / EARTH_KM) * 100)}% of its width)` });
    } else {
      out.push({ icon: '🌍', text: `**${formatApprox((d / EARTH_KM) ** 3)} Earths** would fit inside` });
    }
    const hours = (Math.PI * d) / JET_KM_H;
    out.push({ icon: '✈', text: `A jet would take **${formatDuration(hours * 3600)}** to fly all the way around it` });
    if (!prev) out.push({ icon: '🚗', text: `Driving straight across it at 100 km/h: **${formatDuration((d / CAR_KM_H) * 3600)}**` });
  } else if (isBlackHole && d < 1e10) {
    const r = d / 2 / AU_KM;
    out.push({
      icon: '☀',
      text: r < 0.387 ? "Placed where the Sun is, it would fit well inside **Mercury's orbit**" : inPlaceOfTheSun(d),
    });
    out.push({ icon: '⚡', text: lightCross });
  } else if (d < 1e8) {
    // stars up to about the size of Mercury's orbit
    const s = d / SUN_KM;
    if (o.id === 'sun') {
      out.push({ icon: '🌍', text: `**${Math.round(d / EARTH_KM)} Earths** side by side would stretch across it` });
    } else if (prev?.id === 'sun') {
      out.push({ icon: '⚡', text: lightCross }); // "wider than the Sun" is already the line above
    } else {
      out.push({ icon: '☀', text: s < 0.95 ? `**${Math.round(s * 100)}%** of the Sun's width` : `**${formatRatio(s)}** wider than the Sun` });
    }
    out.push({ icon: '🌍', text: `**${formatApprox((d / EARTH_KM) ** 3)} Earths** would fit inside` });
  } else if (d < 1e11) {
    // the giant stars
    out.push({ icon: '☀', text: inPlaceOfTheSun(d) });
    out.push({ icon: '⚡', text: lightCross });
  } else if (d < 0.1 * LY_KM) {
    // bigger than the Solar System (TON 618)
    out.push({ icon: '🪐', text: `**${formatRatio(d / NEPTUNE_ORBIT_KM)}** wider than Neptune's whole orbit` });
    out.push({ icon: '⚡', text: lightCross });
  } else if (d < 2e16) {
    // nebulae
    out.push({ icon: '⚡', text: lightCross });
    out.push({ icon: '🛰', text: `Voyager 1, our fastest probe leaving the Solar System, would need **${formatDuration(d / VOYAGER_KM_S)}** to cross it` });
  } else {
    // galaxies and beyond
    if (o.id === 'observable-universe') {
      out.push({ icon: '⚡', text: 'Its edge is **46 billion light-years** away: space kept stretching while the light travelled' });
    } else {
      out.push({ icon: '⚡', text: lightCross });
    }
    const coin = (d / NEPTUNE_ORBIT_KM) * 2e-5; // km, if the Solar System were a 2 cm coin
    out.push({ icon: '🪙', text: `If our whole Solar System were a 2 cm coin, this would be **${formatDistance(coin)}** across` });
    if (d > MILKY_WAY_KM * 5) {
      out.push({ icon: '🌌', text: `**${formatApprox(d / MILKY_WAY_KM)}** Milky Ways side by side` });
    }
  }
  return out;
}
