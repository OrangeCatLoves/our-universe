// Sky radiance for "Skies of Other Worlds", as a GLSL chunk shared by the sky dome and by surfaces
// that reflect the sky (methane seas, ice). Output is linear HDR (bloom and the film grade follow).

export const SKY_UNIFORMS = /* glsl */ `
  precision highp sampler3D;
  uniform vec3 uSunDir[2];
  uniform vec3 uSunCol[2];
  uniform float uSunDisk[2];
  uniform float uSunRad[2];
  uniform float uSunWeight[2];
  uniform int uSunCount;
  uniform float uKind;            // 0 airless, 1 air, 2 haze
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uNight;
  uniform vec3 uGlow;
  uniform float uGlowWidth;
  uniform vec3 uTwilight;
  uniform float uSkyBright;
  uniform float uStarsDay;
  uniform float uStars;
  uniform float uMilkyWay;
  uniform mat3 uStarRot;
  uniform vec3 uGalNormal;
  uniform sampler3D uNoise;
  uniform float uPix;
  uniform vec3 uHazeBand;
  uniform float uHazeBandStrength;
  uniform vec4 uPoints[4];        // xyz direction, w brightness
  uniform vec3 uPointCol[4];
  uniform int uPointCount;
`;

export const SKY_FUNCTIONS = /* glsl */ `
  float skyHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float skyFbm(vec3 p, float oct) {
    float s = 0.0, a = 0.5, w = 0.0;
    for (int i = 0; i < 5; i++) {
      if (float(i) >= oct) break;
      s += a * textureLod(uNoise, p * 0.0625, 0.0).r;
      w += a;
      p = p * 2.07 + vec3(1.73, 9.21, 4.37);
      a *= 0.5;
    }
    return s / w;
  }

  vec3 starLayer(vec3 d, float cells, float prob, float sigma, float seed) {
    vec3 ad = abs(d);
    vec2 uv;
    float face;
    if (ad.x >= ad.y && ad.x >= ad.z) { uv = d.yz / ad.x; face = d.x > 0.0 ? 0.0 : 1.0; }
    else if (ad.y >= ad.z) { uv = d.xz / ad.y; face = d.y > 0.0 ? 2.0 : 3.0; }
    else { uv = d.xy / ad.z; face = d.z > 0.0 ? 4.0 : 5.0; }
    vec2 g = uv * cells;
    vec2 id = floor(g);
    vec2 key = id + vec2(face * 1013.0 + seed * 71.0, seed * 37.0);
    if (skyHash(key) > prob) return vec3(0.0);
    float m = skyHash(key + 5.3);
    float b = 0.05 + 0.7 * pow(m, 8.0) + 8.0 * pow(m, 70.0);
    float bright = smoothstep(1.0, 4.0, b);
    vec2 sp = id + 0.5 + (vec2(skyHash(key + 3.7), skyHash(key + 9.1)) - 0.5) * mix(0.7, 0.2, bright);
    float dist = length(g - sp) / cells;
    // colour temperature: hot blue-white through white and yellow to cool orange-red (most are white/yellow)
    float tc = skyHash(key + 7.9);
    vec3 c = tc < 0.12 ? mix(vec3(0.58, 0.7, 1.0), vec3(0.78, 0.85, 1.0), tc / 0.12)
           : tc < 0.55 ? mix(vec3(0.86, 0.9, 1.0), vec3(1.0, 0.97, 0.92), (tc - 0.12) / 0.43)
           : tc < 0.85 ? mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.84, 0.62), (tc - 0.55) / 0.3)
           : mix(vec3(1.0, 0.74, 0.5), vec3(1.0, 0.58, 0.38), (tc - 0.85) / 0.15);
    float core = exp(-dist * dist / (sigma * sigma));
    float glow = exp(-dist * dist / (6.25 * sigma * sigma)) * 0.07 * bright;
    return c * b * (core + glow);
  }

  // stars and the Milky Way, for a direction in the (rotating) celestial frame
  vec3 starsAt(vec3 c) {
    float lat = dot(c, uGalNormal);
    float band = exp(-lat * lat / 0.025);
    vec3 col = vec3(0.0);
    if (uMilkyWay > 0.0) {
      float clouds = skyFbm(c * 7.0 + 3.0, 4.0);
      float dust = skyFbm(c * 9.0 + vec3(5.0, 1.0, 8.0), 4.0);
      float lanes = smoothstep(0.47, 0.62, dust) * exp(-lat * lat / 0.006);
      col += vec3(0.55, 0.62, 0.9) * band * pow(clouds, 2.5) * 4.0 * (1.0 - 0.9 * lanes) * uMilkyWay * 0.025;
    }
    float sigma = uPix * 0.8;
    float boost = 1.0 + 2.0 * band * uMilkyWay;
    col += starLayer(c, 55.0, 0.07, sigma, 1.0)
         + 0.45 * starLayer(c, 140.0, 0.08 * boost, sigma, 2.0)
         + 0.16 * starLayer(c, 330.0, 0.1 * boost, sigma, 3.0);
    return col;
  }

  float skyDaylight() {
    float s = 0.0;
    for (int i = 0; i < 2; i++) {
      if (i >= uSunCount) break;
      s += smoothstep(-0.14, 0.22, uSunDir[i].y) * uSunWeight[i];
    }
    return clamp(s, 0.0, 1.0);
  }

  vec3 skyRadiance(vec3 d, float withStars) {
    vec3 col = vec3(0.0);
    float up = clamp(d.y, 0.0, 1.0);
    float horizonW = pow(1.0 - up, 5.0);
    vec2 dh = normalize(d.xz + vec2(1e-5));
    for (int i = 0; i < 2; i++) {
      if (i >= uSunCount) break;
      vec3 s = uSunDir[i];
      float w = uSunWeight[i];
      float h = s.y;
      float cosT = dot(d, s);
      float ang = acos(clamp(cosT, -1.0, 1.0));
      float day = smoothstep(-0.14, 0.22, h);
      if (uKind > 0.5) {
        vec3 base = mix(uHorizon, uZenith, pow(up, uKind > 1.5 ? 0.8 : 0.45));
        float low = 1.0 - smoothstep(0.02, 0.35, h);
        float azTo = dot(dh, normalize(s.xz + vec2(1e-5))) * 0.5 + 0.5;
        base *= mix(1.0, 0.22 + 0.78 * azTo, low);
        col += base * day * uSkyBright * w;
        float tw = smoothstep(-0.2, 0.0, h) * (1.0 - smoothstep(0.0, 0.32, h));
        col += uTwilight * pow(azTo, 3.0) * horizonW * tw * uSkyBright * w * 1.3;
        col += uGlow * exp(-ang / uGlowWidth) * smoothstep(-0.12, 0.04, h) * uSkyBright * w;
      } else {
        col += uGlow * exp(-ang / uGlowWidth) * 0.5 * w * smoothstep(-0.02, 0.01, h);
      }
      float r = uSunRad[i];
      if (uSunDisk[i] > 0.0) {
        float x = ang / r;
        float disk = 1.0 - smoothstep(0.9, 1.0, x);
        float limb = sqrt(max(1.0 - x * x, 0.0));
        col += uSunCol[i] * uSunDisk[i] * disk * (0.5 + 0.5 * limb);
        col += uSunCol[i] * uSunDisk[i] * 0.03 * exp(-max(ang - r, 0.0) / (r * 1.5 + 0.003));
      }
    }
    float daylight = skyDaylight();
    col += uNight * (1.0 - daylight) * (0.5 + 0.5 * horizonW);

    if (uHazeBandStrength > 0.0) {
      float e = asin(clamp(d.y, -1.0, 1.0));
      float bands = 0.0;
      for (int k = 0; k < 6; k++) {
        float ek = 0.012 + float(k) * 0.011;
        bands += exp(-pow((e - ek) / 0.0026, 2.0)) * (1.0 - float(k) * 0.13);
      }
      bands += 0.35 * exp(-max(e - 0.01, 0.0) / 0.04) * smoothstep(0.0, 0.012, e);
      vec3 s = uSunDir[0];
      float lit = smoothstep(-0.12, 0.06, s.y) * (0.45 + 0.55 * pow(max(dot(dh, normalize(s.xz + vec2(1e-5))), 0.0), 2.0));
      col += uHazeBand * bands * uHazeBandStrength * lit * step(-0.01, d.y);
    }

    if (withStars > 0.5) {
      float vis = mix(uStarsDay, 1.0, 1.0 - daylight) * uStars;
      if (vis > 0.001) col += starsAt(uStarRot * d) * vis;
      float pointVis = uKind > 0.5 ? (1.0 - 0.97 * daylight) : 1.0;
      for (int k = 0; k < 4; k++) {
        if (k >= uPointCount) break;
        float a = acos(clamp(dot(d, uPoints[k].xyz), -1.0, 1.0));
        col += uPointCol[k] * uPoints[k].w * exp(-a * a / (uPix * uPix * 1.4)) * pointVis;
      }
    }
    return col;
  }
`;

