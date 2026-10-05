"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { projects } from "@/lib/projects";
import { makePoster } from "./posters";

// Screens sit on a circle around the camera and face it. Scrolling/dragging moves them along
// the circle; they bend into a wave proportional to scroll speed. The list is duplicated so
// the loop is seamless.
const SCREEN_W = 4.2, SCREEN_H = 2.62, GAP = 0.5, RADIUS = 7.2;
const SLOTS = projects.length * 2;
const SPACING = SCREEN_W + GAP;
const LOOP = SLOTS * SPACING;

const screenVert = /* glsl */ `
  uniform float uWave;
  uniform float uTime;
  uniform float uHover;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Gentle concave curve + a travelling wave driven by scroll velocity
    p.z += p.x * p.x * 0.045;
    p.z += sin(p.x * 1.3 + uTime * 2.2) * uWave;
    p.z += uHover * 0.18;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const screenFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uDim;
  uniform float uHover;
  uniform vec2 uSize;
  varying vec2 vUv;
  float roundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float d = roundBox(p, uSize * 0.5, 0.09);
    if (d > 0.0) discard;
    vec3 col = texture2D(uMap, vUv).rgb;
    col *= mix(1.0, 1.12, uHover);
    col *= 1.0 - uDim;
    // Thin bright rim, like a glass bezel
    col += smoothstep(-0.018, 0.0, d) * 0.35;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const floorVert = /* glsl */ `
  varying vec3 vWorld;
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const floorFrag = /* glsl */ `
  varying vec3 vWorld;
  uniform float uOffset;
  void main() {
    vec2 g = vec2(vWorld.x + uOffset, vWorld.z) / 1.1;
    vec2 w = fwidth(g);
    vec2 l = abs(fract(g - 0.5) - 0.5) / w;
    float line = 1.0 - min(min(l.x, l.y), 1.0);
    float fade = smoothstep(26.0, 4.0, length(vWorld.xz));
    gl_FragColor = vec4(vec3(1.0), line * fade * 0.38);
  }`;

function Screen({ project, index, texture, slot, state, onOpen }) {
  const mesh = useRef();
  const hover = useRef(0);
  const hovered = useRef(false);
  // Material built imperatively so the uniforms object we update is the one the GPU reads
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: screenVert,
    fragmentShader: screenFrag,
    uniforms: {
      uMap: { value: texture }, uWave: { value: 0 }, uTime: { value: 0 }, uHover: { value: 0 }, uDim: { value: 0 },
      uSize: { value: new THREE.Vector2(SCREEN_W, SCREEN_H) },
    },
  }), [texture]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(SCREEN_W, SCREEN_H, 48, 16), []);
  useEffect(() => () => { material.dispose(); geometry.dispose(); }, [material, geometry]);

  useFrame((_, dt) => {
    const s = state.current;
    let u = (slot * SPACING - s.offset) % LOOP;
    if (u > LOOP / 2) u -= LOOP;
    if (u < -LOOP / 2) u += LOOP;
    const a = u / RADIUS;
    const m = mesh.current;
    m.visible = Math.abs(a) < 1.15; // beyond this they turn edge-on and read as stray lines
    m.position.set(Math.sin(a) * RADIUS, 0.15, -Math.cos(a) * RADIUS);
    m.rotation.y = -a;
    hover.current = THREE.MathUtils.damp(hover.current, hovered.current && !s.profile ? 1 : 0, 8, dt);
    const un = material.uniforms;
    un.uTime.value += dt;
    un.uWave.value = s.wave;
    un.uHover.value = hover.current;
    un.uDim.value = THREE.MathUtils.damp(un.uDim.value, s.profile ? 0.94 : s.full ? 0.75 : Math.min(Math.abs(a) * 0.35, 0.5), 5, dt);
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      onPointerOver={(e) => { e.stopPropagation(); hovered.current = true; state.current.hoverName = project.name; }}
      onPointerOut={() => { hovered.current = false; state.current.hoverName = null; }}
      onClick={(e) => { e.stopPropagation(); if (!state.current.dragged && !state.current.profile) onOpen(project, index); }}
    />
  );
}

function Floor({ state }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: floorVert, fragmentShader: floorFrag, transparent: true, depthWrite: false,
    uniforms: { uOffset: { value: 0 } },
  }), []);
  // The floor slides with the screens so the room feels like it's moving
  useFrame(() => { material.uniforms.uOffset.value = state.current.offset * 0.35; });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-2.1} material={material}>
      <planeGeometry args={[80, 80]} />
    </mesh>
  );
}

