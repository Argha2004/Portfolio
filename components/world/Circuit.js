"use client";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { samples, SAMPLE_COUNT as N, TRACK_WIDTH, RUNOFF, BARRIER_OFFSET, kerbAt, START_INDEX, nearestIndex, apexes } from "./trackData";
import { FONT, FONT_REG } from "./Props";
import { sfx } from "./sound";

const HW = TRACK_WIDTH / 2;
const KERB_W = 1.4;

// Build a ribbon that follows the circuit between two signed offsets from the centre line.
// `colorAt(i)` (optional) gives per-segment vertex colours; `include(i)` skips segments.
function ribbon({ from, to, y, uvScale = 1, colorAt, include }) {
  const pos = [], uv = [], col = [];
  const push = (v, u, vv, c) => { pos.push(v.x, y, v.z); uv.push(u, vv); if (c) col.push(c.r, c.g, c.b); };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    if (include && !include(i)) continue;
    const s0 = samples[i], s1 = samples[(i + 1) % N];
    a.copy(s0.p).addScaledVector(s0.n, from); b.copy(s0.p).addScaledVector(s0.n, to);
    c.copy(s1.p).addScaledVector(s1.n, from); d.copy(s1.p).addScaledVector(s1.n, to);
    const v0 = s0.s / uvScale, v1 = (s0.s + 1) / uvScale, color = colorAt?.(i);
    push(a, 0, v0, color); push(b, 1, v0, color); push(c, 0, v1, color);
    push(b, 1, v0, color); push(d, 1, v1, color); push(c, 0, v1, color);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (col.length) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// Grainy asphalt with faint tyre-rubbered racing line, drawn once on a canvas (also used by road connectors)
export function asphaltTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#4a474f"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 60 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 6},${Math.random() * 0.5})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.3, "rgba(20,18,22,0)"); grad.addColorStop(0.5, "rgba(20,18,22,.28)"); grad.addColorStop(0.7, "rgba(20,18,22,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function checkerTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 32;
  const g = c.getContext("2d");
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? "#111" : "#fafafa"; g.fillRect(x * 8, y * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const RED = new THREE.Color("#d8231c"), WHITE = new THREE.Color("#f6f1ea");
const GRASS = new THREE.Color("#93a33c"), GRAVEL = new THREE.Color("#f0d6a4");
const stripe = (i) => (Math.floor(samples[i].s / 1.6) % 2 ? RED : WHITE);

// ───────── Surfaces: asphalt, edge lines, kerbs, run-off ─────────
function Surfaces() {
  const { asphalt, lines, kerbs, runoff } = useMemo(() => ({
    asphalt: ribbon({ from: -HW, to: HW, y: 0.03, uvScale: 14 }),
    lines: [ribbon({ from: HW - 0.55, to: HW - 0.2, y: 0.04 }), ribbon({ from: -HW + 0.2, to: -HW + 0.55, y: 0.04 })],
    kerbs: [
      ribbon({ from: HW, to: HW + KERB_W, y: 0.06, colorAt: stripe, include: (i) => kerbAt[i] }),
      ribbon({ from: -HW - KERB_W, to: -HW, y: 0.06, colorAt: stripe, include: (i) => kerbAt[i] }),
    ],
    // run-off: grass strips beside the straights, gravel traps on the outside of every corner
    runoff: [
      ribbon({ from: HW, to: HW + RUNOFF, y: 0.02, colorAt: (i) => (kerbAt[i] && samples[i].turn === -1 ? GRAVEL : GRASS) }),
      ribbon({ from: -HW - RUNOFF, to: -HW, y: 0.02, colorAt: (i) => (kerbAt[i] && samples[i].turn === 1 ? GRAVEL : GRASS) }),
    ],
  }), []);
  const tex = useMemo(asphaltTexture, []);
  return (
    <group>
      <mesh geometry={asphalt} receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.92} />
      </mesh>
      {lines.map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color="#f7f2ea" roughness={0.6} /></mesh>)}
      {kerbs.map((g, i) => <mesh key={i} geometry={g} receiveShadow><meshStandardMaterial vertexColors roughness={0.55} /></mesh>)}
      {runoff.map((g, i) => <mesh key={i} geometry={g} receiveShadow><meshStandardMaterial vertexColors roughness={1} /></mesh>)}
    </group>
  );
}

