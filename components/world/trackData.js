import * as THREE from "three";

// ───────── The circuit ─────────
// A proper racing layout around the town (centripetal Catmull-Rom): a long main straight, a
// bus-stop chicane, a long east straight into a north switchback (two hairpins, like a mountain
// section on a real circuit), a back straight, west esses and a fast sweeper back onto the main
// straight. Running from the start line on the main straight (south side, heading east):
//   T1 (right, r≈25) → bus-stop chicane (r≈10) → east straight → NE corner (r≈34)
//   → top straight → hairpin 1 (r≈10) → short middle straight → hairpin 2 (r≈12)
//   → back straight (crossing the north avenue) → NW corner (r≈24) → west esses (r≈12–28)
//   → SW sweeper (r≈36) → main straight.
// Checked with a throwaway script against everything around it: crosses all four avenues once,
// ≥25 m between the centre lines of non-adjacent parts (the switchback strands), tightest corner
// r≈10, and clear of the districts, ponds, sections and the adventure trail.
export const TRACK_WIDTH = 11;
export const RUNOFF = 5;          // run-off beyond the kerbs (grass on straights, gravel in corners)
export const BARRIER_OFFSET = TRACK_WIDTH / 2 + RUNOFF + 1.5;

const CONTROL = [
  [-40, 121], [10, 121], [50, 121],                              // main straight
  [78, 119], [98, 108], [107, 88],                               // T1
  [108, 66], [110, 54], [120, 45], [120, 31], [109, 21],         // bus-stop chicane
  [106, -8], [110, -48], [114, -84],                             // east straight
  [110, -116], [96, -142], [76, -157],                           // NE corner
  [54, -160], [39, -158],                                        // top straight
  [26, -149], [23, -136], [31, -128],                            // hairpin 1
  [48, -127], [62, -128],                                        // middle straight
  [77, -124], [83, -112], [77, -100],                            // hairpin 2
  [60, -95], [30, -99], [0, -107], [-30, -118], [-60, -122],     // back straight
  [-88, -118], [-106, -100],                                     // NW corner
  [-111, -72], [-122, -48], [-110, -24], [-114, 8],              // west esses
  [-114, 50], [-106, 80], [-88, 98], [-64, 112],                 // SW sweeper
];

const curve = new THREE.CatmullRomCurve3(CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal");
export const TRACK_LENGTH = curve.getLength();
const N = Math.round(TRACK_LENGTH); // one sample per metre
export const SAMPLE_COUNT = N;

// samples[i] = { p, t (tangent), n (left normal), out (+1 if the left normal points towards the
// outside of the circuit — see below), k (curvature, rad/m), turn, s (distance), room }
export const samples = Array.from({ length: N }, (_, i) => {
  const u = i / N;
  const p = curve.getPointAt(u);
  const t = curve.getTangentAt(u).setY(0).normalize();
  const n = new THREE.Vector3(-t.z, 0, t.x);
  return { p, t, n, out: 1, s: u * TRACK_LENGTH, k: 0, room: Infinity };
});
samples.forEach((sm, i) => {
  const a = samples[(i - 4 + N) % N].t, b = samples[(i + 4) % N].t;
  sm.k = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) / 8;
  // which way the track bends here: +1 towards the left normal (n), −1 towards the right
  const bend = samples[(i + 6) % N].p.clone().add(samples[(i - 6 + N) % N].p).sub(sm.p).sub(sm.p);
  sm.turn = bend.dot(sm.n) >= 0 ? 1 : -1;
});

// Kerbs where the corner is tighter than ~40 m radius, widened a little before and after
const tight = samples.map((s) => s.k > 1 / 40);
export const kerbAt = samples.map((_, i) => {
  for (let d = -10; d <= 10; d++) if (tight[(i + d + N) % N]) return true;
  return false;
});

// Corner apexes (tighter than r≈30, local curvature peaks), with whether a straight leads into them
export const apexes = [];
samples.forEach((sm, i) => {
  const k = sm.k;
  if (k < 1 / 30 || k < samples[(i - 1 + N) % N].k || k < samples[(i + 1) % N].k) return;
  let straightBefore = true;
  for (let d = 30; d <= 80; d++) if (samples[(i - d + N) % N].k > 1 / 70) { straightBefore = false; break; }
  apexes.push({ i, turn: sm.turn, straightBefore });
});

