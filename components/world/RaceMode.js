"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import * as THREE from "three";
import { samples, SAMPLE_COUNT as N, TRACK_WIDTH, RUNOFF, BARRIER_OFFSET, START_INDEX, apexes } from "./trackData";
import { ExplosiveCrate } from "./Bombs";
import { BrickWall, Fences } from "./bruno";
import { Dynamic, model, SCALE, rng } from "./kit";

// ───────── Race mode ─────────
// Switched on by "Race track → Go". The whole circuit gets a closed boundary (walls on both sides,
// the avenue openings shut, an invisible fence above them so a blast can't throw the car out) and
// the track itself fills with challenges: lines of big bombs, bomb fields, cone slaloms, brick walls,
// pushable barrier chicanes, fence gates and moving traps (sliding blocks, swinging sweeper arms,
// pendulum hammers under a gantry, pistons popping out of the road and spinning bars).
// The parent remounts this for every new race, so everything is back in place each time.
const HW = TRACK_WIDTH / 2;
const at = (i) => samples[((Math.round(i) % N) + N) % N];
const gapOf = (i, j) => Math.min(Math.abs(i - j), N - Math.abs(i - j));
const along = (s) => Math.atan2(-s.t.z, s.t.x);    // BrickWall / crate rows run along (cos r, −sin r)
const across = (s) => Math.atan2(-s.n.z, s.n.x);   // ...and this runs them across the track
const lat = (s, d) => [s.p.x + s.n.x * d, s.p.z + s.n.z * d];
const RED = new THREE.Color("#d8231c"), WHITE = new THREE.Color("#f6f1ea");

// ── Boundary ──
// Both sides follow the circuit at the barrier line. Where that line folds back over the track (the
// inside of hairpins and tight chicanes) its points are dropped and the wall bridges straight
// across; where it would stand in another part's run-off (the switchback strands) or the regular
// barrier already stands, it stops. Then it's cut into ~3 m segments.
function boundarySegments() {
  const segs = [];
  for (const side of [1, -1]) {
    const pts = samples.map((sm, i) => {
      const [x, z] = lat(sm, side * BARRIER_OFFSET);
      let near = Infinity, clash = false;
      for (let j = 0; j < N; j += 2) {
        const q = samples[j].p, d2 = (q.x - x) ** 2 + (q.z - z) ** 2;
        if (gapOf(i, j) < 60) near = Math.min(near, d2);
        else if (d2 < (TRACK_WIDTH / 2 + RUNOFF + 0.4) ** 2) clash = true;
      }
      const existing = side === sm.out && sm.wall;
      return { x, z, stop: existing || clash, fold: Math.sqrt(near) < BARRIER_OFFSET - 0.6 };
    });
    const emit = (a, p) => {
      const len = Math.hypot(p.x - a.x, p.z - a.z);
      if (len > 0.3) segs.push({ x: (a.x + p.x) / 2, z: (a.z + p.z) / 2, len: len + 0.1, yaw: Math.atan2(p.x - a.x, p.z - a.z), red: segs.length % 2 === 0 });
    };
    // start the walk where a chain breaks (or anywhere if it never does) and go once round
    const s0 = Math.max(0, pts.findIndex((p) => p.stop));
    // (a chain starts and ends ON the neighbouring stop points, so it meets the barrier there)
    let a = null, last = null, prevStop = null;
    for (let k = 0; k <= N; k++) {
      const p = pts[(s0 + k) % N];
      if (p.stop) { if (a) emit(a, p); a = last = null; prevStop = p; continue; }
      if (p.fold) continue; // bridged over
      if (!a) { a = prevStop || p; last = p; if (a === p) continue; }
      last = p;
      if (Math.hypot(p.x - a.x, p.z - a.z) >= 3) { emit(a, p); a = p; }
      prevStop = null;
    }
    if (a && last && last !== a) emit(a, last);
  }
  return segs;
}

