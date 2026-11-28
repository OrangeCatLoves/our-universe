import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { EffectComposer } from '@react-three/postprocessing';
import { BloomEffect } from 'postprocessing';
import * as THREE from 'three';
import { otherWorlds } from '../../data/otherWorlds';
import { worldSpec, SUN_NAMES, lookTargets } from './worlds';
import type { WorldSpec, BodySpec, RGB } from './worlds';
import { buildTerrain, proceduralBodyTexture } from './terrain';
import { makeGroundMaterial, makeRockMaterial } from './terrainMaterial';
import { SkyPath, sunDirections, bodyDirection, eclipseFactor, dirFromAzEl, azElFromDir, partOfDay } from './skyMath';
import { domeVertex, domeFragment, liquidVertex, liquidFragment, plumeVertex, plumeFragment } from './skyShader';
import { getNoiseTexture } from '../black-holes/noiseTexture';
import { GradeEffect } from '../black-holes/gradeEffect';
import { skyClock, lookRequest, useOtherWorldsStore } from '../../store/useOtherWorldsStore';
import { SceneErrorBoundary } from '../SceneErrorBoundary';
import { TemporalAAPass, taaSky } from './taa';

const EYE = 1.7;
// DEV only: ?grain=0 removes film grain (for frame-to-frame comparisons)
const NO_GRAIN = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('grain') === '0';
// DEV only: ?taa=0 turns temporal anti-aliasing off (for comparisons)
const TAA_ON = !(import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('taa') === '0');
const isCoarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
const BODY_DISTANCE = 8000;
const DOME_RADIUS = 9000;
const deg = THREE.MathUtils.degToRad;
const smooth = THREE.MathUtils.smoothstep;

// ------------------------------------------------------------------ sky uniforms (shared by dome + liquid)
type U = Record<string, THREE.IUniform>;

function createSkyUniforms(): U {
  return {
    uSunDir: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)] },
    uSunCol: { value: [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)] },
    uSunDisk: { value: [0, 0] },
    uSunRad: { value: [0.005, 0.005] },
    uSunWeight: { value: [1, 0] },
    uSunCount: { value: 1 },
    uKind: { value: 0 },
    uZenith: { value: new THREE.Vector3() },
    uHorizon: { value: new THREE.Vector3() },
    uNight: { value: new THREE.Vector3() },
    uGlow: { value: new THREE.Vector3() },
    uGlowWidth: { value: 0.1 },
    uTwilight: { value: new THREE.Vector3() },
    uSkyBright: { value: 1 },
    uStarsDay: { value: 0 },
    uStars: { value: 1 },
    uMilkyWay: { value: 0.5 },
    uStarRot: { value: new THREE.Matrix3() },
    uGalNormal: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
    uNoise: { value: getNoiseTexture() },
    uPix: { value: 0.001 },
    uHazeBand: { value: new THREE.Vector3() },
    uHazeBandStrength: { value: 0 },
    uPoints: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
    uPointCol: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
    uPointCount: { value: 0 },
    uGround: { value: new THREE.Vector3() },
  };
}

const set3 = (u: THREE.IUniform, c: RGB, s = 1) => (u.value as THREE.Vector3).set(c[0] * s, c[1] * s, c[2] * s);

/** JS twin of the shader's sky model (no disks or stars): used for fog and ambient light colours. */
function skyColorJS(spec: WorldSpec, suns: THREE.Vector3[], weights: number[], d: THREE.Vector3, out: THREE.Color): THREE.Color {
  const sky = spec.sky;
  out.setRGB(0, 0, 0);
  const up = Math.max(d.y, 0);
  const horizonW = Math.pow(1 - up, 5);
  let daylight = 0;
  suns.forEach((s, i) => {
    const w = weights[i] ?? 0;
    const h = s.y;
    const day = smooth(h, -0.14, 0.22);
    daylight += day * w;
    if (sky.kind === 'airless') return;
    const k = Math.pow(up, sky.kind === 'haze' ? 0.8 : 0.45);
    const low = 1 - smooth(h, 0.02, 0.35);
    const dh = Math.hypot(d.x, d.z) || 1;
    const sh = Math.hypot(s.x, s.z) || 1;
    const azTo = ((d.x * s.x + d.z * s.z) / (dh * sh)) * 0.5 + 0.5;
    const dark = 1 + (0.22 + 0.78 * azTo - 1) * low;
    const tw = smooth(h, -0.2, 0) * (1 - smooth(h, 0, 0.32)) * Math.pow(azTo, 3) * horizonW * 1.3;
    const ang = Math.acos(THREE.MathUtils.clamp(d.dot(s), -1, 1));
    const glow = Math.exp(-ang / sky.glowWidth) * smooth(h, -0.12, 0.04);
    for (let c = 0; c < 3; c++) {
      const base = (sky.horizon[c] + (sky.zenith[c] - sky.horizon[c]) * k) * dark * day;
      const v = (base + sky.twilight[c] * tw + sky.glow[c] * glow) * sky.brightness * w;
      if (c === 0) out.r += v;
      else if (c === 1) out.g += v;
      else out.b += v;
    }
  });
  const n = 1 - Math.min(daylight, 1);
  out.r += sky.night[0] * n;
  out.g += sky.night[1] * n;
  out.b += sky.night[2] * n;
  return out;
}

