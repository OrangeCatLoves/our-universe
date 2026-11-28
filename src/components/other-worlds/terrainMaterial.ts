import * as THREE from 'three';
import { groundDetailTexture, NEAR_MAP_HALF, MID_MAP_HALF, FAR_MAP_HALF, MESH_SPACING } from './terrain';
import { taaNoise } from './taa';
import type { Terrain } from './terrain';
import type { SurfaceStyle, TerrainSpec } from './worlds';

// Ground and rock shading for "Skies of Other Worlds", injected into three.js's standard material:
//  - terrain shadows: every pixel marches toward each sun over height maps of the ground, so crater rims,
//    hills and mountains cast long, soft shadows all the way to the horizon (and for both suns)
//  - multi-scale surface detail in world space (no stretched texture underfoot), faded with distance so
//    it never shimmers, plus a surface style: micro-craters (regolith), cracks and deposits (sulfur), ...
//  - bump from that detail with a scale-correct surface gradient (Mikkelsen)

// DEV only: ?dbg=shadow (terrain shadow alone), nobump, noshadow
const DBG = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('dbg') : null;
const dbgDefine = (src: string) => (DBG ? `#define DBG_${DBG.toUpperCase()}\n` + src : src);

const STYLE_ID: Record<SurfaceStyle, number> = { rock: 0, regolith: 1, sulfur: 2, ice: 3, sand: 4, pebbles: 5 };

const SHADOW_GLSL = /* glsl */ `
  uniform sampler2D uHNear;
  uniform sampler2D uHMid;
  uniform sampler2D uHFar;
  uniform float uHNearHalf;
  uniform float uHMidHalf;
  uniform float uHFarHalf;
  uniform int uShadowSteps;
  uniform vec2 uTaaNoise;   // changes every frame; temporal anti-aliasing averages the dither away
  varying vec3 vTerrainWorld;

  float taaIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

  // ground height from the finest height map that covers xz; .y = how uncertain it is (about a third of the
  // map's cell size: the maps are coarser than the mesh further out)
  vec2 terrainHeight(vec2 xz) {
    vec2 un = xz / (2.0 * uHNearHalf) + 0.5;
    if (un.x > 0.002 && un.x < 0.998 && un.y > 0.002 && un.y < 0.998) return vec2(texture2D(uHNear, un).r, 0.2);
    vec2 um = xz / (2.0 * uHMidHalf) + 0.5;
    if (um.x > 0.001 && um.x < 0.999 && um.y > 0.001 && um.y < 0.999) return vec2(texture2D(uHMid, um).r, 0.8);
    return vec2(texture2D(uHFar, xz / (2.0 * uHFarHalf) + 0.5).r, 3.0);
  }

  float terrainShadow(vec3 lightDirView) {
    vec3 L = normalize((vec4(lightDirView, 0.0) * viewMatrix).xyz);
    if (L.y < -0.03) return 0.0;
    vec3 p = vTerrainWorld;
    // start on the height map's own surface so it never shadows itself where it differs from the mesh
    vec2 h0 = terrainHeight(p.xz);
    p.y = max(p.y, h0.x) + 0.05;
    // the first step is dithered per pixel and per frame, which breaks the march's banding into fine noise
    // that temporal anti-aliasing then averages out
    float t = (0.5 + 2.0 * h0.y) * (0.5 + taaIGN(gl_FragCoord.xy + uTaaNoise));
    float res = 1.0;
    for (int i = 0; i < 64; i++) {
      if (i >= uShadowSteps) break;
      vec3 q = p + L * t;
      if (abs(q.x) > uHFarHalf || abs(q.z) > uHFarHalf || q.y > 1800.0) break;
      vec2 h = terrainHeight(q.xz);
      float d = q.y - h.x + h.y + t * 0.004;
      res = min(res, 24.0 * d / t);
      if (res < -0.2) break;
      t += 0.5 + t * 0.17;
    }
    return smoothstep(0.0, 1.0, clamp(res, 0.0, 1.0));
  }

  // Bump: a smooth height known only through its screen-space derivatives (dHdxy; texture layers), plus a
  // gradient computed exactly in world space (craters, cracks, ripples). The exact part has no 2x2-pixel
  // steps, which derivatives of thin, sharp features always show.
  vec3 perturbNormal(vec3 surfPos, vec3 n, vec2 dHdxy, vec3 gradWorld, float faceDir) {
    vec3 dpx = dFdx(surfPos);
    vec3 dpy = dFdy(surfPos);
    vec3 r1 = cross(dpy, n);
    vec3 r2 = cross(n, dpx);
    float det = dot(dpx, r1) * faceDir;
    vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
    vec3 g = (viewMatrix * vec4(gradWorld, 0.0)).xyz;
    g -= dot(g, n) * n;
    return normalize(abs(det) * (n - g) - grad);
  }

  float ssD(float a, float b, float x) {
    float t = clamp((x - a) / (b - a), 0.0, 1.0);
    return 6.0 * t * (1.0 - t) / (b - a);
  }

  float dHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
`;