function Boundary() {
  const segs = useMemo(boundarySegments, []);
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    segs.forEach((s, i) => {
      ref.current.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, 0.55, s.z), q.setFromAxisAngle(up, s.yaw), new THREE.Vector3(1, 1, s.len / 3)));
      ref.current.setColorAt(i, s.red ? RED : WHITE);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [segs]);
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, segs.length]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.1, 3]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <RigidBody type="fixed" colliders={false}>
        {/* 4 m tall: the visible wall plus an invisible fence above it */}
        {segs.map((s, i) => <CuboidCollider key={i} args={[0.25, 2, s.len / 2]} position={[s.x, 2, s.z]} rotation={[0, s.yaw, 0]} />)}
      </RigidBody>
    </group>
  );
}

// ── Moving traps ──
const YELLOW = "#f2c230", INK = "#2b2730", TRAP_RED = "#e5423a", TRAP_WHITE = "#f6f1ea";
const yawOf = (s) => Math.atan2(s.t.x, s.t.z); // local +Z along the track, +X across it

// A big padded block that slides from one side of the track to the other
function Slider({ i, speed = 1.1, phase = 0 }) {
  const s = at(i), body = useRef(), v = useMemo(() => new THREE.Vector3(), []);
  const W = 4.6, H = 2.4, D = 2.4, reach = HW - W / 2 - 0.2;
  useFrame((st) => {
    const b = body.current;
    if (!b) return;
    const d = Math.sin(st.clock.elapsedTime * speed + phase) * reach;
    v.set(s.p.x + s.n.x * d, H / 2, s.p.z + s.n.z * d);
    b.setNextKinematicTranslation(v);
  });
  return (
    <>
      {/* rails along each side of its path */}
      {[-1, 1].map((e) => {
        const p = lat(at(i + e * 1.6), 0);
        return <mesh key={e} position={[p[0], 0.05, p[1]]} rotation={[0, across(s), 0]} receiveShadow><boxGeometry args={[TRACK_WIDTH, 0.06, 0.3]} /><meshStandardMaterial color={YELLOW} /></mesh>;
      })}
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[s.p.x, H / 2, s.p.z]} rotation={[0, yawOf(s), 0]}>
        <CuboidCollider args={[W / 2, H / 2, D / 2]} />
        <mesh castShadow receiveShadow><boxGeometry args={[W, H, D]} /><meshStandardMaterial color={YELLOW} roughness={0.6} /></mesh>
        {[-1.5, 0, 1.5].map((x) => (
          <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[0.45, H + 0.02, D + 0.02]} /><meshStandardMaterial color={INK} roughness={0.6} /></mesh>
        ))}
      </RigidBody>
    </>
  );
}

// A post on one edge of the track with a long, thick arm swinging to and fro across it (a half
// circle on the track side only, so it never reaches through the boundary)
function Sweeper({ i, side = 1, speed = 0.9 }) {
  const s = at(i), body = useRef(), q = useMemo(() => new THREE.Quaternion(), []), up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const pivot = lat(s, side * (HW + 0.9));
  const base = Math.atan2(side * s.n.z, -side * s.n.x); // arm (local +X) pointing at the far side
  useFrame((st) => {
    if (body.current) body.current.setNextKinematicRotation(q.setFromAxisAngle(up, base + Math.sin(st.clock.elapsedTime * speed) * 1.35));
  });
  const ARM = TRACK_WIDTH * 0.85;
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[pivot[0], 0, pivot[1]]}>
        <CylinderCollider args={[1.6, 0.75]} position={[0, 1.6, 0]} />
        <mesh position-y={1.6} castShadow><cylinderGeometry args={[0.75, 0.9, 3.2, 18]} /><meshStandardMaterial color={INK} roughness={0.6} /></mesh>
      </RigidBody>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[pivot[0], 1.2, pivot[1]]} rotation={[0, base, 0]}>
        <CuboidCollider args={[ARM / 2, 0.6, 0.5]} position={[ARM / 2, 0, 0]} />
        <mesh position={[ARM / 2, 0, 0]} castShadow><boxGeometry args={[ARM, 1.2, 1]} /><meshStandardMaterial color={TRAP_RED} roughness={0.6} /></mesh>
        {Array.from({ length: 5 }, (_, k) => (
          <mesh key={k} position={[1.4 + k * (ARM - 2) / 4, 0, 0]}><boxGeometry args={[0.5, 1.22, 1.02]} /><meshStandardMaterial color={TRAP_WHITE} /></mesh>
        ))}
      </RigidBody>
    </group>
  );
}

