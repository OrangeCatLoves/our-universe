import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer } from '@react-three/postprocessing';
import { BloomEffect } from 'postprocessing';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { blackHoles } from '../../data/blackHoles';
import { lookFor } from './looks';
import type { Look, RGB } from './looks';
import { lensingVertex, lensingFragment } from './lensingShader';
import { getNoiseTexture } from './noiseTexture';
import { GradeEffect } from './gradeEffect';
import { sound } from '../../audio/soundEngine';

// ------------------------------------------------------------------ quality
interface Tier { dpr: number; steps: number; samples: number; octaves: number }
const TIERS: Tier[] = [
  { dpr: 0.55, steps: 170, samples: 4, octaves: 3 },
  { dpr: 0.75, steps: 230, samples: 5, octaves: 4 },
  { dpr: 1.0, steps: 300, samples: 6, octaves: 4 },
];
const isCoarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

// DEV only: ?t=12 freezes time at 12 s with a still camera (for reviewing stills); ?q=0|1|2 forces a quality tier
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const FROZEN_T = import.meta.env.DEV ? parseFloat(params.get('t') ?? '') : NaN;
const FROZEN = Number.isFinite(FROZEN_T);
const FORCED_TIER = import.meta.env.DEV && params.get('q') !== null ? Math.min(2, Math.max(0, Number(params.get('q')))) : null;

// ------------------------------------------------------------------ transitions ("dive" through the horizon)
const DIVE_OUT_S = 0.85;
const DIVE_IN_S = 1.8;
const DIVE_CLOSE = 2.8;

// ------------------------------------------------------------------ binary merger (GW150914)
const INSPIRAL_S = 14;
const MERGED_S = 5;
const CYCLE_S = INSPIRAL_S + MERGED_S;
const BINARY_START_S = 6;
const CHIRP_LEAD_S = 1.6;
const PHASE_K = 0.9 / (0.625 * Math.pow(INSPIRAL_S, -0.375));

function binaryState(t: number, h1: THREE.Vector4, h2: THREE.Vector4) {
  const cyc = t % CYCLE_S;
  const u = INSPIRAL_S - cyc;
  const sep = u > 0 ? 4.6 * Math.pow(u / INSPIRAL_S, 0.25) : 0;
  if (sep < 1.5) {
    h1.set(0, 0, 0, 0.95);
    h2.set(0, 0, 0, 0);
    return { merged: true, sep: 0, phase: 0, sinceMerge: Math.max(cyc - (INSPIRAL_S - 0.16), 0) };
  }
  const phase = -PHASE_K * Math.pow(u, 0.625);
  const x = Math.cos(phase);
  const z = Math.sin(phase);
  h1.set(x * sep * 0.45, 0, z * sep * 0.45, 0.55);
  h2.set(-x * sep * 0.55, 0, -z * sep * 0.55, 0.45);
  return { merged: false, sep, phase, sinceMerge: 0 };
}

// ------------------------------------------------------------------ helpers
const deg = THREE.MathUtils.degToRad;
const UP = new THREE.Vector3(0, 1, 0);

function homePosition(look: Look): THREE.Vector3 {
  const el = deg(look.camera.elevationDeg);
  return new THREE.Vector3(0, Math.sin(el), Math.cos(el)).multiplyScalar(look.camera.distance);
}

function definesFor(look: Look): Record<string, string> {
  const d: Record<string, string> = {};
  if (look.disk) {
    d.DISK = '';
    if (look.disk.thick) d.THICK_DISK = '';
  }
  if (look.jet) d.JET = '';
  if (look.companion) {
    d.COMPANION = '';
    if (look.companion.stream) d.STREAM = '';
  }
  if (look.hotspot) d.HOTSPOT = '';
  if (look.binary) d.BINARY = '';
  if (look.gravitationalWaves) d.GWAVES = '';
  if (look.glow) d.GLOW = '';
  const s = look.sky;
  if (s.stars > 0) d.STARS = '';
  if (s.milkyWay) d.MILKYWAY = '';
  if (s.diffuse) d.DIFFUSE = '';
  if (s.filaments) d.FILAMENTS = '';
  if (s.echoes) d.ECHOES = '';
  if (s.galaxy) d.GALAXY = '';
  if (s.halo) d.HALO = '';
  return d;
}