const GROUND_GLSL = /* glsl */ `
  uniform sampler2D uDetail;
  uniform float uStyle;
  uniform vec3 uTintA;
  uniform vec3 uTintB;
  uniform vec4 uDune;        // direction (xy), wavelength, height; height 0 = no dunes
  uniform vec2 uDuneRange;   // from, to (m)
  uniform vec3 uMeshSpacing; // see MESH_SPACING in terrain.ts
  float gDetailH;
  vec3 gDetailG;

  // Every layer is band-limited: a feature 'feature' metres wide is fully there while it spans about three
  // pixels and gone by the time it shrinks to one, so nothing breaks up into noise at a distance.
  float bandW(float feature, float fp) { return 1.0 - smoothstep(feature * 0.33, feature, fp); }

  // small craters on a jittered grid (3x3 neighbourhood): the gradient of their height (metres per metre)
  vec2 microCraters(vec2 p, float cell, float density, float seed, float fp) {
    float w = bandW(0.1 * cell, fp);
    if (w <= 0.001) return vec2(0.0);
    vec2 g = p / cell;
    vec2 id = floor(g);
    vec2 f = fract(g);
    vec2 grad = vec2(0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 c = id + o;
        if (dHash(c + seed) > density) continue;
        vec2 ctr = o + 0.2 + 0.6 * vec2(dHash(c + seed + 1.7), dHash(c + seed + 3.1));
        float r = 0.16 + 0.3 * dHash(c + seed + 5.3);
        vec2 dv = f - ctr;
        float len = length(dv);
        float q = len / r;
        if (q > 1.9) continue;
        // height = (bowl + rim) * r * cell * 0.22; the bowl has a smooth lip and the rim is widened to about
        // two pixels (keeping its volume)
        float rw = clamp(sqrt(0.0484 + pow(2.0 * fp / (r * cell), 2.0)), 0.22, 0.45);
        float x = (q - 1.0) / rw;
        float rimD = 0.38 * (0.22 / rw) * exp(-x * x) * (-2.0 * x / rw);
        float bowlD = 3.0 * q * sqrt(max(1.0 - q * q, 0.0));
        grad += (bowlD + rimD) * 0.22 * dv / max(len, 1e-5);
      }
    }
    return grad * w;
  }

  // distance to the nearest border of a jittered cell pattern, in cell units (.x), and its gradient (.yz)
  vec3 cellEdge(vec2 p) {
    vec2 id = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 v1 = vec2(1.0, 0.0);
    vec2 v2 = vec2(1.0, 0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 v = f - (o + 0.1 + 0.8 * vec2(dHash(id + o), dHash(id + o + 4.1)));
        float d = length(v);
        if (d < d1) { d2 = d1; v2 = v1; d1 = d; v1 = v; } else if (d < d2) { d2 = d; v2 = v; }
      }
    }
    return vec3(0.5 * (d2 - d1), 0.5 * (v2 / max(d2, 1e-5) - v1 / max(d1, 1e-5)));
  }

  // colour variation from the noise texture (it is mipmapped, so it filters itself)
  float albW(float tile, float fp) { return 1.0 - smoothstep(tile * 0.06, tile * 0.3, fp); }

  // returns the smooth height (bumped through screen-space derivatives); 'grad' gets the exact gradient of the
  // sharp features
  // flatW: 1 on level ground, 0 on steep faces, where patterns projected from above would be stretched
  float groundDetail(vec2 p, float fp, float flatW, out vec3 alb, out vec2 grad) {
    vec4 a = texture2D(uDetail, p / 0.7);
    vec4 b = texture2D(uDetail, p / 2.9 + 0.37);
    vec4 c = texture2D(uDetail, p / 11.0 + 0.71);
    vec4 d = texture2D(uDetail, p / 47.0 + 0.13);
    // the texture's main features are about a fourteenth of its tile
    float ha = bandW(0.05, fp);
    float hb = bandW(0.2, fp);
    float hc = bandW(0.8, fp);
    float hd = bandW(3.4, fp);
    float h = ((a.r - 0.5) * 0.02 * ha + (b.r - 0.5) * 0.07 * hb + (c.g - 0.5) * 0.18 * hc + (d.b - 0.5) * 0.4 * hd) * mix(0.35, 1.0, flatW);
    alb = vec3(0.94 + 0.16 * (a.g - 0.5) * albW(0.7, fp) + 0.24 * (b.b - 0.5) * albW(2.9, fp) + 0.3 * (c.a - 0.5) + 0.2 * (d.r - 0.5));
    grad = vec2(0.0);
    if (uStyle < 0.5) {
      // bare rock: fine grit only
    } else if (uStyle < 1.5) {
      // regolith: craters from footprint-size to house-size, and fine grit
      grad += (microCraters(p, 0.45, 0.45, 3.0, fp) + microCraters(p, 1.7, 0.5, 1.0, fp)
            + microCraters(p, 6.5, 0.45, 7.0, fp) + microCraters(p, 24.0, 0.4, 11.0, fp)) * flatW;
      alb *= 0.96 + 0.08 * (a.b - 0.5) * albW(0.7, fp);
    } else if (uStyle < 2.5) {
      // sulfur crust: polygonal cracks, raised plate edges, frost and sulfur deposits, dark lava patches
      float cell = 2.6;
      vec3 E = cellEdge(p / cell + (c.r - 0.5) * 0.45);
      float e = E.x * cell;                                         // metres to the nearest crack
      float cw = 0.035;                                             // half-width of a crack
      float aa = max(fp * 0.6, 1e-4);
      float cover = clamp(2.0 * cw / max(fp, 1e-4), 0.0, 1.0);      // how much of a pixel a crack fills
      float crack = (1.0 - smoothstep(cw - aa, cw + aa, e)) * mix(0.25, 1.0, cover) * (1.0 - smoothstep(0.15, 0.5, fp)) * flatW;
      float relief = bandW(0.12, fp) * flatW;
      float dh = 0.035 * ssD(0.0, cw * 3.0, e)
               + 0.018 * (ssD(cw, cw * 3.0, e) * (1.0 - smoothstep(cw * 3.0, cw * 10.0, e)) - smoothstep(cw, cw * 3.0, e) * ssD(cw * 3.0, cw * 10.0, e));
      grad += relief * dh * E.yz;
      alb *= mix(vec3(1.0), vec3(0.46, 0.38, 0.3), crack * 0.85);
      // colour patches: once a patch is only a few pixels across (or stretched on a steep face) it fades to
      // the average tint instead of breaking into speckles
      float wc = albW(11.0, fp) * flatW;
      float wd = albW(47.0, fp) * mix(0.4, 1.0, flatW);
      alb *= mix(vec3(1.0), uTintA, mix(0.1, smoothstep(0.52, 0.72, c.r), wc) * 0.85);
      alb *= mix(vec3(1.0), uTintB, mix(0.1, smoothstep(0.56, 0.78, d.g), wd) * 0.6);
      alb *= mix(vec3(1.0), vec3(0.42, 0.34, 0.28), mix(0.05, smoothstep(0.64, 0.8, d.a), wd) * 0.7);
    } else if (uStyle < 3.5) {
      // ice: smoother, brighter, with wind-carved ridges
      h *= 0.55;
      vec2 k = vec2(0.7, 0.71);
      grad += cos(dot(p, k) * 4.0 + (c.r - 0.5) * 8.0) * 4.0 * k * 0.01 * bandW(0.8, fp) * flatW;
      alb = mix(alb, vec3(1.0), 0.45);
    } else if (uStyle < 4.5) {
      // sand: wind ripples
      vec2 k = vec2(0.8, 0.6);
      grad += cos(dot(p, k) * 9.0 + (c.r - 0.5) * 7.0) * 9.0 * k * 0.014 * bandW(0.35, fp) * flatW;
      h += (b.g - 0.5) * 0.03 * hb;
    } else {
      // rounded pebbles
      vec3 E = cellEdge(p / 0.32);
      float e = 2.0 * E.x;
      float wp = bandW(0.1, fp) * flatW;
      grad += ssD(0.0, 0.3, e) * 0.035 * wp * (2.0 * E.yz / 0.32);
      alb *= 0.82 + 0.32 * smoothstep(0.0, 0.3, e) * wp + 0.18 * (1.0 - wp);
    }
    // dunes beyond the reach of the mesh: drawn as shading (the mesh carries them close to the viewer)
    if (uDune.w > 0.0) {
      float r = length(p);
      float sp = max(min(r * uMeshSpacing.x, uMeshSpacing.y), r * uMeshSpacing.z);
      float geo = 1.0 - smoothstep(uDune.z * 0.25, uDune.z * 0.5, sp);
      float band = smoothstep(uDuneRange.x * 0.7, uDuneRange.x, r) * (1.0 - smoothstep(uDuneRange.y * 0.8, uDuneRange.y, r));
      float wv = band * (1.0 - geo) * bandW(uDune.z * 0.3, fp) * flatW;
      if (wv > 0.001) {
        float warp = (texture2D(uDetail, p / (uDune.z * 6.0) + 0.21).g - 0.5) * 3.0;
        float ph = dot(p, uDune.xy) / uDune.z + warp;
        float sn = sin(3.14159265 * ph);
        float cr = max(1.0 - abs(sn), 1e-4);
        // the slope flips at each crest: round the flip over about two pixels so crest lines don't zigzag
        float soft = max(0.06, 2.0 * fp / uDune.z);
        float dcr = -1.6 * pow(cr, 0.6) * (sn / sqrt(sn * sn + soft * soft)) * 3.14159265 * cos(3.14159265 * ph);
        grad += 0.45 * uDune.w * wv * dcr * uDune.xy / uDune.z;
      }
    }
    return h;
  }
`;

