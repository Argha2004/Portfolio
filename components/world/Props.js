"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Text, Text3D, Center } from "@react-three/drei";

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

// ───────── Physics letters you can crash into ─────────
export function Letters({ word = "ARGHADEEP", x = 0, z = -9, size = 1.6, spacing = 1.55 }) {
  const chars = [...word];
  const start = x - ((chars.length - 1) * spacing) / 2;
  return chars.map((ch, i) => (
    <RigidBody key={i} colliders={false} position={[start + i * spacing, 0.9, z]} linearDamping={0.4} angularDamping={0.4}>
      <CuboidCollider args={[0.62, 0.85, 0.28]} density={0.6} friction={0.6} />
      <Center>
        <Text3D font="/fonts/helvetiker_bold.typeface.json" size={size} depth={0.5} bevelEnabled bevelSize={0.03} bevelThickness={0.03} curveSegments={6} castShadow>
          {ch}
          <meshStandardMaterial color="#fff3e8" roughness={0.6} />
        </Text3D>
      </Center>
    </RigidBody>
  ));
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
