"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, ConvexHullCollider } from "@react-three/rapier";
import * as THREE from "three";

// ───────── Jump ramp: a solid wedge (no floating slab), stripy deck, matching hull collider ─────────
// Low end at local +Z flush with the ground, high end at -Z; drive in from +Z.
function deckTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#3a2c3d"; g.fillRect(0, 0, 128, 256);
  // three orange chevrons pointing up the ramp, on a dark deck with cream edge bands
  g.fillStyle = "#ff8a3d";
  for (let k = 0; k < 3; k++) {
    const y = 40 + k * 70;
    g.beginPath(); g.moveTo(14, y + 40); g.lineTo(64, y); g.lineTo(114, y + 40); g.lineTo(114, y + 62); g.lineTo(64, y + 22); g.lineTo(14, y + 62); g.closePath(); g.fill();
  }
  g.fillStyle = "#fff1e4"; g.fillRect(0, 0, 10, 256); g.fillRect(118, 0, 10, 256);
  g.fillStyle = "#e5423a";
  for (let y = 0; y < 256; y += 32) { g.fillRect(0, y, 10, 16); g.fillRect(118, y, 10, 16); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
let deckTex = null;

export function Ramp({ position, rotationY = 0, length = 7, width = 4.2, angle = 0.3 }) {
  const { body, deck, hull, h } = useMemo(() => {
    const h = Math.tan(angle) * length, L = length / 2, W = width / 2;
    // Wedge body (both triangular sides, the back and the bottom), flat-shaded
    const v = [
      [-W, -0.02, L], [-W, h, -L], [-W, -0.02, -L],   // left side (facing -X)
      [W, -0.02, L], [W, -0.02, -L], [W, h, -L],      // right side (facing +X)
      [-W, -0.02, -L], [W, h, -L], [W, -0.02, -L], [-W, -0.02, -L], [-W, h, -L], [W, h, -L], // back (facing -Z)
    ].flat();
    const body = new THREE.BufferGeometry();
    body.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    body.computeVertexNormals();
    // Sloped deck with proper UVs (chevrons run up the slope)
    const deck = new THREE.PlaneGeometry(width, Math.hypot(length, h));
    deck.rotateX(-Math.PI / 2 + angle).translate(0, h / 2 + 0.005, 0);
    const hull = new Float32Array([-W, -0.02, L, W, -0.02, L, -W, -0.02, -L, W, -0.02, -L, -W, h, -L, W, h, -L]);
    return { body, deck, hull, h };
  }, [length, width, angle]);
  deckTex ||= deckTexture();
  return (
    <group position={position} rotation-y={rotationY}>
      <RigidBody type="fixed" colliders={false}>
        <ConvexHullCollider args={[hull]} friction={0.9} />
      </RigidBody>
      <mesh geometry={body} castShadow receiveShadow>
        <meshLambertMaterial color="#5a3f55" />
      </mesh>
      <mesh geometry={deck} castShadow receiveShadow>
        <meshLambertMaterial map={deckTex} />
      </mesh>
      {/* steel lip on the take-off edge */}
      <mesh position={[0, h - 0.04, -length / 2 + 0.06]} castShadow>
        <boxGeometry args={[width + 0.1, 0.12, 0.16]} />
        <meshLambertMaterial color="#d8d2cc" />
      </mesh>
    </group>
  );
}

// ───────── Exhaust puffs + tyre dust ─────────
const MAX_P = 90;
export function Particles({ carRef }) {
  const mesh = useRef();
  const parts = useMemo(() => Array.from({ length: MAX_P }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0, dust: false })), []);
  const next = useRef(0);
  const acc = useRef(0);
  const o = useMemo(() => new THREE.Object3D(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const emit = (pos, vel, size, life, dust) => {
    const pt = parts[next.current];
    next.current = (next.current + 1) % MAX_P;
    pt.p.copy(pos); pt.v.copy(vel); pt.s = size; pt.life = life; pt.max = life; pt.dust = dust;
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const rb = carRef.current, st = window.__carState;
    if (rb && st) {
      const t = rb.translation(), r = rb.rotation();
      q.set(r.x, r.y, r.z, r.w);
      acc.current += dt;
      const rate = st.throttle > 0 ? 0.035 : 0.12;
      while (acc.current > rate) {
        acc.current -= rate;
        // exhaust from the rear-left pipe
        const ex = new THREE.Vector3(-0.45, 0.35, 1.4).applyQuaternion(q).add(t);
        emit(ex, new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.4, 0.8).applyQuaternion(q), 0.12, 0.9, false);
        // dust from the rear tyres when sliding or boosting
        if (st.slip > 0.5 || (Math.abs(st.speed) > 12 && Math.random() < 0.4)) {
          [-0.8, 0.8].forEach((x) => {
            const w = new THREE.Vector3(x, 0.1, 0.9).applyQuaternion(q).add(t);
            emit(w, new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8 + Math.random(), (Math.random() - 0.5) * 1.2), 0.25, 1.1, true);
          });
        }
      }
    }
    const m = mesh.current;
    parts.forEach((pt, i) => {
      if (pt.life > 0) {
        pt.life -= dt;
        pt.p.addScaledVector(pt.v, dt);
        pt.v.multiplyScalar(1 - 1.5 * dt);
        const k = 1 - pt.life / pt.max;
        o.position.copy(pt.p);
        o.scale.setScalar(Math.max(pt.s * (1 + k * 3) * (1 - k * k), 0.0001));
        m.setColorAt(i, color.set(pt.dust ? "#f3c9a8" : "#ffffff"));
      } else o.scale.setScalar(0.0001);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_P]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={1} transparent opacity={0.75} flatShading />
    </instancedMesh>
  );
}