export const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // always at the far plane
  }
`;

export const domeFragment = /* glsl */ `
  ${SKY_UNIFORMS}
  uniform vec3 uGround;
  varying vec3 vDir;
  ${SKY_FUNCTIONS}
  void main() {
    vec3 d = normalize(vDir);
    vec3 col = skyRadiance(d, 1.0);
    // below the horizon (only seen past the edge of the terrain): fade into the ground haze
    col = mix(col, uGround, smoothstep(0.0, -0.03, d.y));
    gl_FragColor = vec4(col, 0.0); // alpha 0 marks sky pixels for temporal anti-aliasing (they turn with the stars)
  }
`;

// Liquid (Titan's methane sea) and ice (Proxima b's frozen shore): reflect the sky, with ripples
export const liquidVertex = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

export const liquidFragment = /* glsl */ `
  ${SKY_UNIFORMS}
  uniform vec3 uDeep;
  uniform float uRough;
  uniform float uTime;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${SKY_FUNCTIONS}
  void main() {
    vec3 v = normalize(vWorld - cameraPosition);
    vec2 p = vWorld.xz;
    float n1 = textureLod(uNoise, vec3(p * 0.045 + uTime * 0.02, 0.3) * 0.0625 * 16.0, 0.0).r;
    float n2 = textureLod(uNoise, vec3(p.yx * 0.11 - uTime * 0.03, 2.7) * 0.0625 * 16.0, 0.0).g;
    float rip = uRough * 2.0 * (1.0 - smoothstep(0.4, 5.0, length(fwidth(p))));
    vec3 nrm = normalize(vec3((n1 - 0.5) * rip, 1.0, (n2 - 0.5) * rip));
    vec3 r = reflect(v, nrm);
    r.y = abs(r.y);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(-v, nrm), 0.0), 5.0);
    vec3 refl = skyRadiance(r, 0.0);
    vec3 col = mix(uDeep * (0.2 + skyDaylight()), refl, fres);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

