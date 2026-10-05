"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { pillars } from "@/lib/data";
import { Instanced, Placed, Dynamic, model, SCALE, rng } from "./kit";
import { DISTRICTS, ZONES, ISLAND_R, nearRoad } from "./zones";
import { Pad, SkillCubes, AboutBoard, GroundText, FONT, FONT_REG } from "./Props";
import { Ramp } from "./Atmosphere";
import { Trees, Bushes, PoleLights, Lanterns, Benches, BrickWall, ExplosiveCrate } from "./bruno";

const G = SCALE.graveyard, F = SCALE.forest, A = SCALE.arena, R = SCALE.roads;

// A labelled post sign (used to name each district at its entrance)
function DistrictSign({ position, rotation = 0, title, subtitle, color = "#5a2d2a" }) {
  return (
    <group position={position} rotation-y={rotation}>
      <RigidBody type="fixed" colliders={false}><CuboidCollider args={[2.4, 1.6, 0.2]} position={[0, 2.4, 0]} /></RigidBody>
      {[-1.9, 1.9].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]} castShadow><boxGeometry args={[0.22, 2.4, 0.22]} /><meshStandardMaterial color="#6b3b35" /></mesh>
      ))}
      <mesh position={[0, 2.9, 0]} castShadow><boxGeometry args={[4.8, 1.5, 0.25]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      <Text position={[0, 3.1, 0.14]} font={FONT} fontSize={0.48} color="#fff3ea" anchorX="center">{title}</Text>
      <Text position={[0, 2.55, 0.14]} font={FONT_REG} fontSize={0.22} color="#fff3ea" fillOpacity={0.8} anchorX="center">{subtitle}</Text>
    </group>
  );
}

// ───────── Skills Camp (forest kit) ─────────
export function SkillsCamp({ zone, onEnter, onExit, tags }) {
  const [cx, cz] = DISTRICTS.camp.center;
  const trees = useMemo(() => {
    const r = rng(21), out = { oak: [], birch: [], pine: [] };
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, d = 19 + r() * 22;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (nearRoad(x, z, 7) || (Math.abs(x - cx) < 6 && z > cz)) continue; // keep the south entrance open
      const kind = ["oak", "oak", "birch", "pine"][Math.floor(r() * 4)];
      out[kind].push({ p: [x, 0, z], r: r() * 6.28, s: kind === "pine" ? G * (0.8 + r() * 0.5) : 0.8 + r() * 0.5 });
    }
    return out;
  }, [cx, cz]);
  const tents = [[-12, -6, 0.6], [12, -8, -0.7], [-14, 8, 2.2]].map(([x, z, r]) => ({ p: [cx + x, 0, cz + z], r, s: F }));
  const logs = [[-3, 2.2, 0], [3, 2.2, 0], [0, -3, Math.PI / 2]].map(([x, z, r]) => ({ p: [cx + x, 0, cz + z], r, s: G }));
  const rocks = [[16, 6], [-18, -14], [8, 16]].map(([x, z], i) => ({ p: [cx + x, 0, cz + z], r: i, s: F }));
  const fire = useRef();
  useFrame((st) => { if (fire.current) fire.current.intensity = 14 + Math.sin(st.clock.elapsedTime * 13) * 3 + Math.sin(st.clock.elapsedTime * 7) * 2; });

  return (
    <group>
      <Trees kind="oak" items={trees.oak} />
      <Trees kind="birch" items={trees.birch} />
      <Placed url={model("graveyard", "pine")} items={trees.pine} collider="trunk" />
      <Placed url={model("forest", "tent")} items={tents} />
      <Placed url={model("graveyard", "trunk")} items={logs} />
      <Placed url={model("forest", "rocks-high")} items={rocks} />
      {/* Campfire */}
      <Placed url={model("graveyard", "fire-basket")} items={[{ p: [cx, 0, cz], r: 0, s: G }]} />
      <pointLight ref={fire} position={[cx, 1.4, cz]} color="#ff8a3d" distance={18} intensity={14} />
      {/* Lookout tower: structure + roof + flag */}
      <Placed url={model("forest", "building-structure")} items={[{ p: [cx + 14, 0, cz - 14], r: 0.4, s: F }]} />
      <Instanced url={model("forest", "building-roof")} items={[{ p: [cx + 14, F, cz - 14], r: 0.4, s: F }]} />
      {/* Archery range: one target per skill area */}
      {pillars.map((p, i) => {
        const x = cx - 8 + i * 8, z = cz - 16;
        return (
          <group key={p.title}>
            <Placed url={model("forest", "target")} items={[{ p: [x, 0, z], r: 0, s: F }]} />
            <Text position={[x, 2.8, z + 0.2]} font={FONT} fontSize={0.34} color="#5a2d2a" anchorX="center" maxWidth={6} textAlign="center">{p.title}</Text>
          </group>
        );
      })}
      <SkillCubes tags={tags} position={[cx + 2, 0, cz + 14]} />
      <Pad {...ZONES.skills} position={ZONES.skills.pos} active={zone === "skills"} onEnter={onEnter} onExit={onExit} />
      <DistrictSign position={[cx - 7, 0, cz + 22]} title="SKILLS CAMP" subtitle="Tools, frameworks & languages" color="#7a5a2a" />
    </group>
  );
}

