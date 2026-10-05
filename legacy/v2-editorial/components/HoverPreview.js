"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { projects } from "@/lib/projects";

// Placeholder artwork per project; swap for useTexture(project.image) when you have images.
function makeTexture(p, i) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 640;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(180, 190, 10, 220, 260, 520);
  grad.addColorStop(0, p.colors[0]); grad.addColorStop(0.48, p.colors[1]); grad.addColorStop(1, p.colors[2]);
  g.fillStyle = grad; g.fillRect(0, 0, 512, 640);
  g.fillStyle = "rgba(255,255,255,.85)";
  g.font = "800 220px Syne, sans-serif";
  g.fillText("0" + (i + 1), 30, 600);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const vertex = /* glsl */ `
  uniform vec2 uVel;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Bend the plane against the direction of travel, strongest in the middle
    float bend = sin(uv.x * 3.1416) * sin(uv.y * 3.1416);
    p.x -= uVel.x * bend * 0.9;
    p.y -= uVel.y * bend * 0.9;
    p.z += sin(uv.y * 6.0 + uTime * 2.0) * 0.02;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const fragment = /* glsl */ `
  uniform sampler2D uA;
  uniform sampler2D uB;
  uniform float uMix;
  uniform float uAlpha;
  uniform vec2 uVel;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    // Liquid wobble + RGB split proportional to cursor speed
    vec2 uv = vUv;
    uv += vec2(sin(uv.y * 10.0 + uTime * 3.0), cos(uv.x * 10.0 + uTime * 3.0)) * 0.006;
    float speed = length(uVel);
    vec2 off = uVel * 0.06;
    float m = smoothstep(0.0, 1.0, uMix + (texture2D(uB, uv * 0.5).r - 0.5) * 0.4 * (1.0 - abs(uMix * 2.0 - 1.0)));
    vec4 a = vec4(texture2D(uA, uv + off).r, texture2D(uA, uv).g, texture2D(uA, uv - off).b, 1.0);
    vec4 b = vec4(texture2D(uB, uv + off).r, texture2D(uB, uv).g, texture2D(uB, uv - off).b, 1.0);
    vec4 col = mix(a, b, m);
    col.rgb += speed * 0.08;
    gl_FragColor = vec4(col.rgb, uAlpha);
  }`;

function Plane() {
  const mesh = useRef();
  const { viewport, size } = useThree();
  const textures = useMemo(() => projects.map(makeTexture), []);
  const state = useRef({ target: -1, current: 0, mouse: new THREE.Vector2(), pos: new THREE.Vector2(), vel: new THREE.Vector2() });

  const uniforms = useMemo(() => ({
    uA: { value: textures[0] }, uB: { value: textures[0] }, uMix: { value: 1 },
    uAlpha: { value: 0 }, uVel: { value: new THREE.Vector2() }, uTime: { value: 0 },
  }), [textures]);

  useEffect(() => {
    const onMove = (e) => state.current.mouse.set(e.clientX, e.clientY);
    const onHover = (e) => {
      const i = e.detail;
      const s = state.current;
      s.target = i;
      if (i >= 0 && i !== s.current) {
        // Crossfade from the current texture to the new one
        uniforms.uA.value = uniforms.uB.value;
        uniforms.uB.value = textures[i];
        uniforms.uMix.value = uniforms.uAlpha.value < 0.05 ? 1 : 0;
        s.current = i;
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("project-hover", onHover);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("project-hover", onHover); };
  }, [textures, uniforms]);

  useFrame((_, dt) => {
    const s = state.current;
    const tx = (s.mouse.x / size.width - 0.5) * viewport.width;
    const ty = -(s.mouse.y / size.height - 0.5) * viewport.height;
    const px = s.pos.x, py = s.pos.y;
    s.pos.x = THREE.MathUtils.damp(s.pos.x, tx, 7, dt);
    s.pos.y = THREE.MathUtils.damp(s.pos.y, ty, 7, dt);
    s.vel.set(THREE.MathUtils.clamp((s.pos.x - px) / Math.max(dt, 1e-3) * 0.05, -1, 1),
              THREE.MathUtils.clamp((s.pos.y - py) / Math.max(dt, 1e-3) * 0.05, -1, 1));
    uniforms.uVel.value.lerp(s.vel, 0.2);
    uniforms.uTime.value += dt;
    uniforms.uMix.value = THREE.MathUtils.damp(uniforms.uMix.value, 1, 6, dt);
    uniforms.uAlpha.value = THREE.MathUtils.damp(uniforms.uAlpha.value, s.target >= 0 ? 1 : 0, 8, dt);
    const m = mesh.current;
    m.position.set(s.pos.x, s.pos.y, 0);
    m.rotation.z = -uniforms.uVel.value.x * 0.15;
    const sc = 0.6 + uniforms.uAlpha.value * 0.4;
    m.scale.set(sc, sc, 1);
    m.visible = uniforms.uAlpha.value > 0.01;
  });

  const h = Math.min(viewport.height * 0.5, 3.2);
  return (
    <mesh ref={mesh}>
      <planeGeometry args={[h * 0.8, h, 32, 32]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  );
}

export default function HoverPreview() {
  return (
    <div className="hover-preview">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 6], fov: 45 }} gl={{ alpha: true }}>
        <Plane />
      </Canvas>
    </div>
  );
}
