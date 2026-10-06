import * as THREE from "three";

// ───────── Adventure trail: a second, off-road loop around the outside of the circuit ─────────
// A wavy closed loop through the outer forest ring of the (enlarged) island, paved like Bruno
// Simon's paths (terrain slabs, no mesh). Jumps, brick walls, crate stacks, cone slaloms and a
// shallow water crossing are placed along it (Trail.js).
export const TRAIL_WIDTH = 9;
const COUNT = 18;

const CONTROL = Array.from({ length: COUNT }, (_, i) => {
  const a = (i / COUNT) * Math.PI * 2 + Math.sin(i * 2.3) * 0.06;
  const r = 199 + Math.sin(i * 1.7) * 4; // (a steady radius: the circuit's north switchback reaches out to ~175 m)
  return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
});

const curve = new THREE.CatmullRomCurve3(CONTROL, true, "centripetal");
export const TRAIL_LENGTH = curve.getLength();
export const TRAIL_N = Math.round(TRAIL_LENGTH / 1.5);

// samples[i] = { p, t (tangent), n (left normal) }
export const trailSamples = Array.from({ length: TRAIL_N }, (_, i) => {
  const u = i / TRAIL_N;
  const p = curve.getPointAt(u);
  const t = curve.getTangentAt(u).setY(0).normalize();
  return { p, t, n: new THREE.Vector3(-t.z, 0, t.x) };
});

// Start line: the sample closest to the east axis
const eastScore = (s) => (s.p.x > 0 ? Math.abs(s.p.z) : Infinity);
export const TRAIL_START = trailSamples.reduce((b, s, i) => (eastScore(s) < eastScore(trailSamples[b]) ? i : b), 0);

// Fast "near the trail?" lookup on a 3 m grid
const GRID = 3, HALF = 260, G = Math.ceil((HALF * 2) / GRID);
const occupied = new Uint8Array(G * G);
const reach = TRAIL_WIDTH / 2 + 3;
trailSamples.forEach(({ p }) => {
  const r = Math.ceil(reach / GRID);
  const cx = Math.floor((p.x + HALF) / GRID), cz = Math.floor((p.z + HALF) / GRID);
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const gx = cx + dx, gz = cz + dz;
    if (gx < 0 || gz < 0 || gx >= G || gz >= G) continue;
    if (Math.hypot(gx * GRID - HALF + GRID / 2 - p.x, gz * GRID - HALF + GRID / 2 - p.z) < reach) occupied[gz * G + gx] = 1;
  }
});
export function nearTrail(x, z) {
  const gx = Math.floor((x + HALF) / GRID), gz = Math.floor((z + HALF) / GRID);
  if (gx < 0 || gz < 0 || gx >= G || gz >= G) return false;
  return occupied[gz * G + gx] === 1;
}

export function nearestTrailIndex(x, z, guess = -1, window = 30) {
  const d2 = (i) => (trailSamples[i].p.x - x) ** 2 + (trailSamples[i].p.z - z) ** 2;
  let best = 0, bestD = Infinity;
  if (guess >= 0) {
    for (let k = -window; k <= window; k++) { const i = (guess + k + TRAIL_N) % TRAIL_N, d = d2(i); if (d < bestD) { bestD = d; best = i; } }
    if (bestD < 25 * 25) return { i: best, d: Math.sqrt(bestD) };
  }
  for (let i = 0; i < TRAIL_N; i += 2) { const d = d2(i); if (d < bestD) { bestD = d; best = i; } }
  return { i: best, d: Math.sqrt(bestD) };
}

// The water crossing (a shallow ford) sits a third of the way round
export const FORD_INDEX = Math.round(TRAIL_N * 0.36);
export const FORD = { x: trailSamples[FORD_INDEX].p.x, z: trailSamples[FORD_INDEX].p.z, r: 8, depth: 0.32 };