// ───────── Barriers: red/white wall on the outside, tyre walls in the corners ─────────
function Barriers() {
  const { walls, tyres } = useMemo(() => {
    const walls = [], tyres = [];
    // spaced evenly along the barrier line itself (not the centre line): on the outside of a tight
    // corner that line is much longer, and pieces placed every 3 m of track left gaps between them
    let prev = null, acc = 0;
    const place = (p, i) => {
      const s = samples[i], yaw = Math.atan2(s.t.x, s.t.z);
      if (kerbAt[i]) tyres.push({ p, yaw }); else walls.push({ p, yaw, red: walls.length % 2 === 0 });
    };
    for (let i = 0; i < N; i++) {
      const s = samples[i];
      // (gaps for the avenues / access roads, and the switchback strands share one wall: see trackData)
      if (!s.wall) { prev = null; continue; }
      const p = s.p.clone().addScaledVector(s.n, s.out * BARRIER_OFFSET); // outside of the circuit
      if (!prev) { place(p, i); prev = p; acc = 0; continue; }
      let d = prev.distanceTo(p);
      while (acc + d >= 3) { // a piece exactly every 3 m along the line
        const q = prev.clone().lerp(p, (3 - acc) / d);
        place(q, i);
        prev = q; d = q.distanceTo(p); acc = 0;
      }
      acc += d; prev = p;
    }
    return { walls, tyres };
  }, []);
  const wallRef = useRef(), tyreRef = useRef(), bandRef = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1);
    walls.forEach((w, i) => {
      wallRef.current.setMatrixAt(i, m.compose(w.p.clone().setY(0.55), q.setFromAxisAngle(up, w.yaw), sc));
      wallRef.current.setColorAt(i, w.red ? RED : WHITE);
    });
    // Tyre walls: two stacked rows of three tyres per slot
    let k = 0;
    tyres.forEach((t) => {
      const across = new THREE.Vector3(Math.cos(t.yaw), 0, -Math.sin(t.yaw));
      for (const o of [-1, 0, 1]) for (const h of [0.25, 0.75]) {
        const p = t.p.clone().addScaledVector(across, o * 0.95).setY(h);
        tyreRef.current.setMatrixAt(k, m.compose(p, q.identity(), sc));
        bandRef.current.setMatrixAt(k, m.compose(p, q.identity(), sc));
        k++;
      }
    });
    [wallRef, tyreRef, bandRef].forEach((r) => { r.current.instanceMatrix.needsUpdate = true; r.current.computeBoundingSphere(); });
    if (wallRef.current.instanceColor) wallRef.current.instanceColor.needsUpdate = true;
  }, [walls, tyres]);

  const tyreCount = tyres.length * 6;
  return (
    <group>
      <instancedMesh ref={wallRef} args={[undefined, undefined, walls.length]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.1, 3.1]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={tyreRef} args={[undefined, undefined, tyreCount]} castShadow>
        <cylinderGeometry args={[0.48, 0.48, 0.5, 14]} />
        <meshStandardMaterial color="#1d1b1d" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={bandRef} args={[undefined, undefined, tyreCount]}>
        <cylinderGeometry args={[0.49, 0.49, 0.12, 14]} />
        <meshStandardMaterial color="#f6f1ea" roughness={0.6} />
      </instancedMesh>
      <RigidBody type="fixed" colliders={false}>
        {/* Thin collider for the wall, wider for the three-tyre stacks */}
        {walls.map((w, i) => <CuboidCollider key={`w${i}`} args={[0.25, 0.6, 1.6]} position={[w.p.x, 0.6, w.p.z]} rotation={[0, w.yaw, 0]} />)}
        {tyres.map((w, i) => <CuboidCollider key={`t${i}`} args={[1.45, 0.6, 1.6]} position={[w.p.x, 0.6, w.p.z]} rotation={[0, w.yaw, 0]} />)}
      </RigidBody>
    </group>
  );
}

// ───────── Braking boards: 3-2-1 (300 / 200 / 100) before every hard corner after a straight ─────────
export const brakingBoards = apexes.filter((a) => a.straightBefore).flatMap(({ i, turn }) =>
  [[3, 66], [2, 46], [1, 26]].map(([label, back]) => {
    const s = samples[(i - back + N) % N], side = -turn; // on the outside of the coming corner
    const p = s.p.clone().addScaledVector(s.n, side * (HW + RUNOFF * 0.55));
    return { label, p, yaw: Math.atan2(-s.t.x, -s.t.z) };
  }));