type U = Record<string, THREE.IUniform>;
const setV3 = (u: THREE.IUniform, c: RGB) => (u.value as THREE.Vector3).set(c[0], c[1], c[2]);

function createUniforms(): U {
  return {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uFlowTime: { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
    uCamRot: { value: new THREE.Matrix3() },
    uTanHalfFov: { value: Math.tan(deg(25)) },
    uShift: { value: new THREE.Vector2() },
    uRoll: { value: 0 },
    uNoise: { value: getNoiseTexture() },
    uSteps: { value: 300 },
    uDiskSamples: { value: 6 },
    uOctaves: { value: 4 },
    uEscape: { value: 60 },
    uFade: { value: 0 },
    uCenterDir: { value: new THREE.Vector3(0, 0, -1) },
    uHole1: { value: new THREE.Vector4(0, 0, 0, 1) },
    uHole2: { value: new THREE.Vector4(0, 0, 0, 0) },
    uDiskBright: { value: 0 },
    uDiskIn: { value: 3 },
    uDiskOut: { value: 12 },
    uDiskThick: { value: 0.02 },
    uDiskOpacity: { value: 1 },
    uDiskHot: { value: new THREE.Vector3(1, 1, 1) },
    uDiskCool: { value: new THREE.Vector3(1, 0.5, 0.2) },
    uTempFall: { value: 1 },
    uProfile: { value: 1.5 },
    uRadialScale: { value: 2 },
    uAzimuthScale: { value: 1.5 },
    uTurb: { value: 0.3 },
    uRings: { value: 0.3 },
    uContrast: { value: 1.4 },
    uDoppler: { value: 1 },
    uSpeed: { value: 0.3 },
    uJetAxis: { value: new THREE.Vector3(0, 1, 0) },
    uJetColor: { value: new THREE.Vector3(0.6, 0.7, 1) },
    uJet: { value: 0 },
    uJetWidth: { value: 1 },
    uJetLength: { value: 15 },
    uKnotSpeed: { value: 4 },
    uJetCounter: { value: 0.3 },
    uComp: { value: new THREE.Vector4(0, 0, 0, 0) },
    uCompAxis: { value: new THREE.Vector3(1, 0, 0) },
    uCompStretch: { value: 1 },
    uCompColor: { value: new THREE.Vector3(1, 1, 1) },
    uCompBright: { value: 1 },
    uStreamPts: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
    uStreamBounds: { value: new THREE.Vector4(0, 0, 0, 0) },
    uStreamColor: { value: new THREE.Vector3(1, 1, 1) },
    uStreamBright: { value: 0 },
    uStreamWidth: { value: 1 },
    uSpot: { value: new THREE.Vector4(0, 0, 0, 0.5) },
    uSpotVel: { value: new THREE.Vector3() },
    uSpotColor: { value: new THREE.Vector3() },
    uGlow: { value: 0 },
    uGlowColor: { value: new THREE.Vector3(1, 1, 1) },
    uGwAmp: { value: 0 },
    uOrbitPhase: { value: 0 },
    uBurstR: { value: -1 },
    uBurstAmp: { value: 0 },
    uStars: { value: 1 },
    uStarDensity: { value: 1 },
    uStarTint: { value: new THREE.Vector3(1, 1, 1) },
    uGalNormal: { value: new THREE.Vector3(0, 1, 0) },
    uGalCenter: { value: new THREE.Vector3(0, 0, -1) },
    uMilkyWay: { value: 0 },
    uDiffuse: { value: 0 },
    uDiffuseColor: { value: new THREE.Vector3() },
    uDust: { value: 0 },
    uFil: { value: 0 },
    uFilColor: { value: new THREE.Vector3() },
    uFilKnots: { value: new THREE.Vector3() },
    uEcho: { value: 0 },
    uEchoColor: { value: new THREE.Vector3() },
    uGalaxy: { value: 0 },
    uGalaxyColor: { value: new THREE.Vector3() },
    uClusters: { value: 0 },
    uHalo: { value: 0 },
    uHaloColor: { value: new THREE.Vector3() },
  };
}

/** Static (per-look) uniforms. Moving parts are updated every frame in `animate`. */
function applyLook(u: U, look: Look) {
  const d = look.disk;
  u.uDiskBright.value = d ? d.brightness : 0;
  if (d) {
    u.uDiskIn.value = d.inner;
    u.uDiskOut.value = d.outer;
    u.uDiskThick.value = d.thickness;
    u.uDiskOpacity.value = d.opacity;
    setV3(u.uDiskHot, d.hot);
    setV3(u.uDiskCool, d.cool);
    u.uTempFall.value = d.tempFalloff;
    u.uProfile.value = d.profile;
    u.uRadialScale.value = d.radialScale;
    u.uAzimuthScale.value = d.azimuthScale;
    u.uTurb.value = d.turbulence;
    u.uRings.value = d.rings;
    u.uContrast.value = d.contrast;
    u.uDoppler.value = d.doppler;
    u.uSpeed.value = d.speed;
  }
  const j = look.jet;
  u.uJet.value = j ? j.strength : 0;
  if (j) {
    setV3(u.uJetColor, j.color);
    u.uJetWidth.value = j.width;
    u.uJetLength.value = j.length;
    u.uKnotSpeed.value = j.knotSpeed;
    u.uJetCounter.value = j.counter;
    (u.uJetAxis.value as THREE.Vector3).set(0, 1, 0);
  }
  const c = look.companion;
  if (c) {
    setV3(u.uCompColor, c.color);
    u.uCompBright.value = c.brightness;
    u.uCompStretch.value = c.stretch;
    if (c.stream) {
      setV3(u.uStreamColor, c.stream.color);
      u.uStreamBright.value = c.stream.brightness;
      u.uStreamWidth.value = c.stream.width;
    }
  }
  const h = look.hotspot;
  if (h) {
    setV3(u.uSpotColor, h.color);
    (u.uSpot.value as THREE.Vector4).w = h.radius;
  }
  u.uGlow.value = look.glow ? look.glow.strength : 0;
  if (look.glow) setV3(u.uGlowColor, look.glow.color);
  (u.uHole1.value as THREE.Vector4).set(0, 0, 0, 1);
  (u.uHole2.value as THREE.Vector4).set(0, 0, 0, 0);

  const s = look.sky;
  u.uStars.value = s.stars;
  u.uStarDensity.value = s.starDensity;
  setV3(u.uStarTint, s.starTint);
  u.uMilkyWay.value = s.milkyWay ? s.milkyWay.strength : 0;
  if (s.milkyWay) {
    // orient the Milky Way so its band runs behind the hole as first seen, tilted across the frame
    const view0 = homePosition(look).negate().normalize();
    const right0 = new THREE.Vector3().crossVectors(view0, UP).normalize();
    const up0 = new THREE.Vector3().crossVectors(right0, view0).normalize();
    const tilt = deg(s.milkyWay.tiltDeg);
    const n = up0.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(right0, Math.sin(tilt));
    n.addScaledVector(view0, Math.sin(deg(s.milkyWay.offsetDeg))).normalize();
    const along = new THREE.Vector3().crossVectors(n, view0).normalize();
    (u.uGalNormal.value as THREE.Vector3).copy(n);
    (u.uGalCenter.value as THREE.Vector3).copy(view0.clone().multiplyScalar(Math.cos(0.7)).addScaledVector(along, Math.sin(0.7)).normalize());
  }
  u.uDiffuse.value = s.diffuse ? s.diffuse.strength : 0;
  if (s.diffuse) setV3(u.uDiffuseColor, s.diffuse.color);
  u.uDust.value = s.dust ?? 0;
  u.uFil.value = s.filaments ? s.filaments.strength : 0;
  if (s.filaments) {
    setV3(u.uFilColor, s.filaments.color);
    setV3(u.uFilKnots, s.filaments.knots);
  }
  u.uEcho.value = s.echoes ? s.echoes.strength : 0;
  if (s.echoes) setV3(u.uEchoColor, s.echoes.color);
  u.uGalaxy.value = s.galaxy ? s.galaxy.strength : 0;
  if (s.galaxy) {
    setV3(u.uGalaxyColor, s.galaxy.color);
    u.uClusters.value = s.galaxy.clusters;
  }
  u.uHalo.value = s.halo ? s.halo.strength : 0;
  if (s.halo) setV3(u.uHaloColor, s.halo.color);

  u.uRoll.value = deg(look.camera.rollDeg);
  u.uEscape.value = Math.max(50, look.camera.distance * 1.8, (look.jet?.length ?? 0) * 2.6);
}

function applyPost(look: Look, bloom: BloomEffect, grade: GradeEffect) {
  const p = look.post;
  bloom.intensity = p.bloom;
  bloom.luminanceMaterial.threshold = p.bloomThreshold;
  bloom.luminanceMaterial.smoothing = p.bloomSmoothing;
  bloom.mipmapBlurPass.radius = p.bloomRadius;
  grade.set('uExposure', p.exposure);
  grade.set('uTone', p.tone === 'punchy' ? 0 : 1);
  grade.set('uSaturation', p.saturation);
  grade.set('uContrast', p.contrast);
  grade.set('uLift', p.lift);
  grade.set('uVignette', p.vignette);
  grade.set('uGrain', p.grain);
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

/** Moving parts of a look at time t (camera-relative where the composition needs it). */
function animate(u: U, look: Look, t: number, tLook: number, camPos: THREE.Vector3, state: { lastCyc: number; chirpArmed: boolean }) {
  const view = tmpA.copy(camPos).negate().normalize();
  (u.uCenterDir.value as THREE.Vector3).copy(view);

  if (look.disk) {
    const f = look.disk.flicker ?? 0;
    const flick = f > 0 ? 1 + f * (0.35 * Math.sin(t * 2.3) * Math.sin(t * 0.71 + 1.3) + 0.9 * Math.pow(Math.max(0, Math.sin(t * 0.43)), 8)) : 1;
    u.uDiskBright.value = look.disk.brightness * flick;
  }

  const j = look.jet;
  if (j?.precession) {
    const a = deg(j.precession.angleDeg);
    const w = (2 * Math.PI * t) / j.precession.periodS;
    (u.uJetAxis.value as THREE.Vector3).set(Math.sin(a) * Math.cos(w), Math.cos(a), Math.sin(a) * Math.sin(w)).normalize();
  }

  const c = look.companion;
  if (c) {
    const P = tmpB;
    if (c.orbit) {
      // orbit in the plane through the line of sight: the star swings past and behind the hole
      const right = tmpC.crossVectors(view, UP).normalize();
      const th = (2 * Math.PI * t) / c.orbit.periodS;
      P.copy(right).multiplyScalar(Math.cos(th) * c.distance).addScaledVector(view, Math.sin(th) * c.distance).addScaledVector(UP, 0.7);
    } else {
      const a = deg(c.angleDeg ?? 0);
      P.set(Math.cos(a) * c.distance, 0.6, Math.sin(a) * c.distance);
    }
    (u.uComp.value as THREE.Vector4).set(P.x, P.y, P.z, c.radius);
    const axis = (u.uCompAxis.value as THREE.Vector3).copy(P).negate().normalize();
    if (c.stream && look.disk) {
      // gas leaves the star at the inner Lagrange point and curves (prograde) onto the disk's outer edge
      const L1 = tmpC.copy(P).addScaledVector(axis, c.radius * c.stretch * 0.98);
      const az = Math.atan2(P.z, P.x) + 1.05;
      const rOut = look.disk.outer * 0.82;
      const E = new THREE.Vector3(Math.cos(az) * rOut, 0, Math.sin(az) * rOut);
      const mid = L1.clone().lerp(E, 0.5);
      const bow = new THREE.Vector3(-Math.sin(az - 0.5), 0, Math.cos(az - 0.5)).multiplyScalar(L1.distanceTo(E) * 0.22);
      const C = mid.add(bow);
      const pts = u.uStreamPts.value as THREE.Vector3[];
      const center = new THREE.Vector3();
      for (let k = 0; k < 8; k++) {
        const s = k / 7;
        pts[k].set(0, 0, 0).addScaledVector(L1, (1 - s) * (1 - s)).addScaledVector(C, 2 * (1 - s) * s).addScaledVector(E, s * s);
        center.add(pts[k]);
      }
      center.multiplyScalar(1 / 8);
      let rad = 0;
      for (const p of pts) rad = Math.max(rad, p.distanceTo(center));
      (u.uStreamBounds.value as THREE.Vector4).set(center.x, center.y, center.z, rad + c.stream.width * 4);
    }
  }

  const h = look.hotspot;
  if (h) {
    const a = (2 * Math.PI * t) / h.periodS;
    const r = h.orbitRadius;
    const flare = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * 0.27)), 3);
    (u.uSpot.value as THREE.Vector4).set(Math.cos(a) * r, 0.2, Math.sin(a) * r, h.radius);
    const v = Math.sqrt(0.5 / (r - 1));
    (u.uSpotVel.value as THREE.Vector3).set(-Math.sin(a) * v, 0, Math.cos(a) * v);
    (u.uSpotColor.value as THREE.Vector3).set(h.color[0], h.color[1], h.color[2]).multiplyScalar(h.brightness * flare);
  }

  if (look.binary) {
    const tb = tLook + BINARY_START_S;
    const before = state.lastCyc;
    const cyc = tb % CYCLE_S;
    state.lastCyc = cyc;
    const chirpAt = INSPIRAL_S - CHIRP_LEAD_S;
    if (state.chirpArmed && before < chirpAt && cyc >= chirpAt) sound.chirp();
    const b = binaryState(tb, u.uHole1.value as THREE.Vector4, u.uHole2.value as THREE.Vector4);
    const gw = look.gravitationalWaves ?? 0;
    if (!b.merged) {
      u.uGwAmp.value = gw * 0.0045 * Math.min(Math.pow(4.6 / b.sep, 1.5), 4);
      u.uOrbitPhase.value = b.phase;
      u.uBurstR.value = -1;
    } else {
      u.uGwAmp.value = gw * 0.012 * Math.exp(-b.sinceMerge / 0.6);
      u.uBurstR.value = 3 + b.sinceMerge * 16;
      u.uBurstAmp.value = gw * 0.02 * Math.exp(-b.sinceMerge / 2.2);
    }
  }
}

