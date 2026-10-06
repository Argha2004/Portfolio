"use client";
import { useMemo } from "react";
import { samples, SAMPLE_COUNT as N, TRACK_WIDTH, RUNOFF, START_INDEX, apexes } from "./trackData";
import { brakingBoards } from "./Circuit";
import { ExplosiveCrate } from "./Bombs";
import { BrickWall, Fences } from "./bruno";
import { Dynamic, model, SCALE, rng } from "./kit";

// ───────── Trackside obstacles, Bruno Simon style ─────────
// Things to knock over (or blow up) around the circuit, all inside its run-off so they're in play:
//  · crate stacks in the gravel trap on the outside of every corner: run wide and they go off
//  · cones marking the apex of every corner
//  · along the straights, on the inside run-off: brick walls to smash through, crate rows
//    ("bomb alley"), short fence runs and construction barriers with warning lights
const HW = TRACK_WIDTH / 2;
const at = (i) => samples[((Math.round(i) % N) + N) % N];
const off = (s, side) => [s.p.x + s.n.x * side, s.p.z + s.n.z * side];
const along = (s) => Math.atan2(-s.t.z, s.t.x);     // BrickWall runs along (cos r, −sin r)

// Keep the avenue / access-road gaps, the start straight + paddock and the braking boards clear
const fromStart = (i) => Math.min((i - START_INDEX + N) % N, (START_INDEX - i + N) % N);
const blocked = ([x, z]) =>
  Math.abs(x) < 11 || Math.abs(z) < 11 || brakingBoards.some((b) => Math.hypot(b.p.x - x, b.p.z - z) < 5);

function crateStack(out, [x, z], yaw, kind) {
  const sx = Math.cos(yaw) * 0.62, sz = -Math.sin(yaw) * 0.62;
  if (kind === "pair") out.push({ p: [x - sx, 0.6, z - sz], r: yaw }, { p: [x + sx, 0.6, z + sz], r: yaw });
  else if (kind === "tower") out.push({ p: [x - sx, 0.6, z - sz], r: yaw }, { p: [x + sx, 0.6, z + sz], r: yaw }, { p: [x, 1.75, z], r: yaw + 0.3 });
  else for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) {
    const o = (i - (2 - row) / 2) * 2;
    out.push({ p: [x + sx * o, 0.6 + row * 1.12, z + sz * o], r: yaw });
  }
}

function layout() {
  const r = rng(1337);
  const crates = [], cones = [], walls = [], fences = [], barriers = [];
  const cornerZone = new Uint8Array(N);

  // Corners: gravel-trap crates just past the apex, cones on the apex kerb
  apexes.forEach(({ i, turn }, k) => {
    for (let d = -30; d <= 30; d++) cornerZone[(i + d + N) % N] = 1;
    if (fromStart(i) < 50) return;
    const s = at(i + 5), p = off(s, -turn * (HW + RUNOFF * 0.62));
    if (!blocked(p)) crateStack(crates, p, along(s), ["pyramid", "tower", "pair"][k % 3]);
    [-8, 0, 8].forEach((d) => {
      const c = off(at(i + d), turn * (HW + 1.6));
      if (!blocked(c)) cones.push(c);
    });
  });

  // Straights: one feature every ~45 m on the inside run-off, cycling through the kinds
  const KINDS = ["wall", "alley", "barrier", "fence", "wall", "tower"];
  let kind = 0;
  for (let i = START_INDEX + 60; i < START_INDEX + N - 60; i += 45) {
    const idx = i % N, s = at(idx);
    if (cornerZone[idx]) continue;
    const side = -s.out, mid = off(s, side * (HW + RUNOFF * 0.55));
    if (blocked(mid)) continue;
    const k = KINDS[kind++ % KINDS.length];
    if (k === "wall") walls.push({ p: mid, r: along(s) });
    else if (k === "alley") {
      // a row of single crates lining the run-off: one hit sets off the lot
      for (let j = -2; j <= 2; j++) {
        const q = off(at(idx + j * 3.2), side * (HW + RUNOFF * 0.55));
        if (!blocked(q)) crates.push({ p: [q[0], 0.6, q[1]], r: along(s) + (r() - 0.5) * 0.4 });
      }
    } else if (k === "tower") crateStack(crates, mid, along(s), "pyramid");
    else if (k === "barrier") {
      [-3, 3].forEach((j) => {
        const q = off(at(idx + j), side * (HW + RUNOFF * 0.55));
        barriers.push({ p: q, r: along(s) });
      });
      crateStack(crates, off(at(idx + 9), side * (HW + RUNOFF * 0.55)), along(s), "pair");
    } else if (k === "fence") {
      fences.push({ from: off(at(idx - 6), side * (HW + RUNOFF - 0.6)), to: off(at(idx + 6), side * (HW + RUNOFF - 0.6)) });
      crateStack(crates, off(at(idx), side * (HW + 2.2)), along(s), "tower");
    }
  }
  return { crates, cones, walls, fences, barriers };
}

export default function Trackside() {
  const { crates, cones, walls, fences, barriers } = useMemo(layout, []);
  return (
    <group>
      {crates.map((c, i) => <ExplosiveCrate key={`c${i}`} position={c.p} rotation={c.r} />)}
      {cones.map((p, i) => <Dynamic key={`k${i}`} url={model("roads", "construction-cone")} position={[p[0], 0.05, p[1]]} scale={SCALE.roads} density={0.15} />)}
      {walls.map((w, i) => <BrickWall key={`w${i}`} position={[w.p[0], 0, w.p[1]]} rotation={w.r} width={3} rows={3} />)}
      {fences.map((f, i) => <Fences key={`f${i}`} from={f.from} to={f.to} />)}
      {barriers.map((b, i) => <Dynamic key={`b${i}`} url={model("roads", "construction-barrier")} position={[b.p[0], 0.05, b.p[1]]} rotation={b.r} scale={SCALE.roads} density={0.25} />)}
    </group>
  );
}
