"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { education, coursework, awards, certifications, interests } from "@/lib/data";
import { SECTIONS, ZONES, sectionPoint } from "./zones";
import { Pad, FONT, FONT_REG } from "./Props";
import { DistrictSign } from "./Districts";
import { Instanced, model, SCALE } from "./kit";
import { Lanterns, Bushes, Trees, Benches } from "./bruno";

// ───────── Three sections out between the circuit and the adventure trail ─────────
// Campus (education), Hall of Fame (awards & certifications) and the Edge AI Lab (interests).
// Each is built in its own frame whose local +Z faces the (fixed-angle) camera, so the spotlight
// pad sits at the front and everything readable stands behind it, facing the viewer.
// Static pieces have colliders reaching the ground, so nothing overhangs at roof height.
const A = SCALE.arena;
const INK = "#3a2730", CREAM = "#f3ece4";

function Frame({ sec, children }) {
  return <group position={[sec.center[0], 0, sec.center[1]]} rotation-y={sec.yaw}>{children}</group>;
}
// a point in the section's frame → world, for the pieces that are placed in world space
const at = (sec, x, z, extra = {}) => { const [wx, wz] = sectionPoint(sec, x, z); return { p: [wx, 0, wz], ...extra }; };

// A box standing on the ground (or on `y`), with a matching fixed collider
function Block({ size, position, rotation = 0, color, children, emissive, emissiveIntensity = 0 }) {
  const [w, h, d] = size, [x, y = 0, z] = position.length === 2 ? [position[0], 0, position[1]] : position;
  return (
    <group position={[x, y, z]} rotation-y={rotation}>
      <RigidBody type="fixed" colliders={false}><CuboidCollider args={[w / 2, (h + y) / 2, d / 2]} position={[0, (h - y) / 2, 0]} /></RigidBody>
      <mesh position-y={h / 2} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshLambertMaterial color={color} emissive={emissive || "#000000"} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {children}
    </group>
  );
}

// ───────── Campus: one pavilion per school, a giant graduation cap, a pile of coursework books ─────────
const BOOK_COLORS = ["#e5423a", "#5d8ff0", "#ffc93c", "#3ddc97", "#a98bd6", "#ff8a5c"];

function Pavilion({ school, position, rotation, big }) {
  const w = big ? 6 : 4.8, h = big ? 4 : 3.4;
  return (
    <group position={position} rotation-y={rotation}>
      <Block size={[w, 0.5, 3.4]} position={[0, 0]} color={CREAM} />
      {/* back wall with the plaque, two columns in front, lintel + triangular pediment */}
      <Block size={[w, h, 0.4]} position={[0, 0.5, -1.4]} color="#e9dfd3">
        <mesh position={[0, h * 0.62, 0.21]}><planeGeometry args={[w - 1.2, h * 0.62]} /><meshLambertMaterial color="#5a3f55" /></mesh>
        <Text position={[0, h * 0.82, 0.23]} font={FONT} fontSize={big ? 0.36 : 0.28} color="#fff3ea" anchorX="center" maxWidth={w - 1.5} textAlign="center">{school.school}</Text>
        <Text position={[0, h * 0.6, 0.23]} font={FONT_REG} fontSize={0.19} color="#fff3ea" fillOpacity={0.9} anchorX="center" maxWidth={w - 1.6} textAlign="center">{school.degree}</Text>
        <Text position={[0, h * 0.42, 0.23]} font={FONT} fontSize={0.2} color="#ffc93c" anchorX="center">{`${school.period}  ·  ${school.score}`}</Text>
      </Block>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 - 0.45), 0.5, 1.1]}>
          <RigidBody type="fixed" colliders={false}><CuboidCollider args={[0.3, (h + 0.5) / 2, 0.3]} position={[0, (h - 0.5) / 2, 0]} /></RigidBody>
          <mesh position-y={h / 2} castShadow><cylinderGeometry args={[0.24, 0.3, h, 12]} /><meshLambertMaterial color={CREAM} /></mesh>
        </group>
      ))}
      <mesh position={[0, h + 0.65, -0.15]} castShadow><boxGeometry args={[w + 0.3, 0.3, 3.1]} /><meshLambertMaterial color={CREAM} /></mesh>
      <Pediment width={w + 0.3} depth={3.1} height={big ? 1.1 : 0.9} position={[0, h + 0.8, -0.15]} />
    </group>
  );
}

