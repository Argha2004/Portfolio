import * as THREE from "three";

// ───────── The circuit ─────────
// An F1-style closed loop around the town, drawn as a centripetal Catmull-Rom spline.
// Clockwise from the start line on the south main straight (heading east):
//   T1 right-hander → hairpin → east esses → chicane → NE sweeper → back straight (north)
//   → NW hairpin → west esses → SW sweeper → back onto the main straight.
// Validated: 804 m long, tightest corner ≈13 m radius, no overlapping sections.
export const TRACK_WIDTH = 14;
export const RUNOFF = 7;          // sandy run-off beyond the kerbs
export const BARRIER_OFFSET = TRACK_WIDTH / 2 + RUNOFF + 1.5;

const CONTROL = [
  [0, 120], [50, 118], [84, 96], [94, 70], [110, 52], [118, 20], [112, -6], [120, -34],
  [106, -72], [72, -100], [30, -112], [-20, -122], [-64, -112], [-102, -90], [-100, -60],
  [-114, -38], [-124, -4], [-114, 28], [-120, 56], [-92, 90], [-50, 118],
];

const curve = new THREE.CatmullRomCurve3(CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal");
export const TRACK_LENGTH = curve.getLength();
const N = Math.round(TRACK_LENGTH); // one sample per metre
export const SAMPLE_COUNT = N;

// samples[i] = { p, t (tangent), n (left normal), out (+1 if the left normal points away from the
// island centre, i.e. towards the outside of the circuit), k (curvature, rad/m), s (distance) }
export const samples = Array.from({ length: N }, (_, i) => {
  const u = i / N;
  const p = curve.getPointAt(u);
  const t = curve.getTangentAt(u).setY(0).normalize();
  const n = new THREE.Vector3(-t.z, 0, t.x);
  return { p, t, n, out: n.dot(p) > 0 ? 1 : -1, s: u * TRACK_LENGTH, k: 0 };
});
samples.forEach((sm, i) => {
  const a = samples[(i - 4 + N) % N].t, b = samples[(i + 4) % N].t;
  sm.k = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) / 8;
});

// Kerbs where the corner is tighter than ~40 m radius, widened a little before and after
const tight = samples.map((s) => s.k > 1 / 40);
export const kerbAt = samples.map((_, i) => {
  for (let d = -10; d <= 10; d++) if (tight[(i + d + N) % N]) return true;
  return false;
});

// The start/finish line is the sample closest to (0, 120)
const START_POINT = new THREE.Vector3(0, 0, 120);
export const START_INDEX = samples.reduce((best, s, i) => (s.p.distanceTo(START_POINT) < samples[best].p.distanceTo(START_POINT) ? i : best), 0);

// Grid position + heading for the "Race track" button (a few metres behind the line)
export function gridSpot(back = 14) {
  const s = samples[(START_INDEX - back + N) % N];
  return { x: s.p.x, z: s.p.z, yaw: Math.atan2(-s.t.x, -s.t.z) };
}

// ───────── Fast "is this point on the circuit?" lookup (3 m grid) ─────────
const GRID = 3, HALF = 170, G = Math.ceil((HALF * 2) / GRID);
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
