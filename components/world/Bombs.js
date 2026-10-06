"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider, useRapier } from "@react-three/rapier";
import * as THREE from "three";
import { B, usePiece } from "./bruno";
import { rng } from "./kit";
import { ISLAND_R, SPAWN_POS, nearRoad } from "./zones";
import { terrain } from "./terrain";
import { sfx } from "./sound";
import { cycle } from "./dayCycle";

// ───────── Bombs: Bruno Simon's explosive crates (folio-2025, MIT: ExplosiveCrates.js, Fireballs.js) ─────────
// Like his, they're scattered all over the world. Any knock arms one: a metallic tick, and 0.4 s
// later it blows up in a fireball, throwing everything nearby (the car included). Crates caught
// in a blast go off too, so clusters chain-react.

// Shared state: live crates (for chain reactions), queued fireballs, and the listener (the car)
const crates = new Set();
const queue = [];
const listener = new THREE.Vector3(9999, 0, 9999);
const RADIUS = 8.5;         // blast radius (m)
const CHAIN = 4.5;          // crates this close to a blast go off as well

function blast(world, p, self) {
  // Push every dynamic body in range away from the blast, up and out
  world.bodies.forEach((b) => {
    if (!b.isDynamic() || b === self) return;
    const t = b.translation(), dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z, d = Math.hypot(dx, dy, dz);
    if (d > RADIUS || d < 1e-3) return;
    const k = (1 - d / RADIUS) * b.mass() * 12;
    b.applyImpulse({ x: (dx / d) * k, y: k * 0.9 + b.mass() * 2, z: (dz / d) * k }, true);
    b.applyTorqueImpulse({ x: (Math.random() - 0.5) * k * 0.3, y: 0, z: (Math.random() - 0.5) * k * 0.3 }, true);
  });
  queue.push(new THREE.Vector3(p.x, p.y, p.z));
  sfx.explosion(listener.distanceTo(p));
  for (const c of crates) {
    const q = c.position();
    if (q && Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < CHAIN) c.arm(0.15 + Math.random() * 0.25, false);
  }
}

const isCrate = () => true;
export function ExplosiveCrate({ position, rotation = 0 }) {
  const { obj, box } = usePiece(B("explosiveCrates"), isCrate);
  const clone = useMemo(() => obj.clone(true), [obj]);
  const half = useMemo(() => box.getSize(new THREE.Vector3()).multiplyScalar(0.5).toArray(), [box]);
  const body = useRef();
  const st = useRef({ armed: false, done: false, timer: 0 });
  const [gone, setGone] = useState(false);
  const { world } = useRapier();

  const entry = useMemo(() => ({
    position: () => (st.current.done || !body.current ? null : body.current.translation()),
    arm: (delay = 0.4, tick = true) => {
      const s = st.current;
      if (s.armed || s.done) return;
      s.armed = true;
      const p = body.current?.translation();
      if (tick && p && listener.distanceTo(p) < 45) sfx.fuse();
      s.timer = setTimeout(() => {
        if (s.done || !body.current) return;
        s.done = true;
        blast(world, body.current.translation(), body.current);
        setGone(true);
      }, delay * 1000);
    },
  }), [world]);

  useEffect(() => {
    crates.add(entry);
    const s = st.current;
    return () => { crates.delete(entry); clearTimeout(s.timer); };
  }, [entry]);

  // Armed by the car touching it, or by anything else hitting it hard enough
  // (This runs inside Rapier's contact callback, while the physics world is still borrowed:
  // calling into any body here panics Rapier, "…Rust value while it was borrowed". So only note
  // who hit us, and check speeds once the step has finished.)
  const onCollisionEnter = (e) => {
    const other = e.other.rigidBody, isCar = e.other.rigidBodyObject?.name === "car";
    if (!other || st.current.armed || st.current.done) return;
    queueMicrotask(() => {
      const self = body.current;
      if (!self || st.current.armed || st.current.done) return;
      try {
        if (other.isValid && !other.isValid()) return; // removed since the hit
        if (!other.isDynamic()) return; // resting on the ground or a wall doesn't count
        if (isCar) return entry.arm();
        const v = other.linvel(), w = self.linvel();
        if (Math.hypot(v.x - w.x, v.y - w.y, v.z - w.z) > 3) entry.arm();
      } catch { /* the other body was removed meanwhile */ }
    });
  };

  if (gone) return null;
  return (
    <RigidBody ref={body} position={position} rotation={[0, rotation, 0]} colliders={false} linearDamping={0.3} angularDamping={0.4} onCollisionEnter={onCollisionEnter}>
      <CuboidCollider args={half} density={0.3} friction={0.8} />
      <primitive object={clone} />
    </RigidBody>
  );
}

