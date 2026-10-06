"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { trailSamples, TRAIL_N, TRAIL_START, TRAIL_WIDTH, FORD_INDEX, nearestTrailIndex } from "./trailData";
import { Ramp } from "./Atmosphere";
import { ExplosiveCrate } from "./Bombs";
import { BrickWall, Fences, Lanterns, PoleLights } from "./bruno";
import { Dynamic, model, SCALE } from "./kit";
import { FONT, GroundText } from "./Props";
import { sfx } from "./sound";

// ───────── Adventure trail: obstacles, start arch and lap timing ─────────
// The trail surface itself is painted into the terrain (slab paving, like Bruno Simon's paths).
const at = (i) => trailSamples[((i % TRAIL_N) + TRAIL_N) % TRAIL_N];
const yawAlong = (s) => Math.atan2(-s.t.x, -s.t.z);   // a ramp rising in the travel direction
const yawAcross = (s) => Math.atan2(-s.n.z, s.n.x);   // BrickWall runs along (cos r, -sin r)
const off = (s, side) => [s.p.x + s.n.x * side, s.p.z + s.n.z * side];

// Obstacles every ~75 m, skipping the start straight and the water crossing
const KINDS = ["ramp", "bricks", "crates", "cones", "ramp", "fences", "bricks", "crates"];
function layout() {
  const out = [];
  let k = 0;
  for (let i = TRAIL_START + 45; i < TRAIL_START + TRAIL_N - 30; i += 50) {
    const idx = i % TRAIL_N;
    if (Math.abs(idx - FORD_INDEX) < 22) continue;
    out.push({ kind: KINDS[k++ % KINDS.length], i: idx });
  }
  return out;
}

function Obstacle({ kind, i }) {
  const s = at(i);
  if (kind === "ramp") return <Ramp position={[s.p.x, 0, s.p.z]} rotationY={yawAlong(s)} length={7} width={6} angle={0.28} />;
  if (kind === "bricks") {
    // half-width walls on alternating sides: a slalom
    const a = off(at(i), -2.3), b = off(at(i + 9), 2.3);
    return (
      <>
        <BrickWall position={[a[0], 0, a[1]]} rotation={yawAcross(at(i))} width={3} rows={2} />
        <BrickWall position={[b[0], 0, b[1]]} rotation={yawAcross(at(i + 9))} width={3} rows={2} />
      </>
    );
  }
  if (kind === "crates") {
    const p = off(s, 1.5), q = off(s, -1.6);
    return (
      <>
        <ExplosiveCrate position={[p[0], 0.6, p[1]]} />
        <ExplosiveCrate position={[p[0] + 0.2, 1.75, p[1] + 0.1]} />
        <ExplosiveCrate position={[q[0], 0.6, q[1]]} />
      </>
    );
  }
  if (kind === "cones") {
    return [0, 1, 2, 3, 4, 5].map((j) => {
      const c = at(i + j * 4), p = off(c, j % 2 ? 2 : -2);
      return <Dynamic key={j} url={model("roads", "construction-cone")} position={[p[0], 0.05, p[1]]} scale={SCALE.roads} density={0.15} />;
    });
  }
  if (kind === "fences") {
    // a fence gate squeezing the trail from both sides
    const l1 = off(at(i), TRAIL_WIDTH / 2), l2 = off(at(i), 1.6), r1 = off(at(i + 6), -TRAIL_WIDTH / 2), r2 = off(at(i + 6), -1.6);
    return (
      <>
        <Fences from={l1} to={l2} />
        <Fences from={r1} to={r2} />
      </>
    );
  }
  return null;
}

