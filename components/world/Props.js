"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Text, Text3D, Center, useFont } from "@react-three/drei";
import * as THREE from "three";
import { cycle } from "./dayCycle";
import { LightPools } from "./bruno";

export const FONT = "/fonts/inter-800.woff";
export const FONT_REG = "/fonts/inter-500.woff";
const INK = "#5a2d2a";

// Flat text painted on the ground
export function GroundText({ children, position, size = 0.9, rotation = 0, color = INK, opacity = 0.75 }) {
  return (
    <Text position={[position[0], 0.03, position[2]]} rotation={[-Math.PI / 2, 0, rotation]} font={FONT} fontSize={size} color={color} fillOpacity={opacity} anchorX="center" anchorY="middle" letterSpacing={0.04}>
      {children}
    </Text>
  );
}

// ───────── Name sign: physics letters you can crash into ─────────
// One or more rows (later rows sit in front, so they read top-to-bottom from the camera),
// spaced by each glyph's real width. Chunky two-tone letters (cream faces, coral sides) that
// turn into a neon sign at night: faces glow warm white, sides glow orange (picked up by the
// bloom), and a soft pool of light spreads on the ground under each row.
const FONT_3D = "/fonts/helvetiker_bold.typeface.json";
const signFace = new THREE.MeshLambertMaterial({ color: "#fff3e8", emissive: "#ffe2b8", emissiveIntensity: 0 });
const signSide = new THREE.MeshLambertMaterial({ color: "#ff6a4d", emissive: "#ff5a2e", emissiveIntensity: 0 });

export function Letters({ lines = ["ARGHADEEP", "PAKHIRA"], x = 0, z = -9, size = 1.6, gap = 0.16, rowGap = 2.7 }) {
  const font = useFont(FONT_3D);
  const rows = useMemo(() => {
    const { glyphs, resolution } = font.data;
    return lines.map((line, r) => {
      const chars = [...line].map((ch) => ({ ch, w: ((glyphs[ch]?.ha ?? 700) / resolution) * size }));
      const width = chars.reduce((t, c) => t + c.w, 0) + gap * (chars.length - 1);
      let cursor = x - width / 2;
      const rz = z + r * rowGap;
      const letters = chars.map((c) => { const cx = cursor + c.w / 2; cursor += c.w + gap; return { ...c, x: cx, z: rz }; });
      return { letters, z: rz, width };
    });
  }, [font, lines, x, z, size, gap, rowGap]);
  const pools = useMemo(() => rows.flatMap((row) => {
    const n = Math.max(2, Math.round(row.width / 5));
    return Array.from({ length: n }, (_, i) => [x - row.width / 2 + (row.width * (i + 0.5)) / n, 0, row.z]);
  }), [rows, x]);
  useFrame(() => {
    const n = cycle.nightAmount;
    signFace.emissiveIntensity = n * 1.25;
    signSide.emissiveIntensity = 0.05 + n * 1.1;
  });
  const h = size * 0.72; // cap height of the bold face
  return (
    <>
      {rows.flatMap((row) => row.letters.map((l, i) => l.ch === " " ? null : (
        <RigidBody key={`${row.z}-${i}`} colliders={false} position={[l.x, h / 2 + 0.03, l.z]} linearDamping={0.4} angularDamping={0.4}>
          <CuboidCollider args={[l.w * 0.46, h / 2, 0.38]} density={0.6} friction={0.6} />
          <Center>
            <Text3D font={FONT_3D} size={size} height={0.7} bevelEnabled bevelSize={0.05} bevelThickness={0.06} bevelSegments={3} curveSegments={10} material={[signFace, signSide]} castShadow receiveShadow>
              {l.ch}
            </Text3D>
          </Center>
        </RigidBody>
      )))}
      <LightPools points={pools} radius={4.5} color="#ff9a5c" strength={0.9} />
    </>
  );
}