// Which side is "outside" (barriers, billboards, grandstand go there): the side outside the circuit's
// closed outline, except through hairpins (more than ~115° of turn), where it's the outside of the
// bend, so a hairpin that folds back inwards still gets its wall on the far side. Then smoothed.
const inOutline = (x, z) => {
  let inside = false;
  for (let i = 0, j = N - 1; i < N; j = i++) {
    const a = samples[i].p, b = samples[j].p;
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};
const heading = (i) => Math.atan2(samples[(i + N) % N].t.z, samples[(i + N) % N].t.x);
const rawOut = samples.map((sm, i) => {
  let turned = heading(i + 22) - heading(i - 22);
  turned = Math.abs(Math.atan2(Math.sin(turned), Math.cos(turned)));
  if (turned > 2) return -sm.turn;
  return inOutline(sm.p.x + sm.n.x * 8, sm.p.z + sm.n.z * 8) ? -1 : 1;
});
samples.forEach((sm, i) => {
  let sum = 0;
  for (let d = -8; d <= 8; d++) sum += rawOut[(i + d + N) % N];
  sm.out = sum >= 0 ? 1 : -1;
});
// room: free metres beyond the barrier before another part of the circuit's run-off starts
// (the switchback strands run side by side; anything placed past the barrier checks this)
const gapOf = (i, j) => Math.min(Math.abs(i - j), N - Math.abs(i - j));
samples.forEach((sm, i) => {
  const bx = sm.p.x + sm.n.x * sm.out * BARRIER_OFFSET, bz = sm.p.z + sm.n.z * sm.out * BARRIER_OFFSET;
  let best = Infinity;
  for (let j = 0; j < N; j += 2) {
    if (gapOf(i, j) < 40) continue;
    const q = samples[j].p, d = (q.x - bx) ** 2 + (q.z - bz) ** 2;
    if (d < best) best = d;
  }
  sm.room = Math.sqrt(best) - TRACK_WIDTH / 2 - RUNOFF;
});
// wall: does this sample get a barrier segment? Not in the avenue / access-road gaps, not inside
// another part's run-off, and only one wall where two strands' walls would run side by side.
const kept = [];
samples.forEach((sm, i) => {
  const x = sm.p.x + sm.n.x * sm.out * BARRIER_OFFSET, z = sm.p.z + sm.n.z * sm.out * BARRIER_OFFSET;
  const gap = (Math.abs(x) < 7 && z < 0) || Math.abs(z) < 7;
  sm.wall = !gap && sm.room >= 1 && !kept.some((k) => gapOf(i, k.i) > 40 && (k.x - x) ** 2 + (k.z - z) ** 2 < 81);
  if (sm.wall) kept.push({ i, x, z });
});
// (drop stray bits of wall shorter than ~6 m)
const lone = samples.map((_, i) => { let c = 0; for (let d = -4; d <= 4; d++) c += samples[(i + d + N) % N].wall ? 1 : 0; return c < 6; });
samples.forEach((sm, i) => { if (lone[i]) sm.wall = false; });

// The start/finish line is the sample closest to (0, 120)
const START_POINT = new THREE.Vector3(0, 0, 120);
export const START_INDEX = samples.reduce((best, s, i) => (s.p.distanceTo(START_POINT) < samples[best].p.distanceTo(START_POINT) ? i : best), 0);

// Grid position + heading for the "Race track" button (a few metres behind the line)
export function gridSpot(back = 14) {
  const s = samples[(START_INDEX - back + N) % N];
  return { x: s.p.x, z: s.p.z, yaw: Math.atan2(-s.t.x, -s.t.z) };
}

// ───────── Fast "is this point on the circuit?" lookup (3 m grid) ─────────
const GRID = 3, HALF = 200, G = Math.ceil((HALF * 2) / GRID);
const occupied = new Uint8Array(G * G);
const reach = BARRIER_OFFSET + 3;
samples.forEach(({ p }) => {
  const r = Math.ceil(reach / GRID);
  const cx = Math.floor((p.x + HALF) / GRID), cz = Math.floor((p.z + HALF) / GRID);
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const gx = cx + dx, gz = cz + dz;
    if (gx < 0 || gz < 0 || gx >= G || gz >= G) continue;
    const wx = gx * GRID - HALF + GRID / 2, wz = gz * GRID - HALF + GRID / 2;
    if (Math.hypot(wx - p.x, wz - p.z) < reach) occupied[gz * G + gx] = 1;
  }
});
export function nearTrack(x, z) {
  const gx = Math.floor((x + HALF) / GRID), gz = Math.floor((z + HALF) / GRID);
  if (gx < 0 || gz < 0 || gx >= G || gz >= G) return false;
  return occupied[gz * G + gx] === 1;
}

// Nearest sample index to a position, searching around a previous guess (cheap per frame)
export function nearestIndex(x, z, guess = -1, window = 40) {
  const check = (i) => { const p = samples[i].p; return (p.x - x) ** 2 + (p.z - z) ** 2; };
  let best = 0, bestD = Infinity;
  if (guess >= 0) {
    for (let d = -window; d <= window; d++) { const i = (guess + d + N) % N, dd = check(i); if (dd < bestD) { bestD = dd; best = i; } }
    if (bestD < 30 * 30) return { i: best, d: Math.sqrt(bestD) };
  }
  for (let i = 0; i < N; i += 2) { const dd = check(i); if (dd < bestD) { bestD = dd; best = i; } }
  return { i: best, d: Math.sqrt(bestD) };
}