// ------------------------------------------------------------------ bodies (planets and moons in the sky)
const bodyVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const bodyFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uSunDir[2];
  uniform vec3 uSunLight[2];
  uniform int uSunCount;
  uniform vec3 uAmbient;
  uniform vec3 uAtmo;          // colour of the planet's atmosphere (black = airless)
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vec3 albedo = texture2D(uMap, vUv).rgb;
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 light = uAmbient;
    vec3 rim = vec3(0.0);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    for (int i = 0; i < 2; i++) {
      if (i >= uSunCount) break;
      float d = dot(n, uSunDir[i]);
      light += uSunLight[i] * smoothstep(-0.06, 0.25, d) * max(d, 0.0) * 1.15;
      rim += uAtmo * uSunLight[i] * fres * smoothstep(-0.25, 0.35, d) * 0.9;
      // forward scattering: haze on the limb glows when the Sun is (nearly) behind the planet
      float back = pow(max(dot(-v, uSunDir[i]), 0.0), 24.0);
      rim += uAtmo * uSunLight[i] * pow(1.0 - max(dot(n, v), 0.0), 6.0) * back * 3.5;
    }
    gl_FragColor = vec4(albedo * light + rim, 1.0);
  }
`;
const ringFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uLight;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uMap, vUv).rgb;
    float a = smoothstep(0.02, 0.12, dot(c, vec3(0.333)));
    gl_FragColor = vec4(c * uLight, a);
  }
`;
const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface BodyState {
  spec: BodySpec;
  dir: THREE.Vector3;
  group: THREE.Group | null;
  mesh: THREE.Mesh | null;
  uniforms: U | null;
  ringUniforms: U | null;
  label: HTMLDivElement | null;
}

// imperative bookkeeping kept out of the components (the render loop reads these every frame)
function attachBody(state: BodyState, key: 'group' | 'mesh', obj: THREE.Group | THREE.Mesh | null) {
  if (key === 'group') state.group = obj as THREE.Group | null;
  else state.mesh = obj as THREE.Mesh | null;
}
function setMap(uniforms: U, tex: THREE.Texture) {
  uniforms.uMap.value = tex;
}
function attachUniforms(state: BodyState, uniforms: U, ringUniforms: U | null) {
  state.uniforms = uniforms;
  state.ringUniforms = ringUniforms;
}
function applyWorldPost(id: string, bloom: BloomEffect, grade: GradeEffect) {
  const p = worldSpec(id).post;
  bloom.intensity = p.bloom;
  bloom.luminanceMaterial.threshold = p.bloomThreshold;
  grade.set('uExposure', p.exposure);
  grade.set('uTone', 1);
  grade.set('uSaturation', p.saturation);
  grade.set('uContrast', p.contrast);
  grade.set('uLift', [0, 0, 0]);
  grade.set('uVignette', p.vignette);
  grade.set('uGrain', NO_GRAIN ? 0 : p.grain);
}