function BrakingBoards() {
  const boards = brakingBoards;
  return boards.map((b, i) => (
    <group key={i} position={[b.p.x, 0, b.p.z]} rotation-y={b.yaw}>
      <mesh position-y={0.7} castShadow><boxGeometry args={[0.12, 1.4, 0.12]} /><meshStandardMaterial color="#d9d2cb" /></mesh>
      <mesh position-y={1.55} castShadow><boxGeometry args={[1.1, 0.8, 0.08]} /><meshStandardMaterial color="#f6f1ea" /></mesh>
      <Text position={[0, 1.55, 0.05]} font={FONT} fontSize={0.6} color="#1d1b1d" anchorX="center" anchorY="middle">{b.label}</Text>
      <Text position={[0, 1.55, -0.05]} rotation-y={Math.PI} font={FONT} fontSize={0.6} color="#1d1b1d" anchorX="center" anchorY="middle">{b.label}</Text>
    </group>
  ));
}

// ───────── Trackside billboards along the straights, just behind the barrier ─────────
const BOARD_TEXT = ["ARGHADEEP GP", "EDGE AI", "PYTORCH", "YOLO11", "ONNX RUNTIME", "GEMINI", "RASPBERRY PI", "KAGGLE", "IEEE COMSNETS", "ANDROID"];
const BOARD_COLORS = ["#e5423a", "#2b2730", "#5d8ff0", "#ffc93c", "#3ddc97"];
function Billboards() {
  const boards = useMemo(() => {
    const out = [];
    let run = 0, last = -999;
    for (let i = 0; i < N; i++) {
      run = samples[i].k < 1 / 150 ? run + 1 : 0;
      const nearStart = Math.min((i - START_INDEX + N) % N, (START_INDEX - i + N) % N) < 34;
      const s = samples[i], p = s.p.clone().addScaledVector(s.n, s.out * (BARRIER_OFFSET + 2.2));
      const nearGap = Math.abs(p.x) < 12 || Math.abs(p.z) < 12; // keep the avenue / access-road gaps open
      if (run > 25 && i - last > 30 && !nearStart && !nearGap && s.room > 5) {
        out.push({ p, yaw: Math.atan2(-s.n.x * s.out, -s.n.z * s.out), text: BOARD_TEXT[out.length % BOARD_TEXT.length], color: BOARD_COLORS[out.length % BOARD_COLORS.length] });
        last = i;
      }
    }
    return out;
  }, []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {boards.map((b, i) => <CuboidCollider key={i} args={[3, 1.3, 0.2]} position={[b.p.x, 1.3, b.p.z]} rotation={[0, b.yaw, 0]} />)}
      </RigidBody>
      {boards.map((b, i) => (
        <group key={i} position={[b.p.x, 0, b.p.z]} rotation-y={b.yaw}>
          {[-2.6, 2.6].map((x) => <mesh key={x} position={[x, 1, 0]} castShadow><boxGeometry args={[0.16, 2, 0.16]} /><meshStandardMaterial color="#3a343d" /></mesh>)}
          <mesh position-y={1.9} castShadow><boxGeometry args={[6, 1.4, 0.18]} /><meshStandardMaterial color={b.color} roughness={0.6} /></mesh>
          <Text position={[0, 1.9, 0.1]} font={FONT} fontSize={0.62} color="#fff6ec" anchorX="center" anchorY="middle" maxWidth={5.6}>{b.text}</Text>
        </group>
      ))}
    </group>
  );
}

