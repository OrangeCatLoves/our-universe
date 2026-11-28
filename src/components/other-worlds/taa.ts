import * as THREE from 'three';
import { Pass } from 'postprocessing';

/**
 * Temporal anti-aliasing for "Skies of Other Worlds".
 *
 * Every frame the camera is nudged by a different sub-pixel amount (a Halton sequence), and each pixel is
 * blended with what that same spot looked like over the last ~10 frames. Edges, stars, fine ground detail
 * and soft-shadow noise are averaged over many slightly different samples, so they stop crawling and
 * flickering while you look around.
 *
 * The viewer never moves, only turns (and zooms), so "where was this pixel last frame" is exact for anything
 * fixed in the landscape. The sky is marked by the dome (alpha 0) and follows the turning stars instead, so
 * stars stay crisp during the time-lapse. History that no longer matches (moving shadows, the animated plume)
 * is clipped to the colours around the pixel in the new frame, which prevents ghosting.
 */

/** Per-frame noise offset for shaders that dither (shadow filtering, shadow ray-marching). */
export const taaNoise = { value: new THREE.Vector2() };
/** Rotation from world to sky (the stars' frame) for this frame, set by the scene. */
export const taaSky = { rot: new THREE.Matrix3() };

const JITTER_FRAMES = 16;