// ───────── Zone pad: a glowing disc that detects the car ─────────
export function Pad({ id, position, color, label, active, onEnter, onExit }) {
  const ring = useRef();
  useFrame((st) => {
    const s = 1 + Math.sin(st.clock.elapsedTime * 3) * 0.04 + (active ? 0.08 : 0);
    ring.current.scale.set(s, s, s);
  });
  const isCar = (e) => e.other.rigidBodyObject?.name === "car";
  // The car has several colliders and each reports its own enter / exit: count them, so the
  // panel only closes once the whole car has left (not when one part pokes out of the sensor)
  const inside = useRef(0);
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <circleGeometry args={[2.3, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.55 : 0.18} roughness={0.7} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.04}>
        <ringGeometry args={[2.45, 2.7, 64]} />
        <meshBasicMaterial color={active ? "#ffffff" : color} transparent opacity={0.9} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider sensor args={[2, 1.2, 2]} position={[0, 1.2, 0]}
          onIntersectionEnter={(e) => { if (isCar(e) && inside.current++ === 0) onEnter(id); }}
          onIntersectionExit={(e) => { if (isCar(e) && --inside.current <= 0) { inside.current = 0; onExit(id); } }} />
      </RigidBody>
      {label && <GroundText position={[0, 0, 3.4]} size={0.7}>{label}</GroundText>}
    </group>
  );
}

// ───────── Skill cubes pyramid ─────────
const CUBE_COLORS = ["#ffd9a8", "#ffc285", "#f7e0c9", "#ffb38a"];
export function SkillCubes({ tags, position }) {
  const cubes = useMemo(() => {
    const out = [];
    const rows = [4, 3, 2, 1];
    let k = 0;
    rows.forEach((n, row) => {
      for (let i = 0; i < n; i++) {
        out.push({ tag: tags[k % tags.length], x: (i - (n - 1) / 2) * 1.32, y: 0.62 + row * 1.25, color: CUBE_COLORS[k % 4] });
        k++;
      }
    });
    return out;
  }, [tags]);
  return cubes.map((c, i) => (
    <RigidBody key={i} colliders={false} position={[position[0] + c.x, c.y, position[2] - 4.5]} linearDamping={0.3} angularDamping={0.3}>
      <CuboidCollider args={[0.6, 0.6, 0.6]} density={0.4} friction={0.7} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial color={c.color} roughness={0.7} />
      </mesh>
      <Text position={[0, 0, 0.61]} font={FONT} fontSize={c.tag.length > 9 ? 0.15 : 0.19} color={INK} anchorX="center" anchorY="middle" maxWidth={1.1} textAlign="center">
        {c.tag}
      </Text>
      <Text position={[0, 0.61, 0]} rotation-x={-Math.PI / 2} font={FONT} fontSize={c.tag.length > 9 ? 0.15 : 0.19} color={INK} anchorX="center" anchorY="middle" maxWidth={1.1} textAlign="center">
        {c.tag}
      </Text>
    </RigidBody>
  ));
}

// ───────── About signboard ─────────
export function AboutBoard({ position, lines }) {
  const [x, , z] = position;
  return (
    <group position={[x, 0, z - 5.5]}>
      <RigidBody type="fixed" colliders={false}>
        {/* one solid block down to the ground: a board edge at roof height used to catch the car and flip it */}
        <CuboidCollider args={[2.2, 1.9, 0.2]} position={[0, 1.9, 0]} />
      </RigidBody>
      <mesh position={[0, 0.6, 0]} castShadow><cylinderGeometry args={[0.13, 0.16, 1.2, 10]} /><meshStandardMaterial color="#6b3b35" /></mesh>
      <mesh position={[0, 2.4, 0]} castShadow><boxGeometry args={[4.4, 2.8, 0.3]} /><meshStandardMaterial color="#a98bd6" roughness={0.6} /></mesh>
      {lines.map((l, i) => (
        <Text key={i} position={[0, 3.3 - i * 0.55, 0.16]} font={i === 0 ? FONT : FONT_REG} fontSize={i === 0 ? 0.42 : 0.22} color="#ffffff" maxWidth={4} textAlign="center" anchorX="center">
          {l}
        </Text>
      ))}
    </group>
  );
}