// ───────── Start/finish: checkered line, gantry with lights, grid boxes ─────────
function StartFinish() {
  const s = samples[START_INDEX];
  const yaw = Math.atan2(s.t.x, s.t.z);
  const checker = useMemo(checkerTexture, []);
  const lights = useRef([]);
  useFrame((st) => {
    // Lights run a start sequence on loop: five reds come on one by one, then all go out
    const t = st.clock.elapsedTime % 8;
    lights.current.forEach((m, i) => { if (m) m.emissiveIntensity = t > 1 + i * 0.8 && t < 6 ? 4 : 0.15; });
  });
  const grid = useMemo(() => Array.from({ length: 8 }, (_, k) => {
    const sm = samples[(START_INDEX - 10 - k * 8 + N) % N];
    return { p: sm.p.clone().addScaledVector(sm.n, (k % 2 ? 1 : -1) * 3), yaw: Math.atan2(sm.t.x, sm.t.z) };
  }), []);

  return (
    <group>
      <mesh position={[s.p.x, 0.045, s.p.z]} rotation={[-Math.PI / 2, 0, yaw]}>
        <planeGeometry args={[TRACK_WIDTH, 2.2]} />
        <meshStandardMaterial map={checker} roughness={0.7} />
      </mesh>
      {grid.map((g, i) => (
        <group key={i} position={[g.p.x, 0.045, g.p.z]} rotation-y={g.yaw}>
          {[[0, -1.6, 3.2, 0.25], [-1.5, -0.6, 0.25, 2.2], [1.5, -0.6, 0.25, 2.2]].map(([x, z, w, d], j) => (
            <mesh key={j} position={[x, 0, z]} rotation-x={-Math.PI / 2}><planeGeometry args={[w, d]} /><meshStandardMaterial color="#f7f2ea" /></mesh>
          ))}
        </group>
      ))}
      <group position={[s.p.x, 0, s.p.z]} rotation-y={yaw}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.5, 4, 0.5]} position={[HW + 2, 4, 0]} />
          <CuboidCollider args={[0.5, 4, 0.5]} position={[-HW - 2, 4, 0]} />
        </RigidBody>
        {[HW + 2, -HW - 2].map((x) => (
          <mesh key={x} position={[x, 4, 0]} castShadow><boxGeometry args={[0.9, 8, 0.9]} /><meshStandardMaterial color="#2b2730" roughness={0.6} /></mesh>
        ))}
        <mesh position={[0, 7.4, 0]} castShadow><boxGeometry args={[TRACK_WIDTH + 5, 1.6, 0.9]} /><meshStandardMaterial color="#2b2730" roughness={0.6} /></mesh>
        <Text position={[-4.5, 7.4, 0.47]} font={FONT} fontSize={0.75} color="#fff3ea" anchorX="center">START · FINISH</Text>
        <Text position={[-4.5, 7.4, -0.47]} rotation-y={Math.PI} font={FONT} fontSize={0.75} color="#fff3ea" anchorX="center">ARGHADEEP GP</Text>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[2.2 + i * 1.05, 7.4, 0.47]}>
            <circleGeometry args={[0.36, 20]} />
            <meshStandardMaterial ref={(m) => { lights.current[i] = m; }} color="#4a0a0a" emissive="#ff1a1a" emissiveIntensity={0.15} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ───────── Paddock: pit building on the inside of the straight, grandstand on the outside ─────────
