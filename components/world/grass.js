"use client";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { terrain, HALF } from "./terrain";
import { LOOK } from "./brunoShading";
import { cycle } from "./dayCycle";
import { weather } from "./weather";

// ───────── Grass, after Bruno Simon's folio-2025 (MIT: World/Grass.js) ─────────
// A field of single-triangle blades on a grid that follows the camera (blades wrap around as you
// drive, so there is always a full field in view without drawing the whole island). Each blade
// reads the terrain map: it only grows where the map says grass, takes the ground's colour, is
// turned to face the camera, sways in the wind at the tip, and is shaded dark at the base.
const SUBDIVISIONS = 300;
const SIZE = 80; // metres of field around the focus point

function bladeGeometry(count) {
  // 3 vertices per blade; all start at the blade root, the shader builds the triangle
  const position = new Float32Array(count * 9), random = new Float32Array(count * 3);
  const cell = SIZE / SUBDIVISIONS;
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let ix = 0; ix < SUBDIVISIONS; ix++) for (let iz = 0; iz < SUBDIVISIONS; iz++) {
    const i = ix * SUBDIVISIONS + iz;
    const x = (ix / SUBDIVISIONS - 0.5) * SIZE + cell * 0.5 + (r() - 0.5) * cell;
    const z = (iz / SUBDIVISIONS - 0.5) * SIZE + cell * 0.5 + (r() - 0.5) * cell;
    const h = r();
    for (let v = 0; v < 3; v++) { position.set([x, 0, z], i * 9 + v * 3); random[i * 3 + v] = h; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("heightRandom", new THREE.BufferAttribute(random, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}

export function BladeGrass({ focusRef }) {
  const geometry = useMemo(() => bladeGeometry(SUBDIVISIONS * SUBDIVISIONS), []);
  const uniforms = useMemo(() => ({
    uTerrain: { value: terrain.texture }, uHalf: { value: HALF }, uSize: { value: SIZE },
    uCenter: { value: new THREE.Vector2() }, uTime: { value: 0 }, uWind: { value: 1 },
    uBladeWidth: { value: 0.11 }, uBladeHeight: { value: 0.75 },
    uDirt: { value: new THREE.Color("#ffa94e") }, uGrass: { value: new THREE.Color("#b8b62e") },
    // base of each blade goes to the shadow tint (his tipness shadow)
    uBaseShade: { value: new THREE.Vector3(LOOK.shadow.r / LOOK.light.r, LOOK.shadow.g / LOOK.light.g, LOOK.shadow.b / LOOK.light.b) },
  }), []);
  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>
          uniform sampler2D uTerrain; uniform float uHalf; uniform float uSize; uniform vec2 uCenter; uniform float uTime; uniform float uWind;
          uniform float uBladeWidth; uniform float uBladeHeight; uniform vec3 uDirt; uniform vec3 uGrass;
          attribute float heightRandom;
          varying vec3 vGrassColor; varying float vTip;
          float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float gNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y); }`)
        .replace("#include <beginnormal_vertex>", "vec3 objectNormal = vec3(0.0, 1.0, 0.0);")
        .replace("#include <begin_vertex>", `
          // Wrap the blade root into the field around the focus point
          vec2 rel = position.xz - uCenter;
          rel = mod(rel + uSize * 0.5, uSize) - uSize * 0.5;
          vec2 root = uCenter + rel;

          vec4 terrainData = texture2D(uTerrain, root / (2.0 * uHalf) + 0.5);
          float grass = terrainData.g * (1.0 - terrainData.r);
          int corner = gl_VertexID % 3;            // 0 = tip, 1 = left, 2 = right
          vTip = corner == 0 ? 1.0 : 0.0;

          float variation = gNoise(root * 0.0321 * 8.0) + 0.5;
          float height = uBladeHeight * (0.4 + 0.6 * heightRandom) * variation * grass;
          float width = uBladeWidth * grass;
          vec2 shape = corner == 0 ? vec2(0.0, height) : vec2(corner == 1 ? width : -width, 0.0);

          // Face the camera
          float a = atan(root.y - cameraPosition.z, root.x - cameraPosition.x) - 1.5707963;
          vec2 side = vec2(cos(a), sin(a)) * shape.x;
          vec3 transformed = vec3(root.x + side.x, shape.y, root.y + side.y);

          // Wind at the tip
          float t = uTime * 1.6;
          vec2 wind = vec2(sin(root.x * 0.35 + t) + sin(root.y * 0.21 + t * 0.7), cos(root.y * 0.3 + t * 0.9)) * 0.12 * uWind;
          transformed.xz += wind * vTip * height * 2.0;

          // Ground colour (his terrain colorNode): dirt → grass
          vGrassColor = mix(uDirt, uGrass, terrainData.g);
          if (grass < 0.12) transformed.y -= 100.0; // hidden blades
        `);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGrassColor; varying float vTip; uniform vec3 uBaseShade;")
        .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `
          vec4 diffuseColor = vec4( vGrassColor * mix(uBaseShade, vec3(1.0), smoothstep(0.0, 0.9, vTip)), opacity );`);
    };
    m.customProgramCacheKey = () => "bruno-grass";
    return m;
  }, [uniforms]);

  useFrame((state, dt) => {
    uniforms.uTime.value += dt * (0.7 + weather.wind * 0.9);
    uniforms.uWind.value = 0.5 + weather.wind * 1.5; // the weather's wind bends the blades
    // blade bases take the current shadow tint (relative to the light, as the shading patch multiplies it back)
    const L = cycle.light, S = cycle.shadow, I = cycle.lightIntensity;
    uniforms.uBaseShade.value.set(S.r / Math.max(L.r * I, 1e-3), S.g / Math.max(L.g * I, 1e-3), S.b / Math.max(L.b * I, 1e-3));
    const f = focusRef?.current;
    if (f) { const p = f.translation ? f.translation() : f; uniforms.uCenter.value.set(p.x, p.z); }
    else uniforms.uCenter.value.set(state.camera.position.x - 9, state.camera.position.z - 15);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} receiveShadow />;
}
