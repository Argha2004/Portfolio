"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import * as THREE from "three";

// Kenney kits (CC0) copied to /public/models/<kit>/. Each kit is modelled on a 1-unit grid;
// these scales make every kit read at real-world size next to the car.
export const SCALE = { roads: 8, graveyard: 3, forest: 3.5, arena: 4 };
export const model = (kit, name) => `/models/${kit}/${name}.glb`;

// Flatten a GLB into its meshes (with their local transforms) + its bounding box
export function useParts(url) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const parts = [];
    scene.traverse((o) => { if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() }); });
    return { parts, box: new THREE.Box3().setFromObject(scene) };
  }, [scene]);
}

const toVec = (s = 1) => (Array.isArray(s) ? s : [s, s, s]);

// Many copies of one model as InstancedMeshes (one draw call per sub-mesh).
// items: [{ p: [x, y, z], r: rotationY, s: scale | [sx, sy, sz] }]
export function Instanced({ url, ...rest }) {
  const { parts } = useParts(url);
  return <InstancedParts parts={parts} {...rest} />;
}

// Same, from already-extracted parts ([{ geometry, material, matrix }])
export function InstancedParts({ parts, items, castShadow = true, receiveShadow = true }) {
  const refs = useRef([]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    parts.forEach((part, pi) => {
      const im = refs.current[pi];
      if (!im) return;
      items.forEach((it, i) => {
        q.setFromEuler(e.set(0, it.r || 0, 0));
        m.compose(pos.set(...it.p), q, sc.set(...toVec(it.s))).multiply(part.matrix);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
  }, [parts, items]);
  if (!items.length) return null;
  return parts.map((part, pi) => (
    <instancedMesh key={pi} ref={(el) => (refs.current[pi] = el)} args={[part.geometry, part.material, items.length]} castShadow={castShadow} receiveShadow={receiveShadow} />
  ));
}

// Fixed colliders for instanced items, sized from the model's bounding box.
// shape "box" fits the whole footprint; "trunk" is a thin cylinder (trees, poles).
export function StaticColliders({ url, ...rest }) {
  const { box } = useParts(url);
  return <BoxColliders box={box} {...rest} />;
}

export function BoxColliders({ box, items, shape = "box", shrink = 1 }) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return (
    <RigidBody type="fixed" colliders={false}>
      {items.map((it, i) => {
        const [sx, sy, sz] = toVec(it.s);
        const h = (size.y * sy) / 2;
        if (shape === "trunk") {
          const r = Math.max(Math.min(size.x * sx, size.z * sz) * 0.12, 0.18);
          return <CylinderCollider key={i} args={[h, r]} position={[it.p[0], it.p[1] + h, it.p[2]]} />;
        }
        // rotate the box's centre offset with the item
        const off = new THREE.Vector3(center.x * sx, center.y * sy, center.z * sz).applyAxisAngle(new THREE.Vector3(0, 1, 0), it.r || 0);
        return (
          <CuboidCollider key={i} args={[(size.x * sx * shrink) / 2, h, (size.z * sz * shrink) / 2]}
            position={[it.p[0] + off.x, it.p[1] + off.y, it.p[2] + off.z]} rotation={[0, it.r || 0, 0]} />
        );
      })}
    </RigidBody>
  );
}

// Convenience: instanced visuals + matching fixed colliders
export function Placed({ url, items, collider = "box", shrink, castShadow }) {
  return (
    <>
      <Instanced url={url} items={items} castShadow={castShadow} />
      {collider && <StaticColliders url={url} items={items} shape={collider} shrink={shrink} />}
    </>
  );
}

// A single physics-enabled model you can knock over (gravestones, cones, pumpkins, bins…)
export function Dynamic({ url, position, rotation = 0, scale = 1, density = 0.35, children }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return c;
  }, [scene]);
  const { box } = useParts(url);
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(scale);
  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  return (
    <RigidBody position={position} rotation={[0, rotation, 0]} colliders={false} linearDamping={0.3} angularDamping={0.3}>
      <CuboidCollider args={[Math.max(size.x / 2, 0.05), Math.max(size.y / 2, 0.05), Math.max(size.z / 2, 0.05)]} position={[center.x, center.y, center.z]} density={density} friction={0.7} />
      <primitive object={obj} scale={scale} />
      {children}
    </RigidBody>
  );
}

// Seeded random so the world is identical on every visit
export function rng(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}
