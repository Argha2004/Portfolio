"use client";
import { useMemo } from "react";
import { CELL, roadCells, roundaboutExits, connectorCells, connectors, avenueEnds } from "./zones";
import { asphaltTexture } from "./Circuit";
import { Instanced, Placed, model, SCALE } from "./kit";
import { PoleLights } from "./bruno";

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
        items.push({ p: [5, 0, c], r: 0 }, { p: [-5, 0, c], r: 0 }, { p: [c, 0, -5], r: 0 }, { p: [c, 0, 5], r: 0 });
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

// Track-style asphalt strips joining each avenue to the circuit. Drawn just above the run-off
// sand but below the circuit surface, kerbs and edge lines, so the track paints over the join.
function Connectors() {
  const tex = useMemo(() => {
    const t = asphaltTexture();
    t.repeat.set(1, 3);
    return t;
  }, []);
  return connectors.map(({ dir, from, to }) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) + 1;
    const vertical = dir === "N" || dir === "S";
    return (
      <mesh key={dir} position={[(from[0] + to[0]) / 2, 0.025, (from[1] + to[1]) / 2]} rotation={[-Math.PI / 2, 0, vertical ? 0 : Math.PI / 2]} receiveShadow>
        <planeGeometry args={[5.6, len]} />
        <meshStandardMaterial map={tex} roughness={0.92} />
      </mesh>
    );
  });
}
