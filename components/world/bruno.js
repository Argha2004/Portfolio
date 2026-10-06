"use client";
import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import * as THREE from "three";
import { InstancedParts, BoxColliders, rng } from "./kit";
import { CAM_OFFSET } from "./zones";
import { cycle } from "./dayCycle";
import { sfx } from "./sound";

// ───────── Assets from Bruno Simon's folio-2025 (MIT, see /public/models/bruno/LICENSE-bruno-simon.md) ─────────
// Every model shares one small "palette" texture; the car's paint and the glowing parts use
// procedural gradients, rebuilt here from his material definitions. Some files are Draco-compressed.
useGLTF.setDecoderPath("/draco/");
export const B = (name) => `/models/bruno/${name}.glb`;

// ── Materials ──
const lin = (hex) => new THREE.Color(hex); // THREE.Color parses hex as sRGB → stores linear

// Vertical gradient along UV v (his createGradient: mix(A, B, uv.y))
function gradientTexture(a, b) {
  const A = lin(a), Bc = lin(b), n = 32, data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const c = A.clone().lerp(Bc, i / (n - 1));
    data.set([c.r, c.g, c.b, 1], i * 4);
  }
  const t = new THREE.DataTexture(data, 1, n, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// Radial gradient from the UV centre, brightness-normalised (his createEmissiveGradient)
function radialTexture(a, b, normalize = true) {
  const A = lin(a), Bc = lin(b), n = 32, data = new Float32Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.min(Math.hypot(x / (n - 1) - 0.5, y / (n - 1) - 0.5) * 2, 1);
    const c = A.clone().lerp(Bc, d);
    if (normalize) { const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; c.multiplyScalar(1 / Math.max(l, 1e-3)); }
    data.set([c.r, c.g, c.b, 1], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

const glow = (a, b, intensity) => {
  const m = new THREE.MeshBasicMaterial({ map: radialTexture(a, b), toneMapped: false });
  m.color.setScalar(intensity); // > 1 so bloom picks it up
  return m;
};

const MATS = {};
function material(src) {
  const name = src.name;
  if (MATS[name]) return MATS[name];
  let m;
  if (name === "redGradient") m = new THREE.MeshStandardMaterial({ map: gradientTexture("#ff3a3a", "#721551"), roughness: 0.35, metalness: 0.1 });
  else if (name === "emissiveOrangeRadialGradient") m = glow("#ff8641", "#ff3e00", 1.7);
  else if (name === "emissivePurpleRadialGradient") m = glow("#454bbc", "#ff2eb4", 1.7);
  else if (name === "emissiveWhiteRadialGradient") m = glow("#ffffff", "#666666", 2.7);
  else {
    m = src.clone();
    if (m.isMeshStandardMaterial) { m.roughness = 0.85; m.metalness = 0; }
  }
  return (MATS[name] = m);
}

// Swap materials and enable shadows on a (cloned) subtree
export const isHelper = (o) => /^(cuboid|hull|tube|ball|trimesh)/i.test(o.name); // his physics-only shapes

export function brunoify(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (isHelper(o)) { o.visible = false; return; }
    o.material = material(o.material);
    o.castShadow = !o.material.isMeshBasicMaterial;
    o.receiveShadow = true;
  });
  return root;
}

// One object out of a file (many of his files hold a dozen placed copies of the same thing):
// the first node matching `test`, cloned, moved to the origin, materials swapped.
export function usePiece(url, test) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const src = scene.children.find(test) || scene.children[0];
    const obj = brunoify(src.clone(true));
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    obj.updateMatrixWorld(true);
    const parts = [];
    obj.traverse((o) => { if (o.isMesh && o.visible) parts.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() }); });
    const box = new THREE.Box3();
    parts.forEach((p) => { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox.clone().applyMatrix4(p.matrix)); });
    return { obj, parts, box };
  }, [scene, test]);
}

// ── Static instanced pieces with colliders ──
export function Piece({ url, test, items, collider = "box", shrink, castShadow = true }) {
  const { parts, box } = usePiece(url, test);
  return (
    <>
      <InstancedParts parts={parts} items={items} castShadow={castShadow} />
      {collider && <BoxColliders box={box} items={items} shape={collider} shrink={shrink} />}
    </>
  );
}