// ───────── Research Arena (mini-arena kit) ─────────
export function ResearchArena({ zone, onEnter, onExit }) {
  const [cx, cz] = DISTRICTS.arena.center;
  const half = 4; // walls run from -4..4 tiles (×4 m) around the centre
  const { walls, floor, columns } = useMemo(() => {
    const walls = [], floor = [], columns = [];
    for (let i = -half; i <= half; i++) {
      walls.push({ p: [cx + i * A, 0, cz - (half + 0.5) * A], r: 0, s: A });
      if (Math.abs(i) > 1) walls.push({ p: [cx + i * A, 0, cz + (half + 0.5) * A], r: Math.PI, s: A }); // gate gap in the south wall
      walls.push({ p: [cx - (half + 0.5) * A, 0, cz + i * A], r: Math.PI / 2, s: A });
      walls.push({ p: [cx + (half + 0.5) * A, 0, cz + i * A], r: -Math.PI / 2, s: A });
      for (let j = -half; j <= half; j++) floor.push({ p: [cx + i * A, 0.01, cz + j * A], r: 0, s: A });
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) columns.push({ p: [cx + sx * (half + 0.5) * A, 0, cz + sz * (half + 0.5) * A], r: 0, s: A * 1.3 });
    columns.push({ p: [cx - 1.6 * A, 0, cz + (half + 0.5) * A], r: 0, s: A * 1.2 }, { p: [cx + 1.6 * A, 0, cz + (half + 0.5) * A], r: 0, s: A * 1.2 });
    return { walls, floor, columns };
  }, [cx, cz]);
  const trophy = useRef();
  useFrame((_, dt) => { if (trophy.current) trophy.current.rotation.y += dt * 0.6; });

  return (
    <group>
      <Instanced url={model("arena", "floor")} items={floor} castShadow={false} />
      <Placed url={model("arena", "wall")} items={walls} />
      <Placed url={model("arena", "column")} items={columns} />
      <Placed url={model("arena", "statue")} items={[{ p: [cx - 9, 0, cz - 10], r: 0.4, s: A }, { p: [cx + 9, 0, cz - 10], r: -0.4, s: A }]} />
      <Instanced url={model("arena", "banner")} items={[-8, -3, 3, 8].map((x) => ({ p: [cx + x, 0.6, cz - (half + 0.5) * A + 1.3], r: 0, s: A }))} />
      <Placed url={model("arena", "weapon-rack")} items={[{ p: [cx - 13, 0, cz + 6], r: Math.PI / 2, s: A }, { p: [cx + 13, 0, cz + 6], r: -Math.PI / 2, s: A }]} />
      {/* Podium: stacked blocks with a giant spinning trophy */}
      <Placed url={model("arena", "block")} items={[{ p: [cx, 0, cz - 10], r: 0, s: [A * 2, A, A * 2] }, { p: [cx, A * 0.5, cz - 10], r: 0, s: [A * 1.2, A, A * 1.2] }]} />
      <group ref={trophy} position={[cx, A, cz - 10]}>
        <Instanced url={model("arena", "trophy")} items={[{ p: [0, 0, 0], r: 0, s: A * 1.6 }]} />
      </group>
      <Text position={[cx, 1.2, cz - 5.95]} font={FONT} fontSize={0.5} color="#fff3ea" anchorX="center">IEEE COMSNETS 2026</Text>
      <Text position={[cx, 0.6, cz - 5.95]} font={FONT_REG} fontSize={0.26} color="#fff3ea" fillOpacity={0.85} anchorX="center">CrowdLense — Demos &amp; Exhibits Track</Text>
      <Placed url={model("arena", "character-soldier")} items={[{ p: [cx - 3, 0, cz + 17], r: Math.PI, s: A * 0.8 }, { p: [cx + 3, 0, cz + 17], r: Math.PI, s: A * 0.8 }]} />
      <Pad {...ZONES.research} position={ZONES.research.pos} active={zone === "research"} onEnter={onEnter} onExit={onExit} />
      <DistrictSign position={[cx + 10, 0, cz + 24]} title="RESEARCH ARENA" subtitle="Publications & honours" color="#3f6f66" />
    </group>
  );
}