// Triangular gable on top of a pavilion
function Pediment({ width, depth, height, position }) {
  const geometry = useMemo(() => {
    const t = new THREE.Shape();
    t.moveTo(-width / 2, 0); t.lineTo(width / 2, 0); t.lineTo(0, height); t.closePath();
    return new THREE.ExtrudeGeometry(t, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
  }, [width, depth, height]);
  return <mesh geometry={geometry} position={position} castShadow><meshLambertMaterial color="#e9dfd3" /></mesh>;
}

function GradCap({ position }) {
  const cap = useRef();
  useFrame((_, dt) => { if (cap.current) cap.current.rotation.y += dt * 0.5; });
  return (
    <group position={position}>
      <Block size={[1.6, 1.6, 1.6]} position={[0, 0]} color="#d9d2cb" />
      <group ref={cap} position-y={2.15}>
        <mesh castShadow><cylinderGeometry args={[0.85, 0.95, 0.75, 20]} /><meshLambertMaterial color="#2b2730" /></mesh>
        <mesh position-y={0.45} rotation-y={Math.PI / 4} castShadow><boxGeometry args={[2.6, 0.14, 2.6]} /><meshLambertMaterial color="#2b2730" /></mesh>
        <mesh position-y={0.56}><sphereGeometry args={[0.12, 12, 8]} /><meshLambertMaterial color="#ffc93c" /></mesh>
        <mesh position={[0.9, 0.53, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.03, 0.03, 1.8, 6]} /><meshLambertMaterial color="#ffc93c" /></mesh>
        <mesh position={[1.8, 0.1, 0]}><cylinderGeometry args={[0.03, 0.03, 0.9, 6]} /><meshLambertMaterial color="#ffc93c" /></mesh>
        <mesh position={[1.8, -0.45, 0]}><coneGeometry args={[0.16, 0.45, 10]} /><meshLambertMaterial color="#ffc93c" /></mesh>
      </group>
    </group>
  );
}

// Coursework books in a messy pile: knock them over
function Books({ position }) {
  const books = useMemo(() => coursework.map((c, i) => ({ title: c, y: 0.24 + i * 0.47, r: (i % 2 ? 1 : -1) * (0.08 + (i * 0.37) % 0.2), color: BOOK_COLORS[i % BOOK_COLORS.length] })), []);
  return books.map((b, i) => (
    <RigidBody key={b.title} colliders={false} position={[position[0], b.y, position[2]]} rotation={[0, b.r, 0]} linearDamping={0.3} angularDamping={0.4}>
      <CuboidCollider args={[1.05, 0.22, 0.75]} density={0.25} friction={0.8} />
      <mesh castShadow receiveShadow><boxGeometry args={[2.1, 0.44, 1.5]} /><meshLambertMaterial color={b.color} /></mesh>
      <mesh position={[0.06, 0, 0]}><boxGeometry args={[2.0, 0.36, 1.52]} /><meshLambertMaterial color="#fff8ee" /></mesh>
      <Text position={[0, 0, 0.77]} font={FONT} fontSize={0.17} color="#fff8ee" anchorX="center" anchorY="middle" maxWidth={1.9}>{b.title.toUpperCase()}</Text>
    </RigidBody>
  ));
}

export function Campus({ zone, onEnter, onExit }) {
  const sec = SECTIONS.campus;
  const [uni, ...schools] = education;
  return (
    <>
      <Frame sec={sec}>
        <Pavilion school={uni} position={[0, 0, -6.5]} rotation={0} big />
        {schools.map((s, i) => <Pavilion key={s.school} school={s} position={[i ? 7.6 : -7.6, 0, -3.6]} rotation={i ? -0.5 : 0.5} />)}
        <GradCap position={[-8, 0, 4]} />
        <Books position={[8, 0, 3.5]} />
      </Frame>
      <Lanterns items={[at(sec, -3.2, 9.5, { r: 0 }), at(sec, 3.2, 9.5, { r: 1 })]} />
      <Benches items={[at(sec, -5, 1, { r: sec.yaw + Math.PI / 2 }), at(sec, 5, 1, { r: sec.yaw - Math.PI / 2 })]} />
      <Bushes items={[at(sec, -11, -6), at(sec, 11, -6), at(sec, -12, 1, { s: 0.8 }), at(sec, 12, 0, { s: 0.9 })]} />
      <Trees kind="cherry" items={[at(sec, -12.5, -10, { r: 1, s: 1 }), at(sec, 12.5, -10, { r: 2, s: 0.9 })]} />
      <Pad {...ZONES.education} position={ZONES.education.pos} active={zone === "education"} onEnter={onEnter} onExit={onExit} />
      <DistrictSign position={at(sec, 7, 11).p} rotation={sec.yaw} title="CAMPUS" subtitle="Education & coursework" color="#3f6f9a" />
    </>
  );
}

// ───────── Hall of Fame: a podium with trophies down a red carpet, certificates on stands ─────────
function Certificate({ cert, position, rotation }) {
  return (
    <group position={position} rotation-y={rotation}>
      <Block size={[3.4, 3.2, 0.3]} position={[0, 0]} color="#3a2c3d">
        <mesh position={[0, 1.95, 0.16]}><planeGeometry args={[3.0, 2.2]} /><meshLambertMaterial color="#fff6e8" /></mesh>
        <Text position={[0, 2.78, 0.17]} font={FONT} fontSize={0.15} color="#b8862b" anchorX="center" letterSpacing={0.2}>CERTIFICATE</Text>
        <Text position={[0, 2.25, 0.17]} font={FONT} fontSize={0.21} color={INK} anchorX="center" maxWidth={2.7} textAlign="center">{cert.title}</Text>
        <Text position={[0, 1.6, 0.17]} font={FONT_REG} fontSize={0.15} color={INK} fillOpacity={0.8} anchorX="center" maxWidth={2.7} textAlign="center">{cert.issuer}</Text>
        <Text position={[0, 1.15, 0.17]} font={FONT} fontSize={0.15} color="#b8862b" anchorX="center">{cert.date}</Text>
        <mesh position={[1.1, 1.15, 0.17]}><circleGeometry args={[0.2, 20]} /><meshLambertMaterial color="#e5423a" /></mesh>
      </Block>
    </group>
  );
}

function Podium({ award, place, position }) {
  const h = place === 1 ? 1.7 : 1.1;
  const trophy = useRef();
  useFrame((_, dt) => { if (trophy.current) trophy.current.rotation.y += dt * (place === 1 ? 0.6 : -0.45); });
  return (
    <group position={position}>
      <Block size={[3.2, h, 2.6]} position={[0, 0]} color={CREAM}>
        <Text position={[0, h * 0.62, 1.31]} font={FONT} fontSize={0.62} color={place === 1 ? "#d9a520" : "#9aa3ad"} anchorX="center" anchorY="middle">{place}</Text>
        <Text position={[0, h * 0.22, 1.31]} font={FONT} fontSize={0.16} color={INK} anchorX="center" anchorY="middle" maxWidth={3}>{`${award.title} · ${award.year}`}</Text>
      </Block>
      <group ref={trophy} position-y={h}>
        <Instanced url={model("arena", "trophy")} items={[{ p: [0, 0, 0], r: 0, s: A * (place === 1 ? 1.3 : 1) }]} />
      </group>
    </group>
  );
}

export function HallOfFame({ zone, onEnter, onExit }) {
  const sec = SECTIONS.fame;
  const ranked = awards.slice(0, 2);
  return (
    <>
      <Frame sec={sec}>
        {/* red carpet from the pad to the podium */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 1.5]} receiveShadow>
          <planeGeometry args={[2.8, 11]} />
          <meshLambertMaterial color="#b3261e" />
        </mesh>
        {[-1, 1].map((s) => <mesh key={s} rotation-x={-Math.PI / 2} position={[s * 1.45, 0.04, 1.5]}><planeGeometry args={[0.12, 11]} /><meshLambertMaterial color="#ffc93c" /></mesh>)}
        {ranked.map((a, i) => <Podium key={a.title} award={a} place={i + 1} position={i === 0 ? [0, 0, -5.5] : [-3.4, 0, -5.2]} />)}
        <Block size={[3.2, 0.7, 2.6]} position={[3.4, -5.2]} color={CREAM}>
          <Text position={[0, 0.38, 1.31]} font={FONT} fontSize={0.36} color="#b07a4a" anchorX="center" anchorY="middle">3</Text>
          <Text position={[0, 0.72, 0]} rotation-x={-Math.PI / 2} font={FONT_REG} fontSize={0.2} color={INK} anchorX="center" anchorY="middle" maxWidth={2.8} textAlign="center">Your project next?</Text>
        </Block>
        {certifications.map((c, i) => {
          const spots = [[-8.6, -0.5, 0.75], [8.6, -0.5, -0.75], [-7.8, -6.2, 0.45], [7.8, -6.2, -0.45]];
          const [x, z, r] = spots[i % spots.length];
          return <Certificate key={c.title} cert={c} position={[x, 0, z]} rotation={r} />;
        })}
        <Instanced url={model("arena", "banner")} items={[{ p: [-5.5, 0, -9.5], r: 0, s: A }, { p: [5.5, 0, -9.5], r: 0, s: A }]} />
      </Frame>
      <Lanterns items={[at(sec, -2.4, 7.5, { r: 0 }), at(sec, 2.4, 7.5, { r: 0.6 }), at(sec, -2.4, 2, { r: 1.2 }), at(sec, 2.4, 2, { r: 2 })]} />
      <Bushes items={[at(sec, -12, -8), at(sec, 12, -8), at(sec, -12.5, 3, { s: 0.8 }), at(sec, 12.5, 3, { s: 0.8 })]} />
      <Pad {...ZONES.achievements} position={ZONES.achievements.pos} active={zone === "achievements"} onEnter={onEnter} onExit={onExit} />
      <DistrictSign position={at(sec, -7, 11).p} rotation={sec.yaw} title="HALL OF FAME" subtitle="Awards & certifications" color="#8a5a1f" />
    </>
  );
}