// ── Knock-over pieces (bricks, fences, benches…) ──
// sound: "stone" | "wood" | "metal" — played when it gets knocked hard enough
export function DynamicPiece({ url, test, position, rotation = 0, scale = 1, density = 0.4, sound }) {
  const { obj, box } = usePiece(url, test);
  const clone = useMemo(() => obj.clone(true), [obj]);
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(scale / 2);
  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  return (
    <RigidBody position={position} rotation={[0, rotation, 0]} colliders={false} linearDamping={0.3} angularDamping={0.4}
      onContactForce={sound ? (e) => { const f = e.totalForceMagnitude; if (f > 400) sfx.hit(sound, f / 4000); } : undefined}>
      <CuboidCollider args={[size.x, size.y, size.z]} position={center.toArray()} density={density} friction={0.8}
        contactForceEventThreshold={sound ? 400 : undefined} />
      <primitive object={clone} scale={scale} />
    </RigidBody>
  );
}

// ── Pole lights and lanterns (glowing glass + a few real lights) ──
const isPole = (o) => o.name.startsWith("poleLight");
const isLantern = (o) => o.name.startsWith("lantern");
// His pole lights only glow at night (PoleLights.setSwitchInterval): the glass gets its own
// material whose glow follows the cycle, and fireflies drift around each lamp after dusk.
const poleGlass = new THREE.MeshBasicMaterial({ map: radialTexture("#ff8641", "#ff3e00"), toneMapped: false });
function NightGlass() {
  useFrame(() => {
    const n = cycle.nightAmount;
    poleGlass.color.setScalar(0.18 + n * 2.8); // dim glass by day, blazing at night
  });
  return null;
}

