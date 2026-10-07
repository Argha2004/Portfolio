"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { BRIDGES } from "./riverData";

// ───────── Bridges over the river (riverData.js) ─────────
// The river itself is carved into the terrain (terrain.js), so the island's water surface fills
// it. Here: a concrete road bridge carrying the north avenue, and small arched wooden bridges.

const CONCRETE = "#d6cec6", CONCRETE_DARK = "#a99f97", CAP = "#efe8e1";

// The avenue's road tiles stay where they are and become the deck surface; this adds the slab
// under them, parapets along both sides and a pier in the water. Flat, so traffic just rolls on.
function RoadBridge({ b }) {
  const half = b.width / 2, L = b.len;
  return (
    <group position={[b.x, 0, b.z]} rotation-y={b.yaw}>
      <RigidBody type="fixed" colliders={false}>
        {/* deck: top flush with the road */}
        <CuboidCollider args={[half, 0.4, L / 2]} position={[0, -0.4, 0]} />
        {/* parapets (taller than they look, so a blast can't throw the car over) */}
        {[-1, 1].map((s) => <CuboidCollider key={s} args={[0.2, 1.1, L / 2]} position={[s * (half - 0.2), 1.1, 0]} />)}
      </RigidBody>
      <mesh position={[0, -0.45, 0]} receiveShadow castShadow><boxGeometry args={[b.width, 0.9, L]} /><meshStandardMaterial color={CONCRETE} roughness={0.9} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s} position-x={s * (half - 0.2)}>
          <mesh position-y={0.35} castShadow receiveShadow><boxGeometry args={[0.4, 0.7, L]} /><meshStandardMaterial color={CONCRETE} roughness={0.85} /></mesh>
          <mesh position-y={0.74} castShadow><boxGeometry args={[0.5, 0.1, L + 0.1]} /><meshStandardMaterial color={CAP} roughness={0.7} /></mesh>
        </group>
      ))}
      {/* pier in the middle of the river and abutments at the banks */}
      <mesh position={[0, -1.3, 0]} castShadow><boxGeometry args={[b.width - 1.6, 1.8, 1.2]} /><meshStandardMaterial color={CONCRETE_DARK} roughness={0.9} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, -0.9, s * (L / 2 - 0.6)]}><boxGeometry args={[b.width + 0.2, 1.2, 1.2]} /><meshStandardMaterial color={CONCRETE_DARK} roughness={0.9} /></mesh>
      ))}
    </group>
  );
}

// A small arched wooden bridge: planks over two stringers, posts and handrails both sides.
// The deck is a gentle parabola (≈17° at the ends), so the car drives straight over it.
const ARCH = 1.2, SEGMENTS = 12, PLANK = 0.5;
const WOOD = ["#b9824f", "#a8723f", "#c48d58"], WOOD_DARK = "#7b5130", RAIL = "#8f5f37";
function archY(s, L) { const k = (2 * s) / L; return ARCH * (1 - k * k); }

function WoodBridge({ b }) {
  const W = b.width, L = b.len, half = W / 2;
  const { segs, planks, posts, rails } = useMemo(() => {
    const segs = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const s0 = -L / 2 + (i / SEGMENTS) * L, s1 = s0 + L / SEGMENTS;
      const y0 = archY(s0, L), y1 = archY(s1, L);
      segs.push({ s: (s0 + s1) / 2, y: (y0 + y1) / 2, len: Math.hypot(s1 - s0, y1 - y0), a: Math.atan2(y1 - y0, s1 - s0) });
    }
    const planks = [];
    for (let s = -L / 2 + PLANK / 2; s < L / 2; s += PLANK) {
      const d = 0.02, a = Math.atan2(archY(s + d, L) - archY(s - d, L), 2 * d);
      planks.push({ s, y: archY(s, L) - 0.09, a });
    }
    const posts = [];
    for (let s = -L / 2 + 0.6; s <= L / 2 - 0.5; s += (L - 1.2) / 6) for (const side of [-1, 1]) posts.push({ x: side * (half - 0.12), s, y: archY(s, L) });
    const rails = segs.flatMap((g) => [-1, 1].map((side) => ({ ...g, x: side * (half - 0.12) })));
    return { segs, planks, posts, rails };
  }, [L, half]);

  const plankRef = useRef(), postRef = useRef(), railRef = useRef(), beamRef = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    planks.forEach((p, i) => {
      plankRef.current.setMatrixAt(i, m.compose(v.set(0, p.y, p.s), q.setFromEuler(e.set(-p.a, 0, 0)), one));
      plankRef.current.setColorAt(i, c.set(WOOD[i % WOOD.length]));
    });
    posts.forEach((p, i) => postRef.current.setMatrixAt(i, m.compose(v.set(p.x, p.y + 0.45, p.s), q.identity(), one)));
    rails.forEach((r, i) => railRef.current.setMatrixAt(i, m.compose(v.set(r.x, r.y + 0.95, r.s), q.setFromEuler(e.set(-r.a, 0, 0)), new THREE.Vector3(1, 1, r.len))));
    segs.forEach((g, i) => [-1, 1].forEach((side, k) =>
      beamRef.current.setMatrixAt(i * 2 + k, m.compose(v.set(side * (half - 0.5), g.y - 0.3, g.s), q.setFromEuler(e.set(-g.a, 0, 0)), new THREE.Vector3(1, 1, g.len)))));
    [plankRef, postRef, railRef, beamRef].forEach((r) => { r.current.instanceMatrix.needsUpdate = true; r.current.computeBoundingSphere(); });
    plankRef.current.instanceColor.needsUpdate = true;
  }, [segs, planks, posts, rails, half]);

  return (
    <group position={[b.x, 0, b.z]} rotation-y={b.yaw}>
      <RigidBody type="fixed" colliders={false}>
        {segs.map((g, i) => (
          <CuboidCollider key={`d${i}`} args={[half, 0.15, g.len / 2 + 0.02]} position={[0, g.y - 0.15, g.s]} rotation={[-g.a, 0, 0]} />
        ))}
        {/* handrails keep the car on the deck */}
        {segs.flatMap((g, i) => [-1, 1].map((side) => (
          <CuboidCollider key={`r${i}${side}`} args={[0.1, 0.55, g.len / 2]} position={[side * (half - 0.12), g.y + 0.55, g.s]} rotation={[-g.a, 0, 0]} />
        )))}
      </RigidBody>
      <instancedMesh ref={plankRef} args={[undefined, undefined, planks.length]} castShadow receiveShadow>
        <boxGeometry args={[W, 0.18, PLANK - 0.04]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={beamRef} args={[undefined, undefined, segs.length * 2]} castShadow>
        <boxGeometry args={[0.3, 0.4, 1]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={postRef} args={[undefined, undefined, posts.length]} castShadow>
        <boxGeometry args={[0.18, 0.95, 0.18]} />
        <meshStandardMaterial color={RAIL} roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={railRef} args={[undefined, undefined, rails.length]} castShadow>
        <boxGeometry args={[0.14, 0.12, 1.02]} />
        <meshStandardMaterial color={RAIL} roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

export default function Bridges() {
  return BRIDGES.map((b, i) => (b.kind === "road" ? <RoadBridge key={i} b={b} /> : <WoodBridge key={i} b={b} />));
}