function Paddock() {
  const s = samples[(START_INDEX + 30) % N]; // (ahead of the line: behind it the SW sweeper runs close)
  const yaw = Math.atan2(s.t.x, s.t.z);
  const inside = s.p.clone().addScaledVector(s.n, -s.out * (BARRIER_OFFSET + 4.5));
  const outside = samples[START_INDEX].p.clone().addScaledVector(samples[START_INDEX].n, samples[START_INDEX].out * (BARRIER_OFFSET + 4.5));
  const crowd = useMemo(() => {
    const out = [], r = () => Math.random();
    for (let row = 0; row < 5; row++) for (let i = 0; i < 46; i++) out.push({ x: -22.5 + i + r() * 0.3, row, c: ["#e5423a", "#ffd23f", "#5d8ff0", "#fff3ea", "#7bc6b4"][Math.floor(r() * 5)] });
    return out;
  }, []);
  const crowdRef = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), c = new THREE.Color();
    crowd.forEach((p, i) => {
      crowdRef.current.setMatrixAt(i, m.makeTranslation(p.x, 0.9 + p.row * 0.75 + 0.35, -p.row * 0.9 - 0.4));
      crowdRef.current.setColorAt(i, c.set(p.c));
    });
    crowdRef.current.instanceMatrix.needsUpdate = true;
    crowdRef.current.instanceColor.needsUpdate = true;
  }, [crowd]);
  // Crowd gently bobs
  useFrame((st) => { if (crowdRef.current) crowdRef.current.position.y = Math.abs(Math.sin(st.clock.elapsedTime * 3)) * 0.06; });

  const outYaw = Math.atan2(samples[START_INDEX].t.x, samples[START_INDEX].t.z);
  const facing = samples[START_INDEX].out > 0 ? Math.PI : 0; // grandstand faces the track

  return (
    <group>
      {/* Pit building with garages */}
      <group position={[inside.x, 0, inside.z]} rotation-y={yaw}>
        <RigidBody type="fixed" colliders={false}><CuboidCollider args={[3, 3.2, 20]} position={[0, 3.2, 0]} /></RigidBody>
        <mesh position={[0, 3.2, 0]} castShadow receiveShadow><boxGeometry args={[6, 6.4, 40]} /><meshStandardMaterial color="#f3ece4" roughness={0.7} /></mesh>
        <mesh position={[0, 6.6, 0]} castShadow><boxGeometry args={[7.4, 0.4, 41]} /><meshStandardMaterial color="#2b2730" /></mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[-s.out * 3.01, 1.8, -17 + i * 4.85]} rotation-y={-s.out * Math.PI / 2}>
            <planeGeometry args={[3.8, 3.4]} /><meshStandardMaterial color="#38343d" roughness={0.5} />
          </mesh>
        ))}
        <Text position={[-s.out * 3.02, 4.9, 0]} rotation-y={-s.out * Math.PI / 2} font={FONT} fontSize={1.1} color="#e5423a" anchorX="center">PIT LANE</Text>
      </group>
      {/* Grandstand */}
      <group position={[outside.x, 0, outside.z]} rotation-y={outYaw + Math.PI / 2 + facing}>
        <RigidBody type="fixed" colliders={false}><CuboidCollider args={[24, 2.5, 3]} position={[0, 2.5, -2]} /></RigidBody>
        {[0, 1, 2, 3, 4].map((row) => (
          <mesh key={row} position={[0, 0.45 + row * 0.75, -row * 0.9]} castShadow receiveShadow>
            <boxGeometry args={[48, 0.9, 0.9]} /><meshStandardMaterial color="#d9d2cb" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 2, -4.6]} castShadow><boxGeometry args={[48, 4, 0.4]} /><meshStandardMaterial color="#c9c1b9" /></mesh>
        <mesh position={[0, 6.2, -2.4]} rotation-x={0.12} castShadow><boxGeometry args={[49, 0.25, 6]} /><meshStandardMaterial color="#e5423a" roughness={0.6} /></mesh>
        <instancedMesh ref={crowdRef} args={[undefined, undefined, crowd.length]} castShadow>
          <capsuleGeometry args={[0.18, 0.3, 3, 6]} />
          <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
        <Text position={[0, 5.4, 0.3]} font={FONT} fontSize={0.9} color="#fff3ea" anchorX="center">ARGHADEEP GRAND PRIX</Text>
      </group>
    </group>
  );
}

// ───────── Lap timing ─────────
// Tracks progress around the lap from the car's nearest sample. A lap counts when the car
// crosses the line after passing both sector checkpoints in order. Writes into `lapRef`
// (read by the HUD) instead of React state, so nothing re-renders every frame.
function LapTimer({ carRef, lapRef }) {
  const st = useRef({ idx: -1, sector: 0, started: false, t0: 0, sectorTimes: [] });
  useFrame(() => {
    const rb = carRef.current;
    if (!rb) return;
    const p = rb.translation();
    const { i, d } = nearestIndex(p.x, p.z, st.current.idx);
    const s = st.current, L = lapRef.current;
    L.onTrack = d < HW + KERB_W + 1;
    const rel = (i - START_INDEX + N) % N;          // 0 at the line
    const prevRel = s.idx < 0 ? rel : (s.idx - START_INDEX + N) % N;
    s.idx = i;
    const crossed = prevRel > N * 0.9 && rel < N * 0.1 && d < HW + 4;
    const now = performance.now();
    if (crossed) {
      if (s.started && s.sector === 2) {
        const lap = (now - s.t0) / 1000;
        L.last = lap;
        L.best = L.best ? Math.min(L.best, lap) : lap;
        L.laps += 1;
        L.flash = now;
        sfx.chime();
      }
      s.started = true; s.t0 = now; s.sector = 0;
    }
    if (s.started) {
      if (s.sector === 0 && rel > N / 3 && rel < N / 2) s.sector = 1;
      if (s.sector === 1 && rel > (2 * N) / 3 && rel < N * 0.85) s.sector = 2;
      L.current = (now - s.t0) / 1000;
    }
    L.started = s.started;
    L.sector = s.sector;
    L.progress = rel / N;
  });
  return null;
}

export default function Track({ carRef, lapRef }) {
  return (
    <group>
      <Surfaces />
      <Barriers />
      <BrakingBoards />
      <Billboards />
      <StartFinish />
      <Paddock />
      <LapTimer carRef={carRef} lapRef={lapRef} />
    </group>
  );
}