// Io's volcanic plume and Enceladus' ice geysers: glowing sprites beyond the horizon
export const plumeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const plumeFragment = /* glsl */ `
  precision highp sampler3D;
  uniform sampler3D uNoise;
  uniform vec3 uColor;
  uniform float uLight;
  uniform float uTime;
  uniform float uKind;   // 0 = umbrella plume, 1 = geyser curtain
  uniform float uSeed;
  varying vec2 vUv;
  float nz(vec2 p, float z) { return textureLod(uNoise, vec3(p, z) * 0.0625, 0.0).r; }
  void main() {
    float x = vUv.x * 2.0 - 1.0;
    float y = vUv.y;
    float I = 0.0;
    vec3 tint = uColor;
    // pixel size in plume units: thin streaks are widened to about a pixel (keeping their brightness), so they
    // don't break into dashes or crawl as the view turns
    float pxY = max(fwidth(y), 1e-4);
    float pxX = max(fwidth(x), 1e-4);
    if (uKind < 0.5) {
      // a fountain: gas and dust thrown out of the vent on ballistic arcs (no air to slow them), which
      // together trace the umbrella; glowing clumps travel outward along each arc
      float ax = abs(x);
      for (int k = 0; k < 40; k++) {
        float r1 = fract(sin(float(k) * 12.9898 + uSeed) * 43758.5453);
        float r2 = fract(sin(float(k) * 78.233 + uSeed * 1.3) * 24634.634);
        float R = 0.12 + 0.84 * r1 * r1;            // where the arc lands
        float H = 0.45 + 0.5 * r2 + 0.08 * R;       // how high it climbs
        float u = ax / R;
        if (u > 1.0) continue;
        float yy = 4.0 * H * u * (1.0 - u);
        float w = 0.003 + 0.011 * u + 0.008 * y;
        float we = max(w, pxY * 0.85);
        float d = y - yy;
        float streak = exp(-d * d / (we * we)) * (w / we);
        float clumps = 0.55 + 0.45 * sin((u * 7.0 - uTime * 0.6 + r2 * 6.28) * 6.2832);
        I += streak * (0.35 + 0.65 * r2) * clumps * (1.0 - 0.6 * u);
      }
      I *= 0.24;
      float canopy = exp(-pow((y - 0.82 * (1.0 - ax * ax)) / 0.1, 2.0)) * smoothstep(1.0, 0.5, ax) * 0.12;
      I += canopy;
      float cwid = 0.02 + 0.1 * y;
      float cwe = max(cwid, pxX * 0.85);
      float column = exp(-pow(x / cwe, 2.0)) * (cwid / cwe) * exp(-y / 0.55) * 0.9;
      float haze = exp(-pow(ax / 0.55, 2.0)) * smoothstep(0.95, 0.2, y) * 0.12;
      float fwid = max(0.02, pxY * 0.85);
      float fallout = exp(-pow(y / fwid, 2.0)) * (0.02 / fwid) * smoothstep(0.98, 0.3, ax) * 0.35;
      I += column + haze + fallout;
      I *= (0.75 + 0.5 * nz(vec2(x * 8.0 + uSeed, y * 6.0 - uTime * 0.05), 3.1));
      I *= smoothstep(0.0, 0.03, y + 0.02);
      tint = mix(uColor, vec3(1.0, 0.86, 0.5), smoothstep(0.35, 0.0, y) * 0.7); // sulfur-yellow near the vent
    } else {
      // several narrow jets that fan out and fade with height
      for (int j = 0; j < 7; j++) {
        float r1 = fract(sin(float(j) * 91.7 + uSeed) * 43758.5);
        float r2 = fract(sin(float(j) * 37.3 + uSeed * 1.7) * 24634.6);
        float xj = -0.75 + float(j) * 0.25 + (r1 - 0.5) * 0.16 + 0.05 * y * (r2 - 0.5) * 4.0;
        float wj0 = (0.012 + 0.02 * r2) + (0.06 + 0.1 * r1) * y;
        float wj = max(wj0, pxX * 0.85);
        float hj = 0.3 + 0.7 * r2;
        float bj = 0.4 + 0.9 * r1;
        I += bj * (wj0 / wj) * exp(-pow((x - xj) / wj, 2.0)) * exp(-y / (0.26 * hj)) * (0.55 + 0.9 * nz(vec2(x * 9.0 + float(j), y * 5.0 - uTime * 0.25), 5.3)) * 0.7;
      }
      I += 0.07 * exp(-abs(x) / 0.4) * exp(-y / 0.45) * (0.6 + 0.8 * nz(vec2(x * 3.0, y * 2.0 - uTime * 0.05), 8.1));
    }
    float edge = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x) * smoothstep(1.0, 0.45, vUv.y);
    gl_FragColor = vec4(tint * I * edge * uLight, 1.0);
  }
`;