const FIREFLY_COUNT = 9;
function Fireflies({ centers }) {
  const ref = useRef();
  const { geometry, seeds } = useMemo(() => {
    const n = centers.length * FIREFLY_COUNT, pos = new Float32Array(n * 3), seeds = new Float32Array(n);
    centers.forEach((c, i) => {
      for (let k = 0; k < FIREFLY_COUNT; k++) {
        const j = i * FIREFLY_COUNT + k;
        pos.set([c[0] + (Math.random() - 0.5) * 3, c[1] + (Math.random() - 0.5) * 2, c[2] + (Math.random() - 0.5) * 3], j * 3);
        seeds[j] = Math.random() * 999;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    return { geometry: g, seeds };
  }, [centers]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uAmount;
      void main(){
        float t = uTime + seed;
        vec3 p = position + vec3(sin(t * 0.4) * 0.5, sin(t) * 0.2, sin(t * 0.3) * 0.5);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 70.0 * uAmount / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uAmount;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(2.4, 1.1, 0.3) * (1.0 - d * 2.0), uAmount); }`,
  }), []);
  useFrame((_, dt) => { material.uniforms.uTime.value += dt; material.uniforms.uAmount.value = cycle.nightAmount; });
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}

// ── Night light pools: a warm glow spread on the ground under every lamp, fading in at night.
// (Dozens of real lights would be far too expensive, so the spread of light is painted on.) ──
let poolTex = null;
function poolTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.3, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.65, "rgba(255,255,255,0.16)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
export function LightPools({ points, radius = 7, color = "#ff9a4a", strength = 1 }) {
  const mesh = useRef();
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    map: (poolTex ||= poolTexture()), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4,
  }), [color]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    points.forEach(([x, , z], i) => mesh.current.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0.14, z), q, new THREE.Vector3(radius * 2, radius * 2, 1))));
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [points, radius]);
  useFrame(() => {
    const n = cycle.nightAmount;
    material.opacity = n * 0.9 * strength;
    if (mesh.current) mesh.current.visible = n > 0.02;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(points.length, 1)]} material={material} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  );
}

export function PoleLights({ items, lights = 0, scale = 1.25 }) {
  // the model is centred on its own height; lift it so its base sits on the ground
  const { parts, box } = usePiece(B("poleLights"), isPole);
  const lift = -box.min.y * scale;
  const placed = items.map((it) => ({ ...it, p: [it.p[0], it.p[1] + lift, it.p[2]], s: scale }));
  // the glowing glass uses the night-switching material
  const nightParts = useMemo(() => parts.map((p) => (p.material.isMeshBasicMaterial ? { ...p, material: poleGlass } : p)), [parts]);
  const tops = useMemo(() => items.map((it) => [it.p[0], (box.max.y - 0.2) * scale + lift, it.p[2]]), [items, box, scale, lift]);
  return (
    <>
      <InstancedParts parts={nightParts} items={placed} />
      <BoxColliders box={box} items={placed} shape="trunk" />
      <NightGlass />
      <Fireflies centers={tops} />
      <LightPools points={tops} radius={7.5} />
      {items.slice(0, lights).map((it, i) => (
        <NightLamp key={i} position={[it.p[0], (box.max.y - 0.3) * scale + lift, it.p[2]]} />
      ))}
    </>
  );
}

// A real light for a lamp, faint by day and strong and wide at night
function NightLamp({ position }) {
  const ref = useRef();
  useFrame(() => {
    const n = cycle.nightAmount;
    if (ref.current) { ref.current.intensity = 2 + n * 34; ref.current.distance = 11 + n * 9; }
  });
  return <pointLight ref={ref} position={position} color="#ff9a5c" intensity={2} distance={11} decay={1.5} />;
}

export function Lanterns({ items }) {
  const { box } = usePiece(B("lanterns"), isLantern);
  const lift = -box.min.y;
  const spots = useMemo(() => items.map((it) => [it.p[0], 0, it.p[2]]), [items]);
  return (
    <>
      <Piece url={B("lanterns")} test={isLantern} items={items.map((it) => ({ ...it, p: [it.p[0], (it.p[1] || 0) + lift, it.p[2]] }))} />
      <LightPools points={spots} radius={4.2} color="#ffb060" strength={0.85} />
    </>
  );
}

export const isBench = (o) => o.name.startsWith("benchPhysical");
export function Benches({ items }) {
  const { box } = usePiece(B("benches"), isBench);
  return items.map((it, i) => (
    <DynamicPiece key={i} url={B("benches")} test={isBench} position={[it.p[0], -box.min.y + 0.02, it.p[2]]} rotation={it.r} density={0.5} sound="wood" />
  ));
}

// A little wall of bricks to drive through (his bricks are ~1.1 × 0.76 × 1.5 m)
const isBrick = () => true;
export function BrickWall({ position, rotation = 0, width = 4, rows = 3, scale = 1 }) {
  const bricks = [];
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  for (let row = 0; row < rows; row++) for (let i = 0; i < width - (row % 2); i++) {
    const along = (i - (width - 1) / 2 + (row % 2) * 0.5) * 1.55 * scale;
    bricks.push([position[0] + along * cos, (0.4 + row * 0.77) * scale, position[2] - along * sin]);
  }
  return bricks.map((p, i) => <DynamicPiece key={i} url={B("bricks")} test={isBrick} position={p} rotation={rotation + Math.PI / 2} scale={scale} density={0.35} sound="stone" />);
}

export const isFence = (o) => o.name.startsWith("fencePhysical");
export function Fences({ from, to }) {
  const { box } = usePiece(B("fences"), isFence);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.round(len / 2.2));
  const yaw = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return <DynamicPiece key={i} url={B("fences")} test={isFence} position={[from[0] + (to[0] - from[0]) * t, -box.min.y + 0.02, from[1] + (to[1] - from[1]) * t]} rotation={yaw} density={0.25} sound="wood" />;
  });
}

// ───────── Trees with Bruno's foliage ─────────
// Each canopy blob becomes 80 small alpha-cut leaf cards scattered in a sphere, with normals
// bent outwards so the clump shades like one soft ball. Like his, every clump is turned once to
// face the (fixed-angle) chase camera, so no per-frame billboarding is needed.
export const TREE_KINDS = {
  oak: { file: "oakTreesVisual", a: "#b4b536", b: "#d8cf3b" },
  birch: { file: "birchTreesVisual", a: "#ff4f2b", b: "#ff903f" },
  cherry: { file: "cherryTreesVisual", a: "#ff6d6d", b: "#ff9990" },
};

const leafGeometry = (() => {
  const r = rng(4242), planes = [];
  for (let i = 0; i < 80; i++) {
    const plane = new THREE.PlaneGeometry(1, 1); // (his are 0.8; a little larger reads denser at our camera distance)
    const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1 - Math.pow(r(), 3), Math.PI * 2 * r(), Math.PI * r()));
    plane.rotateZ(r() * 9999);
    plane.translate(pos.x, pos.y, pos.z);
    const n = pos.clone().normalize(), arr = plane.attributes.position.array, normals = new Float32Array(12);
    for (let v = 0; v < 4; v++) {
      const m = new THREE.Vector3(arr[v * 3], arr[v * 3 + 1], arr[v * 3 + 2]).lerp(n, 0.85).normalize();
      normals.set([m.x, m.y, m.z], v * 3);
    }
    plane.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    planes.push(plane);
  }
  // merge by hand (avoids importing BufferGeometryUtils)
  const g = new THREE.BufferGeometry(), count = planes.length;
  const P = new Float32Array(count * 12), N = new Float32Array(count * 12), U = new Float32Array(count * 8), I = [];
  planes.forEach((pl, k) => {
    P.set(pl.attributes.position.array, k * 12); N.set(pl.attributes.normal.array, k * 12); U.set(pl.attributes.uv.array, k * 8);
    pl.index.array.forEach((idx) => I.push(idx + k * 4));
  });
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(U, 2));
  g.setIndex(I);
  return g;
})();

let leafAlpha;
function leafMaterial(a, b) {
  if (!leafAlpha) { leafAlpha = new THREE.TextureLoader().load("/models/bruno/foliageSDF.png"); }
  const m = new THREE.MeshLambertMaterial({ alphaMap: leafAlpha, alphaTest: 0.3, side: THREE.DoubleSide });
  const uA = { value: lin(a) }, uB = { value: lin(b) }, uL = { value: cycle.sunDir }; // moves with the day / night cycle
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uLeafA: uA, uLeafB: uB, uSunDir: uL });
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uLeafA; uniform vec3 uLeafB; uniform vec3 uSunDir;")
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec3 leafN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        diffuseColor.rgb = mix(uLeafA, uLeafB, smoothstep(0.0, 1.0, dot(leafN, uSunDir)));`);
  };
  m.customProgramCacheKey = () => `leaf${a}${b}`;
  return m;
}

// clumps: [{ p: [x, y, z], s }] in world space
export function Foliage({ clumps, a, b }) {
  const ref = useRef();
  const mat = useMemo(() => leafMaterial(a, b), [a, b]);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D(), toCam = new THREE.Vector3(...CAM_OFFSET).normalize(), r = rng(99);
    clumps.forEach((c, i) => {
      const ang = Math.PI * 2 * r();
      o.position.set(...c.p);
      o.up.set(Math.sin(ang), Math.cos(ang), 0);
      o.lookAt(o.position.clone().add(toCam));
      o.scale.setScalar(c.s);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [clumps]);
  if (!clumps.length) return null;
  return <instancedMesh ref={ref} args={[leafGeometry, mat, clumps.length]} castShadow receiveShadow />;
}

// items: [{ p, r, s }]
export function Trees({ kind, items, colliders = true }) {
  const k = TREE_KINDS[kind];
  const { scene } = useGLTF(B(k.file));
  const { trunk, leaves } = useMemo(() => {
    scene.updateMatrixWorld(true);
    let trunk = null; const leaves = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name.startsWith("treeBody")) trunk = { geometry: o.geometry, material: material(o.material), matrix: o.matrixWorld.clone() };
      else if (o.name.startsWith("treeLeaves")) leaves.push({ pos: new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), s: new THREE.Vector3().setFromMatrixScale(o.matrixWorld).x });
    });
    return { trunk, leaves };
  }, [scene]);
  const clumps = useMemo(() => {
    const out = [], v = new THREE.Vector3();
    items.forEach((it) => {
      const s = Array.isArray(it.s) ? it.s[0] : it.s ?? 1;
      leaves.forEach((l) => {
        v.copy(l.pos).multiplyScalar(s).applyAxisAngle(new THREE.Vector3(0, 1, 0), it.r || 0);
        out.push({ p: [it.p[0] + v.x, it.p[1] + v.y, it.p[2] + v.z], s: l.s * s });
      });
    });
    return out;
  }, [items, leaves]);
  return (
    <>
      <InstancedParts parts={[trunk]} items={items} />
      <Foliage clumps={clumps} a={k.a} b={k.b} />
      {colliders && (
        <RigidBody type="fixed" colliders={false}>
          {items.map((it, i) => {
            const s = Array.isArray(it.s) ? it.s[0] : it.s ?? 1;
            return <CylinderCollider key={i} args={[2.5 * s, 0.22 * s]} position={[it.p[0], it.p[1] + 2.5 * s, it.p[2]]} />;
          })}
        </RigidBody>
      )}
    </>
  );
}

// Bushes are just foliage clumps sitting on the ground
export function Bushes({ items, a = "#b4b536", b = "#d8cf3b" }) {
  const clumps = useMemo(() => items.map((it) => ({ p: [it.p[0], 0.55 * (it.s ?? 1), it.p[2]], s: it.s ?? 1 })), [items]);
  return <Foliage clumps={clumps} a={a} b={b} />;
}