const SHADOWMAP_PARS = THREE.ShaderChunk.shadowmap_pars_fragment
  .split('interleavedGradientNoise( gl_FragCoord.xy )')
  .join('interleavedGradientNoise( gl_FragCoord.xy + uTaaNoise )');

function injectShadows(fragment: string): string {
  return fragment.replace('#include <shadowmap_pars_fragment>', SHADOWMAP_PARS).replace(
    '#include <lights_fragment_begin>',
    THREE.ShaderChunk.lights_fragment_begin.replace(
      'getDirectionalLightInfo( directionalLight, directLight );',
      'getDirectionalLightInfo( directionalLight, directLight );\n\t\t#ifndef DBG_NOSHADOW\n\t\tdirectLight.color *= ( length( directLight.color ) > 0.08 ) ? terrainShadow( directionalLight.direction ) : 1.0;\n\t\t#endif'
    )
  ).replace(
    '#include <dithering_fragment>',
    '#include <dithering_fragment>\n#ifdef DBG_SHADOW\ngl_FragColor = vec4(vec3(terrainShadow(directionalLights[0].direction)), 1.0);\n#endif'
  );
}

function shadowUniforms(terrain: Terrain, steps: number) {
  return {
    uHNear: { value: terrain.nearMap },
    uHMid: { value: terrain.midMap },
    uHFar: { value: terrain.farMap },
    uHNearHalf: { value: NEAR_MAP_HALF },
    uHMidHalf: { value: MID_MAP_HALF },
    uHFarHalf: { value: FAR_MAP_HALF },
    uShadowSteps: { value: steps },
    uTaaNoise: taaNoise,
  };
}