// ───────── Design Graveyard (easter egg: every previous design of this site) ─────────
const GRAVES = [
  ["v1", "Fluid sim"], ["v2", "Editorial"], ["v3", "Particles"], ["v4", "Research paper"],
  ["v5", "Liquid chrome"], ["v6", "Liquid red"], ["v7", "3D room"],
];
export function DesignGraveyard({ zone, onEnter, onExit }) {
  const [cx, cz] = DISTRICTS.graveyard.center;
  const fence = useMemo(() => {
    const items = [], n = 6; // each iron-fence piece is 1 unit → G metres long
    for (let i = -n; i < n; i++) {
      const o = (i + 0.5) * G;
      if (Math.abs(o) > 4) items.push({ p: [cx + o, 0, cz - n * G], r: 0, s: G }); // gap in the north side
      items.push({ p: [cx + o, 0, cz + n * G], r: Math.PI, s: G });
      items.push({ p: [cx - n * G, 0, cz + o], r: Math.PI / 2, s: G });
      items.push({ p: [cx + n * G, 0, cz + o], r: -Math.PI / 2, s: G });
    }
    return items;
  }, [cx, cz]);
  const pines = useMemo(() => {
    const r = rng(5), out = [];
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 23 + r() * 12;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!nearRoad(x, z, 7)) out.push({ p: [x, 0, z], r: r() * 6, s: G * (0.9 + r() * 0.5) });
    }
    return out;
  }, [cx, cz]);
  const ghost = useRef();
  useFrame((st) => {
    if (!ghost.current) return;
    const t = st.clock.elapsedTime;
    ghost.current.position.set(cx + Math.sin(t * 0.4) * 8, 1.5 + Math.sin(t * 2) * 0.4, cz + 8 + Math.cos(t * 0.4) * 4);
    ghost.current.rotation.y = t * 0.4 + Math.PI / 2;
  });

  return (
    <group>
      <Placed url={model("graveyard", "iron-fence")} items={fence} shrink={0.95} />
      <Placed url={model("graveyard", "pine-crooked")} items={pines} collider="trunk" />
      <Placed url={model("graveyard", "crypt-large")} items={[{ p: [cx, 0, cz + 11], r: Math.PI, s: G }]} />
      <Placed url={model("graveyard", "lightpost-single")} items={[{ p: [cx - 5, 0, cz - 17], r: 0, s: G }, { p: [cx + 5, 0, cz - 17], r: Math.PI, s: G }]} collider="trunk" />
      {/* One knock-over-able gravestone per retired design */}
      {GRAVES.map(([v, name], i) => {
        const x = cx - 10.5 + i * 3.5, z = cz - 2;
        return (
          <Dynamic key={v} url={model("graveyard", "gravestone-round")} position={[x, 0.05, z]} scale={G * 1.15} density={0.5}>
            <Text position={[0, 1.45, 0.46]} font={FONT} fontSize={0.3} color="#2b2230" anchorX="center">{v}</Text>
            <Text position={[0, 1.1, 0.46]} font={FONT_REG} fontSize={0.16} color="#2b2230" anchorX="center" maxWidth={1.2} textAlign="center">{name}</Text>
            <Text position={[0, 0.78, 0.46]} font={FONT_REG} fontSize={0.12} color="#2b2230" fillOpacity={0.7} anchorX="center">R.I.P. 2026</Text>
          </Dynamic>
        );
      })}
      {[[-9, 6], [-4, 7], [5, 6], [9, 7], [-12, -9], [12, -10]].map(([x, z], i) => (
        <Dynamic key={i} url={model("graveyard", ["gravestone-cross", "gravestone-broken", "gravestone-bevel"][i % 3])} position={[cx + x, 0.05, cz + z]} rotation={(i % 3) * 0.2} scale={G} density={0.5} />
      ))}
      {[[-14, -14], [14, -13], [-13, 14], [13, 14], [0, -12], [-6, 12], [7, 12], [16, 3]].map(([x, z], i) => (
        <Dynamic key={`p${i}`} url={model("graveyard", i % 2 ? "pumpkin-carved" : "pumpkin")} position={[cx + x, 0.05, cz + z]} rotation={i} scale={G} density={0.25} />
      ))}
      <group ref={ghost}><Instanced url={model("graveyard", "character-ghost")} items={[{ p: [0, 0, 0], r: 0, s: G * 1.4 }]} /></group>
      <Pad {...ZONES.graveyard} position={ZONES.graveyard.pos} active={zone === "graveyard"} onEnter={onEnter} onExit={onExit} />
      <DistrictSign position={[cx + 9, 0, cz - 24]} title="DESIGN GRAVEYARD" subtitle="Every portfolio I scrapped" color="#4b3f6b" />
    </group>
  );
}