// A gantry over the track with a heavy hammer swinging from side to side under it
function Hammer({ i, speed = 1.3, phase = 0 }) {
  const s = at(i), body = useRef();
  const PIVOT_Y = 7.4, ROD = 5.6, HEAD = 2.6;
  const { qYaw, q, qs, axis } = useMemo(() => ({
    qYaw: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawOf(s)),
    q: new THREE.Quaternion(), qs: new THREE.Quaternion(), axis: new THREE.Vector3(0, 0, 1),
  }), [s]);
  useFrame((st) => {
    if (!body.current) return;
    qs.setFromAxisAngle(axis, Math.sin(st.clock.elapsedTime * speed + phase) * 1.05); // swing across the track
    body.current.setNextKinematicRotation(q.copy(qYaw).multiply(qs));
  });
  const post = HW + 1.4;
  return (
    <group>
      <group position={[s.p.x, 0, s.p.z]} rotation-y={yawOf(s)}>
        <RigidBody type="fixed" colliders={false}>
          {[-post, post].map((x) => <CuboidCollider key={x} args={[0.4, PIVOT_Y / 2 + 0.4, 0.4]} position={[x, PIVOT_Y / 2 + 0.4, 0]} />)}
        </RigidBody>
        {[-post, post].map((x) => (
          <mesh key={x} position={[x, PIVOT_Y / 2 + 0.4, 0]} castShadow><boxGeometry args={[0.8, PIVOT_Y + 0.8, 0.8]} /><meshStandardMaterial color={INK} roughness={0.6} /></mesh>
        ))}
        <mesh position={[0, PIVOT_Y + 0.6, 0]} castShadow><boxGeometry args={[post * 2 + 0.8, 0.8, 0.9]} /><meshStandardMaterial color={TRAP_RED} roughness={0.6} /></mesh>
      </group>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[s.p.x, PIVOT_Y, s.p.z]} rotation={[0, yawOf(s), 0]}>
        <mesh position={[0, -ROD / 2, 0]} castShadow><cylinderGeometry args={[0.14, 0.14, ROD, 10]} /><meshStandardMaterial color="#8a8590" metalness={0.4} roughness={0.4} /></mesh>
        <CuboidCollider args={[HEAD / 2, HEAD / 2, HEAD / 2]} position={[0, -ROD - HEAD / 2 + 0.9, 0]} />
        <mesh position={[0, -ROD - HEAD / 2 + 0.9, 0]} castShadow><boxGeometry args={[HEAD, HEAD, HEAD]} /><meshStandardMaterial color={TRAP_RED} roughness={0.55} /></mesh>
        <mesh position={[0, -ROD - HEAD / 2 + 0.9, 0]}><boxGeometry args={[HEAD + 0.02, 0.5, HEAD + 0.02]} /><meshStandardMaterial color={TRAP_WHITE} /></mesh>
      </RigidBody>
    </group>
  );
}

// One of three blocks across the track that pop out of the road and sink back in turn
function Piston({ i, lane, speed = 1.6, phase = 0 }) {
  const s = at(i), body = useRef(), v = useMemo(() => new THREE.Vector3(), []);
  const W = 3.2, H = 2.6, D = 3;
  const [x, z] = lat(s, lane);
  useFrame((st) => {
    if (!body.current) return;
    // mostly fully up or fully down, with a quick move between
    const k = THREE.MathUtils.smoothstep(Math.sin(st.clock.elapsedTime * speed + phase), -0.35, 0.35);
    v.set(x, -H / 2 - 0.15 + k * (H + 0.1), z);
    body.current.setNextKinematicTranslation(v);
  });
  return (
    <>
      <mesh position={[x, 0.045, z]} rotation={[-Math.PI / 2, 0, yawOf(s)]} receiveShadow><planeGeometry args={[W + 0.5, D + 0.5]} /><meshStandardMaterial color={INK} roughness={0.8} /></mesh>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[x, -H / 2, z]} rotation={[0, yawOf(s), 0]}>
        <CuboidCollider args={[W / 2, H / 2, D / 2]} />
        <mesh castShadow receiveShadow><boxGeometry args={[W, H, D]} /><meshStandardMaterial color={YELLOW} roughness={0.6} /></mesh>
        <mesh position-y={H / 2 - 0.3}><boxGeometry args={[W + 0.02, 0.4, D + 0.02]} /><meshStandardMaterial color={INK} /></mesh>
      </RigidBody>
    </>
  );
}

