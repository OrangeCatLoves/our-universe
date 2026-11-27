// Real-time gravitational lensing (Schwarzschild), rendered as one full-screen fragment shader into an
// HDR buffer (bloom and the colour grade are applied afterwards).
//
// Units: Schwarzschild radius = 1. Each pixel traces a photon backwards from the camera with the exact
// photon-orbit equation written as an acceleration, a = -1.5 h^2 r / |r|^5 (h = |r x v| is conserved),
// integrated with a symplectic leapfrog scheme so the photon ring stays crisp. Along the way it gathers
// light from the features a black hole has; each feature is compiled in only when its #define is set:
//   DISK (+THICK_DISK)  accretion disk: thin glowing sheet, or a puffy hot flow sampled as a volume
//   JET                 relativistic jets with travelling knots (optionally precessing)
//   COMPANION (+STREAM) a companion star (tidally stretched) and the gas stream it feeds into the disk
//   HOTSPOT             a flare orbiting close to the horizon
//   BINARY (+GWAVES)    two black holes, and gravitational-wave ripples distorting the sky
//   GLOW                quasar glare around the hole
// Rays that escape sample a procedural sky (STARS, MILKYWAY, DIFFUSE, FILAMENTS, ECHOES, GALAXY, HALO),
// so everything behind the hole is lensed too. Rays that fall into the horizon stay black.