// Thick glass ring that appears for the profile view and refracts the scene behind it
function Ring({ state }) {
  const mesh = useRef();
  useFrame((st, dt) => {
    const m = mesh.current;
    const target = state.current.profile ? 0.78 : 0;
    const s = THREE.MathUtils.damp(m.scale.x, target, 5, dt);
    m.scale.setScalar(s);
    m.visible = s > 0.01;
    m.rotation.z += dt * 0.1;
    m.rotation.x = THREE.MathUtils.damp(m.rotation.x, st.pointer.y * 0.25, 3, dt);
    m.rotation.y = THREE.MathUtils.damp(m.rotation.y, st.pointer.x * 0.25, 3, dt);
  });
  return (
    <mesh ref={mesh} position={[0, 0.15, -4.2]} scale={0}>
      <torusGeometry args={[1.45, 0.38, 64, 160]} />
      <MeshTransmissionMaterial samples={6} resolution={512} thickness={1.1} roughness={0.04} ior={1.45} chromaticAberration={0.5} anisotropicBlur={0.1} distortion={0.2} distortionScale={0.3} backside />
    </mesh>
  );
}

function Rig({ state }) {
  const { camera } = useThree();
  useEffect(() => { camera.lookAt(0, -0.35, -RADIUS); }, [camera]);
  useFrame((st, dt) => {
    const s = state.current;
    const prev = s.offset;
    s.offset = THREE.MathUtils.damp(s.offset, s.target, 4.5, dt);
    const vel = (s.offset - prev) / Math.max(dt, 1e-3);
    s.wave = THREE.MathUtils.damp(s.wave, THREE.MathUtils.clamp(vel * 0.025, -0.35, 0.35), 6, dt);
    // Subtle parallax from the pointer
    camera.position.x = THREE.MathUtils.damp(camera.position.x, st.pointer.x * 0.25, 2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.2 + st.pointer.y * 0.15, 2, dt);
    camera.lookAt(0, -0.35, -RADIUS);
    // Report the centred project to the DOM
    const centre = ((Math.round(s.offset / SPACING) % projects.length) + projects.length) % projects.length;
    if (centre !== s.centre) { s.centre = centre; s.onCentre?.(centre); }
  });
  return null;
}

// `ring` mounts the glass ring only while the profile is open (transmission renders the scene again each frame)
export default function Gallery({ state, onOpen, ring }) {
  const textures = useMemo(() => {
    const font = getComputedStyle(document.body).fontFamily;
    return projects.map((p, i) => makePoster(p, i, projects.length, font));
  }, []);

  // Input: wheel, drag, arrow keys. Snaps to the nearest screen when idle.
  useEffect(() => {
    const s = state.current;
    let idle, down = null;
    const snap = () => { clearTimeout(idle); idle = setTimeout(() => { s.target = Math.round(s.target / SPACING) * SPACING; }, 160); };
    const onWheel = (e) => { if (s.profile || s.full) return; s.target += (e.deltaY + e.deltaX) * 0.0055; snap(); };
    const onDown = (e) => { if (s.profile || s.full) return; down = { x: e.clientX, t: s.target }; s.dragged = false; };
    const onMove = (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (Math.abs(dx) > 6) s.dragged = true;
      s.target = down.t - dx * 0.014;
    };
    const onUp = () => { if (down) snap(); down = null; setTimeout(() => { s.dragged = false; }, 0); };
    const onKey = (e) => {
      if (s.profile || s.full) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") s.target += SPACING;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") s.target -= SPACING;
    };
    addEventListener("wheel", onWheel, { passive: true });
    addEventListener("pointerdown", onDown);
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("keydown", onKey);
    return () => {
      clearTimeout(idle);
      removeEventListener("wheel", onWheel);
      removeEventListener("pointerdown", onDown);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("keydown", onKey);
    };
  }, [state]);

  return (
    <Canvas className="gallery-canvas" dpr={[1, 1.75]} camera={{ position: [0, 0.2, 0], fov: 42, near: 0.1, far: 60 }} gl={{ antialias: true }}>
      <color attach="background" args={["#050505"]} />
      <Rig state={state} />
      <Floor state={state} />
      {Array.from({ length: SLOTS }, (_, slot) => {
        const i = slot % projects.length;
        return <Screen key={slot} slot={slot} index={i} project={projects[i]} texture={textures[i]} state={state} onOpen={onOpen} />;
      })}
      {ring && <Ring state={state} />}
    </Canvas>
  );
}

export { SPACING };
