"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { weather } from "./weather";
import { cycle } from "./dayCycle";
import { sfx } from "./sound";

// ───────── Rain, snow and lightning, after Bruno Simon's folio-2025 (MIT: RainLines.js, Lightnings.js) ─────────
// Rain is his field of thin falling lines that loops around the car: each line is a quad that
// drops from 20 m, slanted by the wind. Snow is the same field with short, slow, wider strokes
// (flakes). How many lines show follows rain²; length and speed blend from rain to snow.
// In storms (clouds × electric field × humidity) lightning strikes: a jagged bolt, a flash of the
// sun light and fog, and thunder delayed by the distance.
const COUNT = 1 << 12;
const SIZE = 64;           // metres of rain field around the car
const ELEVATION = 20;

function lineGeometry() {
  const pos = new Float32Array(COUNT * 12), off = new Float32Array(COUNT * 8), rnd = new Float32Array(COUNT * 4), idx = new Uint32Array(COUNT * 6);
  for (let l = 0; l < COUNT; l++) {
    const x = Math.random(), z = Math.random(), r = Math.random();
    for (let v = 0; v < 4; v++) {
      pos.set([x, 0, z], (l * 4 + v) * 3);
      off.set([v === 0 || v === 1 ? 1 : 0, v === 0 || v === 3 ? 1 : 0], (l * 4 + v) * 2);
      rnd[l * 4 + v] = r;
    }
    idx.set([l * 4, l * 4 + 3, l * 4 + 2, l * 4 + 2, l * 4 + 1, l * 4], l * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("offset", new THREE.BufferAttribute(off, 2));
  g.setAttribute("random", new THREE.BufferAttribute(rnd, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}

function Lines({ carRef }) {
  const geometry = useMemo(lineGeometry, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uSize: { value: SIZE }, uCenter: { value: new THREE.Vector2() }, uTime: { value: 0 },
      uLength: { value: 2 }, uThickness: { value: 0.015 }, uIncline: { value: 0.2 }, uVisible: { value: 0 },
      uColor: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 0.5 },
    },
    vertexShader: `
      attribute vec2 offset; attribute float random;
      uniform float uSize; uniform vec2 uCenter; uniform float uTime; uniform float uLength; uniform float uThickness; uniform float uIncline; uniform float uVisible;
      void main(){
        vec3 p = position;
        const vec2 tangent = vec2(0.707, -0.707);
        // loop the field around the car
        p.xz = p.xz * uSize - uCenter;
        p.xz = mod(p.xz + uSize * 0.5, uSize) - uSize * 0.5 + uCenter;
        p.xz += tangent * offset.x * uThickness;
        // fall
        float progress = mod(uTime + random, 1.0);
        p.y = ${ELEVATION.toFixed(1)} + uLength;
        p.y -= uLength * (1.0 - offset.y);
        p.y -= progress * (${ELEVATION.toFixed(1)} + uLength);
        p.y = clamp(p.y, 0.0, ${ELEVATION.toFixed(1)});
        // only a share of the lines (rain²)
        p.y += step(uVisible, fract(random * 99.0)) * 999.0;
        // wind slant
        p.xz += tangent * p.y * uIncline * -1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; void main(){ gl_FragColor = vec4(uColor, uOpacity); }`,
  }), []);

  useFrame((_, dt) => {
    const u = material.uniforms, rb = carRef.current;
    if (rb) { const t = rb.translation(); u.uCenter.value.set(t.x, t.z); }
    const rain = weather.rain;
    const snowRatio = 1 - Math.pow(1 - Math.max(weather.snow, 0), 4); // his
    const lerp = (a, b, k) => a + (b - a) * k;
    const baseLength = 1 + Math.min(rain, 1) * 2, baseSpeed = 0.2 + Math.min(rain, 1) * 0.2;
    u.uLength.value = lerp(baseLength, 0.11, snowRatio);
    u.uThickness.value = lerp(0.02, 0.09, snowRatio);
    u.uTime.value += dt * lerp(baseSpeed, 0.05, snowRatio);
    u.uIncline.value = 0.1 + weather.wind * 0.3;
    u.uVisible.value = Math.pow(rain, 2);
    // lit like the world (light colour), flakes brighter
    u.uColor.value.copy(cycle.light).multiplyScalar(Math.min(cycle.lightIntensity, 1.3)).lerp(new THREE.Color(1, 1, 1), 0.5 + snowRatio * 0.3);
    u.uOpacity.value = lerp(0.45, 0.95, snowRatio);
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={3} userData={{ noMap: true }} />;
}

// A jagged bolt from the sky to the ground, as a camera-facing ribbon
function boltGeometry() {
  const pts = [];
  let x = 0, z = 0;
  for (let y = 42; y >= 0; y -= 2.2 + Math.random() * 1.8) {
    pts.push(new THREE.Vector3(x, y, z));
    x += (Math.random() - 0.5) * 3.2; z += (Math.random() - 0.5) * 3.2;
  }
  pts.push(new THREE.Vector3(x, 0, z));
  const side = new THREE.Vector3(0.707, 0, -0.707), pos = [], idx = [];
  pts.forEach((p, i) => {
    const w = 0.35 * (1 - i / pts.length) + 0.12;
    pos.push(p.x - side.x * w, p.y, p.z - side.z * w, p.x + side.x * w, p.y, p.z + side.z * w);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function Lightning({ carRef }) {
  const mesh = useRef();
  const st = useMemo(() => ({ next: 6, life: 0 }), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 8), toneMapped: false, transparent: true, side: THREE.DoubleSide }), []);
  useFrame((_, dt) => {
    st.next -= dt;
    if (st.life > 0) {
      st.life -= dt;
      material.opacity = st.life > 0.12 ? (Math.random() > 0.3 ? 1 : 0.2) : st.life / 0.12; // flicker, then fade
      if (st.life <= 0 && mesh.current) mesh.current.visible = false;
    }
    if (st.next > 0) return;
    const storm = weather.storm;
    st.next = 2.5 + Math.random() * 10 / Math.max(storm, 0.15);
    if (storm < 0.25 || !mesh.current) return;
    // strike somewhere around the car
    const rb = carRef.current, c = rb ? rb.translation() : { x: 0, z: 0 };
    const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 45;
    mesh.current.geometry.dispose();
    mesh.current.geometry = boltGeometry();
    mesh.current.position.set(c.x + Math.cos(a) * d, 0, c.z + Math.sin(a) * d);
    mesh.current.visible = true;
    st.life = 0.35;
    weather.flash = Math.max(weather.flash, 1 - d / 90);
    setTimeout(() => sfx.thunder(1 - d / 90), (d / 340) * 1000 * 6); // sound lags behind the flash
  });
  return <mesh ref={mesh} geometry={useMemo(boltGeometry, [])} material={material} visible={false} renderOrder={4} userData={{ noMap: true }} />;
}

export default function Precipitation({ carRef }) {
  return (
    <>
      <Lines carRef={carRef} />
      <Lightning carRef={carRef} />
    </>
  );
}