// ───────── Edge AI Lab: a giant microchip, a Raspberry Pi, glowing monoliths for each interest ─────────
const GLOW = ["#3ddc97", "#6ec6ff", "#c86bff"];

function Microchip({ position }) {
  const pins = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const o = -2.4 + i * 0.8;
      out.push([o, 3.45, 0], [o, -3.45, 0], [3.45, o, Math.PI / 2], [-3.45, o, Math.PI / 2]);
    }
    return out;
  }, []);
  const core = useRef();
  useFrame((st) => { if (core.current) core.current.emissiveIntensity = 0.8 + Math.sin(st.clock.elapsedTime * 2.2) * 0.5; });
  return (
    <group position={position}>
      <Block size={[6.2, 0.55, 6.2]} position={[0, 0]} color="#25212b" />
      <mesh position={[0, 0.6, 0]} receiveShadow><boxGeometry args={[4.6, 0.1, 4.6]} /><meshLambertMaterial color="#34303b" /></mesh>
      <mesh position={[0, 0.66, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshLambertMaterial ref={core} color="#123a2c" emissive="#3ddc97" emissiveIntensity={1} />
      </mesh>
      <Text position={[0, 0.67, 1.65]} rotation-x={-Math.PI / 2} font={FONT} fontSize={0.62} color="#3ddc97" anchorX="center" anchorY="middle">EDGE AI</Text>
      <Text position={[0, 0.67, -1.6]} rotation-x={-Math.PI / 2} font={FONT_REG} fontSize={0.26} color="#cfc7d6" anchorX="center" anchorY="middle">INT8 · ONNX · YOLO11</Text>
      {pins.map(([x, z, r], i) => (
        <mesh key={i} position={[x, 0.22, z]} rotation-y={r} castShadow><boxGeometry args={[0.32, 0.14, 0.9]} /><meshLambertMaterial color="#e0b04a" /></mesh>
      ))}
    </group>
  );
}

function RaspberryPi({ position, rotation }) {
  return (
    <group position={position} rotation-y={rotation}>
      <Block size={[4.4, 0.55, 3]} position={[0, 0]} color="#1f8a4c">
        <mesh position={[-0.6, 0.62, 0.1]} castShadow><boxGeometry args={[0.9, 0.12, 0.9]} /><meshLambertMaterial color="#1c1a1e" /></mesh>
        <mesh position={[0.6, 0.6, -0.2]}><boxGeometry args={[0.7, 0.1, 0.5]} /><meshLambertMaterial color="#1c1a1e" /></mesh>
        {[0.55, -0.35].map((z) => <mesh key={z} position={[1.8, 0.85, z]} castShadow><boxGeometry args={[0.9, 0.6, 0.75]} /><meshLambertMaterial color="#c9c4c9" /></mesh>)}
        <mesh position={[-0.4, 0.68, -1.25]}><boxGeometry args={[3.2, 0.2, 0.22]} /><meshLambertMaterial color="#1c1a1e" /></mesh>
        <Text position={[-0.6, 0.57, 1.05]} rotation-x={-Math.PI / 2} font={FONT} fontSize={0.24} color="#eaf7ee" anchorX="center" anchorY="middle">Raspberry Pi</Text>
      </Block>
    </group>
  );
}

function Monolith({ label, position, rotation, color }) {
  const glow = useRef();
  useFrame((st) => { if (glow.current) glow.current.emissiveIntensity = 1.6 + Math.sin(st.clock.elapsedTime * 1.7 + position[0]) * 0.6; });
  return (
    <group position={position} rotation-y={rotation}>
      <Block size={[2.3, 2.9, 0.5]} position={[0, 0]} color="#2b2730">
        <Text position={[0, 1.55, 0.26]} font={FONT} fontSize={0.22} color="#f3ece4" anchorX="center" anchorY="middle" maxWidth={2} textAlign="center">{label}</Text>
      </Block>
      <mesh position={[0, 2.97, 0]}>
        <boxGeometry args={[2.3, 0.14, 0.52]} />
        <meshLambertMaterial ref={glow} color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

function Dish({ position }) {
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}><CuboidCollider args={[0.25, 1.7, 0.25]} position={[0, 1.7, 0]} /></RigidBody>
      <mesh position-y={1.7} castShadow><cylinderGeometry args={[0.13, 0.2, 3.4, 10]} /><meshLambertMaterial color="#d9d2cb" /></mesh>
      <group position-y={3.6} rotation={[-0.7, 0.6, 0]}>
        <mesh castShadow><sphereGeometry args={[1.5, 28, 10, 0, Math.PI * 2, 0, 0.75]} /><meshLambertMaterial color="#f3ece4" side={2} /></mesh>
        <mesh position-y={-0.6}><cylinderGeometry args={[0.04, 0.04, 1.6, 6]} /><meshLambertMaterial color="#9aa3ad" /></mesh>
        <mesh position-y={-1.38}><sphereGeometry args={[0.12, 10, 8]} /><meshLambertMaterial color="#e5423a" /></mesh>
      </group>
    </group>
  );
}

export function EdgeLab({ zone, onEnter, onExit }) {
  const sec = SECTIONS.lab;
  const ring = useMemo(() => interests.map((label, i) => {
    const a = Math.PI * (1.15 + (i / Math.max(interests.length - 1, 1)) * 0.7); // a half circle behind the chip
    return { label, x: Math.cos(a) * 8.6, z: Math.sin(a) * 8.6 + 0.5, r: -a - Math.PI / 2, color: GLOW[i % GLOW.length] };
  }), []);
  return (
    <>
      <Frame sec={sec}>
        <Microchip position={[0, 0, -2]} />
        {ring.map((m) => <Monolith key={m.label} label={m.label} position={[m.x, 0, m.z]} rotation={m.r} color={m.color} />)}
        <RaspberryPi position={[-7.6, 0, 3.4]} rotation={0.5} />
        <Dish position={[8.2, 0, 3]} />
      </Frame>
      <Lanterns items={[at(sec, -3, 8.5, { r: 0 }), at(sec, 3, 8.5, { r: 2 })]} />
      <Bushes items={[at(sec, -11, 2), at(sec, 11, -1, { s: 0.85 })]} a="#7cc46a" b="#a8d86a" />
      <Pad {...ZONES.interests} position={ZONES.interests.pos} active={zone === "interests"} onEnter={onEnter} onExit={onExit} />
      <DistrictSign position={at(sec, 6.5, 10).p} rotation={sec.yaw} title="EDGE AI LAB" subtitle="What I'm exploring" color="#1f6b4a" />
    </>
  );
}
