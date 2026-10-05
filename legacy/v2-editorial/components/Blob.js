"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Environment, Float } from "@react-three/drei";
import * as THREE from "three";

const THEMES = {
  light: { bg: "#ecebe6", dark: "#111110" },
  dark: { bg: "#0e0e0d", dark: "#ecebe6" },
};

function useTheme() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read();
    window.addEventListener("themechange", read);
    return () => window.removeEventListener("themechange", read);
  }, []);
  return THEMES[theme];
}

function Shape({ bg }) {
  const ref = useRef();
  const bgColor = useMemo(() => new THREE.Color(bg), [bg]);
  useFrame(({ pointer, viewport }, dt) => {
    const m = ref.current;
    // Lazily follow the pointer and tilt toward it
    m.position.x = THREE.MathUtils.damp(m.position.x, (pointer.x * viewport.width) / 5, 3, dt);
    m.position.y = THREE.MathUtils.damp(m.position.y, (pointer.y * viewport.height) / 5, 3, dt);
    m.rotation.x += dt * 0.25 + pointer.y * dt * 0.6;
    m.rotation.y += dt * 0.35 + pointer.x * dt * 0.6;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh ref={ref} scale={0.95}>
        <torusKnotGeometry args={[1, 0.36, 256, 48]} />
        <MeshTransmissionMaterial
          backside
          samples={6}
          resolution={512}
          thickness={0.8}
          background={bgColor}
          roughness={0.05}
          chromaticAberration={0.9}
          anisotropicBlur={0.2}
          distortion={0.6}
          distortionScale={0.4}
          temporalDistortion={0.15}
          ior={1.3}
          color="#ffffff"
        />
      </mesh>
    </Float>
  );
}

function Backdrop({ dark }) {
  // Colored spheres behind the glass so refraction has something to bend
  return (
    <group position={[0, 0, -3]}>
      <mesh position={[-2.6, 1.2, 0]}><sphereGeometry args={[1.1, 48, 48]} /><meshBasicMaterial color="#ff4a1c" /></mesh>
      <mesh position={[2.8, -1.1, 0]}><sphereGeometry args={[0.9, 48, 48]} /><meshBasicMaterial color="#2f4bff" /></mesh>
      <mesh position={[0.4, 2.2, -1]}><sphereGeometry args={[0.55, 48, 48]} /><meshBasicMaterial color={dark} /></mesh>
    </group>
  );
}

export default function Blob() {
  const t = useTheme();
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 7], fov: 40 }} gl={{ antialias: true, alpha: true }}>
      <Backdrop dark={t.dark} />
      <Shape bg={t.bg} />
      <ambientLight intensity={1} />
      <Environment preset="studio" />
    </Canvas>
  );
}
