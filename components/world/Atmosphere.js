"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

export function Ramp({ position, rotationY = 0, length = 6, width = 3.6, angle = 0.26 }) {
  const h = Math.sin(angle) * length;
  return (
    <group position={position} rotation-y={rotationY}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2, 0.15, length / 2]} position={[0, h / 2 - 0.1, 0]} rotation={[angle, 0, 0]} friction={0.9} />
      </RigidBody>
      <mesh position={[0, h / 2 - 0.1, 0]} rotation-x={angle} castShadow receiveShadow>
        <boxGeometry args={[width, 0.3, length]} />
        <meshStandardMaterial color="#fff1e4" roughness={0.8} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (width / 2 + 0.06), h / 2 - 0.05, 0]} rotation-x={angle} castShadow>
          <boxGeometry args={[0.12, 0.42, length]} />
          <meshStandardMaterial color="#e5423a" roughness={0.6} />
        </mesh>
      ))}
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