// ───────── The Village: About, Contact and a construction site ─────────
export function Village({ zone, onEnter, onExit }) {
  const [cx, cz] = DISTRICTS.village.center;
  const fence = useMemo(() => {
    const items = [];
    const ox = cx + 10, oz = cz + 18;
    for (let i = -3; i <= 3; i++) {
      items.push({ p: [ox + i * 3, 0, oz - 9], r: Math.PI / 2, s: R }, { p: [ox + i * 3, 0, oz + 9], r: Math.PI / 2, s: R });
    }
    for (let i = -2; i <= 2; i++) items.push({ p: [ox - 10.5, 0, oz + i * 3], r: 0, s: R }, { p: [ox + 10.5, 0, oz + i * 3], r: 0, s: R });
    return items;
  }, [cx, cz]);
  const ox = cx + 10, oz = cz + 18;
  const benches = [[-4, 4], [4, 4]].map(([x, z]) => ({ p: [cx + x, 0, cz + z], r: 0 }));

  return (
    <group>
      <AboutBoard position={ZONES.about.pos} lines={["ABOUT ME", "AI/ML & Edge AI engineer", "B.Tech CSBS · 2023–27", "West Bengal, India"]} />
      <Pad {...ZONES.about} position={ZONES.about.pos} active={zone === "about"} onEnter={onEnter} onExit={onExit} />
      <Benches items={benches} />
      <Lanterns items={[[-9, -12], [9, -12], [-14, 8], [-18, -4]].map(([x, z], i) => ({ p: [cx + x, 0, cz + z], r: i }))} />
      <Bushes items={[[-12, -14], [12, -15], [-20, 10], [-22, -2], [16, 2]].map(([x, z], i) => ({ p: [cx + x, 0, cz + z], s: 0.9 + (i % 3) * 0.2 }))} />
      <Trees kind="cherry" items={[[-16, -10], [18, -8], [-24, 4]].map(([x, z], i) => ({ p: [cx + x, 0, cz + z], r: i * 2, s: 1 }))} />
      {/* Explosive crates on the construction site: drive into one */}
      {[[-6, 0, 0], [-4.8, 0.6, 0], [-5.4, 0.3, 1], [5, -1, 0], [6.1, -1.4, 0]].map(([x, z, up], i) => (
        <ExplosiveCrate key={`x${i}`} position={[ox + x, 0.6 + up * 1.1, oz + z]} />
      ))}
      <Placed url={model("roads", "construction-fence")} items={fence} />
      <Placed url={model("roads", "construction-light")} items={[[-8, -7], [8, -7], [-8, 7], [8, 7]].map(([x, z]) => ({ p: [ox + x, 0, oz + z], r: 0, s: R }))} collider="trunk" />
      {[[-5, -4], [-3, -3], [-1, -4], [2, 2], [4, 3], [6, 1], [-6, 3], [0, 5]].map(([x, z], i) => (
        <Dynamic key={`c${i}`} url={model("roads", "construction-cone")} position={[ox + x, 0.05, oz + z]} scale={R} density={0.15} />
      ))}
      {[[-3, 0], [3, -2], [0, -6]].map(([x, z], i) => (
        <Dynamic key={`b${i}`} url={model("roads", "construction-barrier")} position={[ox + x, 0.05, oz + z]} rotation={i} scale={R} density={0.2} />
      ))}
      <Dynamic url={model("roads", "dumpster")} position={[ox + 6, 0.4, oz - 5]} rotation={0.3} scale={R} density={0.3} />
      <DistrictSign position={[ox, 0, oz - 10.5]} title="UNDER CONSTRUCTION" subtitle="My next project is being built here" color="#c2702a" />
      <DistrictSign position={[cx - 10, 0, cz - 24]} title="THE VILLAGE" subtitle="About me · Contact" color="#6b4a8a" />
    </group>
  );
}