// ------------------------------------------------------------------ the full-screen lensing pass
interface QuadProps {
  index: number;
  framing: 'panel' | 'center';
  tier: RefObject<Tier>;
  controls: RefObject<OrbitControlsImpl | null>;
  bloom: BloomEffect;
  grade: GradeEffect;
  onStats?: (fps: number) => void;
}

function LensingQuad({ index, framing, tier, controls, bloom, grade, onStats }: QuadProps) {
  const { camera, size, gl } = useThree();
  const uniforms = useMemo(() => createUniforms(), []);
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: lensingVertex,
      fragmentShader: lensingFragment,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });
    return m;
  }, [uniforms]);
  const state = useRef({
    displayed: -1,
    phase: 'in' as 'idle' | 'out' | 'in',
    phaseStart: 0,
    fromDist: DIVE_CLOSE,
    fade: 0,
    binary: { lastCyc: 0, chirpArmed: false },
    lookStart: 0,
    frames: 0,
    statT: 0,
  });

  useEffect(() => () => material.dispose(), [material]);

  const show = (i: number) => {
    const look = lookFor(blackHoles[i].id);
    material.defines = definesFor(look);
    material.needsUpdate = true;
    applyLook(uniforms, look);
    applyPost(look, bloom, grade);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = look.camera.fovDeg;
    cam.updateProjectionMatrix();
    const ctl = controls.current;
    if (ctl) {
      ctl.minDistance = look.camera.distance * 0.45;
      ctl.maxDistance = look.camera.distance * 2.2;
    }
    state.current.binary = { lastCyc: 0, chirpArmed: false };
    state.current.lookStart = performance.now() / 1000;
  };

  useFrame((frame, delta) => {
    const s = state.current;
    const u = uniforms;
    const now = frame.clock.elapsedTime;
    const t = FROZEN ? FROZEN_T : now;
    const ctl = controls.current;
    const cam = camera as THREE.PerspectiveCamera;

    // first frame: show the requested black hole, arriving with a pull-back from close to the horizon
    if (s.displayed === -1) {
      s.displayed = index;
      show(index);
      const look = lookFor(blackHoles[index].id);
      if (FROZEN) {
        s.phase = 'idle';
        s.fade = 1;
        cam.position.copy(homePosition(look));
      } else {
        s.phase = 'in';
        s.phaseStart = -2; // timing starts after the frame on which the shader compiles
        cam.position.copy(homePosition(look)).setLength(DIVE_CLOSE);
      }
      cam.lookAt(0, 0, 0);
      if (ctl) ctl.update();
    }

    let look = lookFor(blackHoles[s.displayed].id);

    // a different black hole was requested: dive into this one, then come out at the next
    if (index !== s.displayed && s.phase !== 'out') {
      s.phase = 'out';
      s.phaseStart = now;
      s.fromDist = cam.position.length();
    }

    if (s.phase === 'out') {
      const p = Math.min((now - s.phaseStart) / DIVE_OUT_S, 1);
      const e = p * p * p;
      cam.position.setLength(THREE.MathUtils.lerp(s.fromDist, DIVE_CLOSE, e));
      cam.lookAt(0, 0, 0);
      s.fade = 1 - THREE.MathUtils.smoothstep(p, 0.45, 1.0);
      if (p >= 1) {
        s.displayed = index;
        show(index);
        look = lookFor(blackHoles[index].id);
        cam.position.copy(homePosition(look)).setLength(DIVE_CLOSE);
        cam.lookAt(0, 0, 0);
        s.phase = 'in';
        s.phaseStart = -2; // the new look's shader compiles on this (black) frame; time the pull-back after it
      }
    } else if (s.phase === 'in') {
      if (s.phaseStart === -2) s.phaseStart = -1;
      else if (s.phaseStart === -1) s.phaseStart = now;
      const p = s.phaseStart < 0 ? 0 : Math.min((now - s.phaseStart) / DIVE_IN_S, 1);
      const e = 1 - Math.pow(1 - p, 3);
      cam.position.setLength(THREE.MathUtils.lerp(DIVE_CLOSE, look.camera.distance, e));
      cam.lookAt(0, 0, 0);
      s.fade = THREE.MathUtils.smoothstep(p, 0.0, 0.4);
      if (p >= 1) {
        s.phase = 'idle';
        s.fade = 1;
        s.binary.chirpArmed = true;
        if (ctl) ctl.update();
      }
    }

    if (ctl) {
      ctl.enabled = s.phase === 'idle' && !FROZEN;
      const sway = look.camera.sway ?? 0;
      ctl.autoRotate = ctl.enabled && (look.camera.autoRotate > 0 || sway > 0);
      ctl.autoRotateSpeed = sway > 0 ? sway * Math.cos(now * 0.07) : look.camera.autoRotate;
    }
    cam.updateMatrixWorld();

    // per-frame uniforms
    const q = tier.current;
    u.uSteps.value = q.steps;
    u.uDiskSamples.value = q.samples;
    u.uOctaves.value = q.octaves;
    gl.getDrawingBufferSize(u.uRes.value as THREE.Vector2);
    u.uTime.value = t;
    u.uFlowTime.value = t;
    (u.uCamPos.value as THREE.Vector3).copy(cam.position);
    (u.uCamRot.value as THREE.Matrix3).setFromMatrix4(cam.matrixWorld);
    u.uTanHalfFov.value = Math.tan(deg(cam.fov / 2));
    const shift = u.uShift.value as THREE.Vector2;
    if (framing === 'center') shift.set(0, 0);
    else if (size.width > 900) shift.set(0.22, 0);
    else if (size.height > size.width) shift.set(0, -0.3);
    else shift.set(0, 0);
    u.uFade.value = s.fade;
    if (import.meta.env.DEV) {
      // transition log for automated checks (phase, camera distance, fade)
      const w = window as unknown as { __bhLog?: Array<[string, number, number, number]> };
      if (s.phase !== 'idle' || (w.__bhLog && w.__bhLog.length < 400)) {
        (w.__bhLog ??= []).push([s.phase, +now.toFixed(3), +cam.position.length().toFixed(2), +s.fade.toFixed(2)]);
      }
    }
    const tLook = FROZEN ? FROZEN_T : performance.now() / 1000 - s.lookStart;
    animate(u, look, t, tLook, cam.position, s.binary);

    // frame-rate readout (DEV)
    if (onStats) {
      s.frames++;
      s.statT += delta;
      if (s.statT >= 1) {
        onStats(s.frames / s.statT);
        s.frames = 0;
        s.statT = 0;
      }
    }
  });

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

