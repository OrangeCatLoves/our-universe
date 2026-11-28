import * as THREE from 'three';
import type { WorldSpec, Placement } from './worlds';

// Local frame on the ground: x = east, y = up, z = south (north is -z).
const deg = THREE.MathUtils.degToRad;

/** Unit vector for a compass azimuth (0 = north, 90 = east) and elevation, in degrees. */
export function dirFromAzEl(azDeg: number, elDeg: number, out = new THREE.Vector3()): THREE.Vector3 {
  const az = deg(azDeg);
  const el = deg(elDeg);
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export function azElFromDir(d: THREE.Vector3): { az: number; el: number } {
  const el = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)));
  let az = THREE.MathUtils.radToDeg(Math.atan2(d.x, -d.z));
  if (az < 0) az += 360;
  return { az, el };
}

/**
 * The Sun's daily path: a great circle rising in the east, highest in the south at noon, setting in the
 * west (rotated by the world's azimuth offset). phase: 0 = midnight, 0.25 = sunrise, 0.5 = noon,
 * 0.75 = sunset. Returns the direction and the rotation axis (the celestial pole) of the sky.
 */
export class SkyPath {
  readonly east = new THREE.Vector3();
  readonly southUp = new THREE.Vector3();
  readonly axis = new THREE.Vector3();

  constructor(maxElevDeg: number, azimuthDeg: number) {
    dirFromAzEl(90 + azimuthDeg, 0, this.east);
    dirFromAzEl(180 + azimuthDeg, maxElevDeg, this.southUp);
    this.axis.crossVectors(this.east, this.southUp).normalize();
  }

  /** Direction at an angle theta along the path (0 = rising point, pi/2 = highest, pi = setting). */
  at(theta: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.east).multiplyScalar(Math.cos(theta)).addScaledVector(this.southUp, Math.sin(theta));
  }

  static theta(phase: number): number {
    return 2 * Math.PI * (phase - 0.25);
  }
}

/** Where the sun(s) are at a given day phase. */
export function sunDirections(spec: WorldSpec, path: SkyPath, phase: number, out: THREE.Vector3[]): void {
  const fixed = spec.sunPath.fixed;
  spec.suns.forEach((s, i) => {
    if (fixed) {
      dirFromAzEl(fixed.az, fixed.el, out[i]);
      return;
    }
    const trail = s.trail;
    path.at(SkyPath.theta(phase - (trail?.phase ?? 0)), out[i]);
    if (trail) {
      out[i].y += Math.sin(deg(trail.elevDeg));
      out[i].normalize();
    }
  });
}

/** Direction of a sky body at a given day phase. */
export function bodyDirection(place: Placement, spec: WorldSpec, path: SkyPath, phase: number, out = new THREE.Vector3()): THREE.Vector3 {
  if ('az' in place) return dirFromAzEl(place.az, place.el, out);
  if ('pathPhase' in place) return path.at(SkyPath.theta(place.pathPhase), out);
  if ('followSun' in place) return path.at(SkyPath.theta(phase) - place.followSun, out);
  const o = place.orbit;
  const p = new SkyPath(o.maxElDeg, spec.sunPath.azimuthDeg);
  const theta = 2 * Math.PI * (o.rate * phase + o.phase0);
  out.copy(p.east).multiplyScalar(Math.cos(theta) * (o.reverse ? -1 : 1)).addScaledVector(p.southUp, Math.sin(theta));
  return out;
}

/** Fraction of a star's disk still visible when a body (of angular radius R) passes in front of it. */
export function eclipseFactor(sunDir: THREE.Vector3, sunRadius: number, bodyDir: THREE.Vector3, bodyRadius: number): number {
  const sep = Math.acos(THREE.MathUtils.clamp(sunDir.dot(bodyDir), -1, 1));
  if (sep >= bodyRadius + sunRadius) return 1;
  if (sep <= bodyRadius - sunRadius) return 0;
  return (sep - (bodyRadius - sunRadius)) / (2 * sunRadius);
}

/** "Sunrise", "Morning", ... for the time control. */
export function partOfDay(phase: number, sunElevation: number, fixedSun: boolean): string {
  if (fixedSun) return 'Eternal sunset';
  const el = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sunElevation, -1, 1)));
  const p = ((phase % 1) + 1) % 1;
  if (el < -12) return 'Night';
  if (el < 0) return p < 0.5 ? 'Before dawn' : 'Dusk';
  if (el < 8) return p < 0.5 ? 'Sunrise' : 'Sunset';
  if (el < 25) return p < 0.5 ? 'Morning' : 'Late afternoon';
  return p < 0.46 ? 'Morning' : p < 0.54 ? 'Midday' : 'Afternoon';
}