export function makeGroundMaterial(terrain: Terrain, spec: TerrainSpec, steps: number) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: spec.roughness, metalness: 0 });
  const detail = groundDetailTexture();
  const tints = spec.tints ?? [[1, 1, 1], [1, 1, 1]];
  const dunes = spec.dunes;
  const dir = dunes ? THREE.MathUtils.degToRad(dunes.directionDeg) : 0;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shadowUniforms(terrain, steps), {
      uDetail: { value: detail },
      uStyle: { value: STYLE_ID[spec.surface] },
      uTintA: { value: new THREE.Vector3(...tints[0]) },
      uTintB: { value: new THREE.Vector3(...tints[1]) },
      uDune: { value: dunes ? new THREE.Vector4(Math.cos(dir), Math.sin(dir), dunes.wavelength, dunes.amplitude) : new THREE.Vector4() },
      uDuneRange: { value: dunes ? new THREE.Vector2(dunes.from, dunes.to) : new THREE.Vector2() },
      uMeshSpacing: { value: new THREE.Vector3(MESH_SPACING.geo, MESH_SPACING.band, MESH_SPACING.seg) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = dbgDefine(injectShadows(
      shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${SHADOW_GLSL}\n${GROUND_GLSL}`)
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          {
            float fp = length(fwidth(vTerrainWorld.xz));
            vec3 nW = normalize((vec4(normalize(vNormal), 0.0) * viewMatrix).xyz);
            vec3 alb;
            vec2 g2;
            gDetailH = groundDetail(vTerrainWorld.xz, fp, smoothstep(0.55, 0.85, nW.y), alb, g2);
            gDetailG = vec3(g2.x, 0.0, g2.y);
            diffuseColor.rgb *= alb;
          }`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          #ifndef DBG_NOBUMP
          normal = perturbNormal(-vViewPosition, normal, vec2(dFdx(gDetailH), dFdy(gDetailH)), gDetailG, faceDirection);
          #endif`
        )
    ));
  };
  m.customProgramCacheKey = () => 'ow-ground' + (DBG ?? '');
  return m;
}

