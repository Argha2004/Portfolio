"use client";
import { useMemo } from "react";
import { CELL, roadCells, roundaboutExits, connectorCells, connectors, avenueEnds } from "./zones";
import * as THREE from "three";
import { asphaltTexture } from "./Circuit";
import { TRACK_WIDTH, RUNOFF } from "./trackData";
import { Instanced, Placed, model, SCALE } from "./kit";
import { PoleLights } from "./bruno";
import { inRiver, nearBridge } from "./riverData";

// Auto-tiling: each road cell picks straight / bend / T / crossroad / dead-end and a rotation
// from which neighbours are road. Base tiles (seen from above, north up) are open on:
//   straight W+E · bend W+S · intersection (T) W+E+S · crossroad all · end W
const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const CCW = { E: "N", N: "W", W: "S", S: "E" }; // what +90° about Y does to a direction
const BASES = [
  ["road-crossroad", ["N", "E", "S", "W"]],
  ["road-intersection", ["W", "E", "S"]],
  ["road-straight", ["W", "E"]],
  ["road-bend", ["W", "S"]],
  ["road-end", ["W"]],
];
const sameSet = (a, b) => a.length === b.length && a.every((d) => b.includes(d));

function pickTile(open) {
  for (const [name, base] of BASES) {
    if (base.length !== open.length) continue;
    let dirs = base;
    for (let k = 0; k < 4; k++) {
      if (sameSet(dirs, open)) return { name, r: (k * Math.PI) / 2 };
      dirs = dirs.map((d) => CCW[d]);
    }
  }
  return { name: "road-straight", r: 0 };
}

export default function Roads() {
  const groups = useMemo(() => {
    const out = {};
    const has = (x, z) => roadCells.has(`${x},${z}`) || roundaboutExits.has(`${x},${z}`) || connectorCells.has(`${x},${z}`);
    roadCells.forEach((k) => {
      const [x, z] = k.split(",").map(Number);
      const open = Object.entries(DIRS).filter(([, [dx, dz]]) => has(x + dx, z + dz)).map(([d]) => d);
      const { name, r } = pickTile(open);
      (out[name] ||= []).push({ p: [x * CELL, 0.012, z * CELL], r, s: [CELL, 4, CELL] });
    });
    return out;
  }, []);

  // Street furniture along the avenues: Bruno's pole lights on both sides every other cell
  const lights = useMemo(() => {
    const items = [];
    for (let i = 3; i < Math.min(...Object.values(avenueEnds)); i += 2) {
      for (const sgn of [-1, 1]) {
        const c = sgn * i * CELL;
        // (none on the river bridge or in the water)
        [[5, c], [-5, c], [c, -5], [c, 5]].forEach(([x, z]) => { if (!inRiver(x, z, 1) && !nearBridge(x, z)) items.push({ p: [x, 0, z], r: 0 }); });
      }
    }
    return items;
  }, []);

  // Traffic lights at the four roundabout entrances
  const traffic = useMemo(() => [
    { p: [5, 0, -14], r: Math.PI / 2, s: SCALE.roads }, { p: [-5, 0, 14], r: -Math.PI / 2, s: SCALE.roads },
    { p: [14, 0, 5], r: 0, s: SCALE.roads }, { p: [-14, 0, -5], r: Math.PI, s: SCALE.roads },
  ], []);
  return (
    <>
      {Object.entries(groups).map(([name, items]) => (
        <Instanced key={name} url={model("roads", name)} items={items} castShadow={false} />
      ))}
      <Instanced url={model("roads", "road-roundabout")} items={[{ p: [0, 0.012, 0], r: 0, s: [CELL, 4, CELL] }]} castShadow={false} />
      <Connectors />
      <PoleLights items={lights} />
      <Placed url={model("roads", "traffic-light")} items={traffic} collider="trunk" />
    </>
  );
}

// ───────── Junctions: each avenue continues as a proper road into the circuit ─────────
// From the last road tile to the track: asphalt with edge lines and a dashed centre line,
// sidewalks until the run-off sand, then a flared mouth with red/white kerbs and give-way
// "shark teeth" where it meets the track. Built flat in a local frame (x across, -z along).
const ROAD_W = 5.6, MOUTH_W = 12, FLARE = 7, HW = TRACK_WIDTH / 2;
const RED = new THREE.Color("#d8231c"), WHITE = new THREE.Color("#f6f1ea");