export const lensingVertex = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const lensingFragment = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform vec2 uRes;
  uniform float uTime;
  uniform float uFlowTime;
  uniform vec3 uCamPos;
  uniform mat3 uCamRot;
  uniform float uTanHalfFov;
  uniform vec2 uShift;
  uniform float uRoll;
  uniform sampler3D uNoise;
  uniform int uSteps;
  uniform int uDiskSamples;
  uniform float uOctaves;
  uniform float uEscape;
  uniform float uFade;
  uniform vec3 uCenterDir;

  uniform vec4 uHole1;
  uniform vec4 uHole2;

  uniform float uDiskBright;
  uniform float uDiskIn;
  uniform float uDiskOut;
  uniform float uDiskThick;
  uniform float uDiskOpacity;
  uniform vec3 uDiskHot;
  uniform vec3 uDiskCool;
  uniform float uTempFall;
  uniform float uProfile;
  uniform float uRadialScale;
  uniform float uAzimuthScale;
  uniform float uTurb;
  uniform float uRings;
  uniform float uContrast;
  uniform float uDoppler;
  uniform float uSpeed;

  uniform vec3 uJetAxis;
  uniform vec3 uJetColor;
  uniform float uJet;
  uniform float uJetWidth;
  uniform float uJetLength;
  uniform float uKnotSpeed;
  uniform float uJetCounter;

  uniform vec4 uComp;
  uniform vec3 uCompAxis;
  uniform float uCompStretch;
  uniform vec3 uCompColor;
  uniform float uCompBright;
  uniform vec3 uStreamPts[8];
  uniform vec4 uStreamBounds;
  uniform vec3 uStreamColor;
  uniform float uStreamBright;
  uniform float uStreamWidth;

  uniform vec4 uSpot;
  uniform vec3 uSpotVel;
  uniform vec3 uSpotColor;

  uniform float uGlow;
  uniform vec3 uGlowColor;

  uniform float uGwAmp;
  uniform float uOrbitPhase;
  uniform float uBurstR;
  uniform float uBurstAmp;

  uniform float uStars;
  uniform float uStarDensity;
  uniform vec3 uStarTint;
  uniform vec3 uGalNormal;
  uniform vec3 uGalCenter;
  uniform float uMilkyWay;
  uniform float uDiffuse;
  uniform vec3 uDiffuseColor;
  uniform float uDust;
  uniform float uFil;
  uniform vec3 uFilColor;
  uniform vec3 uFilKnots;
  uniform float uEcho;
  uniform vec3 uEchoColor;
  uniform float uGalaxy;
  uniform vec3 uGalaxyColor;
  uniform float uClusters;
  uniform float uHalo;
  uniform vec3 uHaloColor;

  const float PI = 3.14159265;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // 4 independent channels of smooth tileable noise (period 16 lattice cells)
  vec4 nz(vec3 p) { return textureLod(uNoise, p * 0.0625, 0.0); }

  // fbm with a fractional octave count: the last octave fades in, so detail can be reduced smoothly
  // where a pixel covers a large patch of gas (a cheap equivalent of mipmapping)
  float fbm(vec3 p, float oct) {
    float s = 0.0, a = 0.5, w = 0.0;
    for (int i = 0; i < 6; i++) {
      float k = clamp(oct - float(i), 0.0, 1.0);
      if (k <= 0.0) break;
      s += a * k * nz(p).r;
      w += a * k;
      p = p * 2.07 + vec3(1.73, 9.21, 4.37);
      a *= 0.5;
    }
    return s / w;
  }

  // ---------------------------------------------------------------- gravity
  vec3 gravity(vec3 p, vec3 v, float h2) {
    vec3 d1 = p - uHole1.xyz;
    float r1 = length(d1);
  #ifdef BINARY
    vec3 c1 = cross(d1, v);
    vec3 a = -1.5 * uHole1.w * dot(c1, c1) * d1 / pow(r1, 5.0);
    vec3 d2 = p - uHole2.xyz;
    float r2 = max(length(d2), 1e-3);
    vec3 c2 = cross(d2, v);
    a += -1.5 * uHole2.w * dot(c2, c2) * d2 / pow(r2, 5.0);
    return a;
  #else
    return -1.5 * uHole1.w * h2 * d1 / pow(r1, 5.0);
  #endif
  }

  // ---------------------------------------------------------------- accretion disk
  #ifdef DISK
  // Gas density pattern in the co-rotating frame. The azimuth is mapped onto a circle in noise space,
  // so the pattern wraps around the orbit without a seam; low azimuth frequency = long orbital streaks.
  float gas(float r, vec2 cs, float seed, float oct) {
    vec3 q = vec3(r * uRadialScale, cs * uAzimuthScale + vec2(r * 0.37, r * 0.23)) + seed * vec3(7.31, 3.17, 5.71);
    vec4 w = nz(q * 0.43 + 21.7);
    q += (w.gba - 0.5) * uTurb * 4.0;
    float f = fbm(q, oct);
    float ring = nz(vec3(r * uRadialScale * 0.31 + seed * 11.3, 2.5, 6.5)).a;
    return f * mix(1.0, 0.25 + 1.5 * ring, uRings);
  }

  vec2 rot2(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  }

  // Source colour (rgb) and gas density (a) at p, seen along ray direction rd. The caller turns density
  // into opacity: a thin disk as a sheet (optical depth / |cos view angle|), a thick flow per unit length.
  // flow = (time of layer A, time of layer B, weight of A), seeds = per-layer pattern seeds.
  // fp = approximate size of the patch of gas one pixel covers (for level of detail)
  vec4 diskSample(vec3 p, vec3 rd, vec3 flow, vec2 seeds, float fp) {
    float r = length(p.xz);
    if (r < uDiskIn * 0.7 || r > uDiskOut) return vec4(0.0);
    float H = uDiskThick * r;
    float vert = exp(-p.y * p.y / (H * H));
    if (vert < 0.01) return vec4(0.0);
    vec2 cs = p.xz / r;
    // Keplerian rotation; two cross-faded layers keep the differential rotation from winding up forever
    float om = uSpeed * pow(r / 3.0, -1.5);
    float oct = clamp(1.0 + log2(1.0 / max(2.0 * fp * uRadialScale, 1e-3)), 1.0, uOctaves);
    float gA = gas(r, rot2(cs, -om * flow.x), seeds.x, oct);
    float gB = gas(r, rot2(cs, -om * flow.y), seeds.y, oct);
    float g0 = mix(gB, gA, flow.z);
    float s = pow(clamp((g0 - 0.5) * 2.4 + 0.5, 0.0, 1.0), uContrast);
    float edge = smoothstep(uDiskIn * 0.7, uDiskIn * 1.1, r) * (1.0 - smoothstep(uDiskOut * 0.55, uDiskOut, r));
    float t = clamp((r - uDiskIn) / (uDiskOut - uDiskIn), 0.0, 1.0);
    vec3 col = mix(uDiskHot, uDiskCool, pow(t, uTempFall));
    float bright = uDiskBright * pow(uDiskIn / max(r, uDiskIn * 0.7), uProfile) * (0.35 + 0.65 * s);
    // relativistic beaming (gas moving toward us is brighter and bluer) and gravitational redshift
    float v = clamp(sqrt(0.5 / max(r - 1.0, 0.35)), 0.0, 0.7);
    vec3 vel = v * vec3(-cs.y, 0.0, cs.x);
    float gam = inversesqrt(1.0 - v * v);
    float g = sqrt(max(1.0 - 1.0 / r, 0.04)) / (gam * (1.0 - dot(vel, -rd)));
    col *= pow(g, uDoppler);
    col = mix(col, col * vec3(0.8, 0.95, 1.3), clamp((g - 1.0) * uDoppler * 0.35, 0.0, 0.6));
    col = mix(col, col * vec3(1.25, 0.75, 0.55), clamp((1.0 - g) * uDoppler * 0.35, 0.0, 0.6));
    return vec4(col * bright, vert * edge * s);
  }
  #endif

  // ---------------------------------------------------------------- sky
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
    if (hash12(key) > prob) return vec3(0.0);
    vec2 sp = id + 0.15 + 0.7 * vec2(hash12(key + 3.7), hash12(key + 9.1));
    float dist = length(g - sp) / cells;
    float m = hash12(key + 5.3);
    float b = 0.12 + 7.0 * pow(m, 12.0);
    float tc = hash12(key + 7.9);
    vec3 c = tc < 0.18 ? vec3(0.62, 0.74, 1.0) : (tc > 0.82 ? vec3(1.0, 0.72, 0.45) : vec3(1.0, 0.94, 0.86));
    return c * b * exp(-dist * dist / (sigma * sigma));
  }

  vec3 skyColor(vec3 d, float pix, float fw) {
    vec3 c = vec3(0.0);
    float starBoost = 1.0;
    float starDim = 1.0;

  #ifdef MILKYWAY
    {
      float lat = dot(d, uGalNormal);
      float band = exp(-lat * lat / 0.02);
      float bulge = exp(-pow(acos(clamp(dot(d, uGalCenter), -1.0, 1.0)) / 0.7, 2.0));
      float clouds = fbm(d * 7.0 + 3.0, 4.0);
      float fine = fbm(d * 23.0 + 11.0, 3.0);
      float dust = fbm(d * 9.0 + vec3(5.0, 1.0, 8.0), 4.0);
      float lanes = smoothstep(0.47, 0.62, dust) * exp(-lat * lat / 0.006);
      vec3 mw = mix(vec3(0.38, 0.52, 1.0), vec3(1.0, 0.72, 0.45), bulge);
      mw = mix(mw, vec3(0.75, 0.42, 0.5), smoothstep(0.55, 0.75, fine) * 0.5);  // faint pink nebulae
      float I = band * pow(clouds, 2.5) * 4.0 * (0.6 + 0.8 * fine) * (0.4 + 2.2 * bulge);
      c += mw * I * (1.0 - 0.92 * lanes) * uMilkyWay * 0.03;
      starBoost += 2.0 * band * uMilkyWay;
      starDim *= 1.0 - 0.85 * lanes;
    }
  #endif

  #ifdef DIFFUSE
    {
      float dd = fbm(d * 5.0 + 2.0, 4.0);
      float dustMask = smoothstep(0.44, 0.62, fbm(d * 8.0 + 13.0, 4.0));
      c += uDiffuseColor * uDiffuse * pow(dd, 2.5) * 4.0 * (1.0 - 0.9 * dustMask);
      starDim *= 1.0 - uDust * dustMask;
    }
  #endif

  #ifdef STARS
    {
      float sigma = pix * 0.75;
      float sEff = max(sigma, fw * 0.6);
      float aa = (sigma * sigma) / (sEff * sEff);
      vec3 st = starLayer(d, 55.0, 0.05 * uStarDensity, sEff, 1.0)
              + 0.5 * starLayer(d, 140.0, 0.09 * min(uStarDensity * starBoost, 8.0), sEff, 2.0)
              + 0.25 * starLayer(d, 330.0, 0.11 * min(uStarDensity * starBoost, 8.0), sEff, 3.0);
      c += st * aa * uStars * uStarTint * starDim;
    }
  #endif

  #ifdef FILAMENTS
    {
      vec3 p = d * 3.2;
      float w = fbm(p + 7.0, 3.0);
      float n = fbm(p * 1.6 + w * 2.5, 5.0);
      float ridge = pow(max(1.0 - abs(n - 0.5) * 4.0, 0.0), 10.0);
      float mask = smoothstep(0.45, 0.65, fbm(p * 0.7 + 4.0, 3.0));
      float knots = pow(fbm(p * 6.0 + 2.0, 3.0), 6.0) * ridge * 40.0;
      c += (uFilColor * ridge + uFilKnots * knots) * mask * uFil;
    }
  #endif

  #ifdef ECHOES
    {
      float th = acos(clamp(dot(d, uCenterDir), -1.0, 1.0));
      for (int k = 0; k < 3; k++) {
        float age = fract(uTime * 0.012 + float(k) / 3.0);
        float radius = mix(0.12, 0.8, age);
        float wid = 0.004 + 0.012 * age;
        float ring = exp(-pow((th - radius) / wid, 2.0));
        float dust = smoothstep(0.42, 0.68, fbm(d * 14.0 + float(k) * 5.0, 4.0));
        c += uEchoColor * ring * sin(age * PI) * dust * uEcho;
      }
    }
  #endif

  #ifdef GALAXY
    {
      float th = max(acos(clamp(dot(d, uCenterDir), -1.0, 1.0)), 0.14);
      float I = exp(-7.67 * (pow(th / 0.45, 0.25) - 1.0));
      c += uGalaxyColor * I * uGalaxy * 0.012;
      vec3 gl = starLayer(d, 40.0, 0.25 * uClusters, max(pix * 2.2, 0.0035), 9.0);
      c += uGalaxyColor * dot(gl, vec3(0.33)) * 0.25 * exp(-th / 0.6);
    }
  #endif

  #ifdef HALO
    {
      float th = acos(clamp(dot(d, uCenterDir), -1.0, 1.0));
      float n = fbm(d * 4.0 + 6.0, 4.0);
      c += uHaloColor * exp(-th / 0.55) * (0.4 + 1.2 * n * n) * uHalo;
    }
  #endif

    return c;
  }

  #ifdef GWAVES
  // Gravitational waves stretch and squeeze space in a two-armed spiral that turns with the binary;
  // at the merger a single strong wavefront runs outward. Shown as a distortion of the background.
  vec3 gwDistort(vec3 d, vec3 pSky) {
    vec3 right = uCamRot[0];
    vec3 up = uCamRot[1];
    vec2 q = vec2(dot(pSky, right), dot(pSky, up));
    float rho = length(q);
    if (rho > 900.0) return d;
    float phi = atan(q.y, q.x);
    float env = smoothstep(2.5, 6.0, rho) * exp(-rho / 45.0);
    float spiral = sin(2.0 * (phi - uOrbitPhase) + rho * 0.55) * uGwAmp * env;
    float burst = 0.0;
    if (uBurstR > 0.0) burst = sin((rho - uBurstR) * 1.4) * exp(-pow((rho - uBurstR) / 4.0, 2.0)) * uBurstAmp * smoothstep(2.0, 5.0, rho);
    vec2 radial = q / max(rho, 1e-3);
    vec3 offs = (right * radial.x + up * radial.y) * (spiral + burst);
    return normalize(d + offs);
  }
  #endif

  // ---------------------------------------------------------------- main
  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y) - uShift;
    float cr = cos(uRoll), sr = sin(uRoll);
    uv = vec2(cr * uv.x - sr * uv.y, sr * uv.x + cr * uv.y);
    vec3 dir = normalize(uCamRot * vec3(uv * 2.0 * uTanHalfFov, -1.0));

    vec3 pos = uCamPos;
    vec3 vel = dir;
    vec3 col = vec3(0.0);
    float trans = 1.0;
    float rmin = 1e9;
    bool captured = false;
    float jit = hash12(gl_FragCoord.xy);

    // gas flow: two layers that restart in turn (each hidden while it restarts)
    const float LOOP = 26.0;
    float ph = fract(uFlowTime / LOOP);
    vec3 flow = vec3(ph * LOOP, fract(ph + 0.5) * LOOP, 1.0 - abs(2.0 * ph - 1.0));
    vec2 seeds = vec2(mod(floor(uFlowTime / LOOP), 17.0), mod(floor(uFlowTime / LOOP + 0.5), 17.0) + 0.5);

    float pixA = 2.0 * uTanHalfFov / min(uRes.x, uRes.y);
    float travel = 0.0;
    vec3 hc = cross(pos - uHole1.xyz, vel);
    float h2 = dot(hc, hc);
    vec3 acc = gravity(pos, vel, h2);

  #ifdef GWAVES
    vec3 pSky = vec3(1e4);
    float sPrev = dot(pos, uCenterDir);
  #endif

    for (int i = 0; i < 420; i++) {
      if (i >= uSteps) break;
      float dist = length(pos - uHole1.xyz);
    #ifdef BINARY
      dist = min(dist, length(pos - uHole2.xyz));
    #endif
      rmin = min(rmin, length(pos));
      float ds = clamp(0.07 * dist, 0.012, 2.5);
    #ifdef STREAM
      if (length(pos - uStreamBounds.xyz) < uStreamBounds.w) ds = min(ds, 0.4);
    #endif

      // leapfrog (kick-drift-kick)
      float dt = ds / length(vel);
      vel += acc * (0.5 * dt);
      vec3 prev = pos;
      pos += vel * dt;
      acc = gravity(pos, vel, h2);
      vel += acc * (0.5 * dt);
      vec3 sd = normalize(pos - prev);
      travel += ds;

    #if defined(DISK) && !defined(THICK_DISK)
      // thin disk: integrate through the gas layer wherever the ray crosses the disk plane
      if (prev.y * pos.y <= 0.0 && prev.y != pos.y) {
        vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
        float rr = length(hit.xz);
        if (rr > uDiskIn * 0.7 && rr < uDiskOut) {
          float cosv = max(abs(sd.y), 0.02);
          vec4 e = diskSample(vec3(hit.x, 0.0, hit.z), sd, flow, seeds, travel * pixA / max(cosv, 0.06));
          float a = 1.0 - exp(-uDiskOpacity * e.a / cosv);
          col += trans * e.rgb * a;
          trans *= 1.0 - a;
        }
      }
    #endif

    #ifdef THICK_DISK
      for (int k = 0; k < 2; k++) {
        vec3 mid = mix(prev, pos, (float(k) + jit) * 0.5);
        float rr = length(mid.xz);
        if (rr < uDiskOut && abs(mid.y) < 2.6 * uDiskThick * rr + 0.2) {
          vec4 e = diskSample(mid, sd, flow, seeds, travel * pixA);
          float a = 1.0 - exp(-uDiskOpacity * e.a / (1.77 * uDiskThick * rr) * ds * 0.5);
          col += trans * e.rgb * a;
          trans *= 1.0 - a;
        }
      }
    #endif

    #ifdef JET
      {
        vec3 mid = mix(prev, pos, jit);
        float hj = dot(mid, uJetAxis);
        float ah = abs(hj);
        float ax = length(mid - uJetAxis * hj);
        float width = uJetWidth * (0.22 + 0.055 * ah);
        if (ax < 4.0 * width + 1.0) {
          float core = exp(-ax * ax / (width * width));
          float sheath = exp(-ax * ax / (7.0 * width * width)) * 0.18;
          float prof = smoothstep(1.3, 3.0, ah) * exp(-ah / uJetLength);
          float knots = 0.0;
          for (int k = 0; k < 4; k++) {
            float hk = 2.0 + mod(uTime * uKnotSpeed + float(k) * uJetLength * 0.55, uJetLength * 2.2);
            knots += exp(-pow((ah - hk) / (0.5 + 0.07 * hk), 2.0)) * exp(-hk / (uJetLength * 1.4));
          }
          // the jet coming toward us is beamed brighter than the receding counter-jet
          float toward = dot(uJetAxis * sign(hj), normalize(uCamPos - mid));
          float side = mix(uJetCounter, 1.0, smoothstep(-0.4, 0.4, toward));
          col += trans * uJetColor * (core * (1.0 + 3.0 * knots) + sheath) * prof * side * uJet * min(ds, 0.8);
        }
      }
    #endif

    #ifdef HOTSPOT
      {
        vec3 mid = mix(prev, pos, jit);
        vec3 dh = mid - uSpot.xyz;
        float q = dot(dh, dh) / (uSpot.w * uSpot.w);
        if (q < 12.0) {
          float D = 1.0 / (inversesqrt(1.0 - dot(uSpotVel, uSpotVel)) * (1.0 - dot(uSpotVel, -sd)));
          col += trans * uSpotColor * exp(-q) * ds * D * D * D;
        }
      }
    #endif

    #ifdef COMPANION
      {
        // star surface: exact ray / ellipsoid intersection over this step
        float inv = 1.0 / uCompStretch;
        vec3 A = prev - uComp.xyz;
        vec3 B = pos - uComp.xyz;
        A += uCompAxis * dot(A, uCompAxis) * (inv - 1.0);
        B += uCompAxis * dot(B, uCompAxis) * (inv - 1.0);
        vec3 AB = B - A;
        float qa = dot(AB, AB);
        float qb = dot(A, AB);
        float qc = dot(A, A) - uComp.w * uComp.w;
        float disc = qb * qb - qa * qc;
        if (disc > 0.0) {
          float th = (-qb - sqrt(disc)) / qa;
          if (th >= 0.0 && th <= 1.0) {
            vec3 hs = A + AB * th;
            vec3 nrm = normalize(hs + uCompAxis * dot(hs, uCompAxis) * (inv - 1.0));
            float mu = max(dot(nrm, -sd), 0.0);
            float limb = 1.0 - 0.7 * (1.0 - mu) - 0.2 * (1.0 - mu) * (1.0 - mu);
            float gran = fbm(nrm * 22.0 + vec3(0.0, uTime * 0.05, 0.0), 3.0);
            gran = 0.8 + 0.4 * smoothstep(0.32, 0.68, gran);
            vec3 surf = uCompColor * mix(0.75, 1.35, mu * mu);   // centre hotter and whiter, edges deeper colour
            col += trans * surf * uCompBright * limb * gran;
            trans = 0.0;
            break;
          }
        }
        float rim = max(length(pos - uComp.xyz) - uComp.w * mix(1.0, uCompStretch, 0.5), 0.0);
        col += trans * uCompColor * uCompBright * 0.025 * exp(-rim / (0.3 * uComp.w)) * min(ds, 1.0) / uComp.w;
      }
    #endif

    #ifdef STREAM
      if (length(pos - uStreamBounds.xyz) < uStreamBounds.w) {
        float dmin = 1e9;
        float kAt = 0.0;
        for (int k = 0; k < 7; k++) {
          vec3 a = uStreamPts[k];
          vec3 ab = uStreamPts[k + 1] - a;
          float hh = clamp(dot(pos - a, ab) / dot(ab, ab), 0.0, 1.0);
          float dd = length(pos - a - ab * hh);
          if (dd < dmin) { dmin = dd; kAt = (float(k) + hh) / 7.0; }
        }
        float w = uStreamWidth * mix(1.0, 0.3, kAt);
        if (dmin < 4.0 * w) {
          float n = nz(pos * 1.3 + vec3(0.0, 0.0, -uTime * 0.5)).r;
          float e = exp(-dmin * dmin / (w * w)) * (0.3 + 1.4 * n * n);
          vec3 sc = mix(uStreamColor, uDiskHot, kAt * kAt);
          col += trans * sc * uStreamBright * e * ds * (0.5 + kAt);
        }
      }
    #endif

    #ifdef GWAVES
      float sNow = dot(pos, uCenterDir);
      if (sPrev < 0.0 && sNow >= 0.0) pSky = mix(prev, pos, -sPrev / (sNow - sPrev));
      sPrev = sNow;
    #endif

      if (length(pos - uHole1.xyz) < uHole1.w) { captured = true; break; }
    #ifdef BINARY
      if (length(pos - uHole2.xyz) < uHole2.w) { captured = true; break; }
    #endif
      if (trans < 0.004) break;
      if (length(pos) > uEscape && dot(pos, vel) > 0.0) break;
    }
    // rays still circling the photon sphere when the step budget runs out count as captured
    if (!captured && length(pos) < 3.0) captured = true;

    vec3 dOut = normalize(vel);
  #ifdef GWAVES
    dOut = gwDistort(dOut, pSky);
  #endif
    float pix = 2.0 * uTanHalfFov / min(uRes.x, uRes.y);
    float fw = length(fwidth(dOut));
    vec3 sky = skyColor(dOut, pix, fw);
    if (!captured) col += trans * sky;
  #ifdef GLOW
    if (!captured) col += uGlowColor * uGlow * exp(-max(rmin - 1.5, 0.0) / 4.0);
  #endif

    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;