// A long bar spinning flat in the middle of the track: slip past while it lines up with the road
function Spinner({ i, speed = 1.2 }) {
  const s = at(i), body = useRef(), q = useMemo(() => new THREE.Quaternion(), []), up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const L = TRACK_WIDTH - 2.6;
  useFrame((st) => {
    if (body.current) body.current.setNextKinematicRotation(q.setFromAxisAngle(up, yawOf(s) + st.clock.elapsedTime * speed));
  });
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[s.p.x, 0, s.p.z]}>
        <CylinderCollider args={[1.1, 0.7]} position={[0, 1.1, 0]} />
        <mesh position-y={1.1} castShadow><cylinderGeometry args={[0.7, 0.85, 2.2, 18]} /><meshStandardMaterial color={INK} roughness={0.6} /></mesh>
      </RigidBody>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[s.p.x, 1.25, s.p.z]}>
        <CuboidCollider args={[L / 2, 0.55, 0.45]} />
        <mesh castShadow><boxGeometry args={[L, 1.1, 0.9]} /><meshStandardMaterial color={YELLOW} roughness={0.6} /></mesh>
        {[-1, 1].map((e) => <mesh key={e} position={[e * (L / 2 - 0.5), 0, 0]}><boxGeometry args={[1, 1.12, 0.92]} /><meshStandardMaterial color={INK} /></mesh>)}
      </RigidBody>
    </group>
  );
}