export function makeRockMaterial(terrain: Terrain, steps: number) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  const detail = groundDetailTexture();
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shadowUniforms(terrain, steps), { uDetail: { value: detail } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld;\nvarying vec3 vRockNormal;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
            wn = mat3(instanceMatrix) * wn;
          #endif
          vTerrainWorld = (modelMatrix * wp).xyz;
          vRockNormal = normalize(mat3(modelMatrix) * wn);
        }`
      );
    shader.fragmentShader = dbgDefine(injectShadows(
      shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${SHADOW_GLSL}\nuniform sampler2D uDetail;\nvarying vec3 vRockNormal;\nfloat gRockH;`)
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          {
            // triplanar grit and flecks on the stone, in world space
            vec3 w = pow(abs(normalize(vRockNormal)), vec3(4.0));
            w /= (w.x + w.y + w.z);
            vec3 p = vTerrainWorld;
            vec4 fx = texture2D(uDetail, p.yz / 0.35) * w.x + texture2D(uDetail, p.xz / 0.35) * w.y + texture2D(uDetail, p.xy / 0.35) * w.z;
            vec4 cx = texture2D(uDetail, p.yz / 1.4 + 0.3) * w.x + texture2D(uDetail, p.xz / 1.4 + 0.3) * w.y + texture2D(uDetail, p.xy / 1.4 + 0.3) * w.z;
            float fp = length(fwidth(p));
            float wf = 1.0 - smoothstep(0.02, 0.1, fp);
            gRockH = (fx.r - 0.5) * 0.012 * wf + (cx.g - 0.5) * 0.04;
            diffuseColor.rgb *= 0.8 + 0.35 * (cx.b - 0.5) + 0.25 * (fx.a - 0.5) * wf + 0.1;
          }`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          normal = perturbNormal(-vViewPosition, normal, vec2(dFdx(gRockH), dFdy(gRockH)), vec3(0.0), faceDirection);`
        )
    ));
  };
  m.customProgramCacheKey = () => 'ow-rock' + (DBG ?? '');
  return m;
}