function Body({ state, spinAxis, sunUniforms }: { state: BodyState; spinAxis: THREE.Vector3; sunUniforms: U }) {
  const b = state.spec;
  const radius = BODY_DISTANCE * Math.tan(deg(b.angularDeg / 2));
  const uniforms = useMemo<U>(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uSunDir: sunUniforms.uSunDir,
      uSunLight: { value: [new THREE.Vector3(), new THREE.Vector3()] },
      uSunCount: sunUniforms.uSunCount,
      uAmbient: { value: new THREE.Vector3(0.004, 0.004, 0.005) },
      uAtmo: { value: new THREE.Vector3(...(b.atmosphere ?? [0, 0, 0])) },
    }),
    [sunUniforms, b]
  );
  const ringUniforms = useMemo<U>(() => ({ uMap: { value: null as THREE.Texture | null }, uLight: { value: new THREE.Vector3(1, 1, 1) } }), []);
  const [ringGeo] = useState(() => {
    if (!b.rings) return null;
    const g = new THREE.RingGeometry(b.rings.inner, b.rings.outer, 256, 4);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - b.rings.inner) / (b.rings.outer - b.rings.inner), 0.5);
    }
    return g;
  });

  useEffect(() => {
    attachUniforms(state, uniforms, b.rings ? ringUniforms : null);
    let live = true;
    if (b.procedural) {
      setMap(uniforms, proceduralBodyTexture(b.procedural));
    } else if (b.texture) {
      new THREE.TextureLoader().load(b.texture, (tex) => {
        if (!live) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        setMap(uniforms, tex);
      });
    }
    if (b.rings) {
      new THREE.TextureLoader().load(b.rings.texture, (tex) => {
        if (!live) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        setMap(ringUniforms, tex);
      });
    }
    return () => {
      live = false;
    };
  }, [b, state, uniforms, ringUniforms]);

  // orient: spin axis (bands parallel to the sun's path; rings nearly edge-on)
  const quat = useMemo(() => {
    const axis = spinAxis.clone();
    if (b.rings) {
      // tip the pole slightly toward the viewer so the rings open by a few degrees
      const toViewer = state.dir.clone().negate();
      axis.addScaledVector(toViewer, Math.tan(deg(b.rings.openDeg))).normalize();
    }
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  }, [b, spinAxis, state]);

  return (
    <group ref={(g) => attachBody(state, 'group', g)} quaternion={quat}>
      <mesh ref={(m) => attachBody(state, 'mesh', m)} frustumCulled={false} renderOrder={1}>
        <sphereGeometry args={[radius, 96, 64]} />
        <shaderMaterial vertexShader={bodyVertex} fragmentShader={bodyFragment} uniforms={uniforms} />
      </mesh>
      {ringGeo && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} scale={radius} geometry={ringGeo} frustumCulled={false} renderOrder={2}>
          <shaderMaterial vertexShader={ringVertex} fragmentShader={ringFragment} uniforms={ringUniforms} transparent depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ one world
function World({ id }: { id: string }) {
  const spec = worldSpec(id);
  const { camera, gl, scene, size } = useThree();
  const labelsOn = useOtherWorldsStore((s) => s.labels);
  const panelCollapsed = useOtherWorldsStore((s) => s.panelCollapsed);
  const terrain = useMemo(() => buildTerrain(id, spec.terrain), [id, spec]);
  const sky = useMemo(() => createSkyUniforms(), []);
  const path = useMemo(() => new SkyPath(spec.sunPath.maxElevDeg, spec.sunPath.azimuthDeg), [spec]);
  const fixedSun = !!spec.sunPath.fixed;

  const sunDirs = useMemo(() => spec.suns.map(() => new THREE.Vector3(0, 1, 0)), [spec]);
  const bodies = useMemo<BodyState[]>(
    () => spec.bodies.map((b) => ({ spec: b, dir: bodyDirection(b.place, spec, path, spec.time.start), group: null, mesh: null, uniforms: null, ringUniforms: null, label: null })),
    [spec, path]
  );
  const diskBodies = bodies.filter((b) => !b.spec.point);
  const pointBodies = bodies.filter((b) => b.spec.point);

  const sunLights = useRef<Array<THREE.DirectionalLight | null>>([]);
  const shineLight = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const plume = useRef<THREE.Mesh>(null);
  const geysers = useRef<THREE.Mesh>(null);
  const dome = useRef<THREE.Mesh>(null);
  const sunLabelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sunLabelGroups = useRef<Array<THREE.Group | null>>([]);
  const effectLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const liquidUniforms = useMemo<U>(() => {
    const l = spec.terrain.liquid;
    return {
      ...sky,
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uDeep: { value: new THREE.Vector3(...(l?.color ?? [0, 0, 0])) },
      uRough: { value: l?.roughness ?? 0.1 },
      uTime: { value: 0 },
    };
  }, [sky, spec]);

  const plumeUniforms = useMemo<U>(() => {
    const p = spec.effects?.plume;
    const g = spec.effects?.geysers;
    const c = p?.color ?? g?.color ?? [1, 1, 1];
    return {
      uNoise: { value: getNoiseTexture() },
      uColor: { value: new THREE.Vector3(c[0], c[1], c[2]) },
      uLight: { value: 1 },
      uTime: { value: 0 },
      uKind: { value: p ? 0 : 1 },
      uSeed: { value: spec.terrain.seed },
    };
  }, [spec]);

  // static sky settings, camera, fog
  useEffect(() => {
    const s = spec.sky;
    sky.uKind.value = s.kind === 'airless' ? 0 : s.kind === 'air' ? 1 : 2;
    set3(sky.uZenith, s.zenith);
    set3(sky.uHorizon, s.horizon);
    set3(sky.uNight, s.night);
    set3(sky.uGlow, s.glow);
    sky.uGlowWidth.value = s.glowWidth;
    set3(sky.uTwilight, s.twilight);
    sky.uSkyBright.value = s.brightness;
    sky.uStarsDay.value = s.starsDay;
    sky.uStars.value = s.stars;
    sky.uMilkyWay.value = s.milkyWay;
    sky.uSunCount.value = spec.suns.length;
    sky.uHazeBandStrength.value = s.hazeBands?.strength ?? 0;
    if (s.hazeBands) set3(sky.uHazeBand, s.hazeBands.color);
    spec.suns.forEach((sun, i) => {
      (sky.uSunRad.value as number[])[i] = deg(Math.max(sun.angularDeg, 0.06) / 2);
    });
    sky.uPointCount.value = pointBodies.length;

    skyClock.phase = spec.time.start;
    skyClock.playing = true;
    skyClock.worldId = id;
    if (import.meta.env.DEV) {
      // ?phase=0.74 starts at that time of day; &paused stops the time-lapse (for reviewing stills)
      const q = new URLSearchParams(window.location.search);
      if (q.get('phase') !== null) skyClock.phase = Number(q.get('phase'));
      if (q.has('paused')) skyClock.playing = false;
    }

    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(0, terrain.eye + EYE, 0);
    cam.fov = spec.camera.fov;
    cam.near = 0.05;
    cam.far = 20000;
    cam.updateProjectionMatrix();

    scene.fog = spec.fog ? new THREE.FogExp2(0x000000, spec.fog) : null;
    return () => {
      scene.fog = null;
    };
  }, [id, spec, sky, camera, scene, terrain, pointBodies.length]);

  // ---------------------------------------------------------------- look controls (drag to look, wheel to zoom)
  const look = useRef({
    yaw: spec.camera.az, pitch: spec.camera.el, tYaw: spec.camera.az, tPitch: spec.camera.el,
    fov: spec.camera.fov, tFov: spec.camera.fov, drag: false, x: 0, y: 0, serial: lookRequest.serial,
    shift: typeof window !== 'undefined' && window.innerWidth > 900 && !useOtherWorldsStore.getState().panelCollapsed ? -spec.camera.fov * 0.18 : 0,
  });
  // narrow portrait screens see a thin slice of sky: centre it on the world's main subject
  useEffect(() => {
    const focus = spec.camera.focus;
    if (!focus || size.height <= size.width) return;
    const L = look.current;
    let d: THREE.Vector3 | null = null;
    if (focus.startsWith('sun')) {
      const dirs = spec.suns.map(() => new THREE.Vector3());
      sunDirections(spec, path, skyClock.phase, dirs);
      d = dirs[Number(focus.slice(3))] ?? null;
    } else {
      const b = spec.bodies.find((x) => x.id === focus);
      if (b) d = bodyDirection(b.place, spec, path, skyClock.phase);
    }
    if (!d) return;
    const ae = azElFromDir(d);
    L.yaw = L.tYaw = ae.az;
    L.pitch = L.tPitch = THREE.MathUtils.clamp(ae.el - 4, -5, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const el = gl.domElement;
    const L = look.current;
    // DEV only: window.__owLook lets test scripts turn the camera by exact amounts
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__owLook = L;
    const down = (e: PointerEvent) => {
      L.drag = true;
      L.x = e.clientX;
      L.y = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!L.drag) return;
      const k = L.fov / el.clientHeight; // degrees per pixel
      L.tYaw -= (e.clientX - L.x) * k;
      L.tPitch = THREE.MathUtils.clamp(L.tPitch + (e.clientY - L.y) * k, -25, 85);
      L.x = e.clientX;
      L.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      L.drag = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      L.tFov = THREE.MathUtils.clamp(L.tFov * Math.exp(e.deltaY * 0.0012), 6, 80);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  const tmp = useMemo(() => ({
    v: new THREE.Vector3(), w: new THREE.Vector3(), c: new THREE.Color(), c2: new THREE.Color(),
    m4: new THREE.Matrix4(), flareT: 0,
  }), []);
  const weights = useMemo(() => spec.suns.map(() => 1), [spec]);

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = frame.clock.elapsedTime;
    const cam = camera as THREE.PerspectiveCamera;

    // -------- time-lapse: slower around sunrise and sunset so they can be enjoyed
    if (skyClock.playing) {
      const h = sunDirs[0]?.y ?? 0.5;
      const slow = fixedSun ? 1 : 0.25 + 0.75 * smooth(Math.abs(h), 0.03, 0.35);
      skyClock.phase = (skyClock.phase + (dt / spec.time.periodS) * slow) % 1;
    }
    const phase = skyClock.phase;
    sunDirections(spec, path, phase, sunDirs);
    const theta = SkyPath.theta(phase);
    tmp.m4.makeRotationAxis(path.axis, -theta);
    (sky.uStarRot.value as THREE.Matrix3).setFromMatrix4(tmp.m4);
    taaSky.rot.copy(sky.uStarRot.value as THREE.Matrix3);

    // -------- bodies, eclipses
    bodies.forEach((b) => bodyDirection(b.spec.place, spec, path, phase, b.dir));
    const eclipse = spec.suns.map((sun, i) => {
      let f = 1;
      for (const b of diskBodies) f = Math.min(f, eclipseFactor(sunDirs[i], deg(sun.angularDeg / 2), b.dir, deg(b.spec.angularDeg / 2)));
      return f;
    });

    // -------- flares (Proxima Centauri)
    let flare = 1;
    const fl = spec.effects?.flares;
    if (fl) {
      const ph = t % fl.everyS;
      flare = 1 + (fl.boost - 1) * (ph < fl.durationS ? Math.sin((ph / fl.durationS) * Math.PI) ** 2 : 0);
    }

    // -------- suns: sky uniforms and lights (dimmed and reddened low in the sky by the air)
    const ext = spec.sky.extinction;
    let dayAmount = 0;
    spec.suns.forEach((sun, i) => {
      const d = sunDirs[i];
      (sky.uSunDir.value as THREE.Vector3[])[i].copy(d);
      const air = 1 / Math.max(d.y + 0.06, 0.035);
      const tr = [Math.exp(-ext[0] * air * 0.12), Math.exp(-ext[1] * air * 0.12), Math.exp(-ext[2] * air * 0.12)];
      const vis = smooth(d.y, -0.025, 0.02) * eclipse[i];
      (sky.uSunCol.value as THREE.Vector3[])[i].set(sun.color[0] * tr[0], sun.color[1] * tr[1], sun.color[2] * tr[2]).multiplyScalar(flare);
      (sky.uSunDisk.value as number[])[i] = sun.disk * eclipse[i];
      const weight = (sun.intensity / spec.suns[0].intensity) * eclipse[i] * (i === 0 ? flare : 1);
      (sky.uSunWeight.value as number[])[i] = weight;
      weights[i] = weight;
      dayAmount += smooth(d.y, -0.14, 0.22) * weight;
      const light = sunLights.current[i];
      if (light) {
        light.position.set(d.x * 120, d.y * 120 + cam.position.y, d.z * 120);
        light.color.setRGB(sun.color[0] * tr[0], sun.color[1] * tr[1], sun.color[2] * tr[2]);
        light.intensity = sun.intensity * vis * flare;
      }
      const g = sunLabelGroups.current[i];
      if (g) g.position.copy(d).multiplyScalar(BODY_DISTANCE * 0.9).add(cam.position);
      const lab = sunLabelRefs.current[i];
      if (lab) lab.style.opacity = labelsOn && d.y > -0.01 && sun.disk > 0 && eclipse[i] > 0.5 ? '1' : '0';
    });
    dayAmount = Math.min(dayAmount, 1);

    // -------- point lights in the sky (Earth from Mars, Alpha Centauri, Deimos)
    pointBodies.forEach((b, k) => {
      const p = b.spec.point!;
      (sky.uPoints.value as THREE.Vector4[])[k].set(b.dir.x, b.dir.y, b.dir.z, p.brightness);
      (sky.uPointCol.value as THREE.Vector3[])[k].set(p.color[0], p.color[1], p.color[2]);
    });

    // -------- disk bodies: position, spin, lighting, planet-shine on the ground
    let shine = 0;
    let shineColor: RGB = [1, 1, 1];
    const shineDir = tmp.w.set(0, 1, 0);
    diskBodies.forEach((b) => {
      if (b.group) b.group.position.copy(b.dir).multiplyScalar(BODY_DISTANCE).add(cam.position);
      if (b.mesh && b.spec.spinS) b.mesh.rotation.y = (t / b.spec.spinS) * Math.PI * 2;
      if (b.uniforms) {
        spec.suns.forEach((sun, i) => {
          (b.uniforms!.uSunLight.value as THREE.Vector3[])[i].set(sun.color[0], sun.color[1], sun.color[2]).multiplyScalar(sun.intensity * 0.85 * (i === 0 ? flare : 1));
        });
      }
      if (b.ringUniforms) {
        const lit = 0.25 + 0.75 * Math.max(sunDirs[0].y + 0.3, 0);
        (b.ringUniforms.uLight.value as THREE.Vector3).setScalar(spec.suns[0].intensity * 0.22 * Math.min(lit, 1));
      }
      if (b.spec.shine) {
        const lit = 0.5 * (1 - sunDirs[0].dot(b.dir)); // fraction of its visible face that is lit
        const s = b.spec.shine * spec.suns[0].intensity * lit * smooth(b.dir.y, -0.02, 0.1) * eclipse[0];
        if (s > shine) {
          shine = s;
          shineColor = b.spec.shineColor ?? [1, 1, 1];
          shineDir.copy(b.dir);
        }
      }
    });
    if (shineLight.current) {
      shineLight.current.position.copy(shineDir).multiplyScalar(120).add(cam.position);
      shineLight.current.intensity = shine;
      shineLight.current.color.setRGB(shineColor[0], shineColor[1], shineColor[2]);
    }

    // -------- ambient light and fog take their colours from the sky model
    const horizonDir = tmp.v.set(Math.sin(deg(look.current.yaw)), 0.02, -Math.cos(deg(look.current.yaw))).normalize();
    const fogColor = skyColorJS(spec, sunDirs, weights, horizonDir, tmp.c);
    if (scene.fog) (scene.fog as THREE.FogExp2).color.copy(fogColor);
    set3(sky.uGround, [fogColor.r, fogColor.g, fogColor.b], spec.sky.kind === 'airless' ? 0 : 0.9);
    if (hemi.current) {
      const zen = skyColorJS(spec, sunDirs, weights, tmp.w.set(0, 1, 0), tmp.c2);
      const amb = THREE.MathUtils.lerp(spec.ambient.night, spec.ambient.day, dayAmount);
      hemi.current.color.copy(zen).multiplyScalar(spec.sky.kind === 'airless' ? 0 : 1).addScalar(0.15);
      hemi.current.groundColor.setRGB(spec.terrain.palette.mid[0], spec.terrain.palette.mid[1], spec.terrain.palette.mid[2]).multiplyScalar(0.5 * dayAmount + 0.05);
      hemi.current.intensity = amb * 2.2;
    }

    // -------- effects (lit by the sun)
    const sunUp = smooth(sunDirs[0].y, -0.05, 0.08) * eclipse[0];
    const effectMesh = plume.current ?? geysers.current;
    if (effectMesh) {
      plumeUniforms.uTime.value = t;
      plumeUniforms.uLight.value = 0.15 + 2.2 * sunUp;
      const dx = cam.position.x - effectMesh.position.x;
      const dz = cam.position.z - effectMesh.position.z;
      effectMesh.rotation.y = Math.atan2(dx, dz);
    }
    liquidUniforms.uTime.value = t;
    if (scene.fog) {
      (liquidUniforms.fogColor.value as THREE.Color).copy(fogColor);
      liquidUniforms.fogDensity.value = spec.fog ?? 0;
    }

    // -------- camera: look-at requests, smoothing, zoom
    const L = look.current;
    if (lookRequest.serial !== L.serial) {
      L.serial = lookRequest.serial;
      const target = lookRequest.id;
      let d: THREE.Vector3 | null = null;
      if (target.startsWith('sun')) d = sunDirs[Number(target.slice(3))] ?? null;
      else if (target === 'plume' && spec.effects?.plume) d = dirFromAzEl(spec.effects.plume.az, spec.effects.plume.heightDeg * 0.45);
      else if (target === 'geysers' && spec.effects?.geysers) d = dirFromAzEl(spec.effects.geysers.az, spec.effects.geysers.heightDeg * 0.4);
      else d = bodies.find((b) => b.spec.id === target)?.dir ?? null;
      if (d) {
        const ae = azElFromDir(d);
        // shortest way round
        let az = ae.az;
        while (az - L.yaw > 180) az -= 360;
        while (az - L.yaw < -180) az += 360;
        L.tYaw = az;
        const name = lookTargets(id).find((x) => x.id === target)?.label ?? 'It';
        if (ae.el < -1) {
          // below the horizon: face the place it will be, and say so
          L.tPitch = 4;
          L.tFov = spec.camera.fov;
          skyClock.notice = `${name} is below the horizon right now`;
          skyClock.noticeUntil = performance.now() + 3500;
        } else {
          L.tPitch = THREE.MathUtils.clamp(ae.el - (size.width > 900 ? 0 : 6), -25, 85);
          // zoom in on small sky objects (like a telescope); wide view for big ones and the suns
          const body = bodies.find((b) => b.spec.id === target && !b.spec.point);
          L.tFov = body ? THREE.MathUtils.clamp(body.spec.angularDeg * 2.6, 8, spec.camera.fov) : spec.camera.fov;
        }
      }
    }
    const k = Math.min(1, dt * 6);
    L.yaw += (L.tYaw - L.yaw) * k;
    L.pitch += (L.tPitch - L.pitch) * k;
    L.fov += (L.tFov - L.fov) * k;
    if (Math.abs(cam.fov - L.fov) > 0.01) {
      cam.fov = L.fov;
      cam.updateProjectionMatrix();
    }
    // keep the scene's focal point clear of the info panel on wide screens (eases back when it is collapsed)
    const wantShift = size.width > 900 && !panelCollapsed ? -L.fov * 0.18 : 0;
    L.shift += (wantShift - L.shift) * Math.min(1, dt * 4);
    const dir = dirFromAzEl(L.yaw + L.shift, L.pitch, tmp.v);
    cam.lookAt(cam.position.x + dir.x, cam.position.y + dir.y, cam.position.z + dir.z);
    sky.uPix.value = (2 * Math.tan(deg(cam.fov / 2))) / Math.max(size.height * Math.min(window.devicePixelRatio, 1.5), 1);
    if (dome.current) dome.current.position.copy(cam.position);

    // -------- labels
    bodies.forEach((b) => {
      if (!b.label) return;
      const hiddenByDay = !!b.spec.point && spec.sky.kind !== 'airless' && dayAmount > 0.35;
      b.label.style.opacity = labelsOn && b.dir.y > -0.01 && !hiddenByDay ? '1' : '0';
    });
    Object.entries(effectLabelRefs.current).forEach(([, el]) => {
      if (el) el.style.opacity = labelsOn ? '1' : '0';
    });

    // -------- the time label (read by the time control)
    skyClock.label = eclipse[0] < 0.5 && sunDirs[0].y > -0.02 ? 'Eclipse' : partOfDay(phase, sunDirs[0].y, fixedSun);
  });

  const shadowSteps = isCoarse ? 24 : 48;
  const ground = useMemo(
    () => makeGroundMaterial(terrain, spec.terrain, shadowSteps),
    [terrain, spec, shadowSteps]
  );
  const rockMaterial = useMemo(() => makeRockMaterial(terrain, shadowSteps), [terrain, shadowSteps]);
  const rockMeshes = useMemo(
    () =>
      terrain.rocks.map((r) => {
        const m = new THREE.InstancedMesh(r.geometry, rockMaterial, Math.max(r.matrices.length, 1));
        r.matrices.forEach((mat, i) => {
          m.setMatrixAt(i, mat);
          m.setColorAt(i, r.colors[i]);
        });
        m.count = r.matrices.length;
        m.castShadow = true;
        m.receiveShadow = true;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        return m;
      }),
    [terrain, rockMaterial]
  );

  const plumeSpec = spec.effects?.plume;
  const geyserSpec = spec.effects?.geysers;
  const effectPlacement = (az: number, distance: number, heightDeg: number, widthDeg: number) => {
    const d = dirFromAzEl(az, 0);
    const h = distance * Math.tan(deg(heightDeg));
    const w = distance * Math.tan(deg(widthDeg)) * 2;
    return { pos: [d.x * distance, terrain.eye + h / 2 - distance * distance / (2 * spec.terrain.planetRadiusM) - 40, d.z * distance] as [number, number, number], w, h };
  };
  const sunNames = SUN_NAMES[id] ?? ['Sun', 'Sun'];

  return (
    <>
      <mesh ref={dome} frustumCulled={false} renderOrder={-1}>
        <sphereGeometry args={[DOME_RADIUS, 64, 32]} />
        <shaderMaterial vertexShader={domeVertex} fragmentShader={domeFragment} uniforms={sky} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      <mesh geometry={terrain.ground} material={ground} receiveShadow />
      {rockMeshes.map((m, i) => <primitive key={i} object={m} />)}
      {terrain.liquid && (
        <mesh geometry={terrain.liquid}>
          <shaderMaterial vertexShader={liquidVertex} fragmentShader={liquidFragment} uniforms={liquidUniforms} fog />
        </mesh>
      )}

      {diskBodies.map((b) => (
        <Body key={b.spec.id} state={b} spinAxis={path.axis} sunUniforms={sky} />
      ))}

      {plumeSpec && (() => {
        const p = effectPlacement(plumeSpec.az, plumeSpec.distance, plumeSpec.heightDeg, plumeSpec.widthDeg);
        return (
          <mesh ref={plume} position={p.pos} frustumCulled={false}>
            <planeGeometry args={[p.w, p.h]} />
            <shaderMaterial vertexShader={plumeVertex} fragmentShader={plumeFragment} uniforms={plumeUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })()}
      {geyserSpec && (() => {
        const p = effectPlacement(geyserSpec.az, geyserSpec.distance, geyserSpec.heightDeg, geyserSpec.spreadDeg / 2);
        return (
          <mesh ref={geysers} position={p.pos} frustumCulled={false}>
            <planeGeometry args={[p.w, p.h]} />
            <shaderMaterial vertexShader={plumeVertex} fragmentShader={plumeFragment} uniforms={plumeUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })()}

      {spec.suns.map((_, i) => (
        <directionalLight
          key={i}
          ref={(l) => { sunLights.current[i] = l; }}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
          shadow-camera-near={1}
          shadow-camera-far={400}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
          shadow-radius={2}
        />
      ))}
      <directionalLight ref={shineLight} intensity={0} />
      <hemisphereLight ref={hemi} />

      {/* labels */}
      {bodies.filter((b) => b.spec.label).map((b) => (
        <LabelAt key={`label-${b.spec.id}`} dir={b.dir} text={b.spec.label} setRef={(el) => { b.label = el; }} />
      ))}
      {spec.suns.map((s, i) => s.disk > 0 && (
        <group key={`sunlabel-${i}`} ref={(g) => { sunLabelGroups.current[i] = g; }}>
          <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div className="sky-label sky-label--sun" ref={(el) => { sunLabelRefs.current[i] = el; }}>{sunNames[i]}</div>
          </Html>
        </group>
      ))}
      {plumeSpec && (
        <group position={dirFromAzEl(plumeSpec.az, plumeSpec.heightDeg * 1.05).multiplyScalar(BODY_DISTANCE * 0.9).toArray()}>
          <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div className="sky-label" ref={(el) => { effectLabelRefs.current.plume = el; }}>Volcanic plume</div>
          </Html>
        </group>
      )}
      {geyserSpec && (
        <group position={dirFromAzEl(geyserSpec.az, geyserSpec.heightDeg * 1.05).multiplyScalar(BODY_DISTANCE * 0.9).toArray()}>
          <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div className="sky-label" ref={(el) => { effectLabelRefs.current.geysers = el; }}>Ice geysers</div>
          </Html>
        </group>
      )}
    </>
  );
}

/** A label that follows a sky direction (placed just below the object). */
function LabelAt({ dir, text, setRef }: { dir: THREE.Vector3; text: string; setRef: (el: HTMLDivElement | null) => void }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(() => {
    if (group.current) group.current.position.copy(dir).multiplyScalar(BODY_DISTANCE * 0.9).add(camera.position);
  });
  return (
    <group ref={group}>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="sky-label" ref={setRef}>{text}</div>
      </Html>
    </group>
  );
}

/** Nudges the camera by this frame's sub-pixel offset after the scene has placed it (and after labels). */
function TemporalJitter({ taa }: { taa: TemporalAAPass }) {
  useFrame((state) => taa.begin(state.camera as THREE.PerspectiveCamera), 0.5);
  return null;
}

// ------------------------------------------------------------------ canvas + world switching
export function WorldScene({ index }: { index: number }) {
  const [shown, setShown] = useState(index);
  const [settling, setSettling] = useState(false); // a brief black hold right after the swap
  const faded = index !== shown || settling;
  const bloom = useMemo(() => new BloomEffect({ mipmapBlur: true, levels: 6, intensity: 0.6, luminanceThreshold: 1.2, luminanceSmoothing: 0.3, radius: 0.7 }), []);
  const grade = useMemo(() => new GradeEffect(), []);
  const taa = useMemo(() => Object.assign(new TemporalAAPass(), { enabled: TAA_ON }), []);
  const id = otherWorlds[shown].id;

  // fade to black, swap worlds while hidden, fade back in
  useEffect(() => {
    if (index === shown) return;
    const t = setTimeout(() => {
      setShown(index);
      setSettling(true);
      setTimeout(() => setSettling(false), 60);
    }, 450);
    return () => clearTimeout(t);
  }, [index, shown]);

  useEffect(() => applyWorldPost(id, bloom, grade), [id, bloom, grade]);
  useEffect(() => taa.reset(), [id, taa]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      <SceneErrorBoundary>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 2, 0], fov: 62, near: 0.05, far: 20000 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      >
        <World key={id} id={id} />
        {TAA_ON && <TemporalJitter taa={taa} />}
        <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType}>
          <primitive object={taa} />
          <primitive object={bloom} />
          <primitive object={grade} />
        </EffectComposer>
      </Canvas>
      </SceneErrorBoundary>
      <div className="world-fade" style={{ opacity: faded ? 1 : 0 }} />
    </div>
  );
}
