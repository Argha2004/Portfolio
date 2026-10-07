"use client";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { RigidBody, HeightfieldCollider, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { weather } from "./weather";
import { cycle } from "./dayCycle";
import { ISLAND_R, PONDS, pondEdge, nearRoad, DISTRICTS, SECTIONS, connectors } from "./zones";
import { trailSamples, TRAIL_WIDTH, nearestTrailIndex, nearTrail } from "./trailData";
import { riverDist, RIVER_IN, RIVER_OUT, RIVER_DEPTH } from "./riverData";

// ───────── Terrain & water, after Bruno Simon's folio-2025 (MIT) ─────────
// Like his, the whole ground is driven by one RGBA data map:
//   R = stone slabs · G = grass · B = water depth (0 = land … 1 = 1.5 m deep)
// The floor mesh sinks by depth and is coloured from his gradient (sand → teal → navy), a
// transparent water plane sits at -0.3 m drawing only foam and ripple lines, and a heightfield
// collider follows the same data so you can drive into the ponds. His own map is the layout of
// his world, so this one is generated from ours: coastline, ponds clear of every road, grass
// patches across the fields and paved plazas.
export const HALF = 250;            // the data map covers ±250 m (the island is 215 m)
export const DEPTH = 1.5;           // deepest water (his depthElevation)
export const WATER_Y = -0.3;        // water surface (his surfaceElevation)
const N = 640;

// Value noise + fbm for natural shapes
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => noise(x, z) * 0.55 + noise(x * 2.1 + 5.2, z * 2.1 - 1.7) * 0.3 + noise(x * 4.3 - 3.1, z * 4.3 + 8.4) * 0.15;
const smooth = (a, b, v) => { const t = Math.min(Math.max((v - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

export const coastRadius = (x, z) => {
  const a = Math.atan2(z, x);
  return ISLAND_R + 10 + 5 * Math.sin(3 * a + 0.5) + 3 * Math.sin(7 * a);
};

const COAST_MIN = ISLAND_R + 10 - 8;  // coastRadius never dips below this
const POND_WOBBLE = 1 + 0.14 + 0.08;   // pondEdge never exceeds r × this

// Paved plazas (slabs): the roundabout square and the district centres
const PLAZAS = [
  { x: 0, z: 0, r: 21 },
  { x: DISTRICTS.village.center[0], z: DISTRICTS.village.center[1], r: 11 },
  { x: DISTRICTS.camp.center[0], z: DISTRICTS.camp.center[1], r: 7 },
  { x: DISTRICTS.graveyard.center[0], z: DISTRICTS.graveyard.center[1] - 16, r: 6 },
  ...Object.values(SECTIONS).map((sec) => ({ x: sec.center[0], z: sec.center[1], r: sec.r - 3 })),
];

function blur(src, radius) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    const from = pass ? tmp : src, to = pass ? out : tmp;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let s = 0, n = 0;
      for (let k = -radius; k <= radius; k++) {
        const ii = pass ? i : Math.min(N - 1, Math.max(0, i + k)), jj = pass ? Math.min(N - 1, Math.max(0, j + k)) : j;
        s += from[jj * N + ii]; n++;
      }
      to[j * N + i] = s / n;
    }
  }
  return out;
}

// Build the map once (≈ 0.3 s); the same arrays answer height / grass queries from JS
export const terrain = (() => {
  const R = new Float32Array(N * N), G = new Float32Array(N * N), Bd = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = ((i + 0.5) / N) * 2 * HALF - HALF, z = ((j + 0.5) / N) * 2 * HALF - HALF, k = j * N + i;
    // (the expensive bits — coastline trig, pond wobble, noise — only run where they can matter;
    // the result is the same as computing everything, about 4× faster)
    const d = Math.hypot(x, z), rc = d > COAST_MIN - 12 ? coastRadius(x, z) : COAST_MIN;
    let depth = d > COAST_MIN - 8 ? smooth(rc - 8, rc + 26, d) : 0;
    for (const p of PONDS) {
      const dp = Math.hypot(x - p.x, z - p.z);
      if (dp >= p.r * POND_WOBBLE * 1.25) continue; // beyond the widest shore: no water
      const q = dp / pondEdge(p, x, z);
      depth = Math.max(depth, (1 - smooth(0.35, 1.25, q)) * (p.depth ?? 0.95));
    }
    // the river: full depth along the middle, shelving up to sandy banks
    const dr = riverDist(x, z);
    if (dr < RIVER_OUT) {
      let river = (1 - smooth(RIVER_IN, RIVER_OUT, dr)) * RIVER_DEPTH;
      // where a river crosses the adventure trail it spreads into a wheel-deep ford
      if (nearTrail(x, z)) river = Math.min(river, 0.3);
      depth = Math.max(depth, river);
    }
    Bd[k] = depth;
    // Grass in noisy patches, kept off roads, beaches and water
    // (6 m clear of the avenue centre lines: their road tiles carry sidewalks out to ±4 m and blades
    //  growing up to 3.5 m spilled over the kerbs)
    G[k] = depth > 0.04 || d > rc - 12 || nearRoad(x, z, 6) ? 0 : smooth(0.3, 0.42, fbm(x * 0.045, z * 0.045));
    let slab = 0;
    for (const p of PLAZAS) slab = Math.max(slab, 1 - smooth(p.r - 3, p.r, Math.hypot(x - p.x, z - p.z)));
    R[k] = slab > 0 ? slab * smooth(0.25, 0.55, fbm(x * 0.12 + 40, z * 0.12)) : 0; // broken up like his
  }
  // Paved adventure trail + access roads from the circuit's barrier gaps (N, E, W)
  const stamp = (x, z, rad) => {
    const ci = ((x + HALF) / (2 * HALF)) * N - 0.5, cj = ((z + HALF) / (2 * HALF)) * N - 0.5;
    const rp = Math.ceil((rad / (2 * HALF)) * N) + 2;
    for (let j = Math.max(0, Math.floor(cj - rp)); j <= Math.min(N - 1, Math.ceil(cj + rp)); j++)
      for (let i = Math.max(0, Math.floor(ci - rp)); i <= Math.min(N - 1, Math.ceil(ci + rp)); i++) {
        const d = Math.hypot(i - ci, j - cj) * (2 * HALF) / N;
        const k = j * N + i;
        R[k] = Math.max(R[k], 1 - smooth(rad - 1.2, rad, d));
        G[k] = Math.min(G[k], smooth(rad, rad + 2.5, d));
      }
  };
  trailSamples.forEach((s) => stamp(s.p.x, s.p.z, TRAIL_WIDTH / 2));
  const AXES = { N: [0, -1], E: [1, 0], W: [-1, 0] };
  for (const c of connectors) {
    const ax = AXES[c.dir];
    if (!ax) continue;
    for (let d = Math.hypot(...c.to) + 9; d < ISLAND_R; d += 1.5) {
      const x = ax[0] * d, z = ax[1] * d;
      stamp(x, z, 3.6);
      if (nearestTrailIndex(x, z).d < TRAIL_WIDTH / 2) break;
    }
  }
  const g = blur(G, 3), r = blur(R, 1);
  const data = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    data[k * 4] = r[k] * 255; data[k * 4 + 1] = g[k] * 255; data[k * 4 + 2] = Bd[k] * 255; data[k * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  const sample = (arr, x, z) => {
    const fx = Math.min(Math.max(((x + HALF) / (2 * HALF)) * N - 0.5, 0), N - 1.001);
    const fz = Math.min(Math.max(((z + HALF) / (2 * HALF)) * N - 0.5, 0), N - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = arr[j * N + i], b = arr[j * N + i + 1], c = arr[(j + 1) * N + i], e = arr[(j + 1) * N + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
  };
  return {
    texture,
    depth: (x, z) => sample(Bd, x, z),
    grass: (x, z) => sample(g, x, z),
    slab: (x, z) => sample(r, x, z),
    height: (x, z) => -DEPTH * sample(Bd, x, z),
  };
})();

// ── Floor: displaced plane coloured like his (dirt/sand → shallow teal → deep navy, grass, slabs) ──
const C = (hex) => new THREE.Color(hex);
export function Floor() {
  const slabs = useTexture("/models/bruno/slabs.png");
  const material = useMemo(() => {
    slabs.wrapS = slabs.wrapT = THREE.RepeatWrapping;
    slabs.colorSpace = THREE.NoColorSpace;
    const m = new THREE.MeshLambertMaterial();
    const uniforms = {
      uTerrain: { value: terrain.texture }, uHalf: { value: HALF }, uDepth: { value: DEPTH }, uSlabs: { value: slabs },
      uDirt: { value: C("#ffa94e") }, uTeal: { value: C("#5bc2b9") }, uDeep: { value: C("#13375f") }, uGrass: { value: C("#b8b62e") },
      uSlabHigh: { value: C("#ffcf8b") }, uSlabLow: { value: C("#a87762") },
    };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D uTerrain; uniform float uHalf; uniform float uDepth; varying vec4 vTerrain; varying vec2 vXZ;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vTerrain = texture2D(uTerrain, transformed.xz / (2.0 * uHalf) + 0.5);
          vXZ = transformed.xz;
          transformed.y -= uDepth * vTerrain.b;`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
          uniform sampler2D uSlabs; uniform vec3 uDirt; uniform vec3 uTeal; uniform vec3 uDeep; uniform vec3 uGrass; uniform vec3 uSlabHigh; uniform vec3 uSlabLow;
          varying vec4 vTerrain; varying vec2 vXZ;`)
        .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `
          float b = vTerrain.b;
          vec3 base = mix(uDirt, uTeal, smoothstep(0.1, 0.3, b));
          base = mix(base, uDeep, smoothstep(0.3, 0.9, b));
          base = mix(base, uGrass, vTerrain.g);
          vec3 slab = mix(uSlabLow, uSlabHigh, texture2D(uSlabs, vXZ * 0.175).r);
          base = mix(base, slab, vTerrain.r);
          vec4 diffuseColor = vec4(base, opacity);`);
    };
    m.defines = { ...m.defines, B_NO_WATERLINE: "" };
    m.customProgramCacheKey = () => "bruno-floor";
    return m;
  }, [slabs]);
  const geometry = useMemo(() => {
    const size = HALF * 2 + 200; // past the map the data clamps to deep ocean
    const g = new THREE.PlaneGeometry(size, size, 400, 400); // (fine enough for the rivers' banks)
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

// ── Water surface, after Bruno Simon's (folio-2025, MIT: World/WaterSurface.js + Terrain gradient) ──
// The bed is already coloured by depth (sand → turquoise → navy, his gradient) on the floor below;
// this plane at -0.3 m adds what makes it read as water:
//  · a body tint that thickens with depth (clear in the shallows, deep navy offshore) with a slow
//    shimmer of light across it (his surface blurs the bed; a tint + drifting light reads the same
//    without rendering the scene twice)
//  · his ripples: depth contours drifting in towards the shore, broken up by noise, bold near the
//    shore and thinning out offshore
//  · a white foam band that breathes along the water's edge
//  · caustic light dancing over the shallow bed, and small sun glints
//  · his rain splashes (rings popping up in random cells)
// Everything is lit by the day / night cycle, so the water dims and turns blue at night.
export function WaterSurface() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: {
      uTerrain: { value: terrain.texture }, uHalf: { value: HALF }, uTime: { value: 0 }, uRain: { value: 0 },
      uLight: { value: new THREE.Color(1, 1, 1) },
      uShallow: { value: new THREE.Color("#7fe0d2") }, uDeep: { value: new THREE.Color("#0f2f57") },
      ...THREE.UniformsLib.fog,
    },
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vXZ; varying vec3 vView;
      void main(){
        vXZ = (modelMatrix * vec4(position, 1.0)).xz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vView = mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform sampler2D uTerrain; uniform float uHalf; uniform float uTime; uniform float uRain;
      uniform vec3 uLight; uniform vec3 uShallow; uniform vec3 uDeep;
      uniform mat4 projectionMatrix; // (three only declares it in vertex shaders; it sets it for both)
      varying vec2 vXZ; varying vec3 vView;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float b = texture2D(uTerrain, vXZ / (2.0 * uHalf) + 0.5).b;
        if (b < 0.2) discard;                         // the ground is above the surface here
        float d = clamp((b - 0.2) / 0.75, 0.0, 1.0);  // 0 at the water's edge → 1 in the deepest water
        float t = uTime;

        // Body: tint thickening with depth, with a slow drifting shimmer of light
        vec3 tint = mix(uShallow, uDeep, smoothstep(0.0, 0.75, d));
        float shimmer = noise(vXZ * 0.16 + vec2(t * 0.05, t * 0.03)) * noise(vXZ * 0.29 - vec2(t * 0.04, -t * 0.05));
        tint *= 0.88 + 0.4 * shimmer;
        float body = mix(0.16, 0.6, smoothstep(0.0, 0.8, d));

        // Caustics over the shallow bed
        vec2 q = vXZ * 0.6;
        float c1 = noise(q + vec2(t * 0.32, t * 0.21)), c2 = noise(q * 1.35 - vec2(t * 0.24, -t * 0.29));
        float caustic = pow(1.0 - abs(c1 - c2), 12.0) * (1.0 - smoothstep(0.05, 0.5, d));

        // Ripples (his ripplesNode): contours drifting towards the shore, broken by noise
        float wave = b * 10.0 + t * 0.5;
        float n = noise(vXZ * 0.1 + floor(wave) * 2.9);
        float thick = mix(0.2, 0.05, smoothstep(0.0, 0.55, d));
        float ripple = step(fract(wave), thick) * step(0.45, n) * (1.0 - smoothstep(0.3, 0.7, d));

        // Foam: a crisp white band along the water's edge that breathes in and out
        float edge = 0.16 + 0.05 * sin(t * 1.4 + noise(vXZ * 0.35) * 6.28);
        float foam = 1.0 - smoothstep(edge - 0.025, edge, d);

        // Sun glints
        float glint = step(0.94, noise(vXZ * 2.4 + vec2(t * 0.7, -t * 0.45))) * step(0.55, noise(vXZ * 0.5 - t * 0.15)) * smoothstep(0.1, 0.5, d);

        // Rain splashes (his splashesNode): small rings popping up in random cells
        vec2 cell = floor(vXZ / 1.3), local = fract(vXZ / 1.3) - 0.5;
        float rnd = hash(cell), life = fract(t * 0.9 + rnd * 7.0);
        vec2 c = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.5;
        float ring = 1.0 - smoothstep(0.0, 0.035, abs(length(local - c) - life * 0.38));
        float splash = ring * (1.0 - life) * step(1.0 - uRain, hash(cell + 11.0));

        float white = max(max(ripple * 0.85, foam * 0.92), max(splash * 0.8, glint * 0.75));
        vec3 col = mix(tint + caustic * 0.45, vec3(1.0), white) * uLight;
        gl_FragColor = vec4(col, max(body + caustic * 0.3, white));
        // Depth: drawn 0.35 m towards the camera, so the floor's coarse triangles can't poke
        // through near the shore; the shoreline then follows the smooth terrain map (the discard)
        vec4 clip = projectionMatrix * vec4(vView * (1.0 - 0.35 / max(length(vView), 1.0)), 1.0);
        gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
        #include <fog_fragment>
      }`,
  }), []);
  useFrame((_, dt) => {
    const u = material.uniforms;
    u.uTime.value += dt;
    u.uRain.value = weather.rain * (weather.snow > 0.2 ? 0 : 1);
    // lit like everything else: the cycle's light colour × intensity, relative to full day
    const k = cycle.lightIntensity / 1.2;
    u.uLight.value.setRGB(Math.min(cycle.light.r * k, 1.3), Math.min(cycle.light.g * k, 1.3), Math.min(cycle.light.b * k, 1.3));
  });
  return (
    <mesh position-y={WATER_Y} rotation-x={-Math.PI / 2} material={material} renderOrder={1}>
      <planeGeometry args={[HALF * 2 + 200, HALF * 2 + 200]} />
    </mesh>
  );
}

// ── Physics: a heightfield that matches the floor (land at 0, ponds and sea dip to -1.5 m) ──
const ROWS = 160;
export function TerrainCollider() {
  const heights = useMemo(() => {
    const h = new Float32Array((ROWS + 1) * (ROWS + 1));
    for (let ix = 0; ix <= ROWS; ix++) for (let iz = 0; iz <= ROWS; iz++) {
      const x = (ix / ROWS) * 2 * HALF - HALF, z = (iz / ROWS) * 2 * HALF - HALF;
      h[iz + ix * (ROWS + 1)] = terrain.height(x, z); // same layout as his Floor.setPhysical
    }
    return h;
  }, []);
  const args = useMemo(() => [ROWS, ROWS, heights, { x: HALF * 2, y: 1, z: HALF * 2 }], [heights]);
  // Invisible wall just inside the coast keeps the car on the island
  const walls = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2, r = ISLAND_R + 2;
    return { p: [Math.cos(a) * r, 3, Math.sin(a) * r], rot: -a };
  });
  return (
    <RigidBody type="fixed" name="ground" colliders={false} friction={0.8}>
      {/* (args must be stable: a new scale object each render made the library rebuild the
          heightfield, and Rapier then woke every sleeping body on the island for seconds) */}
      <HeightfieldCollider args={args} />
      {walls.map((w, i) => <CuboidCollider key={i} args={[0.5, 3, 8]} position={w.p} rotation={[0, w.rot, 0]} />)}
    </RigidBody>
  );
}
