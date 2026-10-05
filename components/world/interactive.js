"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { CAM_OFFSET } from "./zones";
import { HAND_FAMILY, handReady } from "./fonts";
import { sfx } from "./sound";

// ───────── Interactive points, after Bruno Simon's folio-2025 (MIT: InteractivePoints.js) ─────────
// A small dark disc floating in the world, tilted towards the camera. Drive close and it opens:
// a handwritten label slides out of it and the Enter key icon appears. Press Enter (or click it)
// to interact. Only the nearest open point reacts to Enter.
const BACK = "#251f2b";
const FACING = Math.atan2(CAM_OFFSET[0], CAM_OFFSET[2]); // face the chase camera
const points = new Set();
let listening = false;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  addEventListener("keydown", (e) => {
    if (e.code !== "Enter" && e.code !== "NumpadEnter") return;
    let best = null;
    for (const p of points) if (p.open && p.enabled() && (!best || p.dist < best.dist)) best = p;
    if (best) { e.preventDefault(); best.interact(); }
  });
}

function labelTexture(text, align) {
  const h = 64, padNear = 12, padFar = 60, font = `700 ${h}px ${HAND_FAMILY}`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + padNear + padFar + 2;
  canvas.width = w; canvas.height = h;
  ctx.fillStyle = BACK; ctx.fillRect(0, 0, w, h);
  ctx.font = font; ctx.fillStyle = "#ffffff"; ctx.textBaseline = "middle";
  ctx.fillText(text, align === "left" ? padNear + 1 : padFar + 1, h * 0.5 + 2);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return { texture: t, aspect: w / h };
}

const disc = new THREE.CircleGeometry(0.5, 40);
const labelGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0); // grows from its left edge

// position: local (inside the parent group) · worldPosition: for the distance test (defaults to position)
export function InteractivePoint({ position, worldPosition, label, align = "right", onInteract, carRef, radius = 3.5, enabled = true, scale = 0.85 }) {
  const wp = worldPosition || position;
  const group = useRef(), labelMesh = useRef(), key = useRef(), dot = useRef();
  const keyTex = useTexture("/models/bruno/ui/key-enter.png");
  const state = useMemo(() => ({ open: false, dist: Infinity, reveal: 0 }), []);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;

  const mats = useMemo(() => ({
    back: new THREE.MeshBasicMaterial({ color: BACK, toneMapped: false }),
    dot: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
    label: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, toneMapped: false }),
    key: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, alphaTest: 0.5, toneMapped: false }),
  }), []);
  const aspect = useRef(3);

  useEffect(() => {
    mats.key.alphaMap = keyTex; mats.key.needsUpdate = true;
  }, [keyTex, mats]);

  useEffect(() => {
    let alive = true;
    handReady().then(() => {
      if (!alive) return;
      const { texture, aspect: a } = labelTexture(label, align);
      mats.label.map = texture; mats.label.needsUpdate = true;
      aspect.current = a;
    });
    return () => { alive = false; };
  }, [label, align, mats]);

  useEffect(() => {
    listen();
    const p = { get open() { return state.open; }, get dist() { return state.dist; }, enabled: () => enabledRef.current, interact: () => interactRef.current?.() };
    points.add(p);
    return () => points.delete(p);
  }, [state]);

  useFrame((_, dt) => {
    const rb = carRef?.current;
    if (rb && group.current) {
      const t = rb.translation();
      state.dist = Math.hypot(t.x - wp[0], t.z - wp[2]);
    }
    const wasOpen = state.open;
    state.open = enabledRef.current && state.dist < radius;
    if (state.open !== wasOpen) sfx.paper(state.open); // his paper rustle as the label slides
    state.reveal = THREE.MathUtils.damp(state.reveal, state.open ? 1 : 0, 10, dt);
    const r = state.reveal;
    if (labelMesh.current) {
      const w = 0.75 * aspect.current * r;
      labelMesh.current.scale.set(Math.max(w, 0.0001), 0.75, 1);
      labelMesh.current.position.x = align === "left" ? -w : 0;
      labelMesh.current.visible = r > 0.01;
    }
    if (key.current) { key.current.scale.setScalar(Math.max(r, 0.0001) * 0.6); key.current.visible = r > 0.01; }
    if (dot.current) dot.current.scale.setScalar(Math.max(1 - r, 0.0001) * 0.28);
    if (group.current) group.current.visible = enabledRef.current;
  });

  return (
    <group ref={group} position={position} rotation={[-Math.PI * 0.15, FACING, 0, "YXZ"]} scale={scale}>
      <mesh geometry={disc} material={mats.back} renderOrder={6} onClick={(e) => { e.stopPropagation(); interactRef.current?.(); }} />
      {/* closed: a small white dot; open: the Enter key icon */}
      <mesh ref={dot} geometry={disc} material={mats.dot} scale={0.28} renderOrder={7} position-z={0.005} />
      <mesh ref={labelMesh} geometry={labelGeo} material={mats.label} renderOrder={6} position-z={-0.002}
        onClick={(e) => { e.stopPropagation(); interactRef.current?.(); }} />
      <mesh ref={key} geometry={disc} material={mats.key} renderOrder={8} position-z={0.01} />
    </group>
  );
}