function halton(index: number, base: number): number {
  let f = 1;
  let r = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const resolveShader = /* glsl */ `
  uniform sampler2D tCurrent;
  uniform sampler2D tHistory;
  uniform mat4 uReproStatic;
  uniform mat4 uReproSky;
  uniform vec2 uTexel;
  uniform vec2 uSize;
  uniform float uValid;
  varying vec2 vUv;

  // blend in a compressed range so a few very bright pixels (sun, glints) can't dominate their neighbours
  vec3 compress(vec3 c) { return c / (1.0 + max(max(c.r, c.g), c.b)); }
  vec3 expand(vec3 c) { return c / max(1.0 - max(max(c.r, c.g), c.b), 1e-4); }
  vec3 toYCoCg(vec3 c) { return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b); }
  vec3 fromYCoCg(vec3 c) { return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
  vec3 current(vec2 uv) { return toYCoCg(compress(max(texture2D(tCurrent, uv).rgb, 0.0))); }

  // history through a sharp (Catmull-Rom) filter, so resampling it every frame does not blur the image
  vec3 history(vec2 uv) {
    vec2 pos = uv * uSize;
    vec2 t1 = floor(pos - 0.5) + 0.5;
    vec2 f = pos - t1;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 t0 = (t1 - 1.0) * uTexel;
    vec2 t3 = (t1 + 2.0) * uTexel;
    vec2 t12 = (t1 + w2 / w12) * uTexel;
    float a = w12.x * w0.y;
    float b = w0.x * w12.y;
    float c = w12.x * w12.y;
    float d = w3.x * w12.y;
    float e = w12.x * w3.y;
    vec3 col = texture2D(tHistory, vec2(t12.x, t0.y)).rgb * a
             + texture2D(tHistory, vec2(t0.x, t12.y)).rgb * b
             + texture2D(tHistory, t12).rgb * c
             + texture2D(tHistory, vec2(t3.x, t12.y)).rgb * d
             + texture2D(tHistory, vec2(t12.x, t3.y)).rgb * e;
    return max(col / (a + b + c + d + e), 0.0);
  }

  vec3 clipToBox(vec3 lo, vec3 hi, vec3 h) {
    vec3 centre = 0.5 * (hi + lo);
    vec3 ext = 0.5 * (hi - lo) + 1e-5;
    vec3 v = h - centre;
    vec3 a = abs(v / ext);
    float m = max(a.x, max(a.y, a.z));
    return m > 1.0 ? centre + v / m : h;
  }

  void main() {
    vec4 raw = texture2D(tCurrent, vUv);
    if (uValid < 0.5) {
      gl_FragColor = vec4(raw.rgb, 1.0);
      return;
    }
    vec3 cur = toYCoCg(compress(max(raw.rgb, 0.0)));
    bool sky = raw.a < 0.5;

    // the colours around this pixel in the new frame: history outside their range is out of date
    vec3 m1 = cur;
    vec3 m2 = cur * cur;
    vec3 lo = cur;
    vec3 hi = cur;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        if (i == 0 && j == 0) continue;
        vec3 s = current(vUv + vec2(float(i), float(j)) * uTexel);
        m1 += s;
        m2 += s * s;
        lo = min(lo, s);
        hi = max(hi, s);
      }
    }
    // the landscape gets the tight (variance) box against ghosting; the sky is reprojected exactly, and the
    // tight box would clip sub-pixel stars by a different amount every frame (flicker), so it keeps min/max
    if (!sky) {
      vec3 mu = m1 / 9.0;
      vec3 sigma = sqrt(max(m2 / 9.0 - mu * mu, 0.0));
      lo = max(lo, mu - 1.25 * sigma);
      hi = min(hi, mu + 1.25 * sigma);
    }

    // where this spot was last frame: the sky turns with the stars, the landscape stays put
    vec4 pc = (sky ? uReproSky : uReproStatic) * vec4(vUv * 2.0 - 1.0, 0.5, 1.0);
    vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
    if (pc.w <= 0.0 || puv.x < 0.0 || puv.y < 0.0 || puv.x > 1.0 || puv.y > 1.0) {
      gl_FragColor = vec4(raw.rgb, 1.0);
      return;
    }
    vec3 hist = clipToBox(lo, hi, toYCoCg(compress(history(puv))));

    // about ten frames of history; less where history and the new frame disagree (moving things)
    float diff = abs(cur.x - hist.x) / max(cur.x, max(hist.x, 0.2));
    float keep = sky ? 0.94 : mix(0.88, 0.95, (1.0 - diff) * (1.0 - diff));
    gl_FragColor = vec4(expand(fromYCoCg(mix(cur, hist, keep))), 1.0);
  }
`;

const copyShader = /* glsl */ `
  uniform sampler2D tMap;
  varying vec2 vUv;
  void main() { gl_FragColor = texture2D(tMap, vUv); }
`;

export class TemporalAAPass extends Pass {
  private resolve: THREE.ShaderMaterial;
  private copy: THREE.ShaderMaterial;
  private history: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private read = 0;
  private valid = false;
  private frame = 0;
  private width = 1;
  private height = 1;
  private target: THREE.PerspectiveCamera | null = null;
  private savedProj = new THREE.Matrix4();
  private savedProjInv = new THREE.Matrix4();
  private curVP = new THREE.Matrix4();
  private prevVP = new THREE.Matrix4();
  private curSky = new THREE.Matrix3();
  private prevSky = new THREE.Matrix3();
  private lastPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private m4 = new THREE.Matrix4();
  private inv = new THREE.Matrix4();
  private m3 = new THREE.Matrix3();

  constructor() {
    super('TemporalAAPass');
    this.needsSwap = true;
    this.resolve = new THREE.ShaderMaterial({
      uniforms: {
        tCurrent: { value: null },
        tHistory: { value: null },
        uReproStatic: { value: new THREE.Matrix4() },
        uReproSky: { value: new THREE.Matrix4() },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uSize: { value: new THREE.Vector2(1, 1) },
        uValid: { value: 0 },
      },
      vertexShader,
      fragmentShader: resolveShader,
      depthTest: false,
      depthWrite: false,
    });
    this.copy = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: null } },
      vertexShader,
      fragmentShader: copyShader,
      depthTest: false,
      depthWrite: false,
    });
    const opts = {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    };
    this.history = [new THREE.WebGLRenderTarget(1, 1, opts), new THREE.WebGLRenderTarget(1, 1, opts)];
    this.fullscreenMaterial = this.resolve;
  }

  /** Forget the history (new world): the next frame starts fresh. */
  reset() {
    this.valid = false;
  }

  /**
   * Call once per frame after the camera is placed and before the scene renders: records the matrices for
   * reprojection and shifts the projection by this frame's sub-pixel offset (undone in render()).
   */
  begin(camera: THREE.PerspectiveCamera) {
    camera.updateMatrixWorld();
    // the camera only turns, so reprojection uses its rotation alone (exact at every distance)
    this.m4.copy(camera.matrixWorldInverse);
    this.m4.elements[12] = 0;
    this.m4.elements[13] = 0;
    this.m4.elements[14] = 0;
    this.curVP.multiplyMatrices(camera.projectionMatrix, this.m4);
    this.curSky.copy(taaSky.rot);
    if (camera.position.distanceToSquared(this.lastPos) > 1e-4) this.valid = false;
    this.lastPos.copy(camera.position);

    this.frame = (this.frame + 1) % JITTER_FRAMES;
    const jx = (halton(this.frame + 1, 2) - 0.5) * (2 / this.width);
    const jy = (halton(this.frame + 1, 3) - 0.5) * (2 / this.height);
    taaNoise.value.setScalar(5.588238 * this.frame);
    this.savedProj.copy(camera.projectionMatrix);
    this.savedProjInv.copy(camera.projectionMatrixInverse);
    camera.projectionMatrix.elements[8] += jx;
    camera.projectionMatrix.elements[9] += jy;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    this.target = camera;
  }

  render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, outputBuffer: THREE.WebGLRenderTarget | null) {
    // undo the jitter: everything after the scene render (and DOM labels next frame) sees the true camera
    if (this.target) {
      this.target.projectionMatrix.copy(this.savedProj);
      this.target.projectionMatrixInverse.copy(this.savedProjInv);
      this.target = null;
    }

    const u = this.resolve.uniforms;
    const readRT = this.history[this.read];
    const writeRT = this.history[1 - this.read];
    u.tCurrent.value = inputBuffer.texture;
    u.tHistory.value = readRT.texture;
    u.uValid.value = this.valid ? 1 : 0;
    this.inv.copy(this.curVP).invert();
    (u.uReproStatic.value as THREE.Matrix4).multiplyMatrices(this.prevVP, this.inv);
    // a star now in direction d was in direction prevSky^T * curSky * d last frame
    this.m3.copy(this.prevSky).transpose().multiply(this.curSky);
    this.m4.setFromMatrix3(this.m3);
    (u.uReproSky.value as THREE.Matrix4).multiplyMatrices(this.prevVP, this.m4).multiply(this.inv);

    this.fullscreenMaterial = this.resolve;
    renderer.setRenderTarget(writeRT);
    renderer.render(this.scene, this.camera);

    this.copy.uniforms.tMap.value = writeRT.texture;
    this.fullscreenMaterial = this.copy;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);

    this.read = 1 - this.read;
    this.prevVP.copy(this.curVP);
    this.prevSky.copy(this.curSky);
    this.valid = true;
  }

  setSize(width: number, height: number) {
    this.width = Math.max(width, 1);
    this.height = Math.max(height, 1);
    this.history.forEach((rt) => rt.setSize(this.width, this.height));
    (this.resolve.uniforms.uTexel.value as THREE.Vector2).set(1 / this.width, 1 / this.height);
    (this.resolve.uniforms.uSize.value as THREE.Vector2).set(this.width, this.height);
    this.valid = false;
  }

  dispose() {
    this.history.forEach((rt) => rt.dispose());
    this.resolve.dispose();
    this.copy.dispose();
    super.dispose();
  }
}
