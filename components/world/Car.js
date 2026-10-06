"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider, useRapier, useBeforePhysicsStep } from "@react-three/rapier";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { input } from "./input";
import { sfx } from "./sound";
import { SPAWN_POS } from "./zones";
import { B, brunoify } from "./bruno";
import { terrain } from "./terrain";
import { cycle } from "./dayCycle";

export const SPAWN = SPAWN_POS;

// Real vehicle physics: Rapier's ray-cast vehicle (suspension, tyre grip, engine & brake
// forces per wheel). Nothing locks the rotation, so ramps, crashes and hard turns can flip it.
// Wheel layout matches Bruno Simon's vehicle model (folio-2025, MIT): ±0.75 m track, ±0.9 m axles
const WHEEL_R = 0.4;
const WHEELS = [
  { x: -0.75, z: -0.9, front: true },
  { x: 0.75, z: -0.9, front: true },
  { x: -0.75, z: 0.9, front: false },
  { x: 0.75, z: 0.9, front: false },
];
const SUSP_REST = 0.32;
const HARDPOINT_Y = 0.25;

const up = new THREE.Vector3();
const q = new THREE.Quaternion();
const fwd = new THREE.Vector3();
const tmp = new THREE.Vector3();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));


export default function Car({ carRef, onFlipped }) {
  const body = useRef();
  const ctrl = useRef();
  const wheelRefs = useRef([]);
  const spinRefs = useRef([]);
  const strutRefs = useRef([]);
  const partsRef = useRef(null);
  const state = useRef({ speed: 0, throttle: 0, slip: 0, upsideFor: 0, boosting: false, flipped: false });
  const { world } = useRapier();

  useEffect(() => {
    const rb = body.current;
    if (!rb) return;
    const v = world.createVehicleController(rb);
    WHEELS.forEach((w, i) => {
      v.addWheel({ x: w.x, y: HARDPOINT_Y, z: w.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, SUSP_REST, WHEEL_R);
      v.setWheelSuspensionStiffness(i, 26);
      v.setWheelSuspensionCompression(i, 2.4);
      v.setWheelSuspensionRelaxation(i, 3.0);
      v.setWheelMaxSuspensionTravel(i, 0.28);
      v.setWheelMaxSuspensionForce(i, 1e5);
      v.setWheelFrictionSlip(i, w.front ? 2.6 : 2.2);
      v.setWheelSideFrictionStiffness(i, 1.1);
    });
    v.setIndexForwardAxis = 2; // the car's forward axis is Z (it drives toward -Z)
    ctrl.current = v;
    return () => { ctrl.current = null; world.removeVehicleController(v); };
  }, [world]);

  useBeforePhysicsStep((w) => {
    const v = ctrl.current, rb = body.current;
    if (!v || !rb) return;
    const s = state.current;
    const lock = input.locked ? 0 : 1; // an area has the keys: hold still
    const throttle = clamp(input.f - input.b - input.joyY, -1, 1) * lock;
    const steer = clamp(input.l - input.r - input.joyX, -1, 1) * lock;
    const fs = -v.currentVehicleSpeed(); // forward speed (m/s), positive = driving forward
    const max = input.boost ? 26 : 17;

    // Engine on the rear wheels; reverse is weaker; no push past top speed
    const mass = rb.mass();
    let force = 0;
    if (throttle > 0 && fs < max) force = throttle * mass * (input.boost ? 30 : 19);
    if (throttle < 0 && fs > -8) force = throttle * mass * (fs > 1 ? 34 : 12);
    [2, 3].forEach((i) => v.setWheelEngineForce(i, -force / 2));

    // Steering tightens at low speed, relaxes at high speed for stability
    const angle = steer * 0.55 * (1 - Math.min(Math.abs(fs) / 40, 0.45));
    [0, 1].forEach((i) => v.setWheelSteering(i, angle));

    const brake = input.brake || input.locked ? mass * 0.09 : throttle === 0 ? mass * 0.006 : 0;
    for (let i = 0; i < 4; i++) v.setWheelBrake(i, brake);

    v.updateVehicle(w.timestep, undefined, undefined, (c) => !c.isSensor());

    // Sideways slip of the rear tyres → skid sound + dust
    s.slip = (Math.abs(v.wheelSideImpulse(2)) + Math.abs(v.wheelSideImpulse(3))) / Math.max(mass * 0.05, 1);
    s.speed = fs;
    s.throttle = throttle;
  });

  useFrame((_, rawDt) => {
    const rb = body.current, v = ctrl.current;
    if (!rb || !v) return;
    const dt = Math.min(rawDt, 1 / 30);
    const s = state.current;
    carRef.current = rb;

    const r = rb.rotation();
    q.set(r.x, r.y, r.z, r.w);
    up.set(0, 1, 0).applyQuaternion(q);
    const t = rb.translation();

    // Upside down for a moment → offer the flip-back
    s.upsideFor = up.y < 0.35 ? s.upsideFor + dt : 0;
    const flipped = s.upsideFor > 0.8;
    if (flipped !== s.flipped) { s.flipped = flipped; onFlipped?.(flipped); }

    if (input.flip) {
      input.flip = false;
      // Keep the heading, stand the car upright and drop it from a little height
      fwd.set(0, 0, -1).applyQuaternion(q); fwd.y = 0;
      const yaw = fwd.lengthSq() > 1e-4 ? Math.atan2(-fwd.x, -fwd.z) : 0;
      q.setFromAxisAngle(tmp.set(0, 1, 0), yaw);
      rb.setTranslation({ x: t.x, y: Math.max(t.y, 0) + 1.6, z: t.z }, true);
      rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    if (input.teleport) {
      const { x, z, yaw } = input.teleport;
      input.teleport = null;
      rb.setTranslation({ x, y: 1.4, z }, true);
      rb.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    if (input.reset || t.y < -6) {
      input.reset = false;
      rb.setTranslation({ x: SPAWN[0], y: SPAWN[1], z: SPAWN[2] }, true);
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    // Wheels follow the suspension, steering and rolling computed by the vehicle
    WHEELS.forEach((w, i) => {
      const g = wheelRefs.current[i];
      if (!g) return;
      const len = v.wheelSuspensionLength(i) ?? SUSP_REST;
      g.position.set(w.x, HARDPOINT_Y - len, w.z);
      g.rotation.y = v.wheelSteering(i) ?? 0;
      // Bruno's trick: the strut only shows as far as the suspension is extended
      const strut = strutRefs.current[i];
      if (strut) strut.scale.y = Math.max(0.01, CHASSIS_Y - (HARDPOINT_Y - len) - 0.5);
      if (spinRefs.current[i]) spinRefs.current[i].rotation.z = (w.x < 0 ? -1 : 1) * (v.wheelRotation(i) ?? 0);
    });

    // Stop lights when braking or reversing; blinkers while steering
    const parts = partsRef.current;
    if (parts) {
      if (parts.stop) parts.stop.visible = input.brake || s.throttle < 0;
      const blink = Math.floor(performance.now() / 350) % 2 === 0;
      const steer = input.l - input.r - input.joyX;
      if (parts.left) parts.left.visible = steer > 0.2 && blink;
      if (parts.right) parts.right.visible = steer < -0.2 && blink;
    }

    // Sound
    if (input.boost && !s.boosting && s.throttle > 0) sfx.whoosh();
    s.boosting = input.boost;
    if (input.honk) { input.honk = false; sfx.honk(); }
    // Water: lapping when a pond is close (sampled a few times a second), a splash when driving in
    s.waterTick = (s.waterTick || 0) + 1;
    if (s.waterTick % 8 === 0) {
      let w = 0;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; w = Math.max(w, terrain.depth(t.x + Math.cos(a) * 8, t.z + Math.sin(a) * 8)); }
      s.water = THREE.MathUtils.smoothstep(w, 0.15, 0.45);
      const inWater = terrain.depth(t.x, t.z) > 0.22;
      if (inWater && !s.inWater && Math.abs(s.speed) > 3) sfx.splash(Math.abs(s.speed) / 14);
      s.inWater = inWater;
    }
    sfx.update({ speed: s.speed, throttle: s.throttle, boost: input.boost, slip: s.slip, water: s.water || 0 });
    window.__carState = s;
  });

  const onContact = (e) => {
    if (e.other.rigidBodyObject?.name === "ground") return;
    sfx.impact(e.totalForceMagnitude / 9000);
  };

  return (
    <RigidBody ref={body} name="car" colliders={false} position={SPAWN} canSleep={false} ccd angularDamping={0.6} linearDamping={0.05} onContactForce={onContact}>
      {/* Body collider + a dense, low "ballast" so the centre of mass sits low (flips need effort) */}
      <CuboidCollider args={[0.8, 0.3, 1.3]} position={[0, 0.55, 0]} density={1.2} friction={0.4} />
      <CuboidCollider args={[0.6, 0.12, 1]} position={[0, 0.2, 0]} density={7} friction={0.4} />
      <CuboidCollider args={[0.6, 0.22, 0.6]} position={[0, 1.0, 0.15]} density={0.3} friction={0.4} />
      <CarModel partsRef={partsRef} />
      {WHEELS.map((w, i) => (
        <group key={i} ref={(el) => { wheelRefs.current[i] = el; }} position={[w.x, HARDPOINT_Y - SUSP_REST, w.z]}>
          <Wheel left={w.x < 0} spinRef={(el) => (spinRefs.current[i] = el)} strutRef={(el) => (strutRefs.current[i] = el)} />
        </group>
      ))}
    </RigidBody>
  );
}

// Bruno's model is built facing +X; our physics body faces -Z, so it turns +90°.
// The body sits so its wheels (0.41 m below the chassis origin… his chassis is 0.91 m up) meet ours.
const CHASSIS_Y = HARDPOINT_Y - SUSP_REST - WHEEL_R + 0.91;

function useVehicle() {
  const { scene } = useGLTF(B("vehicle"));
  return useMemo(() => {
    const chassis = brunoify(scene.getObjectByName("chassis001").clone(true));
    const wheel = brunoify(scene.getObjectByName("wheelContainer001").clone(true));
    wheel.position.set(0, 0, 0);
    return { chassis, wheel };
  }, [scene]);
}

// One wheel assembly (tyre, hub, mudguard, suspension strut); the default faces the car's left
function Wheel({ left, spinRef, strutRef }) {
  const { wheel } = useVehicle();
  const obj = useMemo(() => {
    const c = wheel.clone(true);
    if (!left) c.rotation.y = Math.PI;
    return c;
  }, [wheel, left]);
  const cylinder = useMemo(() => obj.getObjectByName("wheelCylinder001"), [obj]);
  useEffect(() => {
    spinRef(cylinder);
    const strut = obj.getObjectByName("wheelSuspension002");
    if (strut) strut.scale.y = 0.01;
    strutRef(strut);
  }, [obj, cylinder, spinRef, strutRef]);
  return (
    <group rotation-y={Math.PI / 2}>
      <primitive object={obj} />
    </group>
  );
}

function CarModel({ partsRef }) {
  const { chassis } = useVehicle();
  const obj = useMemo(() => chassis.clone(true), [chassis]);
  useEffect(() => {
    const get = (n) => obj.getObjectByName(n);
    const parts = { stop: get("stopLights001"), left: get("blinkerLeft001"), right: get("blinkerRight001"), back: get("backLights") };
    Object.values(parts).forEach((p) => p && (p.visible = false));
    partsRef.current = parts;
  }, [obj, partsRef]);
  return (
    <group>
      <group position={[0, CHASSIS_Y, 0]} rotation-y={Math.PI / 2}>
        <primitive object={obj} position={[0, 0, 0]} />
      </group>
      <Headlight />
    </group>
  );
}

// Spotlight aimed down the road; its target must live in the scene graph to follow the car
function Headlight() {
  const light = useRef();
  const target = useRef();
  useEffect(() => { light.current.target = target.current; }, []);
  // a longer, brighter beam at night
  useFrame(() => {
    const n = cycle.nightAmount, l = light.current;
    if (l) { l.intensity = 18 + n * 60; l.distance = 16 + n * 16; }
  });
  return (
    <>
      <spotLight ref={light} position={[0, 0.7, -1.6]} angle={0.55} penumbra={0.7} distance={16} intensity={18} color="#fff1d6" />
      <object3D ref={target} position={[0, -0.4, -8]} />
    </>
  );
}