// ── Layout of the on-track challenges ──
const CS = 1.7;                       // race crates are 1.7× the island's ones
const LANES = [-HW + 2, 0, HW - 2];
function challenges(seed) {
  const r = rng(seed);
  const out = { crates: [], cones: [], walls: [], barriers: [], fences: [], sliders: [], sweepers: [], hammers: [], pistons: [], spinners: [] };
  const nearApex = (i, w) => apexes.some((a) => gapOf(a.i, i) < w);
  // sliders, sweepers, walls, chicanes and gates want a real straight; hammers, pistons and spinners
  // are happy on a gentle curve
  const straight = (i, gentle) => { const w = gentle ? 8 : 12, kmax = gentle ? 1 / 30 : 1 / 45; for (let d = -w; d <= w; d++) if (at(i + d).k > kmax) return false; return true; };
  const GENTLE = new Set(["hammer", "pistons", "spinner"]);
  const crate = (p, rot) => out.crates.push({ p: [p[0], 0.6 * CS, p[1]], r: rot });
  // a cycle of every kind; the big ones need a straight, so they move up the track a little to
  // find one, or swap for a bombs/cones one in a corner
  const KINDS = ["slider", "hammer", "crateLine", "pistons", "sweeper", "spinner", "bombField", "doubleSlider", "hammer",
    "wall", "pistons", "spinner", "cones", "sweeper", "chicane", "slider", "fenceGate", "hammer"];
  const NEEDS_STRAIGHT = new Set(["slider", "doubleSlider", "sweeper", "hammer", "pistons", "spinner", "wall", "chicane", "fenceGate"]);
  const CORNER_KINDS = ["crateLine", "bombField", "cones"];
  let ki = 0, kc = 0;
  for (let i = START_INDEX + 60; i < START_INDEX + N - 40; i += 36) {
    if (nearApex(i, 8)) i += 10; // never right on an apex
    let kind = KINDS[ki % KINDS.length];
    if (NEEDS_STRAIGHT.has(kind)) {
      let d = 0;
      while (d <= 22 && !straight(i + d, GENTLE.has(kind))) d++;
      if (d <= 22) { i += d; ki++; } else kind = CORNER_KINDS[kc++ % CORNER_KINDS.length];
    } else ki++;
    if (i >= START_INDEX + N - 40) break; // (keep the run-up to the line clear)
    const s = at(i);
    if (kind === "crateLine") {
      // big crates in five slots across the track with a two-slot gap: aim for it or blow through
      const gap = Math.floor(r() * 4);
      for (let k = 0; k < 5; k++) if (k !== gap && k !== gap + 1) crate(lat(s, (k - 2) * 2.2), along(s));
    } else if (kind === "bombField") {
      for (let k = 0; k < 7; k++) crate(lat(at(i + (k - 3) * 4.5), (r() - 0.5) * (TRACK_WIDTH - 3)), r() * Math.PI);
    } else if (kind === "cones") {
      for (let k = 0; k < 8; k++) out.cones.push(lat(at(i + (k - 3.5) * 4.5), (k % 2 ? 1 : -1) * 2));
    } else if (kind === "wall") {
      // a big brick wall across more than half the track: smash through or squeeze round
      const side = r() < 0.5 ? 1 : -1;
      out.walls.push({ p: lat(s, side * HW * 0.42), r: across(s) });
    } else if (kind === "chicane") {
      // big pushable barriers from alternate sides
      [-1, 1].forEach((side, k) => {
        const c = at(i + k * 12);
        [HW - 1.5, HW - 4.5].forEach((d) => out.barriers.push({ p: lat(c, side * d), r: along(c) }));
      });
    } else if (kind === "fenceGate") {
      // fences squeezing the track to a gap in the middle (they topple when hit)
      out.fences.push({ from: lat(s, -HW), to: lat(s, -2.2) }, { from: lat(at(i + 6), HW), to: lat(at(i + 6), 2.2) });
    } else if (kind === "slider") out.sliders.push({ i, speed: 0.9 + r() * 0.5, phase: r() * 6 });
    else if (kind === "doubleSlider") {
      const sp = 1 + r() * 0.4, ph = r() * 6;
      out.sliders.push({ i, speed: sp, phase: ph }, { i: i + 9, speed: sp, phase: ph + Math.PI });
    } else if (kind === "sweeper") out.sweepers.push({ i, side: r() < 0.5 ? 1 : -1, speed: 0.7 + r() * 0.4 });
    else if (kind === "hammer") out.hammers.push({ i, speed: 1.1 + r() * 0.5, phase: r() * 6 });
    else if (kind === "pistons") {
      const sp = 1.3 + r() * 0.6, ph = r() * 6;
      LANES.forEach((lane, k) => out.pistons.push({ i, lane, speed: sp, phase: ph + k * 2.1 }));
    } else if (kind === "spinner") out.spinners.push({ i, speed: (r() < 0.5 ? 1 : -1) * (1 + r() * 0.5) });
  }
  return out;
}

export default function RaceMode({ seed = 1 }) {
  const c = useMemo(() => challenges(900 + seed), [seed]);
  return (
    <group>
      <Boundary />
      {c.crates.map((k, i) => <ExplosiveCrate key={`c${i}`} position={k.p} rotation={k.r} scale={CS} />)}
      {c.cones.map((p, i) => <Dynamic key={`k${i}`} url={model("roads", "construction-cone")} position={[p[0], 0.05, p[1]]} scale={SCALE.roads * 1.8} density={0.15} />)}
      {c.walls.map((w, i) => <BrickWall key={`w${i}`} position={[w.p[0], 0, w.p[1]]} rotation={w.r} width={3} rows={4} scale={1.5} />)}
      {c.barriers.map((b, i) => <Dynamic key={`b${i}`} url={model("roads", "construction-barrier")} position={[b.p[0], 0.05, b.p[1]]} rotation={b.r} scale={SCALE.roads * 1.7} density={0.25} />)}
      {c.fences.map((f, i) => <Fences key={`f${i}`} from={f.from} to={f.to} />)}
      {c.sliders.map((s, i) => <Slider key={`s${i}`} {...s} />)}
      {c.sweepers.map((s, i) => <Sweeper key={`r${i}`} {...s} />)}
      {c.hammers.map((s, i) => <Hammer key={`h${i}`} {...s} />)}
      {c.pistons.map((s, i) => <Piston key={`p${i}`} {...s} />)}
      {c.spinners.map((s, i) => <Spinner key={`x${i}`} {...s} />)}
    </group>
  );
}
