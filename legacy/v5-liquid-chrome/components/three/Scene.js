"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

// Where the blob sits for each section. Sections opt in with data-blob="<key>";
// a section may also set data-blob-color to tint it (project pages use their brand colour).
const POSES = {
  hero:    { pos: [1.7, 0.1, 0],   scale: 1.55, distort: 0.45 },
  work:    { pos: [0, 0.2, -3.5],  scale: 1.25, distort: 0.6 },
  about:   { pos: [-2.4, -0.2, -0.5], scale: 1.1, distort: 0.38 },
  contact: { pos: [0, -0.1, -0.6], scale: 1.9, distort: 0.55 },
  page:    { pos: [2.5, 1.0, -1.2], scale: 1.0, distort: 0.42 },
};
const MOBILE = { hero: { pos: [0.5, 1.7, -2.6], scale: 0.95 }, about: { pos: [0.4, 1.8, -3] }, page: { pos: [0.8, 1.9, -3] }, contact: { pos: [0, 0.4, -2.5], scale: 1.4 } };
const DEFAULT_TINT = "#b9c6ff";

function useSectionPose() {
  const state = useRef({ key: "hero", tint: DEFAULT_TINT });
  useEffect(() => {
    // Pick the section that covers the middle of the viewport
    const pick = () => {
      const mid = innerHeight / 2;
      for (const el of document.querySelectorAll("[data-blob]")) {
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) {
          state.current.key = el.dataset.blob;
          state.current.tint = el.dataset.blobColor || DEFAULT_TINT;
          return;
        }
      }
    };
    pick();
    const id = setInterval(pick, 120);
    addEventListener("scroll", pick, { passive: true });
    return () => { clearInterval(id); removeEventListener("scroll", pick); };
  }, []);
  return state;
}

function Blob() {
  const mesh = useRef();
  const mat = useRef();
  const { viewport, pointer } = useThree();
  const section = useSectionPose();
  const tint = useMemo(() => new THREE.Color(DEFAULT_TINT), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const prevPointer = useRef(new THREE.Vector2());
  const energy = useRef(0);

  useFrame((_, dt) => {
    const m = mesh.current;
    const mobile = viewport.width < 6;
    const key = section.current.key;
    const pose = { ...POSES[key], ...(mobile ? MOBILE[key] : null) };

    // Cursor speed briefly adds "energy" → the liquid wobbles harder
    const speed = pointer.distanceTo(prevPointer.current) / Math.max(dt, 1e-3);
    prevPointer.current.copy(pointer);
    energy.current = THREE.MathUtils.damp(energy.current, Math.min(speed * 0.08, 0.5), 4, dt);

    target.set(pose.pos[0] + pointer.x * 0.35, pose.pos[1] + pointer.y * 0.25, pose.pos[2]);
    m.position.lerp(target, 1 - Math.exp(-2.2 * dt));
    const s = THREE.MathUtils.damp(m.scale.x, pose.scale, 2.2, dt);
    m.scale.setScalar(s);
    m.rotation.y += dt * 0.15;
    m.rotation.x = THREE.MathUtils.damp(m.rotation.x, -pointer.y * 0.4, 2, dt);
    m.rotation.z = THREE.MathUtils.damp(m.rotation.z, pointer.x * 0.3, 2, dt);

    const material = mat.current;
    material.distort = THREE.MathUtils.damp(material.distort, pose.distort + energy.current, 3, dt);
    tint.set(section.current.tint);
    material.color.lerp(tint, 1 - Math.exp(-2 * dt));
  });

  return (
    <mesh ref={mesh} position={POSES.hero.pos}>
      <icosahedronGeometry args={[1, 64]} />
      <MeshDistortMaterial
        ref={mat}
        color={DEFAULT_TINT}
        metalness={1}
        roughness={0.08}
        iridescence={1}
        iridescenceIOR={1.6}
        iridescenceThicknessRange={[200, 900]}
        clearcoat={1}
        clearcoatRoughness={0.1}
        envMapIntensity={1.4}
        distort={0.45}
        speed={1.6}
      />
    </mesh>
  );
}

// Small chrome / glass satellites that drift around for depth
function Satellites() {
  const items = useMemo(() => [
    { pos: [-3.6, 1.8, -2], r: 0.28, glass: false },
    { pos: [3.8, -1.9, -1.5], r: 0.2, glass: true },
    { pos: [-2.2, -2.3, -3], r: 0.42, glass: true },
    { pos: [2.6, 2.4, -4], r: 0.32, glass: false },
    { pos: [0.4, -2.8, -5], r: 0.6, glass: false },
  ], []);
  const group = useRef();
  useFrame((state, dt) => {
    group.current.rotation.y += dt * 0.03;
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, (window.scrollY || 0) * 0.0012, 3, dt);
  });
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <Float key={i} speed={1 + i * 0.3} rotationIntensity={1.2} floatIntensity={1.6}>
          <mesh position={it.pos}>
            {i % 2 ? <torusGeometry args={[it.r, it.r * 0.38, 32, 64]} /> : <sphereGeometry args={[it.r, 48, 48]} />}
            {it.glass
              ? <meshPhysicalMaterial transmission={1} thickness={0.6} roughness={0.05} ior={1.4} iridescence={1} color="#ffffff" />
              : <meshStandardMaterial metalness={1} roughness={0.12} color="#cfd6ff" />}
          </mesh>
        </Float>
      ))}
    </group>
  );
}

export default function Scene() {
  return (
    <div className="scene" aria-hidden="true">
      {/* The canvas ignores pointer events (so it never blocks clicks); listen on <body> instead */}
      <Canvas eventSource={document.body} eventPrefix="client" dpr={[1, 1.75]} camera={{ position: [0, 0, 6], fov: 42 }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} />
        <Blob />
        <Satellites />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
