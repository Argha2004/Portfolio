import * as THREE from "three";

// ───────── Rivers ─────────
// Carved into the terrain like the ponds (the island-wide water surface shows wherever the ground
// dips below it), with sandy banks:
//  · main: across the middle of the island. Rises in a spring pool in the west, runs south of the
//    Skills Camp, under the north avenue just past the roundabout, south of the Research Arena,
//    and empties into the east pond.
//  · south: from a lake in the forest behind the grandstand, east and down to the south coast.
//  · west: from a lake out west (where the Edge AI Lab stood) to the west coast.
// The two outer rivers cross the adventure trail through shallow fords (terrain.js keeps the
// water there wheel-deep) and run on into the sea.
// Kept clear of: district signs and entrances, the projects area, the roundabout plaza, the
// circuit, the avenues' lights, ramps and trail obstacles.
export const RIVERS = [
  {
    id: "main",
    control: [
      [-86, -13], [-78, -15], [-66, -16], [-50, -15], [-34, -17], [-20, -22], [-8, -26],
      [0, -27], [10, -26], [22, -21], [36, -16], [48, -14], [60, -15], [70, -19], [76, -21],
    ],
    source: { x: -86, z: -13, r: 6 },
  },
  {
    id: "south",
    control: [[-70, 158], [-58, 163], [-40, 170], [-20, 166], [0, 161], [20, 164], [38, 172], [50, 183], [56, 196], [60, 210], [63, 224]],
    source: { x: -70, z: 158, r: 9 },
  },
  {
    id: "west",
    control: [[-150, 32], [-166, 35], [-182, 41], [-198, 46], [-214, 52], [-228, 57]],
    source: { x: -150, z: 32, r: 10 },
  },
];

// Source lakes/pools (added to PONDS) and a few more ponds out in the fields and forest
export const RIVER_SOURCES = RIVERS.map((r) => r.source);
export const EXTRA_PONDS = [
  { x: 150, z: -70, r: 9 },     // east forest, between the circuit and the trail
  { x: -108, z: -138, r: 7 },   // north-west forest
  { x: -84, z: 64, r: 6 },      // west of the Design Graveyard
];

// Cross-section: full depth within RIVER_IN of the centre line, rising to the bank at RIVER_OUT
export const RIVER_IN = 2.2, RIVER_OUT = 5.5, RIVER_DEPTH = 0.8; // (× terrain DEPTH 1.5 → ~1.2 m)

const sampleRiver = (control) => {
  const curve = new THREE.CatmullRomCurve3(control.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  const count = Math.round(curve.getLength()); // a sample per metre
  return Array.from({ length: count + 1 }, (_, i) => {
    const u = i / count, p = curve.getPointAt(u), t = curve.getTangentAt(u).setY(0).normalize();
    return { p, t, n: new THREE.Vector3(-t.z, 0, t.x) };
  });
};
export const riverSamplesById = Object.fromEntries(RIVERS.map((r) => [r.id, sampleRiver(r.control)]));
export const riverSamples = riverSamplesById.main;

// Distance to the nearest river centre line on a 1 m grid over the island (exact enough for the
// terrain and placement checks, and cheap: one lookup)
const PAD = RIVER_OUT + 14;
const X0 = -240, Z0 = -240, GW = 481, GH = 481;
const dist = new Float32Array(GW * GH).fill(Infinity);
Object.values(riverSamplesById).flat().forEach(({ p }) => {
  const R = Math.ceil(PAD);
  for (let gz = Math.max(0, Math.floor(p.z - Z0) - R); gz <= Math.min(GH - 1, Math.ceil(p.z - Z0) + R); gz++)
    for (let gx = Math.max(0, Math.floor(p.x - X0) - R); gx <= Math.min(GW - 1, Math.ceil(p.x - X0) + R); gx++) {
      const d = Math.hypot(gx + X0 - p.x, gz + Z0 - p.z), k = gz * GW + gx;
      if (d < dist[k]) dist[k] = d;
    }
});

// Distance (m) from a point to the nearest river's centre line (Infinity far from any river)
export function riverDist(x, z) {
  const fx = x - X0, fz = z - Z0;
  if (fx < 0 || fz < 0 || fx >= GW - 1 || fz >= GH - 1) return Infinity;
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, k = iz * GW + ix;
  const a = dist[k], b = dist[k + 1], c = dist[k + GW], d = dist[k + GW + 1];
  if (!Number.isFinite(a + b + c + d)) return Math.min(a, b, c, d);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// Is a point in a river or within `margin` metres of its banks?
export const inRiver = (x, z, margin = 0) => riverDist(x, z) < RIVER_OUT + margin;

// The sample of a river nearest a given x (bridges are placed by where they cross)
export function riverAtX(x, id = "main") {
  const samples = riverSamplesById[id];
  let best = samples[0];
  for (const s of samples) if (Math.abs(s.p.x - x) < Math.abs(best.p.x - x)) best = s;
  return best;
}

// Where the rivers are crossed: the north avenue (a concrete road bridge) and small wooden
// bridges: four on the main river (two lined up with the camp's and the arena's entrances,
// all between the avenue's pole lights at ±24/40/56/72) and one on the south river
export const ROAD_BRIDGE_X = 0;
export const WOOD_BRIDGES = [[-80, "main"], [-48, "main"], [16, "main"], [48, "main"], [-28, "south"]];

// Bridge placements: centred on the river where it crosses x, running across it (along the
// river's normal). `len` reaches past both banks onto dry ground.
export const BRIDGE_LEN = RIVER_OUT * 2 + 5;
const bridge = (x, id, kind, width) => {
  const s = riverAtX(x, id);
  return { kind, x: s.p.x, z: s.p.z, ax: s.n.x, az: s.n.z, yaw: Math.atan2(s.n.x, s.n.z), len: BRIDGE_LEN, width };
};
export const BRIDGES = [
  // the road bridge runs exactly along the avenue (north–south), whatever the river's angle there
  { ...bridge(ROAD_BRIDGE_X, "main", "road", 9), x: 0, ax: 0, az: 1, yaw: 0 },
  ...WOOD_BRIDGES.map(([x, id]) => bridge(x, id, "wood", 4.2)),
];

// Is a point on a bridge or its approaches (kept clear of trees, bombs and props)?
export function nearBridge(x, z, margin = 0) {
  return BRIDGES.some((b) => {
    const dx = x - b.x, dz = z - b.z;
    const along = dx * b.ax + dz * b.az, across = dx * b.az - dz * b.ax;
    return Math.abs(across) < b.width / 2 + 1.5 + margin && Math.abs(along) < b.len / 2 + 5 + margin;
  });
}
