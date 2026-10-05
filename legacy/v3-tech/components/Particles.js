"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";

const COUNT = 14000;

// Three target shapes sampled to the same point count; the shader blends between them.
function buildShapes() {
  const sphere = new Float32Array(COUNT * 3);
  const knot = new Float32Array(COUNT * 3);
  const wave = new Float32Array(COUNT * 3);
  const rand = new Float32Array(COUNT);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const side = Math.ceil(Math.sqrt(COUNT));

  for (let i = 0; i < COUNT; i++) {
    // Fibonacci sphere
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    sphere.set([Math.cos(th) * r * 1.9, y * 1.9, Math.sin(th) * r * 1.9], i * 3);

    // Torus knot (p=2, q=3) with tube jitter
    const t = (i / COUNT) * Math.PI * 2;
    const p = 2, q = 3;
    const R = 1.25, tube = 0.42;
    const cr = R * (2 + Math.cos(q * t)) * 0.5;
    const a = Math.random() * Math.PI * 2, b = Math.sqrt(Math.random()) * tube;
    knot.set([
      cr * Math.cos(p * t) + Math.cos(a) * b,
      cr * Math.sin(p * t) + Math.sin(a) * b,
      R * Math.sin(q * t) * 0.5 + Math.cos(a + 1.3) * b,
    ], i * 3);

    // Rippling grid plane — a "loss landscape"
    const gx = (i % side) / side - 0.5, gz = Math.floor(i / side) / side - 0.5;
    wave.set([gx * 6, Math.sin(gx * 9) * Math.cos(gz * 7) * 0.35 - 0.4, gz * 4], i * 3);

    rand[i] = Math.random();
  }
  return { sphere, knot, wave, rand };
}

const vertex = /* glsl */ `
  attribute vec3 aKnot;
  attribute vec3 aWave;
  attribute float aRand;
  uniform float uTime;
  uniform float uShape;   // 0 sphere → 1 knot → 2 wave → 3 sphere
  uniform vec2 uMouse;    // world-space xy
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vGlow;

  void main() {
    float s = mod(uShape, 3.0);
    vec3 a = position, b = aKnot;
    if (s >= 1.0 && s < 2.0) { a = aKnot; b = aWave; }
    else if (s >= 2.0) { a = aWave; b = position; }
    // Stagger each point's morph so shapes dissolve rather than slide
    float k = smoothstep(0.0, 1.0, clamp(fract(s) * 1.6 - aRand * 0.6, 0.0, 1.0));
    vec3 p = mix(a, b, k);

    // Gentle swirling drift
    p += 0.05 * vec3(sin(uTime * 0.6 + p.y * 3.0 + aRand * 6.28), cos(uTime * 0.5 + p.x * 3.0), sin(uTime * 0.4 + p.z * 3.0));

    vec4 world = modelMatrix * vec4(p, 1.0);
    // Cursor repulsion in world space
    vec2 d = world.xy - uMouse;
    float dist = length(d);
    float push = smoothstep(1.1, 0.0, dist);
    world.xy += normalize(d + 1e-4) * push * 0.55;
    world.z += push * 0.6;
    vGlow = push;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.6 + aRand * 0.8) * (1.0 / -mv.z);
  }`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(mix(uColor, uAccent, vGlow), a * uOpacity);
  }`;

const THEMES = {
  dark: { color: "#e9e8e3", accent: "#c8ff2e", blending: THREE.AdditiveBlending, opacity: 0.5 },
  light: { color: "#0b0b0c", accent: "#3d2bff", blending: THREE.NormalBlending, opacity: 0.85 },
};

function useTheme() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    read();
    window.addEventListener("themechange", read);
    return () => window.removeEventListener("themechange", read);
  }, []);
  return THEMES[theme];
}

function Field() {
  const points = useRef();
  const { viewport, gl } = useThree();
  const theme = useTheme();
  const shapes = useMemo(buildShapes, []);
  const mouse = useRef(new THREE.Vector2(99, 99));
  const target = useMemo(() => new THREE.Vector2(), []);

  // Build the material ourselves so the uniforms object we animate is the one the GPU reads
  // (passing `uniforms` as a JSX prop gives the material its own copy).
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uShape: { value: 0 }, uMouse: { value: new THREE.Vector2(99, 99) },
      uSize: { value: 22 }, uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uColor: { value: new THREE.Color() }, uAccent: { value: new THREE.Color() }, uOpacity: { value: 0.5 },
    },
  }), [gl]);
  const uniforms = material.uniforms;
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    uniforms.uColor.value.set(theme.color);
    uniforms.uAccent.value.set(theme.accent);
    uniforms.uOpacity.value = theme.opacity;
    material.blending = theme.blending;
    material.needsUpdate = true;
  }, [theme, material, uniforms]);

  // Morph to the next shape every few seconds
  useEffect(() => {
    const tl = gsap.timeline({ repeat: -1 });
    for (let i = 1; i <= 3; i++) tl.to(uniforms.uShape, { value: i, duration: 2.4, ease: "power2.inOut" }, `+=${3.2}`);
    return () => tl.kill();
  }, [uniforms]);

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    };
    const onLeave = () => mouse.current.set(99, 99);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => { window.removeEventListener("pointermove", onMove); document.documentElement.removeEventListener("pointerleave", onLeave); };
  }, []);

  useFrame((state, dt) => {
    uniforms.uTime.value += dt;
    const m = mouse.current;
    if (m.x > 50) target.set(99, 99);
    else target.set((m.x * viewport.width) / 2, (m.y * viewport.height) / 2);
    uniforms.uMouse.value.lerp(target, 0.12);
    const p = points.current;
    p.rotation.y += dt * 0.08;
    p.rotation.x = THREE.MathUtils.damp(p.rotation.x, m.x > 50 ? 0 : -m.y * 0.25, 2, dt);
  });

  return (
    <points ref={points} material={material} position={[viewport.width > 7 ? 1.6 : 0, 0.1, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[shapes.sphere, 3]} />
        <bufferAttribute attach="attributes-aKnot" args={[shapes.knot, 3]} />
        <bufferAttribute attach="attributes-aWave" args={[shapes.wave, 3]} />
        <bufferAttribute attach="attributes-aRand" args={[shapes.rand, 1]} />
      </bufferGeometry>
    </points>
  );
}

export default function Particles() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6.5], fov: 45 }} gl={{ alpha: true, antialias: false }}>
      <Field />
    </Canvas>
  );
}