// ── Fireballs (his Fireballs.js): a noisy sphere that swells, burns red → orange and dissolves
// through dark smoke as its progress climbs; plus one shared flash light ──
const fireVertex = /* glsl */ `
  varying vec3 vPos; varying float vY;
  void main() {
    vPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vY = wp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const fireFragment = /* glsl */ `
  uniform float uProgress; uniform float uHeat; uniform vec3 uSeed; uniform vec3 uSmoke;
  varying vec3 vPos; varying float vY;
  // 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  void main() {
    vec3 p = vPos * 2.6 + uSeed;
    float n = (snoise(p) * 0.65 + snoise(p * 2.1) * 0.35) * 0.5 + 0.5;
    n = clamp((n - 0.15) / 0.75, 0.0, 1.0);
    n *= clamp(vY * 2.0, 0.0, 1.0);          // fades out where it meets the floor
    n -= uProgress;
    if (n < 0.0) discard;
    vec3 fire = mix(vec3(0.9, 0.06, 0.015), vec3(1.0, 0.4, 0.05), clamp(n * 2.2, 0.0, 1.0)) * 2.4 * uHeat; // HDR → bloom, white-hot at first
    fire += vec3(1.0, 0.8, 0.4) * smoothstep(0.55, 0.9, n) * uHeat;         // hot yellow cores
    gl_FragColor = vec4(mix(fire, uSmoke, step(n, 0.1)), 1.0);
  }`;

const POOL = 6;
const ease = (t) => 1 - Math.pow(1 - Math.min(t, 1), 3); // power3.out
const FIRE_R = 7;           // fireball diameter at full size (his was 5)
const DEBRIS = 180, EMBERS = 260, SMOKE = 90, SCORCH = 8;
const rand = (a, b) => a + Math.random() * (b - a);

// Soft round alpha for the scorch marks left on the ground
function scorchTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, "#fff"); grad.addColorStop(0.55, "#bbb"); grad.addColorStop(1, "#000");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = "rgba(0,0,0," + (Math.random() * 0.5).toFixed(2) + ")";
    g.beginPath(); g.arc(64 + rand(-50, 50), 64 + rand(-50, 50), rand(4, 14), 0, 7); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

// Particles live in plain arrays and are written into instanced meshes each frame
const makeParticles = (n) => Array.from({ length: n }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1 }));

// A blast, layer by layer: a white-hot core flash, the noisy fireball (bigger and hotter than
// his, rising as it burns), a shockwave ring racing over the ground, tumbling crate shards,
// glowing embers, a column of smoke, a scorch mark that fades, a big orange flash and camera shake.
export function Fireballs({ carRef }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(0.5, 24, 14), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.93, 1, 72).rotateX(-Math.PI / 2), []);
  const balls = useMemo(() => Array.from({ length: POOL }, () => ({
    t: 0, active: false,
    material: new THREE.ShaderMaterial({
      vertexShader: fireVertex, fragmentShader: fireFragment,
      uniforms: { uProgress: { value: 0 }, uHeat: { value: 1 }, uSeed: { value: new THREE.Vector3() }, uSmoke: { value: new THREE.Color("#241b20") } },
    }),
    core: new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 7, 4), toneMapped: false, transparent: true }),
    ring: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.6), toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  })), []);
  const parts = useMemo(() => ({ debris: makeParticles(DEBRIS), embers: makeParticles(EMBERS), smoke: makeParticles(SMOKE) }), []);
  const scorches = useMemo(() => Array.from({ length: SCORCH }, () => ({ life: 0 })), []);
  const scorchTex = useMemo(scorchTexture, []);
  const refs = useRef({ fire: [], core: [], ring: [], scorch: [] });
  const debrisMesh = useRef(), emberMesh = useRef(), smokeMesh = useRef();
  const light = useRef(), glow = useRef();
  const next = useRef({ ball: 0, debris: 0, embers: 0, smoke: 0, scorch: 0 });
  const o = useMemo(() => new THREE.Object3D(), []);
  const emberColor = useMemo(() => new THREE.Color(7, 2.6, 0.5), []);
  const { camera } = useThree();

  useEffect(() => () => {
    [geometry, ringGeo, scorchTex].forEach((x) => x.dispose());
    balls.forEach((b) => { b.material.dispose(); b.core.dispose(); b.ring.dispose(); });
  }, [geometry, ringGeo, scorchTex, balls]);

  // Shard colours (crate wood, red paint, charred bits) and smoke greys; everything starts hidden
  useLayoutEffect(() => {
    const c = new THREE.Color(), cols = ["#8a4b2a", "#c2402b", "#5a3322", "#2a1f1f", "#d9a066"];
    o.position.set(0, -50, 0); o.scale.setScalar(0.0001); o.updateMatrix();
    [[debrisMesh, DEBRIS], [emberMesh, EMBERS], [smokeMesh, SMOKE]].forEach(([m, n]) => {
      for (let i = 0; i < n; i++) m.current.setMatrixAt(i, o.matrix);
      m.current.instanceMatrix.needsUpdate = true;
    });
    for (let i = 0; i < DEBRIS; i++) debrisMesh.current.setColorAt(i, c.set(cols[i % cols.length]));
    for (let i = 0; i < SMOKE; i++) smokeMesh.current.setColorAt(i, c.setScalar(0.12 + Math.random() * 0.14));
    debrisMesh.current.instanceColor.needsUpdate = true;
    smokeMesh.current.instanceColor.needsUpdate = true;
  }, [o]);

  const spawn = (list, key, count, init) => {
    for (let k = 0; k < count; k++) {
      const pt = list[next.current[key]++ % list.length];
      init(pt);
      pt.max = pt.life;
    }
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const rb = carRef.current;
    if (rb) { const t = rb.translation(); listener.set(t.x, t.y, t.z); }
    const R = refs.current;

    // ── Start queued blasts ──
    while (queue.length) {
      const p = queue.shift(), i = next.current.ball++ % POOL, b = balls[i];
      const y = Math.max(p.y, 0.6);
      b.active = true; b.t = 0;
      b.material.uniforms.uSeed.value.set(Math.random() * 50, Math.random() * 50, Math.random() * 50);
      if (R.fire[i]) { R.fire[i].position.set(p.x, y, p.z); R.fire[i].rotation.set(Math.random() * 6.28, Math.random() * 6.28, 0); R.fire[i].visible = true; }
      if (R.core[i]) { R.core[i].position.set(p.x, y + 0.3, p.z); R.core[i].visible = true; }
      if (R.ring[i]) { R.ring[i].position.set(p.x, 0.08, p.z); R.ring[i].visible = true; }
      // Flash: a hot light at the blast plus a high, wide glow that washes over the surroundings.
      // At night both get much stronger, reach further and linger, lighting up the whole area.
      const night = cycle.nightAmount;
      if (light.current) {
        light.current.position.set(p.x, y + 2, p.z);
        light.current.intensity = 1400 * (1 + night * 1.6);
        light.current.distance = 40 + night * 25;
      }
      if (glow.current) {
        glow.current.position.set(p.x, y + 12, p.z);
        glow.current.intensity = 900 * (0.35 + night * 1.4);
        glow.current.distance = 70 + night * 50;
      }
      // crate shards: thrown up and out, tumbling, bouncing on the ground
      spawn(parts.debris, "debris", 26, (pt) => {
        const a = Math.random() * 6.28, sp = rand(5, 15);
        pt.p.set(p.x + rand(-0.4, 0.4), y + rand(0, 0.6), p.z + rand(-0.4, 0.4));
        pt.v.set(Math.cos(a) * sp, rand(6, 16), Math.sin(a) * sp);
        pt.r.set(rand(0, 6), rand(0, 6), rand(0, 6)); pt.w.set(rand(-14, 14), rand(-14, 14), rand(-14, 14));
        pt.s = rand(0.12, 0.42); pt.life = rand(1.6, 2.8);
      });
      // glowing embers / sparks: fast and short-lived
      spawn(parts.embers, "embers", 44, (pt) => {
        const a = Math.random() * 6.28, el = rand(0.15, 1.3), sp = rand(8, 22);
        pt.p.set(p.x, y + 0.4, p.z);
        pt.v.set(Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 3, Math.sin(a) * Math.cos(el) * sp);
        pt.s = rand(0.06, 0.16); pt.life = rand(0.6, 1.6);
      });
      // a column of smoke rising after the fire
      spawn(parts.smoke, "smoke", 16, (pt) => {
        const a = Math.random() * 6.28, d = rand(0, 2.2);
        pt.p.set(p.x + Math.cos(a) * d, y + rand(0.5, 2.5), p.z + Math.sin(a) * d);
        pt.v.set(Math.cos(a) * rand(0.3, 1.5), rand(2, 4.5), Math.sin(a) * rand(0.3, 1.5));
        pt.r.set(rand(0, 6), rand(0, 6), 0);
        pt.s = rand(0.9, 1.8); pt.life = rand(2.6, 4.2);
      });
      // a scorch mark on the ground
      const si = next.current.scorch++ % SCORCH, sm = R.scorch[si];
      if (sm) { scorches[si].life = 1; sm.position.set(p.x, 0.05, p.z); sm.rotation.z = Math.random() * 6.28; sm.scale.setScalar(rand(9, 12)); sm.visible = true; }
      // camera shake, stronger the closer the car is
      shake.amount = Math.max(shake.amount, Math.max(0, 1 - listener.distanceTo(p) / 45) * 1.6);
    }

    // ── Core flash, fireball, shockwave ──
    balls.forEach((b, i) => {
      if (!b.active) return;
      b.t += dt;
      const f = R.fire[i], c = R.core[i], r = R.ring[i];
      if (f) {
        f.scale.setScalar(0.6 + (FIRE_R - 0.6) * ease(b.t / 0.45));
        f.rotation.z = -b.t / 2;
        f.position.y += dt * 1.2;                                        // the ball lifts as it burns
        b.material.uniforms.uProgress.value = b.t < 0.35 ? 0.1 : 0.1 + 0.9 * Math.min((b.t - 0.35) / 2.1, 1);
        b.material.uniforms.uHeat.value = 1 + 3.2 * Math.exp(-b.t * 4);  // white-hot at first
      }
      if (c) { const k = b.t / 0.32; c.scale.setScalar(k < 1 ? 3.6 * Math.sin(k * Math.PI) + 0.01 : 0.01); b.core.opacity = Math.max(0, 1 - k); }
      if (r) { const k = Math.min(b.t / 0.6, 1); r.scale.setScalar(1 + 17 * ease(k)); b.ring.opacity = Math.pow(Math.max(0, 1 - k), 1.6) * 0.75; }
      if (b.t > 2.6) { b.active = false; [f, c, r].forEach((m) => m && (m.visible = false)); }
    });

    // ── Particles ──
    const step = (list, mesh, gravity, drag, write) => {
      if (!mesh) return;
      let any = false;
      list.forEach((pt, i) => {
        if (pt.life <= 0) return;
        any = true;
        pt.life -= dt;
        pt.v.y -= gravity * dt;
        pt.v.multiplyScalar(1 - drag * dt);
        pt.p.addScaledVector(pt.v, dt);
        if (pt.life <= 0) { o.position.set(0, -50, 0); o.scale.setScalar(0.0001); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); return; }
        write(pt, i);
      });
      if (any) mesh.instanceMatrix.needsUpdate = true;
    };
    step(parts.debris, debrisMesh.current, 22, 0.4, (pt, i) => {
      if (pt.p.y < pt.s * 0.5) { pt.p.y = pt.s * 0.5; pt.v.y *= -0.35; pt.v.x *= 0.7; pt.v.z *= 0.7; pt.w.multiplyScalar(0.7); }
      pt.r.x += pt.w.x * dt; pt.r.y += pt.w.y * dt; pt.r.z += pt.w.z * dt;
      o.position.copy(pt.p); o.rotation.copy(pt.r);
      o.scale.set(pt.s, pt.s * 0.5, pt.s * 1.6).multiplyScalar(Math.min(1, pt.life * 2));
      o.updateMatrix(); debrisMesh.current.setMatrixAt(i, o.matrix);
    });
    step(parts.embers, emberMesh.current, 9, 0.9, (pt, i) => {
      o.position.copy(pt.p); o.rotation.set(0, 0, 0);
      o.scale.setScalar(pt.s * Math.min(1, (pt.life / pt.max) * 1.5));
      o.updateMatrix(); emberMesh.current.setMatrixAt(i, o.matrix);
    });
    step(parts.smoke, smokeMesh.current, -0.4, 0.5, (pt, i) => {
      const k = 1 - pt.life / pt.max;                                     // 0 → 1 over its life
      o.position.copy(pt.p); o.rotation.copy(pt.r);
      // (appears once the fire has bloomed, swells, then shrinks away)
      o.scale.setScalar(pt.s * (0.6 + k * 2.4) * Math.min(1, (1 - k) * 3) * Math.min(1, Math.max(0, (k - 0.1) / 0.12)));
      o.updateMatrix(); smokeMesh.current.setMatrixAt(i, o.matrix);
    });

    // ── Scorch marks fade over ~15 s ──
    scorches.forEach((sc, i) => {
      const m = R.scorch[i];
      if (!m || sc.life <= 0) return;
      sc.life -= dt / 15;
      m.material.opacity = Math.max(0, Math.min(1, sc.life * 3)) * 0.8;
      if (sc.life <= 0) m.visible = false;
    });

    // ── Flash light ──
    const fade = Math.exp(-dt * (5 - cycle.nightAmount * 2.2));            // lingers longer at night
    [light, glow].forEach((l) => { if (l.current && l.current.intensity > 0) l.current.intensity = l.current.intensity < 1 ? 0 : l.current.intensity * fade; });
  });

  return (
    <>
      <pointLight ref={light} color="#ff8a3a" intensity={0} distance={40} decay={1.4} />
      <pointLight ref={glow} color="#ff9a4a" intensity={0} distance={70} decay={1.1} />
      {balls.map((b, i) => (
        <group key={i}>
          <mesh ref={(m) => { refs.current.fire[i] = m; }} geometry={geometry} material={b.material} visible={false} frustumCulled={false} renderOrder={2} />
          <mesh ref={(m) => { refs.current.core[i] = m; }} geometry={geometry} material={b.core} visible={false} frustumCulled={false} renderOrder={3} />
          <mesh ref={(m) => { refs.current.ring[i] = m; }} geometry={ringGeo} material={b.ring} visible={false} frustumCulled={false} renderOrder={3} />
        </group>
      ))}
      {scorches.map((_, i) => (
        <mesh key={i} ref={(m) => { refs.current.scorch[i] = m; }} rotation-x={-Math.PI / 2} visible={false} renderOrder={1}>
          <circleGeometry args={[0.5, 32]} />
          <meshBasicMaterial color="#120c0c" alphaMap={scorchTex} transparent opacity={0.8} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
      <instancedMesh ref={debrisMesh} args={[undefined, undefined, DEBRIS]} frustumCulled={false} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={emberMesh} args={[undefined, undefined, EMBERS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={emberColor} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={smokeMesh} args={[undefined, undefined, SMOKE]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <CameraShake camera={camera} />
    </>
  );
}

// Camera shake: nudges the camera after the chase camera has placed it this frame
export const shake = { amount: 0 };
function CameraShake({ camera }) {
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    if (shake.amount < 0.001) return;
    const t = st.clock.elapsedTime * 60, a = shake.amount * shake.amount * 0.9;
    camera.position.x += Math.sin(t * 1.3) * a;
    camera.position.y += Math.sin(t * 1.7 + 1) * a * 0.7;
    camera.position.z += Math.cos(t * 1.1 + 2) * a;
    shake.amount *= Math.exp(-dt * 4.5);
  });
  return null;
}

// ── Scattered all over the island: small clusters off the roads, out of the water and away
// from the spawn and the areas; some single, some side by side, some stacked ──
export function Bombs({ count = 26 }) {
  const items = useMemo(() => {
    const r = rng(404), out = [], centres = [];
    for (let tries = 0; tries < 900 && centres.length < count; tries++) {
      const a = r() * Math.PI * 2, d = 26 + r() * (ISLAND_R - 46);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (nearRoad(x, z, 2.5) || terrain.depth(x, z) > 0.02) continue;
      if (Math.hypot(x - SPAWN_POS[0], z - SPAWN_POS[2]) < 26) continue;
      if (centres.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 14)) continue;
      centres.push([x, z]);
      const kind = Math.floor(r() * 3), yaw = r() * Math.PI;
      const sx = Math.cos(yaw) * 0.62, sz = -Math.sin(yaw) * 0.62;
      if (kind === 0) out.push({ p: [x, 0.6, z], r: yaw });
      else {
        out.push({ p: [x - sx, 0.6, z - sz], r: yaw }, { p: [x + sx, 0.6, z + sz], r: yaw });
        if (kind === 2) out.push({ p: [x, 1.75, z], r: yaw + 0.3 });
      }
    }
    return out;
  }, [count]);
  return items.map((c, i) => <ExplosiveCrate key={i} position={c.p} rotation={c.r} />);
}