// Start / finish arch across the trail
function StartArch() {
  const s = at(TRAIL_START), yaw = Math.atan2(s.n.x, s.n.z);
  const half = TRAIL_WIDTH / 2 + 0.8;
  return (
    <group position={[s.p.x, 0, s.p.z]} rotation-y={yaw}>
      <RigidBody type="fixed" colliders={false}>
        {[-half, half].map((x) => <CuboidCollider key={x} args={[0.3, 2.5, 0.3]} position={[x, 2.5, 0]} />)}
      </RigidBody>
      {[-half, half].map((x) => (
        <mesh key={x} position={[x, 2.5, 0]} castShadow><boxGeometry args={[0.5, 5, 0.5]} /><meshLambertMaterial color="#5a2d2a" /></mesh>
      ))}
      <mesh position={[0, 5.1, 0]} castShadow><boxGeometry args={[half * 2 + 0.9, 1.3, 0.35]} /><meshLambertMaterial color="#c2702a" /></mesh>
      <Text position={[0, 5.15, 0.19]} font={FONT} fontSize={0.62} color="#fff3ea" anchorX="center" anchorY="middle">ADVENTURE TRAIL</Text>
      <Text position={[0, 5.15, -0.19]} rotation-y={Math.PI} font={FONT} fontSize={0.62} color="#fff3ea" anchorX="center" anchorY="middle">ADVENTURE TRAIL</Text>
      {/* chequered line on the ground */}
      {Array.from({ length: 9 }, (_, k) => (
        <mesh key={k} position={[-TRAIL_WIDTH / 2 + 0.5 + k, 0.03, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[1, 0.9]} />
          <meshLambertMaterial color={k % 2 ? "#1d1b1d" : "#fff6ef"} />
        </mesh>
      ))}
    </group>
  );
}

// Lap timer for the trail: same rules as the circuit (start → two sectors → line)
function TrailTimer({ carRef, trailRef }) {
  const st = useRef({ idx: -1, sector: 0, started: false, t0: 0 });
  useFrame(() => {
    const rb = carRef.current;
    if (!rb) return;
    const p = rb.translation();
    const { i, d } = nearestTrailIndex(p.x, p.z, st.current.idx);
    const s = st.current, L = trailRef.current;
    L.onTrack = d < TRAIL_WIDTH / 2 + 2;
    const rel = (i - TRAIL_START + TRAIL_N) % TRAIL_N;
    const prevRel = s.idx < 0 ? rel : (s.idx - TRAIL_START + TRAIL_N) % TRAIL_N;
    s.idx = i;
    const crossed = prevRel > TRAIL_N * 0.9 && rel < TRAIL_N * 0.1 && d < TRAIL_WIDTH / 2 + 3;
    const now = performance.now();
    if (crossed) {
      if (s.started && s.sector === 2) {
        const lap = (now - s.t0) / 1000;
        L.last = lap; L.best = L.best ? Math.min(L.best, lap) : lap; L.laps += 1; L.flash = now;
        sfx.chime();
      }
      s.started = true; s.t0 = now; s.sector = 0;
    }
    if (s.started) {
      if (s.sector === 0 && rel > TRAIL_N / 3 && rel < TRAIL_N / 2) s.sector = 1;
      if (s.sector === 1 && rel > (2 * TRAIL_N) / 3 && rel < TRAIL_N * 0.85) s.sector = 2;
      L.current = (now - s.t0) / 1000;
    }
    L.started = s.started; L.sector = s.sector;
  });
  return null;
}

export default function Trail({ carRef, trailRef }) {
  const obstacles = useMemo(layout, []);
  // Lanterns every ~45 m along the outside edge, pole lights at the start
  const lanterns = useMemo(() => {
    const out = [];
    for (let i = 0; i < TRAIL_N; i += 30) {
      if (Math.abs(i - FORD_INDEX) < 10) continue;
      const s = at(i), side = (s.n.x * s.p.x + s.n.z * s.p.z) > 0 ? 1 : -1; // outer side
      const [x, z] = off(s, side * (TRAIL_WIDTH / 2 + 1.4));
      out.push({ p: [x, 0, z], r: i });
    }
    return out;
  }, []);
  const [lx, lz] = off(at(TRAIL_START), TRAIL_WIDTH / 2 + 2.5);
  const ford = at(FORD_INDEX);
  return (
    <group>
      <StartArch />
      <PoleLights items={[{ p: [lx, 0, lz], r: 0 }]} lights={0} />
      <Lanterns items={lanterns} />
      {obstacles.map((o) => <Obstacle key={o.i} {...o} />)}
      <GroundText position={[ford.p.x - ford.t.x * 12, 0, ford.p.z - ford.t.z * 12]} size={0.7} rotation={Math.atan2(ford.t.x, ford.t.z) + Math.PI}>SPLASH!</GroundText>
      <TrailTimer carRef={carRef} trailRef={trailRef} />
    </group>
  );
}
