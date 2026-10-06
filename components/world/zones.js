import { nearTrack, samples, TRACK_WIDTH, RUNOFF } from "./trackData";
import { nearTrail, FORD } from "./trailData";

// ───────── World layout ─────────
// The world sits on a grid of 8 m road cells (one Kenney road tile at ×8).
// x → east, -z → north (up the screen).
export const CELL = 8;
export const AVENUE = 14;          // upper bound for the avenues (they actually stop at avenueEnds)
export const ISLAND_R = 215;       // island radius in metres (the outer ring holds the adventure trail)
export const SPAWN_POS = [0, 1.6, 22];
export const CAM_OFFSET = [9, 12, 15];   // chase camera offset from the car (fixed angle)
export const SUN_DIR = [16, 26, -14];    // direction towards the sun

// Where each avenue meets the circuit: walk the track samples and find where the centre line
// crosses each axis. The road tiles stop before the circuit's run-off; a short "connector"
// strip of track-style asphalt (drawn beneath the circuit) joins them, like an access road.
const AXES = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
export const avenueEnds = {};      // last tile cell index per direction
export const connectors = [];      // { from: [x, z], to: [x, z], dir }
for (const [k, [dx, dz]] of Object.entries(AXES)) {
  let best = null;
  for (const sm of samples) {
    const along = sm.p.x * dx + sm.p.z * dz, across = Math.abs(sm.p.x * dz - sm.p.z * dx);
    if (along > 0 && (!best || across < best.across)) best = { along, across };
  }
  const runoffStart = best.along - TRACK_WIDTH / 2 - RUNOFF;
  const cells = Math.floor((runoffStart - CELL / 2 - 2) / CELL);
  avenueEnds[k] = cells;
  const startDist = cells * CELL + CELL / 2;
  connectors.push({ dir: k, from: [dx * startDist, dz * startDist], to: [dx * best.along, dz * best.along] });
}

// Road cells: a centre roundabout (3×3 cells) and two avenues crossing it, out to the circuit
const key = (x, z) => `${x},${z}`;
export const roadCells = new Set();
for (let i = 2; i <= Math.max(...Object.values(avenueEnds)); i++) {
  if (i <= avenueEnds.N) roadCells.add(key(0, -i));
  if (i <= avenueEnds.S) roadCells.add(key(0, i));
  if (i <= avenueEnds.E) roadCells.add(key(i, 0));
  if (i <= avenueEnds.W) roadCells.add(key(-i, 0));
}
// The roundabout's exits count as "road" for neighbour checks but aren't tiles themselves
export const roundaboutExits = new Set([key(0, -1), key(0, 1), key(-1, 0), key(1, 0)]);
// Cells just past each avenue's end also count as road, so the last tile is a straight
// leading into the connector rather than a dead-end cap
export const connectorCells = new Set([
  key(0, -avenueEnds.N - 1), key(0, avenueEnds.S + 1), key(avenueEnds.E + 1, 0), key(-avenueEnds.W - 1, 0),
]);

// Ponds (Bruno-style water): each sits in a gap between the avenues, the districts and the circuit
export const PONDS = [
  { x: -79, z: 25, r: 9 },
  { x: 76, z: -21, r: 10 },
  { x: 21, z: 76, r: 8 },
  { x: -33, z: -84, r: 8 },
  { ...FORD },                        // shallow water crossing on the adventure trail
];
// Distance-to-edge test with the same wobble the terrain uses for its shoreline
export const pondEdge = (p, x, z) => {
  const a = Math.atan2(z - p.z, x - p.x);
  return p.r * (1 + 0.14 * Math.sin(a * 3 + p.x) + 0.08 * Math.sin(a * 5 - p.z));
};
export function inPond(x, z, margin = 0) {
  return PONDS.some((p) => {
    const d = Math.hypot(x - p.x, z - p.z);
    return d < p.r * 1.22 + margin && d < pondEdge(p, x, z) + margin; // (cheap bound first: the edge is at most 1.22 r)
  });
}

