import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, Vector3 } from 'three';

// Final colour grade for the black-hole renders (runs after bloom, on the HDR image):
// exposure -> film tone curve -> saturation / contrast -> tinted blacks -> vignette -> fine grain.
// "punchy" (per-channel ACES fit) keeps hot colours saturated, so fire runs red -> orange -> yellow;
// "filmic" (ACES with gamut mapping) rolls bright highlights smoothly to white.
const fragment = /* glsl */ `
  uniform float uExposure;
  uniform float uTone;
  uniform float uSaturation;
  uniform float uContrast;
  uniform vec3 uLift;
  uniform float uVignette;
  uniform float uGrain;

  vec3 acesFit(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 rrtOdt(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 acesFilmic(vec3 c) {
    const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    return clamp(OUT * rrtOdt(IN * (c / 0.6)), 0.0, 1.0);
  }
  float grainHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = max(inputColor.rgb, 0.0) * uExposure;
    c = uTone < 0.5 ? acesFit(c) : acesFilmic(c);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = max(mix(vec3(l), c, uSaturation), 0.0);
    // contrast and grain in a perceptual (gamma) space
    vec3 g = pow(c, vec3(1.0 / 2.2));
    g = clamp((g - 0.5) * uContrast + 0.5, 0.0, 1.0);
    g = g + uLift * (1.0 - g);
    vec2 q = uv - 0.5;
    q.x *= resolution.x / resolution.y;
    g *= 1.0 - uVignette * smoothstep(0.25, 1.05, length(q));
    float n = grainHash(gl_FragCoord.xy + fract(time * 7.13) * 977.0) - 0.5;
    g += n * uGrain;
    outputColor = vec4(pow(max(g, 0.0), vec3(2.2)), inputColor.a);
  }
`;

export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', fragment, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ['uExposure', new Uniform(1)],
        ['uTone', new Uniform(1)],
        ['uSaturation', new Uniform(1)],
        ['uContrast', new Uniform(1)],
        ['uLift', new Uniform(new Vector3())],
        ['uVignette', new Uniform(0.3)],
        ['uGrain', new Uniform(0.03)],
      ]),
    });
  }

  set(name: string, value: number | [number, number, number]) {
    const u = this.uniforms.get(name);
    if (!u) return;
    if (Array.isArray(value)) (u.value as Vector3).set(value[0], value[1], value[2]);
    else u.value = value;
  }
}