function flatGeometry(tris, uvScale) {
  // tris: [[x, z], …] three at a time; faces are turned to point up; optional per-triangle colours
  const pos = [], uv = [], col = [];
  for (const t of tris) {
    let [a, b, c] = t.pts;
    if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) [b, c] = [c, b];
    for (const [x, z] of [a, b, c]) {
      pos.push(x, 0, z);
      if (uvScale) uv.push(x / uvScale, -z / uvScale);
      if (t.color) col.push(t.color.r, t.color.g, t.color.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  if (uv.length) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (col.length) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const quad = (a, b, c, d, color) => [{ pts: [a, b, c], color }, { pts: [a, c, d], color }];
// a strip of width `w` centred on the polyline `line` ([[x, s], …] with s along the road → z = -s)
function strip(line, w, colorAt) {
  const out = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, s0] = line[i], [x1, s1] = line[i + 1];
    const dx = x1 - x0, ds = s1 - s0, len = Math.hypot(dx, ds), nx = (ds / len) * w / 2, ns = (-dx / len) * w / 2;
    out.push(...quad([x0 - nx, -(s0 - ns)], [x1 - nx, -(s1 - ns)], [x1 + nx, -(s1 + ns)], [x0 + nx, -(s0 + ns)], colorAt?.(i)));
  }
  return out;
}
// split a polyline into short pieces (for striped kerbs and dashes)
function pieces(a, b, step) {
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)), out = [];
  for (let i = 0; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * (i / n), a[1] + (b[1] - a[1]) * (i / n)]);
  return out;
}

function Junction({ from, to }) {
  const L = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const u = [(to[0] - from[0]) / L, (to[1] - from[1]) / L];
  const yaw = Math.atan2(-u[0], -u[1]);
  const geo = useMemo(() => {
    const E = L - HW, F = E - FLARE, R0 = L - HW - RUNOFF - 0.5, r = ROAD_W / 2, m = MOUTH_W / 2;
    const asphalt = flatGeometry([
      ...quad([-r, 0], [r, 0], [r, -F], [-r, -F]),
      ...quad([-r, -F], [r, -F], [m, -E], [-m, -E]),
      ...quad([-m, -E], [m, -E], [m, -(E + 2)], [-m, -(E + 2)]),
    ], 6);
    const edge = (sg) => [[sg * (r - 0.3), 0], [sg * (r - 0.3), F], [sg * (m - 0.3), E]];
    const lines = [...strip(edge(-1), 0.18), ...strip(edge(1), 0.18)];
    for (let s = 1.5; s < F - 1.5; s += 3.2) lines.push(...strip([[0, s], [0, s + 1.6]], 0.16));
    // give-way shark teeth across the mouth, pointing at oncoming cars
    for (let x = -m + 0.9; x <= m - 0.9; x += 1.1) lines.push({ pts: [[x - 0.4, -(E - 0.5)], [x + 0.4, -(E - 0.5)], [x, -(E - 1.5)]] });
    const kerbLine = (sg) => pieces([sg * r, F], [sg * m, E], 1.2).map(([x, s]) => [x + sg * 0.45, s]);
    const kerbs = [...strip(kerbLine(-1), 0.9, (i) => (i % 2 ? RED : WHITE)), ...strip(kerbLine(1), 0.9, (i) => (i % 2 ? RED : WHITE))];
    // sidewalks continue the road tile's pavements up to the run-off sand
    const walks = R0 > 1 ? [[-1, R0], [1, R0]].map(([sg, len]) => ({ x: sg * (r + 0.6), len })) : [];
    return { asphalt: asphalt, lines: flatGeometry(lines), kerbs: flatGeometry(kerbs), walks };
  }, [L]);
  const tex = useMemo(() => { const t = asphaltTexture(); t.repeat.set(1, 1); return t; }, []);
  return (
    <group position={[from[0], 0, from[1]]} rotation-y={yaw}>
      <mesh geometry={geo.asphalt} position-y={0.026} receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.92} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh geometry={geo.lines} position-y={0.036}><meshStandardMaterial color="#f7f2ea" roughness={0.6} /></mesh>
      <mesh geometry={geo.kerbs} position-y={0.05} receiveShadow><meshStandardMaterial vertexColors roughness={0.55} /></mesh>
      {geo.walks.map((w) => (
        <mesh key={w.x} position={[w.x, 0.06, -w.len / 2]} receiveShadow castShadow>
          <boxGeometry args={[1.2, 0.12, w.len]} />
          <meshStandardMaterial color="#d9d2cb" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Connectors() {
  return connectors.map(({ dir, from, to }) => <Junction key={dir} from={from} to={to} />);
}