// Is a world position on (or right next to) a road, the circuit or a pond? Keeps decoration off them.
export function nearRoad(x, z, margin = 6) {
  const span = AVENUE * CELL + margin;
  const onAvenue = (Math.abs(x) < margin && Math.abs(z) < span) || (Math.abs(z) < margin && Math.abs(x) < span);
  return onAvenue || Math.hypot(x, z) < 18 || nearTrack(x, z) || inPond(x, z, margin * 0.5 + 2) || inArea(x, z) || nearTrail(x, z);
}

// Sections out between the circuit and the adventure trail (see Sections.js). The camera always
// looks from the same side, so each section faces it: `yaw` turns the section's local +Z towards
// the camera, putting the pad at the front and everything readable behind it.
const section = (x, z, r) => ({ center: [x, z], r, yaw: Math.atan2(CAM_OFFSET[0], CAM_OFFSET[2]) });
export const SECTIONS = {
  campus: section(154, 50, 14),    // education
  fame: section(-34, -160, 14),    // awards & certifications
  lab: section(-151, 32, 12),      // research interests
};
// a point given in a section's local frame (x across, z towards the island centre) → world [x, z]
const ground = ([x, z]) => [x, 0, z];
export const sectionPoint = (sec, lx, lz) => {
  const c = Math.cos(sec.yaw), s = Math.sin(sec.yaw);
  return [sec.center[0] + lx * c + lz * s, sec.center[1] - lx * s + lz * c];
};

// The name sign (Props.js Letters): one line on the right of the road at the spawn, starting just past
// the sidewalk; its footprint is kept clear of scenery and bombs
export const NAME_SIGN = { x: 22, z: 20, size: 1.5 };

// Footprints of the two Bruno areas (projects forge, social plinth), the sections and the name sign, kept clear of scenery
const AREA_CIRCLES = [
  { x: -13.5, z: -46.5, r: 10 }, { x: 56, z: 24, r: 12 }, { x: 70, z: 11, r: 3 },
  ...Object.values(SECTIONS).map((s) => ({ x: s.center[0], z: s.center[1], r: s.r + 2 })),
  ...[-8.5, 0, 8.5].map((dx) => ({ x: NAME_SIGN.x + dx, z: NAME_SIGN.z, r: 5.5 })),
];
export const inArea = (x, z) => AREA_CIRCLES.some((c) => Math.hypot(x - c.x, z - c.z) < c.r);

// ───────── Districts ─────────
export const DISTRICTS = {
  camp: { name: "Skills Camp", center: [-48, -48] },
  arena: { name: "Research Arena", center: [48, -48] },
  graveyard: { name: "Design Graveyard", center: [-48, 48] },
  village: { name: "The Village", center: [48, 48] },
};

// Bruno Simon's two areas (see areas.js): the projects forge beside the north avenue and the
// social / contact plinth in the Village. [x, z] of the projects area origin and the plinth centre.
export const PROJECTS_SITE = [-13, -44];
export const SOCIAL_CENTER = [56, 26];

export const ZONES = {
  projects: { id: "projects", pos: [PROJECTS_SITE[0] + 1.5, 0, PROJECTS_SITE[1] + 1], label: "PROJECTS", color: "#ff8a5c" },
  skills: { id: "skills", pos: [-48, 0, -30], label: "SKILLS", color: "#f6c453" },
  research: { id: "research", pos: [48, 0, -44], label: "RESEARCH", color: "#7bc6b4" },
  graveyard: { id: "graveyard", pos: [-48, 0, 36], label: "R.I.P.", color: "#9b8cff" },
  about: { id: "about", pos: [38, 0, 40], label: "ABOUT ME", color: "#a98bd6" },
  contact: { id: "contact", pos: [SOCIAL_CENTER[0], 0, SOCIAL_CENTER[1]], label: "CONTACT", color: "#5d8ff0" },
  education: { id: "education", pos: ground(sectionPoint(SECTIONS.campus, 0, 7)), label: "EDUCATION", color: "#6ec6ff" },
  achievements: { id: "achievements", pos: ground(sectionPoint(SECTIONS.fame, 0, 7)), label: "HALL OF FAME", color: "#ffc93c" },
  interests: { id: "interests", pos: ground(sectionPoint(SECTIONS.lab, 0, 6)), label: "EDGE AI LAB", color: "#3ddc97" },
};

// Everything the visitor can discover (for the "Discovered n / N" counter)
export const ALL_ZONE_IDS = Object.keys(ZONES);
