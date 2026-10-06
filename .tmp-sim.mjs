import RAPIER from "./node_modules/@react-three/rapier/node_modules/@dimforge/rapier3d-compat/rapier.mjs";
await RAPIER.init();
const HALF = +process.argv[2] || 260, ROWS = 160;
function run({ brakeIdle = 0.006, yaw = 1.5708, drop = 1.4, x = -14, z = 121, steps = 600 }) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  const g = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const h = new Float32Array((ROWS + 1) ** 2);
  world.createCollider(RAPIER.ColliderDesc.heightfield(ROWS, ROWS, h, { x: HALF * 2, y: 1, z: HALF * 2 }).setFriction(0.8), g);
  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, drop, z).setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setCanSleep(false).setAngularDamping(0.6).setLinearDamping(0.05).setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.8, 0.3, 1.3).setTranslation(0, 0.55, 0).setDensity(1.2).setFriction(0.4), rb);
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 0.12, 1).setTranslation(0, 0.2, 0).setDensity(7).setFriction(0.4), rb);
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 0.22, 0.6).setTranslation(0, 1.0, 0.15).setDensity(0.3).setFriction(0.4), rb);
  const v = world.createVehicleController(rb);
  [[-0.75, -0.9, 1], [0.75, -0.9, 1], [-0.75, 0.9, 0], [0.75, 0.9, 0]].forEach(([wx, wz, front], i) => {
    v.addWheel({ x: wx, y: 0.25, z: wz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.32, 0.4);
    v.setWheelSuspensionStiffness(i, 32); v.setWheelSuspensionCompression(i, 3); v.setWheelSuspensionRelaxation(i, 3);
    v.setWheelMaxSuspensionTravel(i, 0.28); v.setWheelMaxSuspensionForce(i, 1e5);
    v.setWheelFrictionSlip(i, front ? 2.6 : 2.2); v.setWheelSideFrictionStiffness(i, 1.1);
  });
  const out = [];
  for (let s = 0; s < steps; s++) {
    const mass = rb.mass();
    for (let i = 0; i < 4; i++) { v.setWheelBrake(i, mass * brakeIdle); v.setWheelEngineForce(i, 0); v.setWheelSteering(i, 0); }
    v.updateVehicle(world.timestep, undefined, undefined, (c) => !c.isSensor());
    world.step();
    if (s % 120 === 119) { const t = rb.translation(), l = rb.linvel(); out.push(`t=${((s + 1) / 60).toFixed(0)}s pos=(${t.x.toFixed(2)},${t.y.toFixed(2)},${t.z.toFixed(2)}) v=${Math.hypot(l.x, l.z).toFixed(3)}`); }
  }
  return out.join(" | ");
}
console.log("grid drop  :", run({}));
console.log("spawn-like :", run({ yaw: 0, x: 0, z: 22, drop: 1.6 }));
console.log("brake 0.05 :", run({ brakeIdle: 0.05 }));