// ------------------------------------------------------------------ canvas
export function BlackHoleRenderer({ index, framing = 'panel' }: { index: number; framing?: 'panel' | 'center' }) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  // effects are created here (not via <Bloom>) so their settings can be driven per black hole
  const bloom = useMemo(() => new BloomEffect({ mipmapBlur: true, levels: 7, intensity: 1, luminanceThreshold: 0.4, luminanceSmoothing: 0.3, radius: 0.8 }), []);
  const grade = useMemo(() => new GradeEffect(), []);
  const startTier = FORCED_TIER ?? (isCoarse ? 0 : 2);
  const [tierIndex, setTierIndex] = useState(startTier);
  const tier = useRef<Tier>(TIERS[startTier]);
  const stats = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tier.current = TIERS[tierIndex];
  }, [tierIndex]);

  const adaptive = FORCED_TIER === null && !FROZEN;

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas
        dpr={TIERS[tierIndex].dpr}
        camera={{ position: [0, 4, 26], fov: 50, near: 0.1, far: 1000 }}
        gl={{ antialias: false, alpha: false, stencil: false, depth: false, powerPreference: 'high-performance' }}
      >
        {adaptive && (
          <PerformanceMonitor
            flipflops={3}
            onDecline={() => setTierIndex((i) => Math.max(0, i - 1))}
            onIncline={() => setTierIndex((i) => Math.min(TIERS.length - 1, i + 1))}
            onFallback={() => setTierIndex(0)}
          />
        )}
        <LensingQuad
          index={index}
          framing={framing}
          tier={tier}
          controls={controls}
          bloom={bloom}
          grade={grade}
          onStats={import.meta.env.DEV ? (fps) => {
            if (stats.current) stats.current.textContent = `${fps.toFixed(0)} fps · quality ${tierIndex} · dpr ${TIERS[tierIndex].dpr}`;
          } : undefined}
        />
        <OrbitControls ref={controls} target={[0, 0, 0]} enablePan={false} enableDamping dampingFactor={0.06} />
        <EffectComposer multisampling={0} frameBufferType={THREE.HalfFloatType}>
          <primitive object={bloom} />
          <primitive object={grade} />
        </EffectComposer>
      </Canvas>
      {import.meta.env.DEV && (
        <div ref={stats} style={{ position: 'fixed', right: 12, bottom: 8, zIndex: 50, font: '11px monospace', color: 'rgba(255,255,255,0.45)', pointerEvents: 'none' }} />
      )}
    </div>
  );
}