// ───────── Outskirts: forest belt, ramps on the ring road, hay bales to smash ─────────
export function Outskirts() {
  const trees = useMemo(() => {
    const r = rng(77), out = { oak: [], birch: [], cherry: [], pine: [], bush: [] };
    for (let i = 0; i < 640; i++) { // the island grew: more forest for the outer ring
      const a = r() * Math.PI * 2, d = 70 + r() * (ISLAND_R - 76); // trees fill the gaps inside and outside the circuit
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (nearRoad(x, z, 8)) continue;
      const kind = ["oak", "oak", "birch", "birch", "cherry", "pine", "bush"][Math.floor(r() * 7)];
      const s = kind === "pine" ? G * (0.8 + r() * 0.6) : kind === "bush" ? 0.8 + r() * 0.6 : 0.85 + r() * 0.5;
      out[kind].push({ p: [x, 0, z], r: r() * 6.28, s });
    }
    return out;
  }, []);
  const rocks = useMemo(() => {
    const r = rng(9), out = [];
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2, d = 20 + r() * (ISLAND_R - 30);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!nearRoad(x, z, 9)) out.push({ p: [x, 0, z], r: r() * 6, s: G * (0.8 + r()) });
    }
    return out;
  }, []);
  // Ramps sit on the avenues (the circuit itself stays clean, like a real track)
  const ramps = [
    [0, 50, Math.PI], [70, 0, -Math.PI / 2], [-70, 0, Math.PI / 2],
  ];

  return (
    <group>
      <Trees kind="oak" items={trees.oak} />
      <Trees kind="birch" items={trees.birch} />
      <Trees kind="cherry" items={trees.cherry} />
      <Bushes items={trees.bush} />
      <Placed url={model("graveyard", "pine")} items={trees.pine} collider="trunk" />
      <Placed url={model("graveyard", "rocks")} items={rocks} />
      {/* A brick wall past the south ramp: jump into it */}
      <BrickWall position={[0, 0, 66]} width={5} rows={3} />
      {ramps.map(([x, z, r], i) => <Ramp key={i} position={[x, 0, z]} rotationY={r} length={7} angle={0.3} />)}
      {/* Hay-bale walls past two of the ramps */}
      {[[86, 0], [-86, 0]].flatMap(([x, z], k) =>
        [-2, -1, 0, 1, 2].flatMap((i) => [0, 1].map((row) => (
          <Dynamic key={`h${k}${i}${row}`} url={model("graveyard", "hay-bale")} position={[x, 0.6 + row * 1.1, z + i * 1.9]} rotation={Math.PI / 2} scale={G} density={0.12} />
        ))))}
      <GroundText position={[60, 0, 0]} size={0.8} rotation={-Math.PI / 2}>JUMP</GroundText>
      <GroundText position={[-60, 0, 0]} size={0.8} rotation={Math.PI / 2}>JUMP</GroundText>
    </group>
  );
}

// ───────── Spawn garden: the little diorama shown on the intro screen ─────────
export function SpawnGarden({ center }) {
  const [x, z] = center;
  return (
    <group>
      <Trees kind="cherry" items={[{ p: [x - 5.6, 0, z - 3.6], r: 0.4, s: 0.8 }]} />
      <Trees kind="oak" items={[{ p: [x + 5.4, 0, z - 4], r: 1.2, s: 0.75 }, { p: [x - 6.3, 0, z + 2.2], r: 2, s: 0.65 }]} />
      <PoleLights items={[{ p: [x - 4.8, 0, z + 2.6], r: 0 }]} lights={1} />
      <Benches items={[{ p: [x - 5.4, 0, z - 1.2], r: Math.PI / 2 }]} />
      <Bushes items={[{ p: [x - 5.8, 0, z + 0.8], s: 0.8 }, { p: [x + 5.4, 0, z + 1.5], s: 0.9 }, { p: [x + 4.6, 0, z - 2.6], s: 0.7 }]} />
      <Lanterns items={[{ p: [x + 3.8, 0, z + 4.4], r: 0.5 }]} />
    </group>
  );
}
